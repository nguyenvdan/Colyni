#!/usr/bin/env bash
# One-time: Python venv, pip install, npm install.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Backend (Python)"
cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
# shellcheck source=/dev/null
source .venv/bin/activate
pip install -U pip
pip install -r requirements.txt
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created backend/.env from .env.example — edit INFERENCE_BASE_URL if needed."
fi

echo "==> Frontend (npm)"
cd "$ROOT/frontend"
npm install
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created frontend/.env from .env.example (optional for dev)."
fi

echo ""
echo "Done. Start inference (exo), then run: ./scripts/dev.sh"
