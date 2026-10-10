"""Exercise real pipeline branching with isolated files and all generators replaced."""
from unittest.mock import AsyncMock, MagicMock

import pytest

from api.schemas.pipelines import StandardPipelineRequest
from pipelines import standard


@pytest.mark.asyncio
@pytest.mark.parametrize("video_mode,template_kind", [("dynamic_video", None), ("image_concat", "image"), ("image_concat", "video")])
async def test_standard_consumes_subtitle_voice_template_and_video_parameters(monkeypatch, tmp_path, video_mode, template_kind):
    monkeypatch.setattr(standard, "task_output_dir", lambda _: str(tmp_path))
    monkeypatch.setattr(standard, "update_task", MagicMock())
    monkeypatch.setattr(standard, "append_artifact", MagicMock())
    monkeypatch.setattr(standard, "LLM", MagicMock())
    prompts = AsyncMock(return_value=["visual prompt"])
    monkeypatch.setattr(standard, "generate_image_prompts", prompts)
    image = MagicMock(return_value=str(tmp_path / "image.png"))
    video = MagicMock(return_value=str(tmp_path / "video.mp4"))
    voice = AsyncMock()
    monkeypatch.setattr(standard, "generate_image_api", image)
    monkeypatch.setattr(standard, "generate_video_api", video)
    monkeypatch.setattr(standard, "generate_edge_tts", voice)
    monkeypatch.setattr(standard, "media_duration_seconds", lambda _: 9.2)
    render_image = MagicMock(return_value=str(tmp_path / "caption.png"))
    render_video = MagicMock(return_value=str(tmp_path / "template.mp4"))
    static = MagicMock(return_value=str(tmp_path / "static.mp4"))
    monkeypatch.setattr(standard, "render_template_text_image", render_image)
    monkeypatch.setattr(standard, "render_template_media_video", render_video)
    monkeypatch.setattr(standard, "render_static_text_image", MagicMock(return_value=str(tmp_path / "caption.png")))
    monkeypatch.setattr(standard, "create_static_image_clip", static)
    monkeypatch.setattr(standard, "replace_video_audio", MagicMock(return_value=str(tmp_path / "clip.mp4")))
    monkeypatch.setattr(standard, "concat_videos", MagicMock(return_value=str(tmp_path / "final.mp4")))
    # Actual template catalog computation is tested separately; here isolate the
    # media slot to verify output ratio and slot ratio are not conflated.
    monkeypatch.setattr(standard, "template_media_spec", lambda *_: {"media_ratio": "4:3", "media_resolution": "1200*900", "supports_video": True})
    request = StandardPipelineRequest(
        text="旁白。", title="验证", mode="copy", llm_model="text", image_model="image",
        video_model="video", video_mode=video_mode, video_ratio="9:16", video_resolution="1080P",
        video_duration=7, enable_subtitles=True, subtitle_render_mode="postprocess",
        subtitle_template="1080x1920/image_book.html" if template_kind else None,
        template_media_kind=template_kind or "image", subtitle_template_fields={"author": "测试"},
        tts_voice="zh-CN-XiaoxiaoNeural", tts_speed=1.2,
    )
    output, _ = await standard.run("isolated", request.model_dump(exclude_none=True))
    assert voice.call_args.kwargs["voice"] == "zh-CN-XiaoxiaoNeural"
    assert voice.call_args.kwargs["speed"] == 1.2
    assert image.call_args.kwargs["video_ratio"] == ("4:3" if template_kind else "9:16")
    if template_kind:
        renderer = render_video if template_kind == "video" else render_image
        assert renderer.call_args.kwargs["template_id"] == "1080x1920/image_book.html"
        assert renderer.call_args.kwargs["template_values"] == {"author": "测试"}
        assert renderer.call_args.kwargs["subtitle"]
        assert renderer.call_args.kwargs["video_ratio"] == "9:16"
        assert output["template_media_kind"] == template_kind
    if video_mode == "dynamic_video" or template_kind == "video":
        assert video.call_args.kwargs["duration"] == 10  # ceil audio length exceeds requested minimum
        assert video.call_args.kwargs["video_resolution"] == "1080P"
        assert video.call_args.kwargs["video_ratio"] == ("4:3" if template_kind else "9:16")
        static.assert_not_called()
    else:
        video.assert_not_called()
        assert static.call_args.kwargs["duration"] == 9.2


@pytest.mark.parametrize("entry", ["standard", "quick_create"])
@pytest.mark.parametrize("ratio,template,status", [("21:9", None, 422), ("9:16", None, 200), ("21:9", "1920x1080/image_book.html", 200)])
def test_standard_rejects_freeform_ratio_before_scheduling_but_preserves_template_path(monkeypatch, entry, ratio, template, status):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient

    from api.routers import pipelines

    limiter = MagicMock()
    create = MagicMock(return_value={"task_id": "isolated", "status": "pending", "output_dir": "isolated"})
    run = MagicMock()
    monkeypatch.setattr(pipelines, "job_limiter", limiter)
    monkeypatch.setattr(pipelines, "create_task", create)
    monkeypatch.setattr(pipelines, "run_pipeline_task", run)
    app = FastAPI()
    app.include_router(pipelines.router)
    params = {
        "text": "旁白", "llm_model": "deepseek-v3.2", "image_model": "wan2.7-image",
        "video_ratio": ratio, "subtitle_template": template,
    }
    # The generic compatibility route wraps its fields in params and accepts
    # the historical image_workflow name consumed by standard.run.
    if entry == "quick_create":
        params["image_workflow"] = params.pop("image_model")
    payload = params if entry == "standard" else {"params": params}
    response = TestClient(app).post(f"/api/pipelines/{entry}/tasks", json=payload)
    assert response.status_code == status
    expected = 1 if status == 200 else 0
    assert limiter.reserve.call_count == expected
    assert create.call_count == expected
    assert run.call_count == expected
    if status == 200:
        assert create.call_args.kwargs["pipeline"] == "standard"
    else:
        assert "画幅" in response.json()["detail"]
