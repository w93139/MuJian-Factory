"""Keep direct video calls and their budget reservations on identical parameters."""

from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from models.video_dashscope import DashscopeVideoClient
from usage import today_usage


@pytest.mark.parametrize(
    ("model", "duration", "expected_cost"),
    [("wan3.0-video", 2, "1.2"), ("happyhorse-1.1-i2v", 3, "2.7")],
)
def test_direct_video_default_resolution_matches_reserved_cost(tmp_path, model, duration, expected_cost):
    image = tmp_path / "first.png"
    image.write_bytes(b"mock image")
    sdk = MagicMock()
    sdk.async_call.return_value = SimpleNamespace(status_code=400, code="Rejected", message="mock rejection")
    with patch("models.video_dashscope.VideoSynthesis", sdk), pytest.raises(RuntimeError, match="Rejected"):
        DashscopeVideoClient(api_key="test").generate_video(
            "scene", str(image), str(tmp_path / "out.mp4"), model=model, duration=1, resolution=None,
        )
    payload = sdk.async_call.call_args.kwargs
    assert payload["resolution"] == "720P"
    assert payload["duration"] == duration
    assert payload["ratio"] == "16:9"
    sdk.async_call.assert_called_once()
    entry = today_usage()["entries"][0]
    assert entry["quantity"] == duration
    assert entry["resolution"] == payload["resolution"]
    assert Decimal(entry["estimated_cny"]) == Decimal(expected_cost)


def test_wan3_explicit_audio_off_reaches_provider(tmp_path):
    image = tmp_path / "first.png"
    image.write_bytes(b"mock image")
    sdk = MagicMock()
    sdk.async_call.return_value = SimpleNamespace(status_code=400, code="Rejected", message="mock rejection")
    with patch("models.video_dashscope.VideoSynthesis", sdk), pytest.raises(RuntimeError, match="Rejected"):
        DashscopeVideoClient(api_key="test").generate_video(
            "scene", str(image), str(tmp_path / "out.mp4"), model="wan3.0-video", duration=2,
            resolution="480P", audio=False,
        )
    assert sdk.async_call.call_args.kwargs["audio"] is False
    assert Decimal(today_usage()["total_cny"]) == Decimal("0.6")


@pytest.mark.parametrize("audio", [False, True])
def test_happyhorse_audio_switch_rejected_before_submission_and_reservation(tmp_path, audio):
    image = tmp_path / "first.png"
    image.write_bytes(b"mock image")
    sdk = MagicMock()
    with patch("models.video_dashscope.VideoSynthesis", sdk), pytest.raises(ValueError, match="audio"):
        DashscopeVideoClient(api_key="test").generate_video(
            "scene", str(image), str(tmp_path / "out.mp4"), model="happyhorse-1.1-i2v", audio=audio,
        )
    sdk.async_call.assert_not_called()
    assert today_usage()["entries"] == []
