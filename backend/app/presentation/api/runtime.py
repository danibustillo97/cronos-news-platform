from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.container import Container, get_container

router = APIRouter(prefix="/api/runtime", tags=["runtime"])


class RuntimeStatusResponse(BaseModel):
    connected: bool


@router.get("/status", response_model=RuntimeStatusResponse)
def runtime_status(container: Container = Depends(get_container)) -> RuntimeStatusResponse:
    """Nunca inventa progreso: pregunta al Local Runtime en vivo (sección
    22 del pedido) — si no responde, connected=False, sin más."""
    return RuntimeStatusResponse(connected=container.runtime.is_connected())
