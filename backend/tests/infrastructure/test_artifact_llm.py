"""Unit tests for prompt construction and response parsing -- no network
calls, no real API key needed. The actual HTTP adapter (AnthropicArtifact
Generator) is exercised only for its "no API key configured" real-failure
path, since a live call needs real credentials this environment doesn't
have (see docs/NEXUS_DEPLOYMENT_ARCHITECTURE.md).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone

import pytest

from app.domain.artifact.entities import ArtifactGenerationRequest, SourceMaterial
from app.domain.ports import ArtifactGenerationUnavailableError
from app.infrastructure.llm.anthropic_adapter import AnthropicArtifactGenerator
from app.infrastructure.llm.prompts import build_artifact_prompt
from app.infrastructure.llm.response_parser import parse_artifact_response


def _request():
    return ArtifactGenerationRequest(
        story_headline="Un evento real",
        sources=[SourceMaterial(
            source_url="https://example.com/a", source_name="Example", source_domain="example.com",
            title="Título fuente", raw_text="Contenido real de la fuente.",
            published_at=None, retrieved_at=datetime.now(timezone.utc),
        )],
        available_category_names=["Fútbol", "Tecnología"],
    )


def test_prompt_includes_real_sources_and_categories_not_invented_ones():
    prompt = build_artifact_prompt(_request())
    assert "https://example.com/a" in prompt
    assert "Contenido real de la fuente." in prompt
    assert "Fútbol, Tecnología" in prompt
    assert "Un evento real" in prompt


def test_prompt_states_the_no_invent_rules():
    prompt = build_artifact_prompt(_request())
    assert "Do not invent" in prompt
    assert "UNVERIFIED" in prompt


_VALID_RESPONSE = {
    "title": "Un título original", "subtitle": "Subtítulo", "excerpt": "Extracto",
    "summary": "Resumen", "content_html": "<article><p>Texto real.</p></article>",
    "category_name": "Fútbol", "tags": ["futbol"], "entities": ["River Plate"],
    "seo_title": "Título SEO", "seo_description": "Descripción SEO suficientemente larga para pasar la validación real.",
    "slug": "un-titulo-original",
    "claims": [{"text": "River ganó", "label": "SOURCE_FACT", "source_urls": ["https://example.com/a"]}],
    "media_requirements": [{"placeholder_id": "FEATURE_IMAGE", "kind": "FEATURE_IMAGE", "prompt": "Foto del estadio"}],
}


def test_parse_valid_json_response():
    result = parse_artifact_response(json.dumps(_VALID_RESPONSE))
    assert result.title == "Un título original"
    assert result.claims[0].label.value == "SOURCE_FACT"
    assert result.media_requirements[0].kind.value == "FEATURE_IMAGE"


def test_parse_extracts_json_even_with_surrounding_prose():
    text = "Here is the result:\n" + json.dumps(_VALID_RESPONSE) + "\nHope this helps!"
    result = parse_artifact_response(text)
    assert result.title == "Un título original"


def test_parse_raises_on_missing_required_field():
    broken = dict(_VALID_RESPONSE)
    del broken["title"]
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_artifact_response(json.dumps(broken))


def test_parse_raises_on_invalid_evidence_label():
    broken = dict(_VALID_RESPONSE)
    broken["claims"] = [{"text": "x", "label": "TOTALLY_MADE_UP_LABEL", "source_urls": []}]
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_artifact_response(json.dumps(broken))


def test_parse_raises_on_non_json_text():
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_artifact_response("no json here at all")


def test_adapter_fails_honestly_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    generator = AnthropicArtifactGenerator(api_key=None)
    with pytest.raises(ArtifactGenerationUnavailableError, match="not configured"):
        generator.generate(_request())
