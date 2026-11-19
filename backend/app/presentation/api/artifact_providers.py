"""Provider Control Plane -- read/write real provider state. Every value
returned here comes from a live check_status() call or a real stored
setting; nothing is cached across requests, nothing is guessed. Secrets
never appear in any response: only has_stored_key (a bool).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.container import Container, get_container
from app.application.use_cases.artifact_providers import ProviderSummary
from app.domain.artifact.entities import ProviderId
from app.presentation.schemas import ProviderOut, SetDefaultProviderRequest, SetProviderApiKeyRequest
from app.presentation.mappers import provider_out

router = APIRouter(prefix="/api/artifact-providers", tags=["artifact-providers"])


def _parse_provider_id(value: str) -> ProviderId:
    try:
        return ProviderId(value)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"provider desconocido: {value!r}")


class ProvidersResponse(BaseModel):
    providers: list[ProviderOut]


@router.get("", response_model=ProvidersResponse)
def list_providers(container: Container = Depends(get_container)) -> ProvidersResponse:
    summaries = container.list_artifact_providers.execute()
    return ProvidersResponse(providers=[provider_out(s) for s in summaries])


@router.post("/{provider_id}/test", response_model=ProviderOut)
def test_provider_connection(provider_id: str, container: Container = Depends(get_container)) -> ProviderOut:
    """The real "Test connection" action -- always a fresh, live check."""
    pid = _parse_provider_id(provider_id)
    check = container.check_artifact_provider.execute(pid)
    default_name = container.artifact_provider_resolver.default_provider_id()
    summary = ProviderSummary(
        check=check, is_default=(pid.value == default_name),
        has_stored_key=container.artifact_credentials_store.has_key(pid),
    )
    return provider_out(summary)


@router.put("/default")
def set_default_provider(body: SetDefaultProviderRequest, container: Container = Depends(get_container)) -> dict:
    pid = _parse_provider_id(body.provider_id)
    container.set_default_artifact_provider.execute(pid)
    return {"providerId": pid.value}


@router.put("/{provider_id}/api-key")
def set_provider_api_key(provider_id: str, body: SetProviderApiKeyRequest, container: Container = Depends(get_container)) -> dict:
    pid = _parse_provider_id(provider_id)
    try:
        container.set_provider_api_key.execute(pid, body.api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"providerId": pid.value, "hasStoredKey": True}


@router.delete("/{provider_id}/api-key")
def clear_provider_api_key(provider_id: str, container: Container = Depends(get_container)) -> dict:
    pid = _parse_provider_id(provider_id)
    container.clear_provider_api_key.execute(pid)
    return {"providerId": pid.value, "hasStoredKey": False}
