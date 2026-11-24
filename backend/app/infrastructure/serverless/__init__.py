"""Serverless (Vercel) execution environment.

On Vercel the FastAPI app runs as a serverless function: the filesystem is
read-only (except /tmp, which is ephemeral) and the instance can be frozen
as soon as the response is sent, so FastAPI BackgroundTasks are not a
reliable place for 10-60s LLM/media work.

Long-running work therefore stays QUEUED in Supabase and is executed by the
GitHub Actions workers (automation/run_*_jobs.py), which already poll on a
cron. `dispatch_workflow` asks GitHub to run that worker *now* so the user
does not wait for the next cron tick; if it is not configured or fails, the
cron still picks the job up -- nothing is lost.
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("cronos.serverless")

_GITHUB_API = "https://api.github.com"


def is_serverless() -> bool:
    """True when running on Vercel (it sets VERCEL=1), or when forced with
    CRONOS_SERVERLESS=1 to reproduce the production behaviour locally."""
    return os.getenv("VERCEL") == "1" or os.getenv("CRONOS_SERVERLESS") == "1"


class ReadOnlyEnvironmentError(Exception):
    """An operation needs a writable local disk, which serverless lacks."""

    def __init__(self, operation: str, hint: str) -> None:
        super().__init__(f"{operation} is not available in the serverless deployment. {hint}")
        self.operation = operation
        self.hint = hint


def dispatch_workflow(workflow_file: str) -> bool:
    """Best-effort `workflow_dispatch` of a GitHub Actions worker.

    Needs GITHUB_DISPATCH_TOKEN (fine-grained PAT, this repo only,
    "Actions: Read and write") and GITHUB_REPOSITORY ("owner/repo").
    Returns True only when GitHub accepted the dispatch. Never raises.
    """
    token = os.getenv("GITHUB_DISPATCH_TOKEN")
    repository = os.getenv("GITHUB_REPOSITORY")
    if not token or not repository:
        logger.info("workflow_dispatch skipped for %s: GitHub dispatch not configured", workflow_file)
        return False

    ref = os.getenv("GITHUB_DISPATCH_REF", "master")
    url = f"{_GITHUB_API}/repos/{repository}/actions/workflows/{workflow_file}/dispatches"
    try:
        response = httpx.post(
            url,
            json={"ref": ref},
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        logger.warning("workflow_dispatch failed for %s: %r", workflow_file, exc)
        return False

    if response.status_code != 204:
        logger.warning("workflow_dispatch rejected for %s: %s %s", workflow_file, response.status_code, response.text[:200])
        return False
    return True
