#!/usr/bin/env bash
# Runs Colyni backend + Vite dev server. Start exo / your inference API first.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${COLYNI_BACKEND_PORT:-8787}"

cd "$ROOT/backend"
if [[ ! -d .venv ]]; then
  echo "Run ./scripts/setup.sh first."
  exit 1
fi
# shellcheck source=/dev/null
source .venv/bin/activate

cleanup() {
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "Starting Colyni API on http://127.0.0.1:${PORT} (inference: \${INFERENCE_BASE_URL:-http://127.0.0.1:52415})"
uvicorn main:app --host 127.0.0.1 --port "$PORT" &
BACKEND_PID=$!

cd "$ROOT/frontend"
echo "Starting Vite on http://localhost:5173"
npm run dev
