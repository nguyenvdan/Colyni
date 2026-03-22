# Colyni
# Colyni

Token economy + UI for distributed LLM inference across multiple Macs. Colyni sits in front of a [`colyni-cluster`](./inference) (distributed inference runtime forked from [exo](https://github.com/exo-explore/exo)), proxies OpenAI-compatible chat, and tracks credits per contributor node.

---

## Architecture

| Layer | Tech | Port |
|-------|------|------|
| **Inference (`colyni-cluster`)** | Python / MLX (Apple Silicon) | `:52415` |
| **Colyni API (ledger + proxy)** | FastAPI + SQLite | `:8787` |
| **Frontend (React + Vite)** | React, Tailwind, TypeScript | `:5173` (dev) / served from `:52415` (prod) |

```
Browser → colyni-cluster :52415 (serves React UI + OpenAI API)
              │
              └─► Colyni backend :8787  (credits, admin, CORS proxy)
```

**3-Mac demo:** 1 coordinator (runs everything) + 2 contributor workers (GPU/RAM only).

---

## Prerequisites

- macOS with Apple Silicon (Metal / MLX required for inference)
- Full **Xcode** installed + Metal Toolchain component (`xcodebuild -downloadComponent MetalToolchain`)
- `uv` (`brew install uv`)
- Node.js ≥ 18 (`nvm` recommended)

---

## Setup (one-time, each Mac)

```bash
cd colyni
chmod +x scripts/*.sh
./scripts/setup.sh                      # installs Python venv + npm deps
cd inference && uv sync && cd ..        # sync inference Python environment
./scripts/build-cluster-ui.sh          # builds frontend/dist for colyni-cluster to serve
```

---

## 3-Mac Demo

### Mac 1 — Coordinator

```bash
cd colyni
./scripts/demo-3-macs.sh coordinator
```

Starts `colyni-cluster` on `:52415` and the Colyni backend on `:8787`. Prints your LAN URLs.

### Mac 2 & 3 — Contributors

```bash
cd colyni
./scripts/demo-3-macs.sh contributor
```

Joins the inference cluster. Then in the Colyni browser app:  
**Settings → Contributor → Coordinator Colyni API = `http://<MAC1_LAN_IP>:8787`**

Or use Mac 1's invite link (**Settings → Invite a teammate**) to auto-fill the coordinator URL.

---

## Manual Dev Mode

```bash
# Terminal 1: backend + Vite hot-reload
./scripts/dev.sh
# Open http://localhost:5173

# Or run separately:
cd backend && source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8787

cd frontend && npm run dev
```

---

## Key Environment Variables (`backend/.env`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `INFERENCE_BASE_URL` | `http://127.0.0.1:52415` | Where `colyni-cluster` is listening |
| `CORS_ORIGINS` | localhost variants | Allowed browser origins |
| `COLYNI_DATABASE` | `backend/colyni.db` | SQLite path |
| `COLYNI_DEMO_FREE_CHAT` | `0` | Set `1` to skip token deduction in demo |

---

## Credits

Balances start at `0`. Grant tokens to a node for demo use:

```bash
curl "http://127.0.0.1:8787/api/admin/grant?node_id=YOUR_NODE_ID&amount=500"
```

Node IDs are shown in **Settings → Contribute** or from `GET http://127.0.0.1:52415/node_id`.

---

## Project Layout

```
colyni/
├── backend/        FastAPI app — ledger, admin, OpenAI proxy
├── frontend/       React + Vite + Tailwind UI
├── inference/      colyni-cluster distributed inference runtime (Python/MLX)
├── scripts/
│   ├── demo-3-macs.sh          Single entry point for coordinator/contributor
│   ├── demo-coordinator.sh     Start coordinator (inference + backend)
│   ├── demo-contributor.sh     Start worker node
│   ├── build-cluster-ui.sh     Build React app into frontend/dist
│   └── setup.sh                One-time dependency install
├── quickstart.md   Detailed 3-Mac setup guide
└── preloadguide.md Model preload + demo checklist
```

---

## Restarting the Contributor Worker

If you need to restart after a `git pull`:

```bash
cd colyni
git pull
cd inference && uv sync && cd ..
pkill -9 -f 'colyni-cluster|demo-contributor|demo-3-macs' 2>/dev/null || true
sleep 2
bash scripts/demo-3-macs.sh contributor
```
