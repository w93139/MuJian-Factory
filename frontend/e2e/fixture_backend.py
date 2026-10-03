"""Run a real public-mode API against a disposable copy of the backend."""

import os
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
PORT = "18765"
ADMIN_PASSWORD = "e2e-admin-password"
INVITE_CODE = "E2EDEMO2"


def ignore_files(directory: str, names: list[str]) -> set[str]:
    ignored = {".venv", ".tools", ".local-runtime", "__pycache__", ".pytest_cache", ".ruff_cache", "tests", "code", "temp", "config.yaml", "config.yaml.bak", "logs", "env.txt"}
    return {name for name in names if name in ignored or name.startswith(".env")}


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="mujian-e2e-") as temporary:
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
