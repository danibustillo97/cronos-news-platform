from __future__ import annotations

# Real, live football data -- a thin read-through proxy to ESPN's public
# scoreboard/standings JSON (site.api.espn.com), not a stored/scraped
# snapshot that goes stale (the `match_results` table this replaced on
# the homepage hadn't been refreshed since January). No API key needed;
# these are the same public endpoints ESPN's own site calls. Pure
# infrastructure-free passthrough for display -- no domain entity, no
# repository, because there's no business state of ours involved.

import httpx
from fastapi import APIRouter, HTTPException, Query

router = APIRouter(prefix="/api/sports", tags=["sports"])

_ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer"
_ESPN_STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports/soccer"

LEAGUE_NAMES: dict[str, str] = {
    "col.1": "Liga BetPlay",
    "eng.1": "Premier League",
    "esp.1": "La Liga",
    "ita.1": "Serie A",
    "ger.1": "Bundesliga",
    "uefa.champions": "Champions League",
    "conmebol.libertadores": "Libertadores",
    "conmebol.sudamericana": "Sudamericana",
}

_DEFAULT_SCOREBOARD_LEAGUES = [
    "col.1", "uefa.champions", "conmebol.libertadores", "conmebol.sudamericana", "esp.1", "eng.1",
]
# Orden de prioridad real pedido: copas continentales primero, ligas locales
# después. ESPN devuelve tabla vacía (children == []) para competiciones en
# fase eliminatoria sin grupos -- el frontend ya lo maneja como estado vacío.
_STANDINGS_TABS = [
    "uefa.champions", "conmebol.libertadores", "conmebol.sudamericana",
    "col.1", "eng.1", "esp.1", "ita.1", "ger.1",
]


def _status_bucket(state: str) -> str:
    if state == "in":
        return "live"
    if state == "post":
        return "finished"
    return "scheduled"


async def _fetch_league_scoreboard(client: httpx.AsyncClient, league: str) -> list[dict]:
    try:
        res = await client.get(f"{_ESPN_BASE}/{league}/scoreboard", timeout=8.0)
        res.raise_for_status()
        data = res.json()
    except Exception:
        return []

    matches = []
    for event in data.get("events", []):
        competition = (event.get("competitions") or [{}])[0]
        competitors = competition.get("competitors") or []
        home = next((c for c in competitors if c.get("homeAway") == "home"), None)
        away = next((c for c in competitors if c.get("homeAway") == "away"), None)
        if not home or not away:
            continue
        status = event.get("status", {}).get("type", {})
        matches.append({
            "id": event.get("id"),
            "league": league,
            "leagueName": LEAGUE_NAMES.get(league, league),
            "homeTeam": home.get("team", {}).get("displayName", "?"),
            "awayTeam": away.get("team", {}).get("displayName", "?"),
            "homeLogo": home.get("team", {}).get("logo"),
            "awayLogo": away.get("team", {}).get("logo"),
            "homeScore": int(home.get("score") or 0),
            "awayScore": int(away.get("score") or 0),
            "status": _status_bucket(status.get("state", "")),
            "statusDetail": status.get("shortDetail", ""),
            "date": event.get("date"),
            "venue": (competition.get("venue") or {}).get("fullName"),
        })
    return matches


@router.get("/scoreboard")
async def get_scoreboard(leagues: str = Query(",".join(_DEFAULT_SCOREBOARD_LEAGUES))) -> list[dict]:
    league_list = [l.strip() for l in leagues.split(",") if l.strip()]
    async with httpx.AsyncClient() as client:
        results = [await _fetch_league_scoreboard(client, league) for league in league_list]

    all_matches = [m for group in results for m in group]
    order = {"live": 0, "finished": 1, "scheduled": 2}
    all_matches.sort(key=lambda m: order.get(m["status"], 3))
    return all_matches[:12]


@router.get("/standings")
async def get_standings(league: str = Query("col.1")) -> dict:
    if league not in _STANDINGS_TABS:
        raise HTTPException(status_code=422, detail=f"unsupported league: {league!r}")
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{_ESPN_STANDINGS_BASE}/{league}/standings", timeout=8.0)
            res.raise_for_status()
            data = res.json()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"ESPN standings unavailable: {exc}") from exc

    children = data.get("children") or []
    entries = children[0].get("standings", {}).get("entries", []) if children else []

    table = []
    for entry in entries:
        stats = {s.get("name"): s.get("displayValue") for s in entry.get("stats", [])}
        team = entry.get("team", {})
        logos = team.get("logos") or []
        # Zona de clasificación/descenso real, tal como ESPN la marca para
        # esta competición y temporada (Champions/Europa/Relegación/etc.) --
        # nunca inferida de un umbral de posición hardcodeado nuestro, que
        # cambiaría de formato entre competiciones y temporadas. Ausente
        # (None) para filas sin nota -- el frontend no dibuja nada ahí.
        note = entry.get("note") or {}
        note_color = note.get("color")
        table.append({
            "rank": stats.get("rank"),
            "team": team.get("displayName"),
            "logo": logos[0]["href"] if logos else None,
            "played": stats.get("gamesPlayed"),
            "won": stats.get("wins"),
            "drawn": stats.get("ties"),
            "lost": stats.get("losses"),
            "points": stats.get("points"),
            "goalDifference": stats.get("pointDifferential"),
            "goalsFor": stats.get("pointsFor"),
            "goalsAgainst": stats.get("pointsAgainst"),
            "noteColor": f"#{note_color.lstrip('#')}" if note_color else None,
            "noteDescription": note.get("description"),
        })

    return {"league": league, "leagueName": LEAGUE_NAMES.get(league, league), "table": table}


@router.get("/standings/leagues")
def list_standings_leagues() -> list[dict]:
    return [{"id": l, "name": LEAGUE_NAMES.get(l, l)} for l in _STANDINGS_TABS]
