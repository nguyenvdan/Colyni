"""Token earn/spend logic — keep side effects here."""

from __future__ import annotations

import time
from collections import defaultdict
from typing import Any

import aiosqlite

CHAT_COST = 5
EARN_POOL = 10
HEARTBEAT_STALE_SECONDS = 90.0


async def ensure_account(conn: aiosqlite.Connection, node_id: str) -> None:
    await conn.execute(
        "INSERT OR IGNORE INTO accounts (node_id, balance) VALUES (?, 0)",
        (node_id,),
    )


async def get_balance(conn: aiosqlite.Connection, node_id: str) -> int:
    await ensure_account(conn, node_id)
    cur = await conn.execute(
        "SELECT balance FROM accounts WHERE node_id = ?", (node_id,)
    )
    row = await cur.fetchone()
    assert row is not None
    return int(row[0])


async def heartbeat(
    conn: aiosqlite.Connection, node_id: str, label: str | None
) -> None:
    now = time.time()
    await ensure_account(conn, node_id)
    await conn.execute(
        """
        INSERT INTO nodes (node_id, label, last_heartbeat)
        VALUES (?, ?, ?)
        ON CONFLICT(node_id) DO UPDATE SET
          label = COALESCE(excluded.label, nodes.label),
          last_heartbeat = excluded.last_heartbeat
        """,
        (node_id, label, now),
    )
    await conn.commit()


async def try_spend_chat(
    conn: aiosqlite.Connection, node_id: str, ref_task_id: str | None
) -> bool:
    """Deduct CHAT_COST if balance allows; record ledger entry."""
    await ensure_account(conn, node_id)
    cur = await conn.execute(
        "UPDATE accounts SET balance = balance - ? WHERE node_id = ? AND balance >= ?",
        (CHAT_COST, node_id, CHAT_COST),
    )
    if cur.rowcount != 1:
        await conn.commit()
        return False
    now = time.time()
    await conn.execute(
        """
        INSERT INTO ledger_entries (node_id, delta, reason, ref_task_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (node_id, -CHAT_COST, "chat_spend", ref_task_id, now),
    )
    await conn.commit()
    return True


async def credit(
    conn: aiosqlite.Connection,
    node_id: str,
    amount: int,
    reason: str,
    ref_task_id: str | None,
) -> None:
    if amount <= 0:
        return
    await ensure_account(conn, node_id)
    now = time.time()
    await conn.execute(
        "UPDATE accounts SET balance = balance + ? WHERE node_id = ?",
        (amount, node_id),
    )
    await conn.execute(
        """
        INSERT INTO ledger_entries (node_id, delta, reason, ref_task_id, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (node_id, amount, reason, ref_task_id, now),
    )
    await conn.commit()


async def list_active_node_ids(conn: aiosqlite.Connection) -> list[str]:
    cutoff = time.time() - HEARTBEAT_STALE_SECONDS
    cur = await conn.execute(
        "SELECT node_id FROM nodes WHERE last_heartbeat >= ? ORDER BY node_id",
        (cutoff,),
    )
    rows = await cur.fetchall()
    return [str(r[0]) for r in rows]


async def get_rank_bindings(conn: aiosqlite.Connection) -> dict[int, str]:
    cur = await conn.execute("SELECT rank, node_id FROM rank_bindings")
    rows = await cur.fetchall()
    return {int(r[0]): str(r[1]) for r in rows}


def weights_from_trace_stats(trace_json: dict[str, Any]) -> dict[int, float]:
    """Sum per-rank compute time from inference trace stats (microseconds by category)."""
    by_rank = trace_json.get("byRank") or trace_json.get("by_rank") or {}
    weights: dict[int, float] = {}
    for rank_str, rank_stats in by_rank.items():
        rank = int(rank_str)
        inner = rank_stats.get("byCategory") or rank_stats.get("by_category") or {}
        total_us = 0.0
        for cat in inner.values():
            total_us += float(cat.get("totalUs") or cat.get("total_us") or 0)
        if total_us > 0:
            weights[rank] = total_us
    return weights


def integer_split_proportional(total: int, shares: dict[str, float]) -> dict[str, int]:
    """Allocate integer `total` proportionally to positive float shares."""
    if total <= 0 or not shares:
        return {}
    positive = {k: v for k, v in shares.items() if v > 0}
    if not positive:
        return {}
    weight_sum = sum(positive.values())
    if weight_sum <= 0:
        return {}
    out: dict[str, int] = {}
    allocated = 0
    items = list(positive.items())
    for i, (node_id, w) in enumerate(items):
        if i == len(items) - 1:
            out[node_id] = total - allocated
        else:
            part = int(total * (w / weight_sum))
            allocated += part
            out[node_id] = part
    return out


async def settle_earn_for_task(
    conn: aiosqlite.Connection,
    inference_base: str,
    task_id: str,
    http_client: Any,
) -> None:
    """Fetch distributed inference trace stats and credit contributors."""
    active = await list_active_node_ids(conn)
    url = f"{inference_base.rstrip('/')}/v1/traces/{task_id}/stats"
    response = await http_client.get(url)
    if response.status_code != 200:
        await _fallback_equal_split(conn, task_id, active)
        return
    data = response.json()
    weights = weights_from_trace_stats(data)
    bindings = await get_rank_bindings(conn)

    shares: dict[str, float] = defaultdict(float)
    unmapped_weight = 0.0
    for rank, w in weights.items():
        node = bindings.get(rank)
        if node:
            shares[node] += w
        else:
            unmapped_weight += w
    if unmapped_weight > 0 and active:
        per = unmapped_weight / len(active)
        for n in active:
            shares[n] += per

    if not shares:
        await _fallback_equal_split(conn, task_id, active)
        return

    payouts = integer_split_proportional(EARN_POOL, dict(shares))
    for node_id, amt in payouts.items():
        await credit(conn, node_id, amt, "compute_share", task_id)


async def _fallback_equal_split(
    conn: aiosqlite.Connection, task_id: str, active: list[str]
) -> None:
    nodes = active if active else await list_active_node_ids(conn)
    if not nodes:
        return
    base, rem = divmod(EARN_POOL, len(nodes))
    for i, node_id in enumerate(nodes):
        amt = base + (1 if i < rem else 0)
        await credit(conn, node_id, amt, "earn_equal_split", task_id)


async def count_completed_chats(conn: aiosqlite.Connection) -> int:
    cur = await conn.execute(
        "SELECT COUNT(*) FROM ledger_entries WHERE reason = 'chat_spend'"
    )
    row = await cur.fetchone()
    return int(row[0]) if row else 0


# Rough sustainability estimates vs. routing the same work to a hyperscale cloud GPU region.
# Documented constants for demo transparency — replace with measured data in production.
KWH_AVOIDED_PER_CHAT = 0.22  # order-of-magnitude vs. typical cloud inference
LITERS_WATER_PER_KWH_US_EGRID_AVG = 1.8
KG_CO2_PER_KWH_US_AVG = 0.39


def estimate_sustainability(completed_chats: int) -> dict[str, float]:
    kwh = KWH_AVOIDED_PER_CHAT * completed_chats
    return {
        "energy_kwh_avoided": round(kwh, 4),
        "water_liters_saved": round(kwh * LITERS_WATER_PER_KWH_US_EGRID_AVG, 2),
        "co2_kg_avoided": round(kwh * KG_CO2_PER_KWH_US_AVG, 4),
    }
