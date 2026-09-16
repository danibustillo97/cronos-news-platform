"""Real ArtifactProviderPort implementation backed by the Claude Code CLI
installed on THIS machine -- an explicit, user-selected provider (never a
silent default, see app/infrastructure/llm/provider_resolver.py), for a
human who has Claude Code installed and authenticated locally and wants
to use it instead of a separate Anthropic API key.

Honest limitation, not hidden: this only works where the `claude` binary
is installed and authenticated -- i.e. this dev machine. A real cloud
deployment of this backend without the CLI present would report this
provider UNAVAILABLE, exactly as it should; there is no fallback masking
that fact.

Distinct from automation/runtime's own "the Runtime never launches Claude
Code" rule for pipeline orchestration (see app/domain/artifact/entities.py's
own docstring) -- this is one synchronous, non-interactive `claude -p`
call a human explicitly chose, not an interactive session driving the
production control flow.

Uses only the CLI's real, documented flags (`-p`/--print,
--output-format json, --model, `auth status`) -- confirmed by running
`claude --help` / `claude auth status` directly, never invented.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile

from app.domain.artifact.entities import (
    ArtifactGenerationRequest, ArtifactGenerationResult, ProviderCheckResult, ProviderId, ProviderStatus,
)
from app.domain.ports import ArtifactGenerationUnavailableError
from app.infrastructure.llm.prompts import build_artifact_prompt
from app.infrastructure.llm.response_parser import parse_artifact_response

_DEFAULT_MODEL = "claude-sonnet-5"
_GENERATE_TIMEOUT_SECONDS = 300.0
_STATUS_CHECK_TIMEOUT_SECONDS = 15.0


def _binary_path() -> str | None:
    override = os.getenv("CLAUDE_CODE_BINARY")
    if override:
        return override
    return shutil.which("claude")


class ClaudeCodeArtifactGenerator:
    def __init__(self, model: str | None = None) -> None:
        self._model = model or os.getenv("CLAUDE_CODE_MODEL", _DEFAULT_MODEL)

    def generate(self, request: ArtifactGenerationRequest) -> ArtifactGenerationResult:
        binary = _binary_path()
        if not binary:
            raise ArtifactGenerationUnavailableError(
                "El CLI de Claude Code no está instalado en esta máquina (comando 'claude' no encontrado en PATH) "
                "-- este es un provider local real, no un fallback; instalalo o elegí otro provider."
            )

        prompt = build_artifact_prompt(request)
        try:
            # cwd aislado a propósito: nunca queremos que este llamado
            # cargue un CLAUDE.md/.claude/ de este repo -- es una
            # generación de texto puntual, no una sesión de desarrollo.
            proc = subprocess.run(
                [binary, "-p", prompt, "--output-format", "json", "--model", self._model],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
                timeout=_GENERATE_TIMEOUT_SECONDS, cwd=tempfile.gettempdir(),
            )
        except subprocess.TimeoutExpired as exc:
            raise ArtifactGenerationUnavailableError(f"Claude Code CLI no respondió en {_GENERATE_TIMEOUT_SECONDS:.0f}s") from exc
        except OSError as exc:
            raise ArtifactGenerationUnavailableError(f"no se pudo ejecutar el CLI de Claude Code: {exc}") from exc

        if proc.returncode != 0:
            raise ArtifactGenerationUnavailableError(
                f"Claude Code CLI terminó con código {proc.returncode}: {(proc.stderr or '').strip()[:500]}"
            )

        try:
            body = json.loads(proc.stdout)
        except json.JSONDecodeError as exc:
            raise ArtifactGenerationUnavailableError(f"salida no-JSON del CLI de Claude Code: {exc}") from exc

        if body.get("is_error"):
            raise ArtifactGenerationUnavailableError(f"Claude Code CLI reportó un error: {body.get('result') or body}")
        text = body.get("result")
        if not text:
            raise ArtifactGenerationUnavailableError("la respuesta del CLI de Claude Code no trae 'result'")

        return parse_artifact_response(text)

    def check_status(self) -> ProviderCheckResult:
        binary = _binary_path()
        if not binary:
            return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.UNAVAILABLE, detail="comando 'claude' no encontrado en PATH")

        try:
            version_proc = subprocess.run(
                [binary, "--version"], capture_output=True, text=True, timeout=_STATUS_CHECK_TIMEOUT_SECONDS,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.UNAVAILABLE, detail=f"no se pudo ejecutar el CLI: {exc}")
        version = version_proc.stdout.strip() if version_proc.returncode == 0 else None

        try:
            auth_proc = subprocess.run(
                [binary, "auth", "status"], capture_output=True, text=True, timeout=_STATUS_CHECK_TIMEOUT_SECONDS,
            )
        except (subprocess.TimeoutExpired, OSError) as exc:
            return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.UNAVAILABLE, detail=f"'claude auth status' falló: {exc}", version=version)

        try:
            auth = json.loads(auth_proc.stdout)
        except json.JSONDecodeError:
            return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.UNAVAILABLE, detail="'claude auth status' no devolvió JSON válido", version=version)

        # Solo campos no sensibles -- nunca email/orgId/configDirectory.
        if auth.get("loggedIn"):
            method = auth.get("authMethod") or "sesión activa"
            return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.CONNECTED, detail=f"autenticado ({method})", version=version)
        return ProviderCheckResult(ProviderId.CLAUDE_CODE, ProviderStatus.AUTH_ERROR, detail="CLI instalado pero no autenticado -- correr 'claude auth login'", version=version)
