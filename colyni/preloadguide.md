# Colyni preload & three-Mac demo guide

Use this for **recorded demos** or **hackathons** so downloads don’t block the moment you hit record. Weights still **load into GPU** on first use; prefetch removes the long **Hugging Face pull** across the cluster.

---

## Prerequisites (every Mac that runs `colyni-cluster`)

From the repo root:

```bash
cd colyni
chmod +x scripts/setup.sh scripts/demo-3-macs.sh scripts/demo-coordinator.sh scripts/demo-contributor.sh scripts/prefetch-model-downloads.py
./scripts/setup.sh
cd inference && uv sync && cd ..
```

- All machines on the **same Wi‑Fi** (or LAN), can `ping` each other.
- **Disable sleep** during the demo; allow **firewall** prompts for the cluster if asked.

### LAN URL does not load (other laptop / phone)

The cluster UI is served on **port 52415** bound to all interfaces (`0.0.0.0`). If `http://<Mac1-IP>:52415` never loads:

1. **Coordinator script running?** You should see “Running on http://0.0.0.0:52415” in the terminal.
2. **Correct IP?** On Mac 1 run `ipconfig getifaddr en0` and `en1`, or `./scripts/detect-lan-ip.sh`. If the script picked the wrong interface, restart with  
   `LAN_IP=192.168.x.x ./scripts/demo-3-macs.sh coordinator`
3. **macOS Firewall** — System Settings → Network → Firewall → allow **incoming** for **Python** / **colyni-cluster** (or temporarily turn Firewall off to test).
4. **From the guest machine:**  
   `curl -sS -o /dev/null -w '%{http_code}\n' http://<Mac1-IP>:52415/`  
   Expect `200`. If it hangs or fails, it’s network/firewall, not the browser.
5. **Guest Wi‑Fi isolation** — Some routers block device-to-device; try another network or disable “AP isolation”.
6. **Invite link:** Open the coordinator UI using **`http://<LAN-IP>:52415`** in the address bar (not `localhost`) before **Copy invite link**, or guests may get a bad link (see Settings warning).

---

## Roles

| Machine | Role | Command |
|---------|------|---------|
| **Mac 1** | Coordinator — Colyni API + cluster UI + main `colyni-cluster` | `./scripts/demo-3-macs.sh coordinator` |
| **Mac 2 & 3** | Contributors — workers only | `./scripts/demo-3-macs.sh contributor` |

Equivalent scripts: `demo-coordinator.sh` and `demo-contributor.sh` (same behavior).

### Coordinator (Mac 1)

```bash
cd colyni
./scripts/demo-3-macs.sh coordinator
```

This builds the cluster UI, starts **colyni-cluster** (e.g. **:52415**), and the Colyni backend (**8787**). Note the printed **LAN** URLs.

### Contributors (Mac 2 & 3)

```bash
cd colyni
./scripts/demo-3-macs.sh contributor
```

In the browser (any Mac):

- **Settings → Contributor** → **Coordinator Colyni API** = `http://<MAC1_LAN_IP>:8787`

**Easiest:** On Mac 1, **Settings → Invite a teammate → Copy invite link** and open that link on Mac 2/3 so the coordinator URL is prefilled.

### Copy-paste for teammates

```text
cd colyni && ./scripts/setup.sh && cd inference && uv sync && cd .. && ./scripts/demo-3-macs.sh contributor
```

Give them **Mac 1’s LAN IP** and port **8787**, or the **invite link**.

### Checklist without opening this file

```bash
./scripts/demo-3-macs.sh help
```

---

## Download from the terminal (outside Colyni — **no** multi-node requirement)

Colyni stores models under **`~/.colyni-cluster/models/<org--model>/`** on macOS (slash in `org/model` becomes `--`). You can fill that folder yourself; the cluster will use it the same way as an in-app download.

**Disk:** A 70B 4-bit repo is on the order of **~40 GiB** on disk; 27B 4-bit **~16 GiB**. Ensure enough free space before downloading (check with `df -h ~`).

**Option A — helper script (uses `huggingface_hub` from `inference`):**

```bash
cd colyni/inference && uv sync   # once
uv run python ../scripts/download-model-hf-to-colyni.py "mlx-community/Qwen3.5-27B-4bit"
```

**Option B — Hugging Face CLI** (install with `pip install huggingface_hub[cli]` or `uv tool install huggingface_hub`):

```bash
MODEL="mlx-community/Qwen3.5-27B-4bit"
DEST="$HOME/.colyni-cluster/models/${MODEL//\//--}"
huggingface-cli download "$MODEL" --local-dir "$DEST" --local-dir-use-symlinks False
```

Use a **HF token** for gated repos: `export HF_TOKEN=...` or `hf auth login`.

---

## Preload model weights (after all nodes join)

Run on **Mac 1** (coordinator), **after** Mac 2 & 3 show up in the cluster UI:

```bash
cd colyni
export INFERENCE_URL="${INFERENCE_URL:-http://127.0.0.1:52415}"
python3 scripts/prefetch-model-downloads.py "mlx-community/YOUR_MODEL_ID"
```

Replace `YOUR_MODEL_ID` with the catalog id (e.g. `Llama-3.3-70B-Instruct-4bit`). The script uses `/instance/previews` and `/download/start` so **each node** pulls its shard.

**Environment:**

| Variable | Default | Meaning |
|----------|---------|---------|
| `INFERENCE_URL` | `http://127.0.0.1:52415` | Cluster HTTP API |
| `PREFETCH_WAIT_SECS` | `3600` | Max time to wait for downloads to finish |

Repeat for **each** model you plan to show, or prefetch only your hero model before recording.

---

## Optional: same weights on every laptop without re-downloading

If each machine must have files **without** hitting Hugging Face again, copy the normalized model folder after one successful download.

- On-disk name: `org/model` → `org--model` (slash becomes `--`).
- Default data root on macOS is often `~/.colyni-cluster/models/` (see `COLYNI_CLUSTER_HOME` / `COLYNI_CLUSTER_MODELS_DIR` in upstream docs).

Copy `~/.colyni-cluster/models/<org--model>/` to the other Macs in the same path, **or** set:

```bash
export COLYNI_CLUSTER_MODELS_PATH="/path/to/parent/containing/org--model"
```

before starting `colyni-cluster`. The coordinator checks this path before downloading.

---

## Warm up before you record

After prefetch completes, **place** the model and send a **short throwaway prompt** once so the first real take isn’t paying cold-start latency. See `quickstart.md` for `AUTO_PLACE_MODEL` / `place-cluster-model.sh`.

---

## More detail

- **Full LAN / CORS / ports:** [quickstart.md](./quickstart.md)
- **Inference stack:** [inference/README.md](./inference/README.md)
