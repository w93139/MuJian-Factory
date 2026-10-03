"""Invitation management for showcase administrators."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from api.auth import create_invite, list_invites, require_admin, revoke_invite
from usage import today_usage

router = APIRouter(tags=["Admin"], dependencies=[Depends(require_admin)])


class InviteCreateRequest(BaseModel):
    note: str = Field(default="", max_length=200)
    expires_in_hours: int = 72


def _invite_response(invite: dict) -> dict:
    response = dict(invite)
    for field in ("expires_at", "last_used_at"):
        if isinstance(response.get(field), (int, float)):
            response[field] = datetime.fromtimestamp(response[field], timezone.utc).isoformat()
    return response


@router.get("/api/admin/invites")
async def get_invites():
    return {"invites": [_invite_response(item) for item in list_invites()]}


@router.get("/api/admin/usage")
async def get_usage():
    return today_usage()


@router.post("/api/admin/invites")
async def post_invite(req: InviteCreateRequest):
    try:
        return {"invite": _invite_response(create_invite(req.note, req.expires_in_hours))}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/api/admin/invites/{code}")
async def delete_invite(code: str):
    if not revoke_invite(code):
        raise HTTPException(status_code=404, detail="邀请码不存在")
    return {"status": "revoked", "code": code.upper()}
