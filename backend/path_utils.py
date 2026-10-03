"""Resolve runtime files against the backend directory, regardless of process cwd."""

from pathlib import Path

from config import BASE_DIR


def absolute_path(path: str | Path) -> str:
    """Return an absolute local path for a backend-relative artifact path."""
    value = Path(path)
    return str(value if value.is_absolute() else BASE_DIR / value)


def media_reference_path(value: str | None) -> str | None:
    """Resolve local media while leaving remote and data URLs unchanged."""
    if not value or value.startswith(("http://", "https://", "file://", "oss://", "data:")):
        return value
    return absolute_path(value)


def stored_path(path: str | Path) -> str:
    """Keep paths under backend relative for session JSON and /code URLs."""
    value = Path(path)
    if value.is_absolute():
        try:
            return value.relative_to(BASE_DIR).as_posix()
        except ValueError:
            return str(value)
    return value.as_posix()


def stored_artifact_paths(value):
    """Convert generated backend paths in nested artifacts to stable relative paths."""
    if isinstance(value, dict):
        return {key: stored_artifact_paths(item) for key, item in value.items()}
    if isinstance(value, list):
        return [stored_artifact_paths(item) for item in value]
    if isinstance(value, str) and Path(value).is_absolute():
        try:
            return Path(value).relative_to(BASE_DIR).as_posix()
        except ValueError:
            pass
    return value
