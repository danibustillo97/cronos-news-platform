"""Real MediaGenerationPort implementation: a synchronous HTTP call to
automation/runtime's `/media/generate` (see automation/runtime/app/main.py),
which shells out to lab.cli's real `media-generate-standalone` command --
the actual Gemini/Cloudflare image providers that already exist in
automation/lab/media/providers/. This backend never imports LAB Python
directly (same boundary as DiscoveryRunnerAdapter/LocalRuntimeAdapter);
crossing that boundary is the whole point of this adapter.

A real image call takes a few seconds, not the 10-60s+ of an LLM article
call, but is still a blocking network request -- callers (RunMediaGeneration
Job) already run this inside a backend BackgroundTask, same pattern as
AnthropicArtifactGenerator's own blocking httpx call.
"""
from __future__ import annotations

import os

import httpx

from app.domain.asset.entities import MediaGenerationResult
from app.domain.ports import MediaGenerationUnavailableError

_DEFAULT_BASE_URL = "http://localhost:8801"
_TIMEOUT_SECONDS = 60.0


class RuntimeMediaGenerationAdapter:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.getenv("RUNTIME_BASE_URL", _DEFAULT_BASE_URL)

    def generate(self, story_id: str, placeholder_id: str, prompt: str, aspect_ratio: str = "16:9") -> MediaGenerationResult:
        try:
            resp = httpx.post(
                f"{self._base_url}/media/generate",
                json={
                    "story_id": story_id, "placeholder_id": placeholder_id, "prompt": prompt,
                    "aspect_ratio": aspect_ratio,
                },
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            raise MediaGenerationUnavailableError(f"Local Runtime no disponible en {self._base_url}: {exc}") from exc

        if resp.status_code != 200:
            detail = _extract_error(resp)
            raise MediaGenerationUnavailableError(f"Generación de imagen falló ({resp.status_code}): {detail}")

        body = resp.json()
        storage_ref = f"{story_id}/{body['relative_path']}"
        return MediaGenerationResult(
            storage_ref=storage_ref, mime_type=body["mime_type"], width=body["width"], height=body["height"],
            provider=body["provider"], model=body["model"],
        )


def _extract_error(resp: httpx.Response) -> str:
    try:
        body = resp.json()
    except ValueError:
        return resp.text
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, dict):
        parsed = detail.get("parsed") or {}
        return parsed.get("error") or detail.get("stderr") or str(detail)
    return str(detail) if detail else resp.text
