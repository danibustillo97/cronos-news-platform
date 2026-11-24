"""DiscoveryRunnerPort backed by GitHub Actions (discovery-processing.yml).

The job is already persisted as QUEUED by TriggerDiscovery; this only asks
GitHub to run the worker now. If the dispatch isn't configured or fails,
the worker's cron still picks the job up -- so trigger never raises.

Stop is cooperative: RequestStopDiscoveryJob marks the job CANCELLING in
Supabase and the worker checks that status between sources.
"""
from __future__ import annotations

from app.infrastructure.serverless import dispatch_workflow

WORKFLOW_FILE = "discovery-processing.yml"


class GitHubActionsDiscoveryRunner:
    def trigger(self, job_id: str, params: dict) -> None:
        dispatch_workflow(WORKFLOW_FILE)

    def request_stop(self, job_id: str) -> None:
        return None
