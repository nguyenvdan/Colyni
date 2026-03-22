#!/usr/bin/env bash
# Sourced by demo-coordinator.sh and demo-contributor.sh.
# Restricts the cluster catalog to the three demo MLX models unless overridden.
#
# • COLYNI_FULL_MODEL_CATALOG=1 — show all bundled model cards (no allowlist).
# • COLYNI_CLUSTER_MODEL_ALLOWLIST=id1,id2 — use your own comma-separated list (set before run).

if [[ "${COLYNI_FULL_MODEL_CATALOG:-0}" == "1" ]]; then
  unset COLYNI_CLUSTER_MODEL_ALLOWLIST 2>/dev/null || true
elif [[ -z "${COLYNI_CLUSTER_MODEL_ALLOWLIST:-}" ]]; then
  export COLYNI_CLUSTER_MODEL_ALLOWLIST="mlx-community/Llama-3.2-3B-Instruct-8bit,mlx-community/gemma-3-27b-it-qat-4bit,mlx-community/Llama-3.3-70B-Instruct-4bit"
fi
