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
