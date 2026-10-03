from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx
import pytest
import requests

from api.routers import sandbox
from api.schemas.sandbox import SandboxI2IRequest, SandboxT2IRequest
from models.image_client import ImageClient
from models.image_dashscope import DashScopeClient
from models.image_seedream import SeedreamClient
from models.llm_client import LLM
from models.video_client import VideoClient
from models.video_dashscope import DashscopeVideoClient
from models.video_seedance import SeedanceVideoClient


def _response(status=200, **output):
    return SimpleNamespace(status_code=status, code=None, message="", output=output)


def test_seedance_omits_none_parameters_and_handles_null_error(tmp_path):
    image = tmp_path / "first.png"
    image.write_bytes(b"image")
    client = SeedanceVideoClient(api_key="test-key")
    submitted = MagicMock(ok=True)
    submitted.json.return_value = {"id": "task-1"}
    with patch("models.video_seedance.requests.post", return_value=submitted) as post:
        assert client._submit_task("scene", str(image), "seedance", 5, seed=None,
                                   watermark=False, generate_audio=None, ratio=None) == "task-1"
    payload = post.call_args.kwargs["json"]
    assert payload["watermark"] is False
    assert "seed" not in payload and "generate_audio" not in payload
    assert payload["ratio"] == "adaptive"

    failed = MagicMock()
    failed.json.return_value = {"status": "failed", "error": None, "status_msg": "额度不足"}
    with patch("models.video_seedance.requests.get", return_value=failed):
        with pytest.raises(RuntimeError, match="额度不足"):
            client._poll_until_done("task-1", max_polls=1)


def test_dashscope_video_poll_retry_never_resubmits(tmp_path):
    image = tmp_path / "first.png"
    image.write_bytes(b"image")
    result = tmp_path / "out.mp4"
    client = DashscopeVideoClient(api_key="test-key", base_url="https://example.test/api/v1")
    synthesis = MagicMock()
    synthesis.async_call.return_value = _response(task_id="task-1", task_status="PENDING")
    synthesis._get.side_effect = [
        requests.Timeout("temporary"),
        _response(task_id="task-1", task_status="RUNNING"),
        _response(task_id="task-1", task_status="SUCCEEDED", video_url="https://example.test/video"),
    ]
    download = MagicMock(status_code=200)
    download.iter_content.return_value = [b"video"]
    with (patch("models.video_dashscope.VideoSynthesis", synthesis),
          patch("models.video_dashscope.requests.get", return_value=download),
          patch("models.video_dashscope.time.sleep")):
        url = client.generate_video("scene", str(image), str(result))

    assert url == "https://example.test/video"
    assert result.read_bytes() == b"video"
    synthesis.async_call.assert_called_once()
    assert synthesis.async_call.call_args.kwargs["base_address"] == "https://example.test/api/v1"
    assert synthesis._get.call_count == 3


def test_dashscope_image_uses_request_base_without_global_mutation():
    import dashscope

    before = dashscope.base_http_api_url
    client = DashScopeClient(api_key="test-key", base_url="https://example.test/api/v1")
    response = SimpleNamespace(status_code=429, code="Throttled", message="slow down")
    with patch("models.image_dashscope.ImageGeneration.call", return_value=response) as call:
        with pytest.raises(RuntimeError, match="Throttled"):
            client.generate_image("scene")
    assert call.call_args.kwargs["base_address"] == "https://example.test/api/v1"
    assert dashscope.base_http_api_url == before


@pytest.mark.parametrize("status", [429, 500])
def test_seedream_retries_download_and_uses_save_dir(tmp_path, status):
    client = SeedreamClient(api_key="test-key")
    generated = SimpleNamespace(data=[SimpleNamespace(url="https://example.test/image")])
    client.client.images.generate = MagicMock(return_value=generated)
    failed = requests.Response()
    failed.status_code = status
    failed.url = "https://example.test/image"
    successful = MagicMock(content=b"image")
    output_dir = tmp_path / "custom"

    with (patch("models.image_seedream.requests.get", side_effect=[failed, successful]) as get,
          patch("models.image_seedream.time.sleep") as sleep):
        paths = client.generate_image("scene", "session-1", save_dir=str(output_dir))

    assert len(paths) == 1 and paths[0].startswith(str(output_dir))
    assert output_dir.joinpath(paths[0].split("/")[-1]).read_bytes() == b"image"
    assert get.call_count == 2 and sleep.call_count == 1


def test_seedream_retries_generation_timeout_and_warns_on_missing_reference(tmp_path, caplog):
    client = SeedreamClient(api_key="test-key")
    client.client.images.generate = MagicMock(side_effect=[
        httpx.ReadTimeout("temporary"),
        SimpleNamespace(data=[SimpleNamespace(url="https://example.test/image")]),
    ])
    client._download_image = MagicMock(return_value=str(tmp_path / "image.png"))
    with patch("models.image_seedream.time.sleep"):
        assert client.generate_image("scene", "session-1") == [str(tmp_path / "image.png")]
    assert client.client.images.generate.call_count == 2

    with pytest.raises(ValueError, match="参考图均不可用"):
        client.generate_image("scene", "session-1", image_paths=[str(tmp_path / "missing.png")])
    assert "参考图不存在" in caplog.text


def test_seedream_stops_after_three_retries():
    client = SeedreamClient(api_key="test-key")
    operation = MagicMock(side_effect=httpx.ReadTimeout("temporary"))
    with patch("models.image_seedream.time.sleep") as sleep:
        with pytest.raises(httpx.ReadTimeout):
            client._with_retry("测试", operation)
    assert operation.call_count == 4
    assert [call.args[0] for call in sleep.call_args_list] == [1, 2, 4]


def test_image_client_propagates_failure_and_rejects_empty_result(tmp_path):
    client = ImageClient()
    client._seedream_client = MagicMock()
    client._seedream_client.generate_image.side_effect = RuntimeError("额度不足")
    with pytest.raises(RuntimeError, match="额度不足"):
        client.generate_image("scene", model="doubao-seedream-5-0-260128", save_dir=str(tmp_path))

    client._seedream_client.generate_image.side_effect = None
    client._seedream_client.generate_image.return_value = []
    with pytest.raises(RuntimeError, match="没有返回结果"):
        client.generate_image("scene", model="doubao-seedream-5-0-260128", save_dir=str(tmp_path))


def test_video_client_rejects_empty_result(tmp_path):
    client = VideoClient()
    client._seedance_client = MagicMock()
    client._seedance_client.generate_video.return_value = ""
    with pytest.raises(RuntimeError, match="没有返回结果"):
        client.generate_video("scene", None, str(tmp_path / "out.mp4"), model="doubao-seedance-2-0-260128")


@pytest.mark.asyncio
@pytest.mark.parametrize("route,payload", [
    (sandbox.sandbox_t2i, SandboxT2IRequest(model="image", prompt="scene")),
    (sandbox.sandbox_i2i, SandboxI2IRequest(model="image", prompt="scene", image="reference.png")),
])
async def test_sandbox_empty_images_are_failures(route, payload):
    generator = MagicMock()
    generator.generate_image.return_value = []
    with (patch("models.image_client.ImageClient", return_value=generator),
          patch.object(sandbox, "_validated_media_reference", return_value="reference.png"),
          patch.object(sandbox, "_add_record") as add_record):
        response = await route(payload)
    assert response["success"] is False
    assert "没有返回结果" in response["error"]
    add_record.assert_not_called()


def test_llm_uses_configured_default_model_without_mutable_images():
    client = LLM()
    client.chat_client = MagicMock()
    client.chat_client.query.return_value = "ok"
    with patch("models.llm_client.Config.LLM_MODEL", "qwen3-max"):
        assert client.query("hello") == "ok"
    assert client.chat_client.query.call_args.kwargs["model"] == "qwen3-max"
    assert client.chat_client.query.call_args.kwargs["image_urls"] is None
