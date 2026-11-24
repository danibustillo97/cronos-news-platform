"""Supabase client factory.

Prefer the server-only secret key for backend writes. When it is absent,
fall back to a publishable/anon key; that client remains subject to RLS and
is intentionally limited to operations allowed to public clients.

Supported names:
  - Server secret: SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY
  - Publishable: SUPABASE_PUBLISHABLE_KEY, SUPABASE_ANON_KEY or SUPABASE_KEY

No key is hardcoded, logged, or returned from this module.
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
        if key and key not in os.environ:
            os.environ[key] = value.strip()


_load_env_file()


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    secret_key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    publishable_key = (
        os.getenv("SUPABASE_PUBLISHABLE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or os.getenv("SUPABASE_KEY")
    )
    key = secret_key or publishable_key

    if not url:
        raise RuntimeError("SUPABASE_URL is required")
    if not key:
        raise RuntimeError(
            "SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY or "
            "SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY is required"
        )
    return create_client(url, key)
