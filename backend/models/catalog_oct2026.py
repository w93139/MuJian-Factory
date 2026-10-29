"""Official endpoints checked 2026-10-29; account access is not generation QA.

Only advertise inputs implemented by Mujian. Prices used here are conservative
budget reservations, not provider invoice estimates. See the dated integration
report for official sources and the supported subset of each endpoint.
"""

from copy import deepcopy


def additions(existing: dict) -> dict:
    models = {}
    for model, name, provider, vision, input_rate, output_rate in (
        ("deepseek-v4-pro-0813", "DeepSeek V4 Pro", "dashscope", False, 9, 27),
        ("kimi-k3", "Kimi K3", "dashscope", True, 20, 100),
        ("glm-5.3", "GLM 5.3", "dashscope", False, 8, 28),
        ("doubao-seed-2-1-pro-260915", "Doubao Seed 2.1 Pro", "ark", True, 6, 30),
        ("doubao-seed-2-1-lite-260915", "Doubao Seed 2.1 Lite", "ark", True, 1.6, 5.4),
        ("doubao-seed-2-1-turbo-260628", "Doubao Seed 2.1 Turbo", "ark", True, 6, 30),
    ):
        models[model] = {
            "name": name, "provider": provider, "type": ["llm", "vlm"] if vision else ["llm"],
            "concurrency": 5, "supports_search": False,
            "budget_price_per_million_input_tokens": input_rate,
            "budget_price_per_million_output_tokens": output_rate,
            "default_disable_thinking": provider == "ark",
            "api_contract_verified": True,
        }
    for model, name, price in (
        ("qwen-image-3.0", "Qwen Image 3.0", 0.18),
        ("qwen-image-3.0-pro", "Qwen Image 3.0 Pro", 0.50),
    ):
        item = deepcopy(existing["wan2.7-image"])
        item.update(name=name, family="qwen-image", price_per_image=price,
                    input_image_price_per_image=0.02)
        item["capabilities"].update(
            resolutions=["1K", "2K"], min_pixels=512**2, max_pixels=2048**2,
            max_reference_images=3,
        )
        models[model] = item
    item = deepcopy(existing["doubao-seedance-2-0-fast-260128"])
    item.update(name="Seedance 2.0 Mini", price_per_second=1.10)
    models["doubao-seedance-2-0-mini-260615"] = item
    item = deepcopy(existing["doubao-seedance-2-0-260128"])
    item.update(name="Seedance 2.5", price_per_second=8.0,
                price_per_second_by_resolution={"480p": 1.5, "720p": 3.5, "1080p": 8.0})
    item["capabilities"].update(resolutions=["480p", "720p", "1080p"])
    item["capabilities"]["duration"]["max"] = 30
    models["doubao-seedance-2-5-260628"] = item
    item = deepcopy(existing["wan3.0-video"])
    item["name"] = "Wan 3.0 Video Prime"
    # Account-specific pricing must be checked before paid use. Reserve a high
    # bound and retain exactly the existing first-frame-only adapter contract.
    item.update(price_per_second=3.0,
                price_per_second_by_resolution={"480P": 3.0, "720P": 3.0, "1080P": 3.0})
    models["wan3.0-video-prime"] = item
    item = deepcopy(existing["happyhorse-1.0-r2v"])
    item.update(name="HappyHorse 1.1 R2V", price_per_second=1.2,
                price_per_second_by_resolution={"480P": 0.45, "720P": 0.9, "1080P": 1.2})
    item["capabilities"].update(resolutions=["480P", "720P", "1080P"], max_reference_images=9)
    item["capabilities"].update(
        ability_types=["reference_to_video", "native_audio"],
        adapter_ability_types=["reference_to_video", "native_audio"],
        input_modalities=["text", "image"], adapter_input_modalities=["text", "image"],
    )
    models["happyhorse-1.1-r2v"] = item
    models["edge-tts"] = {
        "name": "Edge TTS", "provider": "edge", "type": ["tts"],
        "capabilities": {"ability_type": "speech_synthesis", "adapter_ability_types": ["speech_synthesis"],
                         "api_contract_verified": True, "default": True},
    }
    models["qwen-audio-3.1-tts-plus"] = {
        "name": "Qwen Audio 3.1 TTS Plus", "provider": "dashscope", "type": ["tts"],
        "concurrency": 1, "price_per_1k_input_token": 0.14, "price_per_1k_output_token": 0,
        "capabilities": {
            "ability_type": "speech_synthesis", "adapter_ability_types": ["speech_synthesis"],
            "api_contract_verified": True,
            "voices": ["xunanchuan_v3.1", "longanhuan_v3.1"],
            "speed": {"min": 0.5, "max": 2},
        },
    }
    return models
