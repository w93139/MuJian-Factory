import logging

from core.agents.reference_agent import ReferenceGeneratorAgent


def test_missing_character_or_setting_name_is_skipped(caplog):
    agent = ReferenceGeneratorAgent()
    with caplog.at_level(logging.WARNING):
        characters = agent._named_ids(
            [{"id": "missing"}, {"name": "阿青", "character_id": "c1"}],
            ("id", "character_id"),
            "角色",
        )
        settings = agent._named_ids(
            [{"setting_id": "missing"}, {"name": "书房", "setting_id": "s1"}],
            ("id", "setting_id"),
            "场景",
        )

    assert characters == {"阿青": "c1"}
    assert settings == {"书房": "s1"}
    assert "跳过角色" in caplog.text
    assert "跳过场景" in caplog.text
