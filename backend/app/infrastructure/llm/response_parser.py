"""Parses a provider's raw text response into a real
ArtifactGenerationResult -- kept separate from the HTTP call so it's unit
testable with a plain string, no network involved. Never fills in a
missing field with an invented default; a response that doesn't parse
into the real schema is a real failure (raises), not a best-effort guess.
"""
from __future__ import annotations

import json
import re

from app.domain.artifact.entities import (
    ArtifactGenerationResult, Claim, ClaimResolutionResult, EvidenceLabel, MediaKind, MediaRequirement, SeoFixResult,
)
from app.domain.ports import ArtifactGenerationUnavailableError

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)


def parse_artifact_response(raw_text: str) -> ArtifactGenerationResult:
    match = _JSON_BLOCK.search(raw_text)
    if not match:
        raise ArtifactGenerationUnavailableError(f"provider response contained no JSON object: {raw_text[:300]!r}")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ArtifactGenerationUnavailableError(f"provider response was not valid JSON: {exc}") from exc

    required = ["title", "excerpt", "summary", "content_html", "seo_title", "seo_description", "slug"]
    missing = [f for f in required if not data.get(f)]
    if missing:
        raise ArtifactGenerationUnavailableError(f"provider response is missing required fields: {missing}")

    try:
        claims = [
            Claim(id=f"claim-{i}", text=c["text"], label=EvidenceLabel(c["label"]), source_urls=c.get("source_urls", []))
            for i, c in enumerate(data.get("claims", []))
        ]
        media = [
            MediaRequirement(
                placeholder_id=m["placeholder_id"], kind=MediaKind(m["kind"]), prompt=m["prompt"],
                caption=m.get("caption") or None, alt_text=m.get("alt_text") or None,
            )
            for m in data.get("media_requirements", [])
        ]
    except (KeyError, ValueError) as exc:
        raise ArtifactGenerationUnavailableError(f"provider response had a malformed claim/media entry: {exc}") from exc

    return ArtifactGenerationResult(
        title=data["title"], subtitle=data.get("subtitle"), excerpt=data["excerpt"], summary=data["summary"],
        content_html=data["content_html"], category_name=data.get("category_name"),
        tags=data.get("tags", []), entities=data.get("entities", []),
        seo_title=data["seo_title"], seo_description=data["seo_description"], slug=data["slug"],
        claims=claims, media_requirements=media,
    )


def parse_seo_fix_response(raw_text: str) -> SeoFixResult:
    """Same discipline as parse_artifact_response: a response that
    doesn't parse into the real schema is a real failure, never a
    best-effort guess. `character_count` is always computed here from the
    real returned value -- the provider's own count (if it even sent one)
    is never trusted, since a wrong count would let an invalid proposal
    look like it passed the length guideline."""
    match = _JSON_BLOCK.search(raw_text)
    if not match:
        raise ArtifactGenerationUnavailableError(f"provider response contained no JSON object: {raw_text[:300]!r}")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ArtifactGenerationUnavailableError(f"provider response was not valid JSON: {exc}") from exc

    value = data.get("value")
    if not isinstance(value, str) or not value.strip():
        raise ArtifactGenerationUnavailableError(f"provider SEO-fix response is missing a real 'value': {data!r}")
    reason = data.get("reason") or ""

    return SeoFixResult(value=value, reason=reason, character_count=len(value))


def parse_claim_resolution_response(raw_text: str) -> ClaimResolutionResult:
    """Same discipline as the other parsers: a response that doesn't
    parse into the real schema is a real failure, never a best-effort
    guess. An invalid/unknown `label` is a real failure too -- never
    silently coerced to UNVERIFIED (that would hide a real provider
    contract break behind a plausible-looking fallback)."""
    match = _JSON_BLOCK.search(raw_text)
    if not match:
        raise ArtifactGenerationUnavailableError(f"provider response contained no JSON object: {raw_text[:300]!r}")
    try:
        data = json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        raise ArtifactGenerationUnavailableError(f"provider response was not valid JSON: {exc}") from exc

    try:
        label = EvidenceLabel(data["label"])
    except (KeyError, ValueError) as exc:
        raise ArtifactGenerationUnavailableError(f"provider claim-resolution response had an invalid label: {exc}") from exc

    supported = data.get("supported_by_source")
    if not isinstance(supported, bool):
        raise ArtifactGenerationUnavailableError(f"provider claim-resolution response is missing 'supported_by_source': {data!r}")

    return ClaimResolutionResult(label=label, reason=data.get("reason") or "", supported_by_source=supported)
