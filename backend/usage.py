"""Conservative daily estimates for billable image and video requests."""

import json
import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

from config import settings
from models.config_model import get_model_config

USAGE_DIR = Path(settings.CODE_DIR) / "data" / "usage"
_lock = threading.RLock()
_CHINA_TIME = timezone(timedelta(hours=8))


def _today() -> str:
    return datetime.now(_CHINA_TIME).date().isoformat()


def _usage_path() -> Path:
    return USAGE_DIR / f"{_today()}.json"


def _read(path: Path) -> dict:
    if not path.exists():
        return {"date": _today(), "total_cny": "0", "entries": []}
    with path.open("r", encoding="utf-8") as handle:
        record = json.load(handle)
    if not isinstance(record, dict) or not isinstance(record.get("entries"), list):
        raise ValueError(f"用量记录损坏: {path}")
    return record


def today_usage() -> dict:
    with _lock:
        record = _read(_usage_path()).copy()
        limit = _daily_limit()
        record["limit_cny"] = str(limit) if limit is not None else None
        record["remaining_cny"] = str(max(Decimal("0"), limit - Decimal(str(record.get("total_cny", "0"))))) if limit is not None else None
        return record


def _daily_limit() -> Decimal | None:
    raw = os.environ.get("MUJIAN_DAILY_BUDGET_CNY", "").strip()
    if not raw:
        return None
    try:
        limit = Decimal(raw)
    except InvalidOperation as exc:
        raise ValueError("MUJIAN_DAILY_BUDGET_CNY 必须是有效金额") from exc
    if limit < 0:
        raise ValueError("MUJIAN_DAILY_BUDGET_CNY 不能为负数")
    return limit


def reserve_usage(model: str, *, images: int = 0, seconds: int = 0) -> Decimal:
    """Reserve a registry estimate immediately before submitting a paid request."""
    metadata = get_model_config(model)
    if images and seconds or not (images or seconds):
        raise ValueError("必须指定图片张数或视频秒数")
    kind = "image" if images else "video"
    quantity = images or seconds
    rate_key = "price_per_image" if images else "price_per_second"
    if rate_key not in metadata:
        raise ValueError(f"模型未配置费用估算: {model}")
    rate = Decimal(str(metadata[rate_key]))
    estimated = rate * quantity
    path = _usage_path()

    with _lock:
        record = _read(path)
        total = Decimal(str(record.get("total_cny", "0")))
        limit = _daily_limit()
        if limit is not None and total + estimated > limit:
            raise RuntimeError("今日生成额度已用完")
        record["total_cny"] = str(total + estimated)
        record["entries"].append({
            "at": datetime.now(_CHINA_TIME).isoformat(),
            "model": model,
            "kind": kind,
            "quantity": quantity,
            "unit_price_cny": str(rate),
            "estimated_cny": str(estimated),
        })
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
        try:
            with temporary.open("w", encoding="utf-8") as handle:
                json.dump(record, handle, ensure_ascii=False, indent=2)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
    return estimated
