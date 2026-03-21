#!/usr/bin/env bash
# One command for demo night: build Colyni UI, start colyni-cluster + Colyni API on LAN.
# Prerequisites: ./scripts/setup.sh (and inference deps: cd inference && uv sync once).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f "$ROOT/backend/.venv/bin/activate" ]]; then
  echo "Run ./scripts/setup.sh first."
  exit 1
fi

if [[ "${SKIP_UI_BUILD:-0}" != "1" ]]; then
  "$ROOT/scripts/build-cluster-ui.sh"
else
  echo "==> SKIP_UI_BUILD=1 — not rebuilding frontend/dist"
fi

detect_lan_ip() {
  local ip=""
  if command -v ipconfig &>/dev/null; then
    ip=$(ipconfig getifaddr en0 2>/dev/null || true)
    [[ -z "$ip" ]] && ip=$(ipconfig getifaddr en1 2>/dev/null || true)
  fi
  if [[ -z "$ip" ]] && [[ -n "${LAN_IP:-}" ]]; then
    ip="$LAN_IP"
  fi
  if [[ -z "$ip" ]] && command -v hostname &>/dev/null; then
    ip=$(hostname -I 2>/dev/null | awk '{print $1}' || true)
  fi
  [[ -z "$ip" ]] && ip="127.0.0.1"
  echo "$ip"
}

LAN_IP=$(detect_lan_ip)
export COLYNI_BACKEND_PORT="${COLYNI_BACKEND_PORT:-8787}"

cd "$ROOT/backend"
# shellcheck source=/dev/null
source .venv/bin/activate

set -a
[[ -f .env ]] && source .env
set +a

# Widen CORS for phones / other laptops on the same Wi‑Fi (override .env for this shell only).
if [[ "${COLYNI_DEMO_LAN:-1}" == "1" ]]; then
  export CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://${LAN_IP}:5173,http://localhost:52415,http://127.0.0.1:52415,http://${LAN_IP}:52415"
fi

PIDS=()
cleanup() {
  echo ""
  echo "Stopping background processes…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

cd "$ROOT/inference"
echo "==> Starting colyni-cluster (inference + Colyni UI on :52415)"
uv run colyni-cluster &
PIDS+=($!)

cd "$ROOT/backend"
# shellcheck source=/dev/null
source .venv/bin/activate
echo "==> Starting Colyni API on 0.0.0.0:${COLYNI_BACKEND_PORT}"
uvicorn main:app --host 0.0.0.0 --port "${COLYNI_BACKEND_PORT}" &
PIDS+=($!)

if [[ "${WITH_VITE:-}" == "1" ]]; then
  echo "==> Starting Vite dev server (--host)"
  (cd "$ROOT/frontend" && npm run dev -- --host) &
  PIDS+=($!)
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Colyni coordinator — share these URLs on the same Wi‑Fi"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Cluster UI (built React):  http://${LAN_IP}:52415"
echo "  Colyni API (ledger/proxy):  http://${LAN_IP}:${COLYNI_BACKEND_PORT}"
if [[ "${WITH_VITE:-}" == "1" ]]; then
  echo "  Vite (hot reload UI):       http://${LAN_IP}:5173"
fi
echo ""
echo "  Contributors: Settings → Contributor → Coordinator API →"
echo "    http://${LAN_IP}:${COLYNI_BACKEND_PORT}"
echo ""
echo "  Stop: Ctrl+C"
echo "  Env:  LAN_IP=… override IP · SKIP_UI_BUILD=1 · WITH_VITE=1 · COLYNI_DEMO_LAN=0"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
