"""Vercel entrypoint for the FastAPI backend.

Vercel's Python runtime detects the ASGI `app` exported here. The real
application lives in app/presentation/main.py; this file only re-exports it
so local dev (`uvicorn app.presentation.main:app`) keeps working unchanged.
See docs/DEPLOYMENT_BACKEND_VERCEL.md.
"""
from app.presentation.main import app

__all__ = ["app"]
