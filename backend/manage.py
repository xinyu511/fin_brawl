from __future__ import annotations

import argparse
import json
from typing import Any, Dict, List

from . import db
from .auth import signin, signup
from .finance import (
    add_expense,
    add_income,
    category_distribution,
    monthly_income_total,
    monthly_spend,
    savings_rate,
)
from .recommendations import add_recommendation, get_recommendations
from .users import login_user, register_user, verify_auth_token
from .db import session


def cmd_init_db(_: argparse.Namespace) -> None:
    db.init_db()
    print("Initialized database with schema.")


def cmd_create_user(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        user_id = signup(conn, ns.username, ns.password)
        if user_id is None:
            print("Username already exists.")
        else:
            print(f"Created user id={user_id}")


def cmd_signin(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        user_id = signin(conn, ns.username, ns.password)
        if user_id is None:
            print("Invalid credentials.")
        else:
            print(f"Signed in as id={user_id}")


def cmd_add_income(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        income_id = add_income(
            conn, ns.user_id, ns.amount_cents, ns.source, ns.start_date, ns.end_date
        )
        print(f"Added income id={income_id}")


def cmd_add_expense(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        expense_id = add_expense(
            conn,
            ns.user_id,
            ns.amount_cents,
            ns.category,
            ns.occurred_at,
            ns.note,
        )
        print(f"Added expense id={expense_id}")


def cmd_monthly_spend(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        total = monthly_spend(conn, ns.user_id, ns.year_month)
        print(total)


def cmd_category_dist(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        dist = category_distribution(conn, ns.user_id, ns.year_month)
        print(json.dumps(dist))


def cmd_savings_rate(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        rate = savings_rate(conn, ns.user_id, ns.year_month)
        print("null" if rate is None else f"{rate:.6f}")


def cmd_list_recos(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        recos = get_recommendations(conn, ns.user_id, ns.limit)
        print(json.dumps(recos))


def cmd_add_reco(ns: argparse.Namespace) -> None:
    with db.session() as conn:
        rid = add_recommendation(conn, ns.user_id, ns.content)
        print(f"Added recommendation id={rid}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Backend management CLI")
    sub = p.add_subparsers(dest="cmd", required=True)

    s = sub.add_parser("init-db", help="Initialize database with schema")
    s.set_defaults(func=cmd_init_db)

    s = sub.add_parser("create-user", help="Create user")
    s.add_argument("username")
    s.add_argument("password")
    s.set_defaults(func=cmd_create_user)

    s = sub.add_parser("signin", help="Sign in with credentials")
    s.add_argument("username")
    s.add_argument("password")
    s.set_defaults(func=cmd_signin)

    # Token-based login (returns signed token)
    s = sub.add_parser("login-token", help="Sign in and get an auth token")
    s.add_argument("username")
    s.add_argument("password")
    def _cmd_login_token(ns: argparse.Namespace) -> None:
        with session() as conn:
            token = login_user(conn, ns.username, ns.password)
            if token is None:
                print("Invalid credentials.")
            else:
                print(token)
    s.set_defaults(func=_cmd_login_token)

    # Verify token -> prints user_id or 'invalid'
    s = sub.add_parser("verify-token", help="Verify an auth token")
    s.add_argument("token")
    def _cmd_verify_token(ns: argparse.Namespace) -> None:
        uid = verify_auth_token(ns.token)
        print("invalid" if uid is None else str(uid))
    s.set_defaults(func=_cmd_verify_token)

    s = sub.add_parser("add-income", help="Add income record")
    s.add_argument("user_id", type=int)
    s.add_argument("amount_cents", type=int)
    s.add_argument("source")
    s.add_argument("--start-date")
    s.add_argument("--end-date")
    s.set_defaults(func=cmd_add_income)

    s = sub.add_parser("add-expense", help="Add expense record")
    s.add_argument("user_id", type=int)
    s.add_argument("amount_cents", type=int)
    s.add_argument("category")
    s.add_argument("occurred_at", help="ISO timestamp or 'YYYY-MM-DD'")
    s.add_argument("--note")
    s.set_defaults(func=cmd_add_expense)

    s = sub.add_parser("monthly-spend", help="Total spend for YYYY-MM")
    s.add_argument("user_id", type=int)
    s.add_argument("year_month")
    s.set_defaults(func=cmd_monthly_spend)

    s = sub.add_parser("category-dist", help="Category distribution for YYYY-MM")
    s.add_argument("user_id", type=int)
    s.add_argument("year_month")
    s.set_defaults(func=cmd_category_dist)

    s = sub.add_parser("savings-rate", help="Savings rate for YYYY-MM")
    s.add_argument("user_id", type=int)
    s.add_argument("year_month")
    s.set_defaults(func=cmd_savings_rate)

    s = sub.add_parser("list-recos", help="List recommendations")
    s.add_argument("user_id", type=int)
    s.add_argument("--limit", type=int, default=50)
    s.set_defaults(func=cmd_list_recos)

    s = sub.add_parser("add-reco", help="Add recommendation")
    s.add_argument("user_id", type=int)
    s.add_argument("content")
    s.set_defaults(func=cmd_add_reco)

    return p


def main() -> None:
    parser = build_parser()
    ns = parser.parse_args()
    ns.func(ns)


if __name__ == "__main__":
    main()

