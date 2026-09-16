"""Local/dev ArtifactCredentialsStorePort: reads and writes backend/.env
directly -- the exact same file every other secret in this codebase
already lives in (SUPABASE_SERVICE_ROLE_KEY, TIKTOK_CLIENT_SECRET, ...,
see app/infrastructure/persistence/supabase/client.py's own docstring).
No new secret-storage mechanism invented for this feature.

A real production deployment needs a different adapter (a real secret
manager -- AWS Secrets Manager, etc.) instead of a plaintext file on
disk; swapping it out never touches domain/application code, same seam
every other port in this codebase already uses. That adapter does not
exist yet -- an honest gap, not pretended away.

Never returns the raw value to any caller -- only whether a key is set
(has_key), used by the presentation layer to build a masked "••••••••"
preview. Writing also updates os.environ in the CURRENT process so the
new value takes effect immediately, without a restart -- necessary
because python-dotenv-style loading (see client.py's _load_env_file)
only ever reads the file once, at import time.
"""
from __future__ import annotations

import os
import re
from pathlib import Path

from app.domain.artifact.entities import ProviderId

_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"  # backend/.env

_ENV_VAR_BY_PROVIDER = {
    ProviderId.ANTHROPIC: "ANTHROPIC_API_KEY",
    ProviderId.CLAUDE_CODE: None,  # auth lives in the CLI's own session, not an env secret
}


class EnvFileCredentialsStore:
    def set_key(self, provider_id: ProviderId, value: str) -> None:
        env_var = self._require_env_var(provider_id)
        self._write_line(env_var, value)
        os.environ[env_var] = value

    def clear_key(self, provider_id: ProviderId) -> None:
        env_var = self._require_env_var(provider_id)
        self._write_line(env_var, "")
        os.environ.pop(env_var, None)

    def has_key(self, provider_id: ProviderId) -> bool:
        env_var = _ENV_VAR_BY_PROVIDER.get(provider_id)
        return bool(env_var and os.getenv(env_var))

    @staticmethod
    def _require_env_var(provider_id: ProviderId) -> str:
        env_var = _ENV_VAR_BY_PROVIDER.get(provider_id)
        if not env_var:
            raise ValueError(f"{provider_id.value} no almacena su credencial como variable de entorno")
        return env_var

    def set_default_provider(self, provider_id: ProviderId) -> None:
        """Writes ARTIFACT_PROVIDER -- same file, same mechanism as an
        API key, just not a secret. Takes effect immediately (no
        restart) since ArtifactProviderResolver.default_provider_id()
        reads os.environ live, never cached."""
        self._write_line("ARTIFACT_PROVIDER", provider_id.value)
        os.environ["ARTIFACT_PROVIDER"] = provider_id.value

    @staticmethod
    def _write_line(env_var: str, value: str) -> None:
        pattern = re.compile(rf"^{re.escape(env_var)}=.*$", re.MULTILINE)
        line = f"{env_var}={value}"
        if _ENV_FILE.exists():
            content = _ENV_FILE.read_text(encoding="utf-8")
        else:
            content = ""

        if pattern.search(content):
            content = pattern.sub(line, content, count=1)
        else:
            if content and not content.endswith("\n"):
                content += "\n"
            content += line + "\n"
        _ENV_FILE.write_text(content, encoding="utf-8")
