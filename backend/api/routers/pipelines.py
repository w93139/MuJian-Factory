import base64
import os
import re
from contextlib import aclosing
from html import escape
from typing import Optional
from urllib.parse import quote

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel

from api.auth import require_admin, role_from_request
from api.schemas.pipelines import (
    ActionTransferPipelineRequest,
    DigitalHumanPipelineRequest,
    GenericPipelineRequest,
    StandardPipelineRequest,
)
from config import BASE_DIR
from job_limits import job_limiter
from models.config_model import (
    ensure_model_available,
    get_models_by_type,
    model_type_capabilities,
    parse_api_model,
)
from pipelines.api_media import list_api_workflows
from pipelines.events import task_event_stream
from pipelines.runner import PIPELINE_REGISTRY, run_pipeline_task
from pipelines.storage import create_task, delete_task, list_tasks, load_task, set_task_showcase
from pipelines.utils import TEMPLATE_FIELD_DEFAULTS, template_custom_fields, template_media_spec
from quick_demo import quick_demo_video_model

router = APIRouter(tags=["Pipelines"])

TEMPLATE_DIR = os.path.join(str(BASE_DIR), "templates")
DEMO_IMAGE_PATH = os.path.join(TEMPLATE_DIR, "demo", "default_image.png")
TEMPLATE_SIZES = {
    "1080x1920": {"ratio": "9:16", "width": 1080, "height": 1920},
    "1080x1080": {"ratio": "1:1", "width": 1080, "height": 1080},
    "1920x1080": {"ratio": "16:9", "width": 1920, "height": 1080},
}
PLACEHOLDER_IMAGE_FALLBACK = (
    "data:image/svg+xml;utf8,"
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1024 1024'>"
    "<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>"
    "<stop stop-color='%2388b7ff'/><stop offset='1' stop-color='%23f8d58a'/>"
    "</linearGradient></defs>"
    "<rect width='1024' height='1024' fill='url(%23g)'/>"
    "<circle cx='760' cy='220' r='110' fill='%23ffffff' fill-opacity='.45'/>"
    "<path d='M90 820 360 520l170 170 130-150 270 280Z' fill='%23ffffff' fill-opacity='.55'/>"
    "</svg>"
)


def _demo_image_data_uri() -> str:
    if os.path.exists(DEMO_IMAGE_PATH):
        with open(DEMO_IMAGE_PATH, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("ascii")
        return f"data:image/png;base64,{encoded}"
    return PLACEHOLDER_IMAGE_FALLBACK


def _template_label(filename: str) -> str:
    name = os.path.splitext(filename)[0]
    for prefix in ("image_", "static_", "video_", "asset_"):
        if name.startswith(prefix):
            name = name[len(prefix):]
            break
    return name.replace("_", " ").title()


def _template_path(size: str, filename: str) -> str:
    if size not in TEMPLATE_SIZES or "/" in filename or "\\" in filename or not filename.endswith(".html"):
        raise HTTPException(404, "Template not found")
    path = os.path.abspath(os.path.join(TEMPLATE_DIR, size, filename))
    root = os.path.abspath(os.path.join(TEMPLATE_DIR, size))
    if not path.startswith(root + os.sep) or not os.path.exists(path):
        raise HTTPException(404, "Template not found")
    return path


def _render_preview_html(raw: str) -> str:
    demo_image = _demo_image_data_uri()
    replacements = {
        **TEMPLATE_FIELD_DEFAULTS,
        "image": demo_image,
        "media": f'<img class="template-media" style="width:100%;height:100%;object-fit:cover;display:block;" src="{demo_image}" alt="">',
    }

    def repl(match: re.Match) -> str:
        token = match.group(1).strip()
        key = token.split(":", 1)[0].split("=", 1)[0].strip()
        if key in replacements:
            if key == "media":
                return replacements[key]
            return replacements[key]
        if "=" in token:
            return escape(token.split("=", 1)[1].strip())
        return ""

    return re.sub(r"\{\{\s*([^{}]+?)\s*\}\}", repl, raw)


def _validate_standard_image_ratio(params: dict):
    # Templates use their own exact media-slot dimensions. Share freeform
    # validation across standard and its legacy quick_create entry point.
    if params.get("subtitle_template"):
        return
    try:
        image_model = params.get("image_model") or params.get("image_workflow")
        if not isinstance(image_model, str):
            raise ValueError("请选择有效的图片模型")
        _, model = parse_api_model(image_model, "image")
        metadata = ensure_model_available(model)
        capabilities = model_type_capabilities("t2i", metadata)
        if (params.get("video_ratio") or "9:16") not in capabilities.get("ratios", []):
            raise ValueError("当前图片模型未适配所选画幅，请重新选择画幅")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _start_task(background_tasks: BackgroundTasks, pipeline: str, params: dict):
    if pipeline not in PIPELINE_REGISTRY:
        raise HTTPException(404, f"Pipeline not found: {pipeline}")
    if pipeline == "standard":
        _validate_standard_image_ratio(params)
    try:
        job_token = job_limiter.reserve()
    except RuntimeError as exc:
        raise HTTPException(429, str(exc)) from exc
    try:
        metadata = create_task(pipeline=pipeline, input_params=params)
        background_tasks.add_task(run_pipeline_task, metadata["task_id"], pipeline, params, job_token)
    except BaseException:
        job_limiter.release(job_token)
        raise
    return {
        "task_id": metadata["task_id"],
        "pipeline": pipeline,
        "status": metadata["status"],
        "metadata_url": f"/api/tasks/{metadata['task_id']}",
        "output_dir": metadata["output_dir"],
    }


@router.get("/api/pipelines")
async def get_pipelines():
    return {
        "pipelines": [
            {
                "id": "standard",
                "aliases": ["quick_create"],
                "name": "Artistic Short Video",
                "description": "Split narration by periods, generate one image per segment, and assemble either an image-concat short video or dynamic image-to-video clips.",
            },
            {
                "id": "action_transfer",
                "name": "Action Transfer",
                "description": "Use an image, a reference video, and a prompt to call an API video-edit/action-transfer model.",
            },
            {
                "id": "digital_human",
                "name": "Digital Human",
                "description": "Generate a talking-head/product-promotion video with API reference-to-video models.",
            },
        ]
    }


@router.get("/api/pipelines/api-workflows")
async def get_api_workflows(
    media_type: Optional[str] = Query(None, pattern="^(image|video)$"),
    ability: Optional[str] = Query(None),
    verified_only: bool = False,
):
    required = [ability] if ability else None
    return {
        "workflows": list_api_workflows(
            media_type=media_type,
            required_adapter_abilities=required,
            verified_only=verified_only,
        )
    }


@router.get("/api/models")
async def get_api_models(
    media_type: Optional[str] = Query(None, pattern="^(image|video)$"),
    model_type: Optional[str] = Query(None, pattern="^(llm|vlm|t2i|i2i|video)$"),
    ability: Optional[str] = Query(None),
    verified_only: bool = False,
):
    if model_type:
        models = []
        for model in get_models_by_type(model_type):
            capabilities = model_type_capabilities(model_type, model)
            if verified_only is True and not capabilities.get("api_contract_verified", False):
                continue
            if isinstance(ability, str) and ability not in capabilities.get("adapter_ability_types", []):
                continue
            models.append({
                "id": model["id"],
                "label": model.get("name") or model["id"],
                "provider": model.get("provider"),
                "family": model.get("family"),
                "model_type": model_type,
                "type": model.get("type", []),
                "concurrency": model.get("concurrency"),
                "ability_type": capabilities.get("ability_type"),
                "ability_types": capabilities.get("ability_types", []),
                "adapter_ability_types": capabilities.get("adapter_ability_types", []),
                "input_modalities": capabilities.get("input_modalities", []),
                "adapter_input_modalities": capabilities.get("adapter_input_modalities", []),
                "api_contract_verified": capabilities.get("api_contract_verified", False),
                "capabilities": capabilities,
            })
        return {
            "models": models,
            **({"quick_demo_video_model": quick_demo_video_model()} if model_type == "video" else {}),
        }

    required = [ability] if ability else None
    workflows = list_api_workflows(
        media_type=media_type,
        required_adapter_abilities=required,
        verified_only=verified_only,
    )
    return {
        "models": [
            {
                "id": workflow["model"],
                "label": workflow.get("display_name") or workflow["model"],
                "provider": workflow.get("provider"),
                "family": workflow.get("family"),
                "media_type": workflow.get("media_type"),
                "ability_type": workflow.get("ability_type"),
                "ability_types": workflow.get("ability_types", []),
                "adapter_ability_types": workflow.get("adapter_ability_types", []),
                "input_modalities": workflow.get("input_modalities", []),
                "adapter_input_modalities": workflow.get("adapter_input_modalities", []),
                "api_contract_verified": workflow.get("api_contract_verified", False),
                "capabilities": workflow.get("capabilities", {}),
            }
            for workflow in workflows
        ]
    }


@router.get("/api/pipelines/standard/templates")
async def get_standard_templates():
    templates = []
    for size, meta in TEMPLATE_SIZES.items():
        folder = os.path.join(TEMPLATE_DIR, size)
        if not os.path.isdir(folder):
            continue
        for filename in sorted(os.listdir(folder)):
            if not filename.endswith(".html"):
                continue
            template_id = f"{size}/{filename}"
            try:
                media = template_media_spec(template_id)
            except Exception:
                continue
            encoded_filename = quote(filename)
            templates.append({
                "id": template_id,
                "name": os.path.splitext(filename)[0],
                "label": _template_label(filename),
                "size": size,
                "ratio": meta["ratio"],
                "width": meta["width"],
                "height": meta["height"],
                **media,
                "fields": template_custom_fields(template_id),
                "preview_url": f"/api/pipelines/standard/templates/{size}/{encoded_filename}/preview",
            })
    return {"templates": templates}


@router.get("/api/pipelines/standard/templates/{size}/{filename}/preview", response_class=HTMLResponse)
async def preview_standard_template(size: str, filename: str):
    path = _template_path(size, filename)
    with open(path, "r", encoding="utf-8") as f:
        return HTMLResponse(_render_preview_html(f.read()))


@router.post("/api/pipelines/standard/tasks")
async def start_standard_pipeline(req: StandardPipelineRequest, background_tasks: BackgroundTasks):
    return _start_task(background_tasks, "standard", req.model_dump(exclude_none=True))


@router.post("/api/pipelines/action_transfer/tasks")
async def start_action_transfer_pipeline(req: ActionTransferPipelineRequest, background_tasks: BackgroundTasks):
    return _start_task(background_tasks, "action_transfer", req.model_dump(exclude_none=True))


@router.post("/api/pipelines/digital_human/tasks")
async def start_digital_human_pipeline(req: DigitalHumanPipelineRequest, background_tasks: BackgroundTasks):
    return _start_task(background_tasks, "digital_human", req.model_dump(exclude_none=True))


@router.post("/api/pipelines/{pipeline}/tasks")
async def start_generic_pipeline(pipeline: str, req: GenericPipelineRequest, background_tasks: BackgroundTasks):
    normalized = "standard" if pipeline == "quick_create" else pipeline
    return _start_task(background_tasks, normalized, req.params)


@router.get("/api/tasks")
async def get_tasks(request: Request, limit: int = Query(100, ge=1, le=500)):
    guest = role_from_request(request) == "guest"
    tasks = list_tasks(limit=None if guest else limit)
    if guest:
        tasks = [task for task in tasks if task.get("showcase") is True][:limit]
    return {"tasks": tasks}


@router.get("/api/tasks/{task_id}")
async def get_task(task_id: str, request: Request):
    metadata = load_task(task_id)
    if not metadata or (role_from_request(request) == "guest" and metadata.get("showcase") is not True):
        raise HTTPException(404, "Task not found")
    return metadata


class ShowcaseUpdate(BaseModel):
    showcase: bool


@router.patch("/api/tasks/{task_id}", dependencies=[Depends(require_admin)])
async def update_task_showcase(task_id: str, req: ShowcaseUpdate):
    if set_task_showcase(task_id, req.showcase) is None:
        raise HTTPException(404, "Task not found")
    return {"task_id": task_id, "showcase": req.showcase}


@router.delete("/api/tasks/{task_id}")
async def remove_task(task_id: str):
    if not delete_task(task_id):
        raise HTTPException(404, "Task not found")
    return {"success": True}


@router.get("/api/tasks/{task_id}/events")
async def subscribe_task_events(task_id: str, request: Request):
    metadata = load_task(task_id)
    if not metadata or (role_from_request(request) == "guest" and metadata.get("showcase") is not True):
        raise HTTPException(404, "Task not found")
    initial_event = {
        "type": "snapshot",
        "task_id": task_id,
        "status": metadata.get("status"),
        "progress": metadata.get("progress", 0),
    }

    async def authorized_events():
        async with aclosing(task_event_stream(task_id, initial_event=initial_event)) as events:
            async for event in events:
                role = role_from_request(request)
                if role != "admin":
                    current = load_task(task_id) if role == "guest" else None
                    if not current or current.get("showcase") is not True:
                        return
                yield event

    return StreamingResponse(
        authorized_events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
