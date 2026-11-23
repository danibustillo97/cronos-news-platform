import pytest

from app.domain.content.catalog import SOURCES
from app.domain.content.profile import ContentProfile, CustomSource, score_relevance

FOOTBALL = ContentProfile(mode="football", competitions=("colombia", "laliga", "argentina"), focuses=("market", "stats"))


def test_keeps_football_and_tags_the_right_competition():
    rel = score_relevance(FOOTBALL, "Nacional vence a Millonarios en el clásico de la Liga BetPlay",
                          "El partido se jugó en el estadio con goles de...")
    assert rel.keep and rel.competitions == ["Liga BetPlay y Selección Colombia"]
    assert "LaLiga" not in rel.competitions          # "la Liga BetPlay" is not LaLiga


def test_independiente_medellin_is_not_argentine_football():
    rel = score_relevance(FOOTBALL, "Independiente Medellín llega en alza a los cuadrangulares",
                          "El DIM ganó en la Liga BetPlay y el técnico celebró el partido.")
    assert "Fútbol argentino" not in rel.competitions


def test_drops_other_sports():
    rel = score_relevance(FOOTBALL, "Alcaraz gana en Wimbledon y sube en el ranking ATP", "El tenista español...")
    assert not rel.keep


def test_drops_items_outside_chosen_competitions_without_football_signal():
    rel = score_relevance(FOOTBALL, "Elecciones presidenciales: resultados", "El conteo de votos...")
    assert not rel.keep


def test_market_focus_raises_score():
    plain = score_relevance(FOOTBALL, "Real Madrid entrena antes del partido de LaLiga", "El equipo trabajó...")
    market = score_relevance(FOOTBALL, "Fichaje: el Real Madrid cierra el traspaso de un delantero en LaLiga",
                             "La cláusula y el contrato de cinco años del nuevo fichaje...")
    assert market.score > plain.score and "Mercado de fichajes" in market.focuses


def test_blocked_terms_and_priority_terms():
    profile = ContentProfile(mode="football", competitions=("colombia",), blocked_terms=("apuestas",),
                             priority_terms=("Millonarios",))
    assert not score_relevance(profile, "Las mejores apuestas para la Liga BetPlay", "").keep
    boosted = score_relevance(profile, "Millonarios gana en la Liga BetPlay", "")
    normal = score_relevance(profile, "Junior gana en la Liga BetPlay", "")
    assert boosted.score > normal.score


def test_mode_all_keeps_everything():
    assert score_relevance(ContentProfile(mode="all"), "Elecciones presidenciales", "").keep


def test_active_sources_follow_competitions_and_toggles():
    only_colombia = ContentProfile(mode="football", competitions=("colombia",), focuses=())
    ids = {s.id for s in only_colombia.active_sources()}
    assert "eltiempo-futcol" in ids and "md-premier" not in ids and "md-fichajes" not in ids
    assert "infobae-deportes" in ids                      # general outlets always included
    with_market = ContentProfile(mode="football", competitions=("colombia",), focuses=("market",),
                                 disabled_sources=("infobae-deportes",),
                                 custom_sources=(CustomSource(url="https://mi.blog/rss"),))
    sources = with_market.active_sources()
    ids = {getattr(s, "id", s.url) for s in sources}
    assert "md-fichajes" in ids and "infobae-deportes" not in ids and "https://mi.blog/rss" in ids


def test_mode_all_uses_all_mode_sources_only():
    ids = {s.id for s in ContentProfile(mode="all").active_sources()}
    assert ids == {s.id for s in SOURCES if "all" in s.modes}


def test_validation():
    with pytest.raises(ValueError):
        ContentProfile(mode="cricket")
    with pytest.raises(ValueError):
        ContentProfile(mode="football", competitions=())
    with pytest.raises(ValueError):
        ContentProfile(mode="football", competitions=("nope",))
    with pytest.raises(ValueError):
        ContentProfile(custom_sources=(CustomSource(url="ftp://x"),))
