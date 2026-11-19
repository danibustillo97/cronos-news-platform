from datetime import datetime, timezone

import pytest

from app.domain.asset.entities import MediaGenerationJob, MediaGenerationJobStatus
from app.domain.shared.errors import InvalidStateTransition
from app.domain.shared.ids import ArtifactId


def _job(status=MediaGenerationJobStatus.QUEUED):
    j = MediaGenerationJob(
        id="j1", artifact_id=ArtifactId.new(), placeholder_id="FEATURE_IMAGE", status=status,
        created_at=datetime.now(timezone.utc),
    )
    j.status = status
    return j


def test_start_from_queued():
    j = _job()
    j.start()
    assert j.status == MediaGenerationJobStatus.RUNNING
    assert j.started_at is not None


def test_start_twice_raises():
    j = _job(MediaGenerationJobStatus.RUNNING)
    with pytest.raises(InvalidStateTransition):
        j.start()


def test_complete_sets_asset_id():
    j = _job(MediaGenerationJobStatus.RUNNING)
    j.complete(asset_id="asset-1", finished_at=datetime.now(timezone.utc))
    assert j.status == MediaGenerationJobStatus.COMPLETED
    assert j.asset_id == "asset-1"


def test_complete_requires_running():
    j = _job(MediaGenerationJobStatus.QUEUED)
    with pytest.raises(InvalidStateTransition):
        j.complete(asset_id="asset-1", finished_at=datetime.now(timezone.utc))


def test_fail_records_real_error():
    j = _job(MediaGenerationJobStatus.RUNNING)
    j.fail("Provider unavailable", datetime.now(timezone.utc))
    assert j.status == MediaGenerationJobStatus.FAILED
    assert j.error == "Provider unavailable"
