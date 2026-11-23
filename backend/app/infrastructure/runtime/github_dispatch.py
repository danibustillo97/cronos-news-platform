"""Serverless job execution: Vercel + GitHub Actions + Supabase, no long-running server.

On Vercel a request cannot keep running work after it answers, and there is no local
Automation runtime to call. With JOB_EXECUTION=github the API only enqueues jobs in
Supabase and wakes the matching GitHub Actions workflow through `workflow_dispatch`, so
work starts within seconds; each workflow's cron schedule stays as the safety net when a
dispatch is not configured or fails (jobs stay QUEUED until a worker picks them up).

Environment:
  JOB_EXECUTION           inline (default, local dev: run in-process) | github
  GITHUB_DISPATCH_TOKEN   fine-grained token with "Actions: read and write" on the repo
  GITHUB_REPOSITORY       owner/repo (set automatically inside GitHub Actions)
  GITHUB_DISPATCH_REF     branch whose workflows run (default: master)
"""
from __future__ import annotations

import logging
import os

import httpx

logger = logging.getLogger("cronos.jobs")

ARTIFACT_WORKFLOW = "artifact-processing.yml"
DISCOVERY_WORKFLOW = "discovery-processing.yml"
MEDIA_WORKFLOW = "media-processing.yml"

_API = "https://api.github.com"
_TIMEOUT_SECONDS = 10.0


def github_job_execution() -> bool:
    return os.getenv("JOB_EXECUTION", "inline").strip().lower() == "github"


class GitHubWorkflowDispatcher:
    def __init__(self, token: str | None = None, repository: str | None = None, ref: str | None = None, http=httpx) -> None:
        self._token = token if token is not None else os.getenv("GITHUB_DISPATCH_TOKEN", "")
        self._repository = repository if repository is not None else os.getenv("GITHUB_REPOSITORY", "")
        self._ref = ref or os.getenv("GITHUB_DISPATCH_REF", "master")
        self._http = http

    @property
    def configured(self) -> bool:
        return bool(self._token and self._repository)

    def dispatch(self, workflow_file: str) -> bool:
        """Wakes a worker workflow. Never raises: a failed wake-up only delays the job until
        the workflow's next scheduled run, it never loses it."""
        if not self.configured:
            logger.info("GitHub dispatch not configured; %s will run on its schedule", workflow_file)
            return False
        try:
            response = self._http.post(
                f"{_API}/repos/{self._repository}/actions/workflows/{workflow_file}/dispatches",
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Accept": "application/vnd.github+json",
                    "X-GitHub-Api-Version": "2022-11-28",
                },
                json={"ref": self._ref},
                timeout=_TIMEOUT_SECONDS,
            )
        except httpx.HTTPError as exc:
            logger.warning("GitHub dispatch of %s failed: %s", workflow_file, exc)
            return False
        if response.status_code != 204:
            logger.warning("GitHub dispatch of %s answered %s: %s", workflow_file, response.status_code, response.text[:300])
            return False
        return True


class GitHubDiscoveryRunner:
    """DiscoveryRunnerPort for serverless deployments: the scrape runs in the
    discovery-processing workflow (automation/run_discovery_jobs.py), which reads QUEUED jobs
    from Supabase. A stop request is honoured cooperatively: the worker re-reads the job
    between sources and stops once it sees CANCELLING."""

    def __init__(self, dispatcher: GitHubWorkflowDispatcher) -> None:
        self._dispatcher = dispatcher

    def trigger(self, job_id: str, params: dict) -> None:
        self._dispatcher.dispatch(DISCOVERY_WORKFLOW)

    def request_stop(self, job_id: str) -> None:
        return None
