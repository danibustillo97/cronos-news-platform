from __future__ import annotations

import httpx
import pytest

from app.domain.ports import MediaGenerationUnavailableError
from app.infrastructure.media.runtime_media_generation_adapter import RuntimeMediaGenerationAdapter


class _FakeResponse:
    def __init__(self, status_code, json_body):
        self.status_code = status_code
        self._json_body = json_body
        self.text = str(json_body)

    def json(self):
        return self._json_body


def test_generate_returns_real_result_on_success(monkeypatch):
    def fake_post(url, json, timeout):
        assert url == "http://localhost:8801/media/generate"
        assert json["story_id"] == "s1"
        return _FakeResponse(200, {
            "relative_path": "media/FEATURE_IMAGE.jpeg", "mime_type": "image/jpeg",
            "width": 1024, "height": 1024, "provider": "cloudflare", "model": "flux-1-schnell",
        })

    monkeypatch.setattr(httpx, "post", fake_post)
    adapter = RuntimeMediaGenerationAdapter()

    result = adapter.generate("s1", "FEATURE_IMAGE", "Un prompt real")

    assert result.storage_ref == "s1/media/FEATURE_IMAGE.jpeg"
    assert result.provider == "cloudflare"


def test_generate_raises_honestly_when_runtime_unreachable(monkeypatch):
    def fake_post(url, json, timeout):
        raise httpx.ConnectError("connection refused")

    monkeypatch.setattr(httpx, "post", fake_post)
    adapter = RuntimeMediaGenerationAdapter()

    with pytest.raises(MediaGenerationUnavailableError):
        adapter.generate("s1", "FEATURE_IMAGE", "Un prompt real")


def test_generate_raises_honestly_with_real_provider_error(monkeypatch):
    def fake_post(url, json, timeout):
        return _FakeResponse(502, {"detail": {"parsed": {"error": "429 RESOURCE_EXHAUSTED"}}})

    monkeypatch.setattr(httpx, "post", fake_post)
    adapter = RuntimeMediaGenerationAdapter()

    with pytest.raises(MediaGenerationUnavailableError, match="RESOURCE_EXHAUSTED"):
        adapter.generate("s1", "FEATURE_IMAGE", "Un prompt real")
