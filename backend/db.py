from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Optional


def get_project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def get_default_db_path() -> Path:
    return get_project_root() / "data" / "fin.db"


def get_schema_path() -> Path:
    return get_project_root() / "data" / "schema.sql"


def connect(db_path: Optional[Path] = None) -> sqlite3.Connection:
    path = Path(db_path) if db_path is not None else get_default_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    # Pragmas for safe and reasonably fast defaults
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    return conn


def run_schema(conn: sqlite3.Connection, schema_path: Optional[Path] = None) -> None:
    schema_file = Path(schema_path) if schema_path is not None else get_schema_path()
    with schema_file.open("r", encoding="utf-8") as f:
        conn.executescript(f.read())
    conn.commit()


def init_db(db_path: Optional[Path] = None, schema_path: Optional[Path] = None) -> None:
    conn = connect(db_path)
    try:
        run_schema(conn, schema_path)
        # Lightweight migration: ensure expenses.note exists for older DBs.
        cols = [row["name"] for row in conn.execute("PRAGMA table_info(expenses)")]
        if "note" not in cols:
            conn.execute("ALTER TABLE expenses ADD COLUMN note TEXT")
            conn.commit()
    finally:
        conn.close()


@contextmanager
def session(db_path: Optional[Path] = None) -> Iterator[sqlite3.Connection]:
    conn = connect(db_path)
    try:
        yield conn
    finally:
        conn.close()
