"""Run a real public-mode API against a disposable copy of the backend."""

import os
import json
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SOURCE = ROOT / "backend"
PORT = os.getenv("MUJIAN_TEST_API_PORT", "18765")
ADMIN_PASSWORD = "e2e-admin-password"
INVITE_CODE = "E2EDEMO2"


def ignore_files(directory: str, names: list[str]) -> set[str]:
    ignored = {".venv", ".tools", ".local-runtime", "__pycache__", ".pytest_cache", ".ruff_cache", "tests", "code", "temp", "config.yaml", "config.yaml.bak", "logs", "env.txt"}
    return {name for name in names if name in ignored or name.startswith(".env")}


def seed_live_sessions(session_dir):
    """Synthetic content only; actual FastAPI reads/writes these isolated JSON files."""
    script = {"title":"接口联调短片", "logline":"一封信的旅行", "episodes":[
        {"episode_number":1,"act_title":"第一幕","content":"原有第一集", "custom_script":"keep"},
        {"episode_number":2,"act_title":"第二幕","content":"原有第二集"}], "characters":[],"settings":[],
        "new_episodes":[{"episode_number":3,"act_title":"续写第三幕","content":"已经存在的续写草稿"}],
        "new_characters":[],"new_settings":[]}
    storyboard = {"custom_top":{"keep":True}, "episodes":[
        {"episode_number":1,"episode_title":"第一幕","custom_episode":"keep","segments":[
            {"segment_id":"seg_01_01","segment_number":1,"location":"窗边","characters":["旅人"],"total_duration":7,"custom_segment":"keep","shots":[
                {"shot_number":1,"shot_type":"远景","duration":3,"content":"清晨第一镜","plot":"清晨第一镜","custom_shot":"keep"},
                {"shot_number":2,"shot_type":"近景","duration":4,"content":"信件第二镜"}]}]},
        {"episode_number":2,"episode_title":"第二幕","segments":[
            {"segment_id":"seg_02_01","segment_number":1,"location":"车站","shots":[{"shot_number":1,"shot_type":"全景","duration":5,"content":"远方第三镜"}]}]}]}
    ref="code/result/image/e2e-showcase/image.png"
    clip="code/result/video/e2e-showcase/video.mp4"
    for sid in ("live-edit","live-continue","live-discard","live-add"):
        data={"session_id":sid,"current_stage":"storyboard","status":{s:"completed" for s in ["script_generation","character_design","storyboard","reference_generation","video_generation","post_production"]},
          "artifacts":{"script_generation":script,"storyboard":storyboard,
          "reference_generation":{"scenes":[{"id":"seg_01_01","name":"窗边参考图","selected":ref,"versions":[ref,ref+"?version=2"],"status":"done"}]},
          "video_generation":{"clips":[{"id":"seg_01_01","name":"窗边视频","selected":clip,"versions":[clip,clip+"?version=2"],"status":"done"}]}},
          "meta":{"idea":"接口联调短片"},"showcase":True}
        (session_dir/(sid+".json")).write_text(json.dumps(data,ensure_ascii=False))


def main() -> int:
    artifacts = ROOT / ".local-artifacts"
    artifacts.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="mujian-e2e-", dir=artifacts) as temporary:
        backend = Path(temporary) / "backend"
        shutil.copytree(SOURCE, backend, ignore=ignore_files)
        session_dir = backend / "code" / "data" / "sessions"
        result_dir = backend / "code" / "result"
        session_dir.mkdir(parents=True)
        (result_dir / "image" / "e2e-showcase").mkdir(parents=True)
        (result_dir / "video" / "e2e-showcase").mkdir(parents=True)
        for name, target in (("showcase.json", "e2e-showcase.json"), ("private.json", "e2e-private.json")):
            shutil.copy2(HERE / "fixtures" / name, session_dir / target)
        shutil.copy2(HERE / "fixtures" / "image.png", result_dir / "image" / "e2e-showcase" / "image.png")
        shutil.copy2(HERE / "fixtures" / "video.mp4", result_dir / "video" / "e2e-showcase" / "video.mp4")
        if os.getenv("MUJIAN_LIVE_TEST") == "1":
            seed_live_sessions(session_dir)
        task_dir = backend / "code" / "data" / "tasks"
        task_dir.mkdir(parents=True)
        for task_id, title, showcase in (
            ("e2e-public-task", "公开流水线示例", True),
            ("e2e-promote-task", "待设为示例的任务", False),
            ("e2e-private-task", "私有流水线草稿", False),
        ):
            output_dir = result_dir / "task" / task_id
            output_dir.mkdir(parents=True)
            video_path = output_dir / "final.mp4"
            shutil.copy2(HERE / "fixtures" / "video.mp4", video_path)
            (task_dir / f"{task_id}.json").write_text(json.dumps({
                "task_id": task_id, "pipeline": "standard", "status": "completed",
                "progress": 100, "input": {"title": title},
                "output": {"title": title, "video_path": str(video_path)},
                "artifacts": [{"kind": "video", "path": str(video_path)}],
                "output_dir": str(output_dir), "created_at": "2026-10-03T12:00:00",
                "showcase": showcase,
            }, ensure_ascii=False), encoding="utf-8")
        sandbox_dir = result_dir / "sandbox"
        sandbox_dir.mkdir(parents=True)
        sandbox_records = []
        for record_id, title, showcase in (
            ("e2e-public-record", "公开沙盒示例", True),
            ("e2e-private-record", "私有沙盒草稿", False),
        ):
            image_path = sandbox_dir / f"{record_id}.png"
            shutil.copy2(HERE / "fixtures" / "image.png", image_path)
            sandbox_records.append({
                "id": record_id, "tool": "t2i", "model": "mock-model",
                "input": {"prompt": title},
                "output": {"images": [f"result/sandbox/{record_id}.png"]},
                "files": [str(image_path)], "created_at": "2026-10-03T12:00:00",
                "showcase": showcase,
            })
        (sandbox_dir / "history.json").write_text(json.dumps(sandbox_records, ensure_ascii=False), encoding="utf-8")
        (backend / "code" / "data" / "invites.json").write_text(
            '[{"code":"E2EDEMO2","note":"自动化测试","expires_at":4102444800,"revoked":false,"last_used_at":null}]',
            encoding="utf-8",
        )
        env = os.environ.copy()
        env.update({
            "MUJIAN_PUBLIC_MODE": "1",
            "MUJIAN_ADMIN_PASSWORD": ADMIN_PASSWORD,
            "MUJIAN_SESSION_SECRET": "isolated-e2e-signing-secret",
            "MUJIAN_COOKIE_SECURE": "0",
            "DASHSCOPE_API_KEY": "",
            "ARK_API_KEY": "",
            "OPENAI_COMPAT_API_KEY": "",
        })
        python = SOURCE / ".venv" / "bin" / "python"
        if not python.exists():
            raise RuntimeError("缺少后端虚拟环境，请先在 backend/ 运行 uv sync")
        process = subprocess.Popen(
            [str(python), "-m", "uvicorn", "api.app:app", "--host", "127.0.0.1", "--port", PORT],
            cwd=backend,
            env=env,
        )

        def stop(_signal: int, _frame: object) -> None:
            process.terminate()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)
        try:
            while process.poll() is None:
                time.sleep(0.1)
            return process.returncode or 0
        finally:
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    sys.exit(main())
