"""
Colyni API: token ledger + proxy to your local distributed inference stack (OpenAI-compatible).
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Annotated

_BACKEND_DIR = Path(__file__).resolve().parent
try:
    from dotenv import load_dotenv

    load_dotenv(_BACKEND_DIR / ".env")
except ImportError:
    pass

import aiosqlite
import httpx
from fastapi import FastAPI, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from database import connect
from ledger import (
    CHAT_COST,
    EARN_POOL,
    count_completed_chats,
    estimate_sustainability,
    get_balance,
    heartbeat,
    settle_earn_for_task,
    try_spend_chat,
)
from ledger import credit as ledger_credit

# Default matches the local distributed inference dev server when run from source (port 52415).
INFERENCE_BASE_URL = os.environ.get(
    "INFERENCE_BASE_URL", "http://127.0.0.1:52415"
).rstrip("/")
DATABASE_PATH = Path(
    os.environ.get("COLYNI_DATABASE", str(_BACKEND_DIR / "colyni.db"))
)


def _env_truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


# When True, chat does not deduct tokens; contributors still earn from inference traces.
COLYNI_DEMO_FREE_CHAT = _env_truthy("COLYNI_DEMO_FREE_CHAT")


class HeartbeatBody(BaseModel):
    node_id: str = Field(min_length=1)
    label: str | None = None


class RankBindingBody(BaseModel):
    rank: int = Field(ge=0)
    node_id: str = Field(min_length=1)


app = FastAPI(title="Colyni", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_db: aiosqlite.Connection | None = None
_http: httpx.AsyncClient | None = None


@app.on_event("startup")
async def startup() -> None:
    global _db, _http
    _db = await connect(DATABASE_PATH)
    _http = httpx.AsyncClient(timeout=httpx.Timeout(600.0))


@app.on_event("shutdown")
async def shutdown() -> None:
    global _db, _http
    if _http:
        await _http.aclose()
    if _db:
        await _db.close()


def db() -> aiosqlite.Connection:
    assert _db is not None
    return _db


def http() -> httpx.AsyncClient:
    assert _http is not None
    return _http


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/nodes/heartbeat")
async def post_heartbeat(body: HeartbeatBody) -> dict[str, str]:
    await heartbeat(db(), body.node_id, body.label)
    return {"status": "ok"}


@app.get("/api/tokens/{node_id}")
async def get_tokens(node_id: str) -> dict[str, int | str]:
    balance = await get_balance(db(), node_id)
    return {"node_id": node_id, "balance": balance}


@app.get("/api/nodes")
async def get_nodes() -> dict[str, list[dict[str, str | float | int]]]:
    """Active contributors (recent heartbeat) with balances."""
    conn = db()
    cutoff = time.time() - 90.0
    cur = await conn.execute(
        """
        SELECT n.node_id, n.label, n.last_heartbeat, a.balance
        FROM nodes n
        JOIN accounts a ON a.node_id = n.node_id
        WHERE n.last_heartbeat >= ?
        ORDER BY n.node_id
        """,
        (cutoff,),
    )
    rows = await cur.fetchall()
    return {
        "nodes": [
            {
                "node_id": str(r[0]),
                "label": str(r[1] or r[0]),
                "last_heartbeat": float(r[2]),
                "balance": int(r[3]),
            }
            for r in rows
        ]
    }


@app.post("/api/admin/rank-binding")
async def post_rank_binding(body: RankBindingBody) -> dict[str, str]:
    """Map inference trace rank index to a contributor node_id (from GET /api/cluster/self-id)."""
    conn = db()
    await conn.execute(
        """
        INSERT INTO rank_bindings (rank, node_id) VALUES (?, ?)
        ON CONFLICT(rank) DO UPDATE SET node_id = excluded.node_id
        """,
        (body.rank, body.node_id),
    )
    await conn.commit()
    return {"status": "ok"}


@app.post("/api/admin/grant")
async def post_grant(
    node_id: Annotated[str, Query(min_length=1)],
    amount: Annotated[int, Query(gt=0, le=1_000_000)],
) -> dict[str, str]:
    """Bootstrap balances for demos (no auth — add auth before production)."""
    await ledger_credit(db(), node_id, amount, "admin_grant", None)
    return {"status": "ok"}


@app.get("/api/cluster/state")
async def cluster_state() -> JSONResponse:
    """Snapshot of the distributed inference cluster (topology, instances, memory)."""
    r = await http().get(f"{INFERENCE_BASE_URL}/state")
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text}
    return JSONResponse(content=data, status_code=r.status_code)


@app.get("/api/cluster/self-id")
async def cluster_self_id() -> PlainTextResponse:
    """Identifier for this machine in the cluster (plain text)."""
    r = await http().get(f"{INFERENCE_BASE_URL}/node_id")
    return PlainTextResponse(content=r.text, status_code=r.status_code)


@app.get("/api/models")
async def list_models() -> JSONResponse:
    """OpenAI-style model list from the inference engine."""
    r = await http().get(f"{INFERENCE_BASE_URL}/v1/models")
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text}
    return JSONResponse(content=data, status_code=r.status_code)


@app.post("/api/models/add")
async def proxy_models_add(request: Request) -> JSONResponse:
    """Register a Hugging Face model on the cluster (proxied to inference)."""
    body = await request.body()
    ct = request.headers.get("content-type", "application/json")
    r = await http().post(
        f"{INFERENCE_BASE_URL}/models/add",
        content=body,
        headers={"content-type": ct},
    )
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text}
    return JSONResponse(content=data, status_code=r.status_code)


@app.get("/api/models/search")
async def proxy_models_search(
    query: str = "",
    limit: int = 20,
) -> JSONResponse:
    """Search Hugging Face for models (proxied to inference)."""
    r = await http().get(
        f"{INFERENCE_BASE_URL}/models/search",
        params={"query": query, "limit": limit},
    )
    try:
        data = r.json()
    except Exception:
        data = {"error": r.text}
    return JSONResponse(content=data, status_code=r.status_code)


@app.get("/api/sustainability")
async def sustainability() -> dict[str, float | int]:
    """Estimated resource savings vs. cloud-only inference (see ledger constants)."""
    chats = await count_completed_chats(db())
    est = estimate_sustainability(chats)
    return {"completed_chats": chats, **est}


def _extract_task_id_from_sse(buffer: bytes) -> str | None:
    text = buffer.decode("utf-8", errors="ignore")
    for line in text.splitlines():
        if not line.startswith("data: ") or line.strip() == "data: [DONE]":
            continue
        payload = line.removeprefix("data: ").strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            obj = json.loads(payload)
            tid = obj.get("id")
            if isinstance(tid, str):
                return tid
        except json.JSONDecodeError:
            continue
    return None


_ID_RE = re.compile(r'"id"\s*:\s*"([^"]+)"')


def _extract_task_id_from_buffer(buffer: bytes) -> str | None:
    m = _ID_RE.search(buffer.decode("utf-8", errors="ignore"))
    return m.group(1) if m else None


@app.post("/v1/chat/completions")
async def proxy_chat_completions(
    request: Request,
    x_colyni_node: Annotated[str | None, Header(alias="X-Colyni-Node")] = None,
):
    """
    OpenAI-compatible chat proxy. Requires X-Colyni-Node (cluster node id) to spend tokens.

    Forwards to the inference engine. After the run, credits contributors from trace stats.
    """
    if not x_colyni_node:
        raise HTTPException(
            status_code=400,
            detail="Missing X-Colyni-Node header (your cluster id from GET /api/cluster/self-id).",
        )
    body_bytes = await request.body()
    try:
        payload = json.loads(body_bytes)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Invalid JSON: {e}") from e

    if not COLYNI_DEMO_FREE_CHAT:
        if not await try_spend_chat(db(), x_colyni_node, None):
            raise HTTPException(
                status_code=402,
                detail=f"Insufficient balance (need {CHAT_COST} Colyni tokens for one chat).",
            )

    url = f"{INFERENCE_BASE_URL}/v1/chat/completions"
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in ("host", "content-length", "x-colyni-node")
    }

    stream_requested = bool(payload.get("stream"))

    if stream_requested:

        async def streamer() -> AsyncIterator[bytes]:
            buf = bytearray()
            task_id: str | None = None
            try:
                async with http().stream(
                    "POST", url, content=body_bytes, headers=headers
                ) as r:
                    if r.status_code != 200:
                        err = await r.aread()
                        yield err
                        return
                    async for chunk in r.aiter_bytes():
                        buf.extend(chunk)
                        if task_id is None and len(buf) > 2000:
                            task_id = _extract_task_id_from_buffer(bytes(buf))
                        yield chunk
            finally:
                if task_id is None:
                    task_id = _extract_task_id_from_sse(bytes(buf))
                if task_id:
                    asyncio.create_task(
                        settle_earn_for_task(db(), INFERENCE_BASE_URL, task_id, http())
                    )

        return StreamingResponse(streamer(), media_type="text/event-stream")
    r = await http().post(url, content=body_bytes, headers=headers)
    if r.status_code != 200:
        return JSONResponse(content=r.json(), status_code=r.status_code)
    data = r.json()
    task_id = data.get("id")
    if isinstance(task_id, str):
        asyncio.create_task(
            settle_earn_for_task(db(), INFERENCE_BASE_URL, task_id, http())
        )
    return JSONResponse(content=data)


@app.get("/api/config")
async def get_config() -> dict[str, int | str | bool]:
    return {
        "inference_base_url": INFERENCE_BASE_URL,
        "chat_cost": CHAT_COST,
        "earn_pool_per_request": EARN_POOL,
        "demo_free_chat": COLYNI_DEMO_FREE_CHAT,
    }
