"""HTTP client for automation/runtime's discovery endpoint -- the one
place this backend crosses into Automation to ask for real content
discovery. Automation/LAB does the actual fetching (lab.ingestion.run);
this backend never scrapes anything itself (same 'PRODUCE vs ORCHESTRATE'
boundary as LocalRuntimeAdapter, applied to raw content instead of a full
production).
"""
from __future__ import annotations

import os

import httpx

from app.domain.ports import RuntimeUnavailableError

DEFAULT_BASE_URL = "http://localhost:8801"
CONNECT_TIMEOUT = 5.0


class DiscoveryRunnerAdapter:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.getenv("RUNTIME_BASE_URL", DEFAULT_BASE_URL)

    def trigger(self, job_id: str, params: dict) -> None:
        try:
            resp = httpx.post(
                f"{self._base_url}/discovery/jobs/{job_id}/run",
                json={"params": params},
                timeout=CONNECT_TIMEOUT,
            )
        except httpx.HTTPError as exc:
            raise RuntimeUnavailableError(f"Local Runtime no disponible en {self._base_url}: {exc}") from exc
        if resp.status_code != 202:
            raise RuntimeUnavailableError(f"Local Runtime rechazó el discovery job: {resp.status_code} {resp.text}")
