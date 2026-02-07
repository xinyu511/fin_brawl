from __future__ import annotations

import json
import re
import sqlite3
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from .finance import add_expense, add_income


_CURRENCY_RE = re.compile(r"^[A-Z]{3}$")
_RISK = {"low", "medium", "high"}
_GOAL = {"save", "invest", "retire", "reduce_debt"}
_HORIZON = {"short", "medium", "long"}


def _validate_profile_fields(fields: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    if "currency" in fields and not _CURRENCY_RE.match(str(fields["currency"])):
        return False, "currency must be a 3-letter uppercase code (e.g., USD)"
    if "risk_tolerance" in fields and fields["risk_tolerance"] not in _RISK:
        return False, f"risk_tolerance must be one of {sorted(_RISK)}"
    if "financial_goal" in fields and fields["financial_goal"] not in _GOAL:
        return False, f"financial_goal must be one of {sorted(_GOAL)}"
    if "time_horizon" in fields and fields["time_horizon"] not in _HORIZON:
        return False, f"time_horizon must be one of {sorted(_HORIZON)}"
    if "net_worth_cents" in fields:
        try:
            int(fields["net_worth_cents"])
        except Exception:
            return False, "net_worth_cents must be an integer"
    return True, None


def update_financial_profile(conn: sqlite3.Connection, user_id: int, **fields: Any) -> bool:
    """
    Update selected fields on financial_profiles for the given user_id.
    Returns True if an update occurred, False if nothing to change or validation failed.
    """
    allowed = {
        "currency",
        "net_worth_cents",
        "risk_tolerance",
        "financial_goal",
        "time_horizon",
        "age_range",
        "location",
    }
    to_set = {k: v for k, v in fields.items() if k in allowed and v is not None}
    ok, err = _validate_profile_fields(to_set)
    if not ok or not to_set:
        return False
    cols = ", ".join(f"{k} = ?" for k in to_set.keys())
    params = list(to_set.values()) + [user_id]
    conn.execute(
        f"UPDATE financial_profiles SET {cols}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
        params,
    )
    conn.commit()
    return True


def load_incomes_from_json(conn: sqlite3.Connection, user_id: int, json_path: Path) -> int:
    """
    Load and insert multiple incomes from a JSON file.
    JSON format: [{\"amount_cents\": 500000, \"source\": \"salary\", \"start_date\": \"YYYY-MM-DD\", \"end_date\": null}, ...]
    Returns count inserted.
    """
    items = json.loads(Path(json_path).read_text(encoding="utf-8"))
    count = 0
    for it in items:
        add_income(
            conn=conn,
            user_id=user_id,
            amount_cents=int(it["amount_cents"]),
            source=str(it["source"]),
            start_date=it.get("start_date"),
            end_date=it.get("end_date"),
        )
        count += 1
    return count


def load_expenses_from_json(conn: sqlite3.Connection, user_id: int, json_path: Path) -> int:
    """
    Load and insert multiple expenses from a JSON file.
    JSON format: [{\"amount_cents\": 12000, \"category\": \"food\", \"occurred_at\": \"YYYY-MM-DDTHH:MM:SS\", \"note\": \"lunch\"}, ...]
    Returns count inserted.
    """
    items = json.loads(Path(json_path).read_text(encoding="utf-8"))
    count = 0
    for it in items:
        add_expense(
            conn=conn,
            user_id=user_id,
            amount_cents=int(it["amount_cents"]),
            category=str(it["category"]),
            occurred_at_iso=str(it["occurred_at"]),
            note=it.get("note"),
        )
        count += 1
    return count

