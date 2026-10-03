import pytest

from core.agents.video_agent import VideoDirectorAgent


@pytest.mark.asyncio
async def test_failed_clip_keeps_exception_reason(monkeypatch):
    agent = VideoDirectorAgent()
    progress = []
    agent.set_progress_callback(lambda _phase, _step, _percent, data: progress.append(data))
    monkeypatch.setattr("models.config_model.get_max_concurrency", lambda *_: 1)
    monkeypatch.setattr(agent, "_list_versions", lambda *_: [])
    monkeypatch.setattr(agent, "_get_reference_image", lambda *_: "/missing.jpg")
    monkeypatch.setattr(agent, "_generate_one", lambda *_args: (_ for _ in ()).throw(RuntimeError("额度不足")))

    result = await agent.process({
        "session_id": "test-session",
        "video_first_frame_model": "wan2.7-i2v",
        "_session_artifacts": {
            "storyboard": {"episodes": [{"segments": [{
                "segment_id": "seg_01_01", "episode_number": 1,
                "shots": [{"content": "书房", "duration": 5}],
            }]}]},
            "character_design": {"characters": [], "settings": []},
        },
    })

    clip = result["payload"]["clips"][0]
    assert clip["status"] == "failed"
    assert clip["error"] == "额度不足"
    assert any(
        event and event.get("asset_complete", {}).get("error") == "额度不足"
        for event in progress
    )
