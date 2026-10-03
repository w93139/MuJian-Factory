"""Public showcase authorization without model or network calls."""

import json
import threading
import time
from datetime import datetime
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api import auth, showcase
from api.app import app
from api.routers import admin, configuration, sessions


@pytest.fixture
def public_client(monkeypatch, tmp_path):
    monkeypatch.setenv("MUJIAN_PUBLIC_MODE", "1")
    monkeypatch.setenv("MUJIAN_ADMIN_PASSWORD", "admin-test-password")
    monkeypatch.setenv("MUJIAN_SESSION_SECRET", "test-signing-secret")
    monkeypatch.setattr(auth, "invite_path", lambda: tmp_path / "invites.json")
    auth._login_failures.clear()
    with TestClient(app) as client:
        yield client
    auth._login_failures.clear()


def test_public_mode_requires_admin_password_and_cookie_secret(monkeypatch):
    monkeypatch.setenv("MUJIAN_PUBLIC_MODE", "1")
    monkeypatch.delenv("MUJIAN_ADMIN_PASSWORD", raising=False)
    monkeypatch.delenv("MUJIAN_SESSION_SECRET", raising=False)
    with pytest.raises(RuntimeError, match="MUJIAN_ADMIN_PASSWORD.*MUJIAN_SESSION_SECRET"):
        with TestClient(app):
            pass


def test_local_mode_keeps_existing_routes_open(monkeypatch):
    monkeypatch.delenv("MUJIAN_PUBLIC_MODE", raising=False)
    with TestClient(app) as client:
        assert client.get("/api/auth/me").json() == {"role": "admin", "public_mode": False}
        assert client.get("/api/sessions").status_code == 200


def test_public_static_files_reject_traversal_and_data_for_every_role(public_client, tmp_path, monkeypatch):
    data_dir = tmp_path / "data"
    result_dir = tmp_path / "result"
    data_dir.mkdir()
    result_dir.mkdir()
    (data_dir / "invites.json").write_text('{"secret":"private"}', encoding="utf-8")
    (result_dir / "showcase.mp4").write_bytes(b"media")
    static_mount = next(route for route in app.routes if getattr(route, "path", None) == "/code")
    monkeypatch.setattr(static_mount.app, "directory", str(tmp_path))
    monkeypatch.setattr(static_mount.app, "all_directories", [str(tmp_path)])

    paths = [
        "/code/data/invites.json",
        "/code/result/../data/invites.json",
        "/code/result/%2e%2e/data/invites.json",
        "/code/result/%2E%2e/data/invites.json",
        "/code/result/..%2fdata/invites.json",
    ]
    for path in paths:
        assert public_client.get(path).status_code in {401, 404}

    assert public_client.post("/api/auth/login", json={"password": "admin-test-password"}).status_code == 200
    for path in paths:
        assert public_client.get(path).status_code == 404
    assert public_client.get("/code/result/showcase.mp4").content == b"media"

    public_client.post("/api/auth/logout")
    invite = auth.create_invite()
    assert public_client.post("/api/auth/login", json={"invite_code": invite["code"]}).status_code == 200
    for path in paths:
        assert public_client.get(path).status_code == 404
    assert public_client.get("/code/result/showcase.mp4").content == b"media"


def test_roles_invites_revocation_and_static_secret_protection(public_client):
    client = public_client
    assert client.get("/api/health").status_code == 200
    assert client.get("/api/auth/me").json() == {"role": "anonymous", "public_mode": True}
    assert client.get("/api/sessions").status_code == 401
    assert client.get("/code/data/invites.json").status_code == 404

    login = client.post("/api/auth/login", json={"password": "admin-test-password"})
    assert login.status_code == 200
    assert login.json()["role"] == "admin"
    cookie = login.headers["set-cookie"].lower()
    assert "httponly" in cookie and "samesite=lax" in cookie
    assert client.get("/api/auth/me").json()["role"] == "admin"
    signed = client.cookies.get(auth.COOKIE_NAME)
    assert signed and auth._decode(signed + "tampered") is None

    created = client.post("/api/admin/invites", json={"note": "interview"})
    assert created.status_code == 200
    invite = created.json()["invite"]
    assert len(invite["code"]) == 8
    assert invite["note"] == "interview"
    assert datetime.fromisoformat(invite["expires_at"]).timestamp() > time.time()
    assert client.get("/api/admin/invites").json()["invites"][0]["last_used_at"] is None

    client.post("/api/auth/logout")
    guest_login = client.post("/api/auth/login", json={"invite_code": invite["code"]})
    assert guest_login.status_code == 200
    assert guest_login.json()["role"] == "guest"
    assert client.get("/api/stages").status_code == 200
    assert client.post("/api/project/start", json={"idea": "scene"}).status_code == 403
    assert client.get("/api/admin/invites").status_code == 403
    assert client.get("/code/data/invites.json").status_code == 404

    admin_client = TestClient(app)
    admin_client.post("/api/auth/login", json={"password": "admin-test-password"})
    assert admin_client.delete(f"/api/admin/invites/{invite['code']}").status_code == 200
    assert client.get("/api/auth/me").json()["role"] == "anonymous"
    assert client.get("/api/sessions").status_code == 401


def test_expired_and_revoked_invites_cannot_log_in(public_client):
    client = public_client
    client.post("/api/auth/login", json={"password": "admin-test-password"})
    code = client.post("/api/admin/invites", json={}).json()["invite"]["code"]
    client.post("/api/auth/logout")
    stored = auth.list_invites()
    stored[0]["expires_at"] = time.time() - 1
    auth._write_invites(stored)
    assert client.post("/api/auth/login", json={"invite_code": code}).status_code == 401


def test_login_failures_are_limited_per_ip(public_client):
    client = public_client
    for _ in range(5):
        assert client.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json={"password": "admin-test-password"}).status_code == 429


def test_login_failures_do_not_lock_other_client_ips(public_client):
    first = TestClient(app, client=("198.51.100.10", 50001))
    second = TestClient(app, client=("198.51.100.11", 50002))
    for _ in range(5):
        assert first.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
    assert first.post("/api/auth/login", json={"password": "admin-test-password"}).status_code == 429
    assert second.post("/api/auth/login", json={"password": "admin-test-password"}).status_code == 200
    assert "198.51.100.10" in auth._login_failures
    assert "198.51.100.11" not in auth._login_failures


def test_guest_config_omits_all_secret_fields_and_admin_cannot_change_key(public_client):
    client = public_client
    visible = {"api_providers": {"ark": {"api_key": "********", "base_url": "https://example.test"}}}
    with patch.object(configuration.Config, "as_public_dict", return_value=visible):
        client.post("/api/auth/login", json={"password": "admin-test-password"})
        code = client.post("/api/admin/invites", json={}).json()["invite"]["code"]
        with patch.object(configuration.Config, "update_config") as update:
            assert client.put("/api/config", json={"values": {"api_providers": {"ark": {"api_key": "new"}}}}).status_code == 403
            update.assert_not_called()
        client.post("/api/auth/logout")
        client.post("/api/auth/login", json={"invite_code": code})
        guest_config = client.get("/api/config").json()["config"]
    assert "api_key" not in guest_config["api_providers"]["ark"]
    assert guest_config["api_providers"]["ark"]["base_url"] == "https://example.test"


def test_showcase_list_detail_and_patch(public_client, tmp_path):
    client = public_client
    session_dir = tmp_path / "sessions"
    session_dir.mkdir()
    for session_id, flag in (("public", True), ("private", False)):
        (session_dir / f"{session_id}.json").write_text(
            json.dumps({"session_id": session_id, "status": {}, "meta": {}, "showcase": flag}),
            encoding="utf-8",
        )
    engine = MagicMock()
    engine._session_dir = str(session_dir)
    engine._state_lock = threading.RLock()
    engine.list_saved_sessions.return_value = [{"id": "public"}, {"id": "private"}]
    engine.get_status_snapshot.side_effect = lambda sid: {"session_id": sid} if sid in {"public", "private"} else None
    engine.get_state.side_effect = lambda sid: object() if sid in {"public", "private"} else None

    with patch.object(sessions, "workflow_engine", engine), patch.object(showcase, "workflow_engine", engine):
        client.post("/api/auth/login", json={"password": "admin-test-password"})
        assert len(client.get("/api/sessions").json()["sessions"]) == 2
        assert client.patch("/api/sessions/private", json={"showcase": True}).status_code == 200
        assert json.loads((session_dir / "private.json").read_text())["showcase"] is True
        with patch.object(admin, "today_usage", return_value={"date": "2026-10-03", "total_cny": "0.00"}):
            assert client.get("/api/admin/usage").json()["total_cny"] == "0.00"
        assert client.patch("/api/sessions/private", json={"showcase": False}).status_code == 200
        client.post("/api/auth/logout")
        code = auth.create_invite()["code"]
        client.post("/api/auth/login", json={"invite_code": code})
        assert [item["id"] for item in client.get("/api/sessions").json()["sessions"]] == ["public"]
        assert client.get("/api/sessions/public").status_code == 200
        assert client.get("/api/sessions/private").status_code == 404
        assert client.get("/api/project/private/status").status_code == 404
        assert client.patch("/api/sessions/public", json={"showcase": False}).status_code == 403
