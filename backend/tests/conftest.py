import pytest

import usage
from config import Config


@pytest.fixture(autouse=True)
def isolate_usage_records(monkeypatch, tmp_path):
    """Mock provider calls must never add estimates to the owner's usage ledger."""
    monkeypatch.setattr(usage, "USAGE_DIR", tmp_path / "usage")
    for name in ("MUJIAN_TASK_BUDGET_CNY", "MUJIAN_TASK_USAGE_PATH", "MUJIAN_DAILY_BUDGET_CNY"):
        monkeypatch.delenv(name, raising=False)
    config = {**Config.CONFIG, "api_providers": {**Config.CONFIG["api_providers"], "common": {
        **Config.CONFIG["api_providers"]["common"], "unavailable_models": []}}}
    monkeypatch.setattr(Config, "CONFIG", config)
