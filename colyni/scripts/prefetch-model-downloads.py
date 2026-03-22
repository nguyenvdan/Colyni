#!/usr/bin/env python3
"""
Pre-download model weights to disk via colyni-cluster HTTP API (no full instance placement).

Uses GET /instance/previews to find shard layout, then POST /download/start per node.
After this, the first Chat / place_instance run is much faster (weights already local).

Usage:
  cd colyni && python3 scripts/prefetch-model-downloads.py mlx-community/Some-Model-4bit

Env:
  INFERENCE_URL  default http://127.0.0.1:52415
  PREFETCH_WAIT_SECS  max seconds to wait for DownloadCompleted (default 3600)
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request


def unwrap_instance(raw: object) -> dict | None:
    """API returns instance as either a flat object or wrapped, e.g. {\"MlxRingInstance\": {...}}."""
    if not isinstance(raw, dict):
        return None
    if raw.get("shardAssignments") or raw.get("shard_assignments"):
        return raw
    if len(raw) == 1:
        inner = next(iter(raw.values()))
        if isinstance(inner, dict):
            return inner
    return None


def req_json(method: str, url: str, body: object | None = None) -> tuple[int, object]:
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw.strip() else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            j = json.loads(raw) if raw.strip() else {}
        except json.JSONDecodeError:
            j = {"detail": raw or str(e)}
        return e.code, j


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__.strip(), file=sys.stderr)
        return 1
    model_id = sys.argv[1].strip()
    base = os.environ.get("INFERENCE_URL", "http://127.0.0.1:52415").rstrip("/")
    max_wait = int(os.environ.get("PREFETCH_WAIT_SECS", "3600"))

    q = urllib.parse.urlencode({"model_id": model_id})
    code, data = req_json("GET", f"{base}/instance/previews?{q}")
    if code != 200:
        print(f"ERROR: previews HTTP {code}: {data}", file=sys.stderr)
        return 1

    previews = (data or {}).get("previews") or []
    inst = None
    first_err: str | None = None
    for p in previews:
        if p.get("error") and first_err is None:
            first_err = str(p["error"])
        if p.get("error"):
            continue
        if p.get("instance"):
            inst = p["instance"]
            break
    if not inst:
        hint = ""
        if first_err:
            hint = f" First preview error: {first_err}"
            if "memory" in first_err.lower() or "sufficient" in first_err.lower():
                hint += (
                    " — Large models need enough total RAM across all cluster nodes; "
                    "connect every contributor Mac, then retry prefetch."
                )
        print(
            "ERROR: No valid placement preview (cluster up? model id valid? enough nodes?)."
            + hint,
            file=sys.stderr,
        )
        return 1

    inst = unwrap_instance(inst) or {}
    sa = inst.get("shardAssignments") or inst.get("shard_assignments")
    if not sa:
        print("ERROR: instance missing shardAssignments", file=sys.stderr)
        return 1

    n2r = sa.get("nodeToRunner") or sa.get("node_to_runner") or {}
    r2s = sa.get("runnerToShard") or sa.get("runner_to_shard") or {}
    if not n2r or not r2s:
        print("ERROR: empty nodeToRunner or runnerToShard", file=sys.stderr)
        return 1

    print(f"==> Starting downloads for {model_id} on {len(n2r)} node(s)…")
    for node_id, runner_id in n2r.items():
        shard = r2s.get(runner_id)
        if shard is None:
            print(f"ERROR: missing shard for runner {runner_id}", file=sys.stderr)
            return 1
        body = {"targetNodeId": node_id, "shardMetadata": shard}
        c, resp = req_json("POST", f"{base}/download/start", body)
        if c not in (200, 201):
            print(f"ERROR: download/start HTTP {c} for node {node_id}: {resp}", file=sys.stderr)
            return 1
        print(f"    OK node {node_id} (command {resp.get('commandId', resp)})")

    def item_tag(item: object) -> str | None:
        if not isinstance(item, dict) or len(item) != 1:
            return None
        return next(iter(item.keys()))

    def shard_mentions_model(item: object, mid: str) -> bool:
        if not isinstance(item, dict) or len(item) != 1:
            return False
        payload = next(iter(item.values()))
        if not isinstance(payload, dict):
            return False
        return mid in json.dumps(payload)

    print("==> Waiting for downloads to finish (check cluster UI or terminal)…")
    deadline = time.time() + max_wait
    while time.time() < deadline:
        time.sleep(5)
        c, st = req_json("GET", f"{base}/state")
        if c != 200:
            continue
        downloads = (st or {}).get("downloads") or {}
        failed = False
        completed_nodes: set[str] = set()
        for node_id in n2r.keys():
            entries = downloads.get(node_id) or []
            for item in entries:
                tag = item_tag(item)
                if tag == "DownloadFailed" and isinstance(item, dict):
                    inner = item.get("DownloadFailed") or {}
                    err = inner.get("errorMessage") or inner.get("error_message") or "?"
                    if shard_mentions_model(item, model_id):
                        print(f"ERROR: download failed on {node_id}: {err}", file=sys.stderr)
                        failed = True
                if tag == "DownloadCompleted" and shard_mentions_model(item, model_id):
                    completed_nodes.add(str(node_id))
        if failed:
            return 1
        if len(completed_nodes) >= len(n2r):
            print(
                "==> Downloads complete — weights are on disk. "
                "First Chat placement still loads into GPU memory (faster than a cold HF pull)."
            )
            return 0

    print(
        "WARN: Timed out waiting for all DownloadCompleted events. "
        "Downloads may still be running — check :52415 or the terminal.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
