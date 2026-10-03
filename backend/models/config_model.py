"""Central model registry.

All backend model metadata is registered in this file, including provider,
model type, concurrency, pricing, and API capability tags.
"""

import logging
from copy import deepcopy
from typing import Any, Optional

from config import Config

logger = logging.getLogger(__name__)

MODEL_CONFIG: dict[str, Any] = {'models': {'qwen3.7-max': {'name': 'Qwen 3.7 Max',
                            'provider': 'dashscope',
                            'family': 'qwen',
                            'type': ['llm'],
                            'concurrency': 10,
                            'price_per_1k_input_token': 0.006,
                            'price_per_1k_output_token': 0.024},
            'qwen3.7-plus': {'name': 'Qwen 3.7 Plus',
                             'provider': 'dashscope',
                             'family': 'qwen',
                             'type': ['llm', 'vlm'],
                             'concurrency': 10,
                             'price_per_1k_input_token': 0.0008,
                             'price_per_1k_output_token': 0.002},
            'qwen3.5-plus': {'name': 'Qwen 3.5 Plus',
                             'provider': 'dashscope',
                             'family': 'qwen',
                             'type': ['llm', 'vlm'],
                             'concurrency': 10,
                             'price_per_1k_input_token': 0.0008,
                             'price_per_1k_output_token': 0.002},
            'qwen3.6-max-preview': {'name': 'Qwen 3.6 Max Preview',
                                    'provider': 'dashscope',
                                    'family': 'qwen',
                                    'type': ['llm'],
                                    'concurrency': 10,
                                    'price_per_1k_input_token': 0.006,
                                    'price_per_1k_output_token': 0.024},
            'qwen3-max': {'name': 'Qwen 3 Max',
                          'provider': 'dashscope',
                          'family': 'qwen',
                          'type': ['llm'],
                          'concurrency': 10,
                          'price_per_1k_input_token': 0.006,
                          'price_per_1k_output_token': 0.024},
            'deepseek-v3.2': {'name': 'DeepSeek V3.2 (DashScope)',
                              'provider': 'dashscope',
                              'family': 'deepseek',
                              'type': ['llm'],
                              'concurrency': 10,
                              'price_per_1k_input_token': 0.002,
                              'price_per_1k_output_token': 0.008},
            'qwen3.6-plus': {'name': 'Qwen 3.6 Plus',
                             'provider': 'dashscope',
                             'family': 'qwen',
                             'type': ['llm', 'vlm'],
                             'concurrency': 10,
                             'price_per_1k_input_token': 0.0008,
                             'price_per_1k_output_token': 0.002},
            'qwen3.6-flash': {'name': 'Qwen 3.6 Flash',
                              'provider': 'dashscope',
                              'family': 'qwen',
                              'type': ['llm', 'vlm'],
                              'concurrency': 10,
                              'price_per_1k_input_token': 0.0001,
                              'price_per_1k_output_token': 0.0001},
            'kimi-k2.6': {'name': 'Kimi K2.6',
                          'provider': 'dashscope',
                          'family': 'kimi',
                          'type': ['llm', 'vlm'],
                          'concurrency': 10,
                          'price_per_1k_input_token': 0.001,
                          'price_per_1k_output_token': 0.003},
            'wan2.7-image': {'name': 'Wan 2.7 Image',
                             'provider': 'dashscope',
                             'family': 'wan',
                             'type': ['t2i', 'i2i'],
                             'concurrency': 5,
                             'price_per_image': 0.2,
                             'capabilities': {'ability_type': 'image_generation',
                                              'ability_types': ['text_to_image',
                                                                'image_to_image',
                                                                'reference_image'],
                                              'adapter_ability_types': ['text_to_image',
                                                                        'image_to_image',
                                                                        'reference_image'],
                                              'input_modalities': ['text', 'image'],
                                              'adapter_input_modalities': ['text', 'image'],
                                              'api_contract_verified': True,
                                              'resolutions': ['1K', '2K'],
                                              'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4']}},
            'wan2.7-image-pro': {'name': 'Wan 2.7 Image Pro',
                                 'provider': 'dashscope',
                                 'family': 'wan',
                                 'type': ['t2i', 'i2i'],
                                 'concurrency': 5,
                                 'price_per_image': 0.4,
                                 'capabilities': {'ability_type': 'image_generation',
                                                  'ability_types': ['text_to_image',
                                                                    'image_to_image',
                                                                    'reference_image',
                                                                    'high_quality'],
                                                  'adapter_ability_types': ['text_to_image',
                                                                            'image_to_image',
                                                                            'reference_image'],
                                                  'input_modalities': ['text', 'image'],
                                                  'adapter_input_modalities': ['text', 'image'],
                                                  'api_contract_verified': True,
                                                  'resolutions': ['1K', '2K', '4K'],
                                                  'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                                  'resolution_constraints': {'t2i': ['1K',
                                                                                     '2K',
                                                                                     '4K'],
                                                                             'i2i': ['1K', '2K']}}},
            'wan2.6-t2i': {'name': 'Wan 2.6 T2I',
                           'provider': 'dashscope',
                           'family': 'wan',
                           'type': ['t2i'],
                           'concurrency': 5,
                           'price_per_image': 0.2,
                           'capabilities': {'ability_type': 'image_generation',
                                            'ability_types': ['text_to_image'],
                                            'adapter_ability_types': ['text_to_image'],
                                            'input_modalities': ['text'],
                                            'adapter_input_modalities': ['text'],
                                            'api_contract_verified': True,
                                            'resolutions': [],
                                            'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                            'size_format': 'custom_width_height'}},
            'doubao-seedream-5-0-260128': {'name': 'Seedream 5.0',
                                           'provider': 'ark',
                                           'family': 'seedream',
                                           'type': ['t2i', 'i2i'],
                                           'concurrency': 10,
                                           'price_per_image': 0.22,
                                           'capabilities': {'ability_type': 'image_generation',
                                                            'ability_types': ['text_to_image',
                                                                              'image_to_image',
                                                                              'reference_image',
                                                                              'high_quality'],
                                                            'adapter_ability_types': ['text_to_image',
                                                                                      'image_to_image',
                                                                                      'reference_image'],
                                                            'input_modalities': ['text', 'image'],
                                                            'adapter_input_modalities': ['text',
                                                                                         'image'],
                                                            'api_contract_verified': True,
                                                            'resolutions': ['2K', '3K', '4K'],
                                                            'ratios': ['16:9',
                                                                       '9:16',
                                                                       '1:1',
                                                                       '4:3',
                                                                       '3:4']}},
            'doubao-seedream-4-5-251128': {'name': 'Seedream 4.5',
                                           'provider': 'ark',
                                           'family': 'seedream',
                                           'type': ['t2i', 'i2i'],
                                           'concurrency': 10,
                                           'price_per_image': 0.25,
                                           'capabilities': {'ability_type': 'image_generation',
                                                            'ability_types': ['text_to_image',
                                                                              'image_to_image',
                                                                              'reference_image'],
                                                            'adapter_ability_types': ['text_to_image',
                                                                                      'image_to_image',
                                                                                      'reference_image'],
                                                            'input_modalities': ['text', 'image'],
                                                            'adapter_input_modalities': ['text',
                                                                                         'image'],
                                                            'api_contract_verified': True,
                                                            'resolutions': ['2K', '4K'],
                                                            'ratios': ['16:9',
                                                                       '9:16',
                                                                       '1:1',
                                                                       '4:3',
                                                                       '3:4']}},
            'doubao-seedream-4-0-250828': {'name': 'Seedream 4.0',
                                           'provider': 'ark',
                                           'family': 'seedream',
                                           'type': ['t2i', 'i2i'],
                                           'concurrency': 10,
                                           'price_per_image': 0.2,
                                           'capabilities': {'ability_type': 'image_generation',
                                                            'ability_types': ['text_to_image',
                                                                              'image_to_image',
                                                                              'reference_image'],
                                                            'adapter_ability_types': ['text_to_image',
                                                                                      'image_to_image',
                                                                                      'reference_image'],
                                                            'input_modalities': ['text', 'image'],
                                                            'adapter_input_modalities': ['text',
                                                                                         'image'],
                                                            'api_contract_verified': True,
                                                            'resolutions': ['1K', '2K', '4K'],
                                                            'ratios': ['16:9',
                                                                       '9:16',
                                                                       '1:1',
                                                                       '4:3',
                                                                       '3:4']}},
            'wan2.6-i2v-flash': {'name': 'Wan 2.6 I2V Flash',
                                 'provider': 'dashscope',
                                 'family': 'wan',
                                 'type': ['video'],
                                 'concurrency': 5,
                                 'price_per_second': 0.6,
                                 'capabilities': {'ability_type': 'image_to_video',
                                                  'ability_types': ['first_frame_i2v',
                                                                    'audio_driven_i2v',
                                                                    'multi_shot',
                                                                    'fast_generation'],
                                                  'adapter_ability_types': ['first_frame_i2v'],
                                                  'input_modalities': ['text', 'image', 'audio'],
                                                  'adapter_input_modalities': ['text', 'image'],
                                                  'duration': {'min': 2,
                                                               'max': 15,
                                                               'integer': True,
                                                               'verified': True},
                                                  'resolutions': ['720P', '1080P'],
                                                  'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                                  'api_contract_verified': True}},
            'wan2.7-i2v': {'name': 'Wan 2.7 I2V',
                           'provider': 'dashscope',
                           'family': 'wan',
                           'type': ['video'],
                           'concurrency': 5,
                           'price_per_second': 0.8,
                           'capabilities': {'ability_type': 'image_to_video',
                                            'ability_types': ['first_frame_i2v',
                                                              'start_end_frame_i2v',
                                                              'video_continuation',
                                                              'audio_driven_i2v',
                                                              'multi_shot'],
                                            'adapter_ability_types': ['first_frame_i2v',
                                                                      'start_end_frame_i2v',
                                                                      'audio_driven_i2v'],
                                            'input_modalities': ['text', 'image', 'audio', 'video'],
                                            'adapter_input_modalities': ['text', 'image'],
                                            'duration': {'min': 2,
                                                         'max': 15,
                                                         'integer': True,
                                                         'verified': True},
                                            'resolutions': ['720P', '1080P'],
                                            'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                            'api_contract_verified': True}},
            'happyhorse-1.0-i2v': {'name': 'Happy Horse 1.0 I2V',
                                   'provider': 'dashscope',
                                   'family': 'happyhorse',
                                   'type': ['video'],
                                   'concurrency': 5,
                                   'price_per_second': 1.0,
                                   'capabilities': {'ability_type': 'image_to_video',
                                                    'ability_types': ['first_frame_i2v',
                                                                      'native_audio'],
                                                    'adapter_ability_types': ['first_frame_i2v',
                                                                              'native_audio'],
                                                    'input_modalities': ['text', 'image'],
                                                    'adapter_input_modalities': ['text', 'image'],
                                                    'duration': {'min': 3,
                                                                 'max': 15,
                                                                 'integer': True,
                                                                 'verified': True},
                                                    'resolutions': ['720P', '1080P'],
                                                    'api_contract_verified': True}},
            'doubao-seedance-2-0-260128': {'name': 'Seedance 2.0',
                                           'provider': 'ark',
                                           'family': 'seedance',
                                           'type': ['video'],
                                           'concurrency': 10,
                                           'price_per_second': 0.99,
                                           'capabilities': {'ability_type': 'image_to_video',
                                                            'ability_types': ['text_to_video',
                                                                              'image_to_video'],
                                                            'adapter_ability_types': ['first_frame_i2v',
                                                                                      'native_audio'],
                                                            'input_modalities': ['text', 'image'],
                                                            'adapter_input_modalities': ['text',
                                                                                         'image'],
                                                            'duration': {'min': 4,
                                                                         'max': 15,
                                                                         'integer': True,
                                                                         'verified': True},
                                                            'resolutions': ['480p',
                                                                            '720p',
                                                                            '1080p',
                                                                            '4k'],
                                                            'ratios': ['16:9',
                                                                       '4:3',
                                                                       '1:1',
                                                                       '3:4',
                                                                       '9:16',
                                                                       '21:9',
                                                                       'adaptive'],
                                                            'api_contract_verified': True}},
            'doubao-seedance-2-0-fast-260128': {'name': 'Seedance 2.0 Fast',
                                                'provider': 'ark',
                                                'family': 'seedance',
                                                'type': ['video'],
                                                'concurrency': 10,
                                                'price_per_second': 0.8,
                                                'capabilities': {'ability_type': 'image_to_video',
                                                                 'ability_types': ['text_to_video',
                                                                                   'image_to_video',
                                                                                   'fast_generation'],
                                                                 'adapter_ability_types': ['first_frame_i2v',
                                                                                           'native_audio'],
                                                                 'input_modalities': ['text',
                                                                                      'image'],
                                                                 'adapter_input_modalities': ['text',
                                                                                              'image'],
                                                                 'duration': {'min': 4,
                                                                              'max': 15,
                                                                              'integer': True,
                                                                              'verified': True},
                                                                 'resolutions': ['480p', '720p'],
                                                                 'ratios': ['16:9',
                                                                            '4:3',
                                                                            '1:1',
                                                                            '3:4',
                                                                            '9:16',
                                                                            '21:9',
                                                                            'adaptive'],
                                                                 'api_contract_verified': True}},
            'wan2.7-r2v': {'name': 'Wan 2.7 R2V',
                           'provider': 'dashscope',
                           'family': 'wan',
                           'type': ['video'],
                           'concurrency': 5,
                           'price_per_second': 0.8,
                           'capabilities': {'ability_type': 'reference_to_video',
                                            'ability_types': ['reference_to_video',
                                                              'digital_human',
                                                              'multi_character',
                                                              'native_audio',
                                                              'voice_reference',
                                                              'multi_shot'],
                                            'adapter_ability_types': ['reference_to_video',
                                                                      'digital_human',
                                                                      'voice_reference'],
                                            'input_modalities': ['text', 'image', 'audio', 'video'],
                                            'adapter_input_modalities': ['text', 'image', 'audio'],
                                            'duration': {'min': 2,
                                                         'max': 10,
                                                         'integer': True,
                                                         'verified': True},
                                            'resolutions': ['720P', '1080P'],
                                            'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                            'api_contract_verified': True}},
            'wan2.7-videoedit': {'name': 'Wan 2.7 Video Edit',
                                 'provider': 'dashscope',
                                 'family': 'wan',
                                 'type': ['video'],
                                 'concurrency': 5,
                                 'price_per_second': 0.8,
                                 'capabilities': {'ability_type': 'video_editing',
                                                  'ability_types': ['video_editing',
                                                                    'action_transfer',
                                                                    'instruction_editing',
                                                                    'video_transfer'],
                                                  'adapter_ability_types': ['action_transfer',
                                                                            'video_editing'],
                                                  'input_modalities': ['text', 'image', 'video'],
                                                  'adapter_input_modalities': ['text',
                                                                               'image',
                                                                               'video'],
                                                  'duration': {'min': 2,
                                                               'max': 10,
                                                               'integer': True,
                                                               'verified': True},
                                                  'resolutions': ['720P', '1080P'],
                                                  'ratios': ['16:9', '9:16', '1:1', '4:3', '3:4'],
                                                  'api_contract_verified': True}},
            'happyhorse-1.0-r2v': {'name': 'Happy Horse 1.0 R2V',
                                   'provider': 'dashscope',
                                   'family': 'happyhorse',
                                   'type': ['video'],
                                   'concurrency': 5,
                                   'price_per_second': 1.0,
                                   'capabilities': {'ability_type': 'reference_to_video',
                                                    'ability_types': ['reference_to_video',
                                                                      'digital_human',
                                                                      'multi_character',
                                                                      'native_audio',
                                                                      'multi_shot'],
                                                    'adapter_ability_types': ['reference_to_video',
                                                                              'digital_human'],
                                                    'input_modalities': ['text', 'image'],
                                                    'adapter_input_modalities': ['text', 'image'],
                                                    'duration': {'min': 3,
                                                                 'max': 15,
                                                                 'integer': True,
                                                                 'verified': True},
                                                    'resolutions': ['720P', '1080P'],
                                                    'ratios': ['16:9', '9:16', '3:4', '4:3', '1:1'],
                                                    'api_contract_verified': True}},
            'happyhorse-1.0-video-edit': {'name': 'Happy Horse 1.0 Video Edit',
                                          'provider': 'dashscope',
                                          'family': 'happyhorse',
                                          'type': ['video'],
                                          'concurrency': 5,
                                          'price_per_second': 1.0,
                                          'capabilities': {'ability_type': 'video_editing',
                                                           'ability_types': ['video_editing',
                                                                             'action_transfer',
                                                                             'instruction_editing',
                                                                             'native_audio'],
                                                           'adapter_ability_types': ['action_transfer',
                                                                                     'video_editing'],
                                                           'input_modalities': ['text',
                                                                                'image',
                                                                                'video'],
                                                           'adapter_input_modalities': ['text',
                                                                                        'image',
                                                                                        'video'],
                                                           'duration': {'min': 3,
                                                                        'max': 15,
                                                                        'integer': True,
                                                                        'verified': True},
                                                           'resolutions': ['720P', '1080P'],
                                                           'api_contract_verified': True}}}}




def load_model_config() -> dict[str, Any]:
    """Return built-in models plus currently configured OpenAI-compatible models."""
    registry = deepcopy(MODEL_CONFIG)
    configured = (
        Config.CONFIG.get("api_providers", {})
        .get("openai_compatible", {})
        .get("models", [])
    )
    if not isinstance(configured, list):
        logger.warning("openai_compatible.models 必须是列表，已忽略")
        return registry

    for entry in configured:
        if not isinstance(entry, dict):
            logger.warning("openai_compatible.models 中有非对象条目，已忽略")
            continue
        model_id = str(entry.get("id") or "").strip()
        types = entry.get("type") or []
        if isinstance(types, str):
            types = [types]
        if not model_id or not isinstance(types, list) or not types or any(
            item not in {"llm", "vlm"} for item in types
        ):
            logger.warning("openai_compatible.models 条目缺少合法 id/type，已忽略")
            continue
        if model_id in registry["models"]:
            logger.warning("openai_compatible 模型 ID 与内置模型冲突，已忽略: %s", model_id)
            continue
        registry["models"][model_id] = {
            "name": str(entry.get("name") or model_id),
            "provider": "openai_compatible",
            "type": list(dict.fromkeys(types)),
            "concurrency": 10,
        }
    return registry


def get_model_config(model: str) -> dict[str, Any]:
    """Find a model by its exact ID or raise with the available IDs."""
    models = load_model_config()["models"]
    if model in models:
        return models[model]
    raise ValueError(f"未知模型: {model}；可用模型: {', '.join(sorted(models))}")


def get_max_concurrency(model: str, enable_concurrency: bool = False) -> int:
    if not enable_concurrency:
        return 1
    return int(get_model_config(model).get("concurrency", 3))


def get_models_by_type(model_type: str) -> list[dict[str, Any]]:
    result = []
    for model_id, metadata in load_model_config()["models"].items():
        if model_type in (metadata.get("type") or []):
            result.append({"id": model_id, **metadata})
    return result


def model_type_capabilities(model_type: str, metadata: Optional[dict[str, Any]] = None) -> dict[str, Any]:
    """Return normalized capability metadata for non-media model selectors."""
    metadata = metadata or {}
    if metadata.get("capabilities"):
        return deepcopy(metadata["capabilities"])
    if model_type == "llm":
        return {
            "ability_type": "text_generation",
            "ability_types": ["text_generation"],
            "adapter_ability_types": ["text_generation"],
            "input_modalities": ["text"],
            "adapter_input_modalities": ["text"],
            "api_contract_verified": bool(metadata.get("api_contract_verified", False)),
        }
    if model_type == "vlm":
        return {
            "ability_type": "vision_language",
            "ability_types": ["vision_language", "image_understanding"],
            "adapter_ability_types": ["vision_language", "image_understanding"],
            "input_modalities": ["text", "image"],
            "adapter_input_modalities": ["text", "image"],
            "api_contract_verified": bool(metadata.get("api_contract_verified", False)),
        }
    return media_capabilities(metadata.get("provider", ""), metadata.get("id", ""), "video" if model_type == "video" else "image")


def model_records(media_type: Optional[str] = None) -> list[dict[str, Any]]:
    records = []
    for model_id, metadata in load_model_config()["models"].items():
        resolved_media_type = _resolve_media_type(metadata.get("type") or [])
        if media_type and resolved_media_type != media_type:
            continue
        if resolved_media_type not in {"image", "video"}:
            continue
        records.append(_workflow_info(model_id, metadata, resolved_media_type))
    return records


def list_api_models(
    media_type: Optional[str] = None,
    required_adapter_abilities: Optional[list[str]] = None,
    verified_only: bool = False,
) -> list[dict[str, Any]]:
    records = model_records(media_type=media_type)
    required = set(required_adapter_abilities or [])
    if verified_only:
        records = [record for record in records if record.get("api_contract_verified", True)]
    if required:
        records = [record for record in records if required.intersection(model_ability_tags(record))]
    return records


def parse_api_model(model: str, media_type: str) -> tuple[str, str]:
    if model and model.startswith("api/"):
        _, provider, model_id = model.split("/", 2)
        metadata = get_model_config(model_id)
        if metadata.get("provider") != provider or _resolve_media_type(metadata.get("type") or []) != media_type:
            raise ValueError(f"模型与 provider/类型不匹配: {model}")
        return provider, model_id

    metadata = load_model_config()["models"].get(model)
    if metadata and _resolve_media_type(metadata.get("type") or []) == media_type:
        return metadata.get("provider", ""), model
    raise ValueError(f"未知的{media_type}模型: {model}；可用模型: {', '.join(record['model'] for record in model_records(media_type))}")


def media_capabilities(provider: str, model: str, media_type: str) -> dict[str, Any]:
    metadata = load_model_config()["models"].get(model, {})
    capabilities = metadata.get("capabilities")
    if capabilities:
        return deepcopy(capabilities)
    if media_type == "image":
        return {
            "ability_type": "image_generation",
            "ability_types": ["text_to_image"],
            "adapter_ability_types": ["text_to_image"],
            "input_modalities": ["text"],
            "adapter_input_modalities": ["text"],
            "api_contract_verified": False,
        }
    return {
        "ability_type": "image_to_video",
        "ability_types": [],
        "adapter_ability_types": ["first_frame_i2v"],
        "input_modalities": ["text", "image"],
        "adapter_input_modalities": ["text", "image"],
        "api_contract_verified": False,
        "duration": {"min": 3, "max": 15, "integer": True, "verified": False},
    }


def video_capabilities(provider: str, model: str) -> dict[str, Any]:
    return media_capabilities(provider, model, "video")


def image_capabilities(provider: str, model: str) -> dict[str, Any]:
    return media_capabilities(provider, model, "image")


def model_ability_tags(record: dict[str, Any]) -> set[str]:
    tags = set(record.get("adapter_ability_types") or [])
    tags.update(record.get("ability_types") or [])
    if record.get("ability_type"):
        tags.add(record["ability_type"])
    tags.update(record.get("type") or [])
    return tags


def _workflow_info(model_id: str, metadata: dict[str, Any], media_type: str) -> dict[str, Any]:
    provider = metadata.get("provider", "")
    capabilities = media_capabilities(provider, model_id, media_type)
    return {
        "key": f"api/{provider}/{model_id}",
        "name": model_id,
        "display_name": f"{metadata.get('name') or model_id} - API {provider.title()}",
        "source": "api",
        "provider": provider,
        "family": metadata.get("family"),
        "model": model_id,
        "media_type": media_type,
        "type": metadata.get("type", []),
        "capabilities": capabilities,
        "ability_type": capabilities.get("ability_type"),
        "ability_types": capabilities.get("ability_types", []),
        "adapter_ability_types": capabilities.get("adapter_ability_types", []),
        "input_modalities": capabilities.get("input_modalities", []),
        "adapter_input_modalities": capabilities.get("adapter_input_modalities", []),
        "api_contract_verified": capabilities.get("api_contract_verified", False),
        "concurrency": metadata.get("concurrency"),
    }


def _resolve_media_type(types: list[str]) -> str:
    if "video" in types:
        return "video"
    if any(item in types for item in ("t2i", "i2i", "image")):
        return "image"
    return ""
