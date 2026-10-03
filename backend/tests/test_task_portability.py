from pathlib import Path

from config import settings
from pipelines.storage import _rebase_artifact_paths


def test_imported_task_paths_use_current_code_volume():
    old = "/Users/author/project/backend/code/result/task/demo/final.mp4"
    metadata = {"output_dir": old, "artifacts": [{"path": old}], "url": "https://example.com/code/result/demo.mp4"}

    rebased = _rebase_artifact_paths(metadata)

    expected = str(Path(settings.CODE_DIR) / "result/task/demo/final.mp4")
    assert rebased["output_dir"] == expected
    assert rebased["artifacts"][0]["path"] == expected
    assert rebased["url"] == metadata["url"]
