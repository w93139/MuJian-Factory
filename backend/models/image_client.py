import logging
import os
import re
from typing import List, Optional

from config import Config
from models.config_model import ensure_model_available
from models.image_dashscope import DashScopeClient
from models.image_processor import ImageProcessor
from models.image_seedream import SeedreamClient
from path_utils import absolute_path, media_reference_path

logger = logging.getLogger(__name__)


class ImageClient:
    def __init__(self):
        """
        Unified Image Generation Client
        Routes requests to DashScope or Ark using the model registry.
        """
        self._dashscope_client = None
        self._seedream_client = None

        # Initialize Image Processor for downloads
        self.image_processor = ImageProcessor()

        # Default save directory
        self.base_save_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "code", "result", "image_client")

    @property
    def dashscope_client(self):
        if self._dashscope_client is None:
            self._dashscope_client = DashScopeClient(
                api_key=Config.DASHSCOPE_API_KEY,
                base_url=Config.DASHSCOPE_BASE_URL,
            )
        return self._dashscope_client

    @property
    def seedream_client(self):
        if self._seedream_client is None:
            self._seedream_client = SeedreamClient(
                api_key=Config.ARK_API_KEY,
                base_url=Config.ARK_BASE_URL,
            )
        return self._seedream_client

    def generate_image(self,
                       prompt: str,
                       image_paths: Optional[List[str]] = None,
                       model: Optional[str] = None,
                       save_dir: Optional[str] = None,
                       session_id: Optional[str] = None,
                       video_ratio: Optional[str] = "16:9",
                       resolution: Optional[str] = "2K") -> List[str]:
        """
        Generate images based on prompt and optional reference images.

        Args:
            prompt: Text prompt for generation.
            image_paths: List of local file paths or URLs for reference images.
            model: Model name to determine which provider to use.
            save_dir: Custom directory to save downloaded images.
            session_id: Session ID for organizing saved files.
            video_ratio: Aspect ratio of the video, e.g., "16:9", "9:16", "4:3", "3:4", "1:1".
            resolution: Resolution string, e.g., "720P", "1080P", "2K", "4K",
                or an exact media-slot size such as "1024*1024".

        Returns:
            List of absolute file paths of the generated images.
        """
        save_dir = absolute_path(save_dir) if save_dir else None
        image_paths = [media_reference_path(path) for path in image_paths] if image_paths else None
        # Determine size from video_ratio and resolution
        size_map = {
            "16:9": {
                "720P": "1280*720",
                "1080P": "1920*1080",
                "2K": "2560*1440",
                "4K": "3840*2160"
            },
            "9:16": {
                "720P": "720*1280",
                "1080P": "1080*1920",
                "2K": "1440*2560",
                "4K": "2160*3840"
            },
            "4:3": {
                "720P": "960*720",
                "1080P": "1440*1080",
                "2K": "2560*1920",
                "4K": "3840*2880"
            },
            "3:4": {
                "720P": "720*960",
                "1080P": "1080*1440",
                "2K": "1920*2560",
                "4K": "2880*3840"
            },
            "1:1": {
                "720P": "720*720",
                "1080P": "1080*1080",
                "2K": "2560*2560",
                "4K": "3840*3840"
            }
        }
        
        custom_size = None
        if isinstance(resolution, str) and re.match(r"^\d+[x*]\d+$", resolution):
            custom_size = resolution.replace("x", "*")

        # Keep unsupported choices visible as errors, rather than generating
        # an unrelated 1920*1080 image. Modern Seedream tiers are resolved below.
        size = custom_size or size_map.get(video_ratio, {}).get(resolution)

        model = model or (Config.IMAGE_IT2I_MODEL if image_paths else Config.IMAGE_T2I_MODEL)

        if Config.PRINT_MODEL_INPUT:
            lines = [
                "---- IMAGE GENERATION REQUEST ----",
                f"Prompt: {prompt}",
            ]
            if image_paths:
                lines.append(f"Refs: {len(image_paths)}")
                for p in image_paths:
                    lines.append(" - [Base64图片]" if str(p).startswith("data:") else f" - {p}")
            lines.extend([
                f"Model: {model}",
                f"Video Ratio: {video_ratio}",
                f"Resolution: {resolution}",
                f"Final Size: {size}",
            ])
            if session_id:
                lines.append(f"Session ID: {session_id}")
            lines.append("-" * 30)
            logger.info("\n%s", "\n".join(lines))
            
        model_info = ensure_model_available(model)
        if model in {"doubao-seedream-5-0-pro-260628", "doubao-seedream-5-0-flash-260915"} and not custom_size:
            tiers = {"1K": 1048576, "1.5K": 2359296, "2K": 4194304,
                     "720P": 1048576, "1080P": 2359296}
            if resolution not in tiers:
                raise ValueError("Seedream 5 Pro/Flash 支持 1K、1.5K、2K 图片")
            ratio_w, ratio_h = (int(part) for part in video_ratio.split(":"))
            width = int((tiers[resolution] * ratio_w / ratio_h) ** 0.5) // 2 * 2
            height = int(width * ratio_h / ratio_w) // 2 * 2
            size = f"{width}*{height}"
        if not size:
            raise ValueError(f"当前图片适配器未支持画幅 {video_ratio} 与分辨率 {resolution} 的组合")
        required_type = "i2i" if image_paths else "t2i"
        if required_type not in model_info.get("type", []):
            raise ValueError(f"模型不支持{required_type}图片生成: {model}")
        provider = model_info["provider"]
        
        # Prepare save directory
        if not save_dir:
            if session_id:
                save_dir = os.path.join(self.base_save_dir, session_id)
            else:
                save_dir = self.base_save_dir
        os.makedirs(save_dir, exist_ok=True)
        
        generated_local_paths = []

        if provider == "ark":
            # --- Seedream Logic ---
            logger.info("ImageClient routed to Seedream: model=%s", model)
            paths = self.seedream_client.generate_image(
                prompt=prompt,
                model=model,
                session_id=session_id or "default",
                size=size or "2048*2048",
                image_paths=image_paths,
                save_dir=save_dir,
            )
            generated_local_paths.extend(paths or [])

        elif provider == "dashscope":
            # --- DashScope Logic ---
            logger.info("ImageClient routed to DashScope: model=%s", model)

            if image_paths and len(image_paths) > 0:
                # DashScope SDK handles local file:// references.
                formatted_urls = []
                for p in image_paths:
                    if p.startswith("http") or p.startswith("file://"):
                        formatted_urls.append(p)
                    else:
                        abs_path = absolute_path(p)
                        formatted_urls.append(f"file://{abs_path}")

                paths = self.dashscope_client.edit_image(
                    prompt=prompt,
                    image_urls=formatted_urls,
                    model=model,
                    size=size,
                    session_id=session_id,
                    save_dir=save_dir
                )
            else:
                # Text to Image
                paths = self.dashscope_client.generate_image(
                    prompt=prompt,
                    model=model,
                    size=size,
                    session_id=session_id,
                    save_dir=save_dir
                )
            generated_local_paths.extend(paths or [])
        else:
            raise ValueError(f"图片模型平台不受支持: {provider}")

        if not generated_local_paths:
            raise RuntimeError(f"图片生成没有返回结果: model={model}")
        return generated_local_paths
