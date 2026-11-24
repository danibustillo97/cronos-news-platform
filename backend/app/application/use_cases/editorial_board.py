"""Editorial board (Kanban) use cases -- the one screen the newsroom works in.

Columns, in the order an article moves through them:

  incoming   Entrantes    new candidates from the scraper (DISCOVERED/SELECTED)
  writing    Redactando   drafts being written by a person, or by the AI (job
                          QUEUED/RUNNING/FAILED, no article yet)
  review     Por revisar  REVIEW_REQUIRED / VALIDATED (needs a human) and
                          APPROVED (ready to publish)
  scheduled  Programadas  SCHEDULED / PUBLISHING
  published  Publicadas   PUBLISHED (most recent)

Every action reuses the existing, tested use cases; this module only
composes them so the UI needs one call per screen and one click per step.
"""
from __future__ import annotations

import html
import re
import unicodedata
import uuid
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime, timezone

from app.application.use_cases.artifact import (
    OpenManualDiscoveryEditor, OpenManualDiscoveryEditorInput, TriggerArtifact, TriggerArtifactInput,
)
from app.application.use_cases.discovery import DecideDiscoveryItem, DecideDiscoveryItemInput
from app.domain.artifact.entities import (
    Artifact, ArtifactJob, ArtifactStatus, MediaKind, MediaRequirement, SeoMetadata, SourceReference,
)
from app.domain.category.entities import CategoryGroup
from app.domain.discovery.entities import DiscoveryFilters, DiscoveryItem, DiscoveryStatus
from app.domain.discovery.trends import StoryCluster, rank_clusters
from app.domain.ports import (
    ArtifactJobRepository, ArtifactRepository, DiscoveryRepository, StoryRepository,
)
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import ArtifactId, StoryId
from app.domain.story.entities import Story, StorySource

COLUMNS = ("incoming", "writing", "review", "scheduled", "published")
_STATUS_COLUMN = {
    ArtifactStatus.DRAFT: "writing",
    ArtifactStatus.REVIEW_REQUIRED: "review",
    ArtifactStatus.VALIDATED: "review",
    ArtifactStatus.APPROVED: "review",
    ArtifactStatus.SCHEDULED: "scheduled",
    ArtifactStatus.PUBLISHING: "scheduled",
    ArtifactStatus.PUBLISHED: "published",
}


@dataclass
class BoardCard:
    """One card. kind = 'item' (a candidate, id = discovery item id),
    'job' (AI writing, id = story id) or 'article' (id = artifact id)."""
    kind: str
    id: str
    column: str
    title: str
    status: str
    story_id: str | None = None
    excerpt: str | None = None
    image_url: str | None = None
    source: str | None = None
    category_id: str | None = None
    at: datetime | None = None
    scheduled_at: datetime | None = None
    issue_count: int = 0
    job_status: str | None = None
    job_error: str | None = None
    slug: str | None = None
    topics: list[str] = field(default_factory=list)
    relevance: float | None = None
    # Trend data (incoming cards are whole stories, not single items)
    heat: float | None = None
    signals: list[str] = field(default_factory=list)
    sources: list[str] = field(default_factory=list)
    cluster_ids: list[str] = field(default_factory=list)
    first_seen: datetime | None = None


@dataclass
class EditorialBoard:
    columns: dict[str, list[BoardCard]] = field(default_factory=lambda: {c: [] for c in COLUMNS})


def _feature_image(artifact: Artifact) -> str | None:
    feature = next((m for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE), None)
    return feature.external_url if feature else None


def _item_card(item: DiscoveryItem) -> BoardCard:
    return BoardCard(
        kind="item", id=str(item.id), column="incoming", title=item.original_title, status=item.status.value,
        excerpt=(item.raw_text or "")[:220] or None,
        image_url=next((m.url for m in item.materials if m.kind.value == "IMAGE"), None),
        source=item.source_name or item.source_domain, category_id=item.category_id,
        at=item.published_at or item.discovered_at,
        topics=list(item.topics[:3]), relevance=item.scores.relevance_score,
    )


def _story_card(cluster: StoryCluster, now: datetime) -> BoardCard:
    card = _item_card(cluster.lead)
    card.heat = cluster.heat(now)
    card.signals = cluster.signals(now)
    card.sources = cluster.sources
    card.cluster_ids = [str(i.id) for i in cluster.items]
    card.first_seen = cluster.first_seen
    card.at = cluster.last_seen
    card.relevance = max((i.scores.relevance_score or 0.0) for i in cluster.items)
    return card


def _article_card(artifact: Artifact) -> BoardCard:
    return BoardCard(
        kind="article", id=str(artifact.id), column=_STATUS_COLUMN[artifact.status], title=artifact.title,
        status=artifact.status.value, story_id=str(artifact.story_id), excerpt=artifact.excerpt or None,
        image_url=_feature_image(artifact),
        source=(artifact.sources[0].source_name or artifact.sources[0].source_domain) if artifact.sources else None,
        category_id=artifact.category_id,
        at=artifact.published_at if artifact.status == ArtifactStatus.PUBLISHED else artifact.created_at,
        scheduled_at=artifact.scheduled_at, issue_count=len(artifact.validation.issues), slug=artifact.seo.slug,
    )


class GetEditorialBoard:
    def __init__(self, items: DiscoveryRepository, artifacts: ArtifactRepository, jobs: ArtifactJobRepository) -> None:
        self._items = items
        self._artifacts = artifacts
        self._jobs = jobs

    def execute(self, incoming_limit: int = 200, published_limit: int = 20, incoming_shown: int = 150) -> EditorialBoard:
        board = EditorialBoard()
        article_queries = (
            (ArtifactStatus.DRAFT, 100), (ArtifactStatus.REVIEW_REQUIRED, 100), (ArtifactStatus.VALIDATED, 100),
            (ArtifactStatus.APPROVED, 100), (ArtifactStatus.SCHEDULED, 100), (ArtifactStatus.PUBLISHING, 20),
            (ArtifactStatus.PUBLISHED, published_limit), (ArtifactStatus.ARCHIVED, 200),
        )

        def items(status: DiscoveryStatus, limit: int):
            return self._items.list(DiscoveryFilters(status=status, sort_by="discovered_at", sort_dir="desc", limit=limit))

        # ~12 independent reads: run them concurrently (one round-trip of latency, not twelve).
        with ThreadPoolExecutor(max_workers=8) as pool:
            selected_f = pool.submit(items, DiscoveryStatus.SELECTED, incoming_limit)
            discovered_f = pool.submit(items, DiscoveryStatus.DISCOVERED, incoming_limit)
            sent_f = pool.submit(items, DiscoveryStatus.SENT_TO_EDITORIAL, 100)
            jobs_f = pool.submit(self._jobs.list_recent, 200)
            article_fs = [(status, pool.submit(self._artifacts.list_by_status, status.value, limit))
                          for status, limit in article_queries]

        # Incoming = STORIES: the same news from several outlets is one card,
        # ranked by heat (freshness first, then how many outlets, then relevance).
        now = datetime.now(timezone.utc)
        board.columns["incoming"] = [
            _story_card(cluster, now) for cluster in rank_clusters([*selected_f.result(), *discovered_f.result()], now)
        ]

        stories_with_article: set[str] = set()
        for status, future in article_fs:
            for artifact in future.result():
                stories_with_article.add(str(artifact.story_id))
                if status != ArtifactStatus.ARCHIVED:
                    board.columns[_STATUS_COLUMN[status]].append(_article_card(artifact))

        # Stories the AI is writing (or failed to write) that have no article yet.
        latest_job: dict[str, ArtifactJob] = {}
        for job in jobs_f.result():
            key = str(job.story_id)
            if key not in latest_job or job.created_at > latest_job[key].created_at:
                latest_job[key] = job
        for item in sent_f.result():
            story_id = str(item.story_id or item.id)
            if story_id in stories_with_article:
                continue
            job = latest_job.get(story_id)
            card = _item_card(item)
            card.kind, card.id, card.column, card.story_id = "job", story_id, "writing", story_id
            card.job_status = job.status.value if job else None
            card.job_error = job.error if job else None
            card.status = "AI_" + (job.status.value if job else "PENDING")
            board.columns["writing"].append(card)

        board.columns["incoming"] = board.columns["incoming"][:incoming_shown]
        board.columns["review"].sort(key=lambda c: (c.status != "APPROVED", -(c.at or datetime.min.replace(tzinfo=timezone.utc)).timestamp()))
        for name in ("writing", "published"):
            board.columns[name].sort(key=lambda c: c.at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)
        board.columns["scheduled"].sort(key=lambda c: c.scheduled_at or datetime.max.replace(tzinfo=timezone.utc))
        return board


# ── One-click "write" from an incoming card ────────────────────────────────

@dataclass
class WriteItemInput:
    item_id: str
    mode: str  # "manual" | "ai"
    provider: str | None = None
    # Same story from other outlets: archived once this one is being written,
    # so the board doesn't offer the same news again.
    sibling_ids: list[str] = field(default_factory=list)


@dataclass
class WriteItemResult:
    artifact: Artifact | None = None
    job: ArtifactJob | None = None


class WriteDiscoveryItem:
    """DISCOVERED -> (SELECT) -> manual editor / AI draft, in one call."""

    def __init__(
        self, items: DiscoveryRepository, decide: DecideDiscoveryItem,
        open_manual: OpenManualDiscoveryEditor, trigger_artifact: TriggerArtifact,
    ) -> None:
        self._items = items
        self._decide = decide
        self._open_manual = open_manual
        self._trigger = trigger_artifact

    def execute(self, input: WriteItemInput) -> WriteItemResult:
        if input.mode not in ("manual", "ai"):
            raise ValueError("mode must be 'manual' or 'ai'")
        item = self._items.find_by_id(input.item_id)
        if item is None:
            raise NotFoundError("DiscoveryItem", input.item_id)
        if item.status == DiscoveryStatus.DISCOVERED:
            item = self._decide.execute(DecideDiscoveryItemInput(item_id=input.item_id, decision="SELECT"))

        if input.mode == "manual":
            result = WriteItemResult(artifact=self._open_manual.execute(OpenManualDiscoveryEditorInput(input.item_id)))
        else:
            if item.status == DiscoveryStatus.SELECTED:
                item = self._decide.execute(DecideDiscoveryItemInput(item_id=input.item_id, decision="SEND_TO_EDITORIAL"))
            story_id = str(item.story_id or item.id)
            result = WriteItemResult(job=self._trigger.execute(TriggerArtifactInput(story_id=story_id, provider=input.provider)))
        archive_siblings(self._items, self._decide, input.sibling_ids, keep=input.item_id)
        return result


def archive_siblings(items: DiscoveryRepository, decide: DecideDiscoveryItem, ids: list[str], keep: str | None = None,
                     decision: str = "ARCHIVE") -> int:
    """Best effort: an outlet's copy that can't change state is just skipped."""
    done = 0
    for sibling_id in dict.fromkeys(ids):
        if sibling_id == keep:
            continue
        sibling = items.find_by_id(sibling_id)
        if sibling is None or sibling.status not in (DiscoveryStatus.DISCOVERED, DiscoveryStatus.SELECTED):
            continue
        try:
            decide.execute(DecideDiscoveryItemInput(item_id=sibling_id, decision=decision))
            done += 1
        except Exception:  # noqa: BLE001
            continue
    return done


# ── Blank article ("+ Nueva noticia") ──────────────────────────────────────

def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")[:90] or "noticia"


def text_to_html(text: str) -> str:
    """Plain text -> <p> per paragraph; HTML is kept as-is."""
    if re.search(r"<(p|h[1-6]|ul|ol|figure|blockquote)\b", text or "", re.I):
        return text
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n|\r\n\s*\r\n", text or "") if p.strip()]
    if len(paragraphs) <= 1:
        paragraphs = [p.strip() for p in (text or "").splitlines() if p.strip()]
    return "".join(f"<p>{html.escape(p)}</p>" for p in paragraphs) or "<p></p>"


def match_category(name: str | None, groups: list[CategoryGroup]) -> str | None:
    if not name:
        return None

    def fold(value: str) -> str:
        value = unicodedata.normalize("NFKD", value.lower())
        return "".join(c for c in value if not unicodedata.combining(c)).strip()

    wanted = fold(name)
    for group in groups:
        for category in group.categories:
            if wanted in (fold(category.name), fold(category.slug)):
                return category.id
    for group in groups:  # "deporte" -> group "Deportes" -> its first category
        if fold(group.name).rstrip("s") == wanted.rstrip("s") and group.categories:
            return group.categories[0].id
    return None


@dataclass
class CreateArticleInput:
    title: str
    content: str = ""
    excerpt: str | None = None
    category_id: str | None = None
    image_url: str | None = None
    source_url: str | None = None
    source_name: str | None = None
    tags: list[str] = field(default_factory=list)
    slug: str | None = None
    story_label: str = "manual"
    legacy_news_id: str | None = None


class CreateArticle:
    """A new DRAFT article written from scratch (no scraper candidate).
    Also used by the one-off migration of the old 'Noticias' drafts."""

    def __init__(self, stories: StoryRepository, artifacts: ArtifactRepository) -> None:
        self._stories = stories
        self._artifacts = artifacts

    def execute(self, input: CreateArticleInput) -> Artifact:
        title = (input.title or "").strip()
        if not title:
            raise ValueError("El titular no puede estar vacío")
        seed = input.legacy_news_id or str(uuid.uuid4())
        story_id = StoryId.of(f"manual-{uuid.uuid5(uuid.NAMESPACE_URL, 'cronos:story:' + seed).hex[:16]}")
        self._stories.save(Story.open_from_news(story_id, title, StorySource(
            news_id=None, source_url=input.source_url, label=input.story_label,
        )))

        content_html = text_to_html(input.content)
        plain = re.sub(r"<[^>]+>", " ", html.unescape(content_html))
        plain = " ".join(plain.split())
        excerpt = (input.excerpt or plain[:240]).strip() or title
        now = datetime.now(timezone.utc)
        sources = []
        if input.source_url:
            from urllib.parse import urlparse
            domain = urlparse(input.source_url).hostname or ""
            sources = [SourceReference(source_url=input.source_url, source_name=input.source_name or domain,
                                       source_domain=domain, author=None, published_at=None, retrieved_at=now)]
        artifact = Artifact.draft(
            artifact_id=ArtifactId.of(str(uuid.uuid5(uuid.NAMESPACE_URL, f"cronos:article:{seed}"))),
            story_id=story_id, version=1, title=title, subtitle=None, excerpt=excerpt,
            summary=plain[:1000] or title, content_html=content_html, category_id=input.category_id,
            tags=list(input.tags), entities=[],
            seo=SeoMetadata(seo_title=title[:60], seo_description=excerpt[:160],
                            slug=input.slug or slugify(title), canonical_url=None),
            sources=sources, claims=[],
            media_requirements=[MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE,
                                                 prompt="", external_url=input.image_url)],
            created_at=now,
        )
        self._artifacts.save(artifact)
        return artifact


# ── Block editor: images ───────────────────────────────────────────────────

class UploadArticleImage:
    def __init__(self, artifacts: ArtifactRepository, storage) -> None:
        self._artifacts = artifacts
        self._storage = storage

    def execute(self, artifact_id: str, content: bytes, content_type: str) -> str:
        if self._artifacts.find_by_id(artifact_id) is None:
            raise NotFoundError("Artifact", artifact_id)
        return self._storage.upload(artifact_id, content, content_type)


class SetFeatureImage:
    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, artifact_id: str, url: str | None, caption: str | None = None,
                alt_text: str | None = None) -> Artifact:
        artifact = self._artifacts.find_by_id(artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", artifact_id)
        if url is not None and not url.lower().startswith(("https://", "http://")):
            raise ValueError("La imagen debe ser una URL http(s)")
        artifact.set_feature_image(url, caption, alt_text)
        self._artifacts.save(artifact)
        return artifact


# ── Originality (plagiarism) check ─────────────────────────────────────────

class CheckArticleOriginality:
    """Compares the article against what it was written from: the scraped
    source item, items with the same source URL, and the same story as told
    by other outlets in the last 72 h (title-similarity clustering)."""

    MAX_SOURCES = 10

    def __init__(self, artifacts: ArtifactRepository, items: DiscoveryRepository) -> None:
        self._artifacts = artifacts
        self._items = items

    def execute(self, artifact_id: str, text: str | None = None):
        from datetime import timedelta

        from app.domain.discovery.trends import SIMILARITY_THRESHOLD, similarity, title_tokens
        from app.domain.editorial.originality import SourceText, check_originality

        artifact = self._artifacts.find_by_id(artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", artifact_id)
        body = text if text and text.strip() else re.sub(r"<[^>]+>", " ", html.unescape(artifact.content_html))

        found: dict[str, SourceText] = {}

        def add(item) -> None:
            if item is None or str(item.id) in found or len(found) >= self.MAX_SOURCES:
                return
            found[str(item.id)] = SourceText(
                name=item.source_name or item.source_domain, url=item.source_url,
                text=f"{item.original_title}\n{item.raw_text or ''}",
            )

        add(self._items.find_by_id(str(artifact.story_id)))
        finder = getattr(self._items, "find_by_source_url", None)
        for ref in artifact.sources:
            if finder and ref.source_url:
                add(finder(ref.source_url))

        tokens = title_tokens(artifact.title)
        recent = self._items.list(DiscoveryFilters(
            since=datetime.now(timezone.utc) - timedelta(hours=72), sort_by="discovered_at", sort_dir="desc", limit=300,
        ))
        for item in sorted(recent, key=lambda i: similarity(tokens, title_tokens(i.original_title)), reverse=True):
            if similarity(tokens, title_tokens(item.original_title)) < SIMILARITY_THRESHOLD:
                break
            add(item)

        return check_originality(body, list(found.values()))
