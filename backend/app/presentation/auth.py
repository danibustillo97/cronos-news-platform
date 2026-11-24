from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Iterable

import httpx
from fastapi import Depends, Header, HTTPException, Request, status


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    role: str | None


def _parse_csv(value: str | None) -> set[str]:
    return {item.strip() for item in (value or "").split(",") if item.strip()}


def _bearer_token(
    authorization: str | None,
    request: Request,
) -> str | None:
    if authorization:
        scheme, _, credentials = authorization.partition(" ")
        if scheme.lower() == "bearer" and credentials.strip():
            return credentials.strip()

    cookie_token = request.cookies.get("cronos_access_token")
    return cookie_token.strip() if cookie_token else None


async def get_authenticated_user(
    request: Request,
    authorization: str | None = Header(default=None),
) -> AuthenticatedUser:
    token = _bearer_token(authorization, request)
    supabase_url = os.getenv("SUPABASE_URL")
    anon_key = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")

    if not token or not supabase_url or not anon_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{supabase_url.rstrip('/')}/auth/v1/user",
                headers={"Authorization": f"Bearer {token}", "apikey": anon_key},
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Unable to validate session") from exc

    if response.status_code != 200:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired session")

    payload = response.json()
    user_id = payload.get("id")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")

    app_metadata = payload.get("app_metadata") if isinstance(payload.get("app_metadata"), dict) else {}
    role = app_metadata.get("role")

    return AuthenticatedUser(
        id=user_id,
        email=payload.get("email") if isinstance(payload.get("email"), str) else None,
        role=role if isinstance(role, str) else None,
    )


def require_admin(
    extra_roles: Iterable[str] = ("admin", "administrator", "editor"),
):
    async def dependency(user: AuthenticatedUser = Depends(get_authenticated_user)) -> AuthenticatedUser:
        allowed_roles = set(extra_roles)
        allowed_ids = _parse_csv(os.getenv("ADMIN_USER_IDS"))
        allowed_emails = {item.lower() for item in _parse_csv(os.getenv("ADMIN_EMAILS"))}

        is_role_allowed = user.role in allowed_roles
        is_id_allowed = user.id in allowed_ids
        is_email_allowed = bool(user.email and user.email.lower() in allowed_emails)

        if not (is_role_allowed or is_id_allowed or is_email_allowed):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
        return user

    return Depends(dependency)
