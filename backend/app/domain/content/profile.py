"""CONTENT PROFILE -- what THIS newsroom covers, chosen at first-run setup.

The profile drives the scraper end to end: which sources it reads, which
items it keeps, and how it ranks them. Relevance is deterministic keyword
matching against the catalog (no model, no invented confidence): an item
scores higher the more of the chosen competitions/focuses it really
mentions, with mentions in the title worth more than in the body.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime

from app.domain.content.catalog import (
    COMPETITIONS, FOCUSES, FOOTBALL_SIGNALS, MODES, OTHER_SPORTS, SOURCES, CatalogSource,
)

DEFAULT_COMPETITIONS = tuple(c.id for c in COMPETITIONS)
DEFAULT_FOCUSES = ("market", "stats", "results")


@dataclass(frozen=True)
class CustomSource:
    url: str
    name: str | None = None
    covers: tuple[str, ...] = ("general",)


@dataclass(frozen=True)
class ContentProfile:
    mode: str = "football"
    setup_completed: bool = False
    competitions: tuple[str, ...] = DEFAULT_COMPETITIONS
    focuses: tuple[str, ...] = DEFAULT_FOCUSES
    disabled_sources: tuple[str, ...] = ()
    custom_sources: tuple[CustomSource, ...] = ()
    priority_terms: tuple[str, ...] = ()   # teams/players the user cares about most
    blocked_terms: tuple[str, ...] = ()    # never keep items mentioning these
    updated_at: datetime | None = None
    updated_by: str | None = None

    def __post_init__(self) -> None:
        if self.mode not in {m.id for m in MODES}:
            raise ValueError(f"modo desconocido: {self.mode!r}")
        known_competitions = {c.id for c in COMPETITIONS}
        unknown = [c for c in self.competitions if c not in known_competitions]
        if unknown:
            raise ValueError(f"competiciones desconocidas: {unknown}")
        unknown = [f for f in self.focuses if f not in {f.id for f in FOCUSES}]
        if unknown:
            raise ValueError(f"enfoques desconocidos: {unknown}")
        if self.mode == "football" and not self.competitions:
            raise ValueError("elige al menos una competición")
        for source in self.custom_sources:
            if not source.url.lower().startswith(("http://", "https://")):
                raise ValueError(f"URL de fuente inválida: {source.url!r}")

    def active_sources(self) -> list[CatalogSource | CustomSource]:
        """Catalog sources for this mode that cover something chosen (or are
        general), minus the ones the user switched off, plus custom feeds."""
        wanted = set(self.competitions) | ({"market"} if "market" in self.focuses else set()) | {"general"}
        picked: list[CatalogSource | CustomSource] = [
            s for s in SOURCES
            if self.mode in s.modes and s.id not in self.disabled_sources
            and (self.mode != "football" or wanted & set(s.covers))
        ]
        return [*picked, *self.custom_sources]


# ── Relevance ──────────────────────────────────────────────────────────────

def _fold(text: str) -> str:
    text = unicodedata.normalize("NFKD", (text or "").lower())
    return "".join(c for c in text if not unicodedata.combining(c))


def _has(text: str, term: str) -> bool:
    term = _fold(term).strip()
    if not term:
        return False
    return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text) is not None


@dataclass
class Relevance:
    keep: bool
    score: float                      # 0..1
    competitions: list[str] = field(default_factory=list)   # display names
    focuses: list[str] = field(default_factory=list)        # display names
    reason: str | None = None         # why it was dropped

    @property
    def topics(self) -> list[str]:
        return [*self.competitions, *self.focuses]


def score_relevance(profile: ContentProfile, title: str, body: str) -> Relevance:
    t, b = _fold(title), _fold(body)[:6000]
    full = f"{t}\n{b}"

    for term in profile.blocked_terms:
        if _has(full, term):
            return Relevance(False, 0.0, reason=f"término bloqueado: {term}")

    if profile.mode == "all":
        return Relevance(True, 0.5)

    football_hits = sum(1 for s in FOOTBALL_SIGNALS if _has(full, s))
    other_hits = sum(1 for s in OTHER_SPORTS if _has(t, s)) * 2 + sum(1 for s in OTHER_SPORTS if _has(b, s))

    chosen = [c for c in COMPETITIONS if c.id in profile.competitions]
    comp_points: list[tuple[str, float]] = []
    for comp in chosen:
        in_title = sum(1 for k in comp.keywords if _has(t, k))
        in_body = sum(1 for k in comp.keywords if _has(b, k))
        if in_title or in_body >= 2:  # one passing mention in the body is not "about" it
            comp_points.append((comp.name, min(1.0, in_title * 0.5 + in_body * 0.15)))

    focus_points: list[tuple[str, float]] = []
    for item in (f for f in FOCUSES if f.id in profile.focuses):
        hits = sum(1 for k in item.keywords if _has(t, k)) * 2 + sum(1 for k in item.keywords if _has(b, k))
        if hits:
            focus_points.append((item.name, min(1.0, hits * 0.12)))

    priority = sum(1 for p in profile.priority_terms if _has(t, p)) * 2 + sum(1 for p in profile.priority_terms if _has(b, p))

    if not comp_points and any(_has(t, s) for s in OTHER_SPORTS):
        return Relevance(False, 0.0, reason="es de otro deporte")
    if not comp_points and football_hits < 2:
        return Relevance(False, 0.0, reason="no es de fútbol o no toca tus competiciones")
    if other_hits > football_hits + 1 and not comp_points:
        return Relevance(False, 0.0, reason="es de otro deporte")

    score = (
        0.55 * max((p for _, p in comp_points), default=0.0)
        + 0.25 * max((p for _, p in focus_points), default=0.0)
        + 0.10 * min(1.0, football_hits / 4)
        + 0.10 * min(1.0, priority / 2)
    )
    return Relevance(
        True, round(min(1.0, score), 3),
        competitions=[name for name, _ in sorted(comp_points, key=lambda x: -x[1])],
        focuses=[name for name, _ in sorted(focus_points, key=lambda x: -x[1])],
    )
