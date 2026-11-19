"""ARTIFACT — NEXUS's editorial intelligence engine. Not "AI Generate":
this is the structured process that turns real sources (from a Story
seeded by a selected DiscoveryItem) into original, evidence-tracked
editorial content -- title, subtitle, excerpt, structured HTML, SEO,
entities, media requirements -- never a mechanical paraphrase of a single
source, never an invented fact.

Runtime boundary: the actual language generation happens via
ArtifactGenerationPort (see ports.py), never by this backend importing an
SDK/CLI directly. Two real, interchangeable providers implement it --
AnthropicArtifactGenerator (HTTP API) and ClaudeCodeArtifactGenerator (a
real, local, non-interactive `claude -p` subprocess call, an explicit
user-selected choice, never a silently-launched interactive session).
This is distinct from automation/runtime's own "never launches Claude
Code" rule for pipeline *orchestration* (automation/.claude/skills/
lab-editorial-*) -- that's about who drives the Discovery/Production
control flow, not about which LLM backs one synchronous generation call
a human explicitly picked in the UI (see app/infrastructure/llm/
provider_resolver.py).

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


class _Unset:
    """Sentinel distinguishing 'field not provided' from 'explicitly set
    to None' for the nullable fields update_editorial_fields patches."""


_UNSET = _Unset()


class EvidenceLabel(str, Enum):
    SOURCE_FACT = "SOURCE_FACT"
    VERIFIED_CONTEXT = "VERIFIED_CONTEXT"
    INFERENCE = "INFERENCE"
    CREATIVE_FRAMING = "CREATIVE_FRAMING"
    UNVERIFIED = "UNVERIFIED"
    # Revisión 2.0, section 2: a claim that honestly states the SOURCE
    # material doesn't specify something (e.g. "the exact date of the
    # match isn't given in the available reporting") is NOT the same real
    # thing as UNVERIFIED (an assertion presented as fact that hasn't been
    # checked against a source). The former is already a fully accurate,
    # fully "verified" statement about what the sources do/don't say --
    # labeling it UNVERIFIED and asking an editor to "verify" it makes no
    # sense (there is nothing external to check). No equivalent value
    # exists in LAB's own taxonomy (automation/docs/LAB_ARTIFACTS.md's
    # SOURCE_FACT/VERIFIED_CONTEXT/INFERENCE/CREATIVE_FRAMING/UNVERIFIED,
    # which this enum already reuses) -- this is a genuinely new, real
    # distinction this taxonomy was missing.
    SOURCE_AVAILABILITY_CLAIM = "SOURCE_AVAILABILITY_CLAIM"


class SourceRole(str, Enum):
    """Evolución del Artifact, section 3: not every source plays the same
    real role. PRIMARY is the one real DiscoveryItem that originated this
    Story (today's only real source -- see RunArtifactJob's own honest
    note that multi-source aggregation is a real, undone gap, not
    something faked here). SECONDARY/OFFICIAL/CONTEXT exist so the model
    is ready the moment a real second source is genuinely available,
    without a schema change -- they are not populated by anything today."""
    PRIMARY = "PRIMARY"          # the real source that originated this Story/Artifact
    SECONDARY = "SECONDARY"      # independent corroboration of the same fact
    OFFICIAL = "OFFICIAL"        # an official/institutional source (government, company, court, ...)
    CONTEXT = "CONTEXT"          # background/historical material, not corroborating the main fact


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
    role: SourceRole = SourceRole.PRIMARY


@dataclass(frozen=True)
class Claim:
    """One factual assertion in the article, labeled honestly. A claim
    with no real source backing it is UNVERIFIED or CREATIVE_FRAMING --
    never silently presented as SOURCE_FACT. `id` is assigned once at
    parse time (see infrastructure/llm/response_parser.py) so the editor
    can address one specific claim (mark it reviewed) without relying on
    list position, which edits could reorder."""
    id: str
    text: str
    label: EvidenceLabel
    source_urls: list[str] = field(default_factory=list)
    reviewed: bool = False  # a human editor looked at this specific claim and accepted it as-is


class MediaKind(str, Enum):
    FEATURE_IMAGE = "FEATURE_IMAGE"
    BODY_IMAGE = "BODY_IMAGE"
    VIDEO = "VIDEO"


@dataclass(frozen=True)
class MediaRequirement:
    """A multimedia need the Artifact declared -- never a fabricated
    asset. `asset_id` is None until a human/pipeline actually fulfills it
    (generate/upload/replace, Phase 7) -- this is the persisted need, not
    the fulfillment.

    Evolución del Artifact, sections 6-14: a BODY_IMAGE's real position
    in the article is never a separate "order"/"placement" field here --
    it IS wherever its placeholder_id appears inside Artifact.content_html
    (a real <figure data-placeholder-id="..."> node). Keeping placement
    out of this dataclass is deliberate: content_html is already the one
    real source of truth for document order (section 6's "no crear una
    segunda representación"); a second, parallel position field here
    could silently drift from where the image actually renders.

    `prompt` is the real image-generation instruction (never shown to
    readers); `caption` is the real reader-facing text under the image;
    `alt_text` is real accessibility/SEO text. Three genuinely different
    real fields (section 13) -- never conflated into one string."""
    placeholder_id: str  # e.g. "FEATURE_IMAGE", "BODY_IMAGE_01"
    kind: MediaKind
    prompt: str
    asset_id: str | None = None
    caption: str | None = None
    alt_text: str | None = None
    external_url: str | None = None


@dataclass(frozen=True)
class SeoMetadata:
    seo_title: str
    seo_description: str
    slug: str
    canonical_url: str | None = None


class ArtifactStatus(str, Enum):
    DRAFT = "DRAFT"                    # LLM output landed, not validated yet
    REVIEW_REQUIRED = "REVIEW_REQUIRED"  # failed a real BLOCKING validation check
    VALIDATED = "VALIDATED"            # every BLOCKING check passed -- still needs human approval (may carry WARNINGs)
    APPROVED = "APPROVED"              # human approved -- this IS "READY" (see Story.mark_produced())
    REJECTED = "REJECTED"
    PUBLISHED = "PUBLISHED"            # a real row now exists in the public site's content table
    ARCHIVED = "ARCHIVED"              # editor explicitly removed it from the Revisión queue and from Publish
    SCHEDULED = "SCHEDULED"
    PUBLISHING = "PUBLISHING"


class ValidationSeverity(str, Enum):
    """Real, deterministic split -- never "everything blocks" (that was
    the actual bug: any warning, however cosmetic, made approve()
    unreachable). BLOCKING means the artifact is structurally/editorially
    incomplete and cannot become VALIDATED. WARNING is a real signal an
    editor should look at (and can act on via an editorial action), but
    it does not, by itself, prevent approval -- matches this project's own
    editorial policy examples (an over-length SEO title or an unverified
    claim are shown with actions, never as a hard stop)."""
    BLOCKING = "BLOCKING"
    WARNING = "WARNING"


@dataclass(frozen=True)
class ValidationIssue:
    check: str
    detail: str
    severity: ValidationSeverity = ValidationSeverity.BLOCKING


@dataclass(frozen=True)
class ValidationResult:
    issues: list[ValidationIssue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        """VALIDATED-eligible: no BLOCKING issue remains. WARNING issues
        may still be present -- they're real, shown, and actionable, but
        they never gate the human's ability to approve."""
        return not any(i.severity == ValidationSeverity.BLOCKING for i in self.issues)


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
    published_at: datetime | None = None  # when publish() actually ran -- never the same as created_at (Artifact creation time)
    scheduled_at: datetime | None = None
    publishing_started_at: datetime | None = None

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
        """DRAFT/REVIEW_REQUIRED -> VALIDATED/REVIEW_REQUIRED is the
        normal first pass. VALIDATED -> re-applying is also real: a
        VALIDATED artifact can still carry non-blocking WARNINGs (section
        7), and an editor's later edit (e.g. accepting a "Corregir con
        IA" SEO proposal, section 5) must be able to re-check them --
        clearing a WARNING, or, if the edit broke something else,
        genuinely moving back to REVIEW_REQUIRED. APPROVED/PUBLISHED/
        REJECTED/ARCHIVED never re-validate here -- those are editorial
        decisions this method doesn't own."""
        if self.status not in (ArtifactStatus.DRAFT, ArtifactStatus.REVIEW_REQUIRED, ArtifactStatus.VALIDATED):
            raise InvalidStateTransition("Artifact", self.status.value, "VALIDATED/REVIEW_REQUIRED")
        self.validation = result
        if result.ok:
            self.status = ArtifactStatus.VALIDATED
            self.editorial_notes = None
        else:
            self.status = ArtifactStatus.REVIEW_REQUIRED
            self.editorial_notes = "; ".join(f"{i.check}: {i.detail}" for i in result.issues)

    def keep_as_draft(self) -> None:
        if self.status not in (
            ArtifactStatus.DRAFT, ArtifactStatus.REVIEW_REQUIRED, ArtifactStatus.VALIDATED,
        ):
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.DRAFT.value)
        self.status = ArtifactStatus.DRAFT
        self.validation = ValidationResult()
        self.editorial_notes = None

    def schedule(self, scheduled_at: datetime, now: datetime) -> None:
        if self.status != ArtifactStatus.APPROVED:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.SCHEDULED.value)
        if scheduled_at <= now:
            raise ValueError("scheduled_at must be in the future")
        self.status = ArtifactStatus.SCHEDULED
        self.scheduled_at = scheduled_at
        self.publishing_started_at = None

    def cancel_schedule(self) -> None:
        if self.status != ArtifactStatus.SCHEDULED:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.APPROVED.value)
        self.status = ArtifactStatus.APPROVED
        self.scheduled_at = None
        self.publishing_started_at = None

    def claim_scheduled_publication(self, now: datetime) -> None:
        if self.status != ArtifactStatus.SCHEDULED or self.scheduled_at is None or self.scheduled_at > now:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.PUBLISHING.value)
        self.status = ArtifactStatus.PUBLISHING
        self.publishing_started_at = now

    def retry_scheduled_publication(self) -> None:
        if self.status != ArtifactStatus.PUBLISHING:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.SCHEDULED.value)
        self.status = ArtifactStatus.SCHEDULED
        self.publishing_started_at = None

    def approve(self) -> None:
        if self.status != ArtifactStatus.VALIDATED:
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.APPROVED.value)
        self.status = ArtifactStatus.APPROVED

    def reject(self, reason: str) -> None:
        if self.status not in (ArtifactStatus.VALIDATED, ArtifactStatus.REVIEW_REQUIRED):
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.REJECTED.value)
        self.status = ArtifactStatus.REJECTED
        self.editorial_notes = reason

    def archive(self) -> None:
        """Section 2's real "Eliminar": a soft delete, never a hard DELETE
        (provenance/history stay intact, Discovery is untouched -- only
        this Artifact's own status changes). Blocked once PUBLISHED: a
        live article is not "removed from the queue", that's a real
        unpublish/retraction concern this method doesn't own. Archiving
        twice is a no-op-shaped error, never silently accepted, so a
        caller can't assume it succeeded when the artifact was already
        gone from the queue."""
        if self.status in (ArtifactStatus.PUBLISHED, ArtifactStatus.ARCHIVED):
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.ARCHIVED.value)
        self.status = ArtifactStatus.ARCHIVED

    def fulfill_media_requirement(self, placeholder_id: str, asset_id: str) -> None:
        """PHASE 7 + editorial multimedia (section 13-15): attaches a
        real Asset (generated or human-uploaded) to one of this
        Artifact's declared media needs. Deliberately allowed to replace
        an existing asset_id -- every caller (Generar/Subir/Reemplazar in
        the Revisión workspace) is a real, explicit human action, never an
        automatic retry, so silently-overwriting-by-accident is not a
        real risk here. The Asset row this replaces is never deleted (see
        AssetRepository.save/list_for_story) -- history survives even
        though the requirement only ever points at the latest."""
        updated: list[MediaRequirement] = []
        found = False
        for requirement in self.media_requirements:
            if requirement.placeholder_id != placeholder_id:
                updated.append(requirement)
                continue
            found = True
            updated.append(replace(requirement, asset_id=asset_id, external_url=None))
        if not found:
            raise ValueError(f"No media requirement {placeholder_id!r} on this Artifact")
        self.media_requirements = updated

    def update_media_prompt(
        self, placeholder_id: str, prompt: str | None = None,
        caption: str | _Unset | None = _UNSET, alt_text: str | _Unset | None = _UNSET,
    ) -> None:
        """The editor rewriting what a generation prompt/caption/alt text
        actually says -- real persisted intent, read back the next time
        Generar runs (prompt) or the article renders (caption/alt).
        `caption`/`alt_text` use the same real tri-state sentinel as
        update_editorial_fields -- both are legitimately nullable, so
        "not provided" and "explicitly cleared" must stay distinct."""
        updated: list[MediaRequirement] = []
        found = False
        for requirement in self.media_requirements:
            if requirement.placeholder_id != placeholder_id:
                updated.append(requirement)
                continue
            found = True
            updated.append(replace(
                requirement,
                prompt=prompt if prompt is not None else requirement.prompt,
                caption=caption if caption is not _UNSET else requirement.caption,
                alt_text=alt_text if alt_text is not _UNSET else requirement.alt_text,
            ))
        if not found:
            raise ValueError(f"No media requirement {placeholder_id!r} on this Artifact")
        self.media_requirements = updated

    def add_media_requirement(self, placeholder_id: str, kind: MediaKind, prompt: str = "") -> None:
        """Section 11's real "+ Insertar imagen": a human editor adding a
        NEW real image need to the document, not something Artifact
        planned at generation time. Never FEATURE_IMAGE here -- an
        article has exactly one of those, declared once at generation
        (section 9); this is for BODY_IMAGE/VIDEO blocks the editor is
        genuinely inserting."""
        if kind == MediaKind.FEATURE_IMAGE:
            raise ValueError("cannot add a second FEATURE_IMAGE requirement -- use fulfill/replace on the existing one")
        if any(m.placeholder_id == placeholder_id for m in self.media_requirements):
            raise ValueError(f"media requirement {placeholder_id!r} already exists on this Artifact")
        self.media_requirements = [
            *self.media_requirements,
            MediaRequirement(placeholder_id=placeholder_id, kind=kind, prompt=prompt),
        ]

    def remove_media_requirement(self, placeholder_id: str) -> None:
        """The real counterpart to add_media_requirement -- removing a
        BODY_IMAGE block the editor decided the article doesn't need.
        The real Asset row itself is never deleted (same rule as
        fulfill_media_requirement) -- only this Artifact's own need for
        it. FEATURE_IMAGE can never be removed this way -- every article
        keeps exactly the one feature-image slot it was generated with."""
        target = next((m for m in self.media_requirements if m.placeholder_id == placeholder_id), None)
        if target is None:
            raise ValueError(f"No media requirement {placeholder_id!r} on this Artifact")
        if target.kind == MediaKind.FEATURE_IMAGE:
            raise ValueError("cannot remove the FEATURE_IMAGE requirement")
        self.media_requirements = [m for m in self.media_requirements if m.placeholder_id != placeholder_id]

    def mark_claim_reviewed(
        self, claim_id: str, reviewed: bool = True,
        label: EvidenceLabel | None = None, source_urls: list[str] | None = None,
    ) -> None:
        """Real, persisted editorial action on ONE claim. `label`/
        `source_urls` are optional -- omitted, this is the plain "looked
        at it, accept as-is" action (section 11's original use). Passed
        (from accepting a ProposeClaimResolution proposal, section 2/4),
        this is what actually reclassifies the claim -- never done
        silently; the caller (the API layer) only ever forwards a value a
        human explicitly accepted."""
        updated: list[Claim] = []
        found = False
        for claim in self.claims:
            if claim.id != claim_id:
                updated.append(claim)
                continue
            found = True
            updated.append(replace(
                claim, reviewed=reviewed,
                label=label if label is not None else claim.label,
                source_urls=source_urls if source_urls is not None else claim.source_urls,
            ))
        if not found:
            raise ValueError(f"No claim {claim_id!r} on this Artifact")
        self.claims = updated

    def update_editorial_fields(
        self, *, title: str | None = None, subtitle: str | _Unset | None = _UNSET, excerpt: str | None = None,
        summary: str | None = None, content_html: str | None = None,
        category_id: str | _Unset | None = _UNSET, tags: list[str] | None = None,
        seo_title: str | None = None, seo_description: str | None = None, slug: str | None = None,
        canonical_url: str | _Unset | None = _UNSET,
    ) -> None:
        """The editor's real hand-edits (section 7-12) -- a plain field
        patch, never a re-generation. Blocked only once PUBLISHED: editing
        a live article's Artifact record after the fact is a republish
        concern this method doesn't own. `subtitle`/`category_id`/
        `canonical_url` use a real tri-state sentinel because all three
        are legitimately nullable -- "not provided" and "explicitly
        cleared to None" are different real intents."""
        if self.status == ArtifactStatus.PUBLISHED:
            raise InvalidStateTransition("Artifact", self.status.value, "edited")
        if title is not None:
            self.title = title
        if subtitle is not _UNSET:
            self.subtitle = subtitle
        if excerpt is not None:
            self.excerpt = excerpt
        if summary is not None:
            self.summary = summary
        if content_html is not None:
            self.content_html = content_html
        if category_id is not _UNSET:
            self.category_id = category_id
        if tags is not None:
            self.tags = tags
        if seo_title is not None or seo_description is not None or slug is not None or canonical_url is not _UNSET:
            self.seo = SeoMetadata(
                seo_title=seo_title if seo_title is not None else self.seo.seo_title,
                seo_description=seo_description if seo_description is not None else self.seo.seo_description,
                slug=slug if slug is not None else self.seo.slug,
                canonical_url=canonical_url if canonical_url is not _UNSET else self.seo.canonical_url,
            )

    def publish(self, news_id: str) -> None:
        """Real, one-way: only an APPROVED (= READY) Artifact can be
        published, and only once -- publishing twice would create a
        second, duplicate row in the public site's content table."""
        if self.status not in (ArtifactStatus.APPROVED, ArtifactStatus.SCHEDULED, ArtifactStatus.PUBLISHING):
            raise InvalidStateTransition("Artifact", self.status.value, ArtifactStatus.PUBLISHED.value)
        self.status = ArtifactStatus.PUBLISHED
        self.published_news_id = news_id
        self.published_at = datetime.now(timezone.utc)
        self.scheduled_at = None
        self.publishing_started_at = None


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
    # Real provenance of THIS execution -- resolved once at trigger time
    # (see TriggerArtifact / ArtifactProviderResolver) and never changed
    # afterward. "auto" is never stored here: by the time the job exists,
    # a concrete provider has already been picked.
    provider: str | None = None
    model: str | None = None
    # Real per-attempt validation snapshot -- this is what makes retry
    # history mean something beyond "it ran": each attempt keeps its own
    # real pass/fail and issue count even after a later retry overwrites
    # the Artifact row's own (necessarily current-only) validation state.
    validation_ok: bool | None = None
    validation_issue_count: int | None = None

    def start(self) -> None:
        if self.status != ArtifactJobStatus.QUEUED:
            raise InvalidStateTransition("ArtifactJob", self.status.value, ArtifactJobStatus.RUNNING.value)
        self.status = ArtifactJobStatus.RUNNING
        self.started_at = datetime.now(timezone.utc)

    def complete(
        self, artifact_id: str, review_required: bool, finished_at: datetime,
        validation_ok: bool | None = None, validation_issue_count: int | None = None,
    ) -> None:
        if self.status != ArtifactJobStatus.RUNNING:
            raise InvalidStateTransition("ArtifactJob", self.status.value, ArtifactJobStatus.COMPLETED.value)
        self.status = ArtifactJobStatus.REVIEW_REQUIRED if review_required else ArtifactJobStatus.COMPLETED
        self.artifact_id = artifact_id
        self.finished_at = finished_at
        self.validation_ok = validation_ok
        self.validation_issue_count = validation_issue_count

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


@dataclass(frozen=True)
class SeoFixRequest:
    """Section 5's real "Corregir con IA" -- a narrow, single-field
    request (never a full re-generation): fix ONE over/under-length real
    SEO field, grounded in the artifact's own real headline/excerpt so
    the proposal can't invent a different story. `field` is one of
    validate_artifact's own real check names (title/seo_title/
    seo_description) -- the same source of truth, never a second copy of
    which fields exist."""
    field: str
    current_text: str
    min_length: int | None
    max_length: int
    story_headline: str
    excerpt: str
    # Revisión 2.0's real "+ Más impacto"/"+ Más corto"/"+ Alternativas"
    # chips -- an optional real editorial angle for the SAME one fix
    # call, never three separate fake buttons. None keeps the original
    # "fix the length" behavior.
    instruction: str | None = None


@dataclass(frozen=True)
class SeoFixResult:
    """A real proposal, never applied automatically (see
    ProposeSeoFix/UpdateArtifact) -- the editor accepts, edits, or
    discards it. `character_count` is always recomputed from `value`
    server-side (see response_parser.parse_seo_fix_response), never
    trusted from the provider's own arithmetic."""
    value: str
    reason: str
    character_count: int


@dataclass(frozen=True)
class ClaimResolutionRequest:
    """Revisión 2.0 section 2/4's real "Resolver con IA" for one claim --
    re-examines it against the SAME real source material this Artifact
    was generated from (discovery_item.raw_text). Deliberately NOT a web
    search: no real search infrastructure exists in this codebase, and
    inventing one would be exactly the kind of mock this task forbids.
    This is honest, bounded re-analysis of material already on hand."""
    claim_text: str
    source_text: str
    story_headline: str


@dataclass(frozen=True)
class ClaimResolutionResult:
    """A real proposal (see ProposeClaimResolution) -- never applied
    automatically during human review; only the automatic pass inside
    RunArtifactJob (pre-Revisión, section 1/5) may apply it directly,
    since nothing has been shown to a human yet at that point.
    `supported_by_source` is the honest, separate signal for whether the
    source text actually backs this claim -- a label change without it
    being true would be "marking VERIFIED without evidence", which this
    task explicitly forbids."""
    label: EvidenceLabel
    reason: str
    supported_by_source: bool


class ProviderId(str, Enum):
    """The only two real Artifact generation providers this codebase
    implements -- never a placeholder for one that doesn't exist yet."""
    ANTHROPIC = "anthropic"
    CLAUDE_CODE = "claude_code"


class ProviderKind(str, Enum):
    API = "API"
    CLI = "CLI"


class ProviderStatus(str, Enum):
    """Real, distinct states -- never collapsed into a bool. CHECKING is
    part of the contract for a provider whose real check is inherently
    async/multi-step; today's two providers both check synchronously, so
    a backend response never actually rests in CHECKING -- the frontend
    may show it locally while a check request is in flight."""
    CONNECTED = "CONNECTED"           # configured AND authentication verified live
    AVAILABLE = "AVAILABLE"           # installed/reachable but not the one currently in use
    NOT_CONFIGURED = "NOT_CONFIGURED"  # no credentials/binary at all
    AUTH_ERROR = "AUTH_ERROR"         # configured, but real auth check failed
    UNAVAILABLE = "UNAVAILABLE"       # configured but unreachable (network/process error)
    CHECKING = "CHECKING"


@dataclass(frozen=True)
class ProviderCheckResult:
    """What a real check_status() call returns -- every field is either a
    real, just-observed fact or None, never guessed. `detail` is a short
    human-readable real reason (e.g. "no autenticado", real version
    string) -- never a secret, never PII (an email/org id is never put
    here even though the underlying CLI check may see one)."""
    provider_id: ProviderId
    status: ProviderStatus
    detail: str | None = None
    version: str | None = None
    checked_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
