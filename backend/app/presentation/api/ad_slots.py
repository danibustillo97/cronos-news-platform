"""Ad slots and campaigns.

Public:
  GET  /api/ads/slots                 every slot with its device sizes and the creative to show now
  POST /api/ads/campaigns/{id}/event  {type: "impression"|"click"}  (best-effort counters)

Admin (require_admin):
  GET    /api/admin/ads/slots                    slots + enabled + all campaigns
  PUT    /api/admin/ads/slots/{placement}        {enabled}
  GET    /api/admin/ads/spec-sheet               rows for the advertiser spec sheet
  POST   /api/admin/ads/upload-url               signed upload for a creative image
  POST   /api/admin/ads/campaigns                create
  PATCH  /api/admin/ads/campaigns/{id}           edit / pause
  DELETE /api/admin/ads/campaigns/{id}
"""
from __future__ import annotations

import random
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import Field

from app.container import Container, get_container
from app.domain.ads.slots import BY_PLACEMENT, DEVICES, SLOTS, spec_out, spec_sheet_rows
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/ads", tags=["ad-slots"])
admin_router = APIRouter(prefix="/api/admin/ads", tags=["ad-slots-admin"])

IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class CampaignIn(CamelModel):
    placement: str
    advertiser: str = Field(min_length=1, max_length=120)
    href: str = Field(min_length=9, max_length=1000)
    alt: str | None = Field(default=None, max_length=200)
    image_mobile: str | None = None
    image_tablet: str | None = None
    image_desktop: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    weight: int = Field(default=1, ge=1, le=100)
    active: bool = True


class CampaignPatch(CamelModel):
    advertiser: str | None = Field(default=None, min_length=1, max_length=120)
    href: str | None = Field(default=None, min_length=9, max_length=1000)
    alt: str | None = Field(default=None, max_length=200)
    image_mobile: str | None = None
    image_tablet: str | None = None
    image_desktop: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    weight: int | None = Field(default=None, ge=1, le=100)
    active: bool | None = None


class SlotSettingIn(CamelModel):
    enabled: bool


class UploadIn(CamelModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str


class EventIn(CamelModel):
    type: str


def _client(container: Container):
    return container.news_repo._client


def _run(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as exc:
        text = str(exc)
        if ("ad_campaigns" in text or "ad_slot_settings" in text) and any(c in text for c in ("PGRST205", "42P01", "does not exist")):
            raise HTTPException(status_code=503, detail="Faltan las tablas de anuncios: ejecuta migrations/20261125_ad_campaigns.sql en Supabase.") from exc
        raise


def campaign_out(row: dict) -> dict:
    return {
        "id": row["id"], "placement": row["placement"], "advertiser": row["advertiser"], "href": row["href"], "alt": row.get("alt"),
        "images": {"mobile": row.get("image_mobile"), "tablet": row.get("image_tablet"), "desktop": row.get("image_desktop")},
        "startsAt": row.get("starts_at"), "endsAt": row.get("ends_at"), "weight": row.get("weight") or 1,
        "active": bool(row.get("active", True)), "impressions": row.get("impressions") or 0, "clicks": row.get("clicks") or 0,
    }


def is_live(row: dict, now: datetime) -> bool:
    if not row.get("active", True):
        return False
    for key, cmp in (("starts_at", lambda t: t <= now), ("ends_at", lambda t: t > now)):
        value = row.get(key)
        if value and not cmp(datetime.fromisoformat(str(value).replace("Z", "+00:00"))):
            return False
    return True


def pick_creative(rows: list[dict], now: datetime, rng: random.Random) -> dict | None:
    live = [r for r in rows if is_live(r, now)]
    if not live:
        return None
    return rng.choices(live, weights=[max(1, r.get("weight") or 1) for r in live], k=1)[0]


def _validate(body: CampaignIn | CampaignPatch, placement: str | None) -> None:
    if placement is not None and placement not in BY_PLACEMENT:
        raise HTTPException(status_code=422, detail="Espacio desconocido")
    if body.href is not None and not re.match(r"^https://", body.href):
        raise HTTPException(status_code=422, detail="El enlace del anuncio debe empezar con https://")
    if body.starts_at and body.ends_at and body.ends_at <= body.starts_at:
        raise HTTPException(status_code=422, detail="La fecha de fin debe ser posterior a la de inicio")
    if placement is not None:
        spec = BY_PLACEMENT[placement]
        for device in DEVICES:
            if getattr(body, f"image_{device}") and getattr(spec, device) is None:
                raise HTTPException(status_code=422, detail=f"Este espacio no se muestra en {device}")


# ---------------------------------------------------------------- public

@router.get("/slots")
def public_slots(response: Response, container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    try:
        settings = {r["placement"]: r["enabled"] for r in client.table("ad_slot_settings").select("*").execute().data or []}
        campaigns = client.table("ad_campaigns").select("*").eq("active", True).execute().data or []
    except Exception:  # noqa: BLE001 -- before the migration: slots without creatives, never an error on the portal
        settings, campaigns = {}, []
    now = datetime.now(timezone.utc)
    rng = random.Random()
    out = []
    for spec in SLOTS:
        rows = [c for c in campaigns if c["placement"] == spec.placement]
        chosen = pick_creative(rows, now, rng)
        out.append({**spec_out(spec), "enabled": settings.get(spec.placement, True),
                    "creative": None if not chosen else {
                        "campaignId": chosen["id"], "advertiser": chosen["advertiser"], "href": chosen["href"], "alt": chosen.get("alt") or chosen["advertiser"],
                        "imageMobile": chosen.get("image_mobile"), "imageTablet": chosen.get("image_tablet"), "imageDesktop": chosen.get("image_desktop")}})
    response.headers["Cache-Control"] = "public, max-age=60"
    return {"slots": out}


@router.post("/campaigns/{campaign_id}/event", status_code=204)
def track_event(campaign_id: str, body: EventIn, container: Container = Depends(get_container)) -> None:
    if body.type not in ("impression", "click"):
        raise HTTPException(status_code=422, detail="Evento inválido")
    column = "impressions" if body.type == "impression" else "clicks"
    client = _client(container)
    try:
        rows = client.table("ad_campaigns").select(column).eq("id", campaign_id).limit(1).execute().data or []
        if rows:
            client.table("ad_campaigns").update({column: (rows[0].get(column) or 0) + 1}).eq("id", campaign_id).execute()
    except Exception:  # noqa: BLE001 -- counters are best effort
        return


# ---------------------------------------------------------------- admin

@admin_router.get("/slots")
def admin_slots(container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    settings = {r["placement"]: r["enabled"] for r in _run(lambda: client.table("ad_slot_settings").select("*").execute().data or [])}
    campaigns = _run(lambda: client.table("ad_campaigns").select("*").order("created_at", desc=True).execute().data or [])
    now = datetime.now(timezone.utc)
    return {"slots": [{**spec_out(s), "enabled": settings.get(s.placement, True),
                       "campaigns": [{**campaign_out(c), "live": is_live(c, now)} for c in campaigns if c["placement"] == s.placement]}
                      for s in SLOTS]}


@admin_router.put("/slots/{placement}")
def admin_slot_setting(placement: str, body: SlotSettingIn, container: Container = Depends(get_container)) -> dict:
    if placement not in BY_PLACEMENT:
        raise HTTPException(status_code=404, detail="Espacio desconocido")
    _run(lambda: _client(container).table("ad_slot_settings").upsert(
        {"placement": placement, "enabled": body.enabled, "updated_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="placement").execute())
    return {"placement": placement, "enabled": body.enabled}


@admin_router.get("/spec-sheet")
def admin_spec_sheet() -> dict:
    return {"rows": spec_sheet_rows()}


@admin_router.post("/upload-url")
def admin_upload_url(body: UploadIn, container: Container = Depends(get_container)) -> dict:
    ext = IMAGE_TYPES.get(body.content_type.split(";")[0].strip().lower())
    if ext is None:
        raise HTTPException(status_code=422, detail="Formato no permitido: usa JPG, PNG o WebP")
    stem = re.sub(r"[^a-z0-9]+", "-", body.filename.rsplit(".", 1)[0].lower()).strip("-")[:50] or "anuncio"
    path = f"ads/{uuid.uuid4().hex[:10]}-{stem}.{ext}"
    bucket = _client(container).storage.from_("media")
    signed = bucket.create_signed_upload_url(path)
    token = signed.get("token") if isinstance(signed, dict) else getattr(signed, "token", None)
    return {"path": path, "token": token, "publicUrl": bucket.get_public_url(path)}


def _row(body: CampaignIn | CampaignPatch) -> dict:
    data = body.model_dump(exclude_unset=True)
    for key in ("starts_at", "ends_at"):
        if isinstance(data.get(key), datetime):
            data[key] = data[key].isoformat()
    return data


@admin_router.post("/campaigns", status_code=201)
def admin_create(body: CampaignIn, container: Container = Depends(get_container)) -> dict:
    _validate(body, body.placement)
    if not (body.image_mobile or body.image_tablet or body.image_desktop):
        raise HTTPException(status_code=422, detail="Sube al menos una imagen")
    rows = _run(lambda: _client(container).table("ad_campaigns").insert(_row(body)).execute().data or [])
    return campaign_out(rows[0])


@admin_router.patch("/campaigns/{campaign_id}")
def admin_update(campaign_id: str, body: CampaignPatch, container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    current = _run(lambda: client.table("ad_campaigns").select("*").eq("id", campaign_id).limit(1).execute().data or [])
    if not current:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
    _validate(body, current[0]["placement"])
    data = _row(body)
    if not data:
        raise HTTPException(status_code=422, detail="Nada que actualizar")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    rows = _run(lambda: client.table("ad_campaigns").update(data).eq("id", campaign_id).execute().data or [])
    return campaign_out(rows[0])


@admin_router.delete("/campaigns/{campaign_id}", status_code=204)
def admin_delete(campaign_id: str, container: Container = Depends(get_container)) -> None:
    rows = _run(lambda: _client(container).table("ad_campaigns").delete().eq("id", campaign_id).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Campaña no encontrada")
