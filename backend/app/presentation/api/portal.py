"""Portal homepage layout ("Portada").

GET /api/portal/layout   PUBLIC -- what the homepage reads (stage + pinned/hidden)
PUT /api/portal/layout   admin  -- written by the editor's "Portada" tab

Response shape == frontend/src/types/portal.ts (PortalLayout).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import Field

from app.container import Container, get_container
from app.domain.portal.entities import PortalLayout, StageMedia
from app.presentation.auth import require_admin
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/portal", tags=["portal"])


class VideoIn(CamelModel):
    url: str
    title: str = ""
    poster: str | None = None


class RadioIn(CamelModel):
    url: str
    title: str = ""
    logo: str | None = None


class StageIn(CamelModel):
    mode: str = "news"
    video: VideoIn | None = None
    radio: RadioIn | None = None


class LayoutIn(CamelModel):
    stage: StageIn
    pinned: list[str] = Field(default_factory=list)
    hidden: list[str] = Field(default_factory=list)


def layout_out(layout: PortalLayout) -> dict:
    stage: dict = {"mode": layout.mode}
    if layout.video:
        stage["video"] = {"url": layout.video.url, "title": layout.video.title, "poster": layout.video.image}
    if layout.radio:
        stage["radio"] = {"url": layout.radio.url, "title": layout.radio.title, "logo": layout.radio.image}
    return {
        "stage": stage,
        "pinned": list(layout.pinned),
        "hidden": list(layout.hidden),
        "updatedAt": layout.updated_at.isoformat() if layout.updated_at else None,
    }


@router.get("/layout")
def get_layout(container: Container = Depends(get_container)) -> JSONResponse:
    # Short cache: the homepage polls it; edge/browser may reuse it for a few seconds.
    return JSONResponse(layout_out(container.portal_layout_repo.get()),
                        headers={"Cache-Control": "public, max-age=5, stale-while-revalidate=30"})


@router.put("/layout")
def update_layout(body: LayoutIn, container: Container = Depends(get_container), admin=require_admin()) -> dict:
    try:
        layout = PortalLayout(
            mode=body.stage.mode,
            video=StageMedia(body.stage.video.url.strip(), body.stage.video.title.strip(), body.stage.video.poster or None)
            if body.stage.video and body.stage.video.url.strip() else None,
            radio=StageMedia(body.stage.radio.url.strip(), body.stage.radio.title.strip(), body.stage.radio.logo or None)
            if body.stage.radio and body.stage.radio.url.strip() else None,
            pinned=tuple(dict.fromkeys(i for i in body.pinned if i)),
            hidden=tuple(dict.fromkeys(i for i in body.hidden if i)),
            updated_at=datetime.now(timezone.utc),
            updated_by=getattr(admin, "email", None),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    container.portal_layout_repo.save(layout)
    return layout_out(layout)
