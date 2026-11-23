"""Vercel entry point: the FastAPI app as one Python serverless function.

Deployed as its own Vercel project with Root Directory = backend/ (see
docs/DEPLOYMENT_VERCEL.md). vercel.json rewrites every path here, and the frontend's
/api/[...path] route proxies to this project's URL (BACKEND_PUBLIC_URL).
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.presentation.main import app  # noqa: E402,F401  (Vercel serves the ASGI `app`)
