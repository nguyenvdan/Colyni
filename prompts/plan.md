# Colyni — HooHacks 2026 Project Plan

> Distributed LLM inference with a token economy. Contributors share GPU, earn Colyni tokens, spend tokens to run models too large for any single device.

---

## The Demo (What Judges See)

1. Open Colyni dashboard — shows 3 nodes online (3x MacBooks)
2. Attempt Qwen3-32B on a single 16GB Mac — it crawls or fails
3. Submit same prompt through Colyni — all 3 machines light up, model runs
4. Each node's token counter increments in real time as it contributes compute
5. Final screen: "You earned 12 tokens. Spend them to run inference on the network."

**The pitch:** *"This 32B model cannot run on any of these laptops alone. On Colyni, it runs — and you get paid for your GPU."*

---

## Stack

| Layer | Tech |
|---|---|
| Distributed inference | exo (https://github.com/exo-explore/exo) |
| Backend API | FastAPI + SQLite |
| Frontend | React + Vite (or Next.js) |
| Token ledger | SQLite table (centralized for hackathon, pitch on-chain for v2) |
| Styling | Tailwind CSS |

---

## Project Structure

```
colyni/
├── backend/
│   ├── main.py              # FastAPI app
│   ├── ledger.py            # Token logic (earn, spend, balance)
│   ├── nodes.py             # Node registry (heartbeat, status)
│   ├── inference.py         # Proxy requests to exo API
│   └── database.py          # SQLite setup
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx      # Main contributor view
│   │   │   ├── Benchmark.jsx      # Solo vs cluster comparison
│   │   │   └── Inference.jsx      # Spend tokens, run a prompt
│   │   └── components/
│   │       ├── NodeCard.jsx       # Live node status card
│   │       ├── TokenCounter.jsx   # Animated token earnings
│   │       └── BenchmarkChart.jsx # Solo vs cluster bar chart
│   └── package.json
├── exo/                     # Cloned exo repo (submodule or separate)
└── README.md
```

---

## Timeline (24 Hours)

### Hour 0–2 | Setup & Cluster
- [ ] All 3 machines: clone exo, install deps, boot exo
- [ ] Verify all 3 nodes discover each other on same network
- [ ] Run Qwen3-32B across the cluster, confirm it works
- [ ] Record baseline: Qwen3-32B on single 16GB (slow/fail) vs cluster

### Hour 2–5 | Backend
- [ ] FastAPI project scaffold
- [ ] SQLite schema: `nodes`, `tokens`, `requests`
- [ ] `POST /node/heartbeat` — nodes ping in every 30s with status
- [ ] `GET /nodes` — list active nodes
- [ ] `POST /inference` — proxy prompt to exo, track which nodes served it
- [ ] `GET /tokens/{node_id}` — return token balance
- [ ] Token earning logic: tokens awarded per inference request proportional to layers served

### Hour 5–9 | Frontend
- [ ] Vite + React + Tailwind scaffold
- [ ] **Dashboard page** — live node grid, each card shows: node name, memory, tokens earned, status indicator
- [ ] **Token counter** — animates up in real time when a request is served
- [ ] **Inference page** — text input, submit prompt, shows which nodes lit up, response streams in
- [ ] **Benchmark page** — two columns: "Solo" vs "Colyni Cluster", shows time and tok/sec side by side

### Hour 9–14 | Integration & Polish
- [ ] Connect frontend to backend API
- [ ] Hook inference flow: frontend → Colyni backend → exo → response back
- [ ] Make token counter update live (poll every 2s or websocket)
- [ ] Polish node cards (online/offline state, pulse animation for active nodes)
- [ ] Dark theme, clean typography — make it look like a real product

### Hour 14–20 | Demo Hardening
- [ ] Run full demo flow 3+ times end to end
- [ ] Handle edge cases: node drops off network, exo restarts
- [ ] Hardcode fallbacks if wifi at venue is flaky (hotspot backup plan)
- [ ] Record a screen capture of the demo working as insurance

### Hour 20–24 | Pitch & Submission
- [ ] Write README with demo instructions
- [ ] 3-slide pitch deck: Problem → Solution → Live Demo
- [ ] Submit to Devpost
- [ ] Practice demo handoff between Kai (frontend/pitch) and Dan (backend/infra)

---

## Division of Labor

| Kai | Dan |
|---|---|
| Frontend (Dashboard, Benchmark, Inference UI) | Backend (FastAPI, token ledger, node registry) |
| Pitch narrative and demo script | exo setup and cluster networking |
| Benchmark data collection | Inference proxy to exo |
| Design and branding | Database schema |

---

## Token Economy (Keep Simple for Hackathon)

- Every inference request = **10 tokens** distributed across contributing nodes
- Distribution proportional to layers each node served (exo reports this)
- Tokens stored in SQLite, displayed on dashboard
- "Spending" tokens = submitting a prompt through the Colyni UI (costs 5 tokens)
- **No real blockchain** — pitch on-chain ledger as v2 on Solana

---

## Benchmark Numbers (Collected Tonight)

| Setup | Model | Time | Tok/sec |
|---|---|---|---|
| Kai M3 24GB solo | llama3.2:3b | 24s | TBD |
| Kai M3 24GB solo | Qwen3-32B | TBD | TBD |
| Dan M3 16GB solo | llama3.1:8b | TBD | TBD |
| Dan M3 16GB solo | Qwen3-32B | TBD (likely fails) | — |
| Colyni Cluster (3x Mac) | Qwen3-32B | TBD | TBD |

---

## Pitch Angle

**Problem:** Running large models locally requires expensive hardware. Cloud inference is costly and centralized.

**Solution:** Colyni turns idle GPU across any device into a shared inference pool. Contribute compute, earn tokens, run models you couldn't run alone.

**Why now:** exo proves distributed inference across consumer devices is real. We built the incentive layer on top.

**Moat:** The token economy + contributor UX. exo is infra. Colyni is the product.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Hackathon wifi blocks mDNS/UDP discovery | Bring a hotspot, connect all machines to it |
| Qwen3-32B too slow even on cluster | Fall back to llama3.1:8b, still shows the concept |
| exo setup takes too long | All 3 machines install tonight before hackathon |
| Token backend breaks mid-demo | Mock the token numbers in the frontend as fallback |