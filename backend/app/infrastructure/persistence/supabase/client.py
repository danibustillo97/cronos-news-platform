"""Supabase client factory. Falls back to the anon key (read-only per RLS
— supabase_setup/cronos_platform_schema.sql only grants writes to role
'authenticated') unless SUPABASE_SERVICE_ROLE_KEY is set, which this
backend needs for its own writes (Story/Production/Composition/...).

That key is never hardcoded, never logged, never sent to the frontend —
only read from the environment, optionally via backend/.env (gitignored,
same manual-parser pattern as automation/lab/config/settings.py — no
new dependency). Set it locally:

    # news/backend/.env
    SUPABASE_SERVICE_ROLE_KEY=...
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from supabase import create_client, Client

_DEFAULT_URL = "https://mxvdnfaeqjifnxqmxbri.supabase.co"
_DEFAULT_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14dmRuZmFlcWppZm54cW14YnJpIiwic"
    "m9sZSI6ImFub24iLCJpYXQiOjE3NTIyNjg0NzAsImV4cCI6MjA2Nzg0NDQ3MH0.KLD8IAWiAIhkKXJ9lZR7Yc6GaPpxOa3zdaItozCw4Hc"
)

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
    url = os.getenv("SUPABASE_URL", _DEFAULT_URL)
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY", _DEFAULT_ANON_KEY)
    return create_client(url, key)
