"""Provider Control Plane -- orchestration only. Every real check
(API key validity, CLI presence/auth) lives in the concrete adapters
(app/infrastructure/llm/); this module just asks the resolver for the
real, current state and never fabricates a status.
"""
from __future__ import annotations

from dataclasses import dataclass

from app.domain.artifact.entities import ProviderCheckResult, ProviderId
from app.domain.ports import ArtifactCredentialsStorePort, ArtifactProviderResolverPort


@dataclass(frozen=True)
class ProviderSummary:
    check: ProviderCheckResult
    is_default: bool
    has_stored_key: bool  # never the key itself


class ListArtifactProviders:
    def __init__(self, providers: ArtifactProviderResolverPort, credentials: ArtifactCredentialsStorePort) -> None:
        self._providers = providers
        self._credentials = credentials

    def execute(self) -> list[ProviderSummary]:
        default_name = self._providers.default_provider_id()
        default_id = ProviderId(default_name) if default_name in [p.value for p in ProviderId] else None
        summaries = []
        for provider_id, provider in self._providers.all_providers().items():
            summaries.append(ProviderSummary(
                check=provider.check_status(), is_default=(provider_id == default_id),
                has_stored_key=self._credentials.has_key(provider_id),
            ))
        return summaries


class CheckArtifactProvider:
    """The real "Test connection" action -- always a fresh, live check,
    never a cached value."""

    def __init__(self, providers: ArtifactProviderResolverPort) -> None:
        self._providers = providers

    def execute(self, provider_id: ProviderId) -> ProviderCheckResult:
        return self._providers.get(provider_id).check_status()


class SetDefaultArtifactProvider:
    def __init__(self, credentials: ArtifactCredentialsStorePort) -> None:
        self._credentials = credentials

    def execute(self, provider_id: ProviderId) -> None:
        self._credentials.set_default_provider(provider_id)


class SetProviderApiKey:
    def __init__(self, credentials: ArtifactCredentialsStorePort) -> None:
        self._credentials = credentials

    def execute(self, provider_id: ProviderId, api_key: str) -> None:
        if not api_key or not api_key.strip():
            raise ValueError("api_key vacía")
        self._credentials.set_key(provider_id, api_key.strip())


class ClearProviderApiKey:
    def __init__(self, credentials: ArtifactCredentialsStorePort) -> None:
        self._credentials = credentials

    def execute(self, provider_id: ProviderId) -> None:
        self._credentials.clear_key(provider_id)
