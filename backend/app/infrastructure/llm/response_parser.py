"""Parses a provider's raw text response into a real
ArtifactGenerationResult -- kept separate from the HTTP call so it's unit
testable with a plain string, no network involved. Never fills in a
missing field with an invented default; a response that doesn't parse
into the real schema is a real failure (raises), not a best-effort guess.
"""
from __future__ import annotations

import json
import re

from app.domain.artifact.entities import ArtifactGenerationResult, Claim, EvidenceLabel, MediaKind, MediaRequirement
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
            Claim(text=c["text"], label=EvidenceLabel(c["label"]), source_urls=c.get("source_urls", []))
            for c in data.get("claims", [])
        ]
        media = [
            MediaRequirement(placeholder_id=m["placeholder_id"], kind=MediaKind(m["kind"]), prompt=m["prompt"])
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
