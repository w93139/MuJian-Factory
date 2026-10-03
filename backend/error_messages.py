"""Remove configured credentials before exposing provider failures to users."""

import os
import re

from config import settings


def safe_error_text(error: BaseException | str) -> str:
    message = str(error)
    values = (
        settings.DASHSCOPE_API_KEY,
        settings.ARK_API_KEY,
        settings.OPENAI_COMPAT_API_KEY,
        *(os.environ.get(name, "") for name in (
            "DASHSCOPE_API_KEY", "ARK_API_KEY", "OPENAI_COMPAT_API_KEY",
        )),
    )
    for value in values:
        if value and len(value) >= 4:
            message = message.replace(value, "[已隐藏密钥]")
    message = re.sub(r"(?i)\bBearer\s+\S+", "Bearer [已隐藏密钥]", message)
    message = re.sub(r"(?i)(\b(?:api[_-]?key|secret|token)\s*[=:]\s*)[^\s,;]+", r"\1[已隐藏密钥]", message)
    return message
