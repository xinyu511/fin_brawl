from __future__ import annotations

import argparse
import json
from pathlib import Path

from . import db
from .auth import signin, signup, set_password, set_username
from .db import session
from .dashboard import get_month_overview
from .finance import (
    add_expense,
    add_income,
    category_distribution,
    monthly_spend,
    savings_rate,
    update_income,
    delete_income,
    update_expense,
    delete_expense,
)
from .onboarding import (
    update_financial_profile,
    load_incomes_from_json,
    load_expenses_from_json,
)
from .recommendations import add_recommendation, get_recommendations, delete_recommendation
from .users import login_user, verify_auth_token
from .http_api import run as run_http


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

    # Delete recommendation
    s = sub.add_parser("delete-reco", help="Delete recommendation by id")
    s.add_argument("reco_id", type=int)
    def _cmd_delete_reco(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = delete_recommendation(conn, ns.reco_id)
            print("deleted" if ok else "notfound")
    s.set_defaults(func=_cmd_delete_reco)

    # Onboarding: set/update financial profile fields
    s = sub.add_parser("set-profile", help="Update financial profile fields for a user")
    s.add_argument("user_id", type=int)
    s.add_argument("--currency")
    s.add_argument("--net-worth-cents", type=int, dest="net_worth_cents")
    s.add_argument("--risk-tolerance", choices=["low", "medium", "high"], dest="risk_tolerance")
    s.add_argument("--financial-goal", choices=["save", "invest", "retire", "reduce_debt"], dest="financial_goal")
    s.add_argument("--time-horizon", choices=["short", "medium", "long"], dest="time_horizon")
    s.add_argument("--age-range", dest="age_range")
    s.add_argument("--location")
    def _cmd_set_profile(ns: argparse.Namespace) -> None:
        with session() as conn:
            changed = update_financial_profile(
                conn,
                ns.user_id,
                currency=ns.currency,
                net_worth_cents=ns.net_worth_cents,
                risk_tolerance=ns.risk_tolerance,
                financial_goal=ns.financial_goal,
                time_horizon=ns.time_horizon,
                age_range=ns.age_range,
                location=ns.location,
            )
            print("updated" if changed else "nochange")
    s.set_defaults(func=_cmd_set_profile)

    # Onboarding: bulk load incomes from JSON
    s = sub.add_parser("load-incomes", help="Bulk insert incomes from JSON file")
    s.add_argument("user_id", type=int)
    s.add_argument("json_path")
    def _cmd_load_incomes(ns: argparse.Namespace) -> None:
        with session() as conn:
            count = load_incomes_from_json(conn, ns.user_id, Path(ns.json_path))
            print(count)
    s.set_defaults(func=_cmd_load_incomes)

    # Onboarding: bulk load expenses from JSON
    s = sub.add_parser("load-expenses", help="Bulk insert expenses from JSON file")
    s.add_argument("user_id", type=int)
    s.add_argument("json_path")
    def _cmd_load_expenses(ns: argparse.Namespace) -> None:
        with session() as conn:
            count = load_expenses_from_json(conn, ns.user_id, Path(ns.json_path))
            print(count)
    s.set_defaults(func=_cmd_load_expenses)

    # Update/Delete income
    s = sub.add_parser("update-income", help="Update fields on an income")
    s.add_argument("income_id", type=int)
    s.add_argument("--amount-cents", type=int)
    s.add_argument("--source")
    s.add_argument("--start-date")
    s.add_argument("--end-date")
    def _cmd_update_income(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = update_income(
                conn,
                ns.income_id,
                amount_cents=ns.amount_cents,
                source=ns.source,
                start_date=ns.start_date,
                end_date=ns.end_date,
            )
            print("updated" if ok else "nochange")
    s.set_defaults(func=_cmd_update_income)

    s = sub.add_parser("delete-income", help="Delete an income")
    s.add_argument("income_id", type=int)
    def _cmd_delete_income(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = delete_income(conn, ns.income_id)
            print("deleted" if ok else "notfound")
    s.set_defaults(func=_cmd_delete_income)

    # Update/Delete expense
    s = sub.add_parser("update-expense", help="Update fields on an expense")
    s.add_argument("expense_id", type=int)
    s.add_argument("--amount-cents", type=int)
    s.add_argument("--category")
    s.add_argument("--occurred-at")
    s.add_argument("--note")
    def _cmd_update_expense(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = update_expense(
                conn,
                ns.expense_id,
                amount_cents=ns.amount_cents,
                category=ns.category,
                occurred_at_iso=ns.occurred_at,
                note=ns.note,
            )
            print("updated" if ok else "nochange")
    s.set_defaults(func=_cmd_update_expense)

    s = sub.add_parser("delete-expense", help="Delete an expense")
    s.add_argument("expense_id", type=int)
    def _cmd_delete_expense(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = delete_expense(conn, ns.expense_id)
            print("deleted" if ok else "notfound")
    s.set_defaults(func=_cmd_delete_expense)

    # User updates: username/password
    s = sub.add_parser("set-username", help="Change a user's username")
    s.add_argument("user_id", type=int)
    s.add_argument("new_username")
    def _cmd_set_username(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = set_username(conn, ns.user_id, ns.new_username)
            print("updated" if ok else "conflict_or_notfound")
    s.set_defaults(func=_cmd_set_username)

    s = sub.add_parser("set-password", help="Change a user's password")
    s.add_argument("user_id", type=int)
    s.add_argument("new_password")
    def _cmd_set_password(ns: argparse.Namespace) -> None:
        with session() as conn:
            ok = set_password(conn, ns.user_id, ns.new_password)
            print("updated" if ok else "notfound")
    s.set_defaults(func=_cmd_set_password)

    # Dashboard: aggregated month overview
    s = sub.add_parser("dashboard", help="Show monthly dashboard JSON")
    s.add_argument("user_id", type=int)
    s.add_argument("year_month")
    def _cmd_dashboard(ns: argparse.Namespace) -> None:
        with session() as conn:
            print(json.dumps(get_month_overview(conn, ns.user_id, ns.year_month)))
    s.set_defaults(func=_cmd_dashboard)

    # Serve HTTP API
    s = sub.add_parser("serve", help="Run the HTTP API server")
    s.add_argument("--host", default="127.0.0.1")
    s.add_argument("--port", type=int, default=8000)
    def _cmd_serve(ns: argparse.Namespace) -> None:
        run_http(ns.host, ns.port)
    s.set_defaults(func=_cmd_serve)

    return p


def main() -> None:
    parser = build_parser()
    ns = parser.parse_args()
    ns.func(ns)


if __name__ == "__main__":
    main()

