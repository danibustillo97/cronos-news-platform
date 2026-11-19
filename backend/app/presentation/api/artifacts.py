from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

from app.container import Container, get_container
from app.application.use_cases.artifact import (
    ArchiveArtifactInput, CancelArtifactScheduleInput, MarkClaimReviewedInput, ProposeClaimResolutionInput,
    ProposeSeoFixInput, PublishArtifactInput, ReviewArtifactInput, RunArtifactJobInput, ScheduleArtifactInput,
    SubmitArtifactForReviewInput, TriggerArtifactInput, UpdateArtifactInput,
)
from app.domain.ports import ArtifactGenerationUnavailableError
from app.application.use_cases.media_generation import (
    AddMediaRequirementInput, RemoveMediaRequirementInput, RunMediaGenerationJobInput, TriggerMediaGenerationInput,
    UpdateMediaPromptInput, UploadMediaInput,
)
from app.domain.artifact.entities import _UNSET, Artifact
from app.presentation.schemas import (
    AddMediaRequirementRequest, ArtifactJobOut, ArtifactOut, MarkClaimReviewedRequest, MediaGenerationJobOut,
    ProposeClaimResolutionResponseOut, ProposeSeoFixRequest, ProposeSeoFixResponseOut, TriggerArtifactRequest,
    ReviewArtifactRequest, ScheduleArtifactRequest, UpdateArtifactRequest, UpdateMediaPromptRequest,
)
from app.presentation.mappers import artifact_job_out, artifact_out, media_generation_job_out

router = APIRouter(prefix="/api/artifacts", tags=["artifacts"])


def _resolve_asset_urls(container: Container, artifacts: list[Artifact]) -> dict[str, dict[str, str]]:
    """Real per-asset info the UI needs to show alongside a
    MediaRequirement -- URL to render, and provenance (AI_GENERATED:.../
    HUMAN_UPLOADED) so an editor knows how the image actually got there.
    Never invented when the asset doesn't exist."""
    info: dict[str, dict[str, str]] = {}
    asset_ids = {m.asset_id for a in artifacts for m in a.media_requirements if m.asset_id}
    for asset_id in asset_ids:
        asset = container.asset_repo.find_by_id(asset_id)
        if asset is not None:
            entry = {"url": container.storage.resolve_url(asset.storage_ref)}
            if asset.provenance:
                entry["provenance"] = asset.provenance
            info[asset_id] = entry
    return info


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


class ArtifactJobsResponse(BaseModel):
    jobs: list[ArtifactJobOut]


@router.get("/jobs/by-story/{story_id}/history", response_model=ArtifactJobsResponse)
def list_artifact_jobs_for_story(story_id: str, container: Container = Depends(get_container)) -> ArtifactJobsResponse:
    """Section 1's real retry history -- every attempt for this story,
    newest first (GET .../by-story/{id} above only ever returns the
    latest one)."""
    jobs = container.list_artifact_jobs_for_story.execute(story_id)
    return ArtifactJobsResponse(jobs=[artifact_job_out(j) for j in jobs])


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


@router.patch("/{artifact_id}", response_model=ArtifactOut)
def update_artifact(
    artifact_id: str, body: UpdateArtifactRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    """The Revisión workspace's real save -- a plain field patch. Only
    fields actually present in the request body are applied (see
    UpdateArtifactInput's own field-by-field None/sentinel handling);
    this is what autosave debounces into, not a per-keystroke call."""
    provided = body.model_dump(exclude_unset=True)
    artifact = container.update_artifact.execute(UpdateArtifactInput(artifact_id=artifact_id, **provided))
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


@router.post("/{artifact_id}/submit", response_model=ArtifactOut)
def submit_artifact_for_review(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    artifact = container.submit_artifact_for_review.execute(SubmitArtifactForReviewInput(artifact_id))
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


@router.post("/{artifact_id}/seo/suggest-fix", response_model=ProposeSeoFixResponseOut)
def propose_seo_fix(
    artifact_id: str, body: ProposeSeoFixRequest, container: Container = Depends(get_container),
) -> ProposeSeoFixResponseOut:
    """Section 5's real "Corregir con IA" -- one real, synchronous
    Provider Control Plane call (same resolver/policy as /jobs) that
    returns a PROPOSAL only. Nothing is persisted here: the editor
    accepts/edits/discards it in the UI, and accepting reuses the
    existing PATCH /{artifact_id} (UpdateArtifact) to actually save and
    revalidate -- no parallel write path."""
    try:
        result = container.propose_seo_fix.execute(
            ProposeSeoFixInput(artifact_id=artifact_id, field=body.field, provider=body.provider, instruction=body.instruction)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ArtifactGenerationUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ProposeSeoFixResponseOut(
        field=result.field, value=result.value, reason=result.reason, character_count=result.character_count,
        min_length=result.min_length, max_length=result.max_length, provider=result.provider, model=result.model,
    )


@router.post("/{artifact_id}/claims/{claim_id}/review", response_model=ArtifactOut)
def mark_claim_reviewed(
    artifact_id: str, claim_id: str, body: MarkClaimReviewedRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    """Section 11: marks ONE specific claim as looked-at by a human
    editor -- real, persisted, and revalidates. `label`/`sourceUrls` are
    set only when accepting a real ProposeClaimResolution proposal
    (section 2/4) -- this is the ONE real write path for both actions,
    never two."""
    artifact = container.mark_claim_reviewed.execute(MarkClaimReviewedInput(
        artifact_id=artifact_id, claim_id=claim_id, reviewed=body.reviewed,
        label=body.label, source_urls=body.source_urls,
    ))
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


@router.post("/{artifact_id}/claims/{claim_id}/resolve", response_model=ProposeClaimResolutionResponseOut)
def propose_claim_resolution(
    artifact_id: str, claim_id: str, container: Container = Depends(get_container),
) -> ProposeClaimResolutionResponseOut:
    """Revisión 2.0 section 2/4's real "Resolver con IA" for a claim --
    one real Provider Control Plane call, re-examining the claim against
    the same real source material Artifact generated from. Returns a
    PROPOSAL only; accepting it calls POST .../review above."""
    try:
        result = container.propose_claim_resolution.execute(
            ProposeClaimResolutionInput(artifact_id=artifact_id, claim_id=claim_id)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ArtifactGenerationUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return ProposeClaimResolutionResponseOut(
        claim_id=result.claim_id, label=result.label, reason=result.reason,
        source_urls=result.source_urls, provider=result.provider, model=result.model,
    )


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


@router.post("/{artifact_id}/archive", response_model=ArtifactOut)
def archive_artifact(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    """Section 2's real "Eliminar": soft delete/archive. Removes the
    artifact from the Revisión queue and from Publish's APPROVED query
    (both filter by status; ARCHIVED matches neither) without touching
    provenance, Discovery, or any related row. Blocked once PUBLISHED --
    the use case raises InvalidStateTransition, mapped to 409 below."""
    artifact = container.archive_artifact.execute(ArchiveArtifactInput(artifact_id=artifact_id))
    return artifact_out(artifact)


@router.post("/{artifact_id}/publish", response_model=ArtifactOut)
def publish_artifact(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    """READY -> PUBLISH: writes a real row into the public `news` table
    and advances both the Artifact and its Story to PUBLISHED. Only
    reachable from APPROVED -- the use case rejects anything else."""
    artifact = container.publish_artifact.execute(PublishArtifactInput(artifact_id=artifact_id))
    return artifact_out(artifact)


@router.post("/{artifact_id}/schedule", response_model=ArtifactOut)
def schedule_artifact(
    artifact_id: str, body: ScheduleArtifactRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    if body.scheduled_at.tzinfo is None:
        raise HTTPException(status_code=422, detail="scheduledAt must include a timezone")
    try:
        artifact = container.schedule_artifact.execute(
            ScheduleArtifactInput(artifact_id=artifact_id, scheduled_at=body.scheduled_at),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return artifact_out(artifact)


@router.post("/{artifact_id}/schedule/cancel", response_model=ArtifactOut)
def cancel_artifact_schedule(artifact_id: str, container: Container = Depends(get_container)) -> ArtifactOut:
    artifact = container.cancel_artifact_schedule.execute(CancelArtifactScheduleInput(artifact_id))
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


@router.patch("/{artifact_id}/media/{placeholder_id}", response_model=ArtifactOut)
def update_media_prompt(
    artifact_id: str, placeholder_id: str, body: UpdateMediaPromptRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    """Section 14/15 + Evolución del Artifact section 8/13: editing a
    generation prompt, caption, or alt text -- real, persisted. Caption/
    alt use explicit clear_* flags (never a bare null) so "not sent" and
    "explicitly cleared" stay distinct, same as UpdateArtifactRequest's
    own nullable fields."""
    try:
        artifact = container.update_media_prompt.execute(UpdateMediaPromptInput(
            artifact_id=artifact_id, placeholder_id=placeholder_id, prompt=body.prompt,
            caption=None if body.clear_caption else (body.caption if body.caption is not None else _UNSET),
            alt_text=None if body.clear_alt_text else (body.alt_text if body.alt_text is not None else _UNSET),
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


@router.post("/{artifact_id}/media", response_model=ArtifactOut)
def add_media_requirement(
    artifact_id: str, body: AddMediaRequirementRequest, container: Container = Depends(get_container),
) -> ArtifactOut:
    """Section 11's real "+ Insertar imagen" -- adds a new real BODY_IMAGE
    (or VIDEO) block to the document with a fresh placeholder_id. Never
    FEATURE_IMAGE (see Artifact.add_media_requirement)."""
    try:
        artifact = container.add_media_requirement.execute(
            AddMediaRequirementInput(artifact_id=artifact_id, kind=body.kind)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


@router.delete("/{artifact_id}/media/{placeholder_id}", response_model=ArtifactOut)
def remove_media_requirement(
    artifact_id: str, placeholder_id: str, container: Container = Depends(get_container),
) -> ArtifactOut:
    """The real counterpart to add_media_requirement -- removing a
    BODY_IMAGE/VIDEO block. FEATURE_IMAGE can never be removed this way."""
    try:
        artifact = container.remove_media_requirement.execute(
            RemoveMediaRequirementInput(artifact_id=artifact_id, placeholder_id=placeholder_id)
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)


_MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB -- a real, generous-but-bounded limit for an editorial image


@router.post("/{artifact_id}/media/{placeholder_id}/upload", response_model=ArtifactOut)
async def upload_media(
    artifact_id: str, placeholder_id: str, file: UploadFile = File(...), container: Container = Depends(get_container),
) -> ArtifactOut:
    """Section 14/15's real "[Subir imagen]" -- synchronous, no job to
    poll (the upload itself IS the real work, already done by the time
    this request body finished streaming)."""
    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"file exceeds {_MAX_UPLOAD_BYTES // (1024 * 1024)}MB")
    try:
        artifact = container.upload_media.execute(UploadMediaInput(
            artifact_id=artifact_id, placeholder_id=placeholder_id, filename=file.filename or "upload.jpg",
            content=content, content_type=file.content_type or "application/octet-stream",
        ))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    asset_urls = _resolve_asset_urls(container, [artifact])
    return artifact_out(artifact, asset_urls)
