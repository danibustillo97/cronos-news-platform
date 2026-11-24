from fastapi.testclient import TestClient

from app.presentation.api import players
from app.presentation.main import app

SEARCH = {"results": [{"contents": [
    {"uid": "s:600~a:257390", "displayName": "Luis Díaz", "subtitle": "Bayern Munich", "image": {}},
    {"uid": "s:1~l:10~a:34939", "displayName": "Luis Diaz", "subtitle": "San Diego Padres"},  # baseball: excluded
    {"uid": "s:600~a:286319", "displayName": "Luis Díaz", "subtitle": "Alajuelense",
     "image": {"default": "https://a.espncdn.com/i/headshots/soccer/players/full/286319"}},
    {"uid": "s:600~a:257390", "displayName": "Luis Díaz", "subtitle": "Bayern Munich"},  # duplicate
]}]}

TEAM = {"displayName": "Bayern München", "logos": [{"href": "https://cdn/132.png", "rel": ["full", "default"]}]}
STATS = {
    "teams": {"ger.bayern_munich": TEAM},
    "leagues": {"ger.1": {"displayName": "Bundesliga"}, "uefa.champions": {"displayName": "Champions League"}},
    "categories": [{"labels": ["STRT", "FC", "FA", "YC", "RC", "G", "A", "SHOT", "SOG", "OFF"], "statistics": [
        {"teamSlug": "ger.bayern_munich", "leagueSlug": "ger.1", "season": {"displayName": "2026-27 German Bundesliga"},
         "stats": ["5", "9", "5", "0", "0", "4", "1", "18", "9", "4"]},
        {"teamSlug": "ger.bayern_munich", "leagueSlug": "ger.1", "season": {"displayName": "2025-26 German Bundesliga"},
         "stats": ["27", "35", "38", "5", "1", "15", "14", "88", "37", "26"]},
        {"teamSlug": "ger.bayern_munich", "leagueSlug": "uefa.champions", "season": {"displayName": "2026-27 Champions League"},
         "stats": ["2", "3", "0", "0", "0", "1", "0", "5", "4", "4"]},
    ]}],
}
ATHLETE = {"athlete": {"displayName": "Luis Díaz", "age": 29, "position": {"displayName": "Forward"}, "team": TEAM,
                       "citizenship": "Colombia", "flag": {"href": "https://cdn/col.png"}, "jersey": "14"}}


def test_search_keeps_only_unique_soccer_players():
    out = players.parse_search(SEARCH, limit=8)
    assert [p["id"] for p in out] == ["257390", "286319"]
    assert out[0] == {"id": "257390", "name": "Luis Díaz", "team": "Bayern Munich", "image": None}


def test_profile_maps_stats_per_season_and_competition():
    prof = players.parse_profile("257390", ATHLETE, STATS)
    assert prof["position"] == "Delantero" and prof["team"] == "Bayern München" and prof["teamLogo"] == "https://cdn/132.png"
    assert prof["image"].endswith("/257390.png")  # headshot fallback; UI shows a monogram if it 404s
    first = prof["seasons"][0]
    assert (first["season"], first["competition"]) == ("2026-27", "Champions League")
    league = next(s for s in prof["seasons"] if s["season"] == "2025-26")
    assert league["stats"]["goals"] == 15 and league["stats"]["assists"] == 14 and league["stats"]["shotsOnTarget"] == 37
    assert league["team"] == "Bayern München" and league["teamLogo"] == "https://cdn/132.png"


def test_overview_adds_cups_without_duplicating_league():
    overview = {"statistics": {"labels": ["STRT", "FC", "FA", "YC", "RC", "G", "A", "SHOT", "SOG", "OFF"], "splits": [
        {"displayName": "2026-27 German Bundesliga", "stats": ["5", "9", "5", "0", "0", "4", "1", "18", "9", "4"]},
        {"displayName": "2026-27 German Cup", "stats": ["1", "0", "1", "0", "0", "0", "0", "3", "1", "2"]},
    ]}}
    stats = {**STATS, "categories": [{**STATS["categories"][0], "statistics": STATS["categories"][0]["statistics"][:2]}]}
    prof = players.parse_profile("257390", ATHLETE, stats, overview)
    current = [(s["competition"], s["team"]) for s in prof["seasons"] if s["season"] == "2026-27"]
    assert current == [("Copa de Alemania", "Bayern München"), ("Bundesliga", "Bayern München")]


def test_profile_without_stats_still_returns():
    assert players.parse_profile("1", ATHLETE, {})["seasons"] == []


def test_routes_validate_input_and_use_cache(monkeypatch):
    players._cache.clear()
    calls = []

    async def fake_get(url, params=None):
        calls.append(url)
        return STATS if url.endswith("/stats") else {} if url.endswith("/overview") else ATHLETE

    monkeypatch.setattr(players, "_get_json", fake_get)
    http = TestClient(app)
    assert http.get("/api/players/search?q=a").status_code == 422
    assert http.get("/api/players/abc").status_code == 404
    first = http.get("/api/players/257390")
    assert first.status_code == 200 and first.json()["name"] == "Luis Díaz"
    http.get("/api/players/257390")
    assert len(calls) == 3  # athlete + stats + overview; second request served from cache
    players._cache.clear()


def test_unknown_player_is_404(monkeypatch):
    players._cache.clear()

    class Res:
        status_code = 400
        def json(self): return {}

    class Client:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k): return Res()

    monkeypatch.setattr(players.httpx, "AsyncClient", Client)
    assert TestClient(app).get("/api/players/999999999").status_code == 404
