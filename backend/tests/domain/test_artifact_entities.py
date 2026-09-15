from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import (
    Artifact, ArtifactJob, ArtifactJobStatus, ArtifactStatus, MediaKind, MediaRequirement, SeoMetadata,
    ValidationIssue, ValidationResult,
)
from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import ArtifactId, StoryId


def _artifact(status=ArtifactStatus.DRAFT):
    a = Artifact.draft(
        artifact_id=ArtifactId.new(), story_id=StoryId.new(), version=1, title="T", subtitle=None,
        excerpt="e", summary="s", content_html="<article><p>x</p></article>", category_id="cat-1",
        tags=[], entities=[], seo=SeoMetadata(seo_title="t", seo_description="d", slug="t"),
        sources=[], claims=[], media_requirements=[], created_at=datetime.now(timezone.utc),
    )
    a.status = status
    return a


def test_draft_starts_in_draft_status():
    assert _artifact().status == ArtifactStatus.DRAFT


def test_apply_validation_ok_moves_to_validated():
    a = _artifact()
    a.apply_validation(ValidationResult())
    assert a.status == ArtifactStatus.VALIDATED
    assert a.editorial_notes is None


def test_apply_validation_with_issues_moves_to_review_required():
    a = _artifact()
    a.apply_validation(ValidationResult(issues=[ValidationIssue("title", "empty")]))
    assert a.status == ArtifactStatus.REVIEW_REQUIRED
    assert "title" in a.editorial_notes


def test_approve_requires_validated():
    a = _artifact(ArtifactStatus.DRAFT)
    with pytest.raises(InvalidStateTransition):
        a.approve()


def test_approve_from_validated_succeeds():
    a = _artifact(ArtifactStatus.VALIDATED)
    a.approve()
    assert a.status == ArtifactStatus.APPROVED


def test_reject_from_review_required_succeeds():
    a = _artifact(ArtifactStatus.REVIEW_REQUIRED)
    a.reject("bad sourcing")
    assert a.status == ArtifactStatus.REJECTED
    assert a.editorial_notes == "bad sourcing"


def test_publish_requires_approved():
    a = _artifact(ArtifactStatus.VALIDATED)
    with pytest.raises(InvalidStateTransition):
        a.publish("news-1")


def test_publish_from_approved_succeeds():
    a = _artifact(ArtifactStatus.APPROVED)
    a.publish("news-1")
    assert a.status == ArtifactStatus.PUBLISHED
    assert a.published_news_id == "news-1"


def test_publish_twice_raises():
    a = _artifact(ArtifactStatus.PUBLISHED)
    with pytest.raises(InvalidStateTransition):
        a.publish("news-2")


def _artifact_with_media_requirement():
    a = _artifact()
    a.media_requirements = [
        MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto real"),
    ]
    return a


def test_fulfill_media_requirement_sets_asset_id():
    a = _artifact_with_media_requirement()
    a.fulfill_media_requirement("FEATURE_IMAGE", "asset-1")
    assert a.media_requirements[0].asset_id == "asset-1"


def test_fulfill_media_requirement_twice_raises():
    a = _artifact_with_media_requirement()
    a.fulfill_media_requirement("FEATURE_IMAGE", "asset-1")
    with pytest.raises(ValueError):
        a.fulfill_media_requirement("FEATURE_IMAGE", "asset-2")


def test_fulfill_unknown_media_requirement_raises():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.fulfill_media_requirement("BODY_IMAGE_01", "asset-1")


def _job(status=ArtifactJobStatus.QUEUED):
    return ArtifactJob(id="j1", story_id=StoryId.new(), status=status, created_at=datetime.now(timezone.utc))


def test_job_start_from_queued():
    j = _job()
    j.start()
    assert j.status == ArtifactJobStatus.RUNNING


def test_job_start_twice_raises():
    j = _job(ArtifactJobStatus.RUNNING)
    with pytest.raises(InvalidStateTransition):
        j.start()


def test_job_complete_without_review_required():
    j = _job(ArtifactJobStatus.RUNNING)
    j.complete(artifact_id="a1", review_required=False, finished_at=datetime.now(timezone.utc))
    assert j.status == ArtifactJobStatus.COMPLETED
    assert j.artifact_id == "a1"


def test_job_complete_with_review_required():
    j = _job(ArtifactJobStatus.RUNNING)
    j.complete(artifact_id="a1", review_required=True, finished_at=datetime.now(timezone.utc))
    assert j.status == ArtifactJobStatus.REVIEW_REQUIRED


def test_job_fail_records_real_error():
    j = _job(ArtifactJobStatus.RUNNING)
    j.fail("LLM provider unavailable", datetime.now(timezone.utc))
    assert j.status == ArtifactJobStatus.FAILED
    assert j.error == "LLM provider unavailable"
