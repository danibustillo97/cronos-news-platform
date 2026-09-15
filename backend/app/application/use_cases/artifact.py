"""Artifact use cases -- orchestration only. The actual editorial
reasoning happens inside the real LLM call (ArtifactGenerationPort);
validation is a pure domain function (app.domain.artifact.validation).
This module wires them together and owns the state transitions, same
separation ProduceStory/discovery.py already established.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.shared.errors import InvalidStateTransition, NotFoundError
from app.domain.shared.ids import ArtifactId, StoryId
from app.domain.artifact.entities import (
    Artifact, ArtifactGenerationRequest, ArtifactJob, ArtifactJobStatus, ArtifactStatus, MediaKind, SeoMetadata,
    SourceMaterial, SourceReference,
)
from app.domain.artifact.validation import validate_artifact
from app.domain.ports import (
    ArtifactGenerationPort, ArtifactGenerationUnavailableError, ArtifactJobRepository, ArtifactPublishingPort,
    ArtifactRepository, AssetRepository, CategoryRepository, DiscoveryRepository, StoragePort, StoryRepository,
)


@dataclass
class TriggerArtifactInput:
    story_id: str


class TriggerArtifact:
    """DISCOVERY UP -> ARTIFACT: creates a real, QUEUED job. Never starts
    running here -- RunArtifactJob (invoked as a background task by the
    API layer) is what actually calls the LLM, so the HTTP request that
    triggers this returns immediately instead of blocking for the
    10-60+ seconds a real generation call takes."""

    def __init__(self, jobs: ArtifactJobRepository, stories: StoryRepository) -> None:
        self._jobs = jobs
        self._stories = stories

    def execute(self, input: TriggerArtifactInput) -> ArtifactJob:
        story = self._stories.find_by_id(input.story_id)
        if story is None:
            raise NotFoundError("Story", input.story_id)

        job = ArtifactJob(
            id=str(uuid.uuid4()), story_id=StoryId.of(input.story_id),
            status=ArtifactJobStatus.QUEUED, created_at=datetime.now(timezone.utc),
        )
        self._jobs.save(job)
        return job


class GetArtifactJob:
    def __init__(self, jobs: ArtifactJobRepository) -> None:
        self._jobs = jobs

    def execute(self, job_id: str) -> ArtifactJob:
        job = self._jobs.find_by_id(job_id)
        if job is None:
            raise NotFoundError("ArtifactJob", job_id)
        return job


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
        stories: StoryRepository, categories: CategoryRepository, generator: ArtifactGenerationPort,
    ) -> None:
        self._jobs = jobs
        self._artifacts = artifacts
        self._discovery_items = discovery_items
        self._stories = stories
        self._categories = categories
        self._generator = generator

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

        try:
            result = self._generator.generate(request)
        except ArtifactGenerationUnavailableError:
            raise  # already a real, specific error -- pass through unchanged

        category_id = name_to_id.get(result.category_name) if result.category_name else None

        existing = self._artifacts.find_latest_for_story(str(job.story_id))
        version = (existing.version + 1) if existing else 1

        artifact = Artifact.draft(
            artifact_id=ArtifactId.new(), story_id=story.id, version=version,
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
        validation = validate_artifact(artifact, valid_category_names=set(name_to_id.values()))
        artifact.apply_validation(validation)
        return artifact


class ListArtifactsByStatus:
    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, status: str, limit: int = 50) -> list[Artifact]:
        return self._artifacts.list_by_status(status, limit)


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
        if artifact.status != ArtifactStatus.APPROVED:
            raise InvalidStateTransition("Artifact", artifact.status.value, ArtifactStatus.PUBLISHED.value)

        story = self._stories.find_by_id(str(artifact.story_id))
        if story is None:
            raise NotFoundError("Story", str(artifact.story_id))

        category_name = self._resolve_category_name(artifact.category_id)
        image_url = self._resolve_feature_image_url(artifact)
        news_id = self._publisher.publish(artifact, category_name, image_url)

        artifact.publish(news_id)
        story.mark_published()
        self._artifacts.save(artifact)
        self._stories.save(story)
        return artifact

    def _resolve_feature_image_url(self, artifact: Artifact) -> str | None:
        feature = next(
            (m for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE and m.asset_id), None,
        )
        if feature is None:
            return None  # Phase 7 gap: no real image generated yet -- never fabricated
        asset = self._assets.find_by_id(feature.asset_id)
        return self._storage.resolve_url(asset.storage_ref) if asset else None

    def _resolve_category_name(self, category_id: str | None) -> str | None:
        if category_id is None:
            return None
        groups = self._categories.list_tree()
        return next((c.name for g in groups for c in g.categories if c.id == category_id), None)
