from __future__ import annotations

from fastapi import APIRouter, Depends

from app.container import Container, get_container
from app.application.use_cases.seo_settings import UpdateSeoSettingsInput
from app.presentation.schemas import SeoSettingsOut, UpdateSeoSettingsRequest
from app.presentation.mappers import seo_settings_out

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/seo", response_model=SeoSettingsOut)
def get_seo_settings(container: Container = Depends(get_container)) -> SeoSettingsOut:
    return seo_settings_out(container.get_seo_settings.execute())


@router.put("/seo", response_model=SeoSettingsOut)
def update_seo_settings(body: UpdateSeoSettingsRequest, container: Container = Depends(get_container)) -> SeoSettingsOut:
    settings = container.update_seo_settings.execute(
        UpdateSeoSettingsInput(site_title=body.site_title, meta_description=body.meta_description, keywords=body.keywords)
    )
    return seo_settings_out(settings)
