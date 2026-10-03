import base64
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from models import chat_client


def _response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


def _configured(monkeypatch, provider="dashscope", types=None):
    monkeypatch.setattr(chat_client, "get_model_config", lambda _model: {
        "provider": provider, "type": types or ["llm", "vlm"]
    })
    for key, value in {
        "DASHSCOPE_API_KEY": "test-key", "DASHSCOPE_COMPATIBLE_BASE_URL": "https://dashscope.test/v1",
        "ARK_API_KEY": "test-key", "ARK_BASE_URL": "https://ark.test/v3",
        "OPENAI_COMPAT_API_KEY": "test-key", "OPENAI_COMPAT_BASE_URL": "https://custom.test/v1",
        "REQUEST_TIMEOUT": 17,
    }.items():
        monkeypatch.setattr(chat_client.Config, key, value, raising=False)
    monkeypatch.setattr(chat_client.Config, "provider_proxy", lambda _provider: "")
    client = MagicMock()
    monkeypatch.setattr(chat_client, "OpenAI", MagicMock(return_value=client))
    return client


@pytest.mark.parametrize("provider,base_url", [
    ("dashscope", "https://dashscope.test/v1"),
    ("ark", "https://ark.test/v3"),
    ("openai_compatible", "https://custom.test/v1"),
])
def test_routes_to_provider_and_keeps_model_id(monkeypatch, provider, base_url):
    sdk = _configured(monkeypatch, provider)
    sdk.chat.completions.create.return_value = _response("回答")

    assert chat_client.ChatClient().query("问题", "exact-model-id") == "回答"
    assert chat_client.OpenAI.call_args.kwargs["base_url"] == base_url
    assert chat_client.OpenAI.call_args.kwargs["timeout"] == 17
    assert sdk.chat.completions.create.call_args.kwargs["model"] == "exact-model-id"


def test_empty_response_retries_three_attempts_then_raises(monkeypatch):
    sdk = _configured(monkeypatch)
    sdk.chat.completions.create.return_value = _response(None)
    monkeypatch.setattr(chat_client.time, "sleep", lambda _seconds: None)

    with pytest.raises(RuntimeError, match="空内容"):
        chat_client.ChatClient().query("问题", "model")
    assert sdk.chat.completions.create.call_count == 3


def test_unknown_model_fails_before_request(monkeypatch):
    monkeypatch.setattr(chat_client, "get_model_config", lambda _model: (_ for _ in ()).throw(ValueError("未知模型")))
    with pytest.raises(ValueError, match="未知模型"):
        chat_client.ChatClient().query("问题", "missing")


def test_dashscope_search_and_thinking_flags(monkeypatch):
    sdk = _configured(monkeypatch)
    sdk.chat.completions.create.return_value = _response("回答")
    chat_client.ChatClient().query("问题", "model", web_search=True, disable_thinking=True)
    kwargs = sdk.chat.completions.create.call_args.kwargs
    assert kwargs["extra_body"] == {"enable_search": True, "enable_thinking": False}
    assert kwargs["max_tokens"] == 4096
    assert "temperature" not in kwargs


def test_local_image_is_sent_as_data_url(monkeypatch, tmp_path):
    sdk = _configured(monkeypatch)
    sdk.chat.completions.create.return_value = _response("图像描述")
    image = tmp_path / "sample.png"
    image.write_bytes(b"picture")

    chat_client.ChatClient().query("描述图片", "model", [str(image)])
    content = sdk.chat.completions.create.call_args.kwargs["messages"][0]["content"]
    url = content[1]["image_url"]["url"]
    assert url == "data:image/png;base64," + base64.b64encode(b"picture").decode()
