"""Reactions and comments for feed items (news, capsules, polls, picks).

Public:
  GET  /api/social/{type}/{id}?voterId=…          counts, my reaction, latest visible comments
  POST /api/social/{type}/{id}/react     {voterId, reaction|null}
  POST /api/social/{type}/{id}/comments  {voterId, author, body}

Admin (mounted with require_admin):
  GET    /api/admin/comments?status=pending
  PATCH  /api/admin/comments/{id}   {status}
  DELETE /api/admin/comments/{id}

Anonymous like poll votes: only a salted hash of the browser id is stored.
Comments: rate-limited per voter; links or blocked words -> "pending" until a
moderator approves them, so the feed never shows spam.
"""
from __future__ import annotations

import hashlib
import os
import re
import unicodedata
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field

from app.container import Container, get_container
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/social", tags=["social"])
admin_router = APIRouter(prefix="/api/admin/comments", tags=["social-admin"])

TYPES = ("news", "capsule", "poll", "picks")
REACTIONS = ("fire", "goal", "wow", "clap", "laugh", "sad")
STATUSES = ("visible", "pending", "hidden")
COOLDOWN_S = 20
DAILY_MAX = 40
_LINK = re.compile(r"(https?://|www\.|\b[a-z0-9-]+\.(com|co|net|org|io|xyz|ly)\b)", re.I)
# Short, conservative list; anything matching goes to moderation, not deleted.
_BLOCKED = ("hijueputa", "hpta", "gonorrea", "malparido", "puta", "marica", "estupido", "idiota", "imbecil", "perra", "verga", "mierda")


class ReactIn(CamelModel):
    voter_id: str = Field(min_length=8, max_length=80)
    reaction: str | None = None


class CommentIn(CamelModel):
    voter_id: str = Field(min_length=8, max_length=80)
    author: str = Field(min_length=2, max_length=40)
    body: str = Field(min_length=1, max_length=500)


class StatusIn(CamelModel):
    status: str


def _client(container: Container):
    return container.news_repo._client


def _run(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as exc:
        text = str(exc)
        if any(t in text for t in ("reactions", "comments", "reaction_counts")) and any(
            c in text for c in ("does not exist", "PGRST205", "PGRST202", "42P01", "42883")
        ):
            raise HTTPException(status_code=503, detail="Faltan las tablas sociales: ejecuta migrations/20261124e_social.sql en Supabase.") from exc
        raise


def _hash(voter_id: str) -> str:
    salt = os.getenv("POLL_SALT") or os.getenv("SUPABASE_URL") or "nexus"
    return hashlib.sha256(f"{salt}|social|{voter_id}".encode()).hexdigest()


def _check_target(target_type: str, target_id: str) -> None:
    if target_type not in TYPES or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,80}", target_id):
        raise HTTPException(status_code=404, detail="Contenido no encontrado")


def _fold(text: str) -> str:
    return unicodedata.normalize("NFD", text).encode("ascii", "ignore").decode().lower()


def moderation_status(author: str, body: str) -> str:
    text = _fold(f"{author} {body}")
    words = set(re.findall(r"[a-z]+", text))
    if _LINK.search(body) or _LINK.search(author) or any(w in words for w in _BLOCKED):
        return "pending"
    return "visible"


def _comment_out(row: dict) -> dict:
    return {"id": row["id"], "author": row["author"], "body": row["body"], "createdAt": row.get("created_at")}


def _summary(client, target_type: str, target_id: str, voter_hash: str | None) -> dict:
    counts_rows = client.rpc("reaction_counts", {"p_type": target_type, "p_id": target_id}).execute().data or []
    counts = {r: 0 for r in REACTIONS}
    for row in counts_rows:
        if row.get("reaction") in counts:
            counts[row["reaction"]] = int(row.get("n") or 0)
    mine = None
    if voter_hash:
        own = client.table("reactions").select("reaction").eq("target_type", target_type).eq("target_id", target_id) \
            .eq("voter_hash", voter_hash).limit(1).execute().data or []
        mine = own[0]["reaction"] if own else None
    comments = client.table("comments").select("id,author,body,created_at").eq("target_type", target_type) \
        .eq("target_id", target_id).eq("status", "visible").order("created_at", desc=True).limit(50).execute().data or []
    return {"counts": counts, "total": sum(counts.values()), "mine": mine,
            "comments": [_comment_out(c) for c in comments], "commentCount": len(comments)}


@router.get("/{target_type}/{target_id}")
def get_social(target_type: str, target_id: str, voter_id: str | None = Query(None, alias="voterId"),
               container: Container = Depends(get_container)) -> dict:
    _check_target(target_type, target_id)
    voter = _hash(voter_id) if voter_id and 8 <= len(voter_id) <= 80 else None
    return _run(lambda: _summary(_client(container), target_type, target_id, voter))


@router.post("/{target_type}/{target_id}/react")
def react(target_type: str, target_id: str, body: ReactIn, container: Container = Depends(get_container)) -> dict:
    _check_target(target_type, target_id)
    if body.reaction is not None and body.reaction not in REACTIONS:
        raise HTTPException(status_code=422, detail="Reacción inválida")
    client = _client(container)
    voter = _hash(body.voter_id)

    def go():
        base = client.table("reactions")
        if body.reaction is None:
            base.delete().eq("target_type", target_type).eq("target_id", target_id).eq("voter_hash", voter).execute()
        else:
            base.upsert({"target_type": target_type, "target_id": target_id, "voter_hash": voter, "reaction": body.reaction},
                        on_conflict="target_type,target_id,voter_hash").execute()
        return _summary(client, target_type, target_id, voter)

    return _run(go)


@router.post("/{target_type}/{target_id}/comments", status_code=201)
def comment(target_type: str, target_id: str, body: CommentIn, container: Container = Depends(get_container)) -> dict:
    _check_target(target_type, target_id)
    author = " ".join(body.author.split())
    text = body.body.strip()
    if len(author) < 2 or not text:
        raise HTTPException(status_code=422, detail="Escribe tu nombre y el comentario")
    client = _client(container)
    voter = _hash(body.voter_id)
    now = datetime.now(timezone.utc)

    def go():
        recent = client.table("comments").select("created_at").eq("voter_hash", voter) \
            .gte("created_at", (now - timedelta(days=1)).isoformat()).order("created_at", desc=True).limit(DAILY_MAX).execute().data or []
        if recent:
            last = datetime.fromisoformat(str(recent[0]["created_at"]).replace("Z", "+00:00"))
            if (now - last).total_seconds() < COOLDOWN_S:
                raise HTTPException(status_code=429, detail="Espera unos segundos antes de comentar de nuevo")
            if len(recent) >= DAILY_MAX:
                raise HTTPException(status_code=429, detail="Llegaste al límite de comentarios de hoy")
        status = moderation_status(author, text)
        row = client.table("comments").insert({"target_type": target_type, "target_id": target_id, "author": author,
                                               "body": text, "voter_hash": voter, "status": status}).execute().data[0]
        return {**_comment_out(row), "status": status,
                "message": None if status == "visible" else "Tu comentario quedó en revisión y aparecerá cuando lo aprobemos."}

    return _run(go)


@admin_router.get("")
def admin_comments(status: str = Query("pending"), container: Container = Depends(get_container)) -> list[dict]:
    if status not in STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")
    rows = _run(lambda: _client(container).table("comments").select("*").eq("status", status)
                .order("created_at", desc=True).limit(200).execute().data or [])
    return [{**_comment_out(r), "status": r["status"], "targetType": r["target_type"], "targetId": r["target_id"]} for r in rows]


@admin_router.patch("/{comment_id}")
def admin_set_status(comment_id: str, body: StatusIn, container: Container = Depends(get_container)) -> dict:
    if body.status not in STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")
    rows = _run(lambda: _client(container).table("comments").update({"status": body.status}).eq("id", comment_id).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
    return {**_comment_out(rows[0]), "status": rows[0]["status"]}


@admin_router.delete("/{comment_id}", status_code=204)
def admin_delete(comment_id: str, container: Container = Depends(get_container)) -> None:
    rows = _run(lambda: _client(container).table("comments").delete().eq("id", comment_id).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Comentario no encontrado")
