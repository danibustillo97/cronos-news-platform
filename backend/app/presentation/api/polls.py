"""Polls and debates.

Public:
  GET  /api/polls?placement=home&newsId=...   open/closed polls to show
  GET  /api/polls/{id}
  POST /api/polls/{id}/vote  {optionId, voterId}   -> poll with results; 409 {detail, poll} if already voted

Admin (router `admin_router`, mounted with require_admin):
  GET    /api/admin/polls
  POST   /api/admin/polls
  PATCH  /api/admin/polls/{id}
  DELETE /api/admin/polls/{id}

Voters are anonymous: the browser keeps a random id and the backend stores only a
salted hash of it. One vote per id per poll, enforced atomically in Postgres
(cast_poll_vote). It's engagement, not an election: clearing browser storage
lets someone vote again, which is acceptable for a news portal.
"""
from __future__ import annotations

import hashlib
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from pydantic import Field

from app.container import Container, get_container
from app.presentation.schemas import CamelModel

router = APIRouter(prefix="/api/polls", tags=["polls"])
admin_router = APIRouter(prefix="/api/admin/polls", tags=["polls-admin"])

KINDS = ("poll", "debate")
STATUSES = ("draft", "open", "closed")
PLACEMENTS = ("home", "article", "pulse")
MAX_OPTIONS = 6
_SELECT = "*, poll_options(id, label, argument, position, votes)"


class OptionIn(CamelModel):
    id: str | None = None
    label: str = Field(min_length=1, max_length=120)
    argument: str | None = Field(default=None, max_length=400)


class PollIn(CamelModel):
    kind: str = "poll"
    question: str = Field(min_length=3, max_length=200)
    context: str | None = Field(default=None, max_length=600)
    status: str = "open"
    closes_at: datetime | None = None
    news_id: str | None = Field(default=None, max_length=80)
    featured: bool = False
    placement: list[str] = Field(default_factory=lambda: ["home"])
    options: list[OptionIn] = Field(min_length=2, max_length=MAX_OPTIONS)


class PollPatch(CamelModel):
    question: str | None = Field(default=None, min_length=3, max_length=200)
    context: str | None = Field(default=None, max_length=600)
    status: str | None = None
    closes_at: datetime | None = None
    clear_closes_at: bool = False
    news_id: str | None = Field(default=None, max_length=80)
    featured: bool | None = None
    placement: list[str] | None = None
    options: list[OptionIn] | None = Field(default=None, min_length=2, max_length=MAX_OPTIONS)


class VoteIn(CamelModel):
    option_id: str = Field(min_length=1, max_length=64)
    voter_id: str = Field(min_length=8, max_length=80)


def _client(container: Container):
    return container.news_repo._client


def _schema_error(exc: Exception) -> HTTPException | None:
    text = str(exc)
    if ("polls" in text or "poll_" in text or "cast_poll_vote" in text) and (
        "does not exist" in text or "PGRST205" in text or "PGRST200" in text or "PGRST202" in text or "42P01" in text or "42883" in text
    ):
        return HTTPException(status_code=503, detail="Faltan las tablas de encuestas: ejecuta migrations/20261124c_polls.sql en Supabase.")
    return None


def _run(fn):
    try:
        return fn()
    except HTTPException:
        raise
    except Exception as exc:
        err = _schema_error(exc)
        if err:
            raise err from exc
        raise


def _is_closed(row: dict, now: datetime | None = None) -> bool:
    if row.get("status") == "closed":
        return True
    closes = row.get("closes_at")
    if closes:
        when = datetime.fromisoformat(str(closes).replace("Z", "+00:00"))
        return when <= (now or datetime.now(timezone.utc))
    return False


def poll_out(row: dict) -> dict:
    options = sorted(row.get("poll_options") or [], key=lambda o: (o.get("position") or 0))
    total = sum(int(o.get("votes") or 0) for o in options)
    status = row.get("status") or "open"
    if status == "open" and _is_closed(row):
        status = "closed"
    return {
        "id": row["id"], "kind": row.get("kind") or "poll", "question": row["question"], "context": row.get("context"),
        "options": [{"id": o["id"], "label": o["label"], "argument": o.get("argument"), "votes": int(o.get("votes") or 0)}
                    for o in options],
        "totalVotes": total, "status": status, "closesAt": row.get("closes_at"), "newsId": row.get("news_id"),
        "featured": bool(row.get("featured")), "placement": row.get("placement") or [], "createdAt": row.get("created_at"),
    }


def _validate(kind: str | None, status: str | None, placement: list[str] | None, options: list[OptionIn] | None) -> None:
    if kind is not None and kind not in KINDS:
        raise HTTPException(status_code=422, detail="Tipo inválido: usa encuesta o debate")
    if status is not None and status not in STATUSES:
        raise HTTPException(status_code=422, detail="Estado inválido")
    if placement is not None and any(p not in PLACEMENTS for p in placement):
        raise HTTPException(status_code=422, detail="Ubicación inválida")
    if options is not None:
        labels = [o.label.strip().lower() for o in options]
        if len(set(labels)) != len(labels):
            raise HTTPException(status_code=422, detail="Hay opciones repetidas")
        if kind == "debate":
            if len(options) != 2:
                raise HTTPException(status_code=422, detail="Un debate tiene exactamente dos posturas")
            if any(not (o.argument or "").strip() for o in options):
                raise HTTPException(status_code=422, detail="Cada postura del debate necesita su argumento")


def _voter_hash(voter_id: str) -> str:
    salt = os.getenv("POLL_SALT") or os.getenv("SUPABASE_URL") or "nexus"
    return hashlib.sha256(f"{salt}|{voter_id}".encode()).hexdigest()


def _fetch(client, poll_id: str) -> dict | None:
    rows = client.table("polls").select(_SELECT).eq("id", poll_id).limit(1).execute().data or []
    return rows[0] if rows else None


# ---------------------------------------------------------------- public

@router.get("")
def list_polls(response: Response, placement: str | None = Query(None), news_id: str | None = Query(None, alias="newsId"),
               limit: int = Query(12, ge=1, le=50), container: Container = Depends(get_container)) -> dict:
    client = _client(container)

    def go():
        q = client.table("polls").select(_SELECT).in_("status", ["open", "closed"])
        if news_id:
            q = q.eq("news_id", news_id)
        elif placement:
            q = q.contains("placement", [placement])
        return q.order("featured", desc=True).order("created_at", desc=True).limit(limit).execute().data or []

    rows = _run(go)
    response.headers["Cache-Control"] = "public, max-age=15"
    return {"polls": [poll_out(r) for r in rows]}


@router.get("/{poll_id}")
def get_poll(poll_id: str, container: Container = Depends(get_container)) -> dict:
    row = _run(lambda: _fetch(_client(container), poll_id))
    if not row or row.get("status") == "draft":
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    return poll_out(row)


@router.post("/{poll_id}/vote")
def vote(poll_id: str, body: VoteIn, container: Container = Depends(get_container)):
    client = _client(container)
    result = _run(lambda: client.rpc("cast_poll_vote", {
        "p_poll": poll_id, "p_option": body.option_id, "p_voter": _voter_hash(body.voter_id),
    }).execute().data)
    row = _run(lambda: _fetch(client, poll_id))
    if result == "invalid" or not row or row.get("status") == "draft":
        raise HTTPException(status_code=404, detail="Encuesta u opción no encontrada")
    poll = poll_out(row)
    if result == "duplicate":
        return JSONResponse(status_code=409, content={"detail": "Ya votaste en esta encuesta", "poll": poll})
    if result == "closed":
        return JSONResponse(status_code=409, content={"detail": "La votación está cerrada", "poll": poll})
    return poll


# ---------------------------------------------------------------- admin

@admin_router.get("")
def admin_list(container: Container = Depends(get_container)) -> list[dict]:
    rows = _run(lambda: _client(container).table("polls").select(_SELECT).order("created_at", desc=True).limit(200).execute().data or [])
    return [poll_out(r) | {"status": r.get("status")} for r in rows]


def _options_payload(poll_id: str, options: list[OptionIn]) -> list[dict]:
    return [{"poll_id": poll_id, "label": o.label.strip(), "argument": (o.argument or "").strip() or None, "position": i}
            for i, o in enumerate(options)]


@admin_router.post("", status_code=201)
def admin_create(body: PollIn, container: Container = Depends(get_container)) -> dict:
    _validate(body.kind, body.status, body.placement, body.options)
    client = _client(container)
    payload = {
        "kind": body.kind, "question": body.question.strip(), "context": (body.context or "").strip() or None,
        "status": body.status, "closes_at": body.closes_at.isoformat() if body.closes_at else None,
        "news_id": body.news_id or None, "featured": body.featured, "placement": body.placement or ["home"],
    }
    poll = _run(lambda: client.table("polls").insert(payload).execute().data[0])
    _run(lambda: client.table("poll_options").insert(_options_payload(poll["id"], body.options)).execute())
    if body.featured:
        _unfeature_others(client, poll["id"])
    return poll_out(_fetch(client, poll["id"]) or poll)


def _unfeature_others(client, keep_id: str) -> None:
    client.table("polls").update({"featured": False}).neq("id", keep_id).eq("featured", True).execute()


@admin_router.patch("/{poll_id}")
def admin_update(poll_id: str, body: PollPatch, container: Container = Depends(get_container)) -> dict:
    client = _client(container)
    current = _run(lambda: _fetch(client, poll_id))
    if not current:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    _validate(current.get("kind"), body.status, body.placement, body.options)
    patch = {k: v for k, v in {
        "question": body.question.strip() if body.question else None,
        "context": body.context.strip() if body.context is not None else None,
        "status": body.status, "news_id": body.news_id, "featured": body.featured, "placement": body.placement,
        "closes_at": body.closes_at.isoformat() if body.closes_at else None,
    }.items() if v is not None}
    if body.clear_closes_at:
        patch["closes_at"] = None
    if body.news_id == "":
        patch["news_id"] = None
    if patch:
        patch["updated_at"] = datetime.now(timezone.utc).isoformat()
        _run(lambda: client.table("polls").update(patch).eq("id", poll_id).execute())
    if body.options is not None:
        _sync_options(client, poll_id, current.get("poll_options") or [], body.options)
    if body.featured:
        _unfeature_others(client, poll_id)
    return poll_out(_fetch(client, poll_id) or current)


def _sync_options(client, poll_id: str, existing: list[dict], options: list[OptionIn]) -> None:
    """Edit labels in place (keeps votes), add new ones, drop removed ones."""
    by_id = {o["id"]: o for o in existing}
    keep: set[str] = set()
    for i, opt in enumerate(options):
        data = {"label": opt.label.strip(), "argument": (opt.argument or "").strip() or None, "position": i}
        if opt.id and opt.id in by_id:
            keep.add(opt.id)
            client.table("poll_options").update(data).eq("id", opt.id).execute()
        else:
            client.table("poll_options").insert({"poll_id": poll_id, **data}).execute()
    for old_id in set(by_id) - keep:
        client.table("poll_options").delete().eq("id", old_id).execute()


@admin_router.delete("/{poll_id}", status_code=204)
def admin_delete(poll_id: str, container: Container = Depends(get_container)) -> None:
    rows = _run(lambda: _client(container).table("polls").delete().eq("id", poll_id).execute().data or [])
    if not rows:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
