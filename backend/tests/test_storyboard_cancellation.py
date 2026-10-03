import asyncio

import pytest

from core.agents.storyboard_agent import StoryboardAgent


@pytest.mark.asyncio
async def test_episode_failure_cancels_other_running_episode(monkeypatch):
    agent = StoryboardAgent()
    other_started = asyncio.Event()
    cancelled = []

    async def design(ep_n, *args, **kwargs):
        if ep_n == 1:
            await other_started.wait()
            raise RuntimeError("episode failed")
        other_started.set()
        try:
            await asyncio.sleep(10)
        except asyncio.CancelledError:
            cancelled.append(ep_n)
            raise

    monkeypatch.setattr(agent, "_design_episode_storyboard", design)
    input_data = {
        "session_id": "test-session",
        "llm_model": "qwen3-max",
        "_session_artifacts": {
            "script_generation": {
                "episodes": [
                    {"episode_number": 1, "content": "one"},
                    {"episode_number": 2, "content": "two"},
                ]
            }
        },
    }

    with pytest.raises(RuntimeError, match="episode failed"):
        await agent.process(input_data)

    assert cancelled == [2]
