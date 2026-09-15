"""READY validation -- real, deterministic checks. This is what makes
VALIDATED mean something: "the automated pipeline actually checked this",
never "an LLM produced text". Every bound used here is a real, sourced
convention (Google's SERP title/description truncation), not an invented
threshold -- see the comment on each constant.

Pure, no I/O: `valid_category_names` is passed in by the caller (which
does have access to the real taxonomy) rather than fetched here, keeping
this module a plain function of its inputs, easy to unit test.
"""
from __future__ import annotations

import re

from app.domain.artifact.entities import Artifact, EvidenceLabel, MediaKind, ValidationIssue, ValidationResult

# Google truncates SERP titles/descriptions around these lengths in most
# cases -- widely documented creator guidance, not a number invented for
# this project (same sourcing discipline as Safe Area's platform margins).
_SEO_TITLE_MAX = 60
_SEO_DESCRIPTION_MIN = 50
_SEO_DESCRIPTION_MAX = 160

_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_ALLOWED_HTML_TAGS = {"article", "p", "h2", "h3", "ul", "ol", "li", "blockquote", "strong", "em", "a"}
_TAG_PATTERN = re.compile(r"</?([a-zA-Z0-9]+)[^>]*>")


def _check_html_structure(html: str) -> str | None:
    if "<article" not in html:
        return "content_html must be wrapped in <article>...</article>"
    if "<p" not in html:
        return "content_html has no <p> paragraphs"
    tags_found = {m.group(1).lower() for m in _TAG_PATTERN.finditer(html)}
    unknown = tags_found - _ALLOWED_HTML_TAGS
    if unknown:
        return f"content_html uses non-standard tags: {sorted(unknown)}"
    return None


def validate_artifact(artifact: Artifact, valid_category_names: set[str] | None = None) -> ValidationResult:
    issues: list[ValidationIssue] = []

    if not artifact.title.strip():
        issues.append(ValidationIssue("title", "title is empty"))
    elif len(artifact.title) > 70:
        issues.append(ValidationIssue("title", f"title is {len(artifact.title)} chars, over the 70-char SEO guideline"))

    if not artifact.excerpt.strip():
        issues.append(ValidationIssue("excerpt", "excerpt is empty"))

    if not artifact.summary.strip():
        issues.append(ValidationIssue("summary", "summary is empty"))

    html_issue = _check_html_structure(artifact.content_html)
    if html_issue:
        issues.append(ValidationIssue("content_html", html_issue))

    if not artifact.seo.seo_title.strip():
        issues.append(ValidationIssue("seo_title", "seo_title is empty"))
    elif len(artifact.seo.seo_title) > _SEO_TITLE_MAX:
        issues.append(ValidationIssue("seo_title", f"seo_title is {len(artifact.seo.seo_title)} chars, over {_SEO_TITLE_MAX}"))

    if not artifact.seo.seo_description.strip():
        issues.append(ValidationIssue("seo_description", "seo_description is empty"))
    elif not (_SEO_DESCRIPTION_MIN <= len(artifact.seo.seo_description) <= _SEO_DESCRIPTION_MAX):
        issues.append(ValidationIssue(
            "seo_description",
            f"seo_description is {len(artifact.seo.seo_description)} chars, outside {_SEO_DESCRIPTION_MIN}-{_SEO_DESCRIPTION_MAX}",
        ))

    if not _SLUG_PATTERN.match(artifact.seo.slug or ""):
        issues.append(ValidationIssue("slug", f"{artifact.seo.slug!r} is not a valid slug (lowercase, hyphens only)"))

    if not artifact.sources:
        issues.append(ValidationIssue("sources", "no sources recorded -- an Artifact must trace back to real material"))

    if artifact.category_id is None:
        issues.append(ValidationIssue("category", "no real category matched"))
    elif valid_category_names is not None and artifact.category_id not in valid_category_names:
        issues.append(ValidationIssue("category", f"{artifact.category_id!r} is not a real category"))

    unverified = [c for c in artifact.claims if c.label == EvidenceLabel.UNVERIFIED]
    if unverified:
        issues.append(ValidationIssue(
            "evidence", f"{len(unverified)} claim(s) marked UNVERIFIED -- needs editorial review before publishing",
        ))
    if not artifact.claims:
        issues.append(ValidationIssue("evidence", "no claims recorded -- nothing to trace back to sources"))

    has_feature_image_need = any(m.kind == MediaKind.FEATURE_IMAGE for m in artifact.media_requirements)
    if not has_feature_image_need:
        issues.append(ValidationIssue("multimedia", "no feature image requirement declared"))

    return ValidationResult(issues=issues)
