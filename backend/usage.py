"""Conservative estimates and optional persistent budgets for billable requests."""

import fcntl
import json
import os
import threading
import uuid
from contextlib import ExitStack, contextmanager
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from config import settings
from models.config_model import get_model_config

USAGE_DIR = Path(settings.CODE_DIR) / "data" / "usage"
_lock = threading.RLock()
_request_lock = threading.RLock()
_CHINA_TIME = timezone(timedelta(hours=8))


class BudgetExceeded(RuntimeError):
    """A request was rejected before submission because its budget is exhausted."""


def _today() -> str:
    return datetime.now(_CHINA_TIME).date().isoformat()


def _usage_path() -> Path:
    return USAGE_DIR / f"{_today()}.json"


def _amount(value, label: str) -> Decimal:
    try:
        result = Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"{label} 必须是有效金额") from exc
    if not result.is_finite() or result < 0:
        raise ValueError(f"{label} 必须是有限非负金额")
    return result


def _read(path: Path) -> dict:
    if not path.exists():
        return {"date": _today(), "total_cny": "0", "entries": []}
    try:
        with path.open("r", encoding="utf-8") as handle:
            record = json.load(handle)
        if not isinstance(record, dict) or not isinstance(record.get("entries"), list):
            raise ValueError("invalid ledger")
        _amount(record["total_cny"], "累计费用")
    except (ValueError, KeyError, TypeError) as exc:
        raise ValueError(f"用量记录损坏: {path}") from exc
    return record


def _limit(name: str) -> Decimal | None:
    raw = os.environ.get(name, "").strip()
    return _amount(raw, name) if raw else None


def _daily_limit() -> Decimal | None:
    return _limit("MUJIAN_DAILY_BUDGET_CNY")


def _task_budget() -> tuple[Path, Decimal] | None:
    limit = _limit("MUJIAN_TASK_BUDGET_CNY")
    raw = os.environ.get("MUJIAN_TASK_USAGE_PATH", "").strip()
    if limit is None and not raw:
        return None
    if limit is None or not raw:
        raise ValueError("累计任务预算必须同时设置 MUJIAN_TASK_BUDGET_CNY 和 MUJIAN_TASK_USAGE_PATH")
    return Path(raw).expanduser().resolve(), limit


@contextmanager
def _file_lock(path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def _write(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as handle:
            json.dump(record, handle, ensure_ascii=False, indent=2)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def today_usage() -> dict:
    path = _usage_path()
    with _lock, _file_lock(path.with_suffix(path.suffix + ".budget.lock")):
        record = _read(path).copy()
        limit = _daily_limit()
        record["limit_cny"] = str(limit) if limit is not None else None
        record["remaining_cny"] = str(max(Decimal("0"), limit - Decimal(record["total_cny"]))) if limit is not None else None
        return record


def _quantity(value, name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{name} 必须是非负整数")
    return value


def reserve_usage(
    model: str, *, images: int = 0, seconds: int = 0,
    input_tokens: int = 0, output_tokens: int = 0, resolution: str | None = None,
    input_images: int = 0,
) -> Decimal:
    """Reserve before every paid attempt; failed attempts remain reserved."""
    quantities = [_quantity(value, name) for value, name in (
        (images, "图片张数"), (seconds, "视频秒数"),
        (input_tokens, "输入 token"), (output_tokens, "输出 token"),
    )]
    if sum(bool(value) for value in quantities[:2]) + bool(input_tokens or output_tokens) != 1:
        raise ValueError("必须且只能指定正的图片张数、视频秒数或文本 token")
    input_images = _quantity(input_images, "参考图片张数")
    if input_images and not images:
        raise ValueError("参考图片计费必须指定输出图片张数")
    metadata = get_model_config(model)
    if metadata.get("available") is False:
        raise ValueError(f"模型当前不可用，已阻止请求: {model}")
    task = _task_budget()
    daily_limit = _daily_limit()
    budget_enabled = task is not None or daily_limit is not None
    if images or seconds:
        kind = "image" if images else "video"
        quantity = images or seconds
        rate_key = "price_per_image" if images else "price_per_second"
        rates = metadata.get("price_per_second_by_resolution") if seconds else None
        rate_value = metadata.get(rate_key)
        if rates:
            normalized_rates = {str(key).lower(): value for key, value in rates.items()}
            if resolution is None or resolution.lower() not in normalized_rates:
                raise ValueError(f"模型未配置该分辨率的费用估算: {model}/{resolution}")
            rate_value = normalized_rates[resolution.lower()]
        if rate_value is None:
            raise ValueError(f"模型未配置费用估算: {model}")
        rate = _amount(rate_value, "模型价格")
        estimated = rate * quantity
        if images and input_images > 1 and metadata.get("input_image_price_after_first") is not None:
            estimated += _amount(metadata["input_image_price_after_first"], "参考图片价格") * (input_images - 1)
    else:
        kind = "text"
        quantity = input_tokens + output_tokens
        input_rate = metadata.get("budget_price_per_million_input_tokens", metadata.get("price_per_million_input_tokens"))
        output_rate = metadata.get("budget_price_per_million_output_tokens", metadata.get("price_per_million_output_tokens"))
        if input_rate is None and metadata.get("price_per_1k_input_token") is not None:
            input_rate = _amount(metadata["price_per_1k_input_token"], "输入价格") * 1000
        if output_rate is None and metadata.get("price_per_1k_output_token") is not None:
            output_rate = _amount(metadata["price_per_1k_output_token"], "输出价格") * 1000
        if input_rate is None or output_rate is None:
            if budget_enabled:
                raise ValueError(f"模型未配置文本费用估算，预算保护已阻止请求: {model}")
            return Decimal("0")
        estimated = (_amount(input_rate, "输入价格") * input_tokens + _amount(output_rate, "输出价格") * output_tokens) / Decimal("1000000")
        rate = None
    entry = {
        "at": datetime.now(_CHINA_TIME).isoformat(), "model": model,
        "kind": kind, "quantity": quantity,
        "estimated_cny": str(estimated),
    }
    if rate is not None:
        entry["unit_price_cny"] = str(rate)
    else:
        entry.update(input_tokens=input_tokens, output_tokens=output_tokens)
    if input_images:
        entry["input_images"] = input_images
    if resolution:
        entry["resolution"] = resolution
    daily_path = _usage_path().resolve()
    if task and task[0] == daily_path:
        raise ValueError("累计任务用量路径不能与每日用量路径相同")
    ledgers = [(daily_path, daily_limit, "今日生成额度已用完")]
    if task:
        # Persist cumulative reservation first: a crash must not reset trial spending.
        ledgers.insert(0, (task[0], task[1], "累计任务生成额度已用完"))
    with _lock, ExitStack() as locks:
        for path in sorted({item[0] for item in ledgers}):
            locks.enter_context(_file_lock(path.with_suffix(path.suffix + ".budget.lock")))
        updates = []
        for path, limit, message in ledgers:
            record = _read(path)
            total = Decimal(record["total_cny"])
            if limit is not None and total + estimated > limit:
                raise BudgetExceeded(message)
            record["total_cny"] = str(total + estimated)
            record["entries"].append(entry)
            updates.append((path, record))
        for path, record in updates:
            _write(path, record)
    return estimated


@contextmanager
def billable_request(model: str, **quantities):
    """Serialize paid calls across threads/processes while a task budget is active."""
    task = _task_budget()
    if task:
        with _request_lock, _file_lock(task[0].with_suffix(task[0].suffix + ".request.lock")):
            estimate = reserve_usage(model, **quantities)
            yield estimate
    else:
        yield reserve_usage(model, **quantities)
