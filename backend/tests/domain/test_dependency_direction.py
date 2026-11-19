"""Proves the hexagonal dependency direction is real, not cosmetic:
Domain must not import FastAPI, Supabase, httpx, requests, filesystem
modules used for I/O, or anything from app.infrastructure / app.presentation.
Application must not import app.infrastructure / app.presentation either —
only app.domain and concrete adapters injected via the container.
"""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]
DOMAIN_DIR = BACKEND_ROOT / "app" / "domain"
APPLICATION_DIR = BACKEND_ROOT / "app" / "application"

FORBIDDEN_IN_DOMAIN = {
    "fastapi", "supabase", "httpx", "requests", "sqlalchemy", "pathlib",
    "app.infrastructure", "app.presentation", "app.container",
}
FORBIDDEN_IN_APPLICATION = {
    "fastapi", "supabase", "httpx", "requests", "sqlalchemy",
    "app.infrastructure", "app.presentation", "app.container",
}


def _imported_modules(py_file: Path) -> set[str]:
    tree = ast.parse(py_file.read_text(encoding="utf-8"))
    modules: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.add(node.module)
    return modules


def _assert_no_forbidden_imports(directory: Path, forbidden: set[str]) -> list[str]:
    violations: list[str] = []
    for py_file in directory.rglob("*.py"):
        for module in _imported_modules(py_file):
            if any(module == f or module.startswith(f + ".") for f in forbidden):
                violations.append(f"{py_file.relative_to(BACKEND_ROOT)} imports forbidden module '{module}'")
    return violations


def test_domain_has_no_infrastructure_or_framework_imports():
    violations = _assert_no_forbidden_imports(DOMAIN_DIR, FORBIDDEN_IN_DOMAIN)
    assert violations == [], "Domain purity violated:\n" + "\n".join(violations)


def test_application_has_no_infrastructure_or_framework_imports():
    violations = _assert_no_forbidden_imports(APPLICATION_DIR, FORBIDDEN_IN_APPLICATION)
    assert violations == [], "Application purity violated:\n" + "\n".join(violations)
