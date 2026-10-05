import copy
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.yaml"
CONFIG_EXAMPLE_PATH = BASE_DIR / "config.yaml.example"
SECRET_MASK = "********"
SECRET_PATHS = (
    "api_providers.dashscope.api_key",
    "api_providers.ark.api_key",
    "api_providers.openai_compatible.api_key",
)
ENV_CONFIG_PATHS = {
    "DASHSCOPE_API_KEY": "api_providers.dashscope.api_key",
    "ARK_API_KEY": "api_providers.ark.api_key",
    "OPENAI_COMPAT_API_KEY": "api_providers.openai_compatible.api_key",
    "OPENAI_COMPAT_BASE_URL": "api_providers.openai_compatible.base_url",
}

DEFAULT_CONFIG: Dict[str, Any] = {
    "project_name": "Mujian",
    "server": {
        "host": "127.0.0.1",
        "port": 8000,
        "log_level": "INFO",
        "access_log": False,
    },
    "api_providers": {
        "common": {
            "print_model_input": False,
            "unavailable_models": [],
            "proxy": "",
            "request_timeout": 180,
        },
        "dashscope": {
            "api_key": "",
            "base_url": "https://dashscope.aliyuncs.com/api/v1",
            "compatible_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        },
        "ark": {
            "api_key": "",
            "base_url": "https://ark.cn-beijing.volces.com/api/v3",
        },
        "openai_compatible": {
            "display_name": "",
            "api_key": "",
            "base_url": "",
            "models": [],
        },
    },
    "models": {
        "llm": "qwen3.8-flash",
        "vlm": "qwen3.5-plus",
        "image_it2i": "wan2.7-image",
        "image_t2i": "wan2.7-image",
        "video_first_frame": "wan2.7-i2v",
        "video_start_end": "wan2.7-i2v",
        "video_reference": "wan2.7-r2v",
    },
    "generation": {
        "style": "realistic",
        "video_ratio": "16:9",
        "video_resolution": "720P",
        "video_generation_mode": "first_frame",
    },
}


def _deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    merged = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(merged.get(key), dict):
            merged[key] = _deep_merge(merged[key], value)
        else:
            merged[key] = value
    return merged


def _get(data: Dict[str, Any], path: str, default: Any = None) -> Any:
    current: Any = data
    for part in path.split("."):
        if not isinstance(current, dict) or part not in current:
            return default
        current = current[part]
    return current


def _set(data: Dict[str, Any], path: str, value: Any) -> None:
    current = data
    parts = path.split(".")
    for part in parts[:-1]:
        child = current.get(part)
        if not isinstance(child, dict):
            child = {}
            current[part] = child
        current = child
    current[parts[-1]] = value


def redact_config(values: Dict[str, Any]) -> Dict[str, Any]:
    public = copy.deepcopy(values)
    for path in SECRET_PATHS:
        _set(public, path, SECRET_MASK if _get(values, path) else "")
    return public


def merge_config_update(current: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(updates, dict):
        raise ValueError("Configuration update must be a mapping.")

    clean_updates = copy.deepcopy(updates)
    for path in SECRET_PATHS:
        if _get(clean_updates, path, None) == SECRET_MASK:
            _set(clean_updates, path, _get(current, path, ""))
    return _deep_merge(current, clean_updates)


def _coerce_config(data: Dict[str, Any]) -> Dict[str, Any]:
    unknown: list[str] = []

    def known_values(source: Dict[str, Any], defaults: Dict[str, Any], prefix: str = "") -> Dict[str, Any]:
        result = {}
        for key, value in source.items():
            path = f"{prefix}.{key}" if prefix else key
            if key not in defaults:
                unknown.append(path)
            elif isinstance(defaults[key], dict):
                if isinstance(value, dict):
                    result[key] = known_values(value, defaults[key], path)
                else:
                    unknown.append(path)
            elif isinstance(defaults[key], list):
                if isinstance(value, list):
                    result[key] = value
                else:
                    unknown.append(path)
            elif isinstance(value, (dict, list)):
                unknown.append(path)
            else:
                result[key] = value
        return result

    clean = _deep_merge(DEFAULT_CONFIG, known_values(data, DEFAULT_CONFIG))
    if unknown:
        logger.warning("Ignoring unknown configuration fields: %s", ", ".join(unknown))

    server = clean["server"]
    server["host"] = str(server.get("host") or DEFAULT_CONFIG["server"]["host"])
    try:
        server["port"] = int(server.get("port"))
    except (TypeError, ValueError):
        server["port"] = DEFAULT_CONFIG["server"]["port"]
    server["log_level"] = _normalize_log_level(server.get("log_level"))
    server["access_log"] = _as_bool(server.get("access_log"))

    common = clean["api_providers"]["common"]
    common["print_model_input"] = _as_bool(common.get("print_model_input"))
    common["proxy"] = str(common.get("proxy") or "")
    try:
        common["request_timeout"] = max(1, int(common.get("request_timeout")))
    except (TypeError, ValueError):
        common["request_timeout"] = DEFAULT_CONFIG["api_providers"]["common"]["request_timeout"]

    for key, value in clean["models"].items():
        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                value[sub_key] = "" if sub_value is None else str(sub_value)
        else:
            clean["models"][key] = "" if value is None else str(value)

    for key, value in clean["generation"].items():
        clean["generation"][key] = "" if value is None else str(value)

    for provider, values in clean["api_providers"].items():
        if provider == "common":
            continue
        for key, value in values.items():
            if provider == "openai_compatible" and key == "models":
                values[key] = [
                    {
                        "id": str(item.get("id") or ""),
                        "type": [str(kind) for kind in item.get("type", [])] if isinstance(item.get("type"), list) else [],
                        "name": str(item.get("name") or ""),
                    }
                    for item in value
                    if isinstance(item, dict) and item.get("id")
                ]
                continue
            values[key] = "" if value is None else str(value)

    return clean


def _as_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _normalize_log_level(value: Any) -> str:
    allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
    normalized = str(value or DEFAULT_CONFIG["server"]["log_level"]).strip().upper()
    return normalized if normalized in allowed else DEFAULT_CONFIG["server"]["log_level"]


def _with_env_overrides(values: Dict[str, Any]) -> Dict[str, Any]:
    effective = copy.deepcopy(values)
    for variable, path in ENV_CONFIG_PATHS.items():
        if variable in os.environ:
            _set(effective, path, os.environ[variable])
    return effective


def load_config(*, apply_env: bool = True) -> Dict[str, Any]:
    if not CONFIG_PATH.exists():
        source = CONFIG_EXAMPLE_PATH if CONFIG_EXAMPLE_PATH.exists() else None
        if source:
            with source.open("r", encoding="utf-8") as f:
                loaded = yaml.safe_load(f) or {}
            clean = _coerce_config(loaded)
        else:
            clean = copy.deepcopy(DEFAULT_CONFIG)
        return _with_env_overrides(clean) if apply_env else clean

    with CONFIG_PATH.open("r", encoding="utf-8") as f:
        loaded = yaml.safe_load(f) or {}
    if not isinstance(loaded, dict):
        raise ValueError("backend/config.yaml must contain a YAML mapping.")
    clean = _coerce_config(loaded)
    return _with_env_overrides(clean) if apply_env else clean


def save_config(values: Dict[str, Any]) -> Dict[str, Any]:
    clean = _coerce_config(values)
    fd, temp_path = tempfile.mkstemp(dir=CONFIG_PATH.parent, prefix="config.", suffix=".yaml.tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            yaml.safe_dump(clean, f, allow_unicode=True, sort_keys=False)
        os.replace(temp_path, CONFIG_PATH)
    except Exception:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    return clean


CONFIG_VALUES = load_config()


class Config:
    CONFIG = CONFIG_VALUES

    HOST = _get(CONFIG, "server.host")
    PORT = _get(CONFIG, "server.port")
    LOG_LEVEL = _get(CONFIG, "server.log_level")
    DEBUG = LOG_LEVEL == "DEBUG"
    ACCESS_LOG = _get(CONFIG, "server.access_log")

    PRINT_MODEL_INPUT = _get(CONFIG, "api_providers.common.print_model_input")
    PROXY = _get(CONFIG, "api_providers.common.proxy")
    REQUEST_TIMEOUT = _get(CONFIG, "api_providers.common.request_timeout")

    DASHSCOPE_API_KEY = _get(CONFIG, "api_providers.dashscope.api_key")
    DASHSCOPE_BASE_URL = _get(CONFIG, "api_providers.dashscope.base_url")
    DASHSCOPE_COMPATIBLE_BASE_URL = _get(CONFIG, "api_providers.dashscope.compatible_base_url")
    ARK_API_KEY = _get(CONFIG, "api_providers.ark.api_key")
    ARK_BASE_URL = _get(CONFIG, "api_providers.ark.base_url")
    OPENAI_COMPAT_API_KEY = _get(CONFIG, "api_providers.openai_compatible.api_key")
    OPENAI_COMPAT_BASE_URL = _get(CONFIG, "api_providers.openai_compatible.base_url")
    LLM_MODEL = _get(CONFIG, "models.llm")
    VLM_MODEL = _get(CONFIG, "models.vlm")
    IMAGE_IT2I_MODEL = _get(CONFIG, "models.image_it2i")
    IMAGE_T2I_MODEL = _get(CONFIG, "models.image_t2i")
    VIDEO_FIRST_FRAME_MODEL = _get(CONFIG, "models.video_first_frame")
    VIDEO_START_END_MODEL = _get(CONFIG, "models.video_start_end")
    VIDEO_REFERENCE_MODEL = _get(CONFIG, "models.video_reference")
    VIDEO_RATIO = _get(CONFIG, "generation.video_ratio")
    VIDEO_RESOLUTION = _get(CONFIG, "generation.video_resolution")
    VIDEO_GENERATION_MODE = _get(CONFIG, "generation.video_generation_mode")
    STYLE = _get(CONFIG, "generation.style")

    BASE_DIR = str(BASE_DIR)
    CODE_DIR = os.path.join(BASE_DIR, "code")
    RESULT_DIR = os.path.join(CODE_DIR, "result")
    TEMP_DIR = os.path.join(BASE_DIR, "temp")
    SESSION_DIR = os.path.join(CODE_DIR, "data", "sessions")
    TASK_DIR = os.path.join(CODE_DIR, "data", "tasks")
    TASK_RESULT_DIR = os.path.join(RESULT_DIR, "task")

    @classmethod
    def as_dict(cls) -> Dict[str, Any]:
        return copy.deepcopy(cls.CONFIG)

    @classmethod
    def as_public_dict(cls) -> Dict[str, Any]:
        return redact_config(cls.CONFIG)

    @classmethod
    def provider_config(cls, provider: str) -> Dict[str, Any]:
        """Return the effective settings for a supported provider."""
        if provider not in {"dashscope", "ark", "openai_compatible"}:
            raise ValueError(f"Unsupported provider: {provider}")
        return copy.deepcopy(_get(cls.CONFIG, f"api_providers.{provider}", {}))

    @classmethod
    def provider_proxy(cls, provider: str) -> str:
        if provider not in {"dashscope", "ark", "openai_compatible"}:
            return ""
        return cls.PROXY or ""

    @classmethod
    def requests_proxies(cls, provider: str) -> Optional[Dict[str, str]]:
        proxy = cls.provider_proxy(provider)
        if not proxy:
            return None
        return {"http": proxy, "https": proxy}

    @classmethod
    def update_config(cls, values: Dict[str, Any]) -> Dict[str, Any]:
        clean = save_config(merge_config_update(load_config(apply_env=False), values))
        cls.CONFIG = _with_env_overrides(clean)
        effective = cls.CONFIG

        cls.HOST = _get(effective, "server.host")
        cls.PORT = _get(effective, "server.port")
        cls.LOG_LEVEL = _get(effective, "server.log_level")
        cls.DEBUG = cls.LOG_LEVEL == "DEBUG"
        cls.ACCESS_LOG = _get(effective, "server.access_log")

        cls.PRINT_MODEL_INPUT = _get(effective, "api_providers.common.print_model_input")
        cls.PROXY = _get(effective, "api_providers.common.proxy")
        cls.REQUEST_TIMEOUT = _get(effective, "api_providers.common.request_timeout")

        cls.DASHSCOPE_API_KEY = _get(effective, "api_providers.dashscope.api_key")
        cls.DASHSCOPE_BASE_URL = _get(effective, "api_providers.dashscope.base_url")
        cls.DASHSCOPE_COMPATIBLE_BASE_URL = _get(effective, "api_providers.dashscope.compatible_base_url")
        cls.ARK_API_KEY = _get(effective, "api_providers.ark.api_key")
        cls.ARK_BASE_URL = _get(effective, "api_providers.ark.base_url")
        cls.OPENAI_COMPAT_API_KEY = _get(effective, "api_providers.openai_compatible.api_key")
        cls.OPENAI_COMPAT_BASE_URL = _get(effective, "api_providers.openai_compatible.base_url")

        cls.LLM_MODEL = _get(effective, "models.llm")
        cls.VLM_MODEL = _get(effective, "models.vlm")
        cls.IMAGE_IT2I_MODEL = _get(effective, "models.image_it2i")
        cls.IMAGE_T2I_MODEL = _get(effective, "models.image_t2i")
        cls.VIDEO_FIRST_FRAME_MODEL = _get(effective, "models.video_first_frame")
        cls.VIDEO_START_END_MODEL = _get(effective, "models.video_start_end")
        cls.VIDEO_REFERENCE_MODEL = _get(effective, "models.video_reference")
        cls.VIDEO_RATIO = _get(effective, "generation.video_ratio")
        cls.VIDEO_RESOLUTION = _get(effective, "generation.video_resolution")
        cls.VIDEO_GENERATION_MODE = _get(effective, "generation.video_generation_mode")
        cls.STYLE = _get(effective, "generation.style")
        return cls.as_dict()

    @classmethod
    def check_dirs(cls):
        data_dir = os.path.join(cls.CODE_DIR, "data")
        for directory in [
            cls.CODE_DIR,
            data_dir,
            cls.SESSION_DIR,
            cls.TASK_DIR,
            cls.RESULT_DIR,
            cls.TASK_RESULT_DIR,
            cls.TEMP_DIR,
        ]:
            if not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                logger.info("Created directory: %s", directory)


Config.check_dirs()
settings = Config()
