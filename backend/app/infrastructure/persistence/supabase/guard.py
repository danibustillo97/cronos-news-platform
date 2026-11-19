"""Classifies a raw Supabase/Postgrest exception into an honest, distinct
domain error instead of letting an opaque 500 bubble up or mislabeling
everything as "schema not provisioned". Every repository call site keeps
calling this the same way (`raise_if_schema_missing(exc, relation)`) —
only this function's classification got smarter; nothing else changed.

Four real, distinct causes (never collapsed into one bucket):
  - SCHEMA_NOT_PROVISIONED — the table/column doesn't exist yet.
  - RLS_ERROR             — schema exists, credentials are valid, but the
                              row-level security policy rejected the write
                              (needs SUPABASE_SERVICE_ROLE_KEY).
  - AUTHENTICATION_ERROR  — Supabase rejected the API key/JWT itself.
  - DATABASE_UNAVAILABLE  — couldn't reach Supabase at all.
An error that matches none of these is left to bubble up unchanged — we
never guess when we don't have real evidence.
"""
from __future__ import annotations

import httpx

from app.domain.shared.errors import (
    SchemaNotProvisionedError, RowLevelSecurityError, SupabaseAuthenticationError, DatabaseUnavailableError,
)


def raise_if_schema_missing(exc: Exception, relation: str) -> None:
    if isinstance(exc, (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError)):
        raise DatabaseUnavailableError(relation) from exc

    code = getattr(exc, "code", None) or ""
    message = str(exc)
    lower = message.lower()

    # PostgREST returns this exact shape (code 404, "JSON could not be
    # generated") for a table it has never seen in its schema cache -- a
    # real, observed symptom of "not provisioned yet", distinct from the
    # Postgres-level 42P01/PGRST20x codes above but the same root cause.
    if (
        code in ("42P01", "42703", "PGRST204", "PGRST205") or "schema cache" in lower or "does not exist" in lower
        or "json could not be generated" in lower
    ):
        raise SchemaNotProvisionedError(relation) from exc
    if code == "42501" or "row-level security" in lower:
        raise RowLevelSecurityError(relation) from exc
    if code in ("PGRST301", "PGRST302") or "jwt" in lower or "invalid api key" in lower or "invalid authentication" in lower:
        raise SupabaseAuthenticationError(relation) from exc
    if "connection" in lower or "timed out" in lower or "timeout" in lower:
        raise DatabaseUnavailableError(relation) from exc
