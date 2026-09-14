"""guard.raise_if_schema_missing debe distinguir 4 causas reales -- nunca
colapsarlas en un solo "schema not provisioned" (CRONOS, sesión "FIX REAL
NEWS -> RUNTIME -> LAB", ERROR 2)."""
from __future__ import annotations

import httpx
import pytest
from postgrest.exceptions import APIError

from app.domain.shared.errors import (
    SchemaNotProvisionedError, RowLevelSecurityError, SupabaseAuthenticationError, DatabaseUnavailableError,
)
from app.infrastructure.persistence.supabase.guard import raise_if_schema_missing


def _api_error(code: str, message: str) -> APIError:
    return APIError({"code": code, "message": message, "hint": None, "details": None})


def test_missing_relation_is_schema_not_provisioned():
    exc = _api_error("42P01", 'relation "cronos_stories" does not exist')
    with pytest.raises(SchemaNotProvisionedError):
        raise_if_schema_missing(exc, "cronos_stories")


def test_missing_column_is_schema_not_provisioned():
    """42703 (undefined_column) -- ej. lab_item_id todavía sin migrar --
    es el mismo remedio que una tabla faltante, nunca un 500 crudo."""
    exc = _api_error("42703", 'column productions.lab_item_id does not exist')
    with pytest.raises(SchemaNotProvisionedError):
        raise_if_schema_missing(exc, "productions")


def test_postgrest_schema_cache_miss_is_schema_not_provisioned():
    exc = _api_error("PGRST205", "Could not find the table 'public.production_jobs' in the schema cache")
    with pytest.raises(SchemaNotProvisionedError):
        raise_if_schema_missing(exc, "production_jobs")


def test_rls_denial_is_rls_error_not_schema_not_provisioned():
    exc = _api_error("42501", 'new row violates row-level security policy for table "cronos_stories"')
    with pytest.raises(RowLevelSecurityError):
        raise_if_schema_missing(exc, "cronos_stories")


def test_bad_jwt_is_authentication_error():
    exc = _api_error("PGRST301", "JWT expired")
    with pytest.raises(SupabaseAuthenticationError):
        raise_if_schema_missing(exc, "cronos_stories")


def test_invalid_api_key_is_authentication_error():
    exc = _api_error("", "Invalid API key")
    with pytest.raises(SupabaseAuthenticationError):
        raise_if_schema_missing(exc, "cronos_stories")


def test_connection_failure_is_database_unavailable():
    exc = httpx.ConnectError("Connection refused")
    with pytest.raises(DatabaseUnavailableError):
        raise_if_schema_missing(exc, "cronos_stories")


def test_unrecognized_error_is_left_unclassified():
    """Un error que no matchea ningún patrón conocido NO se disfraza de
    ninguno de los 4 -- se deja pasar (el caller hace `raise` después)."""
    exc = ValueError("algo completamente distinto")
    raise_if_schema_missing(exc, "cronos_stories")  # no debe lanzar nada
