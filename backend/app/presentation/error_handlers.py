from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.domain.shared.errors import (
    SchemaNotProvisionedError, NotFoundError, InvalidStateTransition,
    RowLevelSecurityError, SupabaseAuthenticationError, DatabaseUnavailableError,
)
from app.domain.ports import RuntimeUnavailableError

logger = logging.getLogger("cronos.errors")


def _log_cause(exc: Exception) -> None:
    # La respuesta al cliente se clasifica y se simplifica a propósito --
    # pero la excepción real de Supabase/Postgrest (exc.__cause__, ver
    # `raise ... from exc` en guard.py) queda en el log server-side. Nunca
    # se oculta, solo no se le muestra cruda al usuario.
    cause = exc.__cause__ or exc
    logger.warning("Clasificado como %s: %r", type(exc).__name__, cause)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(RuntimeUnavailableError)
    async def _runtime_unavailable(request: Request, exc: RuntimeUnavailableError):
        return JSONResponse(
            status_code=503,
            content={"error": "RUNTIME_UNAVAILABLE", "message": str(exc)},
        )

    @app.exception_handler(SchemaNotProvisionedError)
    async def _schema_not_provisioned(request: Request, exc: SchemaNotProvisionedError):
        _log_cause(exc)
        return JSONResponse(
            status_code=503,
            content={"error": "SCHEMA_NOT_PROVISIONED", "message": str(exc), "relation": exc.relation},
        )

    @app.exception_handler(RowLevelSecurityError)
    async def _rls_error(request: Request, exc: RowLevelSecurityError):
        _log_cause(exc)
        return JSONResponse(
            status_code=503,
            content={"error": "RLS_ERROR", "message": str(exc), "relation": exc.relation},
        )

    @app.exception_handler(SupabaseAuthenticationError)
    async def _auth_error(request: Request, exc: SupabaseAuthenticationError):
        _log_cause(exc)
        return JSONResponse(
            status_code=503,
            content={"error": "AUTHENTICATION_ERROR", "message": str(exc), "relation": exc.relation},
        )

    @app.exception_handler(DatabaseUnavailableError)
    async def _db_unavailable(request: Request, exc: DatabaseUnavailableError):
        _log_cause(exc)
        return JSONResponse(
            status_code=503,
            content={"error": "DATABASE_UNAVAILABLE", "message": str(exc), "relation": exc.relation},
        )

    @app.exception_handler(NotFoundError)
    async def _not_found(request: Request, exc: NotFoundError):
        return JSONResponse(status_code=404, content={"error": "NOT_FOUND", "message": str(exc)})

    @app.exception_handler(InvalidStateTransition)
    async def _invalid_transition(request: Request, exc: InvalidStateTransition):
        return JSONResponse(status_code=409, content={"error": "INVALID_STATE_TRANSITION", "message": str(exc)})
