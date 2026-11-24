"""Supabase client factory. Falls back to the anon key (read-only per RLS
— supabase_setup/cronos_platform_schema.sql only grants writes to role
'authenticated') unless SUPABASE_SECRET_KEY is set, which this
backend needs for its own writes (Story/Production/Composition/...).

That key is never hardcoded, never logged, never sent to the frontend —
only read from the environment, optionally via backend/.env (gitignored,
same manual-parser pattern as automation/lab/config/settings.py — no
new dependency). Set it locally:

    # news/backend/.env
    SUPABASE_SECRET_KEY=...
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from supabase import create_client, Client

_ENV_FILE = Path(__file__).resolve().parents[4] / ".env"  # backend/.env


def _load_env_file() -> None:
    if not _ENV_FILE.exists():
        return
    for line in _ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        # Real (non-empty) env vars always win; an EMPTY one counts as unset --
        # e.g. a CI/shell that exports SUPABASE_SERVICE_ROLE_KEY="" must not
        # silently hide the value in backend/.env and fall back to anon.
        if key and not os.environ.get(key) and value.strip():
            os.environ[key] = value.strip()


_load_env_file()


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
    if not url:
        raise RuntimeError("SUPABASE_URL is required")
    if not key:
        raise RuntimeError("SUPABASE_SECRET_KEY (or SUPABASE_PUBLISHABLE_KEY) is required")
    return create_client(url, key)
