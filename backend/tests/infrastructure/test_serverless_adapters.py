"""Adapters that let the backend run on Vercel + GitHub Actions + Supabase only."""
from __future__ import annotations

import base64
import struct

import httpx
import pytest

from app.domain.artifact.entities import ProviderId
from app.domain.ports import MediaGenerationUnavailableError
from app.infrastructure.config.env_credentials_store import EnvOnlyCredentialsStore
from app.infrastructure.media.cloudflare_media_generation_adapter import CloudflareMediaGenerationAdapter
from app.infrastructure.media.image_info import image_info
from app.infrastructure.media.supabase_asset_storage import HybridAssetStorage, SupabaseAssetStorage
from app.infrastructure.runtime.github_dispatch import GitHubDiscoveryRunner, GitHubWorkflowDispatcher


def _png(width=1024, height=576) -> bytes:
    return b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", width, height) + b"\x08\x02\x00\x00\x00"


def _jpeg(width=800, height=450) -> bytes:
    sof = b"\xff\xc0" + struct.pack(">H", 17) + b"\x08" + struct.pack(">HH", height, width) + b"\x03" + b"\x00" * 9
    return b"\xff\xd8\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00" + b"\x00" * 9 + sof + b"\xff\xd9"


class FakeHttp:
    def __init__(self, response=None, error=None):
        self.response = response
        self.error = error
        self.calls = []

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        if self.error:
            raise self.error
        return self.response


# --- GitHub dispatch -----------------------------------------------------------------

def test_dispatch_posts_workflow_dispatch_with_token_and_ref():
    http = FakeHttp(httpx.Response(204))
    dispatcher = GitHubWorkflowDispatcher(token="t0k", repository="owner/repo", ref="master", http=http)
    assert dispatcher.dispatch("artifact-processing.yml") is True
    url, kwargs = http.calls[0]
    assert url == "https://api.github.com/repos/owner/repo/actions/workflows/artifact-processing.yml/dispatches"
    assert kwargs["headers"]["Authorization"] == "Bearer t0k"
    assert kwargs["json"] == {"ref": "master"}


def test_dispatch_never_raises_so_the_job_waits_for_the_cron_instead():
    assert GitHubWorkflowDispatcher(token="", repository="", http=FakeHttp()).dispatch("x.yml") is False
    failing = GitHubWorkflowDispatcher(token="t", repository="o/r", http=FakeHttp(error=httpx.ConnectError("down")))
    assert failing.dispatch("x.yml") is False
    rejected = GitHubWorkflowDispatcher(token="t", repository="o/r", http=FakeHttp(httpx.Response(404, text="Not Found")))
    assert rejected.dispatch("x.yml") is False


def test_discovery_runner_wakes_the_discovery_workflow():
    http = FakeHttp(httpx.Response(204))
    runner = GitHubDiscoveryRunner(GitHubWorkflowDispatcher(token="t", repository="o/r", http=http))
    runner.trigger("job-1", {})
    runner.request_stop("job-1")  # cooperative: the worker reads CANCELLING from storage
    assert http.calls[0][0].endswith("/discovery-processing.yml/dispatches")
    assert len(http.calls) == 1


# --- image headers -------------------------------------------------------------------

def test_image_info_reads_png_and_jpeg_sizes():
    assert image_info(_png(1024, 576)) == ("image/png", 1024, 576)
    assert image_info(_jpeg(800, 450)) == ("image/jpeg", 800, 450)
    assert image_info(b"not an image")[0] == "application/octet-stream"


# --- Supabase Storage ------------------------------------------------------------------

class FakeBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, content, options):
        self.uploads.append((path, content, options))


class FakeStorageClient:
    def __init__(self):
        self.bucket = FakeBucket()
        self.bucket_name = None
        self.storage = self

    def from_(self, name):
        self.bucket_name = name
        return self.bucket


def test_supabase_storage_uploads_and_resolves_public_urls():
    client = FakeStorageClient()
    storage = SupabaseAssetStorage(client, bucket="media", supabase_url="https://p.supabase.co/")
    ref = storage.save_upload("story/1", "foto.JPG", b"bytes")
    assert ref.startswith("sb:artifacts/story_1/uploads/") and ref.endswith(".jpg")
    path, _, options = client.bucket.uploads[0]
    assert options["content-type"] == "image/jpeg"
    assert storage.resolve_url(ref) == f"https://p.supabase.co/storage/v1/object/public/media/{path}"


def test_supabase_storage_rejects_non_images():
    with pytest.raises(ValueError):
        SupabaseAssetStorage(FakeStorageClient(), supabase_url="https://p").save_upload("s", "script.svg", b"<svg/>")


def test_hybrid_storage_keeps_old_local_refs_working():
    class Local:
        def resolve_url(self, ref):
            return f"http://localhost:8000/assets/{ref}"

    hybrid = HybridAssetStorage(SupabaseAssetStorage(FakeStorageClient(), supabase_url="https://p"), Local())
    assert hybrid.resolve_url("story/uploads/a.png") == "http://localhost:8000/assets/story/uploads/a.png"
    assert hybrid.resolve_url("sb:artifacts/s/a.png").startswith("https://p/storage/v1/object/public/")


# --- Cloudflare image generation -------------------------------------------------------

def test_cloudflare_generation_stores_the_returned_image():
    client = FakeStorageClient()
    storage = SupabaseAssetStorage(client, supabase_url="https://p")
    image = _jpeg(1024, 1024)
    http = FakeHttp(httpx.Response(200, json={"success": True, "result": {"image": base64.b64encode(image).decode()}}))
    adapter = CloudflareMediaGenerationAdapter(storage, account_id="acc", api_token="tok", http=http)

    result = adapter.generate("story-1", "img-1", "Estadio lleno al atardecer")

    url, kwargs = http.calls[0]
    assert url.endswith("/acc/ai/run/@cf/black-forest-labs/flux-1-schnell")
    assert kwargs["json"] == {"prompt": "Estadio lleno al atardecer", "steps": 4}
    assert (result.mime_type, result.width, result.height, result.provider) == ("image/jpeg", 1024, 1024, "cloudflare")
    assert result.storage_ref.startswith("sb:artifacts/story-1/generated/")
    assert client.bucket.uploads[0][1] == image


@pytest.mark.parametrize("response, message", [
    (httpx.Response(400, json={"success": False, "errors": [{"message": "NSFW"}]}), "NSFW"),
    (httpx.Response(200, json={"success": True, "result": {}}), "ninguna imagen"),
    (httpx.Response(502, text="<html>"), "sin JSON"),
])
def test_cloudflare_generation_reports_provider_failures(response, message):
    adapter = CloudflareMediaGenerationAdapter(SupabaseAssetStorage(FakeStorageClient(), supabase_url="https://p"),
                                               account_id="a", api_token="t", http=FakeHttp(response))
    with pytest.raises(MediaGenerationUnavailableError, match=message):
        adapter.generate("s", "p", "prompt")


def test_cloudflare_generation_requires_credentials_and_a_prompt():
    storage = SupabaseAssetStorage(FakeStorageClient(), supabase_url="https://p")
    with pytest.raises(MediaGenerationUnavailableError, match="CLOUDFLARE"):
        CloudflareMediaGenerationAdapter(storage, account_id="", api_token="", http=FakeHttp()).generate("s", "p", "x")
    with pytest.raises(MediaGenerationUnavailableError, match="prompt"):
        CloudflareMediaGenerationAdapter(storage, account_id="a", api_token="t", http=FakeHttp()).generate("s", "p", "  ")


# --- read-only credentials -------------------------------------------------------------

def test_env_only_credentials_store_reads_env_and_explains_writes(monkeypatch):
    store = EnvOnlyCredentialsStore()
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    assert store.has_key(ProviderId.ANTHROPIC) is True
    with pytest.raises(ValueError, match="ANTHROPIC_API_KEY"):
        store.set_key(ProviderId.ANTHROPIC, "x")
    with pytest.raises(ValueError, match="ARTIFACT_PROVIDER"):
        store.set_default_provider(ProviderId.ANTHROPIC)
