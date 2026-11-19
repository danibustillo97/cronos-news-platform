"""The one place a provider name string becomes a concrete
ArtifactProviderPort -- domain/application code never imports
AnthropicArtifactGenerator/ClaudeCodeArtifactGenerator directly, same
pattern as lab.media.providers.resolver on the automation side.

"auto" (or no explicit choice) picks the first real, currently-usable
provider at the moment TriggerArtifact resolves it -- once resolved, the
choice is persisted on the ArtifactJob and never re-resolved. There is no
fallback during a running job: if the selected provider fails mid
generation, the job goes FAILED, and a human explicitly retries with a
provider of their choosing (never a silent second attempt).
"""
from __future__ import annotations

import os

from app.domain.artifact.entities import ProviderId, ProviderStatus
from app.domain.ports import ArtifactProviderPort, ProviderUnavailableError

_USABLE_STATUSES = {ProviderStatus.CONNECTED, ProviderStatus.AVAILABLE}
_DEFAULT_PROVIDER_ENV = "ARTIFACT_PROVIDER"


class ArtifactProviderResolver:
    def __init__(self, anthropic: ArtifactProviderPort, claude_code: ArtifactProviderPort) -> None:
        self._providers: dict[ProviderId, ArtifactProviderPort] = {
            ProviderId.ANTHROPIC: anthropic,
            ProviderId.CLAUDE_CODE: claude_code,
        }

    def all_providers(self) -> dict[ProviderId, ArtifactProviderPort]:
        return dict(self._providers)

    def default_provider_id(self) -> str:
        return os.getenv(_DEFAULT_PROVIDER_ENV, "auto").strip().lower()

    def get(self, provider_id: ProviderId) -> ArtifactProviderPort:
        return self._providers[provider_id]

    def resolve(self, requested: str | None) -> ProviderId:
        """Returns the real, concrete ProviderId to use -- raises
        ProviderUnavailableError instead of ever creating a job doomed to
        fail. `requested` is what the UI sent (a specific provider id,
        "auto", or None -- None and "auto" behave the same and both fall
        back to the configured default before trying every provider)."""
        name = (requested or "auto").strip().lower()
        if name not in ("auto", *[p.value for p in ProviderId]):
            raise ProviderUnavailableError(f"provider desconocido: {name!r}")

        if name != "auto":
            provider_id = ProviderId(name)
            status = self._providers[provider_id].check_status()
            if status.status not in _USABLE_STATUSES:
                raise ProviderUnavailableError(
                    f"{provider_id.value} no está disponible ahora ({status.status.value}): {status.detail or 'sin detalle'}"
                )
            return provider_id

        # auto: probar el default configurado primero, después cualquier
        # otro que esté realmente disponible -- nunca inventa que "auto"
        # funcionó si ninguno lo está.
        default_name = self.default_provider_id()
        ordered = list(ProviderId)
        if default_name in [p.value for p in ProviderId]:
            preferred = ProviderId(default_name)
            ordered = [preferred] + [p for p in ordered if p != preferred]

        checked: list[str] = []
        for provider_id in ordered:
            status = self._providers[provider_id].check_status()
            checked.append(f"{provider_id.value}={status.status.value}")
            if status.status in _USABLE_STATUSES:
                return provider_id

        raise ProviderUnavailableError(f"ningún provider de Artifact está disponible ahora mismo ({', '.join(checked)})")
