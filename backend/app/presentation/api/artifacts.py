from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel

from app.container import Container, get_container
from app.application.use_cases.artifact import (
    PublishArtifactInput, ReviewArtifactInput, RunArtifactJobInput, TriggerArtifactInput,
)
from app.application.use_cases.media_generation import (
    RunMediaGenerationJobInput, TriggerMediaGenerationInput,
)
from app.domain.artifact.entities import Artifact
from app.presentation.schemas import (
    ArtifactJobOut, ArtifactOut, MediaGenerationJobOut, TriggerArtifactRequest, ReviewArtifactRequest,
)
from app.presentation.mappers import artifact_job_out, artifact_out, media_generation_job_out

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


def _resolve_asset_urls(container: Container, artifacts: list[Artifact]) -> dict[str, str]:
    urls: dict[str, str] = {}
    asset_ids = {m.asset_id for a in artifacts for m in a.media_requirements if m.asset_id}
    for asset_id in asset_ids:
        asset = container.asset_repo.find_by_id(asset_id)
        if asset is not None:
            urls[asset_id] = container.storage.resolve_url(asset.storage_ref)
    return urls


@router.post("/jobs", response_model=ArtifactJobOut)
def trigger_artifact(
    body: TriggerArtifactRequest, background_tasks: BackgroundTasks, container: Container = Depends(get_container),
) -> ArtifactJobOut:
    """DISCOVERY UP -> ARTIFACT. Returns a QUEUED job immediately; the
    real LLM call (10-60+ seconds) runs as a background task so this
    request never blocks on it -- poll GET /jobs/{id} for real progress."""
    job = container.trigger_artifact.execute(TriggerArtifactInput(story_id=body.story_id, provider=body.provider))
    background_tasks.add_task(container.run_artifact_job.execute, RunArtifactJobInput(job_id=job.id))
    return artifact_job_out(job)


@router.get("/jobs/{job_id}", response_model=ArtifactJobOut)
def get_artifact_job(job_id: str, container: Container = Depends(get_container)) -> ArtifactJobOut:
    return artifact_job_out(container.get_artifact_job.execute(job_id))


@router.get("/jobs/by-story/{story_id}", response_model=ArtifactJobOut)
def get_latest_artifact_job_for_story(story_id: str, container: Container = Depends(get_container)) -> ArtifactJobOut:
    """The Artifact drawer's real entry point -- finds the job by the
    same Story id the Discovery item already shares, no client-side
    job-id memory required."""
    return artifact_job_out(container.get_latest_artifact_job_for_story.execute(story_id))


@router.get("/{artifact_id}", response_model=ArtifactOut)
def get_artifact(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    """Single-artifact detail -- the real backing for the Artifact
    drawer once a job's artifactId is known."""
    artifact = container.get_artifact.execute(artifact_id)
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


class ArtifactsResponse(BaseModel):
    artifacts: list[ArtifactOut]


@router.get("", response_model=ArtifactsResponse)
def list_artifacts(
    status: str = Query("VALIDATED"), limit: int = Query(50, le=200), container: Container = Depends(get_container),
) -> ArtifactsResponse:
    """Real listing for the Ready tab -- defaults to VALIDATED (passed
    every automated check, awaiting human approval)."""
    items = container.list_artifacts_by_status.execute(status=status, limit=limit)
    asset_urls = _resolve_asset_urls(container, items)
    return ArtifactsResponse(artifacts=[artifact_out(a, asset_urls) for a in items])


@router.post("/{artifact_id}/review", response_model=ArtifactOut)
def review_artifact(
    artifact_id: str, body: ReviewArtifactRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    """The human editorial authority: APPROVE makes this real READY
    (advances the Story to PRODUCED too), REJECT sends it back."""
    artifact = container.review_artifact.execute(
        ReviewArtifactInput(artifact_id=artifact_id, decision=body.decision, reason=body.reason)
    )
    return artifact_out(artifact)


@router.post("/{artifact_id}/publish", response_model=ArtifactOut)
def publish_artifact(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    """READY -> PUBLISH: writes a real row into the public `news` table
    and advances both the Artifact and its Story to PUBLISHED. Only
    reachable from APPROVED -- the use case rejects anything else."""
    artifact = container.publish_artifact.execute(PublishArtifactInput(artifact_id=artifact_id))
    return artifact_out(artifact)


@router.post("/{artifact_id}/media/{placeholder_id}/generate", response_model=MediaGenerationJobOut)
def generate_media(
    artifact_id: str, placeholder_id: str, background_tasks: BackgroundTasks,
    container: Container = Depends(get_container),
) -> MediaGenerationJobOut:
    """PHASE 7: fulfills one declared MediaRequirement with a real
    generated image (Gemini/Cloudflare via the Local Runtime bridge).
    Same QUEUED-then-background shape as /jobs -- a real provider call
    takes a few seconds, never fabricated instantly."""
    job = container.trigger_media_generation.execute(
        TriggerMediaGenerationInput(artifact_id=artifact_id, placeholder_id=placeholder_id)
    )
    background_tasks.add_task(container.run_media_generation_job.execute, RunMediaGenerationJobInput(job_id=job.id))
    return media_generation_job_out(job)


@router.get("/media/jobs/{job_id}", response_model=MediaGenerationJobOut)
def get_media_generation_job(job_id: str, container: Container = Depends(get_container)) -> MediaGenerationJobOut:
    return media_generation_job_out(container.get_media_generation_job.execute(job_id))
