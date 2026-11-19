"""HTTP client for the Local Runtime (automation/runtime/). Today it
points at localhost; the day a Cloudflare Tunnel exists in front of it,
only RUNTIME_BASE_URL changes — this class and everything that depends
on ExecutionRuntimePort stays untouched.
"""

from __future__ import annotations

import os

import httpx

from app.domain.ports import RuntimeUnavailableError

DEFAULT_BASE_URL = "http://localhost:8801"
CONNECT_TIMEOUT = 5.0


class LocalRuntimeAdapter:
    def __init__(self, base_url: str | None = None) -> None:
        self._base_url = base_url or os.getenv("RUNTIME_BASE_URL", DEFAULT_BASE_URL)

    def is_connected(self) -> bool:
        try:
            resp = httpx.get(f"{self._base_url}/status", timeout=CONNECT_TIMEOUT)
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    def ingest(self, title: str, source_url: str, content: str, image_url: str | None, source: str | None) -> str:
        try:
            resp = httpx.post(
                f"{self._base_url}/ingest",
                json={"title": title, "source_url": source_url, "content": content,
                      "image_url": image_url, "source": source},
                timeout=60,
            )
        except httpx.HTTPError as exc:
            raise RuntimeUnavailableError(f"Local Runtime no disponible en {self._base_url}: {exc}") from exc
        if resp.status_code != 200:
            raise RuntimeUnavailableError(f"Local Runtime rechazó la ingestión: {resp.status_code} {resp.text}")
        return resp.json()["item_id"]

    def start_production(self, production_id: str, story_id: str, item_id: str) -> None:
        self._post(f"/productions/{production_id}/start", {"story_id": story_id, "item_id": item_id})

    def cancel_production(self, production_id: str) -> None:
        self._post(f"/productions/{production_id}/cancel", {})

    def resume_production(self, production_id: str, story_id: str, item_id: str) -> None:
        self._post(f"/productions/{production_id}/resume", {"story_id": story_id, "item_id": item_id})

    def _post(self, path: str, body: dict) -> None:
        try:
            resp = httpx.post(f"{self._base_url}{path}", json=body, timeout=CONNECT_TIMEOUT)
        except httpx.HTTPError as exc:
            raise RuntimeUnavailableError(f"Local Runtime no disponible en {self._base_url}: {exc}") from exc
        if resp.status_code != 200:
            raise RuntimeUnavailableError(f"Local Runtime devolvió {resp.status_code}: {resp.text}")
