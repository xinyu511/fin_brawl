from __future__ import annotations

import sqlite3
from typing import Optional, Tuple

from .auth import signin as _signin, signup as _signup
from .token import create_token, verify_token


def register_user(conn: sqlite3.Connection, username: str, password: str) -> Optional[int]:
    """
    Create a new user and default financial profile.
    Returns user_id on success, None if username exists.
    """
    return _signup(conn, username, password)


def login_user(conn: sqlite3.Connection, username: str, password: str) -> Optional[str]:
    """
    Verify credentials; on success returns a signed auth token.
    """
    user_id = _signin(conn, username, password)
    if user_id is None:
        return None
    return create_token(user_id)


def verify_auth_token(token: str) -> Optional[int]:
    """
    Verify token signature and expiry. Returns user_id or None.
    """
    return verify_token(token)


def logout(_: sqlite3.Connection, __: str) -> bool:
    """
    Stateless tokens: logout is client-side (discard token).
    Returns True for convenience.
    """
    return True

