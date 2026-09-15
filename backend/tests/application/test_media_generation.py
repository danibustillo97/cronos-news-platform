from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import (
    Artifact, ArtifactStatus, MediaKind, MediaRequirement, SeoMetadata,
)
from app.domain.asset.entities import MediaGenerationJobStatus, MediaGenerationResult
from app.domain.ports import MediaGenerationUnavailableError
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import ArtifactId, StoryId
from app.application.use_cases.media_generation import (
    GetMediaGenerationJob, RunMediaGenerationJob, RunMediaGenerationJobInput, TriggerMediaGeneration,
    TriggerMediaGenerationInput,
)


class InMemoryArtifactRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, artifact_id):
        return self.items.get(artifact_id)

    def save(self, artifact):
        self.items[str(artifact.id)] = artifact


class InMemoryJobRepo:
    def __init__(self):
        self.jobs = {}

    def find_by_id(self, job_id):
        return self.jobs.get(job_id)

    def list_recent(self, limit=20):
        return list(self.jobs.values())[:limit]

    def save(self, job):
        self.jobs[job.id] = job


class InMemoryAssetRepo:
    def __init__(self):
        self.items = {}

    def find_by_id(self, asset_id):
        return self.items.get(asset_id)

    def list_for_story(self, story_id):
        return [a for a in self.items.values() if str(a.story_id) == story_id]

    def save(self, asset):
        self.items[str(asset.id)] = asset


class FakeMediaGenerator:
    def __init__(self, result=None, error=None):
        self._result = result
        self._error = error

    def generate(self, story_id, placeholder_id, prompt, aspect_ratio="16:9"):
        if self._error:
            raise self._error
        return self._result


def _artifact_with_requirement(asset_id=None):
    return Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.of("s1"), version=1, title="T", subtitle=None,
        excerpt="e", summary="s", content_html="<article><p>x</p></article>", category_id=None, tags=[],
        entities=[], seo=SeoMetadata(seo_title="t", seo_description="d", slug="t"), sources=[],
        claims=[], media_requirements=[
            MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto real", asset_id=asset_id),
        ],
        created_at=datetime.now(timezone.utc),
    )


def test_trigger_media_generation_creates_queued_job():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    jobs = InMemoryJobRepo()

    job = TriggerMediaGeneration(jobs, artifacts).execute(
        TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
    )

    assert job.status == MediaGenerationJobStatus.QUEUED
    assert jobs.find_by_id(job.id) is job


def test_trigger_media_generation_raises_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        TriggerMediaGeneration(InMemoryJobRepo(), InMemoryArtifactRepo()).execute(
            TriggerMediaGenerationInput(artifact_id="missing", placeholder_id="FEATURE_IMAGE")
        )


def test_trigger_media_generation_raises_for_unknown_placeholder():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    with pytest.raises(NotFoundError):
        TriggerMediaGeneration(InMemoryJobRepo(), artifacts).execute(
            TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="BODY_IMAGE_01")
        )


def test_trigger_media_generation_raises_if_already_fulfilled():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement(asset_id="asset-1")
    artifacts.save(artifact)
    with pytest.raises(ValueError):
        TriggerMediaGeneration(InMemoryJobRepo(), artifacts).execute(
            TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
        )


def test_get_media_generation_job_raises_not_found():
    with pytest.raises(NotFoundError):
        GetMediaGenerationJob(InMemoryJobRepo()).execute("missing")


def test_run_media_generation_job_creates_real_asset_and_fulfills_requirement():
    artifacts, jobs, assets = InMemoryArtifactRepo(), InMemoryJobRepo(), InMemoryAssetRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    job = TriggerMediaGeneration(jobs, artifacts).execute(
        TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
    )

    generator = FakeMediaGenerator(result=MediaGenerationResult(
        storage_ref="s1/media/FEATURE_IMAGE.jpeg", mime_type="image/jpeg", width=1024, height=1024,
        provider="cloudflare", model="flux-1-schnell",
    ))
    result_job = RunMediaGenerationJob(jobs, artifacts, assets, generator).execute(
        RunMediaGenerationJobInput(job_id=job.id)
    )

    assert result_job.status == MediaGenerationJobStatus.COMPLETED
    assert result_job.asset_id is not None
    asset = assets.find_by_id(result_job.asset_id)
    assert asset.storage_ref == "s1/media/FEATURE_IMAGE.jpeg"
    updated_artifact = artifacts.find_by_id(str(artifact.id))
    assert updated_artifact.media_requirements[0].asset_id == result_job.asset_id


def test_run_media_generation_job_fails_honestly_when_provider_unavailable():
    artifacts, jobs, assets = InMemoryArtifactRepo(), InMemoryJobRepo(), InMemoryAssetRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    job = TriggerMediaGeneration(jobs, artifacts).execute(
        TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
    )

    generator = FakeMediaGenerator(error=MediaGenerationUnavailableError("429 RESOURCE_EXHAUSTED"))
    result_job = RunMediaGenerationJob(jobs, artifacts, assets, generator).execute(
        RunMediaGenerationJobInput(job_id=job.id)
    )

    assert result_job.status == MediaGenerationJobStatus.FAILED
    assert "RESOURCE_EXHAUSTED" in result_job.error
    assert len(assets.items) == 0  # no fabricated Asset was saved
    assert artifacts.find_by_id(str(artifact.id)).media_requirements[0].asset_id is None
