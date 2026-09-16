from __future__ import annotations

import os

from app.domain.artifact.entities import ProviderId
from app.infrastructure.config import env_credentials_store as module
from app.infrastructure.config.env_credentials_store import EnvFileCredentialsStore


def test_set_key_writes_file_and_updates_process_env(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    monkeypatch.setattr(module, "_ENV_FILE", env_file)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    store = EnvFileCredentialsStore()
    store.set_key(ProviderId.ANTHROPIC, "sk-real-secret-value")

    assert os.environ["ANTHROPIC_API_KEY"] == "sk-real-secret-value"
    assert "ANTHROPIC_API_KEY=sk-real-secret-value" in env_file.read_text(encoding="utf-8")
    assert store.has_key(ProviderId.ANTHROPIC) is True


def test_set_key_replaces_existing_line_not_duplicates(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    env_file.write_text("SUPABASE_URL=https://x\nANTHROPIC_API_KEY=old-value\n", encoding="utf-8")
    monkeypatch.setattr(module, "_ENV_FILE", env_file)

    EnvFileCredentialsStore().set_key(ProviderId.ANTHROPIC, "new-value")

    content = env_file.read_text(encoding="utf-8")
    assert content.count("ANTHROPIC_API_KEY=") == 1
    assert "ANTHROPIC_API_KEY=new-value" in content
    assert "SUPABASE_URL=https://x" in content  # untouched


def test_clear_key_removes_from_process_env(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    monkeypatch.setattr(module, "_ENV_FILE", env_file)
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-existing")

    EnvFileCredentialsStore().clear_key(ProviderId.ANTHROPIC)

    assert "ANTHROPIC_API_KEY" not in os.environ
    assert EnvFileCredentialsStore().has_key(ProviderId.ANTHROPIC) is False


def test_has_key_false_when_never_set(tmp_path, monkeypatch):
    monkeypatch.setattr(module, "_ENV_FILE", tmp_path / ".env")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert EnvFileCredentialsStore().has_key(ProviderId.ANTHROPIC) is False


def test_set_default_provider_writes_artifact_provider(tmp_path, monkeypatch):
    env_file = tmp_path / ".env"
    monkeypatch.setattr(module, "_ENV_FILE", env_file)

    EnvFileCredentialsStore().set_default_provider(ProviderId.CLAUDE_CODE)

    assert os.environ["ARTIFACT_PROVIDER"] == "claude_code"
    assert "ARTIFACT_PROVIDER=claude_code" in env_file.read_text(encoding="utf-8")
