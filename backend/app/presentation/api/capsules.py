"""Capsules for the reels feed: efemérides, "¿Sabías que?" and legends.

Public:
  GET /api/capsules/feed?limit=12      today's efemérides first, then a fresh mix
  GET /api/capsules?kind=leyenda       published capsules of one kind (e.g. /leyendas)
  GET /api/capsules/{id}

Admin (mounted with require_admin):
  GET    /api/admin/capsules
  POST   /api/admin/capsules
  PATCH  /api/admin/capsules/{id}
  DELETE /api/admin/capsules/{id}
  POST   /api/admin/capsules/ai          same "prompt in, raw text out" contract as polls
"""
from __future__ import annotations

import random
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import Field

from app.container import Container, get_container
from app.domain.ports import ArtifactGenerationUnavailableError
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/capsules", tags=["capsules"])
admin_router = APIRouter(prefix="/api/admin/capsules", tags=["capsules-admin"])

TABLE = "capsules"
KINDS = ("efemeride", "sabias_que", "leyenda", "momento")
STATUSES = ("draft", "published")
_DAY = re.compile(r"^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$")
_TZ = timezone(timedelta(hours=-5), "America/Bogota")  # audience's "today"; Colombia has no DST


class Slide(CamelModel):
    text: str = Field(min_length=1, max_length=320)
    image: str | None = Field(default=None, max_length=1000)


class CapsuleIn(CamelModel):
    kind: str
    title: str = Field(min_length=3, max_length=140)
    subject: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1850, le=2100)
    day: str | None = None
    slides: list[Slide] = Field(min_length=1, max_length=8)
    tags: list[str] = Field(default_factory=list, max_length=12)
    caption: str | None = Field(default=None, max_length=2200)
    sources: str | None = Field(default=None, max_length=1000)
    status: str = "draft"


class CapsulePatch(CamelModel):
    title: str | None = Field(default=None, min_length=3, max_length=140)
    subject: str | None = Field(default=None, max_length=120)
    year: int | None = Field(default=None, ge=1850, le=2100)
    day: str | None = None
    slides: list[Slide] | None = Field(default=None, min_length=1, max_length=8)
    tags: list[str] | None = Field(default=None, max_length=12)
    caption: str | None = Field(default=None, max_length=2200)
    sources: str | None = Field(default=None, max_length=1000)
    status: str | None = None


class UploadUrlIn(CamelModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str


IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class AiIn(CamelModel):
    prompt: str = Field(min_length=20, max_length=16000)
    provider: str | None = None


def _client(container: Container):
    return container.news_repo._client


def _run(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as exc:
        text = str(exc)
        if TABLE in text and any(code in text for code in ("does not exist", "PGRST205", "PGRST200", "42P01")):
            raise HTTPException(status_code=503, detail="Falta la tabla capsules: ejecuta migrations/20261124d_capsules.sql en Supabase.") from exc
        raise


def capsule_out(row: dict) -> dict:
    return {
        "id": row["id"], "kind": row["kind"], "title": row["title"], "subject": row.get("subject"),
        "year": row.get("year"), "date": row.get("day"), "slides": row.get("slides") or [],
        "tags": row.get("tags") or [], "caption": row.get("caption"), "sources": row.get("sources"),
        "status": row.get("status") or "draft", "createdAt": row.get("created_at"),
    }


def _public(row: dict) -> dict:
    out = capsule_out(row)
    out.pop("status")
    out.pop("sources")
    return out


def _validate(kind: str | None, status: str | None, day: str | None, year: int | None) -> None:
    if kind is not None and kind not in KINDS:
        raise HTTPException(status_code=422, detail="Tipo inválido: efeméride, ¿sabías que?, leyenda o momento histórico")
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")
    if day is not None and day != "" and not _DAY.match(day):
        raise HTTPException(status_code=422, detail="La fecha de la efeméride va como MM-DD (ej. 07-05)")
    if kind == "efemeride" and (not day or not year):
        raise HTTPException(status_code=422, detail="Una efeméride necesita día (MM-DD) y año")


def compose_feed(rows: list[dict], today: str, limit: int, rng: random.Random) -> list[dict]:
    """Today's efemérides first (oldest year first = best story), then the rest
    alternating kinds, freshest-weighted but shuffled so the feed doesn't feel static."""
    todays = sorted((r for r in rows if r["kind"] == "efemeride" and r.get("day") == today), key=lambda r: r.get("year") or 0)
    rest = [r for r in rows if not (r["kind"] == "efemeride" and r.get("day") == today) and r["kind"] != "efemeride"]
    by_kind: dict[str, list[dict]] = {}
    for r in rest:
        by_kind.setdefault(r["kind"], []).append(r)
    for items in by_kind.values():
        head, tail = items[:6], items[6:]
        rng.shuffle(head)
        items[:] = head + tail
    mixed: list[dict] = []
    while any(by_kind.values()) and len(mixed) + len(todays) < limit:
        for kind in ("sabias_que", "momento", "leyenda"):
            if by_kind.get(kind):
                mixed.append(by_kind[kind].pop(0))
    return (todays + mixed)[:limit]


# ---------------------------------------------------------------- public

@router.get("/feed")
def feed(response: Response, limit: int = Query(12, ge=1, le=40), container: Container = Depends(get_container)) -> dict:
    rows = _run(lambda: _client(container).table(TABLE).select("*").eq("status", "published")
                .order("created_at", desc=True).limit(300).execute().data or [])
    today = datetime.now(_TZ).strftime("%m-%d")
    seed = int(datetime.now(_TZ).strftime("%Y%m%d%H"))  # stable for an hour so pages and caches agree
    response.headers["Cache-Control"] = "public, max-age=120"
    return {"capsules": [_public(r) for r in compose_feed(rows, today, limit, random.Random(seed))], "today": today}


@router.get("")
def list_capsules(response: Response, kind: str = Query(...), limit: int = Query(60, ge=1, le=200),
                  container: Container = Depends(get_container)) -> dict:
    _validate(kind, None, None, None)
    rows = _run(lambda: _client(container).table(TABLE).select("*").eq("status", "published").eq("kind", kind)
                .order("created_at", desc=True).limit(limit).execute().data or [])
    response.headers["Cache-Control"] = "public, max-age=120"
    return {"capsules": [_public(r) for r in rows]}


@router.get("/{capsule_id}")
def get_capsule(capsule_id: str, container: Container = Depends(get_container)) -> dict:
    rows = _run(lambda: _client(container).table(TABLE).select("*").eq("id", capsule_id).limit(1).execute().data or [])
    if not rows or rows[0].get("status") != "published":
        raise HTTPException(status_code=404, detail="Cápsula no encontrada")
    return _public(rows[0])


# ---------------------------------------------------------------- admin

def _payload(body: CapsuleIn | CapsulePatch) -> dict:
    data = body.model_dump(exclude_unset=True)
    if "slides" in data and data["slides"] is not None:
        data["slides"] = [{"text": s["text"].strip(), "image": (s.get("image") or "").strip() or None} for s in data["slides"]]
    if "tags" in data and data["tags"] is not None:
        data["tags"] = [t.strip().lstrip("#") for t in data["tags"] if t.strip()][:12]
    for key in ("title", "subject", "caption", "sources"):
        if isinstance(data.get(key), str):
            data[key] = data[key].strip() or None
    if "day" in data:
        data["day"] = data["day"] or None
    return data


@admin_router.get("")
def admin_list(container: Container = Depends(get_container)) -> list[dict]:
    rows = _run(lambda: _client(container).table(TABLE).select("*").order("created_at", desc=True).limit(500).execute().data or [])
    return [capsule_out(r) for r in rows]


@admin_router.post("", status_code=201)
def admin_create(body: CapsuleIn, container: Container = Depends(get_container)) -> dict:
    _validate(body.kind, body.status, body.day, body.year)
    rows = _run(lambda: _client(container).table(TABLE).insert(_payload(body)).execute().data or [])
    return capsule_out(rows[0])


@admin_router.patch("/{capsule_id}")
def admin_update(capsule_id: str, body: CapsulePatch, container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    current = _run(lambda: client.table(TABLE).select("*").eq("id", capsule_id).limit(1).execute().data or [])
    if not current:
        raise HTTPException(status_code=404, detail="Cápsula no encontrada")
    data = _payload(body)
    merged_day = data.get("day", current[0].get("day"))
    merged_year = data.get("year", current[0].get("year"))
    _validate(current[0]["kind"], data.get("status"), merged_day, merged_year)
    if not data:
        raise HTTPException(status_code=422, detail="Nada que actualizar")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    rows = _run(lambda: client.table(TABLE).update(data).eq("id", capsule_id).execute().data or [])
    return capsule_out(rows[0])


@admin_router.delete("/{capsule_id}", status_code=204)
def admin_delete(capsule_id: str, container: Container = Depends(get_container)) -> None:
    rows = _run(lambda: _client(container).table(TABLE).delete().eq("id", capsule_id).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Cápsula no encontrada")


@admin_router.post("/upload-url")
def admin_upload_url(body: UploadUrlIn, container: Container = Depends(get_container)) -> dict:
    """Signed URL so the browser uploads slide images straight to Storage (no body-size limit)."""
    ext = IMAGE_TYPES.get(body.content_type.split(";")[0].strip().lower())
    if ext is None:
        raise HTTPException(status_code=422, detail="Formato no permitido: usa JPG, PNG o WEBP")
    stem = re.sub(r"[^a-z0-9]+", "-", body.filename.rsplit(".", 1)[0].lower()).strip("-")[:50] or "imagen"
    path = f"capsules/{uuid.uuid4().hex[:10]}-{stem}.{ext}"
    bucket = _client(container).storage.from_("media")
    signed = bucket.create_signed_upload_url(path)
    token = signed.get("token") if isinstance(signed, dict) else getattr(signed, "token", None)
    return {"path": path, "token": token, "publicUrl": bucket.get_public_url(path)}


@admin_router.post("/ai")
def admin_ai(body: AiIn, container: Container = Depends(get_container)) -> dict:
    resolver = container.artifact_provider_resolver
    provider_id = resolver.resolve(body.provider)
    try:
        text = resolver.get(provider_id).complete_text(body.prompt, max_tokens=2500, timeout=150.0)
    except ArtifactGenerationUnavailableError as exc:
        raise HTTPException(status_code=503, detail=f"La IA no respondió: {exc}") from exc
    return {"text": text, "provider": getattr(provider_id, "value", str(provider_id))}
