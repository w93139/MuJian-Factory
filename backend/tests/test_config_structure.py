import logging

import yaml

import config


def test_unknown_old_sections_are_ignored_without_migration(caplog):
    with caplog.at_level(logging.WARNING):
        values = config._coerce_config(
            {
                "api_providers": {
                    "openai": {"api_key": "old-sample"},
                    "dashscope": {"api_key": "dash-sample", "enable_proxy": True},
                    "openai_compatible": {
                        "models": [{"id": "sample", "type": ["llm"], "name": "Sample"}]
                    },
                },
                "models": {"video": "old-video"},
            }
        )

    assert set(values["api_providers"]) == {"common", "dashscope", "ark", "openai_compatible"}
    assert values["api_providers"]["dashscope"]["api_key"] == "dash-sample"
    assert values["api_providers"]["openai_compatible"]["models"][0]["id"] == "sample"
    assert "video" not in values["models"]
    assert len(caplog.records) == 1


def test_environment_overrides_file_without_changing_file_values(monkeypatch, tmp_path):
    path = tmp_path / "config.yaml"
    path.write_text(
        yaml.safe_dump(
            {
                "api_providers": {
                    "dashscope": {"api_key": "file-dash"},
                    "ark": {"api_key": "file-ark"},
                    "openai_compatible": {"api_key": "file-compat", "base_url": "https://file.example"},
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(config, "CONFIG_PATH", path)
    for variable in config.ENV_CONFIG_PATHS:
        monkeypatch.setenv(variable, f"env-{variable.lower()}")

    effective = config.load_config()
    from_file = config.load_config(apply_env=False)

    for variable, key_path in config.ENV_CONFIG_PATHS.items():
        assert config._get(effective, key_path) == f"env-{variable.lower()}"
    assert from_file["api_providers"]["dashscope"]["api_key"] == "file-dash"
    assert from_file["api_providers"]["ark"]["api_key"] == "file-ark"
    assert from_file["api_providers"]["openai_compatible"]["api_key"] == "file-compat"
    assert yaml.safe_load(path.read_text(encoding="utf-8"))["api_providers"]["dashscope"]["api_key"] == "file-dash"


def test_supported_provider_config_is_copy():
    provider = config.Config.provider_config("dashscope")
    provider["api_key"] = "changed"
    assert config.Config.provider_config("dashscope")["api_key"] != "changed"
