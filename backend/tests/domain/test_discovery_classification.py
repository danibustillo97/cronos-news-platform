from app.domain.category.entities import Category, CategoryGroup, Topic
from app.domain.discovery.classification import classify


def _groups():
    futbol = Category(
        id="cat-futbol", group_id="grp-deportes", name="Fútbol", slug="futbol", sort_order=1, active=True,
        topics=[Topic(id="t1", category_id="cat-futbol", name="Champions League", slug="champions-league")],
    )
    tecnologia = Category(
        id="cat-tech", group_id="grp-tech", name="Tecnología", slug="tecnologia", sort_order=1, active=True,
        topics=[Topic(id="t2", category_id="cat-tech", name="Inteligencia Artificial", slug="ia")],
    )
    return [
        CategoryGroup(id="grp-deportes", name="Deportes", slug="deportes", sort_order=1, active=True, categories=[futbol]),
        CategoryGroup(id="grp-tech", name="Tecnología", slug="tecnologia", sort_order=2, active=True, categories=[tecnologia]),
    ]


def test_matches_real_category_by_name():
    category_id, topics = classify("El Real Madrid avanza en la Champions League tras vencer 2-0", _groups())
    assert category_id == "cat-futbol"
    assert "Champions League" in topics


def test_returns_none_when_nothing_matches():
    category_id, topics = classify("Un texto sin ninguna categoría real conocida", _groups())
    assert category_id is None
    assert topics == []


def test_collects_topics_across_categories():
    text = "La Champions League y la Inteligencia Artificial no tienen relación, pero ambas aparecen"
    category_id, topics = classify(text, _groups())
    assert category_id == "cat-futbol"  # first match wins for category_id
    assert set(topics) == {"Champions League", "Inteligencia Artificial"}
