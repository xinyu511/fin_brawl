from __future__ import annotations

import sqlite3
from typing import Dict, List, Tuple

from .finance import (
    category_distribution,
    monthly_income_total,
    monthly_spend,
    savings_rate,
)
from .recommendations import get_recommendations


def get_month_overview(conn: sqlite3.Connection, user_id: int, year_month: str) -> Dict:
    """
    Aggregated snapshot for a user's month:
    - income_cents
    - expense_cents
    - savings_rate (None if income is 0)
    - category_distribution: [{category, total_cents}]
    - recommendations: [{id, content, created_at}] (latest 5)
    """
    income_cents = monthly_income_total(conn, user_id)
    expense_cents = monthly_spend(conn, user_id, year_month)
    rate = savings_rate(conn, user_id, year_month)
    dist_pairs: List[Tuple[str, int]] = category_distribution(conn, user_id, year_month)
    recos = get_recommendations(conn, user_id, limit=5)

    return {
        "user_id": user_id,
        "year_month": year_month,
        "income_cents": income_cents,
        "expense_cents": expense_cents,
        "savings_rate": rate,  # fraction (e.g., 0.25)
        "category_distribution": [
            {"category": cat, "total_cents": total} for cat, total in dist_pairs
        ],
        "recommendations": [
            {"id": rid, "content": content, "created_at": created_at}
            for rid, content, created_at in recos
        ],
    }

