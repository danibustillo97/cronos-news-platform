import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.domain.portal.entities import PortalLayout, StageMedia
from app.presentation.auth import AuthenticatedUser, get_authenticated_user
from app.presentation.main import app


class MemoryRepo:
    def __init__(self):
        self.layout = PortalLayout()

    def get(self):
        return self.layout

    def save(self, layout):
        self.layout = layout


class FakeContainer:
    def __init__(self):
        self.portal_layout_repo = MemoryRepo()


@pytest.fixture
def client():
    container = FakeContainer()
    app.dependency_overrides[get_container] = lambda: container
    yield TestClient(app), container
    app.dependency_overrides.clear()


def as_admin():
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="ed@nexus.test", role="admin")


def test_public_read_returns_contract_shape_without_login(client):
    http, _ = client
    r = http.get("/api/portal/layout")
    assert r.status_code == 200
    assert r.json() == {"stage": {"mode": "news"}, "pinned": [], "hidden": [], "updatedAt": None}
    assert "max-age" in r.headers["cache-control"]


def test_write_requires_admin(client):
    http, _ = client
    assert http.put("/api/portal/layout", json={"stage": {"mode": "news"}}).status_code == 401


def test_admin_turns_on_live_video_and_pins_stories(client):
    http, container = client
    as_admin()
    r = http.put("/api/portal/layout", json={
        "stage": {"mode": "video", "video": {"url": " https://www.youtube.com/watch?v=dQw4w9WgXcQ ", "title": "Clásico EN VIVO"}},
        "pinned": ["n1", "n2", "n1", ""], "hidden": ["n9"],
    })
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["stage"] == {"mode": "video", "video": {"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "title": "Clásico EN VIVO", "poster": None}}
    assert body["pinned"] == ["n1", "n2"] and body["hidden"] == ["n9"]
    assert container.portal_layout_repo.layout.updated_by == "ed@nexus.test"
    assert http.get("/api/portal/layout").json()["stage"]["mode"] == "video"


@pytest.mark.parametrize("payload, message", [
    ({"stage": {"mode": "video"}}, "URL del video"),
    ({"stage": {"mode": "radio", "radio": {"url": "ftp://x"}}}, "http"),
    ({"stage": {"mode": "tv"}}, "modo"),
    ({"stage": {"mode": "news"}, "pinned": ["a"], "hidden": ["a"]}, "fijada y oculta"),
])
def test_invalid_layouts_are_rejected_with_a_clear_reason(client, payload, message):
    http, _ = client
    as_admin()
    r = http.put("/api/portal/layout", json=payload)
    assert r.status_code == 422 and message in r.json()["detail"]


def test_domain_limits():
    with pytest.raises(ValueError):
        PortalLayout(pinned=tuple(str(i) for i in range(13)))
    assert PortalLayout(mode="radio", radio=StageMedia("https://radio.test/live.mp3", "Radio")).mode == "radio"
