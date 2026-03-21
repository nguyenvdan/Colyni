# Colyni — Quickstart: 3 MacBooks

This guide is for **one Mac running the Colyni app (UI + API)** and **two Macs contributing GPU/RAM to the same inference cluster** (Colyni cluster inference in this repo, originally derived from [exo](https://github.com/exo-explore/exo)). All three should be on the **same network** (same Wi‑Fi or LAN).

| Role | Machine | What runs |
|------|---------|-----------|
| **Coordinator** | Mac 1 | Colyni (backend + UI), and the **main `colyni-cluster` inference process** that exposes the OpenAI-compatible API |
| **Workers** | Mac 2 & Mac 3 | `colyni-cluster` (or your stack) in **peer / worker** mode so they join the cluster and contribute compute |

Colyni does **not** replace the cluster runtime’s discovery — it sits **in front** of whatever machine exposes `/v1/models` and `/v1/chat/completions`, and tracks credits per **node id**.

---

## One-command demo (automated)

After `./scripts/setup.sh` and a one-time `cd inference && uv sync` on each machine that will run `colyni-cluster`:

**Mac 1 — coordinator (runs LLM + Colyni API):**

```bash
cd colyni
chmod +x scripts/demo-coordinator.sh scripts/demo-contributor.sh
./scripts/demo-coordinator.sh
```

This runs `./scripts/build-cluster-ui.sh`, starts `colyni-cluster` (inference + UI on **:52415**), and starts the Colyni backend on **0.0.0.0:8787** with LAN-friendly **CORS** for :5173 and :52415. It prints your LAN URLs for others.

- `SKIP_UI_BUILD=1` — skip the frontend build if you already ran `build-cluster-ui.sh`.
- `WITH_VITE=1` — also start Vite with `--host` on **:5173** for hot-reload UI work.
- `COLYNI_DEMO_LAN=0` — do not override `CORS_ORIGINS`; use only what is in `backend/.env`.

**Mac 2+ — contributor (worker only):**

```bash
cd colyni
./scripts/demo-contributor.sh
```

Then in the Colyni app: **Settings → Contributor** → Coordinator API = `http://<Mac_1_LAN_IP>:8787`. Optional: `WITH_VITE=1` on the contributor to serve the React dev app from that laptop.

**Seamless option:** On Mac 1, open the app using your **LAN IP** (e.g. `http://192.168.x.x:52415`), go to **Settings → Invite a teammate**, and **Copy invite link**. Send that URL to Mac 2 — opening it in a browser sets contributor mode and the coordinator API automatically (no manual URL fields).

---

## Before you start

1. **Same subnet** — All three Macs can ping each other (e.g. `ping 192.168.1.10`).
2. **Pick a stable IP for Mac 1** — In **System Settings → Network**, note Mac 1’s IPv4 address (e.g. `192.168.1.10`). Use that below as `HOST_IP`.
3. **Cluster docs** — Multi-node setup (discovery, ports, firewall) follows **`inference/README.md`** (upstream exo docs are still a good reference). This file only covers how Colyni fits in.

---

## Mac 1 (coordinator): Colyni + inference API

1. Clone the repo and run setup (once):

   ```bash
   cd colyni
   chmod +x scripts/setup.sh scripts/dev.sh scripts/build-cluster-ui.sh scripts/demo-coordinator.sh scripts/demo-contributor.sh
   ./scripts/setup.sh
   ```

2. **Build the Colyni UI** that `colyni-cluster` will serve (instead of the legacy exo Svelte dashboard):

   ```bash
   ./scripts/build-cluster-ui.sh
   ```

3. **Start `colyni-cluster`** (from `colyni/inference`) on Mac 1 so the API is reachable — typically `http://127.0.0.1:52415` (see `inference/README.md`). Open that URL to use the **Colyni** React app; credits still go through the Colyni backend on **8787**.

4. Edit **`backend/.env`**:

   ```env
   INFERENCE_BASE_URL=http://127.0.0.1:52415
   CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://HOST_IP:5173,http://localhost:52415,http://127.0.0.1:52415,http://HOST_IP:52415
   ```

   Replace `HOST_IP` with Mac 1’s LAN IP so **Mac 2 and Mac 3 browsers** are allowed to talk to the API.

5. **Expose Colyni to the LAN** (other Macs will open the UI here):

   **Backend** — listen on all interfaces:

   ```bash
   cd backend && source .venv/bin/activate
   uvicorn main:app --host 0.0.0.0 --port 8787
   ```

   **Frontend** — Vite must bind to the LAN (separate terminal):

   ```bash
   cd frontend && npm run dev -- --host
   ```

   Or use `./scripts/dev.sh` only if you change it to pass `--host` to Vite and `0.0.0.0` to uvicorn (see README for ports).

6. **Open the app** — either the Vite dev UI (**http://localhost:5173** with `./scripts/dev.sh`) **or** the cluster UI served by inference (**http://localhost:52415** after `build-cluster-ui.sh`). From Mac 2 / Mac 3 browsers: **http://HOST_IP:5173** or **http://HOST_IP:52415** as appropriate.

---

## Mac 2 & Mac 3 (workers): contribute compute

1. Install and run **`colyni-cluster`** (or the same stack) in **multi-node / peer** mode so they **join Mac 1’s cluster**. Exact flags and ports are in **`inference/README.md`** — typical needs:

   - Same Wi‑Fi / multicast or TCP discovery as Mac 1  
   - macOS **Firewall**: allow incoming for the cluster ports if prompted  
   - No sleep during the demo (Energy Saver)

2. These Macs **do not have to run Colyni** unless you want a local UI for debugging. Their job is to stay in the cluster so inference can use their GPUs.

3. In Colyni’s **Contribute** tab (on any machine with the UI), you should see **cluster nodes** and memory when the stack is healthy.

---

## Credits and node IDs (important)

- Each physical machine has its own **node id** (shown under **Contribute → Your node id**, from the inference API’s `/node_id` or equivalent).
- **Chat** spends credits for the node id sent in the `X-Colyni-Node` header (the app uses the id detected on **that** browser’s machine, or a stored id).
- **Workers** earn tokens when they participate in inference (see backend `settle_earn_for_task` / trace stats). For **fair split across ranks**, you can map inference ranks to node ids:

  ```bash
  curl -X POST "http://HOST_IP:8787/api/admin/rank-binding" \
    -H "Content-Type: application/json" \
    -d '{"rank": 0, "node_id": "NODE_ID_FROM_MAC_2"}'
  ```

  Repeat for each rank / machine as needed (adjust `rank` per your cluster).

- **Bootstrap balances** (demo only):

  ```bash
  curl "http://HOST_IP:8787/api/admin/grant?node_id=PASTE_NODE_ID&amount=500"
  ```

  Run once per node id if each laptop will chat under its own id.

---

## Production-style API URL (optional)

If you **build** the frontend (`npm run build`) and serve static files, set at build time:

```env
VITE_COLYNI_API_URL=http://HOST_IP:8787
```

Then all API calls go to Mac 1’s Colyni backend without relying on Vite’s dev proxy.

---

## Checklist

| Step | Owner |
|------|--------|
| Same network; Mac 1 `HOST_IP` known | Everyone |
| exo cluster up: Mac 1 + Mac 2 + Mac 3 | Everyone |
| Colyni backend on `0.0.0.0:8787`, `CORS_ORIGINS` includes `http://HOST_IP:5173` | Mac 1 |
| Vite `npm run dev -- --host` | Mac 1 |
| Open **http://HOST_IP:5173** on Mac 2 / Mac 3 | Supporters |
| Grant credits + optional rank bindings | Coordinator |

---

## Troubleshooting

- **“Cluster unreachable”** — Inference API not running, wrong `INFERENCE_BASE_URL`, or firewall blocking exo.
- **CORS errors from Mac 2/3** — Add their origin (`http://HOST_IP:5173`) to `CORS_ORIGINS` on Mac 1 and restart the backend.
- **Can’t open UI from other Macs** — Use `--host` for Vite and `0.0.0.0` for uvicorn; confirm `HOST_IP` is correct.

For exo-specific discovery and multi-GPU issues, use the exo project’s issues and docs.
