from __future__ import annotations

import pytest

from app.domain.artifact.entities import ProviderCheckResult, ProviderId, ProviderStatus
from app.domain.ports import ProviderUnavailableError
from app.infrastructure.llm.provider_resolver import ArtifactProviderResolver


class _FakeProvider:
    def __init__(self, status: ProviderStatus, detail: str | None = None, version: str | None = None):
        self._status = status
        self.detail = detail
        self.version = version
        self.generate_calls = 0

    def check_status(self) -> ProviderCheckResult:
        return ProviderCheckResult(ProviderId.ANTHROPIC, self._status, detail=self.detail, version=self.version)

    def generate(self, request):
        self.generate_calls += 1
        return "unused"


def _resolver(anthropic_status, claude_code_status, monkeypatch, default=None):
    anthropic = _FakeProvider(anthropic_status)
    claude_code = _FakeProvider(claude_code_status)
    resolver = ArtifactProviderResolver(anthropic, claude_code)
    if default is not None:
        monkeypatch.setenv("ARTIFACT_PROVIDER", default)
    else:
        monkeypatch.delenv("ARTIFACT_PROVIDER", raising=False)
    return resolver, anthropic, claude_code


def test_explicit_provider_selection_when_connected(monkeypatch):
    resolver, anthropic, claude_code = _resolver(ProviderStatus.CONNECTED, ProviderStatus.CONNECTED, monkeypatch)
    assert resolver.resolve("claude_code") == ProviderId.CLAUDE_CODE


def test_explicit_provider_raises_when_unavailable(monkeypatch):
    resolver, anthropic, claude_code = _resolver(ProviderStatus.CONNECTED, ProviderStatus.NOT_CONFIGURED, monkeypatch)
    with pytest.raises(ProviderUnavailableError):
        resolver.resolve("claude_code")


def test_invalid_provider_name_raises(monkeypatch):
    resolver, *_ = _resolver(ProviderStatus.CONNECTED, ProviderStatus.CONNECTED, monkeypatch)
    with pytest.raises(ProviderUnavailableError):
        resolver.resolve("openai")


def test_auto_picks_configured_default_when_available(monkeypatch):
    resolver, anthropic, claude_code = _resolver(
        ProviderStatus.CONNECTED, ProviderStatus.CONNECTED, monkeypatch, default="claude_code",
    )
    assert resolver.resolve("auto") == ProviderId.CLAUDE_CODE
    assert resolver.resolve(None) == ProviderId.CLAUDE_CODE  # None behaves like "auto"


def test_auto_falls_back_when_default_is_unavailable(monkeypatch):
    resolver, anthropic, claude_code = _resolver(
        ProviderStatus.CONNECTED, ProviderStatus.NOT_CONFIGURED, monkeypatch, default="claude_code",
    )
    assert resolver.resolve("auto") == ProviderId.ANTHROPIC


def test_auto_raises_real_error_when_nothing_is_available(monkeypatch):
    resolver, *_ = _resolver(ProviderStatus.NOT_CONFIGURED, ProviderStatus.UNAVAILABLE, monkeypatch)
    with pytest.raises(ProviderUnavailableError, match="anthropic=NOT_CONFIGURED"):
        resolver.resolve("auto")


def test_default_provider_id_reads_env_live(monkeypatch):
    resolver, *_ = _resolver(ProviderStatus.CONNECTED, ProviderStatus.CONNECTED, monkeypatch)
    assert resolver.default_provider_id() == "auto"
    monkeypatch.setenv("ARTIFACT_PROVIDER", "anthropic")
    assert resolver.default_provider_id() == "anthropic"
