import asyncio
import json
import queue
import threading
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi import HTTPException

import path_utils
from api.routers import workflow
from api.services.project_helpers import stream_workflow_task
from core.orchestrator import INTERRUPTED_STAGE_ERROR, WorkflowEngine, WorkflowStage, WorkflowState


def _engine(session_dir: Path) -> WorkflowEngine:
    engine = object.__new__(WorkflowEngine)
    engine.sessions = {}
    engine._session_dir = str(session_dir)
    engine._state_lock = threading.RLock()
    engine._stop_events = {}
    engine._active_sessions = set()
    engine._background_tasks = set()
    return engine


def _write_running_session(session_dir: Path, session_id: str):
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / f"{session_id}.json").write_text(
        json.dumps(
            {
                "session_id": session_id,
                "current_stage": "video_generation",
                "status": {
                    "script_generation": "completed",
                    "video_generation": "running",
                },
                "stage_progress": {"video_generation": {"percent": 40}},
                "meta": {"idea": "test"},
            }
        ),
        encoding="utf-8",
    )


@pytest.mark.parametrize("loader", ["startup", "lazy"])
def test_running_stage_is_failed_and_retryable_after_restart(tmp_path, loader):
    session_dir = tmp_path / "sessions"
    _write_running_session(session_dir, "session1")
    engine = _engine(session_dir)

    if loader == "startup":
        engine._load_sessions_from_disk()
        state = engine.sessions["session1"]
    else:
        state = engine.get_state("session1")

    assert state.status["script_generation"] == "completed"
    assert state.status["video_generation"] == "failed"
    assert state.error == INTERRUPTED_STAGE_ERROR
    assert state.stage_progress["video_generation"]["message"] == INTERRUPTED_STAGE_ERROR
    assert engine.prepare_stage_execution("session1", "video_generation", {})[0] is state
    assert json.loads((session_dir / "session1.json").read_text(encoding="utf-8"))["status"]["video_generation"] == "failed"


def test_missing_session_is_not_created(tmp_path):
    engine = _engine(tmp_path)
    with pytest.raises(KeyError, match="Session not found"):
        engine.prepare_stage_execution("missing", "script_generation", {})
    assert engine.sessions == {}


@pytest.mark.asyncio
async def test_interrupted_stage_can_execute_again(tmp_path):
    class Agent:
        def set_cancellation_check(self, callback):
            self.cancellation_check = callback

        async def process(self, input_data, intervention=None):
            assert not self.cancellation_check()
            return {"payload": {}, "stage_completed": True}

    session_dir = tmp_path / "sessions"
    _write_running_session(session_dir, "session1")
    engine = _engine(session_dir)
    engine.agent_factories = {WorkflowStage.VIDEO_GENERATION: Agent}
    engine._load_sessions_from_disk()
    state = engine.sessions["session1"]

    await engine.execute_stage(state, WorkflowStage.VIDEO_GENERATION, {})

    assert state.status["video_generation"] == "completed"
    assert state.error is None


def test_scene_asset_counts_use_backend_relative_paths(tmp_path, monkeypatch):
    monkeypatch.setattr(path_utils, "BASE_DIR", tmp_path)
    asset = tmp_path / "code" / "result" / "image" / "example.png"
    asset.parent.mkdir(parents=True)
    asset.write_bytes(b"image")
    engine = _engine(tmp_path / "sessions")
    state = WorkflowState("session1")
    state.artifacts = {
        "storyboard": {"shots": [{"scene_number": 1, "shot_id": "shot1"}]},
        "reference_generation": {
            "scenes": [{"id": "shot1", "selected": "code/result/image/example.png"}]
        },
    }
    engine.sessions[state.session_id] = state

    counts = engine.get_scene_asset_counts("session1", 1)
    assert counts["reference_images"] == 1


class _Request:
    async def json(self):
        return {}

    async def is_disconnected(self):
        return False


@pytest.mark.asyncio
async def test_execute_endpoint_returns_404_for_missing_session(tmp_path):
    with patch.object(workflow, "workflow_engine", _engine(tmp_path)):
        with pytest.raises(HTTPException) as exc_info:
            await workflow.execute_stage("missing", "script_generation", _Request())
    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_execute_endpoint_returns_400_for_invalid_stage(tmp_path):
    with patch.object(workflow, "workflow_engine", _engine(tmp_path)):
        with pytest.raises(HTTPException) as exc_info:
            await workflow.execute_stage("session1", "invalid", _Request())
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_stream_invalid_stage_yields_error_event():
    events = [
        json.loads(event)
        async for event in stream_workflow_task(
            request=_Request(),
            workflow_engine=None,
            state=None,
            stage="invalid",
            input_data={},
            cancellation_check=lambda: False,
            progress_callback=lambda *args: None,
            progress_events=queue.Queue(),
            event_trigger=asyncio.Event(),
        )
    ]
    assert events[0]["type"] == "error"


@pytest.mark.asyncio
async def test_stream_completion_does_not_wait_fifteen_seconds():
    class Engine:
        async def execute_stage(self, *args, **kwargs):
            await asyncio.sleep(0.01)
            return {}

        def persist_session_snapshot(self, session_id):
            return {"session_id": session_id}

    class State:
        session_id = "session1"

    events = await asyncio.wait_for(
        _collect_stream(Engine(), State()),
        timeout=2.0,
    )
    assert events[-1]["type"] == "stage_complete"


async def _collect_stream(engine, state):
    return [
        json.loads(event)
        async for event in stream_workflow_task(
            request=_Request(),
            workflow_engine=engine,
            state=state,
            stage=WorkflowStage.SCRIPT_GENERATION.value,
            input_data={},
            cancellation_check=lambda: False,
            progress_callback=lambda *args: None,
            progress_events=queue.Queue(),
            event_trigger=asyncio.Event(),
        )
    ]
