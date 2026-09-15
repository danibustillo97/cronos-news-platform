from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.container import Container, get_container
from app.domain.discovery.entities import DiscoveryFilters, DiscoveryStatus
from app.application.use_cases.discovery import (
    DecideDiscoveryItemInput, ReportDiscoveryJobStatusInput, TriggerDiscoveryInput,
)
from app.presentation.schemas import (
    NewsRankingItemOut, DiscoveryJobOut, DiscoveryItemOut,
    TriggerDiscoveryRequest, ReportDiscoveryJobStatusRequest, DecideDiscoveryItemRequest,
)
from app.presentation.mappers import news_ranking_item_out, discovery_job_out, discovery_item_out

router = APIRouter(prefix="/api/discovery", tags=["discovery"])


class DiscoveryTodayResponse(BaseModel):
    items: list[NewsRankingItemOut]
    clusters: list = []


@router.get("/today", response_model=DiscoveryTodayResponse)
def discovery_today(container: Container = Depends(get_container)) -> DiscoveryTodayResponse:
    """The Command Center's simple re-ranking of existing `news` rows --
    NOT the real Discovery pipeline below (see /jobs, /items)."""
    items = container.get_discovery_today.execute()
    return DiscoveryTodayResponse(items=[news_ranking_item_out(i) for i in items], clusters=[])


# ── Real Discovery: search -> discover -> evaluate -> select ───────────

@router.post("/jobs", response_model=DiscoveryJobOut)
def trigger_discovery(body: TriggerDiscoveryRequest, container: Container = Depends(get_container)) -> DiscoveryJobOut:
    """DISCOVERY UP -- asks Automation to run a real ingestion pass."""
    job = container.trigger_discovery.execute(
        TriggerDiscoveryInput(max_sources=body.max_sources, max_items=body.max_items)
    )
    return discovery_job_out(job)


@router.get("/jobs/{job_id}", response_model=DiscoveryJobOut)
def get_discovery_job(job_id: str, container: Container = Depends(get_container)) -> DiscoveryJobOut:
    return discovery_job_out(container.get_discovery_job.execute(job_id))


class DiscoveryJobsResponse(BaseModel):
    jobs: list[DiscoveryJobOut]


@router.get("/jobs", response_model=DiscoveryJobsResponse)
def list_discovery_jobs(limit: int = Query(20, le=100), container: Container = Depends(get_container)) -> DiscoveryJobsResponse:
    return DiscoveryJobsResponse(jobs=[discovery_job_out(j) for j in container.list_discovery_jobs.execute(limit)])


@router.patch("/jobs/{job_id}", response_model=DiscoveryJobOut)
def report_discovery_job_status(
    job_id: str, body: ReportDiscoveryJobStatusRequest, container: Container = Depends(get_container),
) -> DiscoveryJobOut:
    """Called by automation/runtime as a real discovery job progresses --
    never called by the frontend directly."""
    job = container.report_discovery_job_status.execute(ReportDiscoveryJobStatusInput(
        job_id=job_id, status=body.status, items_found=body.items_found,
        item_ids=body.item_ids, error=body.error,
    ))
    return discovery_job_out(job)


class DiscoveryItemsResponse(BaseModel):
    items: list[DiscoveryItemOut]


@router.get("/items", response_model=DiscoveryItemsResponse)
def list_discovery_items(
    category_id: str | None = None,
    status: str | None = None,
    source_domain: str | None = None,
    sort_by: str = "discovered_at",
    sort_dir: str = "desc",
    limit: int = Query(50, le=200),
    offset: int = 0,
    container: Container = Depends(get_container),
) -> DiscoveryItemsResponse:
    """Server-side filtered/sorted/paginated -- the frontend never fetches
    an unbounded list to filter client-side."""
    filters = DiscoveryFilters(
        category_id=category_id, status=DiscoveryStatus(status) if status else None,
        source_domain=source_domain, sort_by=sort_by, sort_dir=sort_dir, limit=limit, offset=offset,
    )
    items = container.list_discovery_items.execute(filters)
    return DiscoveryItemsResponse(items=[discovery_item_out(i) for i in items])


@router.post("/items/{item_id}/decide", response_model=DiscoveryItemOut)
def decide_discovery_item(
    item_id: str, body: DecideDiscoveryItemRequest, container: Container = Depends(get_container),
) -> DiscoveryItemOut:
    item = container.decide_discovery_item.execute(DecideDiscoveryItemInput(item_id=item_id, decision=body.decision))
    return discovery_item_out(item)
