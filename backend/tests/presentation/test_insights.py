from app.presentation.api import insights


def _rows(n=36, pts=None):
    return [{"pos": i + 1, "teamId": str(i + 1), "team": f"T{i + 1}", "points": (pts or {}).get(i + 1, 40 - i), "played": 5, "gd": 0}
            for i in range(n)]


def test_form_from_winner_first_scores():
    f = insights.form_of([
        {"gameResult": "W", "score": "5-2"}, {"gameResult": "L", "score": "4-0"}, {"gameResult": "W", "score": "2-0"},
        {"gameResult": "L", "score": "2-1"}, {"gameResult": "L", "score": "4-1"},
    ])
    assert (f["results"], f["w"], f["l"], f["gf"], f["ga"]) == ("WLWLL", 2, 3, 9, 12)
    assert insights.form_sentence("Sabah", f) == "Sabah llega golpeado: perdió 3 de sus últimos 5, con 9 goles a favor y 12 en contra."
    hot = insights.form_of([{"gameResult": "W", "score": "2-0"}] * 4 + [{"gameResult": "D", "score": "1-1"}])
    assert insights.form_sentence("Barcelona", hot).startswith("Barcelona llega en racha: ganó 4 de sus últimos 5")


def test_table_sentence_uses_competition_format():
    rows = _rows(pts={8: 10, 10: 8, 24: 5, 26: 3})
    assert insights.table_sentence("uefa.champions", rows, "10", "Villarreal") == \
        "Villarreal es 10.º con 8 puntos (zona de playoff); una victoria lo mete en la pelea por los octavos directos."
    assert "alcanza la zona de playoff" in insights.table_sentence("uefa.champions", rows, "26", "Slavia")
    league = _rows(20, pts={1: 30, 2: 28})
    assert insights.table_sentence("eng.1", league, "2", "Arsenal") == "Arsenal es 2.º con 28 puntos; está a 2 puntos del líder."
    assert insights.table_sentence("eng.1", league, "99", "X") is None


def test_preview_from_summary():
    summary = {
        "header": {"competitions": [{"id": "9", "date": "2026-11-25T17:45Z", "competitors": [
            {"homeAway": "home", "team": {"id": "1", "displayName": "Sabah FK", "abbreviation": "SAB"}},
            {"homeAway": "away", "team": {"id": "2", "displayName": "Barcelona", "abbreviation": "BAR"}}]}]},
        "lastFiveGames": [
            {"team": {"id": "1"}, "events": [{"gameResult": "L", "score": "4-0"}]},
            {"team": {"id": "2"}, "events": [{"gameResult": "W", "score": "3-0"}] * 4 + [{"gameResult": "L", "score": "2-1"}]},
        ],
        "standings": {"groups": [{"standings": {"entries": [
            {"id": str(i), "team": f"T{i}", "stats": [{"name": "points", "value": 40 - i}, {"name": "gamesPlayed", "value": 5}]} for i in range(1, 37)]}}]},
        "pickcenter": [{"homeTeamOdds": {"moneyLine": 1800}, "awayTeamOdds": {"moneyLine": -1600}, "drawOdds": {"moneyLine": 900}}],
    }
    p = insights.build_preview(summary, "uefa.champions")
    assert p["headline"] == "Antesala: Sabah FK vs Barcelona" and p["kind"] == "preview"
    assert any(f.startswith("Barcelona llega en racha") for f in p["facts"])
    assert p["market"]["away"] > 85 and p["facts"][-1].startswith("El mercado da")
    assert p["home"]["position"] == 1 and any(r["highlight"] for r in p["standings"])


def test_match_ranking_prefers_big_leagues():
    ev = {"date": "2099-01-01T00:00Z"}
    assert insights.match_score("uefa.champions", ev) > insights.match_score("fra.1", ev)


def test_diverse_caps_each_league():
    ranked = [("uefa.champions", {"id": i}) for i in range(6)] + [("col.1", {"id": 10}), ("eng.1", {"id": 11})]
    picked = insights.diverse(ranked, 10, 3)
    assert [lg for lg, _ in picked] == ["uefa.champions"] * 3 + ["col.1", "eng.1"]
