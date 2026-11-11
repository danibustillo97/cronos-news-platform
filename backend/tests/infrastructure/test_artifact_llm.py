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

from app.domain.artifact.entities import (
    ArtifactGenerationRequest, ClaimResolutionRequest, EvidenceLabel, SeoFixRequest, SourceMaterial,
)
from app.domain.ports import ArtifactGenerationUnavailableError
from app.infrastructure.llm.anthropic_adapter import AnthropicArtifactGenerator
from app.infrastructure.llm.prompts import build_artifact_prompt, build_claim_resolution_prompt, build_seo_fix_prompt
from app.infrastructure.llm.response_parser import (
    parse_artifact_response, parse_claim_resolution_response, parse_seo_fix_response,
)


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


# ── ÚLTIMO BLOQUE ANTES DE PUBLISH: Artifact must produce the body image
# as a real block placed inside content_html, never metadata only. ──────

def test_prompt_requires_embedding_body_images_at_the_right_position():
    prompt = build_artifact_prompt(_request())
    assert "data-placeholder-id" in prompt
    assert "never having to insert them by hand" in prompt


def test_prompt_requires_a_context_derived_body_image_prompt_not_a_generic_one():
    prompt = build_artifact_prompt(_request())
    assert "never a generic photo of the" in prompt


def test_prompt_requires_matching_placeholder_ids_both_ways():
    prompt = build_artifact_prompt(_request())
    assert "MUST have exactly one matching" in prompt


def test_prompt_forbids_the_feature_image_inside_the_body():
    prompt = build_artifact_prompt(_request())
    assert "feature image is never part of the body" in prompt


def test_prompt_requires_caption_prompt_alt_text_to_stay_distinct():
    prompt = build_artifact_prompt(_request())
    assert "must never be interchangeable copies of each other" in prompt


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


def test_parse_extracts_body_image_caption_alt_text_and_placement():
    response = dict(_VALID_RESPONSE)
    response["content_html"] = (
        '<article><p>Primer párrafo real.</p>'
        '<figure data-placeholder-id="body_image_1"></figure>'
        '<p>Otro párrafo.</p></article>'
    )
    response["media_requirements"] = [
        {"placeholder_id": "FEATURE_IMAGE", "kind": "FEATURE_IMAGE", "prompt": "Foto del estadio", "alt_text": "Estadio lleno"},
        {
            "placeholder_id": "body_image_1", "kind": "BODY_IMAGE",
            "prompt": "Nivel del embalse visto desde la orilla, cielo nublado",
            "caption": "El embalse muestra niveles históricamente bajos.",
            "alt_text": "Fotografía del embalse con el nivel de agua bajo",
        },
    ]
    result = parse_artifact_response(json.dumps(response))
    body_image = next(m for m in result.media_requirements if m.placeholder_id == "body_image_1")
    assert body_image.caption == "El embalse muestra niveles históricamente bajos."
    assert body_image.alt_text == "Fotografía del embalse con el nivel de agua bajo"
    assert body_image.prompt != body_image.caption  # never conflated
    assert 'data-placeholder-id="body_image_1"' in result.content_html  # real placement, not metadata only


def test_parse_defaults_caption_and_alt_text_to_none_when_absent():
    result = parse_artifact_response(json.dumps(_VALID_RESPONSE))
    assert result.media_requirements[0].caption is None
    assert result.media_requirements[0].alt_text is None


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


# ── check_status(): Provider Control Plane ──────────────────────────────

def test_check_status_not_configured_without_key(monkeypatch):
    from app.domain.artifact.entities import ProviderStatus

    generator = AnthropicArtifactGenerator(api_key=None)
    result = generator.check_status()
    assert result.status == ProviderStatus.NOT_CONFIGURED
    assert "ANTHROPIC_API_KEY" in (result.detail or "")


def test_check_status_connected_on_real_200(monkeypatch):
    from app.domain.artifact.entities import ProviderStatus
    import httpx as httpx_module

    class _Resp:
        status_code = 200
        text = "{}"

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-real-key-value")
    result = generator.check_status()
    assert result.status == ProviderStatus.CONNECTED
    # the key itself is never echoed back anywhere in the result
    assert "sk-real-key-value" not in (result.detail or "") and "sk-real-key-value" not in (result.version or "")


def test_check_status_auth_error_on_401(monkeypatch):
    from app.domain.artifact.entities import ProviderStatus
    import httpx as httpx_module

    class _Resp:
        status_code = 401
        text = "unauthorized"

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-invalid")
    result = generator.check_status()
    assert result.status == ProviderStatus.AUTH_ERROR


def test_check_status_unavailable_on_connection_error(monkeypatch):
    from app.domain.artifact.entities import ProviderStatus
    import httpx as httpx_module

    def _raise(*a, **k):
        raise httpx_module.ConnectError("refused")

    monkeypatch.setattr(httpx_module, "post", _raise)
    generator = AnthropicArtifactGenerator(api_key="sk-real")
    result = generator.check_status()
    assert result.status == ProviderStatus.UNAVAILABLE


# ── Section 5: "Corregir con IA" -- suggest_seo_fix ─────────────────────

def _seo_fix_request(field="title", current_text="x" * 82, max_length=70):
    return SeoFixRequest(
        field=field, current_text=current_text, min_length=None, max_length=max_length,
        story_headline="Un evento real que ocurrió", excerpt="Un resumen breve y real del evento.",
    )


def test_seo_fix_prompt_includes_real_current_value_and_bounds():
    prompt = build_seo_fix_prompt(_seo_fix_request())
    assert "x" * 82 in prompt
    assert "at most 70 characters" in prompt
    assert "Un evento real que ocurrió" in prompt


def test_seo_fix_prompt_states_min_and_max_when_a_range_exists():
    request = SeoFixRequest(
        field="seo_description", current_text="corta", min_length=50, max_length=160,
        story_headline="H", excerpt="E",
    )
    prompt = build_seo_fix_prompt(request)
    assert "between 50 and 160 characters" in prompt


def test_seo_fix_prompt_forbids_inventing_meaning():
    prompt = build_seo_fix_prompt(_seo_fix_request())
    assert "never invent" in prompt.lower()
    assert "targeted rewrite" in prompt.lower()


def test_seo_fix_prompt_with_an_instruction_uses_the_real_editorial_angle():
    request = SeoFixRequest(
        field="title", current_text="Un título cualquiera", min_length=None, max_length=70,
        story_headline="Un evento real", excerpt="Un resumen real.", instruction="más impacto",
    )
    prompt = build_seo_fix_prompt(request)
    assert "más impacto" in prompt
    assert "length guideline" not in prompt  # framed as a real editorial request, not a violation


_VALID_SEO_FIX_RESPONSE = {"value": "Un título corregido y corto", "reason": "Se acortó preservando el sentido original."}


def test_parse_seo_fix_valid_response():
    result = parse_seo_fix_response(json.dumps(_VALID_SEO_FIX_RESPONSE))
    assert result.value == "Un título corregido y corto"
    assert result.reason == "Se acortó preservando el sentido original."
    assert result.character_count == len("Un título corregido y corto")


def test_parse_seo_fix_never_trusts_a_provider_supplied_character_count():
    # Even if the provider sends a wrong count, the real one (len(value))
    # is what's returned -- never the provider's own arithmetic.
    payload = dict(_VALID_SEO_FIX_RESPONSE, character_count=999999)
    result = parse_seo_fix_response(json.dumps(payload))
    assert result.character_count == len(_VALID_SEO_FIX_RESPONSE["value"])


def test_parse_seo_fix_raises_on_missing_value():
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_seo_fix_response(json.dumps({"reason": "sin valor real"}))


def test_parse_seo_fix_raises_on_empty_value():
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_seo_fix_response(json.dumps({"value": "   ", "reason": "x"}))


def test_parse_seo_fix_raises_on_non_json_text():
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_seo_fix_response("no json here at all")


def test_suggest_seo_fix_fails_honestly_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    generator = AnthropicArtifactGenerator(api_key=None)
    with pytest.raises(ArtifactGenerationUnavailableError, match="not configured"):
        generator.suggest_seo_fix(_seo_fix_request())


def test_suggest_seo_fix_returns_a_real_proposal(monkeypatch):
    import httpx as httpx_module

    class _Resp:
        status_code = 200
        text = "ok"

        def json(self):
            return {"content": [{"type": "text", "text": json.dumps(_VALID_SEO_FIX_RESPONSE)}]}

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-real-key-value")
    result = generator.suggest_seo_fix(_seo_fix_request())

    assert result.value == "Un título corregido y corto"
    assert result.character_count == len(result.value)


def test_suggest_seo_fix_never_leaks_the_api_key_on_a_provider_error(monkeypatch):
    import httpx as httpx_module

    class _Resp:
        status_code = 401
        text = "unauthorized: bad key"

        def json(self):
            return {}

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-super-secret-value")
    with pytest.raises(ArtifactGenerationUnavailableError) as exc_info:
        generator.suggest_seo_fix(_seo_fix_request())
    assert "sk-super-secret-value" not in str(exc_info.value)


def test_suggest_seo_fix_raises_on_network_error(monkeypatch):
    import httpx as httpx_module

    def _raise(*a, **k):
        raise httpx_module.ConnectError("refused")

    monkeypatch.setattr(httpx_module, "post", _raise)
    generator = AnthropicArtifactGenerator(api_key="sk-real")
    with pytest.raises(ArtifactGenerationUnavailableError):
        generator.suggest_seo_fix(_seo_fix_request())


# ── Revisión 2.0 sections 1/2/4: "Resolver con IA" for a claim ──────────

def _claim_resolution_request(claim_text="El marcador final no se especifica en las fuentes disponibles."):
    return ClaimResolutionRequest(
        claim_text=claim_text,
        source_text="El equipo local ganó el primer partido de la serie. La fecha del segundo no fue confirmada.",
        story_headline="Un evento real",
    )


def test_claim_resolution_prompt_includes_the_real_claim_and_source_text():
    prompt = build_claim_resolution_prompt(_claim_resolution_request())
    assert "El marcador final no se especifica" in prompt
    assert "La fecha del segundo no fue confirmada" in prompt


def test_claim_resolution_prompt_explains_the_real_distinction():
    prompt = build_claim_resolution_prompt(_claim_resolution_request())
    assert "SOURCE_AVAILABILITY_CLAIM" in prompt
    assert "fabricating evidence" in prompt


_VALID_CLAIM_RESOLUTION_RESPONSE = {
    "label": "SOURCE_AVAILABILITY_CLAIM", "reason": "La fuente no menciona el marcador final.", "supported_by_source": True,
}


def test_parse_claim_resolution_valid_response():
    result = parse_claim_resolution_response(json.dumps(_VALID_CLAIM_RESOLUTION_RESPONSE))
    assert result.label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert result.supported_by_source is True


def test_parse_claim_resolution_raises_on_invalid_label():
    broken = dict(_VALID_CLAIM_RESOLUTION_RESPONSE, label="TOTALLY_MADE_UP_LABEL")
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_claim_resolution_response(json.dumps(broken))


def test_parse_claim_resolution_raises_on_missing_supported_flag():
    broken = {"label": "UNVERIFIED", "reason": "x"}
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_claim_resolution_response(json.dumps(broken))


def test_parse_claim_resolution_raises_on_non_json_text():
    with pytest.raises(ArtifactGenerationUnavailableError):
        parse_claim_resolution_response("no json here at all")


def test_resolve_claim_fails_honestly_without_api_key(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    generator = AnthropicArtifactGenerator(api_key=None)
    with pytest.raises(ArtifactGenerationUnavailableError, match="not configured"):
        generator.resolve_claim(_claim_resolution_request())


def test_resolve_claim_returns_a_real_proposal(monkeypatch):
    import httpx as httpx_module

    class _Resp:
        status_code = 200
        text = "ok"

        def json(self):
            return {"content": [{"type": "text", "text": json.dumps(_VALID_CLAIM_RESOLUTION_RESPONSE)}]}

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-real-key-value")
    result = generator.resolve_claim(_claim_resolution_request())

    assert result.label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert result.supported_by_source is True


def test_resolve_claim_never_leaks_the_api_key_on_a_provider_error(monkeypatch):
    import httpx as httpx_module

    class _Resp:
        status_code = 401
        text = "unauthorized: bad key"

        def json(self):
            return {}

    monkeypatch.setattr(httpx_module, "post", lambda *a, **k: _Resp())
    generator = AnthropicArtifactGenerator(api_key="sk-super-secret-value")
    with pytest.raises(ArtifactGenerationUnavailableError) as exc_info:
        generator.resolve_claim(_claim_resolution_request())
    assert "sk-super-secret-value" not in str(exc_info.value)
