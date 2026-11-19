from __future__ import annotations

# Real, best-effort visitor geolocation -- server-side IP lookup only,
# never a browser GPS prompt. A thin read-through proxy to a public geo-IP
# service (ipapi.co), same shape as sports.py: no domain entity, no
# repository, fails soft to `null` on any error (private/local IP,
# service down, rate-limited) so the homepage's "Cerca de ti" module can
# just hide itself instead of showing a broken or fabricated location.

import ipaddress

import httpx
from fastapi import APIRouter, Request

router = APIRouter(prefix="/api/location", tags=["location"])

_GEOIP_URL = "https://ipapi.co/{ip}/json/"


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def _is_public(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved)


@router.get("/resolve")
async def resolve_location(request: Request) -> dict | None:
    ip = _client_ip(request)
    if not ip or not _is_public(ip):
        return None

    try:
        async with httpx.AsyncClient() as client:
            res = await client.get(_GEOIP_URL.format(ip=ip), timeout=5.0)
            res.raise_for_status()
            data = res.json()
    except Exception:
        return None

    if data.get("error") or not data.get("city"):
        return None

    return {
        "city": data.get("city"),
        "region": data.get("region"),
        "country": data.get("country_name"),
    }
