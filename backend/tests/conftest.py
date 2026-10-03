import pytest

import usage


@pytest.fixture(autouse=True)
def isolate_usage_records(monkeypatch, tmp_path):
    """Mock provider calls must never add estimates to the owner's usage ledger."""
    monkeypatch.setattr(usage, "USAGE_DIR", tmp_path / "usage")
