from datetime import datetime, timezone

import pytest

from app.domain.discovery.entities import DiscoveryJob, DiscoveryJobStatus
from app.domain.shared.errors import InvalidStateTransition


def _job(status=DiscoveryJobStatus.QUEUED):
    return DiscoveryJob(id="job1", status=status, params={}, created_at=datetime.now(timezone.utc))


def test_start_sets_started_at():
    j = _job()
    assert j.started_at is None
    j.start()
    assert j.status == DiscoveryJobStatus.RUNNING
    assert j.started_at is not None


def test_start_twice_raises():
    j = _job(DiscoveryJobStatus.RUNNING)
    with pytest.raises(InvalidStateTransition):
        j.start()


def test_complete_sets_items_found_and_finished_at():
    j = _job(DiscoveryJobStatus.RUNNING)
    j.complete(items_found=3, finished_at=datetime.now(timezone.utc))
    assert j.status == DiscoveryJobStatus.COMPLETED
    assert j.items_found == 3
    assert j.finished_at is not None


def test_fail_records_real_error():
    j = _job(DiscoveryJobStatus.RUNNING)
    j.fail("scraper crashed", datetime.now(timezone.utc))
    assert j.status == DiscoveryJobStatus.FAILED
    assert j.error == "scraper crashed"


def test_request_cancel_from_running():
    j = _job(DiscoveryJobStatus.RUNNING)
    j.request_cancel()
    assert j.status == DiscoveryJobStatus.CANCELLING


def test_request_cancel_from_completed_raises():
    j = _job(DiscoveryJobStatus.COMPLETED)
    with pytest.raises(InvalidStateTransition):
        j.request_cancel()


def test_cancel_from_cancelling_sets_items_found_and_finished_at():
    j = _job(DiscoveryJobStatus.CANCELLING)
    j.cancel(items_found=4, finished_at=datetime.now(timezone.utc))
    assert j.status == DiscoveryJobStatus.CANCELLED
    assert j.items_found == 4
    assert j.finished_at is not None


def test_cancel_from_queued_raises():
    j = _job(DiscoveryJobStatus.QUEUED)
    with pytest.raises(InvalidStateTransition):
        j.cancel(items_found=0, finished_at=datetime.now(timezone.utc))
