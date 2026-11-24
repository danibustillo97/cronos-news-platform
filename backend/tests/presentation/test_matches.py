from app.presentation.api import matches

SUMMARY = {
    "header": {"league": {"name": "UEFA Champions League"}, "competitions": [{
        "id": "1", "date": "2026-11-24T20:00Z",
        "status": {"displayClock": "13'", "period": 1, "type": {"state": "in", "shortDetail": "13'"}},
        "competitors": [
            {"homeAway": "home", "score": "1", "form": "WWDWL", "team": {"id": "359", "displayName": "Arsenal", "abbreviation": "ARS", "logos": [{"href": "ars.png"}]}},
            {"homeAway": "away", "score": "0", "team": {"id": "124", "displayName": "Borussia Dortmund", "abbreviation": "BVB", "logo": "bvb.png"}},
        ]}]},
    "keyEvents": [
        {"id": "a", "type": {"type": "kickoff"}, "clock": {"displayValue": ""}, "text": "First Half begins."},
        {"id": "b", "type": {"type": "goal---header"}, "clock": {"displayValue": "10'"}, "team": {"id": "359"},
         "participants": [{"athlete": {"id": "258906", "displayName": "Viktor Gyökeres"}}, {"athlete": {"id": "293236", "displayName": "Noni Madueke"}}]},
        {"id": "c", "type": {"type": "yellow-card"}, "clock": {"displayValue": "30'"}, "team": {"id": "124"},
         "participants": [{"athlete": {"id": "9", "displayName": "Emre Can"}}]},
    ],
    "boxscore": {"teams": [
        {"team": {"id": "359"}, "statistics": [{"name": "possessionPct", "displayValue": "77.2"}, {"name": "totalShots", "displayValue": "4"}]},
        {"team": {"id": "124"}, "statistics": [{"name": "possessionPct", "displayValue": "22.8"}, {"name": "totalShots", "displayValue": "1"}]},
    ]},
    "rosters": [{"homeAway": "home", "roster": [{"athlete": {"id": "258906", "displayName": "Viktor Gyökeres"}, "jersey": "14", "position": {"abbreviation": "F"}, "starter": True}]}],
    "commentary": [{"time": {"displayValue": "1'"}, "text": "Arranca"}, {"time": {"displayValue": "10'"}, "text": "¡Gol!"}],
    "gameInfo": {"venue": {"fullName": "Emirates Stadium"}},
}


def test_event_types():
    assert matches.event_type("goal---free-kick") == "goal"
    assert matches.event_type("penalty---scored") == "penalty-goal"
    assert matches.event_type("own-goal") == "own-goal"
    assert matches.event_type("yellow-card") == "yellow"
    assert matches.event_type("yellow-red-card") == "red"
    assert matches.event_type("substitution") == "sub"
    assert matches.event_type("halftime") == "period"


def test_parse_summary():
    m = matches.parse_summary(SUMMARY, "uefa.champions")
    assert (m["home"]["name"], m["home"]["score"], m["away"]["score"], m["state"], m["venue"]) == ("Arsenal", 1, 0, "in", "Emirates Stadium")
    assert m["away"]["logo"] == "bvb.png"
    goal = m["events"][1]
    assert goal["type"] == "goal" and goal["team"] == "home" and goal["player"]["name"] == "Viktor Gyökeres" and goal["assist"]["id"] == "293236"
    assert m["events"][2]["team"] == "away" and m["events"][2]["assist"] is None
    assert m["stats"][0] == {"key": "possessionPct", "label": "Posesión", "home": 77.2, "away": 22.8, "percent": True}
    assert m["lineups"]["home"][0]["starter"] is True and m["lineups"]["away"] == []
    assert m["commentary"][0]["text"] == "¡Gol!"  # newest first


def test_facts_are_computed_and_pluralized():
    games = [{"date": "2026-11-21", "opponent": "Newcastle", "goals": 0, "assists": 0},
             {"date": "2026-11-07", "opponent": "Hull", "goals": 0, "assists": 1},
             {"date": "2026-11-01", "opponent": "Liverpool", "goals": 2, "assists": 0}]
    season = {"season": "2026-27", "competition": "Premier League", "goals": 1, "assists": 1, "starts": 1, "shots": 10, "shotsOnTarget": 4}
    facts = matches.build_facts("Viktor Gyökeres", games, season, 28, "Delantero")
    assert facts[0] == "Llegaba con 2 goles en sus últimos 3 partidos registrados."
    assert facts[1].startswith("No marcaba desde hace 2 partidos (último gol: 2026-11-01 ante Liverpool)")
    assert "1 gol y 1 asistencia en Premier League 2026-27 (1 titularidad)" in facts[3]
    assert "Va al arco con el 40% de sus remates." in facts
    assert facts[-1] == "Delantero, 28 años."
    dry = matches.build_facts("Juan Pérez", [{"date": "d", "opponent": "x", "goals": 0, "assists": 0}] * 4, None, None, None)
    assert dry == ["Pérez no marcaba en sus últimos 4 partidos: este gol rompe la sequía."]


def test_pick_season_prefers_most_starts_in_latest_season():
    seasons = [
        {"season": "2026-27", "competition": "Copa", "stats": {"starts": 1, "goals": 0}},
        {"season": "2026-27", "competition": "Liga", "stats": {"starts": 9, "goals": 5, "assists": 2}},
        {"season": "2025-26", "competition": "Liga", "stats": {"starts": 30, "goals": 20}},
    ]
    assert matches.pick_season(seasons)["competition"] == "Liga" and matches.pick_season(seasons)["goals"] == 5
    assert matches.pick_season([]) is None
