import json
import subprocess

import pytest

from core.agents.editor_agent import VideoEditorAgent
from media_tools import find_media_tool


def test_mixed_clips_are_normalized_for_concat(tmp_path):
    try:
        ffmpeg = find_media_tool("ffmpeg")
        ffprobe = find_media_tool("ffprobe")
    except FileNotFoundError:
        pytest.skip("ffmpeg tools unavailable")

    sources = [tmp_path / "silent.mp4", tmp_path / "audio.mp4"]
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=red:s=80x48:r=15:d=1",
         "-an", "-c:v", "libx264", str(sources[0])],
        capture_output=True, text=True, check=True,
    )
    subprocess.run(
        [ffmpeg, "-y", "-f", "lavfi", "-i", "color=c=blue:s=48x80:r=30:d=1",
         "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
         "-c:v", "libx264", "-c:a", "aac", "-shortest", str(sources[1])],
        capture_output=True, text=True, check=True,
    )

    normalized = [tmp_path / f"normalized-{index}.mp4" for index in range(2)]
    for source, target in zip(sources, normalized):
        VideoEditorAgent._normalize_clip(str(source), str(target), (128, 72), ffmpeg, ffprobe)
        probe = subprocess.run(
            [ffprobe, "-v", "error", "-show_entries", "stream=codec_type,width,height,r_frame_rate",
             "-of", "json", str(target)],
            capture_output=True, text=True, check=True,
        )
        streams = json.loads(probe.stdout)["streams"]
        assert {stream["codec_type"] for stream in streams} == {"video", "audio"}
        video = next(stream for stream in streams if stream["codec_type"] == "video")
        assert (video["width"], video["height"], video["r_frame_rate"]) == (128, 72, "24/1")

    concat_list = tmp_path / "clips.txt"
    concat_list.write_text("".join(f"file '{path}'\n" for path in normalized))
    output = tmp_path / "joined.mp4"
    subprocess.run(
        [ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list),
         "-c", "copy", str(output)],
        capture_output=True, text=True, check=True,
    )
    assert output.stat().st_size > 0
