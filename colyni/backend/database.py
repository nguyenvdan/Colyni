"""SQLite schema and connection for Colyni token ledger."""

from __future__ import annotations

import aiosqlite
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS accounts (
  node_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
);

CREATE TABLE IF NOT EXISTS nodes (
  node_id TEXT PRIMARY KEY,
  label TEXT,
  last_heartbeat REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_task_id TEXT,
  created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS rank_bindings (
  rank INTEGER PRIMARY KEY CHECK (rank >= 0),
  node_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ledger_node ON ledger_entries(node_id);
"""


async def connect(db_path: Path) -> aiosqlite.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = await aiosqlite.connect(db_path)
    await conn.execute("PRAGMA foreign_keys = ON")
    await conn.executescript(SCHEMA)
    await conn.commit()
    return conn
