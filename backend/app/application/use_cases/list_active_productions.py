"""The Production dashboard's feed — every production in flight (plus a
few recent finished ones), each with its story's headline attached so the
UI never has to guess which story a production belongs to.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.production.entities import Production
from app.domain.ports import ProductionRepository, StoryRepository


@dataclass
class ActiveProductionItem:
    production: Production
    story_headline: str | None


class ListActiveProductions:
    def __init__(self, productions: ProductionRepository, stories: StoryRepository) -> None:
        self._productions = productions
        self._stories = stories

    def execute(self, limit: int = 50) -> list[ActiveProductionItem]:
        productions = self._productions.list_active(limit=limit)
        items = []
        for p in productions:
            story = self._stories.find_by_id(str(p.story_id))
            items.append(ActiveProductionItem(production=p, story_headline=story.headline if story else None))
        return items
