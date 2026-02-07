from __future__ import annotations

import sqlite3
from typing import Dict, List, Optional, Tuple


def add_income(
    conn: sqlite3.Connection,
    user_id: int,
    amount_cents: int,
    source: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO incomes (user_id, amount_cents, source, start_date, end_date)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, amount_cents, source, start_date, end_date),
    )
    conn.commit()
    return int(cur.lastrowid)


def add_expense(
    conn: sqlite3.Connection,
    user_id: int,
    amount_cents: int,
    category: str,
    occurred_at_iso: str,
    note: Optional[str] = None,
) -> int:
    cur = conn.execute(
        """
        INSERT INTO expenses (user_id, amount_cents, category, occurred_at, note)
        VALUES (?, ?, ?, ?, ?)
        """,
        (user_id, amount_cents, category, occurred_at_iso, note),
    )
    conn.commit()
    return int(cur.lastrowid)


def monthly_spend(conn: sqlite3.Connection, user_id: int, year_month: str) -> int:
    row = conn.execute(
        """
        SELECT COALESCE(SUM(amount_cents), 0) AS total
        FROM expenses
        WHERE user_id = ?
          AND strftime('%Y-%m', occurred_at) = ?
        """,
        (user_id, year_month),
    ).fetchone()
    return int(row["total"]) if row else 0


def category_distribution(
    conn: sqlite3.Connection, user_id: int, year_month: str
) -> List[Tuple[str, int]]:
    rows = conn.execute(
        """
        SELECT category, SUM(amount_cents) AS total_cents
        FROM expenses
        WHERE user_id = ?
          AND strftime('%Y-%m', occurred_at) = ?
        GROUP BY category
        ORDER BY total_cents DESC
        """,
        (user_id, year_month),
    ).fetchall()
    return [(r["category"], int(r["total_cents"])) for r in rows]


def monthly_income_total(conn: sqlite3.Connection, user_id: int) -> int:
    # Naive monthly income total: sum all active incomes; adjust if you need date filtering
    row = conn.execute(
        """
        SELECT COALESCE(SUM(amount_cents), 0) AS total
        FROM incomes
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    return int(row["total"]) if row else 0


def savings_rate(
    conn: sqlite3.Connection, user_id: int, year_month: str
) -> Optional[float]:
    income = monthly_income_total(conn, user_id)
    expense = monthly_spend(conn, user_id, year_month)
    if income <= 0:
        return None
    return float(income - expense) / float(income)

