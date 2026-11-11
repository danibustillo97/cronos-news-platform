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
    AddMediaRequirement, AddMediaRequirementInput, GetMediaGenerationJob, RemoveMediaRequirement,
    RemoveMediaRequirementInput, RunMediaGenerationJob, RunMediaGenerationJobInput, TriggerMediaGeneration,
    TriggerMediaGenerationInput, UpdateMediaPrompt, UpdateMediaPromptInput, UploadMedia, UploadMediaInput,
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


class FakeStorage:
    """Real interface, fake implementation -- records what would have been
    written instead of touching the filesystem."""

    def __init__(self):
        self.uploads = []

    def resolve_url(self, storage_ref):
        return f"https://cdn.example.com/{storage_ref}"

    def save_upload(self, story_id, filename, content):
        self.uploads.append((story_id, filename, content))
        return f"{story_id}/uploads/{filename}"


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


def test_trigger_media_generation_allows_regenerating_an_already_fulfilled_requirement():
    # Real editorial capability (section 14/15 of the Revisión spec):
    # "Reemplazar" via Generar must be allowed, not blocked -- the prior
    # asset is never deleted, only the requirement's pointer moves.
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement(asset_id="asset-1")
    artifacts.save(artifact)
    job = TriggerMediaGeneration(InMemoryJobRepo(), artifacts).execute(
        TriggerMediaGenerationInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
    )
    assert job.status == MediaGenerationJobStatus.QUEUED


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


def test_upload_media_creates_human_uploaded_asset_and_fulfills_requirement():
    artifacts, assets, storage = InMemoryArtifactRepo(), InMemoryAssetRepo(), FakeStorage()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)

    result = UploadMedia(artifacts, assets, storage).execute(UploadMediaInput(
        artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE", filename="foto.jpg",
        content=b"real-bytes-not-a-placeholder", content_type="image/jpeg",
    ))

    assert len(storage.uploads) == 1
    story_id, filename, content = storage.uploads[0]
    assert story_id == "s1" and filename == "foto.jpg" and content == b"real-bytes-not-a-placeholder"

    requirement = result.media_requirements[0]
    assert requirement.asset_id is not None
    asset = assets.find_by_id(requirement.asset_id)
    assert asset.provenance == "HUMAN_UPLOADED"
    assert asset.storage_ref == "s1/uploads/foto.jpg"


def test_upload_media_can_replace_an_already_fulfilled_requirement():
    artifacts, assets, storage = InMemoryArtifactRepo(), InMemoryAssetRepo(), FakeStorage()
    artifact = _artifact_with_requirement(asset_id="asset-generated-1")
    artifacts.save(artifact)

    result = UploadMedia(artifacts, assets, storage).execute(UploadMediaInput(
        artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE", filename="reemplazo.jpg",
        content=b"bytes", content_type="image/jpeg",
    ))

    assert result.media_requirements[0].asset_id != "asset-generated-1"  # replaced, not appended


def test_upload_media_raises_not_found_for_unknown_placeholder():
    artifacts, assets, storage = InMemoryArtifactRepo(), InMemoryAssetRepo(), FakeStorage()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    with pytest.raises(NotFoundError):
        UploadMedia(artifacts, assets, storage).execute(UploadMediaInput(
            artifact_id=str(artifact.id), placeholder_id="BODY_IMAGE_01", filename="x.jpg",
            content=b"x", content_type="image/jpeg",
        ))


def test_update_media_prompt_persists_the_new_prompt():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)

    result = UpdateMediaPrompt(artifacts).execute(
        UpdateMediaPromptInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE", prompt="Nuevo prompt real")
    )

    assert result.media_requirements[0].prompt == "Nuevo prompt real"
    assert artifacts.find_by_id(str(artifact.id)).media_requirements[0].prompt == "Nuevo prompt real"


def test_update_media_prompt_persists_caption_and_alt_text():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)

    result = UpdateMediaPrompt(artifacts).execute(UpdateMediaPromptInput(
        artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE",
        caption="El estadio lleno antes del partido", alt_text="Hinchas en las tribunas",
    ))

    assert result.media_requirements[0].caption == "El estadio lleno antes del partido"
    assert result.media_requirements[0].alt_text == "Hinchas en las tribunas"
    assert result.media_requirements[0].prompt == "Foto real"  # untouched


# ── Evolución del Artifact section 11: add/remove a real BODY_IMAGE ────

def test_add_media_requirement_creates_a_real_body_image_block():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)

    result = AddMediaRequirement(artifacts).execute(
        AddMediaRequirementInput(artifact_id=str(artifact.id), kind="BODY_IMAGE")
    )

    new_ones = [m for m in result.media_requirements if m.kind == MediaKind.BODY_IMAGE]
    assert len(new_ones) == 1
    assert new_ones[0].asset_id is None
    assert new_ones[0].placeholder_id.startswith("BODY_IMAGE_")
    # persisted, not just returned
    assert len(artifacts.find_by_id(str(artifact.id)).media_requirements) == 2


def test_add_media_requirement_rejects_featured_image():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    with pytest.raises(ValueError):
        AddMediaRequirement(artifacts).execute(
            AddMediaRequirementInput(artifact_id=str(artifact.id), kind="FEATURE_IMAGE")
        )


def test_add_media_requirement_rejects_unknown_kind():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    with pytest.raises(ValueError):
        AddMediaRequirement(artifacts).execute(
            AddMediaRequirementInput(artifact_id=str(artifact.id), kind="NOT_A_REAL_KIND")
        )


def test_add_media_requirement_raises_not_found_for_unknown_artifact():
    with pytest.raises(NotFoundError):
        AddMediaRequirement(InMemoryArtifactRepo()).execute(
            AddMediaRequirementInput(artifact_id="missing", kind="BODY_IMAGE")
        )


def test_remove_media_requirement_removes_the_body_image():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    added = AddMediaRequirement(artifacts).execute(
        AddMediaRequirementInput(artifact_id=str(artifact.id), kind="BODY_IMAGE")
    )
    new_id = next(m.placeholder_id for m in added.media_requirements if m.kind == MediaKind.BODY_IMAGE)

    result = RemoveMediaRequirement(artifacts).execute(
        RemoveMediaRequirementInput(artifact_id=str(artifact.id), placeholder_id=new_id)
    )

    assert all(m.placeholder_id != new_id for m in result.media_requirements)
    assert len(artifacts.find_by_id(str(artifact.id)).media_requirements) == 1


def test_remove_media_requirement_rejects_featured_image():
    artifacts = InMemoryArtifactRepo()
    artifact = _artifact_with_requirement()
    artifacts.save(artifact)
    with pytest.raises(ValueError):
        RemoveMediaRequirement(artifacts).execute(
            RemoveMediaRequirementInput(artifact_id=str(artifact.id), placeholder_id="FEATURE_IMAGE")
        )
