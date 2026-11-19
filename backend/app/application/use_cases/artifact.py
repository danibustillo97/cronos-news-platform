"""Artifact use cases -- orchestration only. The actual editorial
reasoning happens inside the real LLM call (ArtifactGenerationPort);
validation is a pure domain function (app.domain.artifact.validation).
This module wires them together and owns the state transitions, same
separation ProduceStory/discovery.py already established.
"""
from __future__ import annotations

import html
import logging
import re
import time
import unicodedata
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone

from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.domain.shared.ids import ArtifactId, StoryId
from app.domain.artifact.entities import (
    _UNSET, Artifact, ArtifactGenerationRequest, ArtifactJob, ArtifactJobStatus, ArtifactStatus, Claim,
    ClaimResolutionRequest, EvidenceLabel, MediaKind, MediaRequirement, ProviderId, SeoFixRequest, SeoMetadata,
    SourceMaterial, SourceReference, ValidationResult, _Unset,
)
from app.domain.discovery.entities import DiscoveryStatus
from app.domain.artifact.validation import SEO_FIELD_LIMITS, validate_artifact
from app.domain.discovery.entities import DiscoveryItem
from app.domain.ports import (
    ArtifactGenerationPort, ArtifactGenerationUnavailableError, ArtifactJobRepository, ArtifactProviderResolverPort,
    ArtifactPublishingPort, ArtifactRepository, AssetRepository, CategoryRepository, DiscoveryRepository,
    StoragePort, StoryRepository,
)
from app.domain.story.entities import Story, StorySource

logger = logging.getLogger("cronos.ai_assist")


@dataclass
class TriggerArtifactInput:
    story_id: str
    provider: str | None = None  # explicit choice from the UI, or "auto"/None


class TriggerArtifact:
    """DISCOVERY UP -> ARTIFACT: resolves a real, currently-usable
    provider FIRST (raises ProviderUnavailableError instead of ever
    creating a job doomed to fail), then creates a real, QUEUED job with
    that choice already persisted. Never starts running here --
    RunArtifactJob (invoked as a background task by the API layer) is
    what actually calls the LLM, so the HTTP request that triggers this
    returns immediately instead of blocking for the 10-60+ seconds a
    real generation call takes."""

    def __init__(self, jobs: ArtifactJobRepository, stories: StoryRepository, providers: ArtifactProviderResolverPort) -> None:
        self._jobs = jobs
        self._stories = stories
        self._providers = providers

    def execute(self, input: TriggerArtifactInput) -> ArtifactJob:
        story = self._stories.find_by_id(input.story_id)
        if story is None:
            raise NotFoundError("Story", input.story_id)

        provider_id = self._providers.resolve(input.provider)
        model = self._providers.get(provider_id).check_status().version

        job = ArtifactJob(
            id=str(uuid.uuid4()), story_id=StoryId.of(input.story_id),
            status=ArtifactJobStatus.QUEUED, created_at=datetime.now(timezone.utc),
            provider=provider_id.value, model=model,
        )
        self._jobs.save(job)
        return job


@dataclass
class OpenManualDiscoveryEditorInput:
    item_id: str


class OpenManualDiscoveryEditor:
    """Opens the CMS for an existing Discovery item without creating a
    generation job. The stable Discovery id is also the Story id, and the
    latest Artifact is reused on every subsequent open."""

    def __init__(
        self, items: DiscoveryRepository, stories: StoryRepository, artifacts: ArtifactRepository,
    ) -> None:
        self._items = items
        self._stories = stories
        self._artifacts = artifacts

    def execute(self, input: OpenManualDiscoveryEditorInput) -> Artifact:
        item = self._items.find_by_id(input.item_id)
        if item is None:
            raise NotFoundError("DiscoveryItem", input.item_id)
        if item.status not in (DiscoveryStatus.SELECTED, DiscoveryStatus.SENT_TO_EDITORIAL):
            raise InvalidStateTransition("DiscoveryItem", item.status.value, "SENT_TO_EDITORIAL")

        story_id = item.story_id or StoryId.of(str(item.id))
        story = self._stories.find_by_id(str(story_id))
        if story is None:
            story = Story.open_from_news(
                story_id, item.original_title,
                StorySource(news_id=None, source_url=item.original_url, label="discovery"),
            )
            self._stories.save(story)

        if item.status == DiscoveryStatus.SELECTED:
            item.send_to_editorial(story_id)
            self._items.save(item)

        existing = self._artifacts.find_latest_for_story(str(story_id))
        if existing is not None:
            if existing.status in (ArtifactStatus.PUBLISHED, ArtifactStatus.ARCHIVED):
                raise InvalidStateTransition("Artifact", existing.status.value, ArtifactStatus.DRAFT.value)
            return existing

        version = 1
        artifact_id = ArtifactId.of(str(uuid.uuid5(
            uuid.NAMESPACE_URL, f"cronos:manual-editor:{story_id}:{version}",
        )))
        body = item.raw_text.strip()
        excerpt = body[:240].strip() or item.original_title.strip()
        summary = body[:1000].strip() or item.original_title.strip()
        safe_body = html.escape(body or item.original_title.strip())
        slug = _editorial_slug(item.original_title)
        first_image = next((material.url for material in item.materials if material.kind.value == "IMAGE"), None)
        source = SourceReference(
            source_url=item.source_url, source_name=item.source_name, source_domain=item.source_domain,
            author=item.author, published_at=item.published_at, retrieved_at=item.discovered_at,
        )
        artifact = Artifact.draft(
            artifact_id=artifact_id, story_id=story_id, version=version,
            title=item.original_title.strip(), subtitle=None, excerpt=excerpt, summary=summary,
            content_html=f"<article><p>{safe_body}</p></article>", category_id=item.category_id,
            tags=list(item.topics), entities=[],
            seo=SeoMetadata(
                seo_title=item.original_title.strip()[:60],
                seo_description=excerpt[:160], slug=slug, canonical_url=item.original_url,
            ),
            sources=[source],
            claims=[Claim(
                id=f"source-{item.id}", text=item.original_title.strip(), label=EvidenceLabel.UNVERIFIED,
                source_urls=[item.source_url],
            )],
            media_requirements=[MediaRequirement(
                placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE,
                prompt="", external_url=first_image,
            )],
            created_at=datetime.now(timezone.utc),
        )
        self._artifacts.save(artifact)
        return artifact


def _editorial_slug(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    return slug or "noticia"


class GetArtifactJob:
    def __init__(self, jobs: ArtifactJobRepository) -> None:
        self._jobs = jobs

    def execute(self, job_id: str) -> ArtifactJob:
        job = self._jobs.find_by_id(job_id)
        if job is None:
            raise NotFoundError("ArtifactJob", job_id)
        return job


class GetLatestArtifactJobForStory:
    """What the Artifact drawer uses to find its job after a page reload
    -- the frontend only remembers a job id in-memory (from the trigger
    response), which is lost on refresh. Real state lives here, keyed by
    the same Story id the Discovery item already shares."""

    def __init__(self, jobs: ArtifactJobRepository) -> None:
        self._jobs = jobs

    def execute(self, story_id: str) -> ArtifactJob:
        job = self._jobs.find_latest_for_story(story_id)
        if job is None:
            raise NotFoundError("ArtifactJob", f"for story {story_id}")
        return job


class ListArtifactJobsForStory:
    """Section 1's real "historial de ejecuciones": every attempt
    (provider, model, timestamps, duration is derived client-side from
    started/finished, status, validation snapshot, error) this story's
    Artifact has gone through, newest first -- not just the latest one
    GetLatestArtifactJobForStory returns."""

    def __init__(self, jobs: ArtifactJobRepository) -> None:
        self._jobs = jobs

    def execute(self, story_id: str, limit: int = 20) -> list[ArtifactJob]:
        return self._jobs.list_for_story(story_id, limit=limit)


class GetArtifact:
    """Single-artifact read -- the Artifact drawer's real detail view
    (validation issues, media requirements, content) needs more than a
    job's bare status/artifactId string."""

    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, artifact_id: str) -> Artifact:
        artifact = self._artifacts.find_by_id(artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", artifact_id)
        return artifact


@dataclass
class RunArtifactJobInput:
    job_id: str


class RunArtifactJob:
    """The real work: reads the real DiscoveryItem that seeded this Story
    (same id, see DecideDiscoveryItem.SEND_TO_EDITORIAL), calls the real
    LLM through ArtifactGenerationPort, validates the result for real, and
    persists a real Artifact. Every failure path records the real error
    on the job -- never silently retries with invented content, never
    marks COMPLETED without an Artifact actually saved."""

    def __init__(
        self, jobs: ArtifactJobRepository, artifacts: ArtifactRepository, discovery_items: DiscoveryRepository,
        stories: StoryRepository, categories: CategoryRepository, providers: ArtifactProviderResolverPort,
    ) -> None:
        self._jobs = jobs
        self._artifacts = artifacts
        self._discovery_items = discovery_items
        self._stories = stories
        self._categories = categories
        self._providers = providers

    def execute(self, input: RunArtifactJobInput) -> ArtifactJob:
        job = self._jobs.find_by_id(input.job_id)
        if job is None:
            raise NotFoundError("ArtifactJob", input.job_id)

        job.start()
        self._jobs.save(job)

        try:
            artifact = self._generate_and_validate(job)
        except Exception as exc:  # noqa: BLE001 -- the real error, always recorded, never swallowed
            job.fail(str(exc), datetime.now(timezone.utc))
            self._jobs.save(job)
            return job

        self._artifacts.save(artifact)
        job.complete(
            artifact_id=str(artifact.id), review_required=not artifact.validation.ok,
            finished_at=datetime.now(timezone.utc),
            validation_ok=artifact.validation.ok, validation_issue_count=len(artifact.validation.issues),
        )
        self._jobs.save(job)
        return job

    def _generate_and_validate(self, job: ArtifactJob) -> Artifact:
        story = self._stories.find_by_id(str(job.story_id))
        if story is None:
            raise ValueError(f"Story {job.story_id} not found")

        # The DiscoveryItem that seeded this Story shares its id (see
        # DecideDiscoveryItem.SEND_TO_EDITORIAL) -- today's real,
        # single-source link. Aggregating multiple DiscoveryItems into one
        # Story (event clustering) is a real gap noted in
        # docs/NEXUS_ARCHITECTURE_BASELINE.md, not solved here.
        discovery_item = self._discovery_items.find_by_id(str(job.story_id))
        if discovery_item is None:
            raise ValueError(f"No DiscoveryItem found for story {job.story_id} -- nothing real to generate from")

        groups = self._categories.list_tree()
        category_names = [c.name for g in groups for c in g.categories]
        name_to_id = {c.name: c.id for g in groups for c in g.categories}

        request = ArtifactGenerationRequest(
            story_headline=story.headline,
            sources=[SourceMaterial(
                source_url=discovery_item.source_url, source_name=discovery_item.source_name,
                source_domain=discovery_item.source_domain, title=discovery_item.original_title,
                raw_text=discovery_item.raw_text, published_at=discovery_item.published_at,
                retrieved_at=discovery_item.discovered_at,
            )],
            available_category_names=category_names,
        )

        # The provider was already resolved and persisted at trigger time
        # (TriggerArtifact) -- reused as-is here, never re-resolved. If
        # this specific provider fails now, the job goes FAILED; there is
        # no silent fallback to a different provider mid-run.
        provider_id = ProviderId(job.provider) if job.provider else self._providers.resolve(None)
        generator = self._providers.get(provider_id)
        try:
            result = generator.generate(request)
        except ArtifactGenerationUnavailableError:
            raise  # already a real, specific error -- pass through unchanged

        category_id = name_to_id.get(result.category_name) if result.category_name else None

        # Retry must replace THIS story's active Artifact, never spawn a
        # second logical article in the Revisión queue (that was the real
        # bug: every retry created a brand-new artifact_id, so the queue
        # showed both the old and the new attempt as separate items).
        # Reusing the same id makes Artifact.save's upsert overwrite the
        # same row in place -- one logical artifact, version bumped.
        # Exception: a PUBLISHED artifact is live and immutable here (a
        # "retry" on an already-published story is a fresh production
        # cycle, not an edit to the live one), and an ARCHIVED one was
        # explicitly removed by an editor -- resurrecting it under its old
        # id would silently undo that. Both start a genuinely new id.
        existing = self._artifacts.find_latest_for_story(str(job.story_id))
        reuse_existing = existing is not None and existing.status not in (
            ArtifactStatus.PUBLISHED, ArtifactStatus.ARCHIVED,
        )
        artifact_id = existing.id if reuse_existing else ArtifactId.new()
        version = (existing.version + 1) if reuse_existing else 1

        artifact = Artifact.draft(
            artifact_id=artifact_id, story_id=story.id, version=version,
            title=result.title, subtitle=result.subtitle, excerpt=result.excerpt, summary=result.summary,
            content_html=result.content_html, category_id=category_id, tags=result.tags, entities=result.entities,
            seo=SeoMetadata(seo_title=result.seo_title, seo_description=result.seo_description, slug=result.slug),
            sources=[SourceReference(
                source_url=discovery_item.source_url, source_name=discovery_item.source_name,
                source_domain=discovery_item.source_domain, author=discovery_item.author,
                published_at=discovery_item.published_at, retrieved_at=discovery_item.discovered_at,
            )],
            claims=result.claims, media_requirements=result.media_requirements,
            created_at=datetime.now(timezone.utc),
        )
        valid_category_ids = set(name_to_id.values())
        validation = validate_artifact(artifact, valid_category_names=valid_category_ids)
        validation = self._auto_resolve(artifact, validation, generator, discovery_item, valid_category_ids)
        artifact.apply_validation(validation)
        return artifact

    _AUTO_FIXABLE_SEO_FIELDS = {"title", "seo_title", "seo_description"}
    # A real, deliberate bound: an artifact with more than a handful of
    # UNVERIFIED claims has a deeper sourcing problem an automated re-check
    # of the same single source text won't fix -- past this, Revisión
    # seeing the real count is more honest than burning provider calls.
    _MAX_AUTO_CLAIM_RESOLUTIONS = 5

    def _auto_resolve(
        self, artifact: Artifact, validation: ValidationResult, generator: ArtifactGenerationPort,
        discovery_item, valid_category_names: set[str],
    ) -> ValidationResult:
        """Revisión 2.0 sections 1 & 5: Artifact -- not Revisión -- is
        responsible for resolving what real infrastructure genuinely CAN
        resolve, before a human ever sees this content. This runs entirely
        inside the machine phase, before REVIEW_REQUIRED/VALIDATED is even
        decided -- unlike the Revisión-side ProposeSeoFix/
        ProposeClaimResolution, which only ever propose and require an
        explicit human accept (once a human is looking at this, further
        AI action must never auto-apply). A failure here is never fatal to
        the whole job -- it just means that one issue reaches Revisión
        exactly as it would have before this pass existed."""
        resolved_any = False

        for issue in validation.issues:
            if issue.check not in self._AUTO_FIXABLE_SEO_FIELDS:
                continue
            current_text = {
                "title": artifact.title, "seo_title": artifact.seo.seo_title,
                "seo_description": artifact.seo.seo_description,
            }[issue.check]
            min_length, max_length = SEO_FIELD_LIMITS[issue.check]
            try:
                fix = generator.suggest_seo_fix(SeoFixRequest(
                    field=issue.check, current_text=current_text, min_length=min_length, max_length=max_length,
                    story_headline=artifact.title, excerpt=artifact.excerpt,
                ))
            except ArtifactGenerationUnavailableError as exc:
                logger.warning("auto_resolve_seo_failed artifact_id=%s field=%s error=%s", artifact.id, issue.check, exc)
                continue
            within_bounds = len(fix.value) <= max_length and (min_length is None or len(fix.value) >= min_length)
            if not within_bounds:
                # Never accept a "fix" that doesn't actually fix it --
                # this is what "no asumir que menos caracteres = mejor"
                # means in practice: verify, don't trust.
                logger.warning("auto_resolve_seo_rejected artifact_id=%s field=%s reason=still_out_of_bounds", artifact.id, issue.check)
                continue
            if issue.check == "title":
                artifact.title = fix.value
            elif issue.check == "seo_title":
                artifact.seo = replace(artifact.seo, seo_title=fix.value)
            else:
                artifact.seo = replace(artifact.seo, seo_description=fix.value)
            resolved_any = True
            logger.info("auto_resolve_seo_applied artifact_id=%s field=%s duration_ms=n/a", artifact.id, issue.check)

        unverified = [c for c in artifact.claims if c.label == EvidenceLabel.UNVERIFIED and not c.reviewed]
        for claim in unverified[: self._MAX_AUTO_CLAIM_RESOLUTIONS]:
            try:
                resolution = generator.resolve_claim(ClaimResolutionRequest(
                    claim_text=claim.text, source_text=discovery_item.raw_text, story_headline=artifact.title,
                ))
            except ArtifactGenerationUnavailableError as exc:
                logger.warning("auto_resolve_claim_failed artifact_id=%s claim_id=%s error=%s", artifact.id, claim.id, exc)
                continue
            resolution = _sanitize_claim_resolution(resolution)
            if resolution.label == claim.label:
                continue  # genuinely still unresolved -- nothing to apply
            # supported_by_source gates evidence, never the label change
            # itself -- "no marcar VERIFIED sin evidencia" (section 2/4).
            source_urls = [discovery_item.source_url] if resolution.supported_by_source else claim.source_urls
            artifact.mark_claim_reviewed(
                claim.id, reviewed=(resolution.label != EvidenceLabel.UNVERIFIED),
                label=resolution.label, source_urls=source_urls,
            )
            resolved_any = True
            logger.info(
                "auto_resolve_claim_applied artifact_id=%s claim_id=%s new_label=%s", artifact.id, claim.id, resolution.label.value,
            )

        if not resolved_any:
            return validation
        return validate_artifact(artifact, valid_category_names=valid_category_names)


class ListArtifactsByStatus:
    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, status: str, limit: int = 50) -> list[Artifact]:
        return self._artifacts.list_by_status(status, limit)


@dataclass
class UpdateArtifactInput:
    artifact_id: str
    title: str | None = None
    subtitle: str | _Unset | None = _UNSET
    excerpt: str | None = None
    summary: str | None = None
    content_html: str | None = None
    category_id: str | _Unset | None = _UNSET
    tags: list[str] | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    slug: str | None = None
    canonical_url: str | _Unset | None = _UNSET
    save_as_draft: bool = False


class UpdateArtifact:
    """The Revisión workspace's real save -- a plain field patch (never a
    re-generation), persisted immediately (this IS the persistence layer
    autosave writes to, see PATCH /api/artifacts/{id}). While the artifact
    is DRAFT/REVIEW_REQUIRED/VALIDATED, the edit is re-validated for real
    right away: fixing what validate_artifact actually flagged can move a
    REVIEW_REQUIRED artifact to VALIDATED, and a further edit to an
    already-VALIDATED one (e.g. accepting a "Corregir con IA" SEO
    proposal, section 5) can genuinely clear a remaining WARNING -- this
    is what makes "11. Actualizar el warning" real instead of stale.
    APPROVED/PUBLISHED/REJECTED/ARCHIVED are NOT re-validated here
    (Artifact.apply_validation itself rejects those) -- their fields just
    update in place."""

    def __init__(self, artifacts: ArtifactRepository, categories: CategoryRepository) -> None:
        self._artifacts = artifacts
        self._categories = categories

    def execute(self, input: UpdateArtifactInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)

        artifact.update_editorial_fields(
            title=input.title, subtitle=input.subtitle, excerpt=input.excerpt, summary=input.summary,
            content_html=input.content_html,
            category_id=input.category_id, tags=input.tags, seo_title=input.seo_title,
            seo_description=input.seo_description, slug=input.slug, canonical_url=input.canonical_url,
        )

        if input.save_as_draft:
            artifact.keep_as_draft()
        elif artifact.status in (ArtifactStatus.DRAFT, ArtifactStatus.REVIEW_REQUIRED, ArtifactStatus.VALIDATED):
            groups = self._categories.list_tree()
            valid_category_ids = {c.id for g in groups for c in g.categories}
            validation = validate_artifact(artifact, valid_category_names=valid_category_ids)
            artifact.apply_validation(validation)

        self._artifacts.save(artifact)
        return artifact


@dataclass
class SubmitArtifactForReviewInput:
    artifact_id: str


class SubmitArtifactForReview:
    """Runs the existing deterministic editorial checks when a manual
    draft is explicitly sent to the review queue."""

    def __init__(self, artifacts: ArtifactRepository, categories: CategoryRepository) -> None:
        self._artifacts = artifacts
        self._categories = categories

    def execute(self, input: SubmitArtifactForReviewInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        groups = self._categories.list_tree()
        valid_category_ids = {c.id for group in groups for c in group.categories}
        artifact.apply_validation(validate_artifact(artifact, valid_category_names=valid_category_ids))
        self._artifacts.save(artifact)
        return artifact


@dataclass
class MarkClaimReviewedInput:
    artifact_id: str
    claim_id: str
    reviewed: bool = True
    # Set only when accepting a real ProposeClaimResolution proposal
    # (section 2/4) -- omitted, this is the plain "looked at it, accept
    # as-is" action (section 11's original use), which never changes the
    # label.
    label: str | None = None
    source_urls: list[str] | None = None


class MarkClaimReviewed:
    """Section 11/14: a human editor explicitly looked at one specific
    claim (not the whole artifact) and accepted it -- real, persisted.
    Revalidates afterward (section 14's "revalidación tras modificación
    significativa"): reviewing a claim, or accepting a real
    reclassification, can genuinely clear the "evidence" warning, and the
    artifact's cached validation must reflect that, not stay stale."""

    def __init__(self, artifacts: ArtifactRepository, categories: CategoryRepository) -> None:
        self._artifacts = artifacts
        self._categories = categories

    def execute(self, input: MarkClaimReviewedInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        label = EvidenceLabel(input.label) if input.label is not None else None
        artifact.mark_claim_reviewed(input.claim_id, input.reviewed, label=label, source_urls=input.source_urls)

        if artifact.status in (ArtifactStatus.DRAFT, ArtifactStatus.REVIEW_REQUIRED, ArtifactStatus.VALIDATED):
            groups = self._categories.list_tree()
            valid_category_ids = {c.id for g in groups for c in g.categories}
            validation = validate_artifact(artifact, valid_category_names=valid_category_ids)
            artifact.apply_validation(validation)

        self._artifacts.save(artifact)
        return artifact


_CLAIM_RESOLVABLE_LABELS = {EvidenceLabel.UNVERIFIED}
_EVIDENCE_BACKED_LABELS = {EvidenceLabel.SOURCE_FACT, EvidenceLabel.VERIFIED_CONTEXT}


def _sanitize_claim_resolution(result):
    """Defense in depth, in code, not just in the prompt: a provider that
    (hallucinating) returns SOURCE_FACT/VERIFIED_CONTEXT with
    supported_by_source=False is proposing a label change that ASSERTS
    real evidence backing without actually having it -- exactly what
    'no marcar VERIFIED sin evidencia' forbids. Force it back to
    UNVERIFIED rather than trust the label alone. Shared by both the
    automatic pass (RunArtifactJob) and the manual proposal
    (ProposeClaimResolution) -- one real rule, not duplicated."""
    if result.label in _EVIDENCE_BACKED_LABELS and not result.supported_by_source:
        return replace(
            result, label=EvidenceLabel.UNVERIFIED,
            reason=f"{result.reason} (sin evidencia real confirmada en la fuente -- se mantiene sin verificar).".strip(),
        )
    return result


@dataclass
class ProposeClaimResolutionInput:
    artifact_id: str
    claim_id: str
    provider: str | None = None


@dataclass
class ProposeClaimResolutionOutput:
    """A real PROPOSAL only -- never persisted here. The editor accepts
    (via POST /claims/{id}/review with label+sourceUrls, reusing
    MarkClaimReviewed -- no parallel write path) or discards it."""
    claim_id: str
    label: str
    reason: str
    source_urls: list[str]
    provider: str
    model: str | None


class ProposeClaimResolution:
    """Revisión 2.0 section 2/4's real "Resolver con IA" for a claim --
    re-examines it against the SAME real source material Artifact
    generated from (discovery_item.raw_text), through the SAME Provider
    Control Plane TriggerArtifact/ProposeSeoFix already use. Never a web
    search (no such real infrastructure exists here); this is honest,
    bounded re-analysis of material already on hand, exactly like the
    automatic pass inside RunArtifactJob -- this is its manual,
    propose-only counterpart for whatever that pass didn't resolve."""

    def __init__(
        self, artifacts: ArtifactRepository, discovery_items: DiscoveryRepository,
        providers: ArtifactProviderResolverPort,
    ) -> None:
        self._artifacts = artifacts
        self._discovery_items = discovery_items
        self._providers = providers

    def execute(self, input: ProposeClaimResolutionInput) -> ProposeClaimResolutionOutput:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        claim = next((c for c in artifact.claims if c.id == input.claim_id), None)
        if claim is None:
            raise NotFoundError("Claim", input.claim_id)
        if claim.label not in _CLAIM_RESOLVABLE_LABELS:
            raise ValueError(f"claim {input.claim_id!r} is not in a resolvable state (label={claim.label.value})")

        discovery_item = self._discovery_items.find_by_id(str(artifact.story_id))
        if discovery_item is None:
            raise NotFoundError("DiscoveryItem", str(artifact.story_id))

        provider_id = self._providers.resolve(input.provider)
        generator = self._providers.get(provider_id)
        model = generator.check_status().version

        started = time.monotonic()
        try:
            result = generator.resolve_claim(ClaimResolutionRequest(
                claim_text=claim.text, source_text=discovery_item.raw_text, story_headline=artifact.title,
            ))
        except ArtifactGenerationUnavailableError as exc:
            logger.warning(
                "claim_resolution_failed artifact_id=%s claim_id=%s provider=%s duration_ms=%d error=%s",
                artifact.id, input.claim_id, provider_id.value, int((time.monotonic() - started) * 1000), exc,
            )
            raise

        result = _sanitize_claim_resolution(result)
        source_urls = [discovery_item.source_url] if result.supported_by_source else []
        logger.info(
            "claim_resolution_proposed artifact_id=%s claim_id=%s provider=%s model=%s duration_ms=%d new_label=%s",
            artifact.id, input.claim_id, provider_id.value, model,
            int((time.monotonic() - started) * 1000), result.label.value,
        )
        return ProposeClaimResolutionOutput(
            claim_id=input.claim_id, label=result.label.value, reason=result.reason,
            source_urls=source_urls, provider=provider_id.value, model=model,
        )


_SEO_FIX_FIELDS = {"title", "seo_title", "seo_description"}


@dataclass
class ProposeSeoFixInput:
    artifact_id: str
    field: str  # "title" | "seo_title" | "seo_description" -- validate_artifact's own real check names
    provider: str | None = None  # explicit choice from the UI, or "auto"/None -- same Provider Control Plane policy as TriggerArtifact
    # Revisión 2.0's real "+ Más impacto"/"+ Más corto"/"+ Alternativas"
    # chips -- a real editorial angle for this SAME fix call, never a
    # separate AI action. None keeps the original "fix the length" ask.
    instruction: str | None = None


@dataclass
class ProposeSeoFixOutput:
    """A real PROPOSAL only -- this use case never touches persistence.
    The editor accepts/edits/discards it in the UI; only UpdateArtifact
    (PATCH /api/artifacts/{id}) actually saves anything, and that save is
    what triggers real revalidation (section 5, steps 9-11)."""
    field: str
    value: str
    reason: str
    character_count: int
    min_length: int | None
    max_length: int
    provider: str
    model: str | None


class ProposeSeoFix:
    """Section 5's real "Corregir con IA" -- ONE narrow LLM call through
    the SAME Provider Control Plane TriggerArtifact already uses (same
    resolver, same "auto" policy, same providers) -- never a second,
    parallel AI infrastructure. Produces a proposal only; never writes to
    the Artifact. Every real attempt is logged (provider, model,
    artifact_id, version, duration, result/error) -- see cronos.ai_assist
    -- but never a secret: adapters' own error messages are already
    written to never include API keys (see anthropic_adapter.py)."""

    def __init__(self, artifacts: ArtifactRepository, providers: ArtifactProviderResolverPort) -> None:
        self._artifacts = artifacts
        self._providers = providers

    def execute(self, input: ProposeSeoFixInput) -> ProposeSeoFixOutput:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        if input.field not in _SEO_FIX_FIELDS:
            raise ValueError(f"unknown SEO fix field: {input.field!r} -- must be one of {sorted(_SEO_FIX_FIELDS)}")

        min_length, max_length = SEO_FIELD_LIMITS[input.field]
        current_text = {
            "title": artifact.title, "seo_title": artifact.seo.seo_title, "seo_description": artifact.seo.seo_description,
        }[input.field]

        provider_id = self._providers.resolve(input.provider)
        generator = self._providers.get(provider_id)
        model = generator.check_status().version

        request = SeoFixRequest(
            field=input.field, current_text=current_text, min_length=min_length, max_length=max_length,
            story_headline=artifact.title, excerpt=artifact.excerpt, instruction=input.instruction,
        )

        started = time.monotonic()
        try:
            result = generator.suggest_seo_fix(request)
        except ArtifactGenerationUnavailableError as exc:
            logger.warning(
                "seo_fix_failed artifact_id=%s version=%s field=%s provider=%s duration_ms=%d error=%s",
                artifact.id, artifact.version, input.field, provider_id.value,
                int((time.monotonic() - started) * 1000), exc,
            )
            raise

        logger.info(
            "seo_fix_proposed artifact_id=%s version=%s field=%s provider=%s model=%s duration_ms=%d chars=%d",
            artifact.id, artifact.version, input.field, provider_id.value, model,
            int((time.monotonic() - started) * 1000), result.character_count,
        )
        return ProposeSeoFixOutput(
            field=input.field, value=result.value, reason=result.reason, character_count=result.character_count,
            min_length=min_length, max_length=max_length, provider=provider_id.value, model=model,
        )


@dataclass
class ReviewArtifactInput:
    artifact_id: str
    decision: str  # "APPROVE" | "REJECT"
    reason: str | None = None


class ReviewArtifact:
    """The human editorial authority (section 7/15 of the product spec):
    VALIDATED means the automated pipeline is done, not that anyone
    approved it. Approving here is what actually makes it READY -- and
    also advances the real Story state machine (PRODUCED = READY, per
    obsidian-vault/CRONOS - Domain Language Alignment.md's own mapping),
    reusing that state machine instead of inventing a parallel one."""

    def __init__(self, artifacts: ArtifactRepository, stories: StoryRepository) -> None:
        self._artifacts = artifacts
        self._stories = stories

    def execute(self, input: ReviewArtifactInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)

        if input.decision == "APPROVE":
            artifact.approve()
            story = self._stories.find_by_id(str(artifact.story_id))
            if story is not None:
                story.mark_produced()
                self._stories.save(story)
        elif input.decision == "REJECT":
            artifact.reject(input.reason or "No reason given")
        else:
            raise ValueError(f"unknown artifact review decision: {input.decision!r}")

        self._artifacts.save(artifact)
        return artifact


@dataclass
class ArchiveArtifactInput:
    artifact_id: str


class ArchiveArtifact:
    """Section 2's real "Eliminar": a soft delete/archive, never a hard
    DELETE. Reuses Artifact.archive() -- see its docstring for the exact
    invariants (blocked once PUBLISHED, provenance/history/Discovery
    untouched). The Revisión queue and Publish's own APPROVED query both
    exclude ARCHIVED automatically -- they filter by status, and ARCHIVED
    is simply not one of the statuses either one asks for."""

    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: ArchiveArtifactInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        artifact.archive()
        self._artifacts.save(artifact)
        return artifact


@dataclass
class PublishArtifactInput:
    artifact_id: str


class PublishArtifact:
    """READY -> PUBLISH: the only path that puts an Artifact in front of
    real readers. Only an APPROVED Artifact is eligible (checked before
    the external write, so a rejected/unapproved Artifact never reaches
    the public site); the state check happens twice (once here, once
    inside Artifact.publish()) so the invariant holds even if this use
    case is ever called incorrectly. Also advances the real Story state
    machine (PRODUCED -> PUBLISHED, Story.mark_published()) -- reused,
    not reinvented."""

    def __init__(
        self, artifacts: ArtifactRepository, stories: StoryRepository, categories: CategoryRepository,
        assets: AssetRepository, storage: StoragePort, publisher: ArtifactPublishingPort,
    ) -> None:
        self._artifacts = artifacts
        self._stories = stories
        self._categories = categories
        self._assets = assets
        self._storage = storage
        self._publisher = publisher

    def execute(self, input: PublishArtifactInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        if artifact.status not in (
            ArtifactStatus.APPROVED, ArtifactStatus.SCHEDULED, ArtifactStatus.PUBLISHING,
        ):
            raise InvalidStateTransition("Artifact", artifact.status.value, ArtifactStatus.PUBLISHED.value)

        story = self._stories.find_by_id(str(artifact.story_id))
        if story is None:
            raise NotFoundError("Story", str(artifact.story_id))

        category_name = self._resolve_category_name(artifact.category_id)
        image_url = self._resolve_feature_image_url(artifact)
        content_html = self._resolve_content_html(artifact)
        news_id = self._publisher.publish(artifact, category_name, image_url, content_html)

        artifact.publish(news_id)
        story.mark_published()
        self._artifacts.save(artifact)
        self._stories.save(story)
        return artifact

    def _resolve_feature_image_url(self, artifact: Artifact) -> str | None:
        feature = next(
            (m for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE), None,
        )
        if feature is None:
            return None
        if feature.asset_id is None:
            return feature.external_url
        asset = self._assets.find_by_id(feature.asset_id)
        return self._storage.resolve_url(asset.storage_ref) if asset else None

    _PLACEHOLDER_PATTERN = re.compile(r'<figure[^>]*data-placeholder-id="([^"]+)"[^>]*>\s*</figure>')

    def _resolve_content_html(self, artifact: Artifact) -> str:
        """The public site (ArticleContent.tsx / NewsModal.tsx) renders the
        stored `content` column as real HTML -- never plain text (see the
        removed html_to_plain_text downgrade, which existed only because
        the old public renderer couldn't parse HTML). Each BODY_IMAGE's
        <figure data-placeholder-id="..."> position marker (the one real
        source of truth for where it sits, see MediaRequirement's own
        docstring) is resolved here into the real <img>+<figcaption> using
        the SAME real asset the editor generated/uploaded -- mirrors
        ArticlePreviewModal.tsx's resolveBodyImages exactly, just server
        side, since the public row can't carry MediaRequirement data
        itself. A requirement with no fulfilled asset yet resolves to
        nothing -- never a broken/empty image tag."""
        body_images = {
            m.placeholder_id: m for m in artifact.media_requirements if m.kind == MediaKind.BODY_IMAGE
        }

        def resolve(match: re.Match[str]) -> str:
            requirement = body_images.get(match.group(1))
            if requirement is None or requirement.asset_id is None:
                return ""
            asset = self._assets.find_by_id(requirement.asset_id)
            if asset is None:
                return ""
            url = self._storage.resolve_url(asset.storage_ref)
            alt = html.escape(requirement.alt_text or "")
            caption = f"<figcaption>{html.escape(requirement.caption)}</figcaption>" if requirement.caption else ""
            return f'<figure><img src="{url}" alt="{alt}" />{caption}</figure>'

        return self._PLACEHOLDER_PATTERN.sub(resolve, artifact.content_html)

    def _resolve_category_name(self, category_id: str | None) -> str | None:
        if category_id is None:
            return None
        groups = self._categories.list_tree()
        return next((c.name for g in groups for c in g.categories if c.id == category_id), None)


@dataclass
class ScheduleArtifactInput:
    artifact_id: str
    scheduled_at: datetime


class ScheduleArtifact:
    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: ScheduleArtifactInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        artifact.schedule(input.scheduled_at, datetime.now(timezone.utc))
        self._artifacts.save(artifact)
        return artifact


@dataclass
class CancelArtifactScheduleInput:
    artifact_id: str


class CancelArtifactSchedule:
    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: CancelArtifactScheduleInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        artifact.cancel_schedule()
        self._artifacts.save(artifact)
        return artifact


class RunDueScheduledArtifactPublications:
    """Claims due artifacts atomically and publishes them through the
    same validated publication path as an immediate action."""

    def __init__(self, artifacts: ArtifactRepository, publish_artifact: PublishArtifact) -> None:
        self._artifacts = artifacts
        self._publish_artifact = publish_artifact

    def execute(self) -> None:
        now = datetime.now(timezone.utc)
        self._artifacts.recover_stale_scheduled_publications(now - timedelta(minutes=10))
        for artifact_id in self._artifacts.list_due_for_publication(now):
            claimed = self._artifacts.claim_scheduled_publication(artifact_id, now)
            if claimed is None:
                continue
            try:
                self._publish_artifact.execute(PublishArtifactInput(artifact_id=artifact_id))
            except Exception:
                logger.exception("scheduled_publication_failed artifact_id=%s", artifact_id)
                self._artifacts.release_scheduled_publication(artifact_id)
