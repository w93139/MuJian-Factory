import json
import logging
import os
import threading
import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from api.auth import require_admin, role_from_request
from api.schemas.sandbox import (
    SandboxI2IRequest,
    SandboxLLMRequest,
    SandboxT2IRequest,
    SandboxVideoRequest,
    SandboxVLMRequest,
)
from config import settings
from error_messages import safe_error_text
from path_security import resolve_media_reference

router = APIRouter(tags=["Sandbox"])
logger = logging.getLogger(__name__)


SANDBOX_DIR = os.path.join(settings.CODE_DIR, "result", "sandbox")
SANDBOX_HISTORY_FILE = os.path.join(SANDBOX_DIR, "history.json")
SANDBOX_ACTIVE_TASKS: dict[str, dict] = {}
SANDBOX_LOCK = threading.RLock()

# 确保目录存在
os.makedirs(SANDBOX_DIR, exist_ok=True)


def _validated_media_reference(value: str) -> str:
    try:
        return resolve_media_reference(
            value,
            [settings.TEMP_DIR, settings.CODE_DIR],
            allow_remote_urls=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _media_parameters(req, model_type: str) -> dict:
    """Validate explicit choices before any provider call; disclose legacy defaults."""
    from models.config_model import ensure_model_available, model_type_capabilities
    from models.video_params import normalize_video_params

    try:
        metadata = ensure_model_available(req.model)
        if model_type not in metadata.get("type", []):
            raise ValueError(f"模型不支持 {model_type} 工具")
        capabilities = model_type_capabilities(model_type, metadata)
        if model_type == "video":
            ability = "first_frame_i2v" if req.image else "text_to_video"
            if not capabilities.get("api_contract_verified") or ability not in capabilities.get("adapter_ability_types", []):
                raise ValueError("当前模型未适配沙盒首帧图生视频" if req.image else "当前模型未适配纯文字视频生成，请选择支持首帧生成的模型并提供图片")
            normalized = normalize_video_params(req.model, req.duration or 5, req.resolution, req.ratio)
            values = {"duration": normalized.duration, "resolution": normalized.resolution, "ratio": normalized.ratio}
            for key, actual in values.items():
                requested = getattr(req, key)
                if requested is not None and str(requested).casefold() != str(actual).casefold():
                    raise ValueError(f"所选模型不支持 {key}={requested}，可用值请参考模型选项")
            return values
        values = {}
        for key, default in (("ratio", "16:9"), ("resolution", "2K")):
            requested = getattr(req, key)
            choices = (capabilities.get("ratios", []) if key == "ratio" else capabilities.get("adapter_resolutions", capabilities.get("resolutions", []))) or []
            if requested is not None and choices:
                match = next((item for item in choices if item.casefold() == requested.casefold()), None)
                if match is None:
                    raise ValueError(f"所选模型不支持 {key}={requested}，支持：{', '.join(choices)}")
                values[key] = match
            elif requested is not None and not choices and key == "resolution":
                raise ValueError("所选模型未声明可配置分辨率，请使用默认设置")
            else:
                values[key] = requested or (default if not choices or default in choices else choices[0])
        return values
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def _load_history() -> List[dict]:
    """加载历史记录"""
    with SANDBOX_LOCK:
        if os.path.exists(SANDBOX_HISTORY_FILE):
            try:
                with open(SANDBOX_HISTORY_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                logger.warning("Failed to load sandbox history: %s", SANDBOX_HISTORY_FILE, exc_info=True)
                return []
        return []


def _save_history(history: List[dict]):
    """保存历史记录"""
    with SANDBOX_LOCK:
        tmp_path = f"{SANDBOX_HISTORY_FILE}.{uuid.uuid4().hex}.tmp"
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(history, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, SANDBOX_HISTORY_FILE)


def _normalize_path(path: str) -> str:
    """将绝对路径转换为相对路径格式 result/..."""
    if not path:
        return path
    # 如果已经是相对路径，直接返回
    if not path.startswith('/'):
        # 确保以 result/ 开头
        if not path.startswith('result/'):
            return f"result/{path}"
        return path
    # 绝对路径，提取相对于 CODE_DIR 的部分
    code_dir = settings.CODE_DIR
    if path.startswith(code_dir):
        relative = path[len(code_dir):].lstrip('/')
        # 直接返回 result/... 格式，因为 /code/ 会映射到 CODE_DIR
        return relative
    # 其他绝对路径，尝试提取文件名
    return path.split('/')[-1]


def _convert_output_paths(output_data: dict) -> dict:
    """转换 output 中的路径为相对路径格式"""
    if not output_data:
        return output_data
    converted = output_data.copy()
    # 转换 images
    if 'images' in converted and isinstance(converted['images'], list):
        converted['images'] = [_normalize_path(img) for img in converted['images']]
    # 转换 video_path
    if 'video_path' in converted and converted['video_path']:
        converted['video_path'] = _normalize_path(converted['video_path'])
    # 转换 input 中的 reference_image
    if 'reference_image' in converted.get('input', {}):
        input_copy = converted['input'].copy()
        input_copy['reference_image'] = _normalize_path(input_copy['reference_image'])
        converted['input'] = input_copy
    return converted


def _converted_result_list(paths: List[str] | None) -> List[str]:
    """Return generated image paths in the same format used by sandbox history."""
    converted = _convert_output_paths({"images": paths or []})
    return converted.get("images", [])


def _converted_video_path(path: str | None) -> str:
    """Return generated video path in the same format used by sandbox history."""
    converted = _convert_output_paths({"video_path": path or ""})
    return converted.get("video_path", "")


def _add_record(
    tool: str,
    model: str,
    input_data: dict,
    output_data: dict,
    files: List[str] = None,
    record_id: str | None = None,
) -> str:
    """添加历史记录"""
    with SANDBOX_LOCK:
        record_id = record_id or str(uuid.uuid4().hex[:8])
        # 转换路径为相对路径格式
        output_data = _convert_output_paths(output_data)
        record = {
            "id": record_id,
            "tool": tool,
            "model": model,
            "input": input_data,
            "output": output_data,
            "files": files or [],
            "showcase": False,
            "created_at": datetime.now().isoformat(),
        }
        history = _load_history()
        history.insert(0, record)  # 最新记录放在最前面
        _save_history(history)
        return record_id


def _start_active_task(tool: str, model: str, input_data: dict) -> str:
    with SANDBOX_LOCK:
        task_id = str(uuid.uuid4().hex[:8])
        SANDBOX_ACTIVE_TASKS[task_id] = {
            "id": task_id,
            "tool": tool,
            "model": model,
            "input": input_data,
            "status": "running",
            "progress": 1,
            "created_at": datetime.now().isoformat(),
        }
        return task_id


def _finish_active_task(task_id: str) -> None:
    with SANDBOX_LOCK:
        SANDBOX_ACTIVE_TASKS.pop(task_id, None)


def _delete_record_files(files: List[str]):
    """删除记录关联的文件"""
    for f in files:
        if f and os.path.exists(f):
            try:
                os.remove(f)
            except Exception:
                logger.warning("Failed to delete sandbox artifact: %s", f, exc_info=True)
                pass


# 请求模型
@router.get("/api/sandbox/history")
async def sandbox_get_history(request: Request):
    """获取历史记录列表"""
    history = _load_history()
    if role_from_request(request) == "guest":
        history = [record for record in history if record.get("showcase") is True]
    # 返回完整信息（包括 output）
    return {
        "success": True,
        "records": [
            {
                "id": r["id"],
                "tool": r["tool"],
                "model": r["model"],
                "input": r["input"],
                "output": r.get("output"),
                "created_at": r["created_at"],
                "showcase": r.get("showcase") is True,
            }
            for r in history
        ]
    }


@router.get("/api/sandbox/tasks")
async def sandbox_get_active_tasks():
    """获取临时工作台正在执行的任务"""
    with SANDBOX_LOCK:
        tasks = list(SANDBOX_ACTIVE_TASKS.values())
    return {"success": True, "tasks": tasks}


@router.get("/api/sandbox/history/{record_id}")
async def sandbox_get_record(record_id: str, request: Request):
    """获取单条历史记录详情"""
    history = _load_history()
    for r in history:
        if r["id"] == record_id:
            if role_from_request(request) == "guest" and r.get("showcase") is not True:
                raise HTTPException(404, "记录不存在")
            return {"success": True, "record": {**r, "showcase": r.get("showcase") is True}}
    raise HTTPException(404, "记录不存在")


class ShowcaseUpdate(BaseModel):
    showcase: bool


@router.patch("/api/sandbox/history/{record_id}", dependencies=[Depends(require_admin)])
async def sandbox_set_showcase(record_id: str, req: ShowcaseUpdate):
    with SANDBOX_LOCK:
        history = _load_history()
        for record in history:
            if record.get("id") == record_id:
                record["showcase"] = req.showcase
                _save_history(history)
                return {"id": record_id, "showcase": req.showcase}
    raise HTTPException(404, "记录不存在")


@router.delete("/api/sandbox/history/{record_id}")
async def sandbox_delete_record(record_id: str):
    """删除历史记录"""
    with SANDBOX_LOCK:
        history = _load_history()
        record_to_delete = None
        new_history = []
        for r in history:
            if r["id"] == record_id:
                record_to_delete = r
            else:
                new_history.append(r)

        if record_to_delete is None:
            return {"success": False, "error": "记录不存在"}

        _save_history(new_history)

    # 删除关联文件不需要占用历史锁。
    _delete_record_files(record_to_delete.get("files", []))
    logger.info("Sandbox history deleted: record_id=%s", record_id)
    return {"success": True}


@router.post("/api/sandbox/llm")
async def sandbox_llm(req: SandboxLLMRequest):
    """临时工作台 - LLM 文字生成"""
    from models.llm_client import LLM
    client = LLM()
    input_data = {"prompt": req.prompt, "web_search": req.web_search}
    task_id = _start_active_task("llm", req.model, input_data)
    try:
        logger.info("Sandbox LLM started: model=%s web_search=%s", req.model, req.web_search)
        result = await run_in_threadpool(
            client.query,
            req.prompt,
            model=req.model,
            web_search=req.web_search,
        )
        # ��存到历史记录
        record_id = _add_record(
            tool="llm",
            model=req.model,
            input_data=input_data,
            output_data={"response": result},
            record_id=task_id,
        )
        logger.info("Sandbox LLM completed: model=%s record_id=%s", req.model, record_id)
        return {"success": True, "result": result, "record_id": record_id}
    except Exception as e:
        logger.error("Sandbox LLM failed: model=%s reason=%s", req.model, safe_error_text(e))
        return {"success": False, "error": safe_error_text(e)}
    finally:
        _finish_active_task(task_id)


@router.post("/api/sandbox/vlm")
async def sandbox_vlm(req: SandboxVLMRequest):
    """临时工作台 - VLM 图片理解"""
    from models.vlm_client import VLM
    client = VLM()
    images = [_validated_media_reference(image) for image in req.images]
    input_data = {"prompt": req.prompt, "images": images}
    task_id = _start_active_task("vlm", req.model, input_data)
    try:
        logger.info("Sandbox VLM started: model=%s images=%d", req.model, len(req.images or []))
        result = await run_in_threadpool(
            client.query,
            req.prompt,
            image_paths=images,
            model=req.model,
        )
        # 保存到历史记录
        record_id = _add_record(
            tool="vlm",
            model=req.model,
            input_data=input_data,
            output_data={"response": result},
            record_id=task_id,
        )
        logger.info("Sandbox VLM completed: model=%s record_id=%s", req.model, record_id)
        return {"success": True, "result": result, "record_id": record_id}
    except Exception as e:
        logger.error("Sandbox VLM failed: model=%s reason=%s", req.model, safe_error_text(e))
        return {"success": False, "error": safe_error_text(e)}
    finally:
        _finish_active_task(task_id)


@router.post("/api/sandbox/t2i")
async def sandbox_t2i(req: SandboxT2IRequest):
    """临时工作台 - 文生图"""
    from models.image_client import ImageClient
    client = ImageClient()
    parameters = _media_parameters(req, "t2i")
    input_data = {"prompt": req.prompt, **parameters}
    task_id = _start_active_task("t2i", req.model, input_data)
    try:
        logger.info("Sandbox T2I started: model=%s ratio=%s", req.model, req.ratio)
        result = await run_in_threadpool(
            client.generate_image,
            req.prompt,
            model=req.model,
            image_paths=None,
            video_ratio=parameters["ratio"],
            resolution=parameters["resolution"],
        )
        if not result:
            raise RuntimeError(f"图片生成没有返回结果: model={req.model}")
        # result 是图片路径列表
        # 保存到历史记录
        record_id = _add_record(
            tool="t2i",
            model=req.model,
            input_data=input_data,
            output_data={"images": result},
            files=result if isinstance(result, list) else [],
            record_id=task_id,
        )
        logger.info(
            "Sandbox T2I completed: model=%s record_id=%s images=%d",
            req.model,
            record_id,
            len(result) if isinstance(result, list) else 0,
        )
        return {
            "success": True,
            "result": _converted_result_list(result if isinstance(result, list) else []),
            "parameters": parameters,
            "record_id": record_id,
        }
    except Exception as e:
        logger.error("Sandbox T2I failed: model=%s reason=%s", req.model, safe_error_text(e))
        return {"success": False, "error": safe_error_text(e)}
    finally:
        _finish_active_task(task_id)


@router.post("/api/sandbox/i2i")
async def sandbox_i2i(req: SandboxI2IRequest):
    """临时工作台 - 图生图"""
    from models.image_client import ImageClient
    client = ImageClient()
    image = _validated_media_reference(req.image)
    parameters = _media_parameters(req, "i2i")
    input_data = {"prompt": req.prompt, "reference_image": image, **parameters}
    task_id = _start_active_task("i2i", req.model, input_data)
    try:
        logger.info("Sandbox I2I started: model=%s ratio=%s", req.model, req.ratio)
        result = await run_in_threadpool(
            client.generate_image,
            req.prompt,
            image_paths=[image],
            model=req.model,
            video_ratio=parameters["ratio"],
            resolution=parameters["resolution"],
        )
        if not result:
            raise RuntimeError(f"图片生成没有返回结果: model={req.model}")
        # 保存到历史记录
        record_id = _add_record(
            tool="i2i",
            model=req.model,
            input_data=input_data,
            output_data={"images": result},
            files=result if isinstance(result, list) else [],
            record_id=task_id,
        )
        logger.info(
            "Sandbox I2I completed: model=%s record_id=%s images=%d",
            req.model,
            record_id,
            len(result) if isinstance(result, list) else 0,
        )
        return {
            "success": True,
            "result": _converted_result_list(result if isinstance(result, list) else []),
            "parameters": parameters,
            "record_id": record_id,
        }
    except Exception as e:
        logger.error("Sandbox I2I failed: model=%s reason=%s", req.model, safe_error_text(e))
        return {"success": False, "error": safe_error_text(e)}
    finally:
        _finish_active_task(task_id)


@router.post("/api/sandbox/video")
async def sandbox_video(req: SandboxVideoRequest):
    """临时工作台 - 视频生成"""
    from models.video_client import VideoClient
    client = VideoClient()
    image = _validated_media_reference(req.image) if req.image else None
    parameters = _media_parameters(req, "video")
    input_data = {"prompt": req.prompt, "reference_image": image, **parameters}
    task_id = _start_active_task("video", req.model, input_data)
    try:
        # 生成唯一的保存路径
        save_dir = os.path.join(SANDBOX_DIR, "videos")
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, f"{uuid.uuid4().hex[:8]}.mp4")
        logger.info("Sandbox video started: model=%s image=%s", req.model, bool(req.image))

        result = await run_in_threadpool(
            client.generate_video,
            prompt=req.prompt,
            image_path=image or "",
            save_path=save_path,
            model=req.model,
            duration=parameters["duration"],
            video_ratio=parameters["ratio"],
            resolution=parameters["resolution"],
            shot_type="multi",
        )
        # 保存到历史记录
        record_id = _add_record(
            tool="video",
            model=req.model,
            input_data=input_data,
            output_data={"video": result, "video_path": save_path},
            files=[save_path],
            record_id=task_id,
        )
        logger.info("Sandbox video completed: model=%s record_id=%s video=%s", req.model, record_id, save_path)
        return {
            "success": True,
            "result": result,
            "video_path": _converted_video_path(save_path),
            "parameters": parameters,
            "record_id": record_id,
        }
    except Exception as e:
        logger.error("Sandbox video failed: model=%s reason=%s", req.model, safe_error_text(e))
        return {"success": False, "error": safe_error_text(e)}
    finally:
        _finish_active_task(task_id)
