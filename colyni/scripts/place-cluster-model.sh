#!/usr/bin/env bash
# Ask colyni-cluster to create a running GPU instance for a model (POST /place_instance).
# Use after the cluster is up, or from demo automation (see demo-coordinator.sh).
set -euo pipefail

INFERENCE="${INFERENCE_URL:-http://127.0.0.1:52415}"
INFERENCE="${INFERENCE%/}"
MODEL_ID="${1:-${DEMO_MODEL_ID:-}}"

if [[ -z "$MODEL_ID" ]]; then
  echo "Usage: $0 <model_id>"
  echo "   or: DEMO_MODEL_ID=org/name $0"
  echo "Env: INFERENCE_URL (default http://127.0.0.1:52415)"
  echo "    PLACE_MODEL_WAIT_SECS — max seconds to wait for cluster HTTP (default 180)"
  exit 1
fi

WAIT_TOTAL="${PLACE_MODEL_WAIT_SECS:-180}"
max_iters=$((WAIT_TOTAL / 2))
echo "==> Waiting for cluster at ${INFERENCE} (up to ${WAIT_TOTAL}s)…"
ok=0
for ((i = 0; i < max_iters; i++)); do
  if curl -sf "${INFERENCE}/state" >/dev/null 2>&1; then
    echo "==> Cluster responded."
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" != "1" ]]; then
  echo "ERROR: Cluster not reachable at ${INFERENCE} — is colyni-cluster running?"
  exit 1
fi

JSON="$(python3 -c "import json,sys; print(json.dumps({
  'model_id': sys.argv[1],
  'sharding': 'Pipeline',
  'instance_meta': 'MlxRing',
  'min_nodes': 1,
}))" "${MODEL_ID}")"

echo "==> Placing instance: ${MODEL_ID}"
out="$(mktemp)"
trap 'rm -f "${out}"' EXIT
code="$(curl -sS -o "${out}" -w "%{http_code}" \
  -X POST "${INFERENCE}/place_instance" \
  -H "Content-Type: application/json" \
  -d "${JSON}")"

cat "${out}"
echo ""

if [[ "${code}" != "200" ]] && [[ "${code}" != "201" ]]; then
  echo "ERROR: HTTP ${code}"
  exit 1
fi

echo "==> Command accepted — watch ${INFERENCE} until the model shows running, then try Chat."
