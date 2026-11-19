"""SETTINGS — global, singleton site configuration. Deliberately separate
from the content bounded contexts (News/Story/Composition): a site's SEO
metadata isn't produced by the editorial pipeline, it's configured once and
edited rarely. There is exactly one SiteSeoSettings row -- no id, no list,
no per-Story variant.
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SiteSeoSettings:
    site_title: str
    meta_description: str
    keywords: list[str]

    def __post_init__(self) -> None:
        if not self.site_title.strip():
            raise ValueError("site_title cannot be empty")
        if not self.meta_description.strip():
            raise ValueError("meta_description cannot be empty")
