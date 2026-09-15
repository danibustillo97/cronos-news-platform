"""PHASE 7 -- fulfills an Artifact's declared MediaRequirement with a real
generated image. Same two-step shape as TriggerArtifact/RunArtifactJob:
trigger creates a QUEUED job and returns immediately, the real (network)
work runs out-of-request via BackgroundTasks.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from app.domain.asset.entities import Asset, AssetType, MediaGenerationJob, MediaGenerationJobStatus
from app.domain.shared.errors import NotFoundError
from app.domain.shared.ids import ArtifactId, AssetId
from app.domain.ports import (
    ArtifactRepository, AssetRepository, MediaGenerationJobRepository, MediaGenerationPort,
    MediaGenerationUnavailableError,
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
        if requirement.asset_id is not None:
            raise ValueError(f"{input.placeholder_id!r} already has a real asset ({requirement.asset_id})")

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
