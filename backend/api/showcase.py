"""Showcase flags stored in existing session JSON files."""

import json
import os
import re
import tempfile
from pathlib import Path

from api.dependencies import workflow_engine

SAFE_SESSION_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def _session_path(session_id: str) -> Path | None:
    if not SAFE_SESSION_ID.fullmatch(session_id):
        return None
    return Path(workflow_engine._session_dir) / f"{session_id}.json"


def is_showcase_session(session_id: str) -> bool:
    path = _session_path(session_id)
    if path is None:
        return False
    with workflow_engine._state_lock:
        try:
            with path.open(encoding="utf-8") as handle:
                return json.load(handle).get("showcase") is True
        except (FileNotFoundError, json.JSONDecodeError, OSError, AttributeError):
            return False


def set_showcase_session(session_id: str, showcase: bool) -> bool:
    """Update only the showcase field without replacing generated session data."""
    path = _session_path(session_id)
    if path is None:
        return False
    with workflow_engine._state_lock:
        if workflow_engine.get_state(session_id) is None:
            return False
        if not path.exists():
            workflow_engine.save_session_to_disk(session_id)
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        data["showcase"] = showcase
        fd, temp_path = tempfile.mkstemp(dir=path.parent, prefix="session.", suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as handle:
                json.dump(data, handle, ensure_ascii=False, indent=2)
            os.replace(temp_path, path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    return True
