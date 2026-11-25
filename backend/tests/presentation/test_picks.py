from app.presentation.api import picks


def _event(eid, home, away, ml, total=("o2.5", "+120", "-160"), spread_away=("+0.5", "+140"), forms=("WWWDW", "LLDLL"), state="pre"):
    return {"id": eid, "date": "2026-11-25T01:00Z", "competitions": [{
        "status": {"type": {"state": state}},
        "competitors": [
            {"homeAway": "home", "form": forms[0], "team": {"displayName": home, "logo": "h.png"}},
            {"homeAway": "away", "form": forms[1], "team": {"displayName": away, "logo": "a.png"}},
        ],
        "odds": [{"provider": {"name": "DraftKings"},
                  "moneyline": {"home": {"close": {"odds": ml[0]}}, "draw": {"close": {"odds": ml[1]}}, "away": {"close": {"odds": ml[2]}}},
                  "total": {"over": {"close": {"line": total[0], "odds": total[1]}}, "under": {"close": {"line": "u" + total[0][1:], "odds": total[2]}}},
                  "pointSpread": {"home": {"close": {"line": "-0.5", "odds": "-195"}}, "away": {"close": {"line": spread_away[0], "odds": spread_away[1]}}}}],
    }]}


def test_odds_math():
    assert picks.american_to_decimal("-185") == round(1 + 100 / 185, 3)
    assert picks.american_to_decimal("+500") == 6.0
    assert picks.american_to_decimal(None) is None
    probs = picks.no_vig({"home": 1.54, "draw": 3.75, "away": 6.0})
    assert abs(sum(probs.values()) - 1) < 1e-9 and 0.59 < probs["home"] < 0.61
    assert picks.form_points("WWDLW") == 2.0 and picks.form_points("") is None


def test_parse_match_skips_started_and_reads_markets():
    assert picks.parse_match(_event("1", "A", "B", ("-185", "+275", "+500"), state="in"), "col.1") is None
    m = picks.parse_match(_event("1", "Millonarios", "Bucaramanga", ("-185", "+275", "+500")), "col.1")
    assert m["leagueName"] == "Liga BetPlay" and m["odds"]["overUnder"]["line"] == 2.5
    assert m["odds"]["doubleChance"] == {"away": 2.4}


def test_form_filter_blocks_picks_against_bad_form():
    m = picks.parse_match(_event("1", "Favorito", "Rival", ("-185", "+275", "+500"), forms=("LLLLL", "WWWWW")), "col.1")
    labels = [p["label"] for p in picks.candidate_picks(m)]
    assert "Gana Favorito" not in labels  # market likes it, form strongly contradicts
    assert "Gana Rival" in labels


def test_parlays_use_distinct_matches():
    events = [_event(str(i), f"Local{i}", f"Visita{i}", ("-250", "+350", "+700")) for i in range(4)]
    ms = [picks.parse_match(e, "eng.1") for e in events]
    parlays = picks.build_parlays([p for m in ms for p in picks.candidate_picks(m)])
    assert parlays, "expected at least one parlay"
    for parlay in parlays:
        ids = [p["matchId"] for p in parlay["picks"]]
        assert len(ids) == len(set(ids))
        expected = 1.0
        for p in parlay["picks"]:
            expected *= p["odds"]
        assert parlay["odds"] == round(expected, 2)
        assert 0 < parlay["probability"] < 1


def test_day_labels_in_colombian_time():
    from datetime import datetime, timezone
    now = datetime(2026, 11, 25, 15, 0, tzinfo=timezone.utc)  # 10:00 in Bogotá
    assert picks.day_label("2026-11-25T20:00Z", now) == "hoy"
    assert picks.day_label("2026-11-26T04:00Z", now) == "hoy"  # 23:00 Bogotá
    assert picks.day_label("2026-11-26T20:00Z", now) == "mañana"


def test_today_first_parlays():
    from datetime import datetime, timezone
    events = [_event(str(i), f"L{i}", f"V{i}", ("-250", "+350", "+700")) for i in range(6)]
    ms = [picks.parse_match(e, "eng.1") for e in events]
    ps = [{**p, "day": "hoy" if int(p["matchId"]) < 3 else "mañana"} for m in ms for p in picks.candidate_picks(m)]
    first = picks.today_first_parlays(ps, datetime.now(timezone.utc))[0]
    assert all(p["day"] == "hoy" for p in first["picks"])
