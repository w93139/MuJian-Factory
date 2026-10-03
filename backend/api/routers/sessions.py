from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from api.auth import require_admin, role_from_request
from api.dependencies import workflow_engine
from api.showcase import is_showcase_session, set_showcase_session

router = APIRouter(tags=["Sessions"])


@router.get("/api/sessions")
async def list_sessions(request: Request):
    role = role_from_request(request)
    sessions = workflow_engine.list_saved_sessions()
    for session in sessions:
        session["showcase"] = is_showcase_session(session["id"])
    if role == "guest":
        sessions = [session for session in sessions if session["showcase"]]
    return {"sessions": sessions}


@router.get("/api/sessions/{session_id}")
async def get_session(session_id: str, request: Request):
    if role_from_request(request) == "guest" and not is_showcase_session(session_id):
        raise HTTPException(404, "Session not found")
    snapshot = workflow_engine.get_status_snapshot(session_id)
    if snapshot is None:
        raise HTTPException(404, "Session not found")
    return {**snapshot, "showcase": is_showcase_session(session_id)}


class ShowcaseUpdate(BaseModel):
    showcase: bool


@router.patch("/api/sessions/{session_id}", dependencies=[Depends(require_admin)])
async def update_session(session_id: str, req: ShowcaseUpdate):
    if not set_showcase_session(session_id, req.showcase):
        raise HTTPException(404, "Session not found")
    return {"id": session_id, "showcase": req.showcase}


@router.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a saved session and its generated files."""
    deleted = workflow_engine.delete_session(session_id)
    if not deleted:
        raise HTTPException(404, "Session not found")
    return {"status": "deleted", "session_id": session_id}


@router.delete("/api/sessions")
async def cleanup_orphan_files():
    """Remove result files without a saved session."""
    return workflow_engine.cleanup_orphan_results()
