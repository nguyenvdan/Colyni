#!/usr/bin/env bash
# Demo on a second laptop: run the local colyni-cluster worker so it joins the LAN mesh.
# Point the Colyni browser app at the host's API (Settings → Contributor).
# Prerequisites: ./scripts/setup.sh on this machine too, plus: cd inference && uv sync
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ ! -d "$ROOT/inference" ]]; then
  echo "Missing colyni/inference — run from the repo."
  exit 1
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

VITE_PID=""
cleanup() {
  if [[ -n "$VITE_PID" ]] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill "$VITE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if [[ "${WITH_VITE:-}" == "1" ]]; then
  if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    echo "Run ./scripts/setup.sh first (need frontend/node_modules)."
    exit 1
  fi
  echo "==> Starting Vite on :5173 (--host) — open http://${LAN_IP}:5173"
  (cd "$ROOT/frontend" && npm run dev -- --host) &
  VITE_PID=$!
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo " Colyni contributor (this Mac runs a cluster worker)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Keep this terminal open — colyni-cluster is starting below."
echo "  2. In the browser (this Mac or yours):"
echo "       Settings → Contributor"
echo "       Coordinator Colyni API → http://<HOST_MAC_LAN_IP>:8787"
if [[ -n "${COORDINATOR_URL:-}" ]]; then
  echo "     (you set COORDINATOR_URL=${COORDINATOR_URL})"
fi
echo "  3. Your node id should fill from http://127.0.0.1:52415/node_id"
echo ""
echo "  WITH_VITE=1 → also serve http://${LAN_IP}:5173 for the React app"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

cd "$ROOT/inference"
uv run colyni-cluster
