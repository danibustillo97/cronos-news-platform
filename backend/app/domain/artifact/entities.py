"""ARTIFACT — NEXUS's editorial intelligence engine. Not "AI Generate":
this is the structured process that turns real sources (from a Story
seeded by a selected DiscoveryItem) into original, evidence-tracked
editorial content -- title, subtitle, excerpt, structured HTML, SEO,
entities, media requirements -- never a mechanical paraphrase of a single
source, never an invented fact.

Runtime boundary (deliberate): the actual language generation happens via
a real LLM API call (ArtifactGenerationPort, see ports.py), never via a
Claude Code subprocess. Claude Code / its skills remain development and
inspection tools (see automation/.claude/skills/lab-editorial-*) -- the
production runtime must work with zero interactive session attached.

Reuses LAB Editorial Intelligence's own real evidence taxonomy (see
automation/docs/LAB_EDITORIAL_INTELLIGENCE.md) rather than inventing a
new one: SOURCE_FACT/VERIFIED_CONTEXT/INFERENCE/CREATIVE_FRAMING/
UNVERIFIED. Same discipline, different executor (a real API call instead
of a Claude Code skill).
"""
from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
from enum import Enum

from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import ArtifactId, StoryId


class EvidenceLabel(str, Enum):
    SOURCE_FACT = "SOURCE_FACT"
    VERIFIED_CONTEXT = "VERIFIED_CONTEXT"
    INFERENCE = "INFERENCE"
    CREATIVE_FRAMING = "CREATIVE_FRAMING"
    UNVERIFIED = "UNVERIFIED"


@dataclass(frozen=True)
class SourceReference:
    """One real source this Artifact was built from -- kept separate from
    the editorial content itself (rule: sources and NEXUS's own editorial
    synthesis never get merged into one blob, provenance must stay
    traceable to a specific real source)."""
    source_url: str
    source_name: str | None
    source_domain: str
    author: str | None
    published_at: datetime | None
    retrieved_at: datetime
    license_info: str | None = None


@dataclass(frozen=True)
class Claim:
    """One factual assertion in the article, labeled honestly. A claim
    with no real source backing it is UNVERIFIED or CREATIVE_FRAMING --
    never silently presented as SOURCE_FACT."""
    text: str
    label: EvidenceLabel
    source_urls: list[str] = field(default_factory=list)


class MediaKind(str, Enum):
    FEATURE_IMAGE = "FEATURE_IMAGE"
    BODY_IMAGE = "BODY_IMAGE"
    VIDEO = "VIDEO"


@dataclass(frozen=True)
class MediaRequirement:
    """A multimedia need the Artifact declared -- never a fabricated
    asset. `asset_id` is None until a human/pipeline actually fulfills it
    (generate/upload/replace, Phase 7) -- this is the persisted need, not
    the fulfillment."""
    placeholder_id: str  # e.g. "FEATURE_IMAGE", "BODY_IMAGE_01"
    kind: MediaKind
    prompt: str
    asset_id: str | None = None


@dataclass(frozen=True)
class SeoMetadata:
    seo_title: str
    seo_description: str
    slug: str
    canonical_url: str | None = None


class ArtifactStatus(str, Enum):
    DRAFT = "DRAFT"                    # LLM output landed, not validated yet
    REVIEW_REQUIRED = "REVIEW_REQUIRED"  # failed a real validation, or evidence conflicted/insufficient
    VALIDATED = "VALIDATED"            # passed every real automated check -- still needs human approval
    APPROVED = "APPROVED"              # human approved -- this IS "READY" (see Story.mark_produced())
    REJECTED = "REJECTED"
    PUBLISHED = "PUBLISHED"            # a real row now exists in the public site's content table


@dataclass(frozen=True)
class ValidationIssue:
    check: str
    detail: str


@dataclass(frozen=True)
class ValidationResult:
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues


@dataclass
class Artifact:
    id: ArtifactId
    story_id: StoryId
    version: int
    status: ArtifactStatus
    title: str
    subtitle: str | None
    excerpt: str
    summary: str
    content_html: str
    category_id: str | None
    tags: list[str]
    entities: list[str]
    seo: SeoMetadata
    sources: list[SourceReference]
    claims: list[Claim]
    media_requirements: list[MediaRequirement]
    validation: ValidationResult
    created_at: datetime
    editorial_notes: str | None = None  # why REVIEW_REQUIRED, if it is
    published_news_id: str | None = None  # real id of the row this produced in the public `news` table

    @staticmethod
    def draft(
        artifact_id: ArtifactId, story_id: StoryId, version: int, title: str, subtitle: str | None,
        excerpt: str, summary: str, content_html: str, category_id: str | None, tags: list[str],
        entities: list[str], seo: SeoMetadata, sources: list[SourceReference], claims: list[Claim],
        media_requirements: list[MediaRequirement], created_at: datetime,
    ) -> "Artifact":
        return Artifact(
            id=artifact_id, story_id=story_id, version=version, status=ArtifactStatus.DRAFT,
            title=title, subtitle=subtitle, excerpt=excerpt, summary=summary, content_html=content_html,
            category_id=category_id, tags=tags, entities=entities, seo=seo, sources=sources, claims=claims,
            media_requirements=media_requirements, validation=ValidationResult(), created_at=created_at,
        )

    def apply_validation(self, result: ValidationResult) -> None:
        if self.status not in (ArtifactStatus.DRAFT, ArtifactStatus.REVIEW_REQUIRED):
            raise InvalidStateTransition("Artifact", self.status.value, "VALIDATED/REVIEW_REQUIRED")
        self.validation = result
        if result.ok:
            self.status = ArtifactStatus.VALIDATED
            self.editorial_notes = None
        else:
            self.status = ArtifactStatus.REVIEW_REQUIRED
            self.editorial_notes = "; ".join(f"{i.check}: {i.detail}" for i in result.issues)

    def approve(self) -> None:
        if self.status != ArtifactStatus.VALIDATED:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.APPROVED.value)
        self.status = ArtifactStatus.APPROVED

    def reject(self, reason: str) -> None:
        if self.status not in (ArtifactStatus.VALIDATED, ArtifactStatus.REVIEW_REQUIRED):
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.REJECTED.value)
        self.status = ArtifactStatus.REJECTED
        self.editorial_notes = reason

    def fulfill_media_requirement(self, placeholder_id: str, asset_id: str) -> None:
        """PHASE 7: attaches a real, generated Asset to one of this
        Artifact's declared media needs. Only ever moves a requirement
        from asset_id=None to a real id -- re-fulfilling one that already
        has an asset would silently discard which image is actually
        referenced by the published article, so that's a real error, not
        a quiet overwrite."""
        updated: list[MediaRequirement] = []
        found = False
        for requirement in self.media_requirements:
            if requirement.placeholder_id != placeholder_id:
                updated.append(requirement)
                continue
            found = True
            if requirement.asset_id is not None:
                raise ValueError(f"Media requirement {placeholder_id!r} already has asset {requirement.asset_id!r}")
            updated.append(replace(requirement, asset_id=asset_id))
        if not found:
            raise ValueError(f"No media requirement {placeholder_id!r} on this Artifact")
        self.media_requirements = updated

    def publish(self, news_id: str) -> None:
        """Real, one-way: only an APPROVED (= READY) Artifact can be
        published, and only once -- publishing twice would create a
        second, duplicate row in the public site's content table."""
        if self.status != ArtifactStatus.APPROVED:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.PUBLISHED.value)
        self.status = ArtifactStatus.PUBLISHED
        self.published_news_id = news_id


class ArtifactJobStatus(str, Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"


@dataclass
class ArtifactJob:
    id: str
    story_id: StoryId
    status: ArtifactJobStatus
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    artifact_id: str | None = None
    error: str | None = None

    def start(self) -> None:
        if self.status != ArtifactJobStatus.QUEUED:
            raise InvalidStateTransition("ArtifactJob", self.status.value, ArtifactJobStatus.RUNNING.value)
        self.status = ArtifactJobStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

    def complete(self, artifact_id: str, review_required: bool, finished_at: datetime) -> None:
        if self.status != ArtifactJobStatus.RUNNING:
            raise InvalidStateTransition("ArtifactJob", self.status.value, ArtifactJobStatus.COMPLETED.value)
        self.status = ArtifactJobStatus.REVIEW_REQUIRED if review_required else ArtifactJobStatus.COMPLETED
        self.artifact_id = artifact_id
        self.finished_at = finished_at

    def fail(self, error: str, finished_at: datetime) -> None:
        if self.status not in (ArtifactJobStatus.QUEUED, ArtifactJobStatus.RUNNING):
            raise InvalidStateTransition("ArtifactJob", self.status.value, ArtifactJobStatus.FAILED.value)
        self.status = ArtifactJobStatus.FAILED
        self.error = error
        self.finished_at = finished_at


@dataclass(frozen=True)
class SourceMaterial:
    """Input to generation -- what a real source actually contains, read
    straight from the DiscoveryItem that seeded this Story. Never
    embellished before being handed to the generator."""
    source_url: str
    source_name: str | None
    source_domain: str
    title: str
    raw_text: str
    published_at: datetime | None
    retrieved_at: datetime


@dataclass(frozen=True)
class ArtifactGenerationRequest:
    story_headline: str
    sources: list[SourceMaterial]
    available_category_names: list[str]  # real taxonomy, so the LLM can only pick from what exists


@dataclass(frozen=True)
class ArtifactGenerationResult:
    """What a real ArtifactGenerationPort implementation returns --
    already parsed into typed fields, never a raw blob the caller has to
    interpret."""
    title: str
    subtitle: str | None
    excerpt: str
    summary: str
    content_html: str
    category_name: str | None
    tags: list[str]
    entities: list[str]
    seo_title: str
    seo_description: str
    slug: str
    claims: list[Claim]
    media_requirements: list[MediaRequirement]
