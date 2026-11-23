"""EDITORIAL AUTOMATION -- the one switch between the two ways the newsroom
works:

  * OFF (default): the scraper brings candidates into Discovery and every
    article is written by a human in the editor (manual desk).
  * ON ("modo API"): after each scraper run the autopilot picks the best
    fresh candidates and the Anthropic API writes a draft for each one.
    Drafts land in Revisión; publishing always stays a human decision.

Hard limits (per run / per day) exist because every generated draft costs
real API tokens.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class EditorialAutomationSettings:
    enabled: bool = False
    max_articles_per_run: int = 2
    max_articles_per_day: int = 10
    min_text_chars: int = 400
    updated_at: datetime | None = None
    updated_by: str | None = None

    def __post_init__(self) -> None:
        if not 1 <= self.max_articles_per_run <= 10:
            raise ValueError("max_articles_per_run must be between 1 and 10")
        if not 1 <= self.max_articles_per_day <= 100:
            raise ValueError("max_articles_per_day must be between 1 and 100")
        if self.max_articles_per_run > self.max_articles_per_day:
            raise ValueError("max_articles_per_run cannot exceed max_articles_per_day")
        if not 0 <= self.min_text_chars <= 20000:
            raise ValueError("min_text_chars must be between 0 and 20000")
