"""Football player search, profile and per-season stats (public, read-only).

GET /api/players/search?q=texto   -> {players: [{id, name, team, image}]}
GET /api/players/{id}             -> profile + seasons[{season, competition, team, teamLogo, stats}]

Thin read-through proxy to ESPN's public athlete JSON (same source as
/api/sports), normalised to a small stable contract so the portal can build
search, profiles and side-by-side comparisons. Cached in memory for a few
minutes: player pages are popular and ESPN data changes once per match.
"""
from __future__ import annotations

import re
import time
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

router = APIRouter(prefix="/api/players", tags=["players"])

_SEARCH_URL = "https://site.web.api.espn.com/apis/search/v2"
_ATHLETE_URL = "https://site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/{id}"
_HEADSHOT = "https://a.espncdn.com/i/headshots/soccer/players/full/{id}.png"
_SOCCER_UID = re.compile(r"^s:600~a:(\d+)$")
_ID = re.compile(r"^\d{1,12}$")
_TTL_S = 600
_TIMEOUT = httpx.Timeout(8.0)

# ESPN stat labels -> our contract keys
STAT_KEYS: dict[str, str] = {
    "STRT": "starts", "G": "goals", "A": "assists", "SHOT": "shots", "SOG": "shotsOnTarget",
    "YC": "yellowCards", "RC": "redCards", "FC": "foulsCommitted", "FA": "foulsSuffered", "OFF": "offsides",
    "SV": "saves", "GA": "goalsAgainst", "SHF": "shotsFaced", "CS": "cleanSheets",
}
BASE_STATS = ("starts", "goals", "assists", "shots", "shotsOnTarget", "yellowCards", "redCards",
              "foulsCommitted", "foulsSuffered", "offsides")
POSITIONS_ES = {"Forward": "Delantero", "Midfielder": "Centrocampista", "Defender": "Defensa",
                "Goalkeeper": "Portero", "Attacker": "Delantero"}

COMPETITIONS_ES = {
    "German Bundesliga": "Bundesliga", "German Cup": "Copa de Alemania", "Spanish LALIGA": "LaLiga",
    "Spanish Copa del Rey": "Copa del Rey", "English Premier League": "Premier League", "English FA Cup": "FA Cup",
    "English Carabao Cup": "Copa de la Liga inglesa", "Italian Serie A": "Serie A", "Italian Coppa Italia": "Copa de Italia",
    "French Ligue 1": "Ligue 1", "French Coupe de France": "Copa de Francia", "UEFA Champions League": "Champions League",
    "UEFA Europa League": "Europa League", "UEFA Conference League": "Conference League",
    "Colombian Primera A": "Liga BetPlay", "Colombian Copa Colombia": "Copa Colombia",
    "CONMEBOL Libertadores": "Copa Libertadores", "CONMEBOL Sudamericana": "Copa Sudamericana",
    "FIFA World Cup Qualifying - CONMEBOL": "Eliminatorias", "FIFA World Cup": "Mundial", "International Friendly": "Amistoso internacional",
    "Copa America": "Copa América", "German SuperCup": "Supercopa de Alemania", "Spanish Supercopa": "Supercopa de España",
    "English Community Shield": "Community Shield", "Italian Supercoppa": "Supercopa de Italia",
    "French Trophée des Champions": "Supercopa de Francia", "UEFA Super Cup": "Supercopa de Europa",
    "FIFA Club World Cup": "Mundial de Clubes", "UEFA Nations League": "Liga de Naciones",
    "FIFA World Cup Qualifying - UEFA": "Eliminatorias UEFA", "Club Friendly": "Amistoso de clubes",
}

_cache: dict[str, tuple[float, Any]] = {}


def _cached(key: str) -> Any | None:
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < _TTL_S:
        return hit[1]
    return None


def _store(key: str, value: Any) -> Any:
    if len(_cache) > 2000:
        _cache.clear()
    _cache[key] = (time.monotonic(), value)
    return value


async def _get_json(url: str, params: dict | None = None) -> dict:
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.get(url, params=params)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="No se pudo consultar la fuente de datos") from exc
    if res.status_code in (400, 404):  # ESPN answers 400 for an unknown athlete id
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    if res.status_code >= 400:
        raise HTTPException(status_code=502, detail="La fuente de datos no respondió")
    return res.json()


def _num(value: Any) -> int:
    try:
        return int(round(float(str(value).replace(",", ""))))
    except (TypeError, ValueError):
        return 0


def parse_search(payload: dict, limit: int) -> list[dict]:
    players: list[dict] = []
    seen: set[str] = set()
    for group in payload.get("results") or []:
        for item in group.get("contents") or []:
            match = _SOCCER_UID.match(str(item.get("uid") or ""))
            if not match or match.group(1) in seen:
                continue
            pid = match.group(1)
            seen.add(pid)
            image = (item.get("image") or {}).get("default") or None
            players.append({"id": pid, "name": item.get("displayName") or "", "team": item.get("subtitle") or None,
                            "image": image})
            if len(players) >= limit:
                return players
    return players


def parse_seasons(stats_payload: dict) -> list[dict]:
    teams = stats_payload.get("teams") or {}
    leagues = stats_payload.get("leagues") or {}
    merged: dict[tuple, dict] = {}
    for category in stats_payload.get("categories") or []:
        labels = category.get("labels") or category.get("names") or []
        for row in category.get("statistics") or []:
            season_name = ((row.get("season") or {}).get("displayName")) or ""
            season = season_name.split(" ", 1)[0] if season_name else ""
            league = leagues.get(row.get("leagueSlug")) or {}
            team = teams.get(row.get("teamSlug")) or {}
            raw = season_name.split(" ", 1)[1] if " " in season_name else ""
            competition = COMPETITIONS_ES.get(raw) or league.get("displayName") or raw
            key = (season, row.get("leagueSlug"), row.get("teamSlug"))
            entry = merged.setdefault(key, {
                "season": season,
                "competition": competition,
                "competitionId": row.get("leagueSlug"),
                "team": team.get("displayName") or None,
                "teamLogo": next((l.get("href") for l in team.get("logos") or [] if "default" in (l.get("rel") or [])), None),
                "stats": {k: 0 for k in BASE_STATS},
            })
            for label, value in zip(labels, row.get("stats") or []):
                stat = STAT_KEYS.get(label)
                if stat:
                    entry["stats"][stat] = _num(value)
    return sorted(merged.values(), key=lambda s: (s["season"], s["competition"]), reverse=True)


def merge_overview(seasons: list[dict], overview: dict, team: str | None, team_logo: str | None) -> list[dict]:
    """/stats only lists league seasons; the overview adds this season's cups (Champions, domestic cup...)."""
    block = overview.get("statistics") or {}
    labels = block.get("labels") or []
    have = {(s["season"], s["competition"].lower()) for s in seasons}
    extra = []
    for split in block.get("splits") or []:
        name = split.get("displayName") or ""
        if " " not in name:
            continue
        season, competition = name.split(" ", 1)
        competition = COMPETITIONS_ES.get(competition, competition)
        if (season, competition.lower()) in have or any(s["season"] == season and competition.lower() in s["competition"].lower() for s in seasons):
            continue
        stats = {k: 0 for k in BASE_STATS}
        for label, value in zip(labels, split.get("stats") or []):
            if STAT_KEYS.get(label):
                stats[STAT_KEYS[label]] = _num(value)
        extra.append({"season": season, "competition": competition, "competitionId": None,
                      "team": team, "teamLogo": team_logo, "stats": stats})
    return sorted(seasons + extra, key=lambda s: (s["season"], s["competition"]), reverse=True)


def parse_profile(pid: str, athlete_payload: dict, stats_payload: dict, overview: dict | None = None) -> dict:
    a = athlete_payload.get("athlete") or {}
    team = a.get("team") or {}
    position = (a.get("position") or {}).get("displayName")
    logos = team.get("logos") or []
    seasons = parse_seasons(stats_payload)
    if overview:
        seasons = merge_overview(seasons, overview, team.get("displayName") or None, logos[0].get("href") if logos else None)
    return {
        "id": pid,
        "name": a.get("displayName") or a.get("fullName") or "",
        "age": a.get("age"),
        "position": POSITIONS_ES.get(position, position),
        "jersey": a.get("jersey") or a.get("displayJersey") or None,
        "team": team.get("displayName") or None,
        "teamLogo": logos[0].get("href") if logos else None,
        "nationality": a.get("citizenship") or None,
        "flag": (a.get("flag") or {}).get("href") or None,
        "image": (a.get("headshot") or {}).get("href") or _HEADSHOT.format(id=pid),
        "seasons": seasons,
    }


@router.get("/search")
async def search_players(response: Response, q: str = Query(..., min_length=2, max_length=60),
                         limit: int = Query(8, ge=1, le=20)) -> dict:
    query = " ".join(q.split()).lower()
    key = f"s:{query}:{limit}"
    players = _cached(key)
    if players is None:
        payload = await _get_json(_SEARCH_URL, {"query": query, "limit": 25, "type": "player"})
        players = _store(key, parse_search(payload, limit))
    response.headers["Cache-Control"] = "public, max-age=300"
    return {"players": players}


@router.get("/{player_id}")
async def get_player(player_id: str, response: Response) -> dict:
    if not _ID.match(player_id):
        raise HTTPException(status_code=404, detail="Jugador no encontrado")
    key = f"p:{player_id}"
    profile = _cached(key)
    if profile is None:
        athlete = await _get_json(_ATHLETE_URL.format(id=player_id))
        try:
            stats = await _get_json(_ATHLETE_URL.format(id=player_id) + "/stats")
        except HTTPException:
            stats = {}  # profile without stats is still useful
        try:
            overview = await _get_json(_ATHLETE_URL.format(id=player_id) + "/overview")
        except HTTPException:
            overview = {}
        profile = _store(key, parse_profile(player_id, athlete, stats, overview))
    response.headers["Cache-Control"] = "public, max-age=600"
    return profile
