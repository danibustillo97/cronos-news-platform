"""Real Anthropic Messages API adapter for ArtifactGenerationPort -- plain
httpx, no SDK dependency (matches this codebase's existing style for
every other outbound HTTP call, e.g. LocalRuntimeAdapter). Anthropic is
the concrete choice today; nothing outside this file knows that (the
domain/application layers only see ArtifactGenerationPort).

ANTHROPIC_API_KEY is required and never hardcoded, never logged. If it's
missing, this adapter fails loudly at call time with
ArtifactGenerationUnavailableError -- it does not fall back to inventing
content, and it is not imported/instantiated at all unless something
actually calls it (see container.py).
"""
from __future__ import annotations

import os

import httpx

from app.domain.artifact.entities import ArtifactGenerationRequest, ArtifactGenerationResult
from app.domain.ports import ArtifactGenerationUnavailableError
from app.infrastructure.llm.prompts import build_artifact_prompt
from app.infrastructure.llm.response_parser import parse_artifact_response

_API_URL = "https://api.anthropic.com/v1/messages"
_API_VERSION = "2023-06-01"
_DEFAULT_MODEL = "claude-sonnet-5"
_MAX_TOKENS = 8000
_TIMEOUT_SECONDS = 120.0


class AnthropicArtifactGenerator:
    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        self._api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self._model = model or os.getenv("ANTHROPIC_MODEL", _DEFAULT_MODEL)

    def generate(self, request: ArtifactGenerationRequest) -> ArtifactGenerationResult:
        if not self._api_key:
            raise ArtifactGenerationUnavailableError(
                "ANTHROPIC_API_KEY is not configured -- Artifact generation has a real provider "
                "boundary but no credentials to call it with. Set it in backend/.env to enable "
                "real generation; this is not a bug, it's an unconfigured provider."
            )

        prompt = build_artifact_prompt(request)
        try:
            response = httpx.post(
                _API_URL,
                headers={
                    "x-api-key": self._api_key,
                    "anthropic-version": _API_VERSION,
                    "content-type": "application/json",
                },
                json={
                    "model": self._model,
                    "max_tokens": _MAX_TOKENS,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            raise ArtifactGenerationUnavailableError(f"could not reach Anthropic API: {exc}") from exc

        if response.status_code != 200:
            # Never include the API key in the error -- it was only ever
            # in the request header, never in this response body.
            raise ArtifactGenerationUnavailableError(
                f"Anthropic API returned {response.status_code}: {response.text[:500]}"
            )

        body = response.json()
        try:
            text_blocks = [b["text"] for b in body["content"] if b.get("type") == "text"]
        except (KeyError, TypeError) as exc:
            raise ArtifactGenerationUnavailableError(f"unexpected Anthropic response shape: {exc}") from exc
        if not text_blocks:
            raise ArtifactGenerationUnavailableError("Anthropic response had no text content")

        return parse_artifact_response("\n".join(text_blocks))
