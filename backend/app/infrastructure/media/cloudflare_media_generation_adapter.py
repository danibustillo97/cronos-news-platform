"""MediaGenerationPort that calls Cloudflare Workers AI directly (flux-1-schnell).

The runtime adapter reaches automation/runtime on localhost, which does not exist on
Vercel or GitHub Actions. This adapter makes the same provider call the LAB's
CloudflareFluxProvider makes (same model, same JSON contract -- see
automation/lab/media/providers/cloudflare_flux.py) and stores the result through
SupabaseAssetStorage, so it works from any worker.

Environment: CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, optional CLOUDFLARE_IMAGE_MODEL.
"""
from __future__ import annotations

import base64
import binascii
import os

import httpx

from app.domain.asset.entities import MediaGenerationResult
from app.domain.ports import MediaGenerationUnavailableError

_API = "https://api.cloudflare.com/client/v4/accounts"
_DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell"
_STEPS = 4  # documented default for flux-1-schnell (max 8)
_TIMEOUT_SECONDS = 120.0
_MAX_PROMPT = 2048


def cloudflare_configured() -> bool:
    return bool(os.getenv("CLOUDFLARE_ACCOUNT_ID") and os.getenv("CLOUDFLARE_API_TOKEN"))


class CloudflareMediaGenerationAdapter:
    def __init__(self, storage, account_id: str | None = None, api_token: str | None = None,
                 model: str | None = None, http=httpx) -> None:
        self._storage = storage
        self._account_id = account_id or os.getenv("CLOUDFLARE_ACCOUNT_ID", "")
        self._api_token = api_token or os.getenv("CLOUDFLARE_API_TOKEN", "")
        self._model = model or os.getenv("CLOUDFLARE_IMAGE_MODEL", _DEFAULT_MODEL)
        self._http = http

    def generate(self, story_id: str, placeholder_id: str, prompt: str, aspect_ratio: str = "16:9") -> MediaGenerationResult:
        if not self._account_id or not self._api_token:
            raise MediaGenerationUnavailableError("CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN no están configuradas")
        text = (prompt or "").strip()[:_MAX_PROMPT]
        if not text:
            raise MediaGenerationUnavailableError("La imagen no tiene prompt: escribe uno antes de generar")
        try:
            response = self._http.post(
                f"{_API}/{self._account_id}/ai/run/{self._model}",
                headers={"Authorization": f"Bearer {self._api_token}"},
                json={"prompt": text, "steps": _STEPS},
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            raise MediaGenerationUnavailableError(f"Cloudflare Workers AI no respondió: {exc}") from exc
        try:
            body = response.json()
        except ValueError as exc:
            raise MediaGenerationUnavailableError(f"Cloudflare Workers AI respondió {response.status_code} sin JSON") from exc
        if response.status_code != 200 or not body.get("success", False):
            errors = body.get("errors") or []
            detail = "; ".join(str(error.get("message", error)) for error in errors) or f"HTTP {response.status_code}"
            raise MediaGenerationUnavailableError(f"Cloudflare Workers AI rechazó la generación: {detail}")
        encoded = (body.get("result") or {}).get("image")
        if not encoded:
            raise MediaGenerationUnavailableError("Cloudflare Workers AI no devolvió ninguna imagen")
        try:
            content = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise MediaGenerationUnavailableError("Cloudflare Workers AI devolvió una imagen ilegible") from exc

        storage_ref, mime_type, width, height = self._storage.save_generated(story_id, content)
        return MediaGenerationResult(
            storage_ref=storage_ref, mime_type=mime_type, width=width, height=height,
            provider="cloudflare", model=self._model,
        )
