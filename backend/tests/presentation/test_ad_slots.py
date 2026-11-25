import random
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.container import get_container
from app.domain.ads.slots import SLOTS, spec_sheet_rows
from app.presentation.api import ad_slots
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
    def insert(self, p): self.op, self.payload = "insert", p; return self
    def update(self, p): self.op, self.payload = "update", p; return self
    def upsert(self, p, on_conflict=None): self.op, self.payload = "upsert", p; return self
    def delete(self): self.op = "delete"; return self
    def eq(self, k, v): self.filters.append(lambda r: r.get(k) == v); return self

    def execute(self):
        rows = self.db.tables[self.table]
        match = [r for r in rows if all(f(r) for f in self.filters)]
        if self.op == "insert":
            self.db.seq += 1
            row = {"id": f"c{self.db.seq}", "active": True, "weight": 1, "impressions": 0, "clicks": 0, **self.payload}
            rows.append(row)
            return Result([row])
        if self.op == "upsert":
            existing = next((r for r in rows if r["placement"] == self.payload["placement"]), None)
            if existing: existing.update(self.payload)
            else: rows.append(dict(self.payload))
            return Result([self.payload])
        if self.op == "update":
            for r in match: r.update(self.payload)
            return Result(match)
        if self.op == "delete":
            self.db.tables[self.table] = [r for r in rows if r not in match]
            return Result(match)
        return Result(match)


class FakeClient:
    def __init__(self): self.tables, self.seq = {"ad_campaigns": [], "ad_slot_settings": []}, 0
    def table(self, name): return Query(self, name)


@pytest.fixture
def env():
    client = FakeClient()
    container = type("C", (), {"news_repo": type("N", (), {"_client": client})()})()
    app.dependency_overrides[get_container] = lambda: container
    app.dependency_overrides[get_authenticated_user] = lambda: AuthenticatedUser(id="u", email="ads@nexus.test", role="admin")
    yield TestClient(app), client
    app.dependency_overrides.clear()


def test_catalog_has_exact_sizes_and_sheet():
    assert {s.placement for s in SLOTS} >= {"home-top", "feed-1", "sidebar", "article-inline", "match-modal"}
    sidebar = next(s for s in SLOTS if s.placement == "sidebar")
    assert sidebar.mobile is None and sidebar.desktop == (300, 600)
    rows = spec_sheet_rows()
    assert {"espacio": "Portada · Superior", "dispositivo": "Móvil", "medida": "320×100 px"}.items() <= rows[0].items()


def test_campaign_flow_and_public_creative(env):
    http, _ = env
    bad = http.post("/api/admin/ads/campaigns", json={"placement": "sidebar", "advertiser": "Movistar", "href": "https://m.co", "imageMobile": "https://x/m.png"})
    assert bad.status_code == 422  # the sidebar has no mobile size
    assert http.post("/api/admin/ads/campaigns", json={"placement": "home-top", "advertiser": "M", "href": "http://m.co", "imageMobile": "x"}).status_code == 422
    ok = http.post("/api/admin/ads/campaigns", json={"placement": "home-top", "advertiser": "Movistar", "href": "https://movistar.co",
                                                    "imageMobile": "https://cdn/m.webp", "imageDesktop": "https://cdn/d.webp"})
    assert ok.status_code == 201
    slots = {s["placement"]: s for s in http.get("/api/ads/slots").json()["slots"]}
    assert slots["home-top"]["creative"]["imageMobile"] == "https://cdn/m.webp"
    assert slots["home-top"]["sizes"] == {"mobile": [320, 100], "tablet": [728, 90], "desktop": [970, 250]}
    assert slots["feed-1"]["creative"] is None

    http.put("/api/admin/ads/slots/home-top", json={"enabled": False})
    assert {s["placement"]: s for s in http.get("/api/ads/slots").json()["slots"]}["home-top"]["enabled"] is False

    http.patch(f"/api/admin/ads/campaigns/{ok.json()['id']}", json={"active": False})
    assert {s["placement"]: s for s in http.get("/api/ads/slots").json()["slots"]}["home-top"]["creative"] is None


def test_schedule_and_weights():
    now = datetime(2026, 11, 25, tzinfo=timezone.utc)
    future = {"id": "f", "active": True, "starts_at": (now + timedelta(days=1)).isoformat()}
    expired = {"id": "e", "active": True, "ends_at": (now - timedelta(days=1)).isoformat()}
    live = {"id": "l", "active": True, "weight": 5}
    assert ad_slots.pick_creative([future, expired], now, random.Random(1)) is None
    assert ad_slots.pick_creative([future, expired, live], now, random.Random(1))["id"] == "l"


def test_events_count(env):
    http, client = env
    cid = http.post("/api/admin/ads/campaigns", json={"placement": "feed-1", "advertiser": "A", "href": "https://a.co", "imageMobile": "https://x"}).json()["id"]
    http.post(f"/api/ads/campaigns/{cid}/event", json={"type": "impression"})
    http.post(f"/api/ads/campaigns/{cid}/event", json={"type": "click"})
    row = client.tables["ad_campaigns"][0]
    assert (row["impressions"], row["clicks"]) == (1, 1)
