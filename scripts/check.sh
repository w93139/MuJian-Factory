#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./backend/check.sh
(
  cd backend
  uv run pytest -q ../scripts/tests
  uv run ruff check ../scripts/local_launcher.py ../scripts/tests
)
cd frontend
npm run check
