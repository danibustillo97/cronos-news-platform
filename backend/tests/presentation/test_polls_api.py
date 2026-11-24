from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.presentation.auth import AuthenticatedUser, get_authenticated_user
from app.presentation.main import app


class Result:
    def __init__(self, data): self.data = data


class Query:
    def __init__(self, db, table):
        self.db, self.table, self.op, self.payload, self.filters = db, table, "select", None, []

    def select(self, *_a, **_k): return self
    def order(self, *_a, **_k): return self
    def limit(self, *_a, **_k): return self
    def insert(self, payload): self.op, self.payload = "insert", payload; return self
    def update(self, payload): self.op, self.payload = "update", payload; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, k, v): self.filters.append(lambda r: r.get(k) == v); return self
    def neq(self, k, v): self.filters.append(lambda r: r.get(k) != v); return self
    def in_(self, k, vs): self.filters.append(lambda r: r.get(k) in vs); return self
    def contains(self, k, vs): self.filters.append(lambda r: set(vs) <= set(r.get(k) or [])); return self

    def execute(self):
        rows = self.db.tables[self.table]
        match = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                self.db.seq += 1
                row = {"id": f"{self.table[:2]}{self.db.seq}", **self.db.defaults.get(self.table, {}), **item}
                rows.append(row)
                out.append(row)
            return Result(out)
        if self.op == "update":
            for r in match: r.update(self.payload)
            return Result(match)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in match]
            if self.table == "polls":  # on delete cascade
                ids = {r["id"] for r in match}
                self.db.tables["poll_options"] = [o for o in self.db.tables["poll_options"] if o["poll_id"] not in ids]
            return Result(match)
        if self.table == "polls":
            return Result([{**r, "poll_options": [o for o in self.db.tables["poll_options"] if o["poll_id"] == r["id"]]} for r in match])
        return Result(match)


class Rpc:
    def __init__(self, db, params): self.db, self.params = db, params

    def execute(self):  # mirrors public.cast_poll_vote
        if self.db.missing:
            raise Exception('{"code":"PGRST202","message":"Could not find the function public.cast_poll_vote"}')
        p = self.params
        poll = next((r for r in self.db.tables["polls"] if r["id"] == p["p_poll"]), None)
        if not poll:
            return Result("invalid")
        closes = poll.get("closes_at")
        if poll["status"] != "open" or (closes and datetime.fromisoformat(closes) <= datetime.now(timezone.utc)):
            return Result("closed")
        opt = next((o for o in self.db.tables["poll_options"] if o["id"] == p["p_option"] and o["poll_id"] == poll["id"]), None)
        if not opt:
            return Result("invalid")
        key = (poll["id"], p["p_voter"])
        if key in self.db.votes:
            return Result("duplicate")
        self.db.votes.add(key)
        opt["votes"] += 1
        return Result("ok")


class FakeClient:
    def __init__(self):
        self.tables = {"polls": [], "poll_options": []}
        self.defaults = {"polls": {"featured": False, "created_at": "2026-11-24T10:00:00+00:00"}, "poll_options": {"votes": 0}}
        self.votes, self.seq, self.missing = set(), 0, False

    def table(self, name):
        if self.missing:
            raise Exception("{'code': 'PGRST205', 'message': \"Could not find the table 'public.polls' in the schema cache\"}")
        return Query(self, name)

    def rpc(self, _name, params): return Rpc(self, params)


@pytest.fixture
def env():
    client = FakeClient()
    container = type("C", (), {"news_repo": type("N", (), {"_client": client})()})()
    app.dependency_overrides[get_container] = lambda: container
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="ed@nexus.test", role="admin")
    yield TestClient(app), client
    app.dependency_overrides.clear()


def _create(http, **over):
    body = {"question": "¿Quién gana la final?", "options": [{"label": "Estudiantes"}, {"label": "Palmeiras"}], **over}
    res = http.post("/api/admin/polls", json=body)
    assert res.status_code == 201, res.text
    return res.json()


def test_create_list_and_vote_once(env):
    http, _ = env
    poll = _create(http)
    assert [o["label"] for o in poll["options"]] == ["Estudiantes", "Palmeiras"]

    listed = http.get("/api/polls?placement=home").json()["polls"]
    assert [p["id"] for p in listed] == [poll["id"]]

    opt = poll["options"][1]["id"]
    first = http.post(f"/api/polls/{poll['id']}/vote", json={"optionId": opt, "voterId": "voter-0001"})
    assert first.status_code == 200
    assert first.json()["totalVotes"] == 1 and first.json()["options"][1]["votes"] == 1

    again = http.post(f"/api/polls/{poll['id']}/vote", json={"optionId": opt, "voterId": "voter-0001"})
    assert again.status_code == 409
    assert again.json()["poll"]["totalVotes"] == 1  # results come back so the UI can show them

    other = http.post(f"/api/polls/{poll['id']}/vote", json={"optionId": poll["options"][0]["id"], "voterId": "voter-0002"})
    assert other.json()["totalVotes"] == 2


def test_closed_and_expired_polls_reject_votes(env):
    http, _ = env
    past = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    poll = _create(http, closesAt=past)
    assert poll["status"] == "closed"
    res = http.post(f"/api/polls/{poll['id']}/vote", json={"optionId": poll["options"][0]["id"], "voterId": "voter-0001"})
    assert res.status_code == 409 and "cerrada" in res.json()["detail"]


def test_debate_needs_two_sides_with_arguments(env):
    http, _ = env
    bad = http.post("/api/admin/polls", json={"kind": "debate", "question": "¿James debe ser titular?",
                                               "options": [{"label": "Sí"}, {"label": "No", "argument": "Falta ritmo"}]})
    assert bad.status_code == 422 and "argumento" in bad.json()["detail"]
    three = http.post("/api/admin/polls", json={"kind": "debate", "question": "¿James debe ser titular?",
                                                 "options": [{"label": "A", "argument": "x"}, {"label": "B", "argument": "y"},
                                                             {"label": "C", "argument": "z"}]})
    assert three.status_code == 422
    ok = _create(http, kind="debate", options=[{"label": "Sí", "argument": "Es el cerebro"}, {"label": "No", "argument": "Falta ritmo"}])
    assert ok["kind"] == "debate" and ok["options"][0]["argument"] == "Es el cerebro"


def test_drafts_are_hidden_and_options_edit_keeps_votes(env):
    http, _ = env
    poll = _create(http)
    keep = poll["options"][0]
    http.post(f"/api/polls/{poll['id']}/vote", json={"optionId": keep["id"], "voterId": "voter-0001"})
    edited = http.patch(f"/api/admin/polls/{poll['id']}", json={
        "options": [{"id": keep["id"], "label": "Estudiantes LP"}, {"label": "Empate en 90'"}]}).json()
    assert [(o["label"], o["votes"]) for o in edited["options"]] == [("Estudiantes LP", 1), ("Empate en 90'", 0)]

    http.patch(f"/api/admin/polls/{poll['id']}", json={"status": "draft"})
    assert http.get(f"/api/polls/{poll['id']}").status_code == 404
    assert http.get("/api/polls?placement=home").json()["polls"] == []


def test_featured_is_exclusive_and_article_filter(env):
    http, _ = env
    a = _create(http, featured=True)
    b = _create(http, featured=True, newsId="news-42", placement=["article"])
    rows = {p["id"]: p for p in http.get("/api/admin/polls").json()}
    assert rows[b["id"]]["featured"] and not rows[a["id"]]["featured"]
    assert [p["id"] for p in http.get("/api/polls?newsId=news-42").json()["polls"]] == [b["id"]]


def test_missing_tables_return_503_with_hint(env):
    http, client = env
    client.missing = True
    res = http.get("/api/polls?placement=home")
    assert res.status_code == 503 and "20261124c_polls.sql" in res.json()["detail"]


def test_admin_routes_require_login():
    app.dependency_overrides.clear()
    assert TestClient(app).get("/api/admin/polls").status_code == 401
