import pytest

from core.agents import script_agent


@pytest.mark.asyncio
async def test_smart_continue_uses_existing_chinese_script_for_prompt_language(monkeypatch):
    agent = script_agent.ScriptWriterAgent()
    responses = iter(
        [
            "续写初稿",
            "台词建议",
            "情节建议",
            "修改后的续写",
            '{"new_characters": [], "new_settings": []}',
            '{"new_episodes": [{"episode_number": 2, "content": "续写内容"}]}',
        ]
    )
    prompt_languages = []

    def fake_prompt(name, lang="zh"):
        prompt_languages.append((name, lang))
        return "prompt"

    monkeypatch.setattr(script_agent, "_get_script_prompt", fake_prompt)
    monkeypatch.setattr(agent, "_cancellable_query", lambda *args: next(responses))
    monkeypatch.setattr(agent, "_save_result", lambda *args: None)
    monkeypatch.setattr("models.llm_client.LLM", lambda: object())

    result = await agent.process(
        {
            "session_id": "test-session",
            "title": "A title",
            "llm_model": "qwen3-max",
            "episodes": [{"episode_number": 1, "content": "第一集：开场"}],
            "characters": [],
            "settings": [],
        },
        intervention={"action": "smart_continue", "episodes_to_add": 1, "sequel_idea": "继续"},
    )

    assert result["payload"]["new_episodes"][0]["episode_number"] == 2
    assert ("eval_dialogue", "zh") in prompt_languages
    assert ("eval_plot", "zh") in prompt_languages
    assert ("revise_script", "zh") in prompt_languages
