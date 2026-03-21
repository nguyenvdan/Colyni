#!/usr/bin/env bash
# Three-Mac Colyni demo — one entry point to remember.
#
# Prerequisite on EVERY machine that runs colyni-cluster:
#   ./scripts/setup.sh
#   cd inference && uv sync
#
# Usage:
#   Mac 1 (host):     ./scripts/demo-3-macs.sh coordinator
#   Mac 2 & 3:        ./scripts/demo-3-macs.sh contributor
#   Print checklist:  ./scripts/demo-3-macs.sh help
#
# Full write-up: ../quickstart.md
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  sed -n '1,20p' "$0" | tail -n +2
}

help() {
  cat <<'EOF'
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Colyni — 3 Macs (1 coordinator + 2 contributors)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  BEFORE THE DEMO (each Mac that will run colyni-cluster):
    cd colyni
    chmod +x scripts/*.sh
    ./scripts/setup.sh
    cd inference && uv sync && cd ..

  MAC 1 — coordinator (Colyni API + main cluster UI on :52415):
    cd colyni
    ./scripts/demo-3-macs.sh coordinator
    → Share the printed "invite" / LAN URLs with Mac 2 & 3.

  MAC 2 & MAC 3 — contributors (cluster workers only):
    cd colyni
    ./scripts/demo-3-macs.sh contributor
    → Browser: Settings → Contributor → Coordinator API = http://<MAC1_LAN_IP>:8787
    → Or open the invite link from Mac 1 (Settings → Invite a teammate).

  PRELOAD MODEL WEIGHTS (on Mac 1, after all three nodes show in cluster):
    export INFERENCE_URL=http://127.0.0.1:52415
    python3 scripts/prefetch-model-downloads.py "mlx-community/YOUR_MODEL_ID"

  Same Wi-Fi · disable sleep · allow firewall for cluster if prompted.

  Details: colyni/quickstart.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

case "${1:-help}" in
  coordinator|host|1)
    exec "$ROOT/scripts/demo-coordinator.sh"
    ;;
  contributor|worker|2)
    exec "$ROOT/scripts/demo-contributor.sh"
    ;;
  help|-h|--help)
    help
    ;;
  *)
    echo "Unknown command: $1" >&2
    echo "" >&2
    usage >&2
    exit 1
    ;;
esac
