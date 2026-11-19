import asyncio
import pytest

from app.presentation.auth import AuthenticatedUser, require_admin


def test_require_admin_accepts_admin_role(monkeypatch):
    monkeypatch.delenv("ADMIN_USER_IDS", raising=False)
    monkeypatch.delenv("ADMIN_EMAILS", raising=False)
    dependency = require_admin().dependency
    user = AuthenticatedUser(id="u1", email="admin@example.com", role="admin")
    assert asyncio.run(dependency(user)) == user


def test_require_admin_denies_unauthenticated_role(monkeypatch):
    from fastapi import HTTPException

    monkeypatch.delenv("ADMIN_USER_IDS", raising=False)
    monkeypatch.delenv("ADMIN_EMAILS", raising=False)
    dependency = require_admin().dependency
    user = AuthenticatedUser(id="u2", email="user@example.com", role="authenticated")

    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependency(user))
    assert exc.value.status_code == 403


def test_require_admin_accepts_allowlisted_user_id(monkeypatch):
    monkeypatch.setenv("ADMIN_USER_IDS", "u2")
    monkeypatch.delenv("ADMIN_EMAILS", raising=False)
    dependency = require_admin().dependency
    user = AuthenticatedUser(id="u2", email="someone@example.com", role="authenticated")
    assert asyncio.run(dependency(user)) == user


def test_require_admin_denies_user_metadata_style_role(monkeypatch):
    from fastapi import HTTPException

    monkeypatch.delenv("ADMIN_USER_IDS", raising=False)
    monkeypatch.delenv("ADMIN_EMAILS", raising=False)
    dependency = require_admin().dependency
    user = AuthenticatedUser(id="u3", email="user@example.com", role="authenticated")
    with pytest.raises(HTTPException) as exc:
        asyncio.run(dependency(user))
    assert exc.value.status_code == 403
