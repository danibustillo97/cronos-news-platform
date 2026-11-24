from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.presentation.api import social
from app.presentation.auth import AuthenticatedUser, get_authenticated_user
from app.presentation.main import app


class Result:
    def __init__(self, data): self.data = data


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload, self.filters, self.desc = db, table, "select", None, [], False

    def select(self, *_a, **_k): return self
    def limit(self, *_a, **_k): return self
    def order(self, _k, desc=False): self.desc = desc; return self
    def insert(self, p): self.op, self.payload = "insert", p; return self
    def update(self, p): self.op, self.payload = "update", p; return self
    def delete(self): self.op = "delete"; return self
    def upsert(self, p, on_conflict=None): self.op, self.payload = "upsert", p; return self
    def eq(self, k, v): self.filters.append(lambda r: r.get(k) == v); return self
    def gte(self, k, v): self.filters.append(lambda r: str(r.get(k)) >= v); return self

    def execute(self):
        rows = self.db.tables[self.table]
        match = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            self.db.seq += 1
            row = {"id": f"k{self.db.seq}", "created_at": self.db.now().isoformat(), **self.payload}
            rows.append(row)
            return Result([row])
        if self.op == "upsert":
            keys = ("target_type", "target_id", "voter_hash")
            existing = next((r for r in rows if all(r[k] == self.payload[k] for k in keys)), None)
            if existing: existing.update(self.payload)
            else: rows.append(dict(self.payload))
            return Result([self.payload])
        if self.op == "update":
            for r in match: r.update(self.payload)
            return Result(match)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in match]
            return Result(match)
        return Result(sorted(match, key=lambda r: str(r.get("created_at")), reverse=self.desc))


class Rpc:
    def __init__(self, db, params): self.db, self.params = db, params

    def execute(self):
        counts = {}
        for r in self.db.tables["reactions"]:
            if r["target_type"] == self.params["p_type"] and r["target_id"] == self.params["p_id"]:
                counts[r["reaction"]] = counts.get(r["reaction"], 0) + 1
        return Result([{"reaction": k, "n": v} for k, v in counts.items()])


class FakeClient:
    def __init__(self):
        self.tables = {"reactions": [], "comments": []}
        self.seq = 0
        self.clock = datetime(2026, 11, 24, 12, 0, tzinfo=timezone.utc)

    def now(self): return self.clock
    def table(self, name): return Query(self, name)
    def rpc(self, _n, params): return Rpc(self, params)


@pytest.fixture
def env(monkeypatch):
    client = FakeClient()
    container = type("C", (), {"news_repo": type("N", (), {"_client": client})()})()
    app.dependency_overrides[get_container] = lambda: container
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="mod@nexus.test", role="admin")

    class FrozenDT(datetime):
        @classmethod
        def now(cls, tz=None): return client.clock

    monkeypatch.setattr(social, "datetime", FrozenDT)
    yield TestClient(app), client
    app.dependency_overrides.clear()


def test_one_reaction_per_voter_can_change_and_remove(env):
    http, _ = env
    url = "/api/social/news/abc-123/react"
    http.post(url, json={"voterId": "voter-0001", "reaction": "fire"})
    http.post(url, json={"voterId": "voter-0002", "reaction": "fire"})
    res = http.post(url, json={"voterId": "voter-0001", "reaction": "goal"}).json()
    assert res["counts"]["fire"] == 1 and res["counts"]["goal"] == 1 and res["mine"] == "goal" and res["total"] == 2
    res = http.post(url, json={"voterId": "voter-0001", "reaction": None}).json()
    assert res["total"] == 1 and res["mine"] is None
    assert http.post(url, json={"voterId": "voter-0001", "reaction": "angry"}).status_code == 422


def test_comments_visible_cooldown_and_moderation(env):
    http, client = env
    url = "/api/social/capsule/c1/comments"
    ok = http.post(url, json={"voterId": "voter-0001", "author": "Dani", "body": "¡Qué partidazo!"})
    assert ok.status_code == 201 and ok.json()["status"] == "visible"
    assert http.post(url, json={"voterId": "voter-0001", "author": "Dani", "body": "otro"}).status_code == 429
    client.clock += timedelta(seconds=30)
    spam = http.post(url, json={"voterId": "voter-0001", "author": "Dani", "body": "mira www.apuestas-gratis.xyz"}).json()
    assert spam["status"] == "pending" and spam["message"]
    summary = http.get("/api/social/capsule/c1?voterId=voter-0001").json()
    assert [c["body"] for c in summary["comments"]] == ["¡Qué partidazo!"]

    pending = http.get("/api/admin/comments?status=pending").json()
    assert len(pending) == 1
    http.patch(f"/api/admin/comments/{pending[0]['id']}", json={"status": "visible"})
    assert http.get("/api/social/capsule/c1").json()["commentCount"] == 2


def test_moderation_rules():
    assert social.moderation_status("Ana", "Golazo de Díaz") == "visible"
    assert social.moderation_status("Ana", "eres un IDIOTA") == "pending"
    assert social.moderation_status("Ana", "entra a http://x.co") == "pending"


def test_rejects_unknown_targets(env):
    http, _ = env
    assert http.get("/api/social/users/1").status_code == 404
    assert http.get("/api/social/news/bad id!").status_code == 404
