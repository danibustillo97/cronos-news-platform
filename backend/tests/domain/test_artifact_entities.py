from dataclasses import replace
from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import (
    Artifact, ArtifactJob, ArtifactJobStatus, ArtifactStatus, Claim, EvidenceLabel, MediaKind, MediaRequirement,
    SeoMetadata, ValidationIssue, ValidationResult,
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


def test_fulfilling_media_requirement_twice_replaces_the_asset():
    # Deliberate real capability, not a bug: "Reemplazar" in the Revisión
    # workspace re-fulfills the same requirement with a new asset.
    a = _artifact_with_media_requirement()
    a.fulfill_media_requirement("FEATURE_IMAGE", "asset-1")
    a.fulfill_media_requirement("FEATURE_IMAGE", "asset-2")
    requirement = next(m for m in a.media_requirements if m.placeholder_id == "FEATURE_IMAGE")
    assert requirement.asset_id == "asset-2"


def test_fulfill_unknown_media_requirement_raises():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.fulfill_media_requirement("BODY_IMAGE_01", "asset-1")


def test_update_media_prompt_changes_only_that_requirement():
    a = _artifact_with_media_requirement()
    a.media_requirements.append(MediaRequirement(placeholder_id="BODY_IMAGE_01", kind=MediaKind.BODY_IMAGE, prompt="Otra foto"))
    a.update_media_prompt("FEATURE_IMAGE", "Nuevo prompt editorial")
    by_id = {m.placeholder_id: m for m in a.media_requirements}
    assert by_id["FEATURE_IMAGE"].prompt == "Nuevo prompt editorial"
    assert by_id["BODY_IMAGE_01"].prompt == "Otra foto"


def test_update_media_prompt_unknown_requirement_raises():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.update_media_prompt("BODY_IMAGE_99", "x")


# ── Evolución del Artifact section 8/13: caption/alt persist, distinct
# from the generation prompt ─────────────────────────────────────────

def test_update_media_caption_and_alt_are_independent_of_prompt():
    a = _artifact_with_media_requirement()
    a.update_media_prompt("FEATURE_IMAGE", caption="Vista del estadio al atardecer", alt_text="Estadio lleno de hinchas")
    req = a.media_requirements[0]
    assert req.caption == "Vista del estadio al atardecer"
    assert req.alt_text == "Estadio lleno de hinchas"
    assert req.prompt == "Foto real"  # untouched -- prompt/caption/alt never conflated


def test_update_media_caption_can_be_explicitly_cleared():
    a = _artifact_with_media_requirement()
    a.update_media_prompt("FEATURE_IMAGE", caption="Algo")
    a.update_media_prompt("FEATURE_IMAGE", caption=None)
    assert a.media_requirements[0].caption is None


# ── Evolución del Artifact section 11: add/remove a real BODY_IMAGE
# block -- never touching FEATURE_IMAGE ──────────────────────────────

def test_add_media_requirement_appends_a_new_body_image():
    a = _artifact_with_media_requirement()
    a.add_media_requirement("BODY_IMAGE_01", MediaKind.BODY_IMAGE, prompt="Foto del embalse")
    by_id = {m.placeholder_id: m for m in a.media_requirements}
    assert by_id["BODY_IMAGE_01"].kind == MediaKind.BODY_IMAGE
    assert by_id["BODY_IMAGE_01"].asset_id is None
    assert by_id["FEATURE_IMAGE"].prompt == "Foto real"  # untouched


def test_add_media_requirement_rejects_a_second_featured_image():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.add_media_requirement("FEATURE_IMAGE_2", MediaKind.FEATURE_IMAGE)


def test_add_media_requirement_rejects_a_duplicate_placeholder_id():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.add_media_requirement("FEATURE_IMAGE", MediaKind.BODY_IMAGE)


def test_remove_media_requirement_removes_only_that_body_image():
    a = _artifact_with_media_requirement()
    a.add_media_requirement("BODY_IMAGE_01", MediaKind.BODY_IMAGE)
    a.add_media_requirement("BODY_IMAGE_02", MediaKind.BODY_IMAGE)
    a.remove_media_requirement("BODY_IMAGE_01")
    ids = {m.placeholder_id for m in a.media_requirements}
    assert ids == {"FEATURE_IMAGE", "BODY_IMAGE_02"}


def test_remove_media_requirement_rejects_the_featured_image():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.remove_media_requirement("FEATURE_IMAGE")


def test_remove_media_requirement_unknown_raises():
    a = _artifact_with_media_requirement()
    with pytest.raises(ValueError):
        a.remove_media_requirement("BODY_IMAGE_99")


# ── ÚLTIMO BLOQUE ANTES DE PUBLISH: placement lives exclusively in
# content_html -- fulfilling/replacing/removing a requirement's ASSET
# must never itself move or touch that placement. ───────────────────────

def _artifact_with_embedded_body_image():
    a = _artifact()
    a.content_html = (
        '<article><p>Primer párrafo.</p>'
        '<figure data-placeholder-id="body_image_1"></figure>'
        '<p>Otro párrafo.</p></article>'
    )
    a.media_requirements = [
        MediaRequirement(placeholder_id="FEATURE_IMAGE", kind=MediaKind.FEATURE_IMAGE, prompt="Foto real"),
        MediaRequirement(placeholder_id="body_image_1", kind=MediaKind.BODY_IMAGE, prompt="Foto del embalse"),
    ]
    return a


def test_fulfilling_a_body_image_never_touches_the_documents_placement():
    a = _artifact_with_embedded_body_image()
    original_html = a.content_html
    a.fulfill_media_requirement("body_image_1", "asset-1")
    assert a.content_html == original_html  # position is untouched -- only the asset changed


def test_replacing_a_body_images_asset_never_touches_the_documents_placement():
    a = _artifact_with_embedded_body_image()
    a.fulfill_media_requirement("body_image_1", "asset-1")
    original_html = a.content_html
    a.fulfill_media_requirement("body_image_1", "asset-2")  # "Reemplazar"
    assert a.content_html == original_html
    assert a.media_requirements[1].asset_id == "asset-2"


def test_removing_a_body_image_requirement_leaves_the_marker_for_the_editor_to_clean_up():
    """remove_media_requirement is the real counterpart to add -- it
    removes the NEED, never silently rewrites content_html itself (that
    would be a second place mutating the one real document; the editor's
    own deleteNode()+Guardar is what removes the marker, see
    EditorialImageView.tsx). The resulting dangling marker is exactly
    what validate_artifact's own dangling-marker check now catches."""
    a = _artifact_with_embedded_body_image()
    a.remove_media_requirement("body_image_1")
    assert 'data-placeholder-id="body_image_1"' in a.content_html  # marker itself is a document edit, not this method's job
    assert all(m.placeholder_id != "body_image_1" for m in a.media_requirements)


def _artifact_with_claim(reviewed=False):
    a = _artifact()
    a.claims = [Claim(id="claim-1", text="Algo pasó", label=EvidenceLabel.UNVERIFIED, reviewed=reviewed)]
    return a


def test_mark_claim_reviewed_sets_flag():
    a = _artifact_with_claim(reviewed=False)
    a.mark_claim_reviewed("claim-1", True)
    assert a.claims[0].reviewed is True
    # The evidence label itself is untouched -- reviewing is not re-verifying.
    assert a.claims[0].label == EvidenceLabel.UNVERIFIED


def test_mark_claim_reviewed_unknown_claim_raises():
    a = _artifact_with_claim()
    with pytest.raises(ValueError):
        a.mark_claim_reviewed("claim-99")


def test_mark_claim_reviewed_can_apply_a_real_reclassification():
    """Section 2/4: accepting a ProposeClaimResolution proposal reuses
    this same method with label/source_urls set -- never a second write
    path."""
    a = _artifact_with_claim(reviewed=False)
    a.mark_claim_reviewed(
        "claim-1", reviewed=True, label=EvidenceLabel.SOURCE_AVAILABILITY_CLAIM, source_urls=["https://example.com/a"],
    )
    assert a.claims[0].label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert a.claims[0].source_urls == ["https://example.com/a"]
    assert a.claims[0].reviewed is True


def test_mark_claim_reviewed_without_label_leaves_label_and_sources_untouched():
    a = _artifact_with_claim(reviewed=False)
    a.claims[0] = replace(a.claims[0], source_urls=["https://example.com/original"])
    a.mark_claim_reviewed("claim-1", reviewed=True)
    assert a.claims[0].label == EvidenceLabel.UNVERIFIED
    assert a.claims[0].source_urls == ["https://example.com/original"]


def test_update_editorial_fields_patches_only_provided_fields():
    a = _artifact()
    original_excerpt = a.excerpt
    a.update_editorial_fields(title="Nuevo título")
    assert a.title == "Nuevo título"
    assert a.excerpt == original_excerpt  # untouched


def test_update_editorial_fields_can_explicitly_clear_nullable_subtitle():
    a = _artifact()
    a.subtitle = "Algo"
    a.update_editorial_fields(subtitle=None)
    assert a.subtitle is None


def test_update_editorial_fields_updates_seo_partially():
    a = _artifact()
    original_slug = a.seo.slug
    a.update_editorial_fields(seo_title="Nuevo título SEO")
    assert a.seo.seo_title == "Nuevo título SEO"
    assert a.seo.slug == original_slug  # untouched


def test_update_editorial_fields_blocked_once_published():
    a = _artifact(ArtifactStatus.APPROVED)
    a.publish("news-1")
    with pytest.raises(InvalidStateTransition):
        a.update_editorial_fields(title="Intento de edición tardía")


def test_apply_validation_ok_with_only_warnings_still_moves_to_validated():
    """Section 7's real fix: WARNING issues are real and kept (shown to
    the editor), but never gate VALIDATED -- only a BLOCKING one does."""
    a = _artifact()
    from app.domain.artifact.entities import ValidationSeverity
    result = ValidationResult(issues=[ValidationIssue("title", "over the guideline", ValidationSeverity.WARNING)])
    a.apply_validation(result)
    assert a.status == ArtifactStatus.VALIDATED
    assert a.validation.issues  # the warning itself is not discarded


def test_archive_from_review_required_succeeds():
    a = _artifact(ArtifactStatus.REVIEW_REQUIRED)
    a.archive()
    assert a.status == ArtifactStatus.ARCHIVED


def test_archive_from_validated_succeeds():
    a = _artifact(ArtifactStatus.VALIDATED)
    a.archive()
    assert a.status == ArtifactStatus.ARCHIVED


def test_archive_blocked_once_published():
    a = _artifact(ArtifactStatus.APPROVED)
    a.publish("news-1")
    with pytest.raises(InvalidStateTransition):
        a.archive()


def test_archive_twice_raises():
    a = _artifact(ArtifactStatus.REVIEW_REQUIRED)
    a.archive()
    with pytest.raises(InvalidStateTransition):
        a.archive()


def _job(status=ArtifactJobStatus.QUEUED):
    return ArtifactJob(id="j1", story_id=StoryId.new(), status=status, created_at=datetime.now(timezone.utc))


def test_job_start_from_queued():
    j = _job()
    j.start()
    assert j.status == ArtifactJobStatus.RUNNING
    assert j.started_at is not None


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


def test_job_complete_records_validation_snapshot():
    j = _job(ArtifactJobStatus.RUNNING)
    j.complete(
        artifact_id="a1", review_required=False, finished_at=datetime.now(timezone.utc),
        validation_ok=True, validation_issue_count=2,
    )
    assert j.validation_ok is True
    assert j.validation_issue_count == 2


def test_job_fail_records_real_error():
    j = _job(ArtifactJobStatus.RUNNING)
    j.fail("LLM provider unavailable", datetime.now(timezone.utc))
    assert j.status == ArtifactJobStatus.FAILED
    assert j.error == "LLM provider unavailable"
