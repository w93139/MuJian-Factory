"""Trial mode must never repeat a paid submission after an ambiguous failure."""

from unittest.mock import AsyncMock, MagicMock

import pytest
import requests

from core.agents.character_agent import CharacterDesignerAgent
from core.agents.reference_agent import ReferenceGeneratorAgent
from core.agents.storyboard_agent import StoryboardAgent
from usage import BudgetExceeded


@pytest.fixture
def trial_mode(monkeypatch):
    monkeypatch.setenv("MUJIAN_TASK_BUDGET_CNY", "40")


@pytest.mark.parametrize("failure", [requests.Timeout("ambiguous submission"), BudgetExceeded("exhausted")])
def test_character_failure_never_submits_again(trial_mode, monkeypatch, tmp_path, failure):
    agent = CharacterDesignerAgent()
    monkeypatch.setattr(agent, "_get_style_prompt", lambda _: "style")
    monkeypatch.setattr(agent, "_char_prompt", lambda *_: "prompt")
    monkeypatch.setattr(agent, "_next_version_path", lambda *_: str(tmp_path / "image.png"))
    client = MagicMock()
    client.generate_image.side_effect = failure
    with pytest.raises(type(failure), match=str(failure)):
        agent._generate_one(client, "character", "name", "description", "characters", "style", "", "image", "vision", "session")
    client.generate_image.assert_called_once()


@pytest.mark.parametrize("failure", [requests.Timeout("ambiguous submission"), BudgetExceeded("exhausted")])
def test_reference_failure_never_submits_again(trial_mode, monkeypatch, tmp_path, failure):
    agent = ReferenceGeneratorAgent()
    monkeypatch.setattr(agent, "_get_style_prompt", lambda _: "style")
    monkeypatch.setattr(agent, "_next_version_path", lambda *_: str(tmp_path / "image.png"))
    client = MagicMock()
    client.generate_image.side_effect = failure
    with pytest.raises(type(failure), match=str(failure)):
        agent._generate_one(client, "session", {"segment_id": "seg1"}, "prompt", [], "style", "image", "image")
    client.generate_image.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("method", ["_query_json_array_with_retries", "_query_json_object_with_retries"])
@pytest.mark.parametrize("failure", [requests.Timeout("ambiguous submission"), BudgetExceeded("exhausted")])
async def test_storyboard_query_propagates_without_retry(trial_mode, monkeypatch, method, failure):
    agent = StoryboardAgent()
    query = MagicMock(side_effect=failure)
    monkeypatch.setattr(agent, "_cancellable_query", query)
    with pytest.raises(type(failure), match=str(failure)):
        await getattr(agent, method)("prompt", "text", "session", label="trial")
    query.assert_called_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("method,build_method,query_method,args", [
    ("_plan_episode_segments", "_build_segmentation_prompt", "_query_json_array_with_retries", (1, "episode", "script", [], [], [], "text", "session")),
    ("_design_one_segment", "_build_segment_design_prompt", "_query_json_object_with_retries", (1, "episode", {"segment_number": 1}, "style", "text", "session")),
    ("_fix_episode_staging_continuity", "_build_staging_continuity_prompt", "_query_json_object_with_retries", (1, "episode", [], "text", "session")),
])
async def test_storyboard_outer_loop_does_not_repeat_failed_query(trial_mode, monkeypatch, method, build_method, query_method, args):
    agent = StoryboardAgent()
    monkeypatch.setattr(agent, build_method, lambda *_args, **_kwargs: "prompt")
    query = AsyncMock(side_effect=requests.Timeout("ambiguous submission"))
    monkeypatch.setattr(agent, query_method, query)
    with pytest.raises(requests.Timeout, match="ambiguous"):
        await getattr(agent, method)(*args)
    query.assert_awaited_once()
