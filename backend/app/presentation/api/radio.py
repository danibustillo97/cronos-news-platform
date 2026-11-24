"""Radio station music library (admin only).

GET    /api/radio/tracks                 library
POST   /api/radio/tracks/upload-url      signed URL so the browser uploads the file straight to Storage
POST   /api/radio/tracks                 register an uploaded file (metadata)
PATCH  /api/radio/tracks/{id}            edit metadata / enable-disable
DELETE /api/radio/tracks/{id}            remove (row + file)
POST   /api/radio/tracks/{id}/played     rotation stats for the auto DJ

Files live in the public `media` bucket under radio/ (they must be publicly
fetchable to play). Only royalty-free / licensed music: the `license` field
records where each track's rights come from.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import Field

from app.container import Container, get_container
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/radio", tags=["radio"])

BUCKET = "media"
KINDS = ("song", "jingle", "station_id", "promo", "bed")
AUDIO_TYPES = {"audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/aac": "aac", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
               "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm", "audio/flac": "flac"}
TABLE = "radio_tracks"


class UploadUrlRequest(CamelModel):
    filename: str = Field(min_length=1, max_length=200)
    content_type: str


class TrackIn(CamelModel):
    title: str = Field(min_length=1, max_length=200)
    artist: str = Field(default="", max_length=200)
    kind: str = "song"
    url: str
    storage_path: str | None = None
    duration_s: float | None = Field(default=None, ge=0, le=7200)
    energy: int = Field(default=3, ge=1, le=5)
    mood: str | None = Field(default=None, max_length=40)
    tags: list[str] = Field(default_factory=list, max_length=20)
    license: str = Field(default="", max_length=300)


class TrackPatch(CamelModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    artist: str | None = Field(default=None, max_length=200)
    kind: str | None = None
    energy: int | None = Field(default=None, ge=1, le=5)
    mood: str | None = Field(default=None, max_length=40)
    tags: list[str] | None = None
    license: str | None = Field(default=None, max_length=300)
    active: bool | None = None
    duration_s: float | None = Field(default=None, ge=0, le=7200)


def _client(container: Container):
    return container.news_repo._client  # same secret-key Supabase client as every repository


def _out(row: dict) -> dict:
    return {
        "id": row["id"], "title": row["title"], "artist": row.get("artist") or "", "kind": row["kind"],
        "url": row["url"], "storagePath": row.get("storage_path"), "durationS": row.get("duration_s"),
        "energy": row.get("energy") or 3, "mood": row.get("mood"), "tags": row.get("tags") or [],
        "license": row.get("license") or "", "active": bool(row.get("active", True)),
        "playCount": row.get("play_count") or 0, "lastPlayedAt": row.get("last_played_at"),
    }


def _schema_error(exc: Exception) -> HTTPException | None:
    text = str(exc)
    if TABLE in text and ("does not exist" in text or "PGRST205" in text or "42P01" in text):
        return HTTPException(status_code=503, detail="Falta la tabla radio_tracks: ejecuta migrations/20261124b_radio_tracks.sql en Supabase.")
    return None


def _check_kind(kind: str | None) -> None:
    if kind is not None and kind not in KINDS:
        raise HTTPException(status_code=422, detail=f"tipo de pista inválido: {kind!r}")


@router.get("/tracks")
def list_tracks(container: Container = Depends(get_container)) -> list[dict]:
    try:
        rows = _client(container).table(TABLE).select("*").order("created_at", desc=True).limit(2000).execute().data or []
    except Exception as exc:
        err = _schema_error(exc)
        if err:
            raise err from exc
        raise
    return [_out(r) for r in rows]


@router.post("/tracks/upload-url")
def create_upload_url(body: UploadUrlRequest, container: Container = Depends(get_container)) -> dict:
    ext = AUDIO_TYPES.get(body.content_type.split(";")[0].strip().lower())
    if ext is None:
        raise HTTPException(status_code=422, detail="Formato no permitido: usa MP3, AAC/M4A, OGG, WAV, WEBM o FLAC")
    stem = re.sub(r"[^a-z0-9]+", "-", body.filename.rsplit(".", 1)[0].lower()).strip("-")[:60] or "pista"
    path = f"radio/{uuid.uuid4().hex[:10]}-{stem}.{ext}"
    bucket = _client(container).storage.from_(BUCKET)
    signed = bucket.create_signed_upload_url(path)
    token = signed.get("token") if isinstance(signed, dict) else getattr(signed, "token", None)
    return {"path": path, "token": token, "publicUrl": bucket.get_public_url(path)}


@router.post("/tracks")
def register_track(body: TrackIn, container: Container = Depends(get_container)) -> dict:
    _check_kind(body.kind)
    if not body.url.lower().startswith("https://"):
        raise HTTPException(status_code=422, detail="La URL de la pista debe ser https")
    payload = {
        "title": body.title.strip(), "artist": body.artist.strip(), "kind": body.kind, "url": body.url,
        "storage_path": body.storage_path, "duration_s": body.duration_s, "energy": body.energy,
        "mood": body.mood, "tags": [t.strip() for t in body.tags if t.strip()][:20], "license": body.license.strip(),
    }
    try:
        rows = _client(container).table(TABLE).insert(payload).execute().data or []
    except Exception as exc:
        err = _schema_error(exc)
        if err:
            raise err from exc
        raise
    return _out(rows[0])


@router.patch("/tracks/{track_id}")
def update_track(track_id: str, body: TrackPatch, container: Container = Depends(get_container)) -> dict:
    _check_kind(body.kind)
    patch = {k: v for k, v in {
        "title": body.title, "artist": body.artist, "kind": body.kind, "energy": body.energy, "mood": body.mood,
        "tags": body.tags, "license": body.license, "active": body.active, "duration_s": body.duration_s,
    }.items() if v is not None}
    if not patch:
        raise HTTPException(status_code=422, detail="nada que actualizar")
    rows = _client(container).table(TABLE).update(patch).eq("id", track_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="pista no encontrada")
    return _out(rows[0])


@router.delete("/tracks/{track_id}", status_code=204)
def delete_track(track_id: str, container: Container = Depends(get_container)) -> None:
    client = _client(container)
    rows = client.table(TABLE).select("storage_path").eq("id", track_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="pista no encontrada")
    path = rows[0].get("storage_path")
    if path and path.startswith("radio/"):
        try:
            client.storage.from_(BUCKET).remove([path])
        except Exception:  # noqa: BLE001 -- the row is removed anyway; an orphan file is harmless
            pass
    client.table(TABLE).delete().eq("id", track_id).execute()


@router.post("/tracks/{track_id}/played")
def mark_played(track_id: str, container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    rows = client.table(TABLE).select("play_count").eq("id", track_id).execute().data or []
    if not rows:
        raise HTTPException(status_code=404, detail="pista no encontrada")
    now = datetime.now(timezone.utc).isoformat()
    client.table(TABLE).update({"play_count": (rows[0].get("play_count") or 0) + 1, "last_played_at": now}).eq("id", track_id).execute()
    return {"ok": True, "lastPlayedAt": now}
