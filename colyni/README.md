# Colyni

Token economy + UI for distributed LLM inference. The **Colyni API** proxies OpenAI-compatible chat to your inference stack (e.g. [exo](https://github.com/exo-explore/exo)) and tracks credits.

**Multiple Macs (one coordinator + two compute laptops):** see **[quickstart.md](./quickstart.md)**.

## Quick start

### 1. One-time setup

From this directory:

```bash
chmod +x scripts/setup.sh scripts/dev.sh scripts/build-cluster-ui.sh
./scripts/setup.sh
```

This creates Python `backend/.venv`, installs dependencies, copies `backend/.env.example` → `backend/.env`, and runs `npm install` in `frontend/`.

Edit **`backend/.env`** if your inference URL is not `http://127.0.0.1:52415`. Include **`http://localhost:52415`** (and your LAN origin) in **`CORS_ORIGINS`** when you use the cluster UI below.

### 2. Build the cluster UI (Colyni React, served by `colyni-cluster`)

The inference server serves **`frontend/dist`** instead of the legacy Svelte dashboard:

```bash
./scripts/build-cluster-ui.sh
```

### 3. Inference (`colyni-cluster`)

Run your stack so it exposes something like `http://127.0.0.1:52415` with `/v1/models` and `/v1/chat/completions`. Confirm:

```bash
curl -s http://127.0.0.1:52415/v1/models | head
```

Open **http://127.0.0.1:52415** for the Colyni UI (keep the Colyni API on **8787** for credits — see below).

### 4. Run Colyni API (ledger + proxies)

In another terminal:

```bash
cd backend && source .venv/bin/activate && uvicorn main:app --host 0.0.0.0 --port 8787
```

### 5. Dev alternative: Vite + `dev.sh`

For hot-reload UI work (without using :52415):

```bash
./scripts/dev.sh
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` and `/v1` to the Colyni backend on port **8787**.

### 6. Credits

Balances start at `0`. Grant credits for your node (id from **Contribute** or `GET /api/cluster/self-id`):

```bash
curl "http://127.0.0.1:8787/api/admin/grant?node_id=YOUR_NODE_ID&amount=500"
```

## Environment

| Variable | Where | Purpose |
|----------|--------|---------|
| `INFERENCE_BASE_URL` | `backend/.env` | Base URL of exo / OpenAI-compatible API |
| `COLYNI_DATABASE` | `backend/.env` | SQLite path (default: `backend/colyni.db`) |
| `CORS_ORIGINS` | `backend/.env` | Comma-separated browser origins |
| `VITE_COLYNI_API_URL` | `frontend/.env` | **Production only**: full API origin; leave unset in dev |
| `VITE_COLYNI_LEDGER_URL` | `frontend/.env` | Rare; override Colyni API URL when the UI is not embedded on :52415 |
| `COLYNI_BACKEND_PORT` | shell | Override backend port for `dev.sh` (default `8787`) |

## Production build

```bash
cd frontend
npm run build
```

Serve the `frontend/dist` static files and reverse-proxy **`/api`** and **`/v1`** to the Colyni API, **or** set `VITE_COLYNI_API_URL` at build time to your API’s public URL.

Run the API with a production ASGI server, for example:

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8787
```

Lock down or remove `/api/admin/*` before exposing to the internet.

## Layout

- `backend/` — FastAPI app, SQLite ledger, proxy to inference
- `frontend/` — React + Vite + Tailwind
- `scripts/setup.sh` — install deps
- `scripts/dev.sh` — backend + Vite in one terminal
