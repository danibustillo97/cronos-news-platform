from app.domain.editorial.originality import SourceText, check_originality

SOURCE = SourceText("AS Colombia", "https://as.test/1",
    "Millonarios venció 2-1 a Santa Fe en el clásico capitalino disputado en El Campín este domingo. "
    "El técnico destacó el trabajo del equipo y la actitud de los jugadores durante todo el partido. "
    "Con este resultado el conjunto azul quedó líder de su grupo en los cuadrangulares.")


def test_copied_article_scores_low_and_reports_the_sentences():
    article = ("Millonarios venció 2-1 a Santa Fe en el clásico capitalino disputado en El Campín este domingo. "
               "El técnico destacó el trabajo del equipo y la actitud de los jugadores durante todo el partido.")
    report = check_originality(article, [SOURCE])
    assert report.originality < 15
    assert len(report.copied) == 2 and report.copied[0].source == "AS Colombia"


def test_rewritten_article_is_original_even_with_same_facts():
    article = ("En el clásico de Bogotá, el cuadro embajador se impuso por 2-1 ante los cardenales. "
               "El entrenador elogió la entrega de sus futbolistas y el compromiso colectivo. "
               "Así, los azules encabezan su zona del todos contra todos final.")
    report = check_originality(article, [SOURCE])
    assert report.originality > 90 and report.copied == []


def test_partial_copy_is_measured_proportionally_and_per_source():
    other = SourceText("Olé", "https://ole.test/2", "Con este resultado el conjunto azul quedó líder de su grupo en los cuadrangulares.")
    article = ("El cuadro embajador ganó el clásico con autoridad y muchas ocasiones claras en el segundo tiempo. "
               "Con este resultado el conjunto azul quedó líder de su grupo en los cuadrangulares.")
    report = check_originality(article, [SOURCE, other])
    assert 30 < report.originality < 75
    assert {s.name for s in report.sources} == {"AS Colombia", "Olé"}
    assert len(report.copied) == 1


def test_no_sources_means_nothing_to_compare():
    report = check_originality("Texto propio de la redacción sobre el partido de anoche.", [])
    assert report.originality == 100.0 and report.compared_sources == 0
