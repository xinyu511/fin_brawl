from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from .db import get_project_root


def _secret_path() -> Path:
    return get_project_root() / "data" / "secret.key"


def _load_or_create_secret() -> bytes:
    p = _secret_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.exists():
        return p.read_bytes()
    secret = os.urandom(32)
    with open(p, "wb") as f:
        f.write(secret)
    try:
        os.chmod(p, 0o600)
    except Exception:
        pass
    return secret


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    s = data.encode("ascii")
    pad = b"=" * ((4 - (len(s) % 4)) % 4)
    return base64.urlsafe_b64decode(s + pad)


def _sign(message: bytes, secret: bytes) -> bytes:
    return hmac.digest(secret, message, hashlib.sha256)


def create_token(user_id: int, ttl_seconds: int = 7 * 24 * 3600) -> str:
    """
    Stateless, HMAC-SHA256 signed token (JWT-like) using stdlib only.
    Structure: base64url(header).base64url(payload).base64url(signature)
    """
    secret = _load_or_create_secret()
    now = int(time.time())
    header = {"alg": "HS256", "typ": "TOKEN"}
    payload = {"uid": int(user_id), "iat": now, "exp": now + int(ttl_seconds)}
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("ascii")
    sig = _b64url_encode(_sign(signing_input, secret))
    return f"{h_b64}.{p_b64}.{sig}"


def verify_token(token: str) -> Optional[int]:
    try:
        secret = _load_or_create_secret()
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h_b64, p_b64, sig_b64 = parts
        signing_input = f"{h_b64}.{p_b64}".encode("ascii")
        expected_sig = _b64url_encode(_sign(signing_input, secret))
        if not hmac.compare_digest(expected_sig, sig_b64):
            return None
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
        if int(payload.get("exp", 0)) < int(time.time()):
            return None
        uid = payload.get("uid")
        return int(uid) if isinstance(uid, int) or (isinstance(uid, str) and uid.isdigit()) else None
    except Exception:
        return None

