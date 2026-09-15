"""GET /api/discovery/today — explainable, non-arbitrary scoring over real
News rows. No clustering yet (needs real cross-source similarity this
system doesn't compute): reported honestly as an empty list, not faked.

NOTE: this is NOT the real Discovery bounded context (see
app/domain/discovery/) -- that's the actual "search -> discover ->
evaluate -> select" pipeline over Automation's real ingestion, with jobs,
persistence, and a real state machine. This module predates it: a
lightweight re-ranking of whatever's already in the legacy `news` table,
for the Command Center's "Discover Today" panel. Named NewsRankingItem,
not DiscoveryItem, specifically to avoid colliding with the real one.
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
class NewsRankingItem:
    news_id: str
    headline: str
    category: str | None
    score: float
    reasons: list[ScoreReason] = field(default_factory=list)


class GetDiscoveryToday:
    def __init__(self, news: NewsRepository) -> None:
        self._news = news

    def execute(self) -> list[NewsRankingItem]:
        items = [self._score(n) for n in self._news.list_recent(50)]
        return sorted(items, key=lambda i: i.score, reverse=True)

    def _score(self, news: News) -> NewsRankingItem:
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
        return NewsRankingItem(news_id=str(news.id), headline=news.headline, category=news.category, score=score, reasons=reasons)
