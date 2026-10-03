"""Video capability limits are enforced before provider calls."""

from unittest.mock import MagicMock, patch

import pytest

from api.routers import sandbox
from api.schemas.sandbox import SandboxVideoRequest
from core.agents.video_agent import VideoDirectorAgent
from models.video_client import VideoClient
from models.video_params import VideoParameters, normalize_video_params
from pipelines.api_media import generate_video_api


@pytest.mark.parametrize(
    ("model", "requested", "expected"),
    [
        ("wan2.7-r2v", 15, 10),
        ("wan2.7-r2v", 1, 2),
        ("wan2.7-i2v", 16, 15),
        ("wan2.7-i2v", 1, 2),
        ("doubao-seedance-2-0-260128", 3, 4),
        ("doubao-seedance-2-0-260128", 15, 15),
        ("doubao-seedance-2-0-fast-260128", 16, 15),
    ],
)
def test_registered_duration_limits(model, requested, expected):
    assert normalize_video_params(model, requested).duration == expected


def test_unsupported_resolution_and_ratio_warn_and_use_first_choice(caplog):
    result = normalize_video_params(
        "doubao-seedance-2-0-fast-260128", 6, "1080p", "2:1"
    )
    assert result == VideoParameters(duration=6, resolution="480p", ratio="16:9")
    assert "resolution=1080p" in caplog.text
    assert "ratio=2:1" in caplog.text
    assert normalize_video_params("doubao-seedance-2-0-fast-260128", 6, "720P").resolution == "720p"


def test_discrete_durations_use_nearest_value_and_lower_tie(monkeypatch):
    import models.video_params as video_params

    monkeypatch.setattr(
        video_params,
        "get_model_config",
        lambda _: {"type": ["video"], "capabilities": {"duration": {"values": [5, 10]}}},
    )
    assert video_params.normalize_video_params("discrete", 7).duration == 5
    assert video_params.normalize_video_params("discrete", 8).duration == 10


def test_pipeline_passes_normalized_values_without_provider_call():
    generator = MagicMock()
    with patch("pipelines.api_media.VideoClient", return_value=generator):
        result = generate_video_api(
            prompt="scene",
            model="api/dashscope/wan2.7-r2v",
            output_path="result.mp4",
            duration=15,
            video_ratio="2:1",
            video_resolution="4K",
            resolution="1080P",
        )
    assert result == "result.mp4"
    kwargs = generator.generate_video.call_args.kwargs
    assert (kwargs["duration"], kwargs["resolution"], kwargs["video_ratio"]) == (10, "720P", "16:9")


def test_video_client_final_guard_normalizes_seedance_fast(tmp_path):
    client = VideoClient()
    client._seedance_client = MagicMock()
    client._seedance_client.generate_video.return_value = "https://example.test/video"
    client.generate_video(
        "scene", None, str(tmp_path / "video.mp4"),
        model="doubao-seedance-2-0-fast-260128",
        duration=20, resolution="1080P", video_ratio="2:1",
    )
    kwargs = client._seedance_client.generate_video.call_args.kwargs
    assert (kwargs["duration"], kwargs["resolution"], kwargs["ratio"]) == (15, "480p", "16:9")


def test_video_agent_normalizes_storyboard_clip(tmp_path):
    image = tmp_path / "first.png"
    image.write_bytes(b"image")
    agent = VideoDirectorAgent()
    agent._next_version_path = MagicMock(return_value=str(tmp_path / "clip.mp4"))
    generator = MagicMock()
    with patch("models.video_client.VideoClient", return_value=generator):
        segment, output = agent._generate_one(
            "session", "clip-1", "scene", str(image), "wan2.7-r2v",
            duration=15, video_ratio="2:1", video_resolution="4K",
        )
    assert (segment, output) == ("clip-1", str(tmp_path / "clip.mp4"))
    kwargs = generator.generate_video.call_args.kwargs
    assert (kwargs["duration"], kwargs["resolution"], kwargs["video_ratio"]) == (10, "720P", "16:9")


@pytest.mark.asyncio
async def test_sandbox_passes_normalized_video_parameters():
    generator = MagicMock()
    generator.generate_video.return_value = "https://example.test/video"
    with (
        patch("models.video_client.VideoClient", return_value=generator),
        patch.object(sandbox, "_start_active_task", return_value="task-1"),
        patch.object(sandbox, "_finish_active_task"),
        patch.object(sandbox, "_add_record", return_value="task-1"),
        patch.object(sandbox, "_converted_video_path", return_value="video.mp4"),
    ):
        result = await sandbox.sandbox_video(
            SandboxVideoRequest(model="wan2.7-r2v", prompt="scene")
        )
    assert result["success"] is True
    assert generator.generate_video.call_args.kwargs["duration"] == 5
    assert generator.generate_video.call_args.kwargs["resolution"] == "720P"
