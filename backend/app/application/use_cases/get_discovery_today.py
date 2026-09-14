"""GET /api/discovery/today — explainable, non-arbitrary scoring over real
News rows. No clustering yet (needs real cross-source similarity this
system doesn't compute): reported honestly as an empty list, not faked.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.news.entities import News
from app.domain.ports import NewsRepository

_SPORTS_CATEGORIES = {"deportes", "football", "fútbol", "sports", "deporte"}


@dataclass
class ScoreReason:
    factor: str
    weight: float
    explanation: str


@dataclass
class DiscoveryItem:
    news_id: str
    headline: str
    category: str | None
    score: float
    reasons: list[ScoreReason] = field(default_factory=list)


class GetDiscoveryToday:
    def __init__(self, news: NewsRepository) -> None:
        self._news = news

    def execute(self) -> list[DiscoveryItem]:
        items = [self._score(n) for n in self._news.list_recent(50)]
        return sorted(items, key=lambda i: i.score, reverse=True)

    def _score(self, news: News) -> DiscoveryItem:
        reasons: list[ScoreReason] = []

        reference = news.provenance.source_published_at or news.ingested_at
        hours_old = max(0.0, (datetime.now(timezone.utc) - reference).total_seconds() / 3600)
        recency_weight = max(0.0, 1 - hours_old / 48)
        reasons.append(ScoreReason("recency", recency_weight, f"{hours_old:.1f}h old (48h decay window)"))

        is_sports = (news.category or "").lower() in _SPORTS_CATEGORIES
        sports_weight = 0.3 if is_sports else 0.0
        if is_sports:
            reasons.append(ScoreReason("sports_priority", sports_weight, "CRONOS prioritizes sports discovery"))

        score = round(recency_weight + sports_weight, 3)
        return DiscoveryItem(news_id=str(news.id), headline=news.headline, category=news.category, score=score, reasons=reasons)
