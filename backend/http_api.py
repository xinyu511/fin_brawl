from __future__ import annotations

import json
from typing import Any, Dict, Optional, Tuple
from wsgiref.simple_server import make_server, WSGIServer
from wsgiref.util import request_uri

from .db import get_default_db_path, init_db, session
from .users import register_user, login_user, verify_auth_token
from .onboarding import update_financial_profile


def _cors_headers() -> list[tuple[str, str]]:
    return [
        ("Access-Control-Allow-Origin", "*"),
        ("Access-Control-Allow-Headers", "Content-Type, Authorization"),
        ("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS"),
        ("Access-Control-Max-Age", "86400"),
    ]


def _json_response(start_response, status_code: int, body: Dict[str, Any]) -> list[bytes]:
    status_map = {
        200: "200 OK",
        201: "201 Created",
        204: "204 No Content",
        400: "400 Bad Request",
        401: "401 Unauthorized",
        404: "404 Not Found",
        405: "405 Method Not Allowed",
        500: "500 Internal Server Error",
    }
    status = status_map.get(status_code, "200 OK")
    payload = json.dumps(body).encode("utf-8")
    headers = [("Content-Type", "application/json; charset=utf-8"), ("Content-Length", str(len(payload)))]
    headers.extend(_cors_headers())
    start_response(status, headers)
    return [payload]


def _no_content(start_response, status_code: int = 204) -> list[bytes]:
    status_map = {
        204: "204 No Content",
        200: "200 OK",
    }
    status = status_map.get(status_code, "204 No Content")
    headers = _cors_headers()
    start_response(status, headers)
    return [b""]


def _read_json(environ) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    try:
        length = int(environ.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    raw = environ["wsgi.input"].read(length) if length > 0 else b""
    if not raw:
        return {}, None
    try:
        return json.loads(raw.decode("utf-8")), None
    except Exception:
        return None, "invalid_json"


def _bearer_token(environ) -> Optional[str]:
    auth = environ.get("HTTP_AUTHORIZATION")
    if not auth:
        return None
    prefix = "Bearer "
    if auth.startswith(prefix):
        return auth[len(prefix) :].strip()
    return None


def _parse_limit(environ, default: int = 200, max_limit: int = 500) -> int:
    qs = environ.get("QUERY_STRING") or ""
    for part in qs.split("&"):
        if not part:
            continue
        k, _, v = part.partition("=")
        if k == "limit":
            try:
                limit = int(v)
                if limit <= 0:
                    return default
                return min(limit, max_limit)
            except ValueError:
                return default
    return default


def _get_profile(conn, user_id: int) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        """
        SELECT user_id, currency, net_worth_cents, risk_tolerance, financial_goal,
               time_horizon, age_range, location, created_at, updated_at
        FROM financial_profiles WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()
    if not row:
        return None
    return dict(row)


def app(environ, start_response):
    try:
        method = environ["REQUEST_METHOD"].upper()
        path = environ.get("PATH_INFO") or "/"

        # CORS preflight
        if method == "OPTIONS":
            return _no_content(start_response, 204)

        # Routes
        # Compatibility auth routes expected by web/lib/backendClient.ts
        if path == "/auth/register":
            if method != "POST":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            body, err = _read_json(environ)
            if body is None:
                return _json_response(start_response, 400, {"error": err})
            username = body.get("username")
            password = body.get("password")
            if not isinstance(username, str) or not isinstance(password, str):
                return _json_response(start_response, 400, {"error": "missing_username_or_password"})
            with session() as conn:
                user_id = register_user(conn, username, password)
                if user_id is None:
                    return _json_response(start_response, 400, {"error": "username_taken"})
                token = login_user(conn, username, password)
                if token is None:
                    return _json_response(start_response, 500, {"error": "signup_login_failed"})
                return _json_response(start_response, 201, {"user_id": user_id, "token": token})

        if path == "/auth/login":
            if method != "POST":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            body, err = _read_json(environ)
            if body is None:
                return _json_response(start_response, 400, {"error": err})
            username = body.get("username")
            password = body.get("password")
            if not isinstance(username, str) or not isinstance(password, str):
                return _json_response(start_response, 400, {"error": "missing_username_or_password"})
            with session() as conn:
                token = login_user(conn, username, password)
                if token is None:
                    return _json_response(start_response, 401, {"error": "invalid_credentials"})
            # Return both token and user_id for convenience
            uid = verify_auth_token(token)  # safe immediately after creation
            return _json_response(start_response, 200, {"token": token, "user_id": uid})

        if path == "/auth/me":
            if method != "GET":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            token = _bearer_token(environ)
            if token is None:
                return _json_response(start_response, 401, {"error": "missing_auth"})
            uid = verify_auth_token(token)
            if uid is None:
                return _json_response(start_response, 401, {"error": "invalid_token"})
            with session() as conn:
                row = conn.execute(
                    "SELECT id, username FROM users WHERE id = ?",
                    (uid,),
                ).fetchone()
                if not row:
                    return _json_response(start_response, 404, {"error": "user_not_found"})
                return _json_response(
                    start_response, 200, {"user_id": row["id"], "username": row["username"]}
                )

        # Original prefixed API
        if path == "/api/users/signup":
            if method != "POST":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            body, err = _read_json(environ)
            if body is None:
                return _json_response(start_response, 400, {"error": err})
            username = body.get("username")
            password = body.get("password")
            if not isinstance(username, str) or not isinstance(password, str):
                return _json_response(start_response, 400, {"error": "missing_username_or_password"})
            with session() as conn:
                user_id = register_user(conn, username, password)
                if user_id is None:
                    return _json_response(start_response, 400, {"error": "username_taken"})
                return _json_response(start_response, 201, {"userId": user_id})

        if path == "/api/users/login":
            if method != "POST":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            body, err = _read_json(environ)
            if body is None:
                return _json_response(start_response, 400, {"error": err})
            username = body.get("username")
            password = body.get("password")
            if not isinstance(username, str) or not isinstance(password, str):
                return _json_response(start_response, 400, {"error": "missing_username_or_password"})
            with session() as conn:
                token = login_user(conn, username, password)
                if token is None:
                    return _json_response(start_response, 401, {"error": "invalid_credentials"})
                return _json_response(start_response, 200, {"token": token})

        if path == "/api/profile":
            token = _bearer_token(environ)
            if token is None:
                return _json_response(start_response, 401, {"error": "missing_auth"})
            user_id = verify_auth_token(token)
            if user_id is None:
                return _json_response(start_response, 401, {"error": "invalid_token"})
            if method == "GET":
                with session() as conn:
                    profile = _get_profile(conn, user_id)
                    if profile is None:
                        return _json_response(start_response, 404, {"error": "profile_not_found"})
                    return _json_response(start_response, 200, {"profile": profile})
            if method == "PATCH":
                body, err = _read_json(environ)
                if body is None:
                    return _json_response(start_response, 400, {"error": err})
                allowed = {
                    "currency",
                    "net_worth_cents",
                    "risk_tolerance",
                    "financial_goal",
                    "time_horizon",
                    "age_range",
                    "location",
                }
                fields = {k: body.get(k) for k in allowed if k in body}
                with session() as conn:
                    changed = update_financial_profile(conn, user_id, **fields)
                    profile = _get_profile(conn, user_id)
                    return _json_response(
                        start_response, 200, {"updated": bool(changed), "profile": profile}
                    )
            return _json_response(start_response, 405, {"error": "method_not_allowed"})

        if path == "/expenses":
            token = _bearer_token(environ)
            if token is None:
                return _json_response(start_response, 401, {"error": "missing_auth"})
            user_id = verify_auth_token(token)
            if user_id is None:
                return _json_response(start_response, 401, {"error": "invalid_token"})
            if method == "GET":
                limit = _parse_limit(environ)
                with session() as conn:
                    rows = conn.execute(
                        """
                        SELECT id, user_id, amount_cents, category, occurred_at, note,
                               merchant, source, receipt_url, created_at
                        FROM expenses
                        WHERE user_id = ?
                        ORDER BY occurred_at DESC
                        LIMIT ?
                        """,
                        (user_id, limit),
                    ).fetchall()
                out = []
                for r in rows:
                    occurred = r["occurred_at"] or ""
                    date = occurred[:10] if len(occurred) >= 10 else occurred
                    merchant = r["merchant"] or r["note"] or ""
                    source = r["source"] or ("receipt" if r["category"] == "Receipt" else "manual")
                    out.append(
                        {
                            "id": str(r["id"]),
                            "user_id": str(r["user_id"]),
                            "date": date,
                            "merchant": merchant,
                            "amount": float(r["amount_cents"]) / 100.0,
                            "category": r["category"],
                            "source": source,
                            "receipt_url": r["receipt_url"],
                            "created_at": r["created_at"],
                        }
                    )
                return _json_response(start_response, 200, out)
            if method == "POST":
                body, err = _read_json(environ)
                if body is None:
                    return _json_response(start_response, 400, {"error": err})
                amount_cents = body.get("amount_cents")
                category = body.get("category")
                occurred_at = body.get("occurred_at")
                note = body.get("note")
                merchant = body.get("merchant")
                source = body.get("source")
                receipt_url = body.get("receipt_url")
                if not isinstance(amount_cents, int) or not isinstance(category, str) or not isinstance(
                    occurred_at, str
                ):
                    return _json_response(start_response, 400, {"error": "missing_fields"})
                with session() as conn:
                    cur = conn.execute(
                        """
                        INSERT INTO expenses
                          (user_id, amount_cents, category, occurred_at, note, merchant, source, receipt_url)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            user_id,
                            amount_cents,
                            category,
                            occurred_at,
                            note,
                            merchant,
                            source,
                            receipt_url,
                        ),
                    )
                    conn.commit()
                    return _json_response(start_response, 201, {"id": int(cur.lastrowid)})
            return _json_response(start_response, 405, {"error": "method_not_allowed"})

        if path.startswith("/expenses/"):
            token = _bearer_token(environ)
            if token is None:
                return _json_response(start_response, 401, {"error": "missing_auth"})
            user_id = verify_auth_token(token)
            if user_id is None:
                return _json_response(start_response, 401, {"error": "invalid_token"})
            if method != "DELETE":
                return _json_response(start_response, 405, {"error": "method_not_allowed"})
            tail = path.rsplit("/", 1)[-1]
            try:
                expense_id = int(tail)
            except ValueError:
                return _json_response(start_response, 400, {"error": "invalid_id"})
            with session() as conn:
                cur = conn.execute(
                    "DELETE FROM expenses WHERE id = ? AND user_id = ?",
                    (expense_id, user_id),
                )
                conn.commit()
                return _json_response(
                    start_response, 200, {"deleted": cur.rowcount > 0}
                )

        return _json_response(start_response, 404, {"error": "not_found"})
    except Exception:
        # Minimal error guard; do not leak internal info
        return _json_response(start_response, 500, {"error": "server_error"})


def run(host: str = "127.0.0.1", port: int = 8000) -> None:
    # Reset database on every server start (dev-only behavior).
    db_path = get_default_db_path()
    if db_path.exists():
        db_path.unlink()
    init_db(db_path)
    with make_server(host, port, app) as httpd:
        print(f"Serving HTTP API on http://{host}:{port}")
        httpd.serve_forever()
