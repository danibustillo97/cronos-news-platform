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

from app.domain.artifact.entities import ArtifactGenerationRequest, ProviderStatus
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
