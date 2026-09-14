from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.container import Container, get_container
from app.presentation.schemas import DiscoveryItemOut
from app.presentation.mappers import discovery_item_out

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


class DiscoveryTodayResponse(BaseModel):
    items: list[DiscoveryItemOut]
    clusters: list = []


@router.get("/today", response_model=DiscoveryTodayResponse)
def discovery_today(container: Container = Depends(get_container)) -> DiscoveryTodayResponse:
    items = container.get_discovery_today.execute()
    return DiscoveryTodayResponse(items=[discovery_item_out(i) for i in items], clusters=[])
