"""Signed browser sessions and invitation storage for public showcase mode."""

import base64
import binascii
import hashlib
import hmac
import json
import os
import secrets
import tempfile
import threading
import time
from pathlib import Path
from typing import Any

from fastapi import HTTPException, Request

from config import settings

COOKIE_NAME = "mujian_session"
ADMIN_TTL_SECONDS = 7 * 24 * 60 * 60
LOGIN_WINDOW_SECONDS = 10 * 60
MAX_LOGIN_FAILURES = 5
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
_invite_lock = threading.RLock()
_failure_lock = threading.RLock()
_login_failures: dict[str, list[float]] = {}


def public_mode() -> bool:
    return os.getenv("MUJIAN_PUBLIC_MODE") == "1"


def validate_public_settings() -> None:
    if not public_mode():
        return
    missing = [name for name in ("MUJIAN_ADMIN_PASSWORD", "MUJIAN_SESSION_SECRET") if not os.getenv(name)]
    if missing:
        raise RuntimeError(f"公网模式缺少必填环境变量: {', '.join(missing)}")


def _secret() -> bytes:
    value = os.getenv("MUJIAN_SESSION_SECRET")
    if not value:
        raise RuntimeError("MUJIAN_SESSION_SECRET 未配置")
    return value.encode("utf-8")


def _encode(data: dict[str, Any]) -> str:
    payload = base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":")).encode()).rstrip(b"=")
    signature = hmac.new(_secret(), payload, hashlib.sha256).hexdigest()
    return f"{payload.decode()}.{signature}"


def _decode(token: str) -> dict[str, Any] | None:
    try:
        payload, signature = token.split(".", 1)
        expected = hmac.new(_secret(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        decoded = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if not isinstance(decoded, dict) or float(decoded.get("exp", 0)) <= time.time():
            return None
        return decoded
    except (ValueError, TypeError, UnicodeDecodeError, binascii.Error, OverflowError):
        return None


def invite_path() -> Path:
    return Path(settings.CODE_DIR) / "data" / "invites.json"


def _read_invites() -> list[dict[str, Any]]:
    path = invite_path()
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, list):
        raise ValueError("邀请码存储格式无效")
    return data


def _write_invites(invites: list[dict[str, Any]]) -> None:
    path = invite_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(dir=path.parent, prefix="invites.", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(invites, handle, ensure_ascii=False, indent=2)
        os.replace(temp_path, path)
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


def list_invites() -> list[dict[str, Any]]:
    with _invite_lock:
        return [dict(item) for item in _read_invites()]


def create_invite(note: str = "", expires_in_hours: int = 72) -> dict[str, Any]:
    if not 1 <= expires_in_hours <= 24 * 365:
        raise ValueError("邀请码有效期须在 1 小时至 1 年之间")
    with _invite_lock:
        invites = _read_invites()
        existing = {str(item.get("code", "")) for item in invites}
        code = ""
        while not code or code in existing:
            code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))
        invite = {
            "code": code,
            "note": note.strip(),
            "expires_at": time.time() + expires_in_hours * 3600,
            "revoked": False,
            "last_used_at": None,
        }
        invites.append(invite)
        _write_invites(invites)
        return dict(invite)


def revoke_invite(code: str) -> bool:
    with _invite_lock:
        invites = _read_invites()
        for item in invites:
            if hmac.compare_digest(str(item.get("code", "")).encode("utf-8"), code.upper().encode("utf-8")):
                item["revoked"] = True
                _write_invites(invites)
                return True
        return False


def valid_invite(code: str, *, mark_used: bool = False) -> dict[str, Any] | None:
    with _invite_lock:
        invites = _read_invites()
        for item in invites:
            if (
                hmac.compare_digest(str(item.get("code", "")).encode("utf-8"), code.upper().encode("utf-8"))
                and not item.get("revoked")
                and float(item.get("expires_at", 0)) > time.time()
            ):
                if mark_used:
                    item["last_used_at"] = time.time()
                    _write_invites(invites)
                return dict(item)
    return None


def role_from_request(request: Request) -> str:
    if not public_mode():
        return "admin"
    token = request.cookies.get(COOKIE_NAME)
    data = _decode(token) if token else None
    if not data:
        return "anonymous"
    role = data.get("role")
    if role == "admin":
        return "admin"
    if role == "guest" and isinstance(data.get("code"), str) and valid_invite(data["code"]):
        return "guest"
    return "anonymous"


def require_admin(request: Request) -> None:
    if role_from_request(request) != "admin":
        raise HTTPException(status_code=403, detail="仅管理员可操作")


def login_allowed(ip: str) -> bool:
    now = time.time()
    with _failure_lock:
        recent = [value for value in _login_failures.get(ip, []) if now - value < LOGIN_WINDOW_SECONDS]
        if recent:
            _login_failures[ip] = recent
        else:
            _login_failures.pop(ip, None)
        return len(recent) < MAX_LOGIN_FAILURES


def record_login_failure(ip: str) -> None:
    with _failure_lock:
        _login_failures.setdefault(ip, []).append(time.time())


def clear_login_failures(ip: str) -> None:
    with _failure_lock:
        _login_failures.pop(ip, None)


def session_cookie(role: str, *, invite: dict[str, Any] | None = None) -> tuple[str, int]:
    now = time.time()
    expiry = float(invite["expires_at"]) if invite else now + ADMIN_TTL_SECONDS
    payload: dict[str, Any] = {"role": role, "exp": expiry}
    if invite:
        payload["code"] = invite["code"]
    return _encode(payload), max(1, int(expiry - now))
