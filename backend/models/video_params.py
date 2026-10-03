"""Normalize video requests against the selected model's registered capabilities."""

import logging
from dataclasses import dataclass

from models.config_model import get_model_config

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class VideoParameters:
    duration: int
    resolution: str
    ratio: str


def _supported_choice(model: str, field: str, requested: str | None, supported: list[str], default: str) -> str:
    if not supported:
        return requested or default
    if requested:
        for choice in supported:
            if choice.casefold() == requested.strip().casefold():
                return choice
        logger.warning("Video model %s does not support %s=%s; using %s", model, field, requested, supported[0])
        return supported[0]
    for choice in supported:
        if choice.casefold() == default.casefold():
            return choice
    return supported[0]


def normalize_video_params(
    model: str,
    duration: int | float,
    resolution: str | None = None,
    ratio: str | None = None,
) -> VideoParameters:
    """Return a supported request, preserving canonical API parameter spelling."""
    metadata = get_model_config(model)
    if "video" not in metadata.get("type", []):
        raise ValueError(f"模型不支持视频生成: {model}")

    capabilities = metadata.get("capabilities") or {}
    contract = capabilities.get("duration") or {}
    requested_duration = int(round(float(duration)))
    choices = contract.get("values") or contract.get("options")
    if choices:
        allowed = sorted({int(value) for value in choices})
        safe_duration = min(allowed, key=lambda value: (abs(value - requested_duration), value))
    else:
        safe_duration = max(int(contract.get("min", 1)), requested_duration)
        if contract.get("max") is not None:
            safe_duration = min(int(contract["max"]), safe_duration)
    if safe_duration != requested_duration:
        logger.warning("Video model %s does not support duration=%ss; using %ss", model, requested_duration, safe_duration)

    return VideoParameters(
        duration=safe_duration,
        resolution=_supported_choice(model, "resolution", resolution, capabilities.get("resolutions") or [], "720P"),
        ratio=_supported_choice(model, "ratio", ratio, capabilities.get("ratios") or [], "16:9"),
    )
