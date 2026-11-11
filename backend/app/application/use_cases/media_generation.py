"""PHASE 7 -- fulfills an Artifact's declared MediaRequirement with a real
generated image. Same two-step shape as TriggerArtifact/RunArtifactJob:
trigger creates a QUEUED job and returns immediately, the real (network)
work runs out-of-request via BackgroundTasks.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.artifact.entities import _UNSET, Artifact, MediaKind, _Unset
from app.domain.asset.entities import Asset, AssetType, MediaGenerationJob, MediaGenerationJobStatus
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import ArtifactId, AssetId
from app.domain.ports import (
    ArtifactRepository, AssetRepository, MediaGenerationJobRepository, MediaGenerationPort,
    MediaGenerationUnavailableError, StoragePort,
)


@dataclass
class TriggerMediaGenerationInput:
    artifact_id: str
    placeholder_id: str


class TriggerMediaGeneration:
    def __init__(self, jobs: MediaGenerationJobRepository, artifacts: ArtifactRepository) -> None:
        self._jobs = jobs
        self._artifacts = artifacts

    def execute(self, input: TriggerMediaGenerationInput) -> MediaGenerationJob:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)

        requirement = next(
            (m for m in artifact.media_requirements if m.placeholder_id == input.placeholder_id), None,
        )
        if requirement is None:
            raise NotFoundError("MediaRequirement", input.placeholder_id)
        # Regenerating an already-fulfilled requirement is a real, explicit
        # "Reemplazar" action from the Revisión workspace -- not blocked.
        # The asset it replaces is never deleted (see fulfill_media_
        # requirement's docstring), so history survives the replace.

        job = MediaGenerationJob(
            id=str(uuid.uuid4()), artifact_id=ArtifactId.of(input.artifact_id), placeholder_id=input.placeholder_id,
            status=MediaGenerationJobStatus.QUEUED, created_at=datetime.now(timezone.utc),
        )
        self._jobs.save(job)
        return job


class GetMediaGenerationJob:
    def __init__(self, jobs: MediaGenerationJobRepository) -> None:
        self._jobs = jobs

    def execute(self, job_id: str) -> MediaGenerationJob:
        job = self._jobs.find_by_id(job_id)
        if job is None:
            raise NotFoundError("MediaGenerationJob", job_id)
        return job


@dataclass
class RunMediaGenerationJobInput:
    job_id: str


class RunMediaGenerationJob:
    def __init__(
        self, jobs: MediaGenerationJobRepository, artifacts: ArtifactRepository, assets: AssetRepository,
        generator: MediaGenerationPort,
    ) -> None:
        self._jobs = jobs
        self._artifacts = artifacts
        self._assets = assets
        self._generator = generator

    def execute(self, input: RunMediaGenerationJobInput) -> MediaGenerationJob:
        job = self._jobs.find_by_id(input.job_id)
        if job is None:
            raise NotFoundError("MediaGenerationJob", input.job_id)

        job.start()
        self._jobs.save(job)

        try:
            artifact = self._artifacts.find_by_id(str(job.artifact_id))
            if artifact is None:
                raise ValueError(f"Artifact {job.artifact_id} not found")
            requirement = next(
                (m for m in artifact.media_requirements if m.placeholder_id == job.placeholder_id), None,
            )
            if requirement is None:
                raise ValueError(f"No media requirement {job.placeholder_id!r} on artifact {artifact.id}")

            result = self._generator.generate(str(artifact.story_id), job.placeholder_id, requirement.prompt)

            asset = Asset(
                id=AssetId.new(), story_id=artifact.story_id, composition_id=None, type=AssetType.IMAGE,
                provenance=f"AI_GENERATED:{result.provider}:{result.model}", storage_ref=result.storage_ref,
                created_at=datetime.now(timezone.utc),
                metadata={
                    "mime_type": result.mime_type, "width": result.width, "height": result.height,
                    "placeholder_id": job.placeholder_id, "prompt": requirement.prompt,
                },
            )
            self._assets.save(asset)
            artifact.fulfill_media_requirement(job.placeholder_id, str(asset.id))
            self._artifacts.save(artifact)
        except MediaGenerationUnavailableError as exc:
            job.fail(str(exc), datetime.now(timezone.utc))
            self._jobs.save(job)
            return job
        except Exception as exc:  # noqa: BLE001 -- the real error, always recorded, never swallowed
            job.fail(str(exc), datetime.now(timezone.utc))
            self._jobs.save(job)
            return job

        job.complete(asset_id=str(asset.id), finished_at=datetime.now(timezone.utc))
        self._jobs.save(job)
        return job


@dataclass
class UpdateMediaPromptInput:
    artifact_id: str
    placeholder_id: str
    prompt: str | None = None
    caption: str | _Unset | None = _UNSET
    alt_text: str | _Unset | None = _UNSET


class UpdateMediaPrompt:
    """Section 14/15 + Evolución del Artifact section 8/13: the editor
    rewriting a generation prompt, caption, or alt text -- real,
    persisted, never applied to an asset already generated with the old
    prompt (that asset's own metadata keeps the real prompt it was
    actually generated with). Three genuinely different real fields,
    updated independently -- never conflated."""

    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: UpdateMediaPromptInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        artifact.update_media_prompt(
            input.placeholder_id, prompt=input.prompt, caption=input.caption, alt_text=input.alt_text,
        )
        self._artifacts.save(artifact)
        return artifact


@dataclass
class AddMediaRequirementInput:
    artifact_id: str
    kind: str  # "BODY_IMAGE" | "VIDEO"


class AddMediaRequirement:
    """Section 11's real "+ Insertar imagen": a human editor adding a new
    real image/video need to the document -- gets a fresh, real
    placeholder_id (never reused, so it can never collide with one
    Artifact itself generated)."""

    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: AddMediaRequirementInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        try:
            kind = MediaKind(input.kind)
        except ValueError as exc:
            raise ValueError(f"unknown media kind: {input.kind!r}") from exc
        placeholder_id = f"{kind.value}_{uuid.uuid4().hex[:8]}"
        artifact.add_media_requirement(placeholder_id, kind)
        self._artifacts.save(artifact)
        return artifact


@dataclass
class RemoveMediaRequirementInput:
    artifact_id: str
    placeholder_id: str


class RemoveMediaRequirement:
    """The real counterpart to AddMediaRequirement -- removing a
    BODY_IMAGE/VIDEO block the editor decided against. The real Asset row
    is never deleted (same rule as fulfill_media_requirement); only this
    Artifact's own need for it goes away."""

    def __init__(self, artifacts: ArtifactRepository) -> None:
        self._artifacts = artifacts

    def execute(self, input: RemoveMediaRequirementInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        artifact.remove_media_requirement(input.placeholder_id)
        self._artifacts.save(artifact)
        return artifact


@dataclass
class UploadMediaInput:
    artifact_id: str
    placeholder_id: str
    filename: str
    content: bytes
    content_type: str


class UploadMedia:
    """Section 14/15's real "[Subir imagen]" -- a human-supplied file,
    never a generated one. Synchronous (no QUEUED/RUNNING job): a browser
    upload is already complete by the time this request lands, there's no
    real multi-second provider call to poll for like Generar has."""

    def __init__(self, artifacts: ArtifactRepository, assets: AssetRepository, storage: StoragePort) -> None:
        self._artifacts = artifacts
        self._assets = assets
        self._storage = storage

    def execute(self, input: UploadMediaInput) -> Artifact:
        artifact = self._artifacts.find_by_id(input.artifact_id)
        if artifact is None:
            raise NotFoundError("Artifact", input.artifact_id)
        requirement = next(
            (m for m in artifact.media_requirements if m.placeholder_id == input.placeholder_id), None,
        )
        if requirement is None:
            raise NotFoundError("MediaRequirement", input.placeholder_id)

        storage_ref = self._storage.save_upload(str(artifact.story_id), input.filename, input.content)
        asset = Asset(
            id=AssetId.new(), story_id=artifact.story_id, composition_id=None, type=AssetType.IMAGE,
            provenance="HUMAN_UPLOADED", storage_ref=storage_ref, created_at=datetime.now(timezone.utc),
            metadata={"mime_type": input.content_type, "placeholder_id": input.placeholder_id, "original_filename": input.filename},
        )
        self._assets.save(asset)
        artifact.fulfill_media_requirement(input.placeholder_id, str(asset.id))
        self._artifacts.save(artifact)
        return artifact
