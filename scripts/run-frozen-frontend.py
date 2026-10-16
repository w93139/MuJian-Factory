#!/usr/bin/env python3
"""Run an immutable Git snapshot in a disposable directory, never the backup itself."""
import os
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
# This commit's 63 tracked frontend files match the untouched original backup.
REF = "2ab1fe77cf835d58fd13d799308cb49c3a2b6ffd"
DEST = ROOT / ".local-artifacts" / "frozen-reference"


def main():
    revision = subprocess.check_output(["git", "rev-parse", REF], cwd=ROOT, text=True).strip()
    marker = DEST / "revision"
    if not marker.exists() or marker.read_text().strip() != revision:
        if DEST.exists():
            shutil.rmtree(DEST)
        DEST.mkdir(parents=True)
        archive = subprocess.run(["git", "archive", revision, "frontend"], cwd=ROOT, check=True, capture_output=True)
        subprocess.run(["tar", "-x", "-C", str(DEST)], input=archive.stdout, check=True)
        marker.write_text(revision + "\n")
    frontend = DEST / "frontend"
    if not (frontend / "node_modules" / ".bin" / "next").exists():
        subprocess.run(["npm", "ci", "--no-audit", "--no-fund"], cwd=frontend, check=True)
    if "--prepare" in sys.argv:
        print(f"Frozen frontend {revision}: {frontend}")
        return
    port = os.getenv("MUJIAN_FROZEN_PORT", "3112")
    os.chdir(frontend)
    os.execvp("npm", ["npm", "run", "dev", "--", "--hostname", "127.0.0.1", "--port", port])


if __name__ == "__main__":
    main()
