"""Map public result files to explicitly showcased content."""

from pathlib import Path

from api.showcase import is_showcase_session
from config import settings
from pipelines.storage import load_task


def guest_can_read_result(path: str) -> bool:
    prefix = "/code/result/"
    if not path.startswith(prefix):
        return False
    result_root = Path(settings.RESULT_DIR).resolve()
    target = (result_root / path[len(prefix):]).resolve()
    try:
        relative = target.relative_to(result_root)
    except ValueError:
        return False
    parts = relative.parts
    if len(parts) == 2 and parts[0] == "script" and parts[1].endswith(".json"):
        return is_showcase_session(parts[1][:-5])
    if len(parts) >= 3 and parts[0] in {"image", "video"}:
        return is_showcase_session(parts[1])
    if len(parts) >= 3 and parts[0] == "task":
        task = load_task(parts[1])
        return task is not None and task.get("showcase") is True

    # Sandbox files can live in several result directories. A showcased record
    # grants access only to its own generated files, never its input references.
    from api.routers.sandbox import _load_history

    for record in _load_history():
        if record.get("showcase") is not True:
            continue
        for filename in record.get("files") or []:
            candidate = Path(filename)
            if not candidate.is_absolute():
                candidate = Path(settings.CODE_DIR) / candidate
            if candidate.resolve() == target:
                return True
    return False
