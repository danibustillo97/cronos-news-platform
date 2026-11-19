"""Real interface, mocked subprocess: never invokes the actual `claude`
binary in tests -- shutil.which and subprocess.run are both monkeypatched,
so these tests are fast and don't depend on this machine having Claude
Code installed. The real, live end-to-end check (this session confirmed
`claude auth status` really returns {"loggedIn": true, ...}) was done
manually, not here.
"""
from __future__ import annotations

import json

import pytest

from app.domain.artifact.entities import (
    ArtifactGenerationRequest, ClaimResolutionRequest, EvidenceLabel, ProviderStatus, SeoFixRequest,
)
from app.domain.ports import ArtifactGenerationUnavailableError
from app.infrastructure.llm import claude_code_adapter as module
from app.infrastructure.llm.claude_code_adapter import ClaudeCodeArtifactGenerator


class _Proc:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


def _request():
    return ArtifactGenerationRequest(story_headline="Un evento real", sources=[], available_category_names=[])


def test_check_status_unavailable_when_binary_missing(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    monkeypatch.delenv("CLAUDE_CODE_BINARY", raising=False)
    result = ClaudeCodeArtifactGenerator().check_status()
    assert result.status == ProviderStatus.UNAVAILABLE


def test_check_status_connected_when_logged_in(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            return _Proc(returncode=0, stdout="2.1.273 (Claude Code)\n")
        if "auth" in cmd:
            return _Proc(returncode=0, stdout=json.dumps({"loggedIn": True, "authMethod": "claude.ai", "email": "user@example.com"}))
        raise AssertionError(f"unexpected command {cmd}")

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    result = ClaudeCodeArtifactGenerator().check_status()

    assert result.status == ProviderStatus.CONNECTED
    assert result.version == "2.1.273 (Claude Code)"
    # PII from `claude auth status` (email) must never leak into the result
    assert "user@example.com" not in (result.detail or "")


def test_check_status_auth_error_when_not_logged_in(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")

    def fake_run(cmd, **kwargs):
        if "--version" in cmd:
            return _Proc(returncode=0, stdout="2.1.273\n")
        return _Proc(returncode=0, stdout=json.dumps({"loggedIn": False}))

    monkeypatch.setattr(module.subprocess, "run", fake_run)
    result = ClaudeCodeArtifactGenerator().check_status()
    assert result.status == ProviderStatus.AUTH_ERROR


def test_generate_raises_when_binary_missing(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    monkeypatch.delenv("CLAUDE_CODE_BINARY", raising=False)
    with pytest.raises(ArtifactGenerationUnavailableError, match="no está instalado"):
        ClaudeCodeArtifactGenerator().generate(_request())


def test_generate_parses_real_cli_json_contract(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    payload = {
        "title": "Un título real", "subtitle": None, "excerpt": "Extracto", "summary": "Resumen",
        "content_html": "<article><p>Contenido real de al menos un párrafo.</p></article>",
        "category_name": None, "tags": [], "entities": [], "seo_title": "SEO", "seo_description": "Descripción SEO real de largo razonable para pasar validación.",
        "slug": "un-titulo-real", "claims": [], "media_requirements": [],
    }
    cli_response = {"is_error": False, "result": json.dumps(payload)}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))

    result = ClaudeCodeArtifactGenerator().generate(_request())
    assert result.title == "Un título real"


def test_generate_raises_on_cli_reported_error(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    cli_response = {"is_error": True, "result": "algo salió mal"}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ClaudeCodeArtifactGenerator().generate(_request())


# ── Section 5: "Corregir con IA" -- suggest_seo_fix via the CLI ─────────

def _seo_fix_request():
    return SeoFixRequest(
        field="title", current_text="x" * 82, min_length=None, max_length=70,
        story_headline="Un evento real", excerpt="Un resumen real.",
    )


def test_suggest_seo_fix_raises_when_binary_missing(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    monkeypatch.delenv("CLAUDE_CODE_BINARY", raising=False)
    with pytest.raises(ArtifactGenerationUnavailableError, match="no está instalado"):
        ClaudeCodeArtifactGenerator().suggest_seo_fix(_seo_fix_request())


def test_suggest_seo_fix_parses_real_cli_json_contract(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    payload = {"value": "Un título corregido", "reason": "Se acortó preservando el sentido."}
    cli_response = {"is_error": False, "result": json.dumps(payload)}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))

    result = ClaudeCodeArtifactGenerator().suggest_seo_fix(_seo_fix_request())
    assert result.value == "Un título corregido"
    assert result.character_count == len("Un título corregido")


def test_suggest_seo_fix_raises_on_cli_reported_error(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    cli_response = {"is_error": True, "result": "algo salió mal"}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ClaudeCodeArtifactGenerator().suggest_seo_fix(_seo_fix_request())


# ── Revisión 2.0 sections 1/2/4: "Resolver con IA" for a claim via the CLI

def _claim_resolution_request():
    return ClaimResolutionRequest(
        claim_text="La fecha exacta no está especificada en las fuentes disponibles.",
        source_text="El equipo local ganó el primer partido.", story_headline="Un evento real",
    )


def test_resolve_claim_raises_when_binary_missing(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: None)
    monkeypatch.delenv("CLAUDE_CODE_BINARY", raising=False)
    with pytest.raises(ArtifactGenerationUnavailableError, match="no está instalado"):
        ClaudeCodeArtifactGenerator().resolve_claim(_claim_resolution_request())


def test_resolve_claim_parses_real_cli_json_contract(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    payload = {"label": "SOURCE_AVAILABILITY_CLAIM", "reason": "La fuente no menciona la fecha.", "supported_by_source": True}
    cli_response = {"is_error": False, "result": json.dumps(payload)}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))

    result = ClaudeCodeArtifactGenerator().resolve_claim(_claim_resolution_request())
    assert result.label == EvidenceLabel.SOURCE_AVAILABILITY_CLAIM
    assert result.supported_by_source is True


def test_resolve_claim_raises_on_cli_reported_error(monkeypatch):
    monkeypatch.setattr(module.shutil, "which", lambda name: "/usr/bin/claude")
    cli_response = {"is_error": True, "result": "algo salió mal"}
    monkeypatch.setattr(module.subprocess, "run", lambda cmd, **kwargs: _Proc(returncode=0, stdout=json.dumps(cli_response)))
    with pytest.raises(ArtifactGenerationUnavailableError):
        ClaudeCodeArtifactGenerator().resolve_claim(_claim_resolution_request())
