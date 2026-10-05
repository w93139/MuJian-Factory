from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests

from config import Config
from models.config_model import get_model_config, get_models_by_type, list_api_models
from models.image_client import ImageClient
from models.image_seedream import SeedreamClient
from models.video_dashscope import DashscopeVideoClient
from models.video_params import validate_video_inputs
from quick_demo import quick_demo_video_model
from usage import today_usage


def response(**output):
    return SimpleNamespace(status_code=200, code=None, message="", output=output)


@pytest.mark.parametrize("model", ["wan3.0-video", "happyhorse-1.1-i2v"])
def test_new_video_uses_media_and_resolution_price(tmp_path, model):
    image = tmp_path / "first.png"
    image.write_bytes(b"image")
    sdk = MagicMock()
    sdk.async_call.return_value = response(task_id="one")
    sdk._get.return_value = response(task_status="SUCCEEDED", video_url="https://example.test/v")
    download = MagicMock(status_code=200)
    download.iter_content.return_value = [b"video"]
    with (patch("models.video_dashscope.VideoSynthesis", sdk),
          patch("models.video_dashscope.requests.get", return_value=download)):
        DashscopeVideoClient(api_key="test").generate_video(
            "scene", str(image), str(tmp_path / "out.mp4"), model=model, duration=10, resolution="720P",
        )
    payload = sdk.async_call.call_args.kwargs
    assert payload["media"][0]["type"] == "first_frame"
    assert "img_url" not in payload and "shot_type" not in payload
    sdk.async_call.assert_called_once()
    expected = "6" if model.startswith("wan") else "9"
    assert Decimal(today_usage()["total_cny"]) == Decimal(expected)


def test_video_submission_timeout_does_not_create_another_task(tmp_path):
    image = tmp_path / "first.png"
    image.write_bytes(b"image")
    sdk = MagicMock()
    sdk.async_call.side_effect = requests.Timeout("ambiguous")
    with patch("models.video_dashscope.VideoSynthesis", sdk), pytest.raises(requests.Timeout):
        DashscopeVideoClient(api_key="test").generate_video(
            "scene", str(image), str(tmp_path / "out.mp4"), model="wan3.0-video", duration=2,
        )
    sdk.async_call.assert_called_once()
    assert len(today_usage()["entries"]) == 1


@pytest.mark.parametrize("field", ["last_image_path", "first_clip_path", "audio_path", "reference_video_paths"])
def test_unimplemented_video_inputs_rejected_before_billing(field):
    with pytest.raises(ValueError, match="未适配"):
        validate_video_inputs("wan3.0-video", image_path="first.png", **{field: "unsupported"})
    assert today_usage()["entries"] == []


def test_filter_requires_all_adapter_abilities():
    assert not list_api_models("video", ["first_frame_i2v", "action_transfer"])
    assert "wan2.6-i2v-flash" not in {m["model"] for m in list_api_models("video", ["audio_driven_i2v"])}
    assert "wan3.0-video" not in {m["model"] for m in list_api_models("video", ["start_end_frame_i2v"])}


def test_account_unavailable_models_are_readable_but_not_selectable(monkeypatch):
    config = {**Config.CONFIG, "api_providers": {**Config.CONFIG["api_providers"], "common": {
        **Config.CONFIG["api_providers"]["common"], "unavailable_models": ["wan2.6-i2v-flash", "doubao-seedance-2-0-fast-260128"]}}}
    monkeypatch.setattr(Config, "CONFIG", config)
    assert get_model_config("wan2.6-i2v-flash")["available"] is False
    assert "wan2.6-i2v-flash" not in {m["id"] for m in get_models_by_type("video")}
    with pytest.raises(ValueError, match="没有可用"):
        quick_demo_video_model()
    with pytest.raises(ValueError, match="尚未开通"):
        validate_video_inputs("wan2.6-i2v-flash", image_path="first.png")


@pytest.mark.parametrize("model", ["doubao-seedream-5-0-pro-260628", "doubao-seedream-5-0-flash-260915"])
def test_new_seedream_omits_unsupported_parameter_and_preserves_small_size(tmp_path, model):
    client = SeedreamClient(api_key="test")
    client.client.images.generate = MagicMock(return_value=SimpleNamespace(data=[SimpleNamespace(url="https://example.test/i")]))
    client._download_image = MagicMock(return_value=str(tmp_path / "out.png"))
    client.generate_image("scene", "test", model=model, size="1280*720")
    payload = client.client.images.generate.call_args.kwargs
    assert "sequential_image_generation" not in payload["extra_body"]
    assert payload["size"] == "1280x720"
    with pytest.raises(ValueError, match="像素"):
        client.generate_image("scene", "test", model=model, size="3840*2160")
    assert client.client.images.generate.call_count == 1


@pytest.mark.parametrize("ratio", ["16:9", "9:16", "1:1", "4:3", "3:4"])
def test_new_seedream_2k_stays_within_pixel_limit(ratio, tmp_path):
    client = ImageClient()
    client._seedream_client = MagicMock()
    client._seedream_client.generate_image.return_value = [str(tmp_path / "out.png")]
    client.generate_image("scene", model="doubao-seedream-5-0-pro-260628", video_ratio=ratio, resolution="2K")
    size = client._seedream_client.generate_image.call_args.kwargs["size"]
    width, height = map(int, size.split("*"))
    assert 921600 <= width * height <= 4624220


def test_existing_wan_continuation_and_audio_adapter_remain_supported():
    validate_video_inputs("wan2.7-i2v", first_clip_path="existing.mp4")
    validate_video_inputs("wan2.7-i2v", image_path="first.png", audio_path="voice.wav")
