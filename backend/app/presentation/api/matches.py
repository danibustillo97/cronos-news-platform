"""Live match centre + "datos inteligentes" (public, read-only).

GET /api/matches/{league}/{event_id}            normalized ESPN summary: score, clock, events,
                                                stats, lineups, commentary (cached 15 s)
GET /api/matches/insights/player/{athlete_id}   scorer insights: facts built from real
                                                gamelog + season stats (cached 10 min)

Facts are computed, never invented: every sentence comes from a number ESPN
returned. Gamelogs only include finished games, so live-goal facts are phrased
as "antes de este partido".
"""
from __future__ import annotations

import re
import time
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Response

from app.presentation.api.players import POSITIONS_ES, parse_seasons

router = APIRouter(prefix="/api/matches", tags=["matches"])

_SUMMARY = "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/summary"
_ATHLETE = "https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/{id}"
_HEADSHOT = "https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png"
_LEAGUE = re.compile(r"^[a-z]{2,12}(\.[a-z0-9_]{1,20})?$")
_ID = re.compile(r"^\d{1,12}$")
_cache: dict[str, tuple[float, Any]] = {}

STAT_LABELS = [
    ("possessionPct", "Posesión", True), ("totalShots", "Remates", False), ("shotsOnTarget", "Remates al arco", False),
    ("wonCorners", "Córners", False), ("foulsCommitted", "Faltas", False), ("yellowCards", "Amarillas", False),
    ("redCards", "Rojas", False), ("offsides", "Fueras de juego", False), ("saves", "Atajadas", False),
]


def _cached(key: str, ttl: float) -> Any | None:
    hit = _cache.get(key)
    return hit[1] if hit and time.monotonic() - hit[0] < ttl else None


def _store(key: str, value: Any) -> Any:
    if len(_cache) > 1500:
        _cache.clear()
    _cache[key] = (time.monotonic(), value)
    return value


async def _get(url: str, params: dict | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            res = await client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo consultar la fuente de datos") from exc
    if res.status_code in (400, 404):
        raise HTTPException(status_code=404, detail="No encontrado")
    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail="La fuente de datos no respondió")
    return res.json()


def _num(value: Any) -> float:
    try:
        return float(str(value).replace("%", "").replace(",", "."))
    except (TypeError, ValueError):
        return 0.0


def event_type(raw: str, text: str = "") -> str:
    t = (raw or "").lower()
    if "own" in t:
        return "own-goal"
    if "penalty" in t and ("miss" in t or "saved" in t):
        return "penalty-miss"
    if "penalty" in t and ("scored" in t or "goal" in t):
        return "penalty-goal"
    if t.startswith("goal"):
        return "goal"
    if "yellow" in t and "red" in t:
        return "red"  # second yellow
    if "yellow" in t:
        return "yellow"
    if "red" in t:
        return "red"
    if "substitution" in t:
        return "sub"
    if "var" in t or "video" in t:
        return "var"
    if t in ("kickoff", "halftime", "start-2nd-half", "end-regular-time", "full-time", "start-extra-time", "end-extra-time") or "half" in t:
        return "period"
    return "other"


def parse_summary(data: dict, league: str) -> dict:
    comp = ((data.get("header") or {}).get("competitions") or [{}])[0]
    status = comp.get("status") or {}
    stype = status.get("type") or {}
    teams: dict[str, dict] = {}
    side_by_team: dict[str, str] = {}
    for c in comp.get("competitors") or []:
        side = c.get("homeAway")
        team = c.get("team") or {}
        logos = team.get("logos") or []
        teams[side] = {
            "id": str(team.get("id") or ""), "name": team.get("displayName") or team.get("name") or "",
            "short": team.get("abbreviation") or "", "logo": (logos[0].get("href") if logos else team.get("logo")),
            "score": int(_num(c.get("score"))) if c.get("score") not in (None, "") else None, "form": c.get("form"),
        }
        side_by_team[str(team.get("id"))] = side

    events = []
    for k in data.get("keyEvents") or []:
        raw = (k.get("type") or {}).get("type") or ""
        kind = event_type(raw, k.get("text") or "")
        people = [p.get("athlete") or {} for p in k.get("participants") or []]
        player = {"id": str(people[0].get("id")), "name": people[0].get("displayName") or ""} if people and people[0].get("id") else None
        assist = None
        if kind in ("goal", "penalty-goal") and len(people) > 1 and people[1].get("id"):
            assist = {"id": str(people[1].get("id")), "name": people[1].get("displayName") or ""}
        events.append({
            "id": str(k.get("id") or len(events)), "minute": (k.get("clock") or {}).get("displayValue") or "",
            "type": kind, "team": side_by_team.get(str((k.get("team") or {}).get("id"))), "player": player, "assist": assist,
            "text": k.get("text") or "",
        })

    stats = []
    box = {side_by_team.get(str((t.get("team") or {}).get("id"))): {s.get("name"): s.get("displayValue") for s in t.get("statistics") or []}
           for t in (data.get("boxscore") or {}).get("teams") or []}
    if box.get("home") and box.get("away"):
        for key, label, pct in STAT_LABELS:
            if key in box["home"] or key in box["away"]:
                stats.append({"key": key, "label": label, "home": _num(box["home"].get(key)), "away": _num(box["away"].get(key)), "percent": pct})

    lineups: dict[str, list] = {"home": [], "away": []}
    for r in data.get("rosters") or []:
        side = r.get("homeAway") or side_by_team.get(str((r.get("team") or {}).get("id")))
        if side not in lineups:
            continue
        for p in r.get("roster") or []:
            a = p.get("athlete") or {}
            lineups[side].append({"id": str(a.get("id") or ""), "name": a.get("displayName") or "", "jersey": p.get("jersey"),
                                  "position": (p.get("position") or {}).get("abbreviation"), "starter": bool(p.get("starter"))})

    commentary = [{"minute": (c.get("time") or {}).get("displayValue") or "", "text": c.get("text") or ""}
                  for c in data.get("commentary") or [] if c.get("text")]
    venue = ((data.get("gameInfo") or {}).get("venue") or {}).get("fullName")
    return {
        "id": str(comp.get("id") or ""), "league": league, "leagueName": ((data.get("header") or {}).get("league") or {}).get("name") or league,
        "state": stype.get("state") or "pre", "clock": status.get("displayClock") or "", "period": status.get("period") or 0,
        "statusText": stype.get("shortDetail") or stype.get("detail") or "", "date": comp.get("date"), "venue": venue,
        "home": teams.get("home"), "away": teams.get("away"), "events": events, "stats": stats, "lineups": lineups,
        "commentary": list(reversed(commentary))[:25], "updatedAt": datetime.now(timezone.utc).isoformat(),
    }


def parse_gamelog(data: dict, limit: int = 5) -> list[dict]:
    labels = data.get("labels") or []
    meta = data.get("events") or {}
    rows: list[dict] = []
    for season in data.get("seasonTypes") or []:
        for cat in season.get("categories") or []:
            for e in cat.get("events") or []:
                m = meta.get(e.get("eventId")) or {}
                values = dict(zip(labels, e.get("stats") or []))
                rows.append({
                    "date": (m.get("gameDate") or "")[:10], "opponent": (m.get("opponent") or {}).get("displayName") or "",
                    "homeAway": "home" if m.get("atVs") == "vs" else "away", "result": m.get("gameResult") or "",
                    "score": m.get("score") or "", "goals": int(_num(values.get("G"))), "assists": int(_num(values.get("A"))),
                })
    rows.sort(key=lambda r: r["date"], reverse=True)
    return rows[:limit]


def _plural(n: int, one: str, many: str) -> str:
    return f"{n} {one if n == 1 else many}"


def build_facts(name: str, last_games: list[dict], season: dict | None, age: int | None, position: str | None) -> list[str]:
    facts: list[str] = []
    first = name.split(" ")[-1] if name else "El jugador"
    if last_games:
        n = len(last_games)
        goals = sum(g["goals"] for g in last_games)
        assists = sum(g["assists"] for g in last_games)
        if goals:
            facts.append(f"Llegaba con {goals} gol{'es' if goals != 1 else ''} en sus últimos {n} partidos registrados.")
        drought = next((i for i, g in enumerate(last_games) if g["goals"] > 0), None)
        if drought is None:
            facts.append(f"{first} no marcaba en sus últimos {n} partidos: este gol rompe la sequía.")
        elif drought >= 2:
            facts.append(f"No marcaba desde hace {drought} partidos (último gol: {last_games[drought]['date']} ante {last_games[drought]['opponent']}).")
        elif drought == 0:
            facts.append(f"También había marcado en su partido anterior, ante {last_games[0]['opponent']}.")
        if assists:
            facts.append(f"Suma además {assists} asistencia{'s' if assists != 1 else ''} en esos {n} partidos.")
    if season and (season.get("starts") or season.get("goals")):
        facts.append(f"Antes de este partido: {_plural(season['goals'], 'gol', 'goles')} y {_plural(season['assists'], 'asistencia', 'asistencias')} "
                     f"en {season['competition']} {season['season']} ({_plural(season['starts'], 'titularidad', 'titularidades')}).")
        if season.get("starts", 0) >= 3:
            ratio = season["goals"] / season["starts"]
            facts.append(f"Promedia {ratio:.2f} goles por partido como titular.".replace(".", ",", 1))
        if season.get("shots", 0) >= 5:
            acc = round(100 * season.get("shotsOnTarget", 0) / season["shots"])
            facts.append(f"Va al arco con el {acc}% de sus remates.")
    if position or age:
        facts.append(", ".join(x for x in (position, f"{age} años" if age else None) if x) + ".")
    return facts


def pick_season(seasons: list[dict]) -> dict | None:
    if not seasons:
        return None
    latest = seasons[0]["season"]
    current = [s for s in seasons if s["season"] == latest]
    best = max(current, key=lambda s: (s["stats"].get("starts", 0), s["stats"].get("goals", 0)))
    st = best["stats"]
    return {"season": best["season"], "competition": best["competition"], "goals": st.get("goals", 0), "assists": st.get("assists", 0),
            "starts": st.get("starts", 0), "shots": st.get("shots", 0), "shotsOnTarget": st.get("shotsOnTarget", 0)}


@router.get("/insights/player/{athlete_id}")
async def player_insights(athlete_id: str, response: Response) -> dict:
    if not _ID.match(athlete_id):
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    key = f"ins:{athlete_id}"
    out = _cached(key, 600)
    if out is None:
        base = _ATHLETE.format(id=athlete_id)
        athlete = (await _get(base)).get("athlete") or {}
        try:
            gamelog = await _get(base + "/gamelog")
        except HTTPException:
            gamelog = {}
        try:
            stats = await _get(base + "/stats")
        except HTTPException:
            stats = {}
        last = parse_gamelog(gamelog)
        season = pick_season(parse_seasons(stats))
        pos = (athlete.get("position") or {}).get("displayName")
        position = POSITIONS_ES.get(pos, pos)
        name = athlete.get("displayName") or ""
        out = _store(key, {
            "player": {"id": athlete_id, "name": name, "team": (athlete.get("team") or {}).get("displayName"),
                       "image": (athlete.get("headshot") or {}).get("href") or _HEADSHOT.format(id=athlete_id), "position": position},
            "facts": build_facts(name, last, season, athlete.get("age"), position),
            "lastGames": last, "season": season,
        })
    response.headers["Cache-Control"] = "public, max-age=300"
    return out


@router.get("/{league}/{event_id}")
async def match_detail(league: str, event_id: str, response: Response) -> dict:
    if not _LEAGUE.match(league) or not _ID.match(event_id):
        raise HTTPException(status_code=404, detail="Partido no encontrado")
    key = f"m:{league}:{event_id}"
    out = _cached(key, 15)
    if out is None:
        out = _store(key, parse_summary(await _get(_SUMMARY.format(league=league), {"event": event_id}), league))
    response.headers["Cache-Control"] = "public, max-age=10" if out["state"] == "in" else "public, max-age=60"
    return out


# ---------------------------------------------------------------- moments (feed)
# "¡Gol de Bellingham!", expulsiones y resultados finales de los partidos de hoy,
# en orden cronológico inverso, para que el feed publique datos solo.

_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard"
MOMENT_LEAGUES = {
    "col.1": "Liga BetPlay", "conmebol.libertadores": "Copa Libertadores", "conmebol.sudamericana": "Copa Sudamericana",
    "uefa.champions": "Champions League", "uefa.europa": "Europa League", "eng.1": "Premier League", "esp.1": "LaLiga",
    "ita.1": "Serie A", "ger.1": "Bundesliga", "fra.1": "Ligue 1",
}
_MAX_MATCHES = 32


def minute_value(minute: str) -> float:
    """"45'+2'" -> 47.0, "90'" -> 90.0, "" -> 0."""
    nums = [int(n) for n in re.findall(r"\d+", minute or "")]
    return float(sum(nums[:2])) if nums else 0.0


def _surname(name: str) -> str:
    parts = (name or "").split()
    return parts[-1] if parts else name


def score_after(text: str, home: str, away: str) -> tuple[int, int] | None:
    """ESPN goal texts carry the score: 'Goal! Real Madrid 1, PSV Eindhoven 0. …'."""
    m = re.search(re.escape(home) + r"\s+(\d+),\s+" + re.escape(away) + r"\s+(\d+)", text or "")
    return (int(m.group(1)), int(m.group(2))) if m else None


def _goal_impact(before: list[int], after: list[int], side: str | None, home: str, away: str) -> str:
    if side not in ("home", "away"):
        return "El marcador cambió."
    scorer = home if side == "home" else away
    rival = away if side == "home" else home
    before_diff = before[0] - before[1] if side == "home" else before[1] - before[0]
    after_diff = after[0] - after[1] if side == "home" else after[1] - after[0]
    if before_diff == 0 and after_diff > 0:
        return f"Gol que puso a {scorer} en ventaja."
    if before_diff < 0 and after_diff == 0:
        return f"Gol del empate: {scorer} igualó ante {rival}."
    if before_diff > 0 and after_diff > before_diff:
        return f"Gol que amplió la ventaja de {scorer}."
    if after_diff == 0:
        return f"El partido quedó empatado entre {scorer} y {rival}."
    if before_diff < 0 and after_diff > 0:
        return f"Gol que completó la remontada de {scorer}."
    return f"El gol modificó el marcador a {after[0]}-{after[1]}."


def build_moments(detail: dict) -> list[dict]:
    home, away = detail.get("home") or {}, detail.get("away") or {}
    if not home or not away:
        return []
    home_name, away_name = home.get("name", ""), away.get("name", "")
    kickoff = detail.get("date") or ""
    base = {"matchId": detail["id"], "league": detail["league"], "leagueName": MOMENT_LEAGUES.get(detail["league"], detail.get("leagueName")),
            "home": {"name": home_name, "short": home.get("short"), "logo": home.get("logo")},
            "away": {"name": away_name, "short": away.get("short"), "logo": away.get("logo")},
            "state": detail.get("state"), "kickoff": kickoff}
    out: list[dict] = []
    running = [0, 0]
    for e in detail.get("events") or []:
        kind = e["type"]
        minute = e.get("minute") or ""
        event_id = f"{detail['id']}:{e['id']}"
        before = list(running)
        if kind in ("goal", "penalty-goal", "own-goal"):
            parsed = score_after(e.get("text", ""), home_name, away_name)
            if parsed:
                running = list(parsed)
            elif e.get("team") in ("home", "away"):
                running[0 if e["team"] == "home" else 1] += 1
            who = _surname((e.get("player") or {}).get("name", ""))
            lead = {"own-goal": f"Autogol de {who}", "penalty-goal": f"¡Gol de penal de {who}!"}.get(kind, f"¡Gol de {who}!") if who else "¡Gol!"
            out.append({**base, "id": event_id, "kind": "goal", "eventType": kind, "minute": minute,
                        "minuteValue": minute_value(minute), "team": e.get("team"), "player": e.get("player"),
                        "assist": e.get("assist"), "scoreBefore": {"home": before[0], "away": before[1]},
                        "score": {"home": running[0], "away": running[1]},
                        "impact": _goal_impact(before, running, e.get("team"), home_name, away_name),
                        "text": e.get("text") or "",
                        "headline": f"{lead} {home_name} {running[0]}-{running[1]} {away_name} ({minute})"})
        elif kind == "red":
            who = (e.get("player") or {}).get("name", "")
            team_name = home_name if e.get("team") == "home" else away_name if e.get("team") == "away" else "equipo no identificado"
            out.append({**base, "id": event_id, "kind": "red", "eventType": kind, "minute": minute,
                        "minuteValue": minute_value(minute), "team": e.get("team"), "player": e.get("player"),
                        "assist": None, "scoreBefore": {"home": running[0], "away": running[1]},
                        "score": {"home": running[0], "away": running[1]}, "impact": None,
                        "text": e.get("text") or "",
                        "headline": f"Roja para {who or 'un jugador'} ({team_name}) al {minute}"})
        elif kind in ("penalty-miss", "var"):
            who = (e.get("player") or {}).get("name", "")
            labels = {
                "penalty-miss": f"Penalti fallado por {who}" if who else "Penalti fallado",
                "var": "Revisión VAR",
            }
            out.append({**base, "id": event_id, "kind": "incident", "eventType": kind, "minute": minute,
                        "minuteValue": minute_value(minute), "team": e.get("team"), "player": e.get("player"),
                        "assist": e.get("assist"), "scoreBefore": {"home": running[0], "away": running[1]},
                        "score": {"home": running[0], "away": running[1]}, "impact": None,
                        "text": e.get("text") or "", "headline": f"{labels[kind]} · {minute}"})
    if detail.get("state") == "post" and home.get("score") is not None and away.get("score") is not None:
        hs, as_ = home.get("score") or 0, away.get("score") or 0
        out.append({**base, "id": f"{detail['id']}:final", "kind": "final", "eventType": None,
                    "minute": "Final", "minuteValue": 200.0, "team": None, "player": None,
                    "assist": None, "scoreBefore": None, "score": {"home": hs, "away": as_},
                    "impact": None, "text": "",
                    "headline": f"Final: {home_name} {hs}-{as_} {away_name}"})
    return out


def moment_sort_key(m: dict) -> float:
    try:
        start = datetime.fromisoformat(str(m.get("kickoff")).replace("Z", "+00:00")).timestamp()
    except ValueError:
        start = 0.0
    minute = m.get("minuteValue") or 0.0
    return start + (minute + (15 if minute > 45 else 0)) * 60


async def _scoreboard_events(client: httpx.AsyncClient, league: str) -> list[tuple[str, str, str]]:
    try:
        res = await client.get(_SCOREBOARD.format(league=league))
        if res.status_code != 200:
            return []
        rows = []
        for ev in res.json().get("events") or []:
            state = ((ev.get("status") or {}).get("type") or {}).get("state")
            if state in ("in", "post"):
                rows.append((league, str(ev.get("id")), state))
        return rows
    except (httpx.HTTPError, ValueError):
        return []


async def _summary(client: httpx.AsyncClient, league: str, event_id: str) -> dict | None:
    key = f"m:{league}:{event_id}"
    hit = _cached(key, 15)
    if hit is not None:
        return hit
    try:
        res = await client.get(_SUMMARY.format(league=league), params={"event": event_id})
        if res.status_code != 200:
            return None
        return _store(key, parse_summary(res.json(), league))
    except (httpx.HTTPError, ValueError):
        return None


@router.get("/moments")
async def moments(response: Response) -> dict:
    out = _cached("moments", 30)
    if out is None:
        import asyncio

        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            groups = await asyncio.gather(*(_scoreboard_events(client, lg) for lg in MOMENT_LEAGUES))
            refs = sorted((r for g in groups for r in g), key=lambda r: r[2] != "in")[:_MAX_MATCHES]  # live first
            details = await asyncio.gather(*(_summary(client, lg, eid) for lg, eid, _ in refs))
        items = [m for d in details if d for m in build_moments(d)]
        items.sort(key=moment_sort_key, reverse=True)
        out = _store("moments", {"moments": items[:60], "live": sum(1 for r in refs if r[2] == "in"),
                                 "updatedAt": datetime.now(timezone.utc).isoformat()})
    response.headers["Cache-Control"] = "public, max-age=20"
    return out
