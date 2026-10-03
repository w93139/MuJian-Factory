from typing import Any, Dict

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from api.auth import public_mode, role_from_request
from api.logging_config import apply_access_log_setting, apply_log_level_setting
from config import SECRET_MASK, Config

router = APIRouter(tags=["Configuration"])


class ConfigUpdateRequest(BaseModel):
    values: Dict[str, Any] = Field(default_factory=dict)


def _without_secrets(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _without_secrets(item)
            for key, item in value.items()
            if key.lower() not in {"api_key", "secret", "secret_key", "password", "access_token"}
        }
    if isinstance(value, list):
        return [_without_secrets(item) for item in value]
    return value


def _changes_key(value: Any) -> bool:
    if not isinstance(value, dict):
        return False
    return any(
        (key.lower() == "api_key" and item != SECRET_MASK)
        or _changes_key(item)
        for key, item in value.items()
    )


@router.get("/api/config")
async def get_config(request: Request):
    config = Config.as_public_dict()
    if public_mode() and role_from_request(request) == "guest":
        config = _without_secrets(config)
    return {
        "config": config,
        "path": "backend/config.yaml",
    }


@router.put("/api/config")
async def update_config(req: ConfigUpdateRequest):
    if public_mode() and _changes_key(req.values):
        raise HTTPException(status_code=403, detail="公网模式下 API Key 由服务器环境变量管理")
    Config.update_config(req.values)
    apply_log_level_setting()
    apply_access_log_setting()
    return {
        "config": Config.as_public_dict(),
        "path": "backend/config.yaml",
    }
