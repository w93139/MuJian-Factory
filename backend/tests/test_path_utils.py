from pathlib import Path

from config import BASE_DIR
from core.agents.base_agent import AgentInterface
from core.orchestrator import WorkflowEngine
from path_utils import absolute_path, media_reference_path, stored_artifact_paths, stored_path


def test_runtime_paths_ignore_process_cwd(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    assert absolute_path("code/result/example.png") == str(BASE_DIR / "code/result/example.png")
    assert stored_path(BASE_DIR / "code/result/example.png") == "code/result/example.png"
    assert AgentInterface._get_style_prompt(None, "realistic") != "realistic style"


def test_stored_path_keeps_external_absolute_path():
    external = Path("/tmp/external-example.png")
    assert stored_path(external) == str(external)


def test_media_reference_keeps_remote_urls():
    assert media_reference_path("https://example.com/image.png") == "https://example.com/image.png"
    assert media_reference_path("code/result/image.png") == str(BASE_DIR / "code/result/image.png")


def test_nested_artifact_paths_are_relative():
    artifact = {"clips": [{"selected": str(BASE_DIR / "code/result/clip.mp4")}], "title": "demo"}
    assert stored_artifact_paths(artifact) == {
        "clips": [{"selected": "code/result/clip.mp4"}],
        "title": "demo",
    }


def test_asset_count_path_from_session_is_resolved_once(monkeypatch, tmp_path):
    import path_utils

    artifact = tmp_path / "code/result/image/example.png"
    artifact.parent.mkdir(parents=True)
    artifact.write_bytes(b"image")
    monkeypatch.setattr(path_utils, "BASE_DIR", tmp_path)
    monkeypatch.chdir(tmp_path.parent)
    assert WorkflowEngine._asset_exists(str(tmp_path / "code"), "code/result/image/example.png")
