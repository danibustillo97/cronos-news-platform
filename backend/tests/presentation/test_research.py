import pytest
from fastapi import HTTPException

from app.presentation.api import research

WIKI = """== Acontecimientos ==
* 1944: en [[Italia]] —en el marco de la [[Segunda Guerra Mundial]]— comienza una batalla.
* [[1948]]: en [[Venezuela]] hay un [[golpe de Estado]].
* [[1993]]: la [[Selección de fútbol de Colombia|selección colombiana]] golea 5-0 a Argentina.<ref>FIFA</ref>
== Nacimientos ==
* 1961: [[Carlos Valderrama]], futbolista colombiano.
* 1970: [[Fulano]], jugador de [[fútbol americano]].
== Celebraciones ==
* Día del fútbol imaginario.
"""


def test_football_facts_filters_and_cleans():
    facts = research.football_facts(WIKI, "https://es.wikipedia.org/wiki/5_de_septiembre")
    assert [(f["year"], f["section"]) for f in facts] == [(1993, "Acontecimientos"), (1961, "Nacimientos")]
    assert facts[0]["text"] == "la selección colombiana golea 5-0 a Argentina."
    assert facts[1]["text"] == "Carlos Valderrama, futbolista colombiano."


def test_day_title():
    assert research.day_title("11-24") == "24 de noviembre"
    with pytest.raises(HTTPException):
        research.day_title("13-01")
