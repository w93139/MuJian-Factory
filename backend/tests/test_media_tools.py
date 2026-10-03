from pathlib import Path
from unittest.mock import patch

import pytest

import media_tools
from pipelines import utils


def test_explicit_override_takes_priority(monkeypatch, tmp_path):
    executable = tmp_path / "custom-ffmpeg"
    executable.write_text("", encoding="utf-8")
    executable.chmod(0o755)
    monkeypatch.setenv("MUJIAN_FFMPEG", str(executable))

    assert media_tools.find_media_tool("ffmpeg") == str(executable)


def test_path_takes_priority_over_bundled(monkeypatch, tmp_path):
    bundled = tmp_path / ".tools" / "bin" / "ffprobe"
    bundled.parent.mkdir(parents=True)
    bundled.write_text("", encoding="utf-8")
    bundled.chmod(0o755)
    monkeypatch.setattr(media_tools, "BASE_DIR", tmp_path)
    monkeypatch.setattr(media_tools.shutil, "which", lambda name: "/usr/bin/ffprobe")

    assert media_tools.find_media_tool("ffprobe") == "/usr/bin/ffprobe"


def test_bundled_fallback_and_missing_error(monkeypatch, tmp_path):
    monkeypatch.setattr(media_tools, "BASE_DIR", tmp_path)
    monkeypatch.setattr(media_tools.shutil, "which", lambda name: None)
    executable = tmp_path / ".tools" / "bin" / "ffmpeg"
    executable.parent.mkdir(parents=True)
    executable.write_text("", encoding="utf-8")
    executable.chmod(0o755)

    assert media_tools.find_media_tool("ffmpeg") == str(executable)
    with pytest.raises(RuntimeError, match="MUJIAN_FFPROBE") as exc_info:
        media_tools.find_media_tool("ffprobe")
    assert "backend/.tools/bin/" in str(exc_info.value)


def test_concat_videos_uses_resolved_executable(tmp_path):
    video = tmp_path / "clip.mp4"
    video.write_bytes(b"video")
    output = tmp_path / "output.mp4"

    with patch.object(utils, "find_media_tool", return_value="/custom/ffmpeg") as finder:
        with patch.object(utils.subprocess, "run") as run:
            assert utils.concat_videos([str(video)], str(output)) == str(output)

    finder.assert_called_once_with("ffmpeg")
    assert run.call_args.args[0][0] == "/custom/ffmpeg"


def test_media_duration_uses_resolved_ffprobe(tmp_path):
    media = Path(tmp_path) / "clip.mp4"
    media.write_bytes(b"video")

    with patch.object(utils, "find_media_tool", return_value="/custom/ffprobe") as finder:
        with patch.object(utils.subprocess, "run") as run:
            run.return_value.stdout = "3.5\n"
            assert utils.media_duration_seconds(str(media)) == 3.5

    finder.assert_called_once_with("ffprobe")
    assert run.call_args.args[0][0] == "/custom/ffprobe"
