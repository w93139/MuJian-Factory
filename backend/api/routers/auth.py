"""Browser login routes for public showcase mode."""

import hmac
import os

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from api.auth import (
    COOKIE_NAME,
    clear_login_failures,
    login_allowed,
    public_mode,
    record_login_failure,
    role_from_request,
    session_cookie,
    valid_invite,
)

router = APIRouter(tags=["Auth"])


class LoginRequest(BaseModel):
    password: str | None = None
    invite_code: str | None = None


@router.post("/api/auth/login")
async def login(credentials: LoginRequest, request: Request, response: Response):
    if not public_mode():
        return {"role": "admin", "public_mode": False}

    ip = request.client.host if request.client else "unknown"
    if not login_allowed(ip):
        raise HTTPException(status_code=429, detail="登录尝试过多，请 10 分钟后重试")

    role = ""
    invite = None
    admin_password = os.environ["MUJIAN_ADMIN_PASSWORD"]
    if credentials.password and hmac.compare_digest(credentials.password.encode("utf-8"), admin_password.encode("utf-8")):
        role = "admin"
    elif credentials.invite_code:
        invite = valid_invite(credentials.invite_code, mark_used=True)
        if invite:
            role = "guest"

    if not role:
        record_login_failure(ip)
        raise HTTPException(status_code=401, detail="密码或邀请码无效")

    clear_login_failures(ip)
    token, max_age = session_cookie(role, invite=invite)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=max_age,
        httponly=True,
        secure=os.getenv("MUJIAN_COOKIE_SECURE") == "1",
        samesite="lax",
        path="/",
    )
    return {"role": role, "public_mode": True}


@router.post("/api/auth/logout")
async def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"role": "anonymous" if public_mode() else "admin", "public_mode": public_mode()}


@router.get("/api/auth/me")
async def me(request: Request):
    return {"role": role_from_request(request), "public_mode": public_mode()}
