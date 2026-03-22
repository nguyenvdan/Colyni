#!/usr/bin/env bash
# One command for demo night: build Colyni UI, start colyni-cluster + Colyni API on LAN.
# Prerequisites: ./scripts/setup.sh (and inference deps: cd inference && uv sync once).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# --- LAN IP ---
# shellcheck source=detect-lan-ip.sh
source "$ROOT/scripts/detect-lan-ip.sh"

# --- Prereqs ---
if [[ ! -f "$ROOT/backend/.venv/bin/activate" ]]; then
  echo "Run ./scripts/setup.sh first." >&2; exit 1
fi

# --- Build frontend (skip with SKIP_UI_BUILD=1) ---
if [[ "${SKIP_UI_BUILD:-0}" != "1" ]]; then
  "$ROOT/scripts/build-cluster-ui.sh"
else
  echo "==> SKIP_UI_BUILD=1 — not rebuilding frontend/dist"
fi

LAN_IP="$(detect_lan_ip)"
COLYNI_BACKEND_PORT="${COLYNI_BACKEND_PORT:-8787}"
export COLYNI_BACKEND_PORT

# --- Free ports (kill anything on 52415 / 8787) ---
_free_port() {
  local port="$1"
  local pids
  pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
  if [[ -n "${pids}" ]]; then
    echo "==> Port ${port} in use — killing PID(s): ${pids}"
    echo "${pids}" | xargs kill 2>/dev/null || true
    sleep 1
    pids="$(lsof -ti ":${port}" 2>/dev/null || true)"
    if [[ -n "${pids}" ]]; then
      echo "==> Port ${port} still busy — SIGKILL"
      echo "${pids}" | xargs kill -9 2>/dev/null || true
      sleep 1
    fi
  fi
}
if [[ "${DEMO_SKIP_FREE_PORTS:-0}" != "1" ]]; then
  _free_port 52415
  _free_port "${COLYNI_BACKEND_PORT}"
fi

# --- Invite URL helper ---
colyni_invite_url() {
  local ui_port="${1:?ui port}"
  python3 -c "
from urllib.parse import urlencode
base='http://${LAN_IP}:${ui_port}/'
q=urlencode({'contributor':'1','coordinator':'http://${LAN_IP}:${COLYNI_BACKEND_PORT}','localInference':'http://127.0.0.1:52415'})
print(base+'?'+q)
"
}

# --- Backend env ---
cd "$ROOT/backend"
# shellcheck source=/dev/null
source .venv/bin/activate

set -a
[[ -f .env ]] && source .env
set +a

export COLYNI_DEMO_FREE_CHAT="${COLYNI_DEMO_FREE_CHAT:-1}"

if [[ "${COLYNI_DEMO_LAN:-1}" == "1" ]]; then
  export CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173,http://${LAN_IP}:5173,http://localhost:52415,http://127.0.0.1:52415,http://${LAN_IP}:52415"
fi

# --- Model allowlist (3 demo models by default) ---
# shellcheck source=demo-model-allowlist.sh
source "$ROOT/scripts/demo-model-allowlist.sh"
if [[ -n "${COLYNI_CLUSTER_MODEL_ALLOWLIST:-}" ]]; then
  echo "==> Model catalog restricted to: ${COLYNI_CLUSTER_MODEL_ALLOWLIST}"
  echo "    (show all: COLYNI_FULL_MODEL_CATALOG=1 $0)"
fi

# --- Process management ---
PIDS=()
cleanup() {
  echo ""
  echo "Stopping background processes…"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- Start colyni-cluster ---
cd "$ROOT/inference"
echo "==> Starting colyni-cluster (inference + Colyni UI on :52415)"
uv run colyni-cluster &
PIDS+=("$!")

# --- Start Colyni API (uvicorn) ---
cd "$ROOT/backend"
# shellcheck source=/dev/null
source .venv/bin/activate
echo "==> Starting Colyni API on 0.0.0.0:${COLYNI_BACKEND_PORT}"
uvicorn main:app --host 0.0.0.0 --port "${COLYNI_BACKEND_PORT}" &
PIDS+=("$!")

# --- Optional: Vite dev server ---
if [[ "${WITH_VITE:-}" == "1" ]]; then
  echo "==> Starting Vite dev server (--host)"
  (cd "$ROOT/frontend" && npm run dev -- --host) &
  PIDS+=("$!")
fi

# --- Optional: auto-place model ---
if [[ "${AUTO_PLACE_MODEL:-0}" == "1" ]] && [[ -n "${DEMO_MODEL_ID:-}" ]]; then
  echo "==> AUTO_PLACE_MODEL=1 — placing ${DEMO_MODEL_ID} once cluster is reachable"
  (
    export INFERENCE_URL="${INFERENCE_URL:-http://127.0.0.1:52415}"
    sleep 8
    bash "$ROOT/scripts/place-cluster-model.sh" "${DEMO_MODEL_ID}" \
      || echo "AUTO_PLACE_MODEL: placement failed — run scripts/place-cluster-model.sh manually"
  ) &
fi

# --- Banner ---
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Colyni coordinator — same Wi‑Fi (LAN)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$LAN_IP" == "127.0.0.1" ]]; then
  echo "  ⚠ LAN IP not detected — URLs below use loopback. Set a real IP:"
  echo "      LAN_IP=192.168.x.x $0"
  echo ""
fi
cat <<EOF
  On this Mac only (localhost):
    Cluster UI:   http://127.0.0.1:52415
    Colyni API:   http://127.0.0.1:${COLYNI_BACKEND_PORT}

  On phones / other laptops — use LAN IP (${LAN_IP}):
    Cluster UI:   http://${LAN_IP}:52415
    Colyni API:   http://${LAN_IP}:${COLYNI_BACKEND_PORT}

  One-click invite (guests open in browser):
    $(colyni_invite_url 52415)

  Contributors (manual): Settings → Contributor → Coordinator API →
    http://${LAN_IP}:${COLYNI_BACKEND_PORT}

  Troubleshooting LAN:
    • macOS Firewall — allow incoming for Python / colyni-cluster
    • Wrong IP? ipconfig getifaddr en0 (and en1) → LAN_IP=x.x.x.x $0
    • From guest: curl -sS -o /dev/null -w '%{http_code}\n' http://${LAN_IP}:52415/

  Stop: Ctrl+C
  Env:  LAN_IP=… · SKIP_UI_BUILD=1 · WITH_VITE=1 · COLYNI_DEMO_LAN=0
        AUTO_PLACE_MODEL=1 DEMO_MODEL_ID=org/name
        COLYNI_FULL_MODEL_CATALOG=1 (show all models, not just demo trio)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

wait
