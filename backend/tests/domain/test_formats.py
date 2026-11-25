from app.domain.football.formats import FORMATS, format_for, group_label


def test_group_labels():
    assert group_label("Semifinals - Group A", "col.1") == "Cuadrangular A"
    assert group_label("Group B", "conmebol.libertadores") == "Grupo B"
    assert group_label("League Phase", "uefa.champions") == "Fase de liga"
    assert group_label("", "eng.1") == "Tabla"


def test_formats_cover_followed_leagues():
    for league in ("col.1", "uefa.champions", "conmebol.libertadores", "eng.1", "esp.1"):
        assert format_for(league) is not None
    assert "cuadrangulares" in FORMATS["col.1"].summary
