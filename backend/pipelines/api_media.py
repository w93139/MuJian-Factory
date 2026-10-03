import logging
from typing import Any, Optional

from models.config_model import (
    list_api_models,
    parse_api_model,
)
from models.image_client import ImageClient
from models.video_client import VideoClient
from models.video_params import normalize_video_params

logger = logging.getLogger(__name__)


def list_api_workflows(
    media_type: Optional[str] = None,
    required_adapter_abilities: Optional[list[str]] = None,
    verified_only: bool = False,
) -> list[dict[str, Any]]:
    return list_api_models(
        media_type=media_type,
        required_adapter_abilities=required_adapter_abilities,
        verified_only=verified_only,
    )


def parse_api_workflow(workflow: str, media_type: str) -> tuple[str, str]:
    return parse_api_model(workflow, media_type)


def generate_image_api(
    *,
    prompt: str,
    model: str,
    output_dir: str,
    task_id: str,
    image_paths: Optional[list[str]] = None,
    video_ratio: str = "9:16",
    resolution: str = "1080P",
) -> str:
    _, resolved_model = parse_api_workflow(model, "image")
    logger.info(
        "Generating API image: model=%s refs=%d ratio=%s resolution=%s",
        resolved_model,
        len(image_paths or []),
        video_ratio,
        resolution,
    )
    paths = ImageClient().generate_image(
        prompt=prompt,
        image_paths=image_paths,
        model=resolved_model,
        save_dir=output_dir,
        session_id=task_id,
        video_ratio=video_ratio,
        resolution=resolution,
    )
    if not paths:
        raise RuntimeError(f"Image API returned no result for model={resolved_model}")
    return paths[0]


def generate_video_api(
    *,
    prompt: str,
    model: str,
    output_path: str,
    image_path: Optional[str] = None,
    duration: int = 5,
    video_ratio: str = "9:16",
    video_resolution: Optional[str] = None,
    **params,
) -> str:
    provider, resolved_model = parse_api_workflow(model, "video")
    legacy_resolution = params.pop("resolution", None)
    normalized = normalize_video_params(
        resolved_model, duration, video_resolution or legacy_resolution, video_ratio
    )
    logger.info(
        "Generating API video: provider=%s model=%s duration=%ss ratio=%s output=%s",
        provider or "unknown",
        resolved_model,
        normalized.duration,
        normalized.ratio,
        output_path,
    )
    VideoClient().generate_video(
        prompt=prompt,
        image_path=image_path,
        save_path=output_path,
        model=resolved_model,
        duration=normalized.duration,
        video_ratio=normalized.ratio,
        resolution=normalized.resolution,
        **params,
    )
    return output_path
