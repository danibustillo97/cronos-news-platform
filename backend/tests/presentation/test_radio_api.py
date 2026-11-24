import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.presentation.auth import AuthenticatedUser, get_authenticated_user
from app.presentation.main import app


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload, self.filters = db, table, "select", None, {}

    def select(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def limit(self, *_a, **_k): return self
    def insert(self, payload): self.op, self.payload = "insert", payload; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, key, value): self.filters[key] = value; return self

    def execute(self):
        rows = self.db.rows
        match = [r for r in rows if all(r.get(k) == v for k, v in self.filters.items())]
        if self.op == "insert":
            row = {"id": f"t{len(rows) + 1}", "active": True, "play_count": 0, **self.payload}
            rows.append(row)
            return type("R", (), {"data": [row]})
        if self.op == "update":
            for r in match: r.update(self.payload)
            return type("R", (), {"data": match})
        if self.op == "delete":
            self.db.rows = [r for r in rows if r not in match]
            return type("R", (), {"data": match})
        return type("R", (), {"data": match})


class Bucket:
    def __init__(self, db): self.db = db
    def create_signed_upload_url(self, path): return {"signed_url": f"https://s/{path}?token=abc", "token": "abc", "path": path}
    def get_public_url(self, path): return f"https://cdn.test/media/{path}"
    def remove(self, paths): self.db.removed.extend(paths)


class FakeClient:
    def __init__(self):
        self.rows, self.removed = [], []
        self.storage = type("S", (), {"from_": lambda _s, _b: Bucket(self)})()

    def table(self, name): return Query(self, name)


@pytest.fixture
def http():
    client = FakeClient()
    container = type("C", (), {"news_repo": type("N", (), {"_client": client})()})()
    app.dependency_overrides[get_container] = lambda: container
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="dj@nexus.test", role="admin")
    yield TestClient(app), client
    app.dependency_overrides.clear()


def test_requires_admin():
    app.dependency_overrides.clear()
    assert TestClient(app).get("/api/radio/tracks").status_code == 401


def test_signed_upload_url_only_for_audio(http):
    c, _ = http
    ok = c.post("/api/radio/tracks/upload-url", json={"filename": "Mi Canción Épica.mp3", "contentType": "audio/mpeg"}).json()
    assert ok["path"].startswith("radio/") and ok["path"].endswith(".mp3") and "mi-canci" in ok["path"]
    assert ok["token"] == "abc" and ok["publicUrl"].startswith("https://cdn.test/media/radio/")
    assert c.post("/api/radio/tracks/upload-url", json={"filename": "x.exe", "contentType": "application/x-msdownload"}).status_code == 422


def test_register_edit_play_and_delete(http):
    c, db = http
    track = c.post("/api/radio/tracks", json={"title": "Intro", "kind": "station_id", "url": "https://cdn.test/media/radio/a.mp3",
                                              "storagePath": "radio/a.mp3", "energy": 4, "license": "Propia"}).json()
    assert track["kind"] == "station_id" and track["energy"] == 4
    assert c.post("/api/radio/tracks", json={"title": "X", "kind": "karaoke", "url": "https://a/b.mp3"}).status_code == 422
    assert c.post("/api/radio/tracks", json={"title": "X", "url": "http://a/b.mp3"}).status_code == 422
    assert c.patch(f"/api/radio/tracks/{track['id']}", json={"active": False}).json()["active"] is False
    assert c.post(f"/api/radio/tracks/{track['id']}/played").json()["ok"] is True
    assert c.get("/api/radio/tracks").json()[0]["playCount"] == 1
    assert c.delete(f"/api/radio/tracks/{track['id']}").status_code == 204
    assert db.removed == ["radio/a.mp3"] and c.get("/api/radio/tracks").json() == []
