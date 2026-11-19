from __future__ import annotations

from dataclasses import dataclass

from app.domain.settings.entities import SiteSeoSettings
from app.domain.ports import SiteSettingsRepository


class GetSeoSettings:
    def __init__(self, settings: SiteSettingsRepository) -> None:
        self._settings = settings

    def execute(self) -> SiteSeoSettings:
        return self._settings.get_seo()


@dataclass
class UpdateSeoSettingsInput:
    site_title: str
    meta_description: str
    keywords: list[str]


class UpdateSeoSettings:
    def __init__(self, settings: SiteSettingsRepository) -> None:
        self._settings = settings

    def execute(self, input: UpdateSeoSettingsInput) -> SiteSeoSettings:
        settings = SiteSeoSettings(
            site_title=input.site_title.strip(),
            meta_description=input.meta_description.strip(),
            keywords=[k.strip() for k in input.keywords if k.strip()],
        )
        self._settings.save_seo(settings)
        return settings
