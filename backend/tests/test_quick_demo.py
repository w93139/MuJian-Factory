from unittest.mock import patch

import pytest

from api.routers import pipelines, workflow
from api.schemas.project import ProjectStartRequest
from core.agents.script_agent import ScriptWriterAgent
from core.agents.storyboard_agent import StoryboardAgent
from quick_demo import quick_demo_video_model


@pytest.mark.asyncio
async def test_quick_demo_start_forces_one_short_episode_and_fast_video():
    request = ProjectStartRequest(
        idea="雨夜重逢", llm_model="qwen3-max", vlm_model="qwen3.5-plus",
        image_t2i_model="doubao-seedream-5-0-260128",
        image_it2i_model="doubao-seedream-5-0-260128",
        video_resolution="1080P", episodes=6, target_duration_seconds=30,
    )
    with patch.object(workflow.workflow_engine, "create_session", return_value={"status": {}}) as create:
        response = await workflow.start_project(request)
    meta = create.call_args.args[1]
    assert meta["episodes"] == 1
    assert meta["video_resolution"] == "720P"
    assert meta["video_generation_mode"] == "first_frame"
    assert meta["video_first_frame_model"] == quick_demo_video_model()
    assert response["params"]["target_duration_seconds"] == 30
    assert "30 秒" in ScriptWriterAgent._short_film_idea(request.idea, 30)
    assert ScriptWriterAgent._short_film_idea(request.idea, None) == request.idea


@pytest.mark.asyncio
async def test_video_model_list_exposes_quick_demo_recommendation():
    response = await pipelines.get_api_models(model_type="video")
    assert response["quick_demo_video_model"] in {model["id"] for model in response["models"]}


@pytest.mark.asyncio
async def test_short_storyboard_limits_three_segments_and_thirty_seconds(monkeypatch):
    agent = StoryboardAgent()
    monkeypatch.setattr(agent, "_annotate_episode_script", lambda *_: ("script", [{"unit_id": "U001"}]))

    async def plans(*_args):
        return [{"segment_number": number} for number in range(1, 6)]

    async def design(_ep, _title, plan, *_args):
        number = plan["segment_number"]
        return {
            "segment_number": number,
            "segment_id": f"seg_01_{number:02d}",
            "total_duration": 15,
            "shots": [{"duration": 3, "content": f"shot {i}"} for i in range(5)],
        }

    async def continuity(_ep, _title, segments, *_args):
        return segments

    monkeypatch.setattr(agent, "_plan_episode_segments", plans)
    monkeypatch.setattr(agent, "_design_one_segment", design)
    monkeypatch.setattr(agent, "_fix_episode_staging_continuity", continuity)
    result = await agent._design_episode_storyboard(
        1, "title", "script", [], [], "realistic", "qwen3-max", "session",
        target_duration_seconds=30,
    )
    assert len(result) == 3
    assert [item["total_duration"] for item in result] == [10, 10, 10]
    assert sum(shot["duration"] for item in result for shot in item["shots"]) == 30
    assert all(len(item["shots"]) <= 5 for item in result)
