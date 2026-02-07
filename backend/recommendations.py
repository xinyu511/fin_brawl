from __future__ import annotations

import sqlite3
from typing import List, Tuple


def add_recommendation(conn: sqlite3.Connection, user_id: int, content: str) -> int:
    cur = conn.execute(
        "INSERT INTO recommendation_history (user_id, content) VALUES (?, ?)",
        (user_id, content),
    )
    conn.commit()
    return int(cur.lastrowid)


def get_recommendations(
    conn: sqlite3.Connection, user_id: int, limit: int = 50
) -> List[Tuple[int, str, str]]:
    rows = conn.execute(
        """
        SELECT id, content, created_at
        FROM recommendation_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        """,
        (user_id, limit),
    ).fetchall()
    return [(int(r["id"]), r["content"], r["created_at"]) for r in rows]


def delete_recommendation(conn: sqlite3.Connection, reco_id: int) -> bool:
    cur = conn.execute("DELETE FROM recommendation_history WHERE id = ?", (reco_id,))
    conn.commit()
    return cur.rowcount > 0

