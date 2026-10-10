"""Local HTTP contracts with isolated files and provider replacements; no paid calls."""
from unittest.mock import MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.routers import sandbox
from models.config_model import get_model_config, model_type_capabilities
from models.image_client import ImageClient


@pytest.fixture
def client(monkeypatch, tmp_path):
    monkeypatch.setattr(sandbox, "SANDBOX_DIR", str(tmp_path))
    monkeypatch.setattr(sandbox, "SANDBOX_HISTORY_FILE", str(tmp_path / "history.json"))
    monkeypatch.setattr(sandbox, "SANDBOX_ACTIVE_TASKS", {})
    monkeypatch.setattr(sandbox, "_validated_media_reference", lambda _: str(tmp_path / "reference.png"))
    monkeypatch.setattr(sandbox, "_converted_result_list", lambda values: values)
    monkeypatch.setattr(sandbox, "_converted_video_path", lambda value: value)
    app = FastAPI()
    app.include_router(sandbox.router)
    return TestClient(app)


@pytest.fixture
def image_provider(monkeypatch, tmp_path):
    import models.image_client
    fake = MagicMock()
    fake.generate_image.return_value = [str(tmp_path / "output.png")]
    monkeypatch.setattr(models.image_client, "ImageClient", lambda: fake)
    return fake


@pytest.fixture
def video_provider(monkeypatch):
    import models.video_client
    fake = MagicMock()
    fake.generate_video.return_value = "https://example.test/video"
    monkeypatch.setattr(models.video_client, "VideoClient", lambda: fake)
    return fake


@pytest.mark.parametrize("tool", ["t2i", "i2i"])
def test_image_parameters_reach_provider_and_persist(client, image_provider, tool):
    response = client.post(f"/api/sandbox/{tool}", json={
        "model": "wan2.7-image", "prompt": "scene", "ratio": "9:16", "resolution": "2K",
        **({"image": "reference.png"} if tool == "i2i" else {}),
    })
    assert response.status_code == 200
    body = response.json()
    assert body["success"]
    assert body["parameters"] == {"ratio": "9:16", "resolution": "2K"}
    assert image_provider.generate_image.call_args.kwargs["video_ratio"] == "9:16"
    assert image_provider.generate_image.call_args.kwargs["resolution"] == "2K"
    saved = sandbox._load_history()[0]["input"]
    assert saved["ratio"] == "9:16" and saved["resolution"] == "2K"


def test_video_parameters_reach_provider_and_persist(client, video_provider):
    response = client.post("/api/sandbox/video", json={
        "model": "doubao-seedance-2-0-fast-260128", "prompt": "scene", "image": "reference.png",
        "ratio": "9:16", "resolution": "720P", "duration": 8,
    })
    assert response.status_code == 200
    params = response.json()["parameters"]
    assert params == {"ratio": "9:16", "resolution": "720p", "duration": 8}
    kwargs = video_provider.generate_video.call_args.kwargs
    assert (kwargs["duration"], kwargs["resolution"], kwargs["video_ratio"]) == (8, "720p", "9:16")
    assert all(sandbox._load_history()[0]["input"][key] == value for key, value in params.items())


@pytest.mark.parametrize("changes", [{"duration": 60}, {"resolution": "1080P"}, {"ratio": "2:1"}])
def test_unsupported_video_parameters_fail_before_provider(client, video_provider, changes):
    response = client.post("/api/sandbox/video", json={
        "model": "doubao-seedance-2-0-fast-260128", "prompt": "scene", "image": "reference.png", **changes,
    })
    assert response.status_code == 422
    video_provider.generate_video.assert_not_called()
    assert sandbox._load_history() == []


@pytest.mark.parametrize("tool,payload", [
    ("llm", {"model": "deepseek-v3.2", "temperature": 0.9}),
    ("t2i", {"model": "wan2.7-image", "style": "anime"}),
    ("video", {"model": "wan2.7-i2v", "unknown_parameter": 1}),
])
def test_unsupported_or_unknown_fields_are_not_silently_discarded(client, payload, tool):
    response = client.post(f"/api/sandbox/{tool}", json={"prompt": "scene", **payload})
    assert response.status_code == 422


@pytest.mark.parametrize("model,tool,resolution", [
    ("wan2.7-image-pro", "i2i", "4K"),
    ("wan2.7-image", "t2i", "1K"),
    ("doubao-seedream-5-0-260128", "t2i", "3K"),
])
def test_unadapted_image_resolution_rejected(client, image_provider, model, tool, resolution):
    response = client.post(f"/api/sandbox/{tool}", json={
        "model": model, "prompt": "scene", "resolution": resolution,
        **({"image": "reference.png"} if tool == "i2i" else {}),
    })
    assert response.status_code == 422
    image_provider.generate_image.assert_not_called()


def test_registry_preserves_declared_options_and_discloses_adapter_subset():
    caps = model_type_capabilities("i2i", get_model_config("wan2.7-image-pro"))
    assert caps["resolutions"] == ["1K", "2K", "4K"]
    assert caps["adapter_resolutions"] == ["2K"]


@pytest.mark.parametrize("ratio,size", [("9:16", "1440*2560"), ("4:3", "2560*1920")])
def test_image_provider_receives_actual_dimensions(tmp_path, ratio, size):
    client = ImageClient()
    client._dashscope_client = MagicMock()
    client._dashscope_client.generate_image.return_value = [str(tmp_path / "out.png")]
    client.generate_image("scene", model="wan2.7-image", video_ratio=ratio, resolution="2K", save_dir=str(tmp_path))
    assert client._dashscope_client.generate_image.call_args.kwargs["size"] == size


def test_image_adapter_rejects_unimplemented_tier_before_provider(tmp_path):
    client = ImageClient()
    client._dashscope_client = MagicMock()
    with pytest.raises(ValueError, match="未支持"):
        client.generate_image("scene", model="wan2.7-image", resolution="1K", save_dir=str(tmp_path))
    client._dashscope_client.generate_image.assert_not_called()


def test_provider_failure_is_reported_without_success_record(client, image_provider):
    image_provider.generate_image.side_effect = RuntimeError("provider unavailable")
    response = client.post("/api/sandbox/t2i", json={"model": "wan2.7-image", "prompt": "scene"})
    assert not response.json()["success"]
    assert "provider unavailable" in response.json()["error"]
    assert sandbox._load_history() == []


@pytest.mark.parametrize("model,image", [
    ("happyhorse-1.0-video-edit", "reference.png"),
    ("wan2.7-r2v", "reference.png"),
    ("wan2.7-i2v", None),
])
def test_sandbox_rejects_video_abilities_it_cannot_express(client, video_provider, model, image):
    response = client.post("/api/sandbox/video", json={"model": model, "prompt": "scene", "image": image})
    assert response.status_code == 422
    video_provider.generate_video.assert_not_called()
    assert sandbox._load_history() == []


def test_sandbox_rejects_unverified_video_adapter(client, video_provider, monkeypatch):
    import models.config_model
    metadata = {"type": ["video"], "capabilities": {"api_contract_verified": False, "adapter_ability_types": ["first_frame_i2v"]}}
    monkeypatch.setattr(models.config_model, "ensure_model_available", lambda _: metadata)
    response = client.post("/api/sandbox/video", json={"model": "unverified", "prompt": "scene", "image": "reference.png"})
    assert response.status_code == 422
    video_provider.generate_video.assert_not_called()
