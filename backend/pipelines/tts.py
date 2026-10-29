import asyncio
import math
import os
import uuid
from pathlib import Path
from typing import Optional

import requests

from config import Config
from models.config_model import ensure_model_available
from usage import billable_request


def validate_tts_options(model: str, voice: str, speed: float) -> None:
    if model == "edge-tts":
        return
    metadata = ensure_model_available(model)
    if "tts" not in metadata.get("type", []) or metadata.get("provider") != "dashscope":
        raise ValueError("当前未适配该配音模型")
    if voice not in metadata["capabilities"]["voices"]:
        raise ValueError("请选择该配音模型支持的音色")
    if not math.isfinite(speed) or not 0.5 <= speed <= 2:
        raise ValueError("配音语速必须在 0.5 至 2 之间")


def _generate_dashscope_tts(text: str, output_path: str, voice: str, speed: float, model: str) -> str:
    validate_tts_options(model, voice, speed)
    if not text.strip() or len(text) > 5000:
        raise ValueError("单段配音文字须为 1 至 5000 字符")
    if not Config.DASHSCOPE_API_KEY:
        raise ValueError("阿里云百炼尚未配置 API Key")
    headers = {"Authorization": f"Bearer {Config.DASHSCOPE_API_KEY}", "Content-Type": "application/json"}
    payload = {"model": model, "input": {"text": text, "voice": voice, "format": "mp3",
                                        "sample_rate": 24000, "rate": speed}}
    # Each CJK character can count twice. Doubling every code point safely
    # over-reserves punctuation/ASCII too; no reasoning/output token charges.
    with billable_request(model, input_tokens=2 * len(text), output_tokens=0):
        response = requests.post(
            Config.DASHSCOPE_BASE_URL.rstrip("/") + "/services/audio/tts/SpeechSynthesizer",
            headers=headers, json=payload, timeout=Config.REQUEST_TIMEOUT,
            proxies=Config.requests_proxies("dashscope"),
        )
        if not response.ok:
            raise RuntimeError(f"百炼配音提交失败（HTTP {response.status_code}）")
        url = response.json().get("output", {}).get("audio", {}).get("url")
        if not isinstance(url, str) or not url.startswith(("https://", "http://")):
            raise RuntimeError("百炼配音没有返回有效音频")
        audio = requests.get(url, timeout=Config.REQUEST_TIMEOUT, proxies=Config.requests_proxies("dashscope"))
        if not audio.ok or not audio.content:
            raise RuntimeError("百炼配音下载失败")
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(path.name + f".{uuid.uuid4().hex}.tmp")
        try:
            temporary.write_bytes(audio.content)
            os.replace(temporary, path)
        finally:
            temporary.unlink(missing_ok=True)
    return output_path


def speed_to_rate(speed: Optional[float]) -> str:
    value = 1.0 if speed is None else float(speed)
    percent = int(round((value - 1.0) * 100))
    sign = "+" if percent >= 0 else ""
    return f"{sign}{percent}%"


async def generate_edge_tts(
    text: str,
    output_path: str,
    voice: str = "zh-CN-YunjianNeural",
    speed: float = 1.0,
    model: str = "edge-tts",
) -> str:
    # Keep the legacy entry point for existing tasks; opt in to paid TTS only
    # when the new explicit request field selects a supported provider model.
    if model != "edge-tts":
        return await asyncio.to_thread(_generate_dashscope_tts, text, output_path, voice, speed, model)
    try:
        import edge_tts
    except ImportError as exc:
        raise RuntimeError("edge-tts is required for audio generation. Install backend dependencies again.") from exc

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=speed_to_rate(speed))
    await communicate.save(output_path)
    return output_path
