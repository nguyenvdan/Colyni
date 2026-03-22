#!/usr/bin/env python3
"""
Download a Hugging Face repo into Colyni's local model directory (no cluster placement).

Uses the same layout as colyni-cluster: ~/.colyni-cluster/models/<org--model>/ on macOS
(override with COLYNI_CLUSTER_MODELS_DIR / COLYNI_CLUSTER_HOME — see inference constants).

Run from repo (uses inference deps):

  cd colyni/inference && uv run python ../scripts/download-model-hf-to-colyni.py "mlx-community/Some-Model-4bit"

Or with huggingface-cli (same target path):

  huggingface-cli download mlx-community/Some-Model-4bit \\
    --local-dir ~/.colyni-cluster/models/mlx-community--Some-Model-4bit \\
    --local-dir-use-symlinks False

Gated models: export HF_TOKEN=... or run `hf auth login`.
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

_APP = "colyni-cluster"


def colyni_models_dir() -> Path:
    m = os.environ.get("COLYNI_CLUSTER_MODELS_DIR") or os.environ.get("EXO_MODELS_DIR")
    if m:
        return (Path.home() / m).expanduser().resolve()
    h = os.environ.get("COLYNI_CLUSTER_HOME") or os.environ.get("EXO_HOME")
    if h:
        return (Path.home() / h / "models").expanduser().resolve()
    if sys.platform != "linux":
        return (Path.home() / f".{_APP}" / "models").resolve()
    xdg = os.environ.get("XDG_DATA_HOME", str(Path.home() / ".local" / "share"))
    return (Path(xdg) / _APP / "models").resolve()


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("model_id", help='Hugging Face repo id, e.g. mlx-community/Qwen3.5-27B-4bit')
    p.add_argument(
        "--revision",
        default="main",
        help="Git revision (default: main)",
    )
    args = p.parse_args()

    model_id = args.model_id.strip()
    if "/" not in model_id:
        print("model_id should look like org/name", file=sys.stderr)
        return 1

    normalized = model_id.replace("/", "--")
    root = colyni_models_dir()
    target = root / normalized

    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print(
            "Install huggingface_hub (e.g. cd colyni/inference && uv sync), "
            "or use huggingface-cli with --local-dir as in this script's docstring.",
            file=sys.stderr,
        )
        return 1

    print(f"==> Downloading {model_id} @ {args.revision}")
    print(f"==> Target (Colyni cache): {target}")
    target.mkdir(parents=True, exist_ok=True)

    snapshot_download(
        repo_id=model_id,
        revision=args.revision,
        local_dir=str(target),
    )
    print("==> Done. Restart or start colyni-cluster; it should find weights under that path.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
