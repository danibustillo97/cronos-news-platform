import random

import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.presentation.api import capsules
from app.presentation.auth import AuthenticatedUser, get_authenticated_user
from app.presentation.main import app


class Result:
    def __init__(self, data): self.data = data


class Query:
    def __init__(self, db):
        self.db, self.op, self.payload, self.filters = db, "select", None, []

    def select(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def limit(self, *_a, **_k): return self
    def insert(self, payload): self.op, self.payload = "insert", payload; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, k, v): self.filters.append(lambda r: r.get(k) == v); return self

    def execute(self):
        match = [r for r in self.db.rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            self.db.seq += 1
            row = {"id": f"c{self.db.seq}", "status": "draft", "slides": [], "tags": [], "created_at": f"2026-11-{self.db.seq:02d}", **self.payload}
            self.db.rows.append(row)
            return Result([row])
        if self.op == "update":
            for r in match: r.update(self.payload)
            return Result(match)
        if self.op == "delete":
            self.db.rows = [r for r in self.db.rows if r not in match]
            return Result(match)
        return Result(match)


class FakeClient:
    def __init__(self): self.rows, self.seq = [], 0
    def table(self, _name): return Query(self)


@pytest.fixture
def env():
    client = FakeClient()
    container = type("C", (), {"news_repo": type("N", (), {"_client": client})()})()
    app.dependency_overrides[get_container] = lambda: container
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="ed@nexus.test", role="admin")
    yield TestClient(app), client, container
    app.dependency_overrides.clear()


def _make(http, **over):
    body = {"kind": "sabias_que", "title": "El gol más rápido", "slides": [{"text": "Fue a los 2 segundos."}], "status": "published", **over}
    res = http.post("/api/admin/capsules", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_efemeride_requires_day_and_year(env):
    http, _, _ = env
    bad = http.post("/api/admin/capsules", json={"kind": "efemeride", "title": "Colombia 5-0 Argentina", "slides": [{"text": "x"}]})
    assert bad.status_code == 422 and "MM-DD" in bad.json()["detail"]
    wrong_day = http.post("/api/admin/capsules", json={"kind": "efemeride", "title": "Colombia 5-0 Argentina", "day": "13-40", "year": 1993, "slides": [{"text": "x"}]})
    assert wrong_day.status_code == 422
    ok = _make(http, kind="efemeride", title="Colombia 5-0 Argentina", day="09-05", year=1993, tags=["#Colombia", " "])
    assert ok["date"] == "09-05" and ok["tags"] == ["Colombia"]


def test_public_hides_drafts_and_internal_fields(env):
    http, _, _ = env
    draft = _make(http, status="draft")
    pub = _make(http, kind="leyenda", title="El Pibe Valderrama", subject="Carlos Valderrama", sources="Archivo")
    assert http.get(f"/api/capsules/{draft['id']}").status_code == 404
    body = http.get(f"/api/capsules/{pub['id']}").json()
    assert body["title"] == "El Pibe Valderrama" and "sources" not in body and "status" not in body
    assert [c["id"] for c in http.get("/api/capsules?kind=leyenda").json()["capsules"]] == [pub["id"]]


def test_feed_puts_todays_efemerides_first_and_mixes_kinds():
    rows = [
        {"id": "e1", "kind": "efemeride", "day": "11-24", "year": 2001},
        {"id": "e0", "kind": "efemeride", "day": "11-24", "year": 1974},
        {"id": "eX", "kind": "efemeride", "day": "03-01", "year": 1990},  # another day: not today
        {"id": "s1", "kind": "sabias_que"}, {"id": "s2", "kind": "sabias_que"},
        {"id": "l1", "kind": "leyenda"},
    ]
    out = [r["id"] for r in capsules.compose_feed(rows, "11-24", 10, random.Random(1))]
    assert out[:2] == ["e0", "e1"]
    assert "eX" not in out
    assert set(out[2:]) == {"s1", "s2", "l1"}
    assert out[2] in {"s1", "s2"} and out[3] == "l1"  # alternates kinds


def test_patch_and_delete(env):
    http, _, _ = env
    cap = _make(http)
    res = http.patch(f"/api/admin/capsules/{cap['id']}", json={"title": "El gol más rápido de la historia", "status": "draft"})
    assert res.status_code == 200 and res.json()["status"] == "draft"
    assert http.delete(f"/api/admin/capsules/{cap['id']}").status_code == 204
    assert http.delete(f"/api/admin/capsules/{cap['id']}").status_code == 404


def test_ai_uses_resolved_provider(env):
    http, _, container = env

    class Gen:
        def complete_text(self, prompt, max_tokens=1500, timeout=90.0): return "```text\nTIPO: leyenda\n```"

    container.artifact_provider_resolver = type("R", (), {"resolve": lambda _s, _p: "claude_code", "get": lambda _s, _i: Gen()})()
    res = http.post("/api/admin/capsules/ai", json={"prompt": "Crea una cápsula de leyenda sobre Valderrama"})
    assert res.status_code == 200 and res.json()["provider"] == "claude_code"


def test_missing_table_is_503(env):
    http, client, _ = env

    def boom(_name):
        raise Exception("{'code': 'PGRST205', 'message': \"Could not find the table 'public.capsules'\"}")

    client.table = boom
    res = http.get("/api/capsules/feed")
    assert res.status_code == 503 and "20261124d_capsules.sql" in res.json()["detail"]


def test_upload_url_accepts_images_only(env):
    http, client, _ = env

    class Bucket:
        def create_signed_upload_url(self, path): return {"token": "tok", "path": path}
        def get_public_url(self, path): return f"https://cdn.test/media/{path}"

    client.storage = type("S", (), {"from_": lambda _s, _b: Bucket()})()
    ok = http.post("/api/admin/capsules/upload-url", json={"filename": "Pibe Valderrama.JPG", "contentType": "image/jpeg"}).json()
    assert ok["path"].startswith("capsules/") and ok["path"].endswith("-pibe-valderrama.jpg") and ok["token"] == "tok"
    assert http.post("/api/admin/capsules/upload-url", json={"filename": "x.gif", "contentType": "image/gif"}).status_code == 422
