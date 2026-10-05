"""The short-film preset chooses a registered fast first-frame video model."""

from models.config_model import ensure_model_available

FAST_VIDEO_MODELS = (
    "wan2.6-i2v-flash",
    "doubao-seedance-2-0-fast-260128",
)


def quick_demo_video_model(preferred: str | None = None) -> str:
    for model_id in ((preferred,) if preferred else ()) + FAST_VIDEO_MODELS:
        try:
            model = ensure_model_available(model_id)
        except ValueError:
            continue
        capabilities = model.get("capabilities", {})
        if "first_frame_i2v" in capabilities.get("adapter_ability_types", []):
            return model_id
    raise ValueError("当前没有可用的快速演示视频模型")
