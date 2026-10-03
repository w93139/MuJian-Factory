from unittest.mock import patch

import pytest

from core.agents.character_agent import CharacterDesignerAgent
from core.agents.reference_agent import ReferenceGeneratorAgent
from core.agents.script_agent import ScriptWriterAgent
from core.agents.storyboard_agent import StoryboardAgent
from json_utils import extract_json


def test_extract_nested_json_from_fenced_response_with_commentary():
    response = (
        "评估如下：\n```json\n"
        '{"score": 8, "details": {"reason": "花括号 } 属于文字", "issues": ["a", "b"]}}'
        "\n```\n以上是结果。"
    )
    assert extract_json(response) == {
        "score": 8,
        "details": {"reason": "花括号 } 属于文字", "issues": ["a", "b"]},
    }


def test_extract_array_and_reject_invalid_response():
    assert extract_json('镜头：[{"shot": {"duration": 5}}] 已完成') == [
        {"shot": {"duration": 5}}
    ]
    with pytest.raises(ValueError, match="JSON"):
        extract_json("没有结构化内容")


def test_script_and_storyboard_use_shared_nested_parser():
    text = '结果：```json\n{"episode": {"shots": [{"id": 1}]}}\n``` 完成'
    expected = {"episode": {"shots": [{"id": 1}]}}
    assert ScriptWriterAgent._extract_json_from_text(text) == expected
    assert StoryboardAgent._extract_json_object(text) == expected
    assert StoryboardAgent._extract_json_array('```json\n[{"scene": {"id": 1}}]\n```') == [
        {"scene": {"id": 1}}
    ]
    assert StoryboardAgent._extract_json_array(text) is None


def test_character_vlm_evaluation_accepts_nested_json():
    agent = CharacterDesignerAgent()
    response = '```json\n{"score": 8, "details": {"issues": ["背景偏暗"]}}\n```'
    with patch("models.vlm_client.VLM") as vlm_class:
        vlm_class.return_value.query.return_value = response
        result = agent._evaluate_with_vlm("example.png", "角色描述", "characters")
    assert result["details"]["issues"] == ["背景偏暗"]


def test_character_vlm_selection_accepts_nested_json():
    agent = CharacterDesignerAgent()
    response = '{"best_index": 1, "details": {"reason": "光线更自然"}}'
    with patch("models.vlm_client.VLM") as vlm_class:
        vlm_class.return_value.query.return_value = response
        path, result = agent._select_best_with_vlm(
            ["first.png", "second.png"], "人物", "人物描述", "characters"
        )
    assert path == "second.png"
    assert result["score"] == 8


def test_reference_vlm_selection_accepts_nested_json():
    agent = ReferenceGeneratorAgent()
    response = (
        '评估：{"selected_index": 1, "score": 8, '
        '"details": {"reason": "构图更好"}, "hard_failures": []} 完成'
    )
    with patch("models.vlm_client.VLM") as vlm_class:
        vlm_class.return_value.query.return_value = response
        path, result = agent._select_best_with_vlm(
            ["first.png", "second.png"], {"segment_id": "shot1"}, "剧情", "画面"
        )
    assert path == "second.png"
    assert result["score"] == 8
    assert result["selected_by_vlm"] is True


def test_reference_vlm_evaluation_accepts_nested_json():
    agent = ReferenceGeneratorAgent()
    response = '```json\n{"score": 9, "details": {"reason": "画面一致"}}\n```'
    with patch("models.vlm_client.VLM") as vlm_class:
        vlm_class.return_value.query.return_value = response
        result = agent._evaluate_with_vlm("frame.png", {"segment_id": "shot1"}, "剧情", "画面")
    assert result["details"]["reason"] == "画面一致"
