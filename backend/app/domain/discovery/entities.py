"""DISCOVERY — raw editorial candidates, before any editorial decision is
made about them. Deliberately separate from `story` (the promoted,
selected editorial unit that Production actually works on): a
DiscoveryItem can exist, be scored, be ignored or archived, without ever
becoming a Story. Only `send_to_editorial()` creates that link.

Not a replacement for `news` (the legacy scraper's own pipeline, which
keeps writing straight to the `news` table for the public site) — this is
the new, real discovery surface Automation feeds real candidates into.
Nothing here is invented: every field either comes from a real upstream
source (LAB's ingestion) or is None/"unavailable" when no real
computation exists yet, never a fabricated number.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import DiscoveryItemId, StoryId


class DiscoveryStatus(str, Enum):
    DISCOVERED = "DISCOVERED"
    SELECTED = "SELECTED"
    IGNORED = "IGNORED"
    ARCHIVED = "ARCHIVED"
    SENT_TO_EDITORIAL = "SENT_TO_EDITORIAL"


class MaterialKind(str, Enum):
    IMAGE = "IMAGE"
    VIDEO = "VIDEO"
    EMBED = "EMBED"
    SOCIAL = "SOCIAL"
    LINK = "LINK"
    DOCUMENT = "DOCUMENT"


@dataclass(frozen=True)
class MaterialReference:
    """A reference to external material found during discovery -- never a
    final asset by itself. `usable_as_final_asset` is a real, explicit
    editorial decision (or None until one is made), not an assumption:
    external URLs are never trusted blindly as production-ready assets
    (rule already established by LAB's renderer/assembly -- see
    obsidian-vault/CRONOS - Assembly.md). When an external image/video
    can't be used directly, `editorial_prompt` carries the brief for
    generating/recreating an appropriate one instead."""
    kind: MaterialKind
    url: str
    usable_as_final_asset: bool | None = None
    editorial_prompt: str | None = None


@dataclass(frozen=True)
class DiscoveryScores:
    """Every field is either a real computation (documented below) or
    None -- "unavailable", never a fabricated number.

    Real today:
      - freshness_score: computed from (discovered_at - published_at).
      - completeness_score: fraction of expected fields actually present.
      - material_score: count/variety of usable MaterialReference entries.
      - duplicate_of: an exact source_url/slug match against LAB's own
        dedupe index (lab/ingestion/dedupe.py) -- exact-match only, not
        semantic/event-level clustering (no embedding/similarity model
        exists anywhere in this workspace yet, see
        docs/NEXUS_ARCHITECTURE_BASELINE.md).

    Not real yet, always None until a real algorithm/model backs them:
      - relevance_score, impact_score, source_quality_score.
    """
    freshness_score: float | None = None
    relevance_score: float | None = None
    impact_score: float | None = None
    source_quality_score: float | None = None
    completeness_score: float | None = None
    material_score: float | None = None
    duplicate_of: str | None = None


@dataclass
class DiscoveryItem:
    id: DiscoveryItemId
    source_url: str
    original_url: str
    original_title: str
    raw_text: str
    source_name: str | None
    source_domain: str
    author: str | None
    language: str | None
    category_id: str | None
    topics: list[str]
    published_at: datetime | None
    discovered_at: datetime
    materials: list[MaterialReference]
    scores: DiscoveryScores
    status: DiscoveryStatus
    story_id: StoryId | None = None

    @staticmethod
    def discover(
        item_id: DiscoveryItemId, source_url: str, original_url: str, original_title: str,
        raw_text: str, source_name: str | None, source_domain: str, discovered_at: datetime,
        published_at: datetime | None = None, author: str | None = None, language: str | None = None,
        category_id: str | None = None, topics: list[str] | None = None,
        materials: list[MaterialReference] | None = None, scores: DiscoveryScores | None = None,
    ) -> "DiscoveryItem":
        return DiscoveryItem(
            id=item_id, source_url=source_url, original_url=original_url, original_title=original_title,
            raw_text=raw_text, source_name=source_name, source_domain=source_domain, author=author,
            language=language, category_id=category_id, topics=topics or [], published_at=published_at,
            discovered_at=discovered_at, materials=materials or [], scores=scores or DiscoveryScores(),
            status=DiscoveryStatus.DISCOVERED,
        )

    def select(self) -> None:
        if self.status != DiscoveryStatus.DISCOVERED:
            raise InvalidStateTransition("DiscoveryItem", self.status.value, DiscoveryStatus.SELECTED.value)
        self.status = DiscoveryStatus.SELECTED

    def ignore(self) -> None:
        if self.status not in (DiscoveryStatus.DISCOVERED, DiscoveryStatus.SELECTED):
            raise InvalidStateTransition("DiscoveryItem", self.status.value, DiscoveryStatus.IGNORED.value)
        self.status = DiscoveryStatus.IGNORED

    def archive(self) -> None:
        if self.status == DiscoveryStatus.SENT_TO_EDITORIAL:
            raise InvalidStateTransition("DiscoveryItem", self.status.value, DiscoveryStatus.ARCHIVED.value)
        self.status = DiscoveryStatus.ARCHIVED

    def send_to_editorial(self, story_id: StoryId) -> None:
        if self.status != DiscoveryStatus.SELECTED:
            raise InvalidStateTransition("DiscoveryItem", self.status.value, DiscoveryStatus.SENT_TO_EDITORIAL.value)
        self.status = DiscoveryStatus.SENT_TO_EDITORIAL
        self.story_id = story_id


class DiscoveryJobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


@dataclass
class DiscoveryJob:
    """One real invocation of Automation's ingestion pipeline. Progress
    fields are only ever set from what automation/runtime actually
    reports back -- never incremented speculatively while "probably still
    running"."""
    id: str
    status: DiscoveryJobStatus
    params: dict
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    items_found: int | None = None
    error: str | None = None

    def start(self) -> None:
        if self.status != DiscoveryJobStatus.QUEUED:
            raise InvalidStateTransition("DiscoveryJob", self.status.value, DiscoveryJobStatus.RUNNING.value)
        self.status = DiscoveryJobStatus.RUNNING

    def complete(self, items_found: int, finished_at: datetime) -> None:
        if self.status != DiscoveryJobStatus.RUNNING:
            raise InvalidStateTransition("DiscoveryJob", self.status.value, DiscoveryJobStatus.COMPLETED.value)
        self.status = DiscoveryJobStatus.COMPLETED
        self.items_found = items_found
        self.finished_at = finished_at

    def fail(self, error: str, finished_at: datetime) -> None:
        if self.status not in (DiscoveryJobStatus.QUEUED, DiscoveryJobStatus.RUNNING):
            raise InvalidStateTransition("DiscoveryJob", self.status.value, DiscoveryJobStatus.FAILED.value)
        self.status = DiscoveryJobStatus.FAILED
        self.error = error
        self.finished_at = finished_at


@dataclass(frozen=True)
class IngestedContent:
    """What Automation's real ingestion (lab.ingestion.run) actually
    produced for one item -- the raw material a DiscoveryItem is built
    from. Deliberately thin and 1:1 with LAB's own WorkspaceItem fields
    (see automation/lab/core/workspace.py): this backend never invents a
    field LAB didn't actually capture."""
    id: str
    title: str
    source_url: str
    source: str | None
    image_url: str | None
    content: str | None
    published_at: str | None
    ingested_at: str
    slug: str | None


@dataclass(frozen=True)
class DiscoveryFilters:
    """Server-side filter/sort/pagination -- the UI never pages through
    an unbounded list client-side."""
    category_id: str | None = None
    status: DiscoveryStatus | None = None
    source_domain: str | None = None
    since: datetime | None = None
    until: datetime | None = None
    sort_by: str = "discovered_at"  # discovered_at | impact_score | relevance_score | freshness_score
    sort_dir: str = "desc"
    limit: int = 50
    offset: int = 0
