#!/usr/bin/env bash
# One command for demo night: build Colyni UI, start colyni-cluster + Colyni API on LAN.
# Prerequisites: ./scripts/setup.sh (and inference deps: cd inference && uv sync once).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck source=detect-lan-ip.sh
source "$ROOT/scripts/detect-lan-ip.sh"

if [[ ! -f "$ROOT/backend/.venv/bin/activate" ]]; then
  echo "Run ./scripts/setup.sh first."
  exit 1
fi

if [[ "${SKIP_UI_BUILD:-0}" != "1" ]]; then
  "$ROOT/scripts/build-cluster-ui.sh"
else
  echo "==> SKIP_UI_BUILD=1 — not rebuilding frontend/dist"
fi

LAN_IP=$(detect_lan_ip)
export COLYNI_BACKEND_PORT="${COLYNI_BACKEND_PORT:-8787}"

# Same query string as Settings → Copy invite link (contributor=1 + coordinator + localInference).
colyni_invite_url() {
  local ui_port="${1:?ui port}"
  python3 -c "
from urllib.parse import urlencode
base = 'http://${LAN_IP}:${ui_port}/'
q = urlencode({
    'contributor': '1',
    'coordinator': 'http://${LAN_IP}:${COLYNI_BACKEND_PORT}',
    'localInference': 'http://127.0.0.1:52415',
})
print(base + '?' + q)
"
}

cd "$ROOT/backend"
# shellcheck source=/dev/null
source .venv/bin/activate

set -a
[[ -f .env ]] && source .env
set +a

# Hackathon default: chat without spending tokens; earnings unchanged. Override with COLYNI_DEMO_FREE_CHAT=0
export COLYNI_DEMO_FREE_CHAT="${COLYNI_DEMO_FREE_CHAT:-1}"

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

if [[ "${AUTO_PLACE_MODEL:-0}" == "1" ]] && [[ -n "${DEMO_MODEL_ID:-}" ]]; then
  echo "==> AUTO_PLACE_MODEL=1 — placing ${DEMO_MODEL_ID} once the cluster is reachable (background)"
  (
    export INFERENCE_URL="${INFERENCE_URL:-http://127.0.0.1:52415}"
    sleep 8
    if [[ -x "$ROOT/scripts/place-cluster-model.sh" ]]; then
      "$ROOT/scripts/place-cluster-model.sh" "${DEMO_MODEL_ID}" || echo "AUTO_PLACE_MODEL: placement failed (cluster may still be starting — run scripts/place-cluster-model.sh manually)"
    else
      bash "$ROOT/scripts/place-cluster-model.sh" "${DEMO_MODEL_ID}" || echo "AUTO_PLACE_MODEL: placement failed"
    fi
  ) &
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Colyni coordinator — same Wi‑Fi (LAN)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ "$LAN_IP" == "127.0.0.1" ]]; then
  echo "  ⚠ LAN IP not detected — URLs below use loopback. Set a real IP, e.g.:"
  echo "      LAN_IP=192.168.x.x $0   (or export LAN_IP before running)"
  echo ""
fi
echo "  On this Mac only (localhost):"
echo "    Cluster UI:   http://127.0.0.1:52415"
echo "    Colyni API:   http://127.0.0.1:${COLYNI_BACKEND_PORT}"
echo ""
echo "  On phones / other laptops — use LAN IP (${LAN_IP}):"
echo "    Cluster UI:   http://${LAN_IP}:52415"
echo "    Colyni API:   http://${LAN_IP}:${COLYNI_BACKEND_PORT}"
if [[ "${WITH_VITE:-}" == "1" ]]; then
  echo "    Vite (dev):   http://${LAN_IP}:5173"
fi
echo ""
echo "  One-click invite (guests open in browser — contributor + API prefilled):"
echo "    $(colyni_invite_url 52415)"
if [[ "${WITH_VITE:-}" == "1" ]]; then
  echo "    $(colyni_invite_url 5173)"
fi
echo ""
echo "  Contributors (manual): Settings → Contributor → Coordinator API →"
echo "    http://${LAN_IP}:${COLYNI_BACKEND_PORT}"
echo ""
echo "  If other devices cannot open http://${LAN_IP}:52415:"
echo "    • macOS: System Settings → Network → Firewall — allow incoming for Python / colyni-cluster"
echo "    • Wrong IP? Run: ipconfig getifaddr en0  (and en1) — then: LAN_IP=192.168.x.x $0"
echo "    • From guest: curl -sS -o /dev/null -w '%{http_code}\\n' http://${LAN_IP}:52415/"
echo "    • Copy invite only after opening the cluster UI with the LAN URL (not localhost)"
echo ""
echo "  Stop: Ctrl+C"
echo "  Env:  LAN_IP=… · SKIP_UI_BUILD=1 · WITH_VITE=1 · COLYNI_DEMO_LAN=0"
echo "        AUTO_PLACE_MODEL=1 DEMO_MODEL_ID=org/name — auto-request GPU instance after boot"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

wait
