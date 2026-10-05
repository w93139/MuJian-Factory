"""
Seedream 图像生成 API 客户端
字节跳动 ARK - doubao-seedream-5-0-260128 模型
"""

import logging
import os
import time
from typing import Dict, List, Optional

import httpx
import requests
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI

from config import Config
from usage import billable_request

# 模型名称映射表（旧名称 -> 新名称）
MODEL_NAME_MAP: Dict[str, str] = {
    # doubao-seedream-5-0 系列
    "doubao-seedream-5-0": "doubao-seedream-5-0-260128",
    # doubao-seedream-4-5 系列
    "doubao-seedream-4-5": "doubao-seedream-4-5-251128",
    # doubao-seedream-4-0 系列
    "doubao-seedream-4-0": "doubao-seedream-4-0-250828",
}


def normalize_model_name(model: str) -> str:
    """
    规范化模型名称

    Args:
        model: 传入的模型名称

    Returns:
        规范化后的模型名称
    """
    return MODEL_NAME_MAP.get(model, model)


class SeedreamClient:
    """
    Seedream 图像生成客户端（字节跳动 ARK）
    支持文生图功能
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout: int = 120,
    ) -> None:
        """
        初始化 Seedream 客户端

        Args:
            api_key: ARK API Key
            base_url: ARK API 基础 URL
            timeout: HTTP请求超时时间（秒）
        """
        self.api_key = api_key or Config.ARK_API_KEY
        self.base_url = base_url or Config.ARK_BASE_URL or "https://ark.cn-beijing.volces.com/api/v3"
        self.timeout = timeout

        if not self.api_key:
            logging.warning(
                "SeedreamClient missing api_key. Set ARK_API_KEY."
            )

        kwargs = {
            "base_url": self.base_url,
            "api_key": self.api_key,
            "timeout": timeout,
            "max_retries": 0,
        }
        proxy = Config.provider_proxy("ark")
        if proxy:
            kwargs["http_client"] = httpx.Client(proxy=proxy, timeout=timeout)
        self.client = OpenAI(**kwargs)

    @staticmethod
    def _retryable(exc: Exception) -> bool:
        if isinstance(exc, APIStatusError):
            return exc.status_code == 429 or exc.status_code >= 500
        if isinstance(exc, requests.HTTPError):
            status = exc.response.status_code if exc.response is not None else None
            return status == 429 or (status is not None and status >= 500)
        return isinstance(exc, (
            APITimeoutError, APIConnectionError, httpx.TimeoutException,
            requests.Timeout, requests.ConnectionError,
        ))

    def _with_retry(self, action: str, operation):
        for attempt in range(4):
            try:
                return operation()
            except Exception as exc:
                if not self._retryable(exc) or attempt == 3:
                    raise
                delay = 2 ** attempt
                logging.warning("Seedream %s 失败，%s 秒后重试（%s/3）：%s", action, delay, attempt + 1, type(exc).__name__)
                time.sleep(delay)

    def generate_image(
        self,
        prompt: str,
        session_id: str,
        model: str = "doubao-seedream-4-5-251128",
        size: str = "1920*1080",
        image_paths: Optional[List[str]] = None,
        save_dir: Optional[str] = None,
        **kwargs
    ) -> List[str]:
        """
        生成图片

        Args:
            prompt: 提示词
            session_id: 任务或会话ID，用于构建存储路径
            model: 模型名称
            size: 生成图片的分辨率，如 "1920*1080", "1024*1024"
            image_paths: 参考图路径或URL列表 (图生图)
            save_dir: 图片保存目录；未传入时按 session_id 保存
            **kwargs: 其他生成参数

        Returns:
            生成的图片路径列表
        """
        if not self.api_key:
            raise RuntimeError("ARK_API_KEY not set.")

        # 规范化模型名称（旧名称 -> 新名称）
        model = normalize_model_name(model)

        # 处理分辨率 (Seedream 要求至少 3686400 像素)
        # 常用 2K/4K 分辨率
        size_map = {
            # 16:9
            "1920*1080": (1920, 1080),
            "2048*1080": (2048, 1080),  # 2K 电影
            "2560*1440": (2560, 1440),  # 2K QHD
            "3840*2160": (3840, 2160),  # 4K UHD
            "4096*2160": (4096, 2160),  # 4K 电影
            # 9:16
            "1080*1920": (1080, 1920),
            "1080*2048": (1080, 2048),
            "1440*2560": (1440, 2560),
            "2160*3840": (2160, 3840),
            "2160*4096": (2160, 4096),
            # 1:1
            "1024*1024": (1024, 1024),
            "2048*2048": (2048, 2048),  # 2K 正方
            # 4:3
            "1920*1440": (1920, 1440),
            "2560*1920": (2560, 1920),
            # 3:4
            "1440*1920": (1440, 1920),
            "1920*2560": (1920, 2560),
        }

        width, height = 1920, 1080  # 默认
        modern = model in {"doubao-seedream-5-0-pro-260628", "doubao-seedream-5-0-flash-260915"}
        min_pixels = 921600 if modern else 3686400

        if size:
            parts = size.split("*")
            if len(parts) == 2:
                w, h = int(parts[0]), int(parts[1])
                width, height = w, h

        if width <= 0 or height <= 0:
            raise ValueError("图片尺寸必须为正数")
        if modern and (not min_pixels <= width * height <= 4624220 or not 1 / 16 <= width / height <= 16):
            raise ValueError("Seedream 5 Pro/Flash 图片需为 921600–4624220 像素，比例在 1:16–16:1 内")
        if modern and len(image_paths or []) > 10:
            raise ValueError("Seedream 5 Pro/Flash 最多支持 10 张参考图")

        # 确保满足最小像素要求
        if width * height < min_pixels:
            # 查找相同宽高比的常用分辨率
            aspect_ratio = width / height
            for (w, h) in size_map.values():
                if abs(w / h - aspect_ratio) < 0.01 and w * h >= min_pixels:
                    width, height = w, h
                    break
            else:
                # 没有找到合适的，按比例放大
                scale = (min_pixels / (width * height)) ** 0.5
                width = int(width * scale)
                height = int(height * scale)
                width = width if width % 2 == 0 else width + 1
                height = height if height % 2 == 0 else height + 1

        # 构建 extra_body
        extra_body = {"watermark": False}
        if not modern:
            extra_body["sequential_image_generation"] = "disabled"

        # 添加其他参数
        if "seed" in kwargs:
            extra_body["seed"] = kwargs["seed"]
        if "quality" in kwargs:
            extra_body["quality"] = kwargs["quality"]
        if "style" in kwargs:
            extra_body["style"] = kwargs["style"]

        # 处理参考图 (图生图)
        if image_paths and len(image_paths) > 0:
            # 处理参考图：支持 URL 和本地文件
            ref_images = []
            for p in image_paths:
                if p.startswith("http"):
                    ref_images.append(p)
                elif os.path.exists(p):
                    # 转换为 base64 URL
                    import base64
                    with open(p, "rb") as f:
                        img_data = base64.b64encode(f.read()).decode("utf-8")
                    ext = os.path.splitext(p)[1].lower()
                    mime = "image/png" if ext == ".png" else "image/jpeg"
                    ref_images.append(f"data:{mime};base64,{img_data}")
                else:
                    logging.warning("Seedream 参考图不存在，已跳过: %s", p)
            if not ref_images:
                raise ValueError("Seedream 参考图均不可用，已取消图生图请求")
            extra_body["image"] = ref_images

        # 调用 API
        with billable_request(model, images=1, input_images=len(extra_body.get("image", []))):
            response = self.client.images.generate(
                model=model,
                prompt=prompt,
                size=f"{width}x{height}",
                response_format="url",
                extra_body=extra_body,
            )

        # 下载图片到本地
        generated_paths = []
        if response.data:
            for idx, img_data in enumerate(response.data):
                if img_data.url:
                    local_path = self._download_image(
                        img_data.url, session_id, idx, save_dir=save_dir
                    )
                    if local_path:
                        generated_paths.append(local_path)

        if not generated_paths:
            raise RuntimeError("Seedream 图片生成成功但没有返回可保存的图片")
        return generated_paths

    def _download_image(self, url: str, session_id: str, idx: int, save_dir: Optional[str] = None) -> str:
        """从URL下载图片到本地"""

        # 构建存储路径
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        result_dir = save_dir or os.path.join(base_dir, "code", "result", "image", str(session_id))
        os.makedirs(result_dir, exist_ok=True)

        file_name = f"seedream_{int(time.time())}_{idx}.png"
        file_path = os.path.join(result_dir, file_name)

        def download():
            response = requests.get(url, timeout=self.timeout, proxies=Config.requests_proxies("ark"))
            response.raise_for_status()
            with open(file_path, "wb") as f:
                f.write(response.content)
            return file_path

        return self._with_retry("图片下载", download)


if __name__ == "__main__":
    import sys

    from config import Config

    print("=== Seedream 可用性测试 ===")
    api_key = Config.ARK_API_KEY
    base_url = Config.ARK_BASE_URL
    if not api_key:
        print("✗ ARK_API_KEY 未设置，跳过")
        sys.exit(1)
    print(f"  Base URL: {base_url}")

    client = SeedreamClient(api_key=api_key, base_url=base_url)

    # === 测试1: 文生图 ===
    prompt = "星际穿越，黑洞，黑洞里冲出一辆支离破碎的复古列车，视觉冲击力，电影大片，末日既视感"
    print(f"\n[测试1: 文生图] Prompt: {prompt}")
    t0 = time.time()
    try:
        paths = client.generate_image(
            prompt=prompt,
            session_id="test_avail",
            model="doubao-seedream-5-0-260128",
            size="1920*1080",
        )
        elapsed = time.time() - t0
        if paths:
            print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
        else:
            print(f"✗ 返回空列表 ({elapsed:.1f}s)")
    except Exception as e:
        print(f"✗ 图片生成失败: {e}")

    # === 测试2: 图生图 ===
    # 需要一张已有的参考图路径
    ref_image_path = "code/result/image/test_avail/test_input.png"
    if os.path.exists(ref_image_path):
        prompt_i2i = "将这只猫变成赛博朋克风格"
        print(f"\n[测试2: 图生图] Prompt: {prompt_i2i}")
        print(f"  参考图: {ref_image_path}")
        t0 = time.time()
        try:
            paths = client.generate_image(
                prompt=prompt_i2i,
                session_id="test_avail",
                model="doubao-seedream-5-0-260128",
                size="1920*1080",
                image_paths=[ref_image_path],
            )
            elapsed = time.time() - t0
            if paths:
                print(f"✓ 生成 {len(paths)} 张图片 ({elapsed:.1f}s): {paths}")
            else:
                print(f"✗ 返回空列表 ({elapsed:.1f}s)")
        except Exception as e:
            print(f"✗ 图生图失败: {e}")
    else:
        print(f"\n[测试2: 图生图] ✗ 参考图不存在: {ref_image_path}")
        print("  跳过图生图测试，请先运行文生图测试生成参考图")
