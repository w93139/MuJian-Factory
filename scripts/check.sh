#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
./backend/check.sh
cd frontend
npm run check
