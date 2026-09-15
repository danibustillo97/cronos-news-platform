from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from pydantic import BaseModel

from app.container import Container, get_container
from app.application.use_cases.artifact import (
    PublishArtifactInput, ReviewArtifactInput, RunArtifactJobInput, TriggerArtifactInput,
)
from app.presentation.schemas import (
    ArtifactJobOut, ArtifactOut, TriggerArtifactRequest, ReviewArtifactRequest,
)
from app.presentation.mappers import artifact_job_out, artifact_out

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


@router.post("/jobs", response_model=ArtifactJobOut)
def trigger_artifact(
    body: TriggerArtifactRequest, background_tasks: BackgroundTasks, container: Container = Depends(get_container),
) -> ArtifactJobOut:
    """DISCOVERY UP -> ARTIFACT. Returns a QUEUED job immediately; the
    real LLM call (10-60+ seconds) runs as a background task so this
    request never blocks on it -- poll GET /jobs/{id} for real progress."""
    job = container.trigger_artifact.execute(TriggerArtifactInput(story_id=body.story_id))
    background_tasks.add_task(container.run_artifact_job.execute, RunArtifactJobInput(job_id=job.id))
    return artifact_job_out(job)


@router.get("/jobs/{job_id}", response_model=ArtifactJobOut)
def get_artifact_job(job_id: str, container: Container = Depends(get_container)) -> ArtifactJobOut:
    return artifact_job_out(container.get_artifact_job.execute(job_id))


class ArtifactsResponse(BaseModel):
    artifacts: list[ArtifactOut]


@router.get("", response_model=ArtifactsResponse)
def list_artifacts(
    status: str = Query("VALIDATED"), limit: int = Query(50, le=200), container: Container = Depends(get_container),
) -> ArtifactsResponse:
    """Real listing for the Ready tab -- defaults to VALIDATED (passed
    every automated check, awaiting human approval)."""
    items = container.list_artifacts_by_status.execute(status=status, limit=limit)
    return ArtifactsResponse(artifacts=[artifact_out(a) for a in items])


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
