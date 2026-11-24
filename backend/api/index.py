"""Vercel entry point: the FastAPI app as one Python serverless function.

Deploy this directory as a separate Vercel project with Root Directory = backend/.
See docs/DEPLOYMENT_BACKEND_VERCEL.md. The backend/vercel.json config routes
requests to this ASGI application; the frontend proxies /api/* to its deployment.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.presentation.main import app  # noqa: E402,F401  (Vercel serves the ASGI app)
