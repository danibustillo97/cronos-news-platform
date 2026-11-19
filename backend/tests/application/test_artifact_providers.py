from __future__ import annotations

import pytest

from app.domain.artifact.entities import ProviderCheckResult, ProviderId, ProviderStatus
from app.application.use_cases.artifact_providers import (
    CheckArtifactProvider, ClearProviderApiKey, ListArtifactProviders, SetDefaultArtifactProvider,
    SetProviderApiKey,
)


class _FakeProvider:
    def __init__(self, provider_id, status):
        self._provider_id = provider_id
        self._status = status

    def check_status(self):
        return ProviderCheckResult(self._provider_id, self._status)

    def generate(self, request):
        raise AssertionError("not exercised here")


class FakeResolver:
    def __init__(self, anthropic_status=ProviderStatus.CONNECTED, claude_code_status=ProviderStatus.NOT_CONFIGURED, default="anthropic"):
        self._providers = {
            ProviderId.ANTHROPIC: _FakeProvider(ProviderId.ANTHROPIC, anthropic_status),
            ProviderId.CLAUDE_CODE: _FakeProvider(ProviderId.CLAUDE_CODE, claude_code_status),
        }
        self._default = default

    def all_providers(self):
        return dict(self._providers)

    def get(self, provider_id):
        return self._providers[provider_id]

    def default_provider_id(self):
        return self._default

    def resolve(self, requested):
        raise AssertionError("not exercised here")


class FakeCredentialsStore:
    def __init__(self):
        self.keys = {}
        self.default = None

    def has_key(self, provider_id):
        return provider_id in self.keys

    def set_key(self, provider_id, value):
        self.keys[provider_id] = value

    def clear_key(self, provider_id):
        self.keys.pop(provider_id, None)

    def set_default_provider(self, provider_id):
        self.default = provider_id


def test_list_providers_reports_real_status_and_default():
    resolver = FakeResolver()
    summaries = ListArtifactProviders(resolver, FakeCredentialsStore()).execute()

    by_id = {s.check.provider_id: s for s in summaries}
    assert by_id[ProviderId.ANTHROPIC].check.status == ProviderStatus.CONNECTED
    assert by_id[ProviderId.ANTHROPIC].is_default is True
    assert by_id[ProviderId.CLAUDE_CODE].check.status == ProviderStatus.NOT_CONFIGURED
    assert by_id[ProviderId.CLAUDE_CODE].is_default is False


def test_list_providers_reports_stored_key_presence_never_the_key_itself():
    credentials = FakeCredentialsStore()
    credentials.set_key(ProviderId.ANTHROPIC, "sk-real-secret")
    summaries = ListArtifactProviders(FakeResolver(), credentials).execute()

    by_id = {s.check.provider_id: s for s in summaries}
    assert by_id[ProviderId.ANTHROPIC].has_stored_key is True
    # the ProviderSummary/ProviderCheckResult objects never carry the raw value anywhere
    for s in summaries:
        assert "sk-real-secret" not in repr(s)


def test_check_provider_is_always_a_fresh_live_call():
    result = CheckArtifactProvider(FakeResolver(claude_code_status=ProviderStatus.AUTH_ERROR)).execute(ProviderId.CLAUDE_CODE)
    assert result.status == ProviderStatus.AUTH_ERROR


def test_set_default_provider_delegates_to_credentials_store():
    store = FakeCredentialsStore()
    SetDefaultArtifactProvider(store).execute(ProviderId.CLAUDE_CODE)
    assert store.default == ProviderId.CLAUDE_CODE


def test_set_provider_api_key_rejects_empty_value():
    store = FakeCredentialsStore()
    with pytest.raises(ValueError):
        SetProviderApiKey(store).execute(ProviderId.ANTHROPIC, "   ")
    assert ProviderId.ANTHROPIC not in store.keys


def test_set_provider_api_key_stores_trimmed_value():
    store = FakeCredentialsStore()
    SetProviderApiKey(store).execute(ProviderId.ANTHROPIC, "  sk-real  ")
    assert store.keys[ProviderId.ANTHROPIC] == "sk-real"


def test_clear_provider_api_key_delegates_to_credentials_store():
    store = FakeCredentialsStore()
    store.set_key(ProviderId.ANTHROPIC, "sk-real")
    ClearProviderApiKey(store).execute(ProviderId.ANTHROPIC)
    assert ProviderId.ANTHROPIC not in store.keys
