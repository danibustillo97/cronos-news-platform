"""READY validation -- real, deterministic checks. This is what makes
VALIDATED mean something: "the automated pipeline actually checked this",
never "an LLM produced text". Every bound used here is a real, sourced
convention (Google's SERP title/description truncation), not an invented
threshold -- see the comment on each constant.

Pure, no I/O: `valid_category_names` is passed in by the caller (which
does have access to the real taxonomy) rather than fetched here, keeping
this module a plain function of its inputs, easy to unit test.

── BLOCKING vs WARNING audit (Revisión 2.0, section 3) ─────────────────
A check is BLOCKING only when the artifact is genuinely unpublishable
without fixing it -- structurally broken, or missing something this
project's own editorial rules require before READY:
  - title/excerpt/summary/seo_title/seo_description empty -- no real
    content to publish.
  - content_html malformed -- would render broken on the real site.
  - slug invalid -- this IS the public URL; an invalid one breaks routing.
  - no sources -- "an Artifact must trace back to real material" is a
    stated editorial rule (see Artifact's own module docstring), not
    negotiable per-article.
  - no category matched/invalid -- the real site can't route/display an
    uncategorized article.
  - no claims at all -- "nothing to trace back to sources" (same rule as
    sources).
  - no feature image requirement declared -- Artifact failing to even ask
    for one is a generation defect, not an editorial judgment call.
A check is WARNING (real, shown, actionable -- never silently blocking)
when the artifact is genuinely publishable as-is and the issue is a
quality/style recommendation, or something only a human (or further real
investigation) can resolve without it being a hard requirement:
  - title/seo_title too long, seo_description out of range -- soft SEO
    style guidelines (Google truncates, it doesn't reject).
  - a claim marked UNVERIFIED -- a real editorial judgment call (accept as
    written, edit, or resolve with AI/research -- see ProposeClaimResolution);
    never something that by itself proves the article false or unpublishable.
A claim labeled SOURCE_AVAILABILITY_CLAIM (section 2) is neither -- it is
already an accurate statement about what the sources do/don't say, so it
is excluded from the "evidence" check entirely rather than downgraded to
a WARNING that would misleadingly suggest something needs resolving.
"""
from __future__ import annotations

import re
from html import unescape
from urllib.parse import urlparse

from app.domain.artifact.entities import (
    Artifact, EvidenceLabel, MediaKind, ValidationIssue, ValidationResult, ValidationSeverity,
)

_BLOCKING = ValidationSeverity.BLOCKING
_WARNING = ValidationSeverity.WARNING

# Google truncates SERP titles/descriptions around these lengths in most
# cases -- widely documented creator guidance, not a number invented for
# this project (same sourcing discipline as Safe Area's platform margins).
# Public (no leading underscore): ProposeSeoFix (application/use_cases/
# artifact.py) reuses these exact real bounds -- the AI-assist proposal
# is validated against the same source of truth, never a second copy of
# the numbers that could silently drift.
TITLE_MAX = 70
SEO_TITLE_MAX = 60
SEO_DESCRIPTION_MIN = 50
SEO_DESCRIPTION_MAX = 160

SEO_FIELD_LIMITS: dict[str, tuple[int | None, int]] = {
    "title": (None, TITLE_MAX),
    "seo_title": (None, SEO_TITLE_MAX),
    "seo_description": (SEO_DESCRIPTION_MIN, SEO_DESCRIPTION_MAX),
}

_SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
# Revisión 2.0's real editor toolbar (TiptapEditor -- underline, code
# block, inline image, link) can genuinely produce u/code/pre/img/a now;
# this allow-list is the editor's real capability set, not the narrower
# schema Artifact's own generation prompt is instructed to produce (see
# prompts.py's _RESPONSE_SCHEMA) -- a human editing by hand is allowed
# more than what the LLM is asked to generate unprompted.
# figure/figcaption (Evolución del Artifact section 6-14): a real
# BODY_IMAGE is now an actual node inside content_html, never a
# side-panel-only reference -- <figure data-placeholder-id="..."> wraps
# the img + a real reader-facing figcaption, distinct from the image's
# generation prompt (see MediaRequirement's own docstring).
_ALLOWED_HTML_TAGS = {
    "article", "p", "h2", "h3", "ul", "ol", "li", "blockquote", "strong", "em", "a", "u", "code", "pre", "img",
    "figure", "figcaption", "div", "iframe", "video", "table", "thead", "tbody", "tr", "th", "td", "colgroup", "col",
}
_TAG_PATTERN = re.compile(r"</?([a-zA-Z0-9]+)[^>]*>")
_PLACEHOLDER_PATTERN = re.compile(r'data-placeholder-id="([^"]+)"')
_IFRAME_SRC_PATTERN = re.compile(r"<iframe\b[^>]*\bsrc=[\"']([^\"']+)[\"']", re.IGNORECASE)
_VIDEO_SRC_PATTERN = re.compile(r"<video\b[^>]*\bsrc=[\"']([^\"']+)[\"']", re.IGNORECASE)
_DIV_ATTRIBUTES_PATTERN = re.compile(r"<div\b([^>]*)>", re.IGNORECASE)
_EVENT_HANDLER_PATTERN = re.compile(r"\son[a-z]+\s*=", re.IGNORECASE)
_HTML_TAG_PATTERN = re.compile(r"<[a-zA-Z][^>]*>")


def ordered_placeholder_ids(content_html: str) -> list[str]:
    """The real, single source of truth for BODY_IMAGE document order --
    same regex validate_artifact already uses for orphan/dangling-marker
    checks, exposed here so any other caller (NEXUS Studio's
    CreateStudioProject, section 29's "mantener el orden narrativo") reads
    the SAME order the article itself renders in, never a second,
    independently-computed one that could drift."""
    return _PLACEHOLDER_PATTERN.findall(content_html)


def _check_html_structure(html: str) -> str | None:
    if "<article" not in html:
        return "content_html must be wrapped in <article>...</article>"
    if "<p" not in html:
        return "content_html has no <p> paragraphs"
    tags_found = {m.group(1).lower() for m in _TAG_PATTERN.finditer(html)}
    unknown = tags_found - _ALLOWED_HTML_TAGS
    if unknown:
        return f"content_html uses non-standard tags: {sorted(unknown)}"
    if any(_EVENT_HANDLER_PATTERN.search(tag) for tag in _HTML_TAG_PATTERN.findall(html)):
        return "content_html contains an event-handler attribute"
    for attributes in _DIV_ATTRIBUTES_PATTERN.findall(html):
        if not re.fullmatch(r'\s*data-youtube-video\s*=\s*(""|\'\')\s*', attributes, re.IGNORECASE):
            return "content_html contains a div outside the supported video embed"
    for src in _IFRAME_SRC_PATTERN.findall(html):
        parsed = urlparse(unescape(src))
        if parsed.scheme != "https" or parsed.hostname not in {"www.youtube-nocookie.com", "www.youtube.com"}:
            return "content_html contains an iframe from an unsupported source"
    for src in _VIDEO_SRC_PATTERN.findall(html):
        parsed = urlparse(unescape(src))
        if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            return "content_html contains a video with an invalid source URL"
    return None


def validate_artifact(artifact: Artifact, valid_category_names: set[str] | None = None) -> ValidationResult:
    issues: list[ValidationIssue] = []

    if not artifact.title.strip():
        issues.append(ValidationIssue("title", "title is empty", _BLOCKING))
    elif len(artifact.title) > TITLE_MAX:
        issues.append(ValidationIssue(
            "title", f"title is {len(artifact.title)} chars, over the {TITLE_MAX}-char SEO guideline", _WARNING,
        ))

    if not artifact.excerpt.strip():
        issues.append(ValidationIssue("excerpt", "excerpt is empty", _BLOCKING))

    if not artifact.summary.strip():
        issues.append(ValidationIssue("summary", "summary is empty", _BLOCKING))

    html_issue = _check_html_structure(artifact.content_html)
    if html_issue:
        issues.append(ValidationIssue("content_html", html_issue, _BLOCKING))

    if not artifact.seo.seo_title.strip():
        issues.append(ValidationIssue("seo_title", "seo_title is empty", _BLOCKING))
    elif len(artifact.seo.seo_title) > SEO_TITLE_MAX:
        issues.append(ValidationIssue(
            "seo_title", f"seo_title is {len(artifact.seo.seo_title)} chars, over {SEO_TITLE_MAX}", _WARNING,
        ))

    if not artifact.seo.seo_description.strip():
        issues.append(ValidationIssue("seo_description", "seo_description is empty", _BLOCKING))
    elif not (SEO_DESCRIPTION_MIN <= len(artifact.seo.seo_description) <= SEO_DESCRIPTION_MAX):
        issues.append(ValidationIssue(
            "seo_description",
            f"seo_description is {len(artifact.seo.seo_description)} chars, outside {SEO_DESCRIPTION_MIN}-{SEO_DESCRIPTION_MAX}",
            _WARNING,
        ))

    if not _SLUG_PATTERN.match(artifact.seo.slug or ""):
        issues.append(ValidationIssue(
            "slug", f"{artifact.seo.slug!r} is not a valid slug (lowercase, hyphens only)", _BLOCKING,
        ))

    if not artifact.sources:
        issues.append(ValidationIssue(
            "sources", "no sources recorded -- an Artifact must trace back to real material", _BLOCKING,
        ))

    if artifact.category_id is None:
        issues.append(ValidationIssue("category", "no real category matched", _BLOCKING))
    elif valid_category_names is not None and artifact.category_id not in valid_category_names:
        issues.append(ValidationIssue("category", f"{artifact.category_id!r} is not a real category", _BLOCKING))

    # A claim a human editor already looked at (Artifact.mark_claim_reviewed)
    # no longer needs to keep blocking/warning the queue -- reviewing it IS
    # the editorial action this warning asks for. The label itself stays
    # honestly UNVERIFIED; only the real "needs attention" signal clears.
    # SOURCE_AVAILABILITY_CLAIM claims never enter this count at all (see
    # module docstring's audit) -- checking `== UNVERIFIED` specifically
    # is what excludes them, by construction, never a separate filter.
    unverified = [c for c in artifact.claims if c.label == EvidenceLabel.UNVERIFIED and not c.reviewed]
    if unverified:
        issues.append(ValidationIssue(
            "evidence", f"{len(unverified)} claim(s) marked UNVERIFIED -- needs editorial review before publishing",
            _WARNING,
        ))
    if not artifact.claims:
        issues.append(ValidationIssue("evidence", "no claims recorded -- nothing to trace back to sources", _BLOCKING))

    has_feature_image_need = any(m.kind == MediaKind.FEATURE_IMAGE for m in artifact.media_requirements)
    if not has_feature_image_need:
        issues.append(ValidationIssue("multimedia", "no feature image requirement declared", _BLOCKING))

    # Evolución del Artifact section 6-7: a BODY_IMAGE is only real once
    # it's an actual <figure data-placeholder-id="..."> node inside the
    # document -- a declared-but-not-embedded requirement is a real
    # inconsistency (an "orphan" the reader will never actually see),
    # not a cosmetic nit. WARNING, not BLOCKING: the editor can still
    # embed it via "+ Insertar" or remove the stray requirement, and an
    # article otherwise ready to publish shouldn't be stuck on this.
    orphaned_body_images = [
        m for m in artifact.media_requirements
        if m.kind == MediaKind.BODY_IMAGE and f'data-placeholder-id="{m.placeholder_id}"' not in artifact.content_html
    ]
    if orphaned_body_images:
        issues.append(ValidationIssue(
            "multimedia",
            f"{len(orphaned_body_images)} body image(s) declared but not embedded in the document: "
            f"{', '.join(m.placeholder_id for m in orphaned_body_images)}",
            _WARNING,
        ))

    # The reverse inconsistency: a <figure data-placeholder-id> marker that
    # doesn't correspond to any real BODY_IMAGE requirement -- a dangling
    # reference (e.g. left behind after a requirement was removed without
    # the matching marker also being deleted). WARNING, same reasoning as
    # the orphan check above: a real inconsistency, but a human can still
    # remove the stray marker or re-add the requirement.
    body_image_ids = {m.placeholder_id for m in artifact.media_requirements if m.kind == MediaKind.BODY_IMAGE}
    embedded_ids = set(_PLACEHOLDER_PATTERN.findall(artifact.content_html))
    dangling_markers = embedded_ids - body_image_ids
    if dangling_markers:
        issues.append(ValidationIssue(
            "multimedia",
            f"{len(dangling_markers)} image marker(s) in the document have no matching media requirement: "
            f"{', '.join(sorted(dangling_markers))}",
            _WARNING,
        ))

    # Evolución del Artifact section 3: the Featured Image must stay
    # explicitly outside the body -- never auto-embedded as if it were a
    # BODY_IMAGE. This is a real structural violation (the same image would
    # render twice, once as the hero and once inline), not a style nit.
    feature_ids = {m.placeholder_id for m in artifact.media_requirements if m.kind == MediaKind.FEATURE_IMAGE}
    feature_embedded_in_body = feature_ids & embedded_ids
    if feature_embedded_in_body:
        issues.append(ValidationIssue(
            "multimedia",
            f"feature image marker(s) found inside the body, must stay separate: {', '.join(sorted(feature_embedded_in_body))}",
            _WARNING,
        ))

    return ValidationResult(issues=issues)
