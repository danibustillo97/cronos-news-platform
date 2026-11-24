"""Data-driven parlay suggestions from REAL market odds (public, read-only).

GET /api/picks?hours=48  ->  { generatedAt, matches: [...], parlays: [...], disclaimer }

Source: ESPN scoreboard (odds by DraftKings, the same feed ESPN shows) + each
team's last-5 form. No invented numbers: every probability shown is the
market's implied probability with the bookmaker margin removed, and a pick is
only suggested when the recent form doesn't contradict the market.

This is editorial information, not betting advice: the response always carries
the responsible-gambling disclaimer (+18, Coljuegos) and the portal must show it.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timedelta, timezone
from itertools import combinations

import httpx
from fastapi import APIRouter, Query, Response

router = APIRouter(prefix="/api/picks", tags=["picks"])

_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard"
LEAGUES = {
    "col.1": "Liga BetPlay", "conmebol.libertadores": "Copa Libertadores", "conmebol.sudamericana": "Copa Sudamericana",
    "uefa.champions": "Champions League", "uefa.europa": "Europa League", "eng.1": "Premier League", "esp.1": "LaLiga",
    "ita.1": "Serie A", "ger.1": "Bundesliga", "fra.1": "Ligue 1",
}
DISCLAIMER = ("Contenido informativo basado en cuotas de mercado y estadísticas; no es una recomendación de apuesta ni garantiza resultados. "
              "Solo para mayores de 18 años. Juega con responsabilidad y únicamente en operadores autorizados por Coljuegos.")
_TTL = 300
_cache: dict[str, tuple[float, dict]] = {}


def american_to_decimal(odds: str | int | float | None) -> float | None:
    try:
        value = float(str(odds).replace("+", ""))
    except (TypeError, ValueError):
        return None
    if value == 0:
        return None
    return round(1 + (value / 100 if value > 0 else 100 / -value), 3)


def no_vig(decimals: dict[str, float]) -> dict[str, float]:
    """Implied probabilities normalised to sum 1 (removes the bookmaker margin)."""
    raw = {k: 1 / v for k, v in decimals.items() if v and v > 1}
    total = sum(raw.values())
    return {k: p / total for k, p in raw.items()} if total else {}


def form_points(form: str | None) -> float | None:
    """Points per game over the last results string, e.g. 'WWDLW' -> 2.0."""
    if not form:
        return None
    pts = {"W": 3, "D": 1, "L": 0}
    games = [pts[c] for c in form.upper() if c in pts]
    return sum(games) / len(games) if games else None


def _close(node: dict | None) -> str | None:
    node = node or {}
    return (node.get("close") or {}).get("odds") or (node.get("open") or {}).get("odds")


def parse_match(event: dict, league: str) -> dict | None:
    comp = (event.get("competitions") or [{}])[0]
    if (comp.get("status") or event.get("status") or {}).get("type", {}).get("state") != "pre":
        return None
    odds = (comp.get("odds") or [None])[0]
    if not odds:
        return None
    teams = {c.get("homeAway"): c for c in comp.get("competitors") or []}
    home, away = teams.get("home"), teams.get("away")
    if not home or not away:
        return None
    ml = odds.get("moneyline") or {}
    x12 = {k: american_to_decimal(_close(ml.get(side))) for k, side in (("home", "home"), ("draw", "draw"), ("away", "away"))}
    if not all(x12.values()):
        return None
    total = odds.get("total") or {}
    line = ((total.get("over") or {}).get("close") or {}).get("line") or ""
    ou_line = float(line[1:]) if line[:1] in ("o", "u") and line[1:].replace(".", "").isdigit() else odds.get("overUnder")
    ou = {"over": american_to_decimal(_close(total.get("over"))), "under": american_to_decimal(_close(total.get("under")))}
    spread = odds.get("pointSpread") or {}
    dc = {}
    for side in ("home", "away"):
        node = spread.get(side) or {}
        if ((node.get("close") or {}).get("line")) == "+0.5":  # +0.5 = win or draw = double chance
            dc[side] = american_to_decimal(_close(node))
    name = lambda c: (c.get("team") or {}).get("displayName") or ""  # noqa: E731
    logo = lambda c: (c.get("team") or {}).get("logo")  # noqa: E731
    return {
        "id": str(event.get("id")), "league": league, "leagueName": LEAGUES.get(league, league), "date": event.get("date"),
        "home": {"name": name(home), "logo": logo(home), "form": home.get("form")},
        "away": {"name": name(away), "logo": logo(away), "form": away.get("form")},
        "odds": {"x12": x12, "overUnder": {"line": ou_line, **ou} if ou_line and all(ou.values()) else None,
                 "doubleChance": {k: v for k, v in dc.items() if v}},
        "provider": (odds.get("provider") or {}).get("name") or "DraftKings",
    }


def candidate_picks(match: dict) -> list[dict]:
    """Market selections with their no-vig probability, filtered by recent form."""
    picks: list[dict] = []
    x12 = match["odds"]["x12"]
    probs = no_vig(x12)
    h, a = match["home"]["name"], match["away"]["name"]
    fh, fa = form_points(match["home"]["form"]), form_points(match["away"]["form"])
    form_gap = (fh - fa) if fh is not None and fa is not None else 0.0

    def add(market: str, label: str, decimal: float | None, prob: float, why: str, agrees: bool) -> None:
        if decimal and decimal > 1.15 and agrees:
            picks.append({"matchId": match["id"], "market": market, "label": label, "odds": decimal,
                          "probability": round(prob, 3), "reason": why,
                          "match": f"{h} vs {a}", "leagueName": match["leagueName"], "date": match["date"]})

    for side, team, gap in (("home", h, form_gap), ("away", a, -form_gap)):
        add("1X2", f"Gana {team}", x12[side], probs.get(side, 0),
            f"El mercado le da {round(probs.get(side, 0) * 100)}% y su racha reciente {'acompaña' if gap > 0 else 'no contradice'}.",
            agrees=gap > -0.6)
    dc = match["odds"]["doubleChance"]
    for side, team, gap in (("home", h, form_gap), ("away", a, -form_gap)):
        if side in dc:
            prob = probs.get(side, 0) + probs.get("draw", 0)
            add("Doble oportunidad", f"{team} o empate", dc[side], prob,
                f"Cubre victoria o empate: {round(prob * 100)}% según el mercado.", agrees=gap > -1.0)
    ou = match["odds"]["overUnder"]
    if ou:
        p = no_vig({"over": ou["over"], "under": ou["under"]})
        for side, label in (("over", f"Más de {ou['line']} goles"), ("under", f"Menos de {ou['line']} goles")):
            add("Goles", label, ou[side], p.get(side, 0), f"Probabilidad de mercado {round(p.get(side, 0) * 100)}%.", agrees=True)
    return picks


def build_parlays(picks: list[dict]) -> list[dict]:
    """Up to three parlays from different matches, never two picks of the same game."""
    best_per_match: dict[str, list[dict]] = {}
    for p in sorted(picks, key=lambda x: -x["probability"]):
        best_per_match.setdefault(p["matchId"], []).append(p)

    def combo(name: str, description: str, pool: list[dict], size: int) -> dict | None:
        options = [c for c in combinations(pool, size) if len({p["matchId"] for p in c}) == size]
        if not options:
            return None
        chosen = max(options, key=lambda c: sum(p["probability"] for p in c))
        odds, prob = 1.0, 1.0
        for p in chosen:
            odds *= p["odds"]
            prob *= p["probability"]
        return {"name": name, "description": description, "picks": list(chosen),
                "odds": round(odds, 2), "probability": round(prob, 3)}

    safe_pool = [ps[0] for ps in best_per_match.values() if ps[0]["probability"] >= 0.6][:8]
    value_pool = [p for ps in best_per_match.values() for p in ps if 0.42 <= p["probability"] < 0.62 and p["odds"] >= 1.6][:10]
    goals_pool = [p for ps in best_per_match.values() for p in ps if p["market"] == "Goles" and p["probability"] >= 0.5][:8]
    parlays = [
        combo("Parlay conservador", "Las selecciones con mayor probabilidad según el mercado.", safe_pool, 3),
        combo("Parlay de valor", "Cuotas más altas donde la racha reciente respalda la selección.", value_pool, 2),
        combo("Parlay de goles", "Solo mercados de goles (más/menos).", goals_pool, 3),
    ]
    return [p for p in parlays if p]


async def _league(client: httpx.AsyncClient, league: str) -> list[dict]:
    try:
        res = await client.get(_SCOREBOARD.format(league=league))
        if res.status_code != 200:
            return []
        return [m for m in (parse_match(e, league) for e in res.json().get("events") or []) if m]
    except (httpx.HTTPError, ValueError):
        return []


@router.get("")
async def get_picks(response: Response, hours: int = Query(48, ge=6, le=120)) -> dict:
    key = f"h{hours}"
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < _TTL:
        payload = hit[1]
    else:
        async with httpx.AsyncClient(timeout=httpx.Timeout(8.0)) as client:
            groups = await asyncio.gather(*(_league(client, lg) for lg in LEAGUES))
        limit = datetime.now(timezone.utc) + timedelta(hours=hours)
        matches = sorted((m for g in groups for m in g if m["date"] and datetime.fromisoformat(m["date"].replace("Z", "+00:00")) <= limit),
                         key=lambda m: m["date"])
        picks = [p for m in matches for p in candidate_picks(m)]
        payload = {"generatedAt": datetime.now(timezone.utc).isoformat(), "matches": matches,
                   "parlays": build_parlays(picks), "disclaimer": DISCLAIMER}
        _cache[key] = (time.monotonic(), payload)
    response.headers["Cache-Control"] = "public, max-age=300"
    return payload
