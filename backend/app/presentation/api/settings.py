from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.container import Container, get_container
from app.application.use_cases.seo_settings import UpdateSeoSettingsInput
from app.application.use_cases.editorial_automation import UpdateEditorialAutomationInput
from app.presentation.schemas import (
    CamelModel, EditorialAutomationOut, SeoSettingsOut, UpdateEditorialAutomationRequest, UpdateSeoSettingsRequest,
)
from app.presentation.mappers import seo_settings_out
from app.presentation.auth import require_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/seo", response_model=SeoSettingsOut)
def get_seo_settings(container: Container = Depends(get_container)) -> SeoSettingsOut:
    return seo_settings_out(container.get_seo_settings.execute())


@router.put("/seo", response_model=SeoSettingsOut)
def update_seo_settings(
    body: UpdateSeoSettingsRequest,
    container: Container = Depends(get_container),
    _admin= require_admin(),
) -> SeoSettingsOut:
    settings = container.update_seo_settings.execute(
        UpdateSeoSettingsInput(site_title=body.site_title, meta_description=body.meta_description, keywords=body.keywords)
    )
    return seo_settings_out(settings)


# ── Modo automático editorial (piloto) ─────────────────────────────────────

def _automation_out(settings) -> EditorialAutomationOut:
    return EditorialAutomationOut(
        enabled=settings.enabled, max_articles_per_run=settings.max_articles_per_run,
        max_articles_per_day=settings.max_articles_per_day, min_text_chars=settings.min_text_chars,
        updated_at=settings.updated_at, updated_by=settings.updated_by,
    )


@router.get("/editorial-automation", response_model=EditorialAutomationOut)
def get_editorial_automation(
    container: Container = Depends(get_container),
    _admin= require_admin(),
) -> EditorialAutomationOut:
    return _automation_out(container.get_editorial_automation.execute())


@router.put("/editorial-automation", response_model=EditorialAutomationOut)
def update_editorial_automation(
    body: UpdateEditorialAutomationRequest,
    container: Container = Depends(get_container),
    admin= require_admin(),
) -> EditorialAutomationOut:
    """ON = the autopilot writes drafts with the Anthropic API after each
    scraper run (409 PROVIDER_UNAVAILABLE if the API key isn't usable).
    OFF = scraper only; articles are written by hand in the editor."""
    try:
        settings = container.update_editorial_automation.execute(UpdateEditorialAutomationInput(
            enabled=body.enabled, max_articles_per_run=body.max_articles_per_run,
            max_articles_per_day=body.max_articles_per_day, min_text_chars=body.min_text_chars,
            updated_by=getattr(admin, "email", None),
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _automation_out(settings)


# ── Perfil de contenido (setup inicial) ────────────────────────────────────

class CustomSourceIn(CamelModel):
    url: str
    name: str | None = None
    covers: list[str] = ["general"]


class UpdateContentProfileRequest(CamelModel):
    mode: str
    competitions: list[str] = []
    focuses: list[str] = []
    disabled_sources: list[str] = []
    custom_sources: list[CustomSourceIn] = []
    priority_terms: list[str] = []
    blocked_terms: list[str] = []


def _profile_out(profile) -> dict:
    from app.domain.content.catalog import COMPETITIONS, FOCUSES, MODES, SOURCES

    active = {getattr(s, "id", None) for s in profile.active_sources()}
    return {
        "mode": profile.mode,
        "setupCompleted": profile.setup_completed,
        "competitions": list(profile.competitions),
        "focuses": list(profile.focuses),
        "disabledSources": list(profile.disabled_sources),
        "customSources": [{"url": s.url, "name": s.name, "covers": list(s.covers)} for s in profile.custom_sources],
        "priorityTerms": list(profile.priority_terms),
        "blockedTerms": list(profile.blocked_terms),
        "updatedAt": profile.updated_at.isoformat() if profile.updated_at else None,
        "updatedBy": profile.updated_by,
        "activeSourceCount": len(profile.active_sources()),
        "catalog": {
            "modes": [{"id": m.id, "name": m.name, "description": m.description, "available": m.available} for m in MODES],
            "competitions": [{"id": c.id, "name": c.name, "group": c.group} for c in COMPETITIONS],
            "focuses": [{"id": f.id, "name": f.name, "description": f.description} for f in FOCUSES],
            "sources": [{"id": s.id, "name": s.name, "url": s.url, "modes": list(s.modes), "covers": list(s.covers),
                         "language": s.language, "active": s.id in active} for s in SOURCES],
        },
    }


@router.get("/content-profile")
def get_content_profile(container: Container = Depends(get_container), _admin= require_admin()) -> dict:
    return _profile_out(container.get_content_profile.execute())


@router.put("/content-profile")
def update_content_profile(
    body: UpdateContentProfileRequest, container: Container = Depends(get_container), admin= require_admin(),
) -> dict:
    from app.application.use_cases.content_profile import UpdateContentProfileInput

    try:
        profile = container.update_content_profile.execute(UpdateContentProfileInput(
            mode=body.mode, competitions=body.competitions, focuses=body.focuses,
            disabled_sources=body.disabled_sources, custom_sources=[s.model_dump() for s in body.custom_sources],
            priority_terms=body.priority_terms, blocked_terms=body.blocked_terms,
            updated_by=getattr(admin, "email", None),
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _profile_out(profile)
