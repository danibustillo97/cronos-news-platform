"""PUBLICATION boundary -- read-only. This is the contract a downstream
consumer of Editorial's Publish stage (Studio, eventually; nothing
today) is meant to depend on -- never /api/discovery/*, /api/artifacts/*,
or /api/stories/*. Editorial has zero awareness this router exists.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.container import Container, get_container
from app.presentation.schemas import PublishedContentOut
from app.presentation.mappers import published_content_out

router = APIRouter(prefix="/api/published-content", tags=["published-content"])


class PublishedContentListResponse(BaseModel):
    items: list[PublishedContentOut]


@router.get("", response_model=PublishedContentListResponse)
def list_published_content(
    limit: int = Query(20, le=100), category: str | None = Query(None),
    container: Container = Depends(get_container),
) -> PublishedContentListResponse:
    items = container.list_published_content.execute(limit=limit, category=category)
    return PublishedContentListResponse(items=[published_content_out(c) for c in items])


@router.get("/by-slug/{slug}", response_model=PublishedContentOut)
def get_published_content_by_slug(slug: str, container: Container = Depends(get_container)) -> PublishedContentOut:
    return published_content_out(container.get_published_content_by_slug.execute(slug))


@router.get("/{content_id}", response_model=PublishedContentOut)
def get_published_content(content_id: str, container: Container = Depends(get_container)) -> PublishedContentOut:
    return published_content_out(container.get_published_content.execute(content_id))
