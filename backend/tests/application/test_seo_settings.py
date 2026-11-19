from __future__ import annotations

from app.domain.settings.entities import SiteSeoSettings
from app.application.use_cases.seo_settings import GetSeoSettings, UpdateSeoSettings, UpdateSeoSettingsInput


class InMemorySiteSettingsRepo:
    def __init__(self, initial: SiteSeoSettings):
        self._settings = initial

    def get_seo(self):
        return self._settings

    def save_seo(self, settings):
        self._settings = settings


def _initial():
    return SiteSeoSettings(site_title="Nexus News", meta_description="desc", keywords=["deportes"])


def test_get_returns_the_repository_value():
    repo = InMemorySiteSettingsRepo(_initial())
    result = GetSeoSettings(repo).execute()
    assert result == _initial()


def test_update_saves_trimmed_title_and_description():
    repo = InMemorySiteSettingsRepo(_initial())
    result = UpdateSeoSettings(repo).execute(
        UpdateSeoSettingsInput(site_title="  New Title  ", meta_description="  New desc  ", keywords=["a"])
    )
    assert result.site_title == "New Title"
    assert result.meta_description == "New desc"
    assert repo.get_seo() == result


def test_update_drops_empty_and_whitespace_only_keywords():
    repo = InMemorySiteSettingsRepo(_initial())
    result = UpdateSeoSettings(repo).execute(
        UpdateSeoSettingsInput(site_title="T", meta_description="D", keywords=["deportes", "  ", "", "nba "])
    )
    assert result.keywords == ["deportes", "nba"]


def test_entity_rejects_empty_title_or_description():
    import pytest
    with pytest.raises(ValueError):
        SiteSeoSettings(site_title="", meta_description="d", keywords=[])
    with pytest.raises(ValueError):
        SiteSeoSettings(site_title="t", meta_description="  ", keywords=[])
