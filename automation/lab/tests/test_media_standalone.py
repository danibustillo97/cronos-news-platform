"""Tests de generate_standalone_image -- la generacion de UNA imagen real
fuera del pipeline de escenas (para Artifact/Publish de NEXUS backend).
Cero llamadas reales: resolve_media_provider se mockea siempre.
"""

import base64
from unittest.mock import MagicMock

import pytest

from lab.media import standalone
from lab.media.providers.base import MediaResult

FAKE_PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


def _fake_provider(name="cloudflare", model="flux-1-schnell"):
    provider = MagicMock()
    provider.name = name
    provider.generate.return_value = MediaResult(
        image_bytes=FAKE_PNG_1X1, mime_type="image/png", model=model, raw_meta={},
    )
    return provider


def test_generate_standalone_image_writes_real_file_and_returns_metadata(monkeypatch, tmp_path):
    monkeypatch.setattr(standalone, "EXPORTS_DIR", tmp_path)
    provider = _fake_provider()
    monkeypatch.setattr(standalone, "resolve_media_provider", lambda name=None: provider)

    result = standalone.generate_standalone_image("story-1", "FEATURE_IMAGE", "Un prompt real", aspect_ratio="16:9")

    assert result.relative_path == "media/FEATURE_IMAGE.png"
    assert result.width == 1 and result.height == 1
    assert result.provider == "cloudflare"
    assert result.model == "flux-1-schnell"
    written = tmp_path / "story-1" / "media" / "FEATURE_IMAGE.png"
    assert written.exists()
    assert written.read_bytes() == FAKE_PNG_1X1


def test_generate_standalone_image_rejects_empty_prompt(monkeypatch, tmp_path):
    monkeypatch.setattr(standalone, "EXPORTS_DIR", tmp_path)
    with pytest.raises(ValueError):
        standalone.generate_standalone_image("story-1", "FEATURE_IMAGE", "   ")


def test_generate_standalone_image_passes_provider_override(monkeypatch, tmp_path):
    monkeypatch.setattr(standalone, "EXPORTS_DIR", tmp_path)
    provider = _fake_provider(name="gemini")
    captured = {}

    def fake_resolve(name=None):
        captured["name"] = name
        return provider

    monkeypatch.setattr(standalone, "resolve_media_provider", fake_resolve)

    standalone.generate_standalone_image("story-1", "FEATURE_IMAGE", "Un prompt real", provider_name="gemini")

    assert captured["name"] == "gemini"
