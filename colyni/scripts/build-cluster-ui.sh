#!/usr/bin/env bash
# Build the Colyni React app so colyni-cluster can serve it from :52415 (see inference dashboard_path).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Building Colyni frontend → frontend/dist"
cd "$ROOT/frontend"
npm run build

echo ""
echo "Done. Start colyni-cluster from inference/ — it will serve $ROOT/frontend/dist"
echo "Keep the Colyni API on :8787 for credits:  cd $ROOT/backend && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8787"
