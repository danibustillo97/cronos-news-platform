"""TRENDS -- what is breaking right now, and what everyone is covering.

Two ideas, both deterministic (no model):

1. Story clustering. The same story published by several outlets is ONE
   story: titles are reduced to their meaningful words (names, clubs,
   numbers -- not "vs", "hora", "dónde ver") and grouped when they share
   enough of them. Distinct outlets in a cluster = how hard it is trending.

2. Heat. Freshness dominates (a newsroom lives on the last hours), then
   trend (how many outlets), then relevance to the content profile:

       heat = 0.55·freshness + 0.30·trend + 0.15·relevance
       freshness = exp(-age_h / 5)            (≈0.82 at 1h, 0.30 at 6h, 0.08 at 12h)
       trend     = min(1, (outlets - 1) / 4)  (1 outlet 0, 3 outlets 0.5, 5+ outlets 1)

   so a 4-hour-old story always beats a 2-day-old one unless the old one is
   massively covered -- and even then only within the same day.

Signals shown to editors:
   BREAKING  newest item in the cluster < 60 min old
   TRENDING  3+ outlets in the cluster
   SCOOP     only 1 outlet so far and < 2 h old (chance to be first)
   LIVE      a live/minute-by-minute item, < 4 h old
"""
from __future__ import annotations

import math
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.domain.discovery.entities import DiscoveryItem

FRESHNESS_HALF_LIFE_H = 5.0
SIMILARITY_THRESHOLD = 0.34
LIVE_PATTERN = re.compile(r"\b(en directo|en vivo|minuto a minuto|ao vivo|live)\b")
MIN_SHARED_TOKENS = 2

_STOP = set("""
a al ante bajo cabe con contra de del desde durante e el ella ellas ellos en entre era es esa ese eso esta este esto
estos estas ha han hasta hay la las le les lo los mas más me mi muy no nos o os para pero por que qué quien quién se
sin sobre su sus tambien también te tras tu un una uno unos unas y ya yo como cómo cuando cuándo donde dónde fue ser
son será sera fueron tiene tienen hace asi así otro otra este esta aquí aqui ahora hoy ayer mañana manana tras luego
vs versus partido partidos fecha hora horario canal canales donde ver online gratis vivo directo minuto vivo en
cuando juega juegan jugar jugara jugará juego dia día dias días semana noche tarde quien mira mire asi así todo todos
toda todas nuevo nueva gran grandes primer primera segundo segunda tercera final mejor mejores peor sigue seguir
the of and to in on for with at is are o os um uma do da dos das no na nos nas em que com por para ao aos como
""".split())


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def title_tokens(title: str) -> frozenset[str]:
    words = re.findall(r"[a-z0-9]+", _fold(title))
    return frozenset(w for w in words if (len(w) >= 3 or w.isdigit()) and w not in _STOP)


def similarity(a: frozenset[str], b: frozenset[str]) -> float:
    if not a or not b:
        return 0.0
    shared = len(a & b)
    if shared < MIN_SHARED_TOKENS:
        return 0.0
    return shared / len(a | b)


def item_time(item: DiscoveryItem) -> datetime:
    return item.published_at or item.discovered_at


@dataclass
class StoryCluster:
    items: list[DiscoveryItem] = field(default_factory=list)
    member_tokens: list[frozenset[str]] = field(default_factory=list)

    @property
    def sources(self) -> list[str]:
        seen: list[str] = []
        for item in sorted(self.items, key=item_time):
            name = item.source_name or item.source_domain
            if name not in seen:
                seen.append(name)
        return seen

    @property
    def first_seen(self) -> datetime:
        return min(item_time(i) for i in self.items)

    @property
    def last_seen(self) -> datetime:
        return max(item_time(i) for i in self.items)

    @property
    def lead(self) -> DiscoveryItem:
        """The card shown for the cluster: the NEWEST take (stories evolve:
        the result beats the preview), preferring one with an image."""
        return max(self.items, key=lambda i: (bool(i.materials), item_time(i)))

    @property
    def is_live(self) -> bool:
        return any(LIVE_PATTERN.search(_fold(i.original_title)) for i in self.items)

    def heat(self, now: datetime) -> float:
        age_h = max(0.0, (now - self.last_seen).total_seconds() / 3600)
        freshness = math.exp(-age_h / FRESHNESS_HALF_LIFE_H)
        trend = min(1.0, (len(self.sources) - 1) / 4)
        relevance = max((i.scores.relevance_score or 0.0) for i in self.items)
        return round(0.55 * freshness + 0.30 * trend + 0.15 * relevance, 4)

    def signals(self, now: datetime) -> list[str]:
        out: list[str] = []
        newest_age_min = (now - self.last_seen).total_seconds() / 60
        if newest_age_min < 60:
            out.append("BREAKING")
        if len(self.sources) >= 3:
            out.append("TRENDING")
        if len(self.sources) == 1 and (now - self.first_seen).total_seconds() < 2 * 3600:
            out.append("SCOOP")
        if self.is_live and newest_age_min < 4 * 60:
            out.append("LIVE")
        return out


def cluster_items(items: list[DiscoveryItem]) -> list[StoryCluster]:
    """Greedy, newest-first clustering by title-token similarity."""
    clusters: list[StoryCluster] = []
    for item in sorted(items, key=item_time, reverse=True):
        tokens = title_tokens(item.original_title)
        best, best_sim = None, 0.0
        for cluster in clusters:
            # Compare with each member (not the union): a growing cluster must
            # not start swallowing loosely related stories.
            sim = max((similarity(tokens, member) for member in cluster.member_tokens), default=0.0)
            if sim > best_sim:
                best, best_sim = cluster, sim
        if best is not None and best_sim >= SIMILARITY_THRESHOLD:
            best.items.append(item)
            best.member_tokens.append(tokens)
        else:
            clusters.append(StoryCluster(items=[item], member_tokens=[tokens]))
    return clusters


def rank_clusters(items: list[DiscoveryItem], now: datetime | None = None) -> list[StoryCluster]:
    now = now or datetime.now(timezone.utc)
    return sorted(cluster_items(items), key=lambda c: (c.heat(now), c.last_seen), reverse=True)
