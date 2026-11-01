#!/usr/bin/env python3
"""User-initiated macOS launcher. Never installs dependencies or edits user data."""

from __future__ import annotations

import argparse
import fcntl
import hashlib
import json
import logging
import os
import plistlib
import re
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:3110/"


class LaunchError(RuntimeError):
    pass


def run(args: list[str], timeout: int = 15) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def request(url: str) -> bytes:
    # Loopback checks must not go through a shell's HTTP proxy.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(url, timeout=2) as response:
        return response.read(2 * 1024 * 1024)


def port_open(port: int) -> bool:
    with socket.socket() as connection:
        connection.settimeout(0.3)
        return connection.connect_ex(("127.0.0.1", port)) == 0


def listener_cwds(port: int) -> set[Path]:
    result = run(["/usr/sbin/lsof", "-nP", f"-iTCP:{port}", "-sTCP:LISTEN", "-t"])
    directories = set()
    for pid in set(result.stdout.split()):
        if not pid.isdecimal():
            continue
        cwd = run(["/usr/sbin/lsof", "-a", "-p", pid, "-d", "cwd", "-Fn"])
        directories.update(Path(line[1:]).resolve() for line in cwd.stdout.splitlines() if line.startswith("n/"))
    return directories


def node_executable() -> Path:
    current = shutil.which("node")
    candidates = [Path(current)] if current else []
    nvm = Path.home() / ".nvm/versions/node"
    candidates += sorted(nvm.glob("*/bin/node"), key=lambda p: tuple(
        int(n) for n in re.findall(r"\d+", p.parents[1].name)), reverse=True)
    candidates += [Path("/opt/homebrew/bin/node"), Path("/usr/local/bin/node")]
    for path in candidates:
        if not path.is_file() or not os.access(path, os.X_OK):
            continue
        result = run([str(path), "--version"])
        version = re.match(r"v(\d+)\.(\d+)", result.stdout.strip())
        if result.returncode == 0 and version and tuple(map(int, version.groups())) >= (20, 9):
            return path.absolute()
    raise LaunchError("找不到 Node.js 20.9 或更新版本。请先安装 Node.js；支持 Homebrew 和 ~/.nvm 中的版本。")


class Launcher:
    def __init__(self, root: Path = ROOT):
        self.root = root.resolve()
        self.runtime = self.root / ".local-runtime/launcher"
        self.runtime.mkdir(parents=True, exist_ok=True)
        suffix = hashlib.sha256(str(self.root).encode()).hexdigest()[:12]
        self.domain = f"gui/{os.getuid()}"
        self.labels = {name: f"com.mujian.local.{suffix}.{name}" for name in ("backend", "frontend")}
        self.started = set()
        self.log = logging.getLogger(f"mujian-launcher.{suffix}")
        self.log.setLevel(logging.INFO)
        self.log.propagate = False
        if not self.log.handlers:
            for handler in (logging.StreamHandler(sys.stdout), logging.FileHandler(self.runtime / "launcher.log", encoding="utf-8")):
                handler.setFormatter(logging.Formatter("%(asctime)s %(message)s", "%Y-%m-%d %H:%M:%S"))
                self.log.addHandler(handler)

    def target(self, name: str) -> str:
        return f"{self.domain}/{self.labels[name]}"

    def healthy(self, name: str) -> bool:
        try:
            if name == "backend":
                health = json.loads(request("http://127.0.0.1:8000/api/health"))
                service = json.loads(request("http://127.0.0.1:8000/"))
                return health.get("status") == "ok" and service.get("service") == "Mujian"
            html = request(URL).decode("utf-8", errors="replace")
            catalog = json.loads(request(URL + "api/models?model_type=tts"))
            return "幕间" in html and isinstance(catalog.get("models"), list) and bool(catalog["models"])
        except (OSError, ValueError, urllib.error.URLError):
            return False

    def existing(self, name: str, announce: bool = True) -> bool:
        port = 8000 if name == "backend" else 3110
        if not port_open(port):
            return False
        directories = listener_cwds(port)
        if directories != {self.root / name}:
            detail = "、".join(map(str, directories)) or "无法确认归属"
            raise LaunchError(f"端口 {port} 已被其他程序或项目占用（{detail}）。请先处理该程序，再双击启动；没有结束任何进程。")
        if announce:
            self.log.info("%s 已在运行，检查服务是否就绪…", "后端" if name == "backend" else "前端")
        return True

    def definition(self, name: str) -> dict:
        common_path = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"]
        environment = {"PYTHONUNBUFFERED": "1"}
        if name == "backend":
            python = self.root / "backend/.venv/bin/python"
            if not python.is_file() or not os.access(python, os.X_OK):
                raise LaunchError(f"缺少后端 Python 环境。请在 {self.root}/backend 执行 uv sync --python 3.11。")
            check = run([str(python), "-c", "import fastapi, uvicorn"])
            if check.returncode:
                raise LaunchError("后端依赖不完整：请在 backend 执行 uv sync。\n" + check.stderr[-2000:])
            arguments = [str(python), "-m", "uvicorn", "api.app:app", "--host", "127.0.0.1", "--port", "8000"]
            for tool in ("ffmpeg", "ffprobe"):
                local = self.root / "backend/.tools/bin" / tool
                if local.is_file():
                    environment[f"MUJIAN_{tool.upper()}"] = str(local)
        else:
            node = node_executable()
            common_path.insert(0, str(node.parent))
            next_cli = self.root / "frontend/node_modules/next/dist/bin/next"
            if not next_cli.is_file():
                raise LaunchError(f"缺少前端依赖。请在 {self.root}/frontend 执行 npm ci。")
            arguments = [str(node), str(next_cli), "dev", "--hostname", "127.0.0.1", "--port", "3110"]
            environment.update(BACKEND_API_URL="http://127.0.0.1:8000", NEXT_PUBLIC_MUJIAN_LEGACY="0", MUJIAN_DIST_DIR=".next-local3110")
        environment["PATH"] = ":".join(common_path)
        return {
            "Label": self.labels[name], "ProgramArguments": arguments,
            "WorkingDirectory": str(self.root / name), "EnvironmentVariables": environment,
            "RunAtLoad": True, "KeepAlive": False,
            "StandardOutPath": str(self.runtime / f"{name}.log"),
            "StandardErrorPath": str(self.runtime / f"{name}.log"),
        }

    def start(self, name: str, definition: dict) -> None:
        target = self.target(name)
        # An exited job can retain an old Node path or project definition. Only
        # remove this launcher's label, after existing() has checked its port.
        if run(["/bin/launchctl", "print", target]).returncode == 0:
            result = run(["/bin/launchctl", "bootout", target])
            if result.returncode:
                raise LaunchError(f"无法更新幕间后台服务：{result.stderr.strip()}")
        path = self.runtime / f"{name}.plist"
        path.write_bytes(plistlib.dumps(definition))
        path.chmod(0o600)
        result = run(["/bin/launchctl", "bootstrap", self.domain, str(path)])
        if result.returncode:
            raise LaunchError(f"macOS 未能启动{name}后台服务：{result.stderr.strip()}\n请检查终端/后台程序是否允许访问项目目录；本脚本没有修改系统权限。")
        self.started.add(name)
        self.log.info("正在启动%s…", "后端" if name == "backend" else "前端")

    def wait(self, name: str, timeout: int = 90) -> None:
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            if self.healthy(name) and self.existing(name, announce=False):
                return
            if name in self.started:
                state = run(["/bin/launchctl", "print", self.target(name)])
                match = re.search(r"last exit code = (\d+)", state.stdout)
                if state.returncode != 0 or (match and "state = running" not in state.stdout):
                    code = match.group(1) if match else "未知"
                    raise LaunchError(f"{name} 进程提前退出（退出码 {code}），详细原因见下方日志。")
            time.sleep(0.6)
        raise LaunchError(f"{name} 在 {timeout} 秒内没有就绪。请查看对应日志，常见原因是端口占用、依赖缺失或系统目录权限。")

    def start_all(self, open_browser: bool = True) -> None:
        # Plan before mutation: missing front-end dependencies should not leave
        # a newly started backend behind unexpectedly.
        existing = {name: self.existing(name) for name in self.labels}
        plans = {name: self.definition(name) for name in self.labels if not existing[name]}
        for name in self.labels:
            if not existing[name]:
                self.start(name, plans[name])
            self.wait(name)
        if open_browser:
            result = run(["/usr/bin/open", URL])
            if result.returncode:
                raise LaunchError(f"服务已就绪，但浏览器未打开：{result.stderr.strip()}\n请手动访问 {URL}")
        self.log.info("幕间已就绪：%s", URL)
        self.log.info("后台服务独立运行，可以关闭此窗口。日志：%s", self.runtime)

    def stop(self) -> None:
        # Never stop manually started processes or another project's services.
        for name in reversed(list(self.labels)):
            if run(["/bin/launchctl", "print", self.target(name)]).returncode == 0:
                result = run(["/bin/launchctl", "bootout", self.target(name)])
                if result.returncode:
                    raise LaunchError(result.stderr.strip())
        self.log.info("已停止本启动器管理的后台服务。")

    def failure(self, error: Exception) -> None:
        self.log.error("启动失败：%s", error)
        for name in self.labels:
            path = self.runtime / f"{name}.log"
            if path.exists():
                lines = path.read_text(encoding="utf-8", errors="replace").splitlines()[-18:]
                self.log.error("%s 日志（%s）：\n%s", name, path, "\n".join(lines))
        self.log.error("完整启动日志：%s", self.runtime / "launcher.log")


def main() -> int:
    parser = argparse.ArgumentParser(description="启动幕间本地网站，已经运行则直接打开")
    parser.add_argument("--no-open", action="store_true", help="启动检查，不打开浏览器")
    parser.add_argument("--stop", action="store_true", help="仅停止本启动器管理的服务")
    args = parser.parse_args()
    if sys.platform != "darwin":
        print("此桌面入口用于 macOS；其他系统请按 README 启动。", file=sys.stderr)
        return 1
    launcher = Launcher()
    with (launcher.runtime / "startup.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print("幕间正在启动，请等待当前启动窗口完成。")
            return 0
        try:
            if args.stop:
                launcher.stop()
            else:
                launcher.start_all(open_browser=not args.no_open)
            return 0
        except (LaunchError, OSError, subprocess.SubprocessError) as error:
            launcher.failure(error)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
