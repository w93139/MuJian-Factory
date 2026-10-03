"""Public mode request authorization shared by API routes and /code files."""

import re

from fastapi import Request
from fastapi.responses import JSONResponse

from api.auth import public_mode, role_from_request
from api.showcase import is_showcase_session

GUEST_READ_PATHS = {
    "/api/config",
    "/api/models",
    "/api/stages",
    "/api/pipelines",
    "/api/pipelines/api-workflows",
    "/api/pipelines/standard/templates",
    "/api/tasks",
    "/api/sandbox/history",
    "/api/sessions",
}
GUEST_READ_PATTERNS = (
    re.compile(r"^/api/sessions/([^/]+)$"),
    re.compile(r"^/api/project/([^/]+)/status$"),
    re.compile(r"^/api/project/([^/]+)/artifact/[^/]+$"),
    re.compile(r"^/api/project/([^/]+)/scene/\d+/assets$"),
    re.compile(r"^/api/tasks/[^/]+$"),
    re.compile(r"^/api/sandbox/history/[^/]+$"),
    re.compile(r"^/api/pipelines/standard/templates/[^/]+/[^/]+/preview$"),
)


def guest_can_read(path: str) -> tuple[bool, str | None]:
    if path.startswith("/code/result/"):
        return True, None
    if path in GUEST_READ_PATHS:
        return True, None
    for index, pattern in enumerate(GUEST_READ_PATTERNS):
        match = pattern.fullmatch(path)
        if match:
            return True, match.group(1) if index < 4 else None
    return False, None


async def public_access_middleware(request: Request, call_next):
    if not public_mode() or request.method == "OPTIONS":
        return await call_next(request)
    path = request.url.path
    if path == "/api/health" or path.startswith("/api/auth/"):
        return await call_next(request)

    role = role_from_request(request)
    request.state.role = role
    if role == "admin":
        return await call_next(request)
    if role == "anonymous":
        return JSONResponse(status_code=401, content={"detail": "请先登录"})
    if request.method == "GET":
        allowed, session_id = guest_can_read(path)
        if allowed:
            if session_id and not is_showcase_session(session_id):
                return JSONResponse(status_code=404, content={"detail": "Session not found"})
            return await call_next(request)
    return JSONResponse(status_code=403, content={"detail": "展示模式下不可操作"})
