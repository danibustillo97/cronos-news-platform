from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile

from app.container import Container, get_container
from app.domain.ads.entities import POSITION_SIZES
from app.application.use_cases.ads import CreateAdBannerInput, UpdateAdBannerInput
from app.presentation.schemas import AdBannerOut, UpdateAdBannerRequest
from app.presentation.mappers import ad_banner_out

router = APIRouter(prefix="/api/ads", tags=["ads"])

_MAX_UPLOAD_BYTES = 2 * 1024 * 1024  # 2MB -- a banner is a small, fixed-size image, not a hero photo


@router.get("/positions")
def list_positions() -> dict[str, dict[str, int]]:
    """The one source of truth for each slot's required pixel size --
    the admin upload form reads this instead of hardcoding it a second
    time on the frontend."""
    return {pos: {"width": w, "height": h} for pos, (w, h) in POSITION_SIZES.items()}


@router.get("", response_model=list[AdBannerOut])
def list_active_banners(
    position: str = Query(...), container: Container = Depends(get_container),
) -> list[AdBannerOut]:
    """What the public site's <AdSlot position="X"> renders."""
    if position not in POSITION_SIZES:
        raise HTTPException(status_code=422, detail=f"unknown position: {position!r}")
    banners = container.list_active_ad_banners.execute(position)
    return [ad_banner_out(b) for b in banners]


@router.get("/all", response_model=list[AdBannerOut])
def list_all_banners(container: Container = Depends(get_container)) -> list[AdBannerOut]:
    """The admin management list -- every banner, every position, active
    or not."""
    banners = container.list_ad_banners.execute()
    return [ad_banner_out(b) for b in banners]


@router.post("", response_model=AdBannerOut)
async def create_banner(
    position: str = Form(...), link_url: str = Form(...), alt_text: str = Form(""),
    file: UploadFile = File(...), container: Container = Depends(get_container),
) -> AdBannerOut:
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"file exceeds {_MAX_UPLOAD_BYTES // 1024}KB")
    try:
        banner = container.create_ad_banner.execute(CreateAdBannerInput(
            position=position, link_url=link_url, alt_text=alt_text,
            filename=file.filename or "banner.jpg", content=content,
            content_type=file.content_type or "application/octet-stream",
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return ad_banner_out(banner)


@router.patch("/{banner_id}", response_model=AdBannerOut)
def update_banner(
    banner_id: str, body: UpdateAdBannerRequest, container: Container = Depends(get_container),
) -> AdBannerOut:
    try:
        banner = container.update_ad_banner.execute(UpdateAdBannerInput(
            banner_id=banner_id, link_url=body.link_url, alt_text=body.alt_text, active=body.active,
        ))
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return ad_banner_out(banner)


@router.delete("/{banner_id}", status_code=204)
def delete_banner(banner_id: str, container: Container = Depends(get_container)) -> None:
    container.delete_ad_banner.execute(banner_id)
