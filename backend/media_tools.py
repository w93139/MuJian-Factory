"""Locate the media executables used by the backend."""

import os
import shutil
from pathlib import Path
from typing import Literal

from config import BASE_DIR


def find_media_tool(name: Literal["ffmpeg", "ffprobe"]) -> str:
    """Resolve an override, a PATH executable, or the bundled binary, in that order."""
    if name not in ("ffmpeg", "ffprobe"):
        raise ValueError(f"Unsupported media tool: {name}")

    variable = f"MUJIAN_{name.upper()}"
    override = os.environ.get(variable)
    if override:
        executable = shutil.which(override)
        if executable:
            return executable

    executable = shutil.which(name)
    if executable:
        return executable

    bundled = Path(BASE_DIR) / ".tools" / "bin" / name
    if bundled.is_file() and os.access(bundled, os.X_OK):
        return str(bundled)

    raise RuntimeError(
        f"找不到 {name}。请安装 FFmpeg 并加入 PATH，或设置 {variable} 为可执行文件路径，"
        f"或将 {name} 放到 backend/.tools/bin/。"
    )
