"""OpenAI-compatible text and vision requests for configured providers."""

import base64
import logging
import mimetypes
from pathlib import Path

import httpx
from openai import OpenAI

from config import Config
from models.config_model import get_model_config
from path_utils import absolute_path
from usage import billable_request

logger = logging.getLogger(__name__)


class ChatClient:
    def _provider_connection(self, provider: str) -> tuple[str, str]:
        if provider == "dashscope":
            return Config.DASHSCOPE_API_KEY, Config.DASHSCOPE_COMPATIBLE_BASE_URL
        if provider == "ark":
            return Config.ARK_API_KEY, Config.ARK_BASE_URL
        if provider == "openai_compatible":
            return Config.OPENAI_COMPAT_API_KEY, Config.OPENAI_COMPAT_BASE_URL
        raise ValueError(f"不支持的文本模型平台: {provider}")

    @staticmethod
    def _image_url(path_or_url: str) -> str:
        if path_or_url.startswith(("data:", "http://", "https://")):
            return path_or_url
        path = Path(absolute_path(path_or_url.removeprefix("file://")))
        if not path.is_file():
            raise FileNotFoundError(f"视觉理解图片不存在: {path_or_url}")
        mime_type = mimetypes.guess_type(path.name)[0] or "image/jpeg"
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime_type};base64,{encoded}"

    def query(
        self,
        prompt: str,
        model: str,
        image_urls: list[str] | None = None,
        *,
        web_search: bool = False,
        disable_thinking: bool = False,
        max_tokens: int = 4096,
        temperature: float | None = None,
        response_format: dict | None = None,
    ) -> str:
        model_info = get_model_config(model)
        if model_info.get("available") is False:
            raise ValueError(f"该账号尚未开通此模型：{model}")
        if web_search and model_info.get("supports_search") is False:
            raise ValueError(f"该模型不支持联网搜索，请关闭联网搜索：{model}")
        provider = model_info["provider"]
        if not set(model_info.get("type", [])) & {"llm", "vlm"}:
            raise ValueError(f"模型不支持文本或视觉理解: {model}")
        api_key, base_url = self._provider_connection(provider)
        if not api_key or not base_url:
            raise ValueError(f"{provider} 尚未配置 API Key 或地址")

        images = [self._image_url(url) for url in image_urls or []]
        if images and "vlm" not in model_info.get("type", []):
            raise ValueError(f"模型不支持视觉理解: {model}")
        content = prompt if not images else [
            {"type": "text", "text": prompt},
            *({"type": "image_url", "image_url": {"url": url}} for url in images),
        ]
        request = {
            "model": model,
            "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens,
        }
        if response_format is not None:
            if images and response_format.get("type") == "json_schema":
                raise ValueError("视觉结构化输出请使用 json_object 并在本地校验")
            request["response_format"] = response_format
        if temperature is not None:
            request["temperature"] = temperature
        if provider == "dashscope":
            extra_body = {}
            if web_search:
                extra_body["enable_search"] = True
            if disable_thinking or model_info.get("default_disable_thinking"):
                extra_body["enable_thinking"] = False
            if extra_body:
                request["extra_body"] = extra_body

        proxy = Config.provider_proxy(provider)
        timeout = Config.REQUEST_TIMEOUT
        client_kwargs = {
            "api_key": api_key,
            "base_url": base_url,
            "timeout": timeout,
            "max_retries": 0,
        }
        if proxy:
            client_kwargs["http_client"] = httpx.Client(proxy=proxy, timeout=timeout)
        client = OpenAI(**client_kwargs)
        try:
            # UTF-8 bytes conservatively bound text tokens; reserve image tokens
            # separately, and include the full requested output (including reasoning).
            with billable_request(
                model, input_tokens=len(prompt.encode("utf-8")) + 256 + len(images) * 32768,
                output_tokens=max_tokens,
            ):
                response = client.chat.completions.create(**request)
            choices = getattr(response, "choices", None) or []
            content = getattr(getattr(choices[0], "message", None), "content", None) if choices else None
            if not isinstance(content, str) or not content.strip():
                raise RuntimeError("模型返回空内容，请检查后手动重试")
            return content
        finally:
            client.close()
