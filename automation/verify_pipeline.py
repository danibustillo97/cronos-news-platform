"""Verificador del pipeline de noticias -- SOLO LECTURA, nunca escribe.

Comprueba, de punta a punta, que las noticias pueden fluir:
  Supabase (esquema, seguridad, datos) -> scraper -> backend -> frontend.

Uso:
  python automation/verify_pipeline.py                         # solo Supabase
  python automation/verify_pipeline.py \
      --backend https://cronos-backend.vercel.app \
      --frontend https://nexusnews.info                        # después del deploy

Variables: SUPABASE_URL + SUPABASE_SECRET_KEY (o SUPABASE_PUBLISHABLE_KEY).
Opcional: SUPABASE_PUBLISHABLE_KEY para revisar qué ve un visitante anónimo,
SCRAPER_SOURCES para probar los feeds.

Salida: una línea por chequeo (OK / AVISO / FALLA). Código 1 si hay FALLAS.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
sys.path.insert(0, str(ROOT / "automation"))

OK, WARN, FAIL = "OK", "AVISO", "FALLA"
REQUIRED_COLUMNS = [
    ("discovery_items", "assigned_to"), ("artifacts", "scheduled_at"),
    ("artifacts", "publishing_started_at"), ("news", "artifact_id"),
]
PRIVATE_TABLES = ["artifacts", "artifact_jobs", "discovery_items", "discovery_jobs", "editorial_automation"]


class Report:
    def __init__(self) -> None:
        self.rows: list[tuple[str, str, str, str]] = []

    def add(self, area: str, level: str, check: str, detail: str = "") -> None:
        self.rows.append((area, level, check, detail))
        icon = {OK: "✅", WARN: "⚠️ ", FAIL: "❌"}[level]
        print(f"{icon} [{area}] {check}" + (f" — {detail}" if detail else ""), flush=True)

    @property
    def failed(self) -> bool:
        return any(level == FAIL for _, level, _, _ in self.rows)


def _rest(base: str, key: str):
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}

    def get(table: str, **params):
        return httpx.get(f"{base}/rest/v1/{table}", params=params, headers=headers, timeout=20)
    return get


def check_supabase(report: Report) -> None:
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")
    if not url or not key:
        report.add("Supabase", FAIL, "Credenciales", "faltan SUPABASE_URL y una key")
        return
    privileged = bool(os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    get = _rest(url, key)

    try:
        r = get("categories", select="id", limit="1")
    except httpx.HTTPError as exc:
        report.add("Supabase", FAIL, "Conexión", f"{type(exc).__name__}")
        return
    report.add("Supabase", OK if r.status_code == 200 else FAIL, "Conexión", f"HTTP {r.status_code}")
    if not privileged:
        report.add("Supabase", WARN, "Modo de verificación", "sin service_role: el esquema se revisa con la anon key")

    # 1. Esquema
    missing = []
    for table, column in REQUIRED_COLUMNS:
        r = get(table, select=column, limit="0")
        if r.status_code == 400 and "42703" in r.text:
            missing.append(f"{table}.{column}")
    if missing:
        report.add("Esquema", FAIL, "Columnas que el backend necesita",
                   "faltan " + ", ".join(missing) + " → ejecutar migrations/20261123_editorial_pipeline.sql")
    else:
        report.add("Esquema", OK, "Columnas que el backend necesita")
    r = get("editorial_automation", select="enabled", id="eq.global")
    if r.status_code == 404 or (r.status_code >= 400 and "does not exist" in r.text):
        report.add("Esquema", FAIL, "Tabla del modo automático", "no existe → ejecutar la migración")
    elif r.status_code == 200 and r.json():
        mode = "AUTOMÁTICO (IA)" if r.json()[0]["enabled"] else "MANUAL"
        report.add("Esquema", OK, "Tabla del modo automático", f"modo actual: {mode}")
    elif r.status_code == 200:
        report.add("Esquema", WARN, "Tabla del modo automático", "sin fila 'global' (se asume MANUAL)")
    else:
        report.add("Esquema", WARN if not privileged else FAIL, "Tabla del modo automático", f"HTTP {r.status_code}")

    # 2. Datos: ¿está entrando y saliendo contenido?
    now = datetime.now(timezone.utc)
    r = get("discovery_items", select="discovered_at", order="discovered_at.desc", limit="1")
    if r.status_code == 200 and r.json():
        last = datetime.fromisoformat(r.json()[0]["discovered_at"])
        age = now - last
        level = OK if age < timedelta(hours=2) else WARN
        report.add("Scraper", level, "Última noticia descubierta",
                   f"hace {age.days} d {age.seconds // 3600} h" + ("" if level == OK else " → revisar scraper.yml / secrets"))
    else:
        report.add("Scraper", WARN, "Última noticia descubierta", "sin datos visibles")

    since = (now - timedelta(days=7)).isoformat()
    r = get("artifact_jobs", select="status", created_at=f"gte.{since}")
    if r.status_code == 200:
        statuses = [row["status"] for row in r.json()]
        failed = statuses.count("FAILED")
        stuck = statuses.count("RUNNING")
        detail = f"{len(statuses)} en 7 días, {failed} fallidos, {stuck} en curso"
        report.add("IA", WARN if failed > len(statuses) / 2 and statuses else OK, "Jobs de redacción", detail)

    r = get("news", select="id,published_at", status="eq.published", order="published_at.desc", limit="1")
    if r.status_code == 200:
        report.add("Sitio", OK if r.json() else WARN, "Noticias publicadas",
                   "hay al menos una" if r.json() else "ninguna noticia en estado 'published'")

    # 3. Seguridad: lo que ve un visitante anónimo
    anon = os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or (None if privileged else key)
    if anon:
        anon_get = _rest(url, anon)
        exposed = [t for t in PRIVATE_TABLES
                   if (resp := anon_get(t, select="*", limit="1")).status_code == 200 and resp.json()]
        if exposed:
            report.add("Seguridad", WARN, "Tablas privadas legibles por visitantes",
                       ", ".join(exposed) + " → aplicar migrations/20261119_security_rls_storage.sql")
        else:
            report.add("Seguridad", OK, "Tablas privadas protegidas")
        resp = anon_get("news", select="status", status="neq.published", limit="1")
        if resp.status_code == 200 and resp.json():
            report.add("Seguridad", WARN, "Borradores de 'news' visibles para visitantes")


def check_scraper(report: Report) -> None:
    from scraper import ScraperSettings, parse_feed, parse_sources

    sources = parse_sources(os.getenv("SCRAPER_SOURCES", ""))
    if not sources:
        report.add("Scraper", WARN, "Fuentes (SCRAPER_SOURCES)", "no configuradas aquí; se omite la prueba de feeds")
        return
    settings = ScraperSettings.from_env()
    cutoff = datetime.now(timezone.utc) - timedelta(hours=settings.max_age_hours or 24 * 365)
    with httpx.Client(timeout=settings.timeout, follow_redirects=True,
                      headers={"User-Agent": "CronosNewsDiscovery/2.0 verify"}) as client:
        for source in sources:
            try:
                r = client.get(source.url)
                records = parse_feed(r.content, str(r.url)) if r.status_code == 200 else []
            except Exception as exc:  # noqa: BLE001
                report.add("Feeds", FAIL, source.host, f"{type(exc).__name__}")
                continue
            fresh = sum(1 for rec in records if rec.published and rec.published >= cutoff)
            if not records:
                report.add("Feeds", FAIL, source.host, f"HTTP {r.status_code}, 0 notas")
            elif fresh == 0:
                report.add("Feeds", WARN, source.host, f"{len(records)} notas, ninguna reciente → feed abandonado?")
            else:
                report.add("Feeds", OK, source.host, f"{len(records)} notas, {fresh} recientes")


def check_backend(report: Report, base: str) -> None:
    base = base.rstrip("/")
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        try:
            r = client.get(f"{base}/health")
            report.add("Backend", OK if r.status_code == 200 else FAIL, "/health", f"HTTP {r.status_code}")
        except httpx.HTTPError as exc:
            report.add("Backend", FAIL, "/health", type(exc).__name__)
            return
        r = client.get(f"{base}/diagnostics/env")
        if r.status_code == 200:
            env = r.json()
            missing = [k for k in ("SUPABASE_URL", "SUPABASE_SECRET_KEY") if env.get(k) != "configured"]
            report.add("Backend", FAIL if missing else OK, "Variables de entorno",
                       ("faltan " + ", ".join(missing)) if missing else "Supabase con service_role")
        for path in ("/api/categories", "/api/settings/seo", "/api/published-content?limit=1"):
            r = client.get(f"{base}{path}")
            report.add("Backend", OK if r.status_code == 200 else FAIL, f"GET {path}", f"HTTP {r.status_code}")
        r = client.get(f"{base}/api/artifacts")
        report.add("Backend", OK if r.status_code == 401 else FAIL, "Rutas de admin exigen login",
                   f"HTTP {r.status_code} sin token")


def check_frontend(report: Report, base: str) -> None:
    base = base.rstrip("/")
    with httpx.Client(timeout=30, follow_redirects=True) as client:
        for path, expect in (("/", "html"), ("/api/categories", "json"), ("/news-sitemap.xml", "xml"),
                             ("/admin/login", "html")):
            try:
                r = client.get(f"{base}{path}")
            except httpx.HTTPError as exc:
                report.add("Frontend", FAIL, f"GET {path}", type(exc).__name__)
                continue
            ok = r.status_code == 200 and expect in r.headers.get("content-type", "")
            detail = f"HTTP {r.status_code}"
            if path == "/api/categories" and r.status_code == 503:
                detail += " → falta BACKEND_PUBLIC_URL en Vercel (frontend)"
            report.add("Frontend", OK if ok else FAIL, f"GET {path}", detail)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backend", help="URL pública del backend (Vercel)")
    parser.add_argument("--frontend", help="URL pública del sitio")
    parser.add_argument("--json", action="store_true", help="imprime también el resultado en JSON")
    args = parser.parse_args()

    report = Report()
    check_supabase(report)
    check_scraper(report)
    if args.backend:
        check_backend(report, args.backend)
    if args.frontend:
        check_frontend(report, args.frontend)

    fails = sum(1 for r in report.rows if r[1] == FAIL)
    warns = sum(1 for r in report.rows if r[1] == WARN)
    print(f"\nResultado: {len(report.rows) - fails - warns} OK · {warns} avisos · {fails} fallas")
    if args.json:
        print(json.dumps([dict(zip(("area", "level", "check", "detail"), r)) for r in report.rows], ensure_ascii=False))
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
