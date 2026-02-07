from __future__ import annotations

import base64
import hashlib
import hmac
import os
import sqlite3
from typing import Optional


PBKDF2_ROUNDS = 310_000
ALGO_LABEL = "pbkdf2_sha256"


def _b64e(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64d(s: str) -> bytes:
    return base64.b64decode(s.encode("ascii"))


def hash_password(password: str, *, rounds: int = PBKDF2_ROUNDS) -> str:
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
    return f"{ALGO_LABEL}${rounds}${_b64e(salt)}${_b64e(dk)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds_s, salt_b64, hash_b64 = stored.split("$", 3)
        if algo != ALGO_LABEL:
            return False
        rounds = int(rounds_s)
        salt = _b64d(salt_b64)
        expected = _b64d(hash_b64)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, rounds)
        return hmac.compare_digest(dk, expected)
    except Exception:
        return False


def signup(conn: sqlite3.Connection, username: str, password: str) -> Optional[int]:
    try:
        pw_hash = hash_password(password)
        cur = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, pw_hash),
        )
        user_id = cur.lastrowid
        conn.execute("INSERT INTO financial_profiles (user_id) VALUES (?)", (user_id,))
        conn.commit()
        return int(user_id)
    except sqlite3.IntegrityError:
        conn.rollback()
        return None


def signin(conn: sqlite3.Connection, username: str, password: str) -> Optional[int]:
    row = conn.execute(
        "SELECT id, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if row and verify_password(password, row["password_hash"]):
        conn.execute(
            "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?",
            (row["id"],),
        )
        conn.commit()
        return int(row["id"])
    return None

