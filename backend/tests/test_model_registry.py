import pytest

from config import Config
from models.config_model import (
    get_model_config,
    get_models_by_type,
    load_model_config,
    model_records,
    parse_api_model,
)


def test_registry_contains_only_planned_providers_and_models():
    models = load_model_config()["models"]
    assert {metadata["provider"] for metadata in models.values()} <= {
        "dashscope", "ark", "openai_compatible",
    }
    assert "seedance-1-0-pro" not in models
    assert "seedance-1-0-lite" not in models
    assert "gpt-4o" not in models
    assert "wan2.7-i2v" in models
    assert {"llm", "vlm"} <= set(models["qwen3.5-plus"]["type"])
    assert {"llm", "vlm"} <= set(models["qwen3.7-plus"]["type"])


def test_model_lookup_is_exact_and_explains_available_ids():
    assert get_model_config("wan2.7-image")["provider"] == "dashscope"
    with pytest.raises(ValueError, match="可用模型:.*wan2.7-image"):
        get_model_config("wan2.7-image-pro-typo")
    with pytest.raises(ValueError, match="可用模型"):
        get_model_config("wan2.7")


def test_openai_compatible_models_merge_at_lookup_time(monkeypatch):
    config = {
        **Config.CONFIG,
        "api_providers": {
            **Config.CONFIG["api_providers"],
            "openai_compatible": {
                "models": [
                    {"id": "custom-chat", "type": ["llm", "vlm"], "name": "自定义视觉模型"},
                    {"id": "qwen3-max", "type": ["llm"], "name": "冲突条目"},
                    {"id": "invalid-image", "type": ["t2i"]},
                ],
            },
        },
    }
    monkeypatch.setattr(Config, "CONFIG", config)
    assert get_model_config("custom-chat") == {
        "name": "自定义视觉模型",
        "provider": "openai_compatible",
        "type": ["llm", "vlm"],
        "concurrency": 10,
    }
    assert get_model_config("qwen3-max")["provider"] == "dashscope"
    assert any(model["id"] == "custom-chat" for model in get_models_by_type("vlm"))
    with pytest.raises(ValueError):
        get_model_config("invalid-image")

    config["api_providers"]["openai_compatible"]["models"] = []
    with pytest.raises(ValueError):
        get_model_config("custom-chat")


def test_media_ids_and_capabilities_match_verified_limits():
    standard = get_model_config("doubao-seedance-2-0-260128")["capabilities"]
    fast = get_model_config("doubao-seedance-2-0-fast-260128")["capabilities"]
    assert standard["duration"] == {"min": 4, "max": 15, "integer": True, "verified": True}
    assert fast["duration"] == standard["duration"]
    assert standard["resolutions"] == ["480p", "720p", "1080p", "4k"]
    assert fast["resolutions"] == ["480p", "720p"]
    assert get_model_config("wan2.7-r2v")["capabilities"]["duration"]["max"] == 10
    assert get_model_config("wan2.7-i2v")["capabilities"]["duration"]["max"] == 15
    assert get_model_config("happyhorse-1.0-i2v")["capabilities"]["duration"]["min"] == 3
    assert get_model_config("wan2.7-image")["capabilities"]["resolutions"] == ["1K", "2K"]
    assert get_model_config("wan2.7-image-pro")["capabilities"]["resolution_constraints"]["i2i"] == ["1K", "2K"]


def test_api_media_selector_rejects_unknown_or_wrong_provider():
    assert parse_api_model("api/dashscope/wan2.7-i2v", "video") == ("dashscope", "wan2.7-i2v")
    assert parse_api_model("wan2.7-image", "image") == ("dashscope", "wan2.7-image")
    with pytest.raises(ValueError):
        parse_api_model("api/ark/wan2.7-i2v", "video")
    with pytest.raises(ValueError):
        parse_api_model("api/dashscope/wan2.7-i2v-typo", "video")
    assert all(record["provider"] != "openai" for record in model_records())
