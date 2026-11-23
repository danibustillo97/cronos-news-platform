from datetime import datetime, timedelta, timezone

from app.domain.discovery.entities import DiscoveryItem, DiscoveryScores, MaterialKind, MaterialReference
from app.domain.discovery.trends import cluster_items, rank_clusters, similarity, title_tokens
from app.domain.shared.ids import DiscoveryItemId

NOW = datetime(2026, 11, 23, 18, 0, tzinfo=timezone.utc)


def item(i, title, source, age_h, relevance=0.5, image=False):
    return DiscoveryItem.discover(
        item_id=DiscoveryItemId.of(i), source_url=f"https://{source}/{i}", original_url=f"https://{source}/{i}",
        original_title=title, raw_text="texto", source_name=source, source_domain=source,
        discovered_at=NOW - timedelta(hours=age_h), published_at=NOW - timedelta(hours=age_h),
        materials=[MaterialReference(kind=MaterialKind.IMAGE, url="https://img/x.jpg")] if image else [],
        scores=DiscoveryScores(relevance_score=relevance),
    )


def test_same_story_from_different_outlets_is_one_cluster():
    clusters = cluster_items([
        item("1", "Esta es la razón por la que Lamine Yamal no jugará con Barcelona en Champions", "eluniversal", 3),
        item("2", "Lamine Yamal, baja en Champions: el Barça ya en Bakú", "mundodeportivo", 2.9),
        item("3", "Lamine, baja para Bakú", "as", 2.8),
        item("4", "Millonarios vence a Junior en el Campín", "eltiempo", 1),
    ])
    sizes = sorted(len(c.sources) for c in clusters)
    assert sizes == [1, 3]


def test_generic_match_words_do_not_merge_different_matches():
    a = title_tokens("América vs. Deportivo Cali: fecha, horario, canal y dónde ver el partido")
    b = title_tokens("Millonarios vs. Bucaramanga: fecha, horario, canal y dónde ver el partido")
    assert similarity(a, b) == 0.0


def test_four_hour_old_story_beats_two_day_old_one():
    ranked = rank_clusters([
        item("old", "Nacional gana el clásico paisa con gol de último minuto", "a", 48, relevance=1.0),
        item("new", "Junior presenta a su nuevo entrenador para 2027", "b", 4, relevance=0.3),
    ], NOW)
    assert str(ranked[0].lead.id) == "new"


def test_trending_story_beats_single_outlet_of_same_age():
    ranked = rank_clusters([
        item("s1", "Luis Díaz se lesiona y es baja con el Bayern", "a", 2),
        item("s2", "Luis Díaz, baja del Bayern por lesión", "b", 2),
        item("s3", "Lesión de Luis Díaz: baja en el Bayern", "c", 2),
        item("solo", "James Rodríguez entrena aparte en Nacional", "d", 2),
    ], NOW)
    top = ranked[0]
    assert len(top.sources) == 3 and "TRENDING" in top.signals(NOW)


def test_signals_breaking_scoop_live():
    (c,) = rank_clusters([item("x", "Levante - Elche, en directo: LaLiga hoy", "as", 0.3)], NOW)
    assert {"BREAKING", "SCOOP", "LIVE"} <= set(c.signals(NOW))
    (old,) = rank_clusters([item("y", "Crónica del Levante - Elche", "as", 5)], NOW)
    assert old.signals(NOW) == []


def test_lead_is_newest_take_with_image():
    (c,) = cluster_items([
        item("preview", "Gimnasia vs Newell's por el Torneo Clausura: hora y TV", "lanacion", 6, image=True),
        item("result", "Gimnasia le gana a Newell's por el Torneo Clausura", "infobae", 1, image=True),
    ])
    assert str(c.lead.id) == "result"
