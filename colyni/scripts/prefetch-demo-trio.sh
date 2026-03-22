#!/usr/bin/env bash
# Prefetch the three demo models (preloadguide / demo narrative).
#
# Llama 3.2 3B fits one machine. Qwen3.5 27B and Llama 3.3 70B need enough *total*
# cluster RAM — start every contributor Mac and join the mesh *before* running this.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export INFERENCE_URL="${INFERENCE_URL:-http://127.0.0.1:52415}"

MODELS=(
  "mlx-community/Llama-3.2-3B-Instruct-8bit"
  "mlx-community/Qwen3.5-27B-4bit"
  "mlx-community/Llama-3.3-70B-Instruct-4bit"
)

for m in "${MODELS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Prefetch: $m"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  python3 scripts/prefetch-model-downloads.py "$m"
done

echo ""
echo "==> All three demo models prefetched (or already complete)."
