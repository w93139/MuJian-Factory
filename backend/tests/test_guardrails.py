import json
import threading
from decimal import Decimal

import pytest
from fastapi import BackgroundTasks, HTTPException

from api.routers import pipelines
from core.orchestrator import WorkflowEngine, WorkflowStage, WorkflowState
from error_messages import safe_error_text
from job_limits import JobLimiter
from pipelines import runner
from usage import reserve_usage, today_usage


def test_daily_budget_uses_registry_price_and_rejects_overrun(monkeypatch):
    monkeypatch.setenv("MUJIAN_DAILY_BUDGET_CNY", "1.70")
    assert reserve_usage("wan2.6-i2v-flash", seconds=2) == Decimal("1.2")
    with pytest.raises(RuntimeError, match="今日生成额度已用完"):
        reserve_usage("wan2.6-i2v-flash", seconds=2)
    assert Decimal(today_usage()["total_cny"]) == Decimal("1.2")
    assert len(today_usage()["entries"]) == 1
    assert today_usage()["limit_cny"] == "1.70"
    assert Decimal(today_usage()["remaining_cny"]) == Decimal("0.50")


def test_image_estimates_are_recorded_without_budget(monkeypatch):
    monkeypatch.delenv("MUJIAN_DAILY_BUDGET_CNY", raising=False)
    price = reserve_usage("doubao-seedream-5-0-260128", images=1)
    assert Decimal(today_usage()["total_cny"]) == price
    assert today_usage()["entries"][0]["kind"] == "image"


def test_corrupted_ledger_blocks_spending(monkeypatch):
    from usage import _usage_path

    path = _usage_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"entries": "invalid"}), encoding="utf-8")
    with pytest.raises(ValueError, match="用量记录损坏"):
        reserve_usage("wan2.6-i2v-flash", seconds=2)


def test_concurrent_job_limit_releases_token(monkeypatch):
    monkeypatch.setenv("MUJIAN_MAX_CONCURRENT_JOBS", "1")
    limiter = JobLimiter()
    token = limiter.reserve()
    with pytest.raises(RuntimeError, match="当前生成任务过多"):
        limiter.reserve()
    limiter.release(token)
    assert limiter.active_count == 0
    assert limiter.reserve()


def test_provider_error_hides_configured_credentials(monkeypatch):
    monkeypatch.setattr("error_messages.settings.ARK_API_KEY", "test-secret-value")
    message = safe_error_text("api_key=test-secret-value Bearer another-token")
    assert "test-secret-value" not in message
    assert "another-token" not in message
    assert "[已隐藏密钥]" in message


@pytest.mark.asyncio
async def test_pipeline_reservation_blocks_stage_then_releases_on_failure(monkeypatch):
    monkeypatch.setenv("MUJIAN_MAX_CONCURRENT_JOBS", "1")
    limiter = JobLimiter()
    monkeypatch.setattr(pipelines, "job_limiter", limiter)
    monkeypatch.setattr(runner, "job_limiter", limiter)
    monkeypatch.setattr("core.orchestrator.job_limiter", limiter)
    monkeypatch.setattr(pipelines, "create_task", lambda **_: {
        "task_id": "test-task", "status": "pending", "output_dir": "/tmp/test-task",
    })
    background = BackgroundTasks()
    pipelines._start_task(background, "standard", {})
    assert limiter.active_count == 1
    with pytest.raises(HTTPException) as rejected:
        pipelines._start_task(BackgroundTasks(), "standard", {})
    assert rejected.value.status_code == 429

    class Agent:
        def set_cancellation_check(self, _callback):
            pass

        async def process(self, *_args, **_kwargs):
            raise AssertionError("blocked stage must not run")

    engine = object.__new__(WorkflowEngine)
    engine._state_lock = threading.RLock()
    engine._stop_events = {}
    engine.agent_factories = {WorkflowStage.SCRIPT_GENERATION: Agent}
    state = WorkflowState("test-session")
    with pytest.raises(RuntimeError, match="当前生成任务过多"):
        await engine.execute_stage(state, WorkflowStage.SCRIPT_GENERATION, {})
    assert state.status[WorkflowStage.SCRIPT_GENERATION.value] == "pending"

    async def fail_runner(*_args):
        raise RuntimeError("provider failed")

    monkeypatch.setitem(runner.PIPELINE_REGISTRY, "standard", fail_runner)
    monkeypatch.setattr(runner, "mark_running", lambda *_: None)
    monkeypatch.setattr(runner, "update_task", lambda *_args, **_kwargs: None)
    failures = []
    monkeypatch.setattr(runner, "mark_failed", lambda _task_id, reason: failures.append(reason))
    task = background.tasks[0]
    await task.func(*task.args, **task.kwargs)
    assert failures == ["provider failed"]
    assert limiter.active_count == 0


@pytest.mark.parametrize("invalid", ["NaN", "Infinity", "-1"])
def test_nonfinite_or_negative_budget_blocks(monkeypatch, invalid):
    monkeypatch.setenv("MUJIAN_DAILY_BUDGET_CNY", invalid)
    with pytest.raises(ValueError):
        reserve_usage("wan2.6-i2v-flash", seconds=2)


@pytest.mark.parametrize("kwargs", [{"seconds": -1}, {"images": -1}, {"seconds": 1.5}, {"seconds": True}, {}, {"seconds": 1, "images": 1}])
def test_invalid_billable_quantity_rejected(kwargs):
    with pytest.raises(ValueError):
        reserve_usage("wan2.6-i2v-flash", **kwargs)


def test_cumulative_budget_survives_day_change(monkeypatch, tmp_path):
    import usage

    ledger = tmp_path / "trial.json"
    ledger.write_text(json.dumps({"total_cny": "6.42", "entries": []}), encoding="utf-8")
    monkeypatch.setenv("MUJIAN_TASK_BUDGET_CNY", "40")
    monkeypatch.setenv("MUJIAN_TASK_USAGE_PATH", str(ledger))
    reserve_usage("wan2.6-i2v-flash", seconds=2)
    monkeypatch.setattr(usage, "_today", lambda: "2099-01-01")
    reserve_usage("wan2.6-i2v-flash", seconds=2)
    assert Decimal(json.loads(ledger.read_text())["total_cny"]) == Decimal("8.82")


def test_text_estimate_missing_price_fail_closed(monkeypatch):
    import usage

    monkeypatch.setenv("MUJIAN_DAILY_BUDGET_CNY", "1")
    monkeypatch.setattr(usage, "get_model_config", lambda _: {
        "price_per_million_input_tokens": "2", "price_per_million_output_tokens": "4",
    })
    assert reserve_usage("text", input_tokens=1000, output_tokens=2000) == Decimal("0.01")
    monkeypatch.setattr(usage, "get_model_config", lambda _: {})
    with pytest.raises(ValueError, match="未配置文本费用"):
        reserve_usage("custom", input_tokens=1000, output_tokens=10)
    monkeypatch.delenv("MUJIAN_DAILY_BUDGET_CNY")
    assert reserve_usage("custom", input_tokens=1000, output_tokens=10) == 0


def test_resolution_specific_price(monkeypatch):
    monkeypatch.setattr("usage.get_model_config", lambda _: {
        "price_per_second": "1", "price_per_second_by_resolution": {"720p": "2", "1080p": "4"},
    })
    assert reserve_usage("video", seconds=3, resolution="1080P") == 12
    with pytest.raises(ValueError, match="分辨率"):
        reserve_usage("video", seconds=3, resolution="4k")


def _reserve_in_process(queue):
    from usage import BudgetExceeded, reserve_usage
    try:
        reserve_usage("wan2.6-i2v-flash", seconds=2)
        queue.put("reserved")
    except BudgetExceeded:
        queue.put("blocked")


def test_cumulative_budget_locked_across_processes(monkeypatch, tmp_path):
    import multiprocessing

    ledger = tmp_path / "trial.json"
    ledger.write_text(json.dumps({"total_cny": "38.8", "entries": []}), encoding="utf-8")
    monkeypatch.setenv("MUJIAN_TASK_BUDGET_CNY", "40")
    monkeypatch.setenv("MUJIAN_TASK_USAGE_PATH", str(ledger))
    context = multiprocessing.get_context("fork")
    queue = context.Queue()
    workers = [context.Process(target=_reserve_in_process, args=(queue,)) for _ in range(4)]
    for worker in workers:
        worker.start()
    for worker in workers:
        worker.join(timeout=10)
        assert worker.exitcode == 0
    results = [queue.get(timeout=2) for _ in workers]
    assert results.count("reserved") == 1
    assert results.count("blocked") == 3
    assert Decimal(json.loads(ledger.read_text())["total_cny"]) == 40


def test_billable_context_serializes_and_retains_failure(monkeypatch, tmp_path):
    from usage import billable_request

    ledger = tmp_path / "trial.json"
    monkeypatch.setenv("MUJIAN_TASK_BUDGET_CNY", "40")
    monkeypatch.setenv("MUJIAN_TASK_USAGE_PATH", str(ledger))
    entered = threading.Event()
    release = threading.Event()
    second_entered = threading.Event()

    def first():
        with billable_request("wan2.6-i2v-flash", seconds=2):
            entered.set()
            assert release.wait(5)

    def second():
        with billable_request("wan2.6-i2v-flash", seconds=2):
            second_entered.set()

    first_thread = threading.Thread(target=first)
    second_thread = threading.Thread(target=second)
    first_thread.start()
    assert entered.wait(5)
    second_thread.start()
    assert not second_entered.wait(0.1)
    release.set()
    first_thread.join(5)
    second_thread.join(5)
    assert second_entered.is_set()
    with pytest.raises(RuntimeError, match="provider failed"):
        with billable_request("wan2.6-i2v-flash", seconds=2):
            raise RuntimeError("provider failed")
    assert Decimal(json.loads(ledger.read_text())["total_cny"]) == Decimal("3.6")


def test_registry_per_thousand_token_prices_are_supported(monkeypatch):
    monkeypatch.setattr("usage.get_model_config", lambda _: {
        "price_per_1k_input_token": "0.002", "price_per_1k_output_token": "0.004",
    })
    assert reserve_usage("text", input_tokens=1000, output_tokens=2000) == Decimal("0.01")


def test_unavailable_model_blocks_before_budget_write(monkeypatch):
    monkeypatch.setattr("usage.get_model_config", lambda _: {
        "available": False, "price_per_image": "0.2",
    })
    with pytest.raises(ValueError, match="模型当前不可用"):
        reserve_usage("closed", images=1)
    assert today_usage()["entries"] == []


def test_extra_reference_images_reserved_and_validated(monkeypatch):
    monkeypatch.setattr("usage.get_model_config", lambda _: {
        "price_per_image": "0.2", "input_image_price_after_first": "0.02",
    })
    assert reserve_usage("pro", images=1, input_images=3) == Decimal("0.24")
    assert today_usage()["entries"][0]["input_images"] == 3
    assert reserve_usage("pro", images=1, input_images=1) == Decimal("0.2")
    with pytest.raises(ValueError):
        reserve_usage("pro", images=1, input_images=-1)
    with pytest.raises(ValueError):
        reserve_usage("pro", seconds=1, input_images=2)
