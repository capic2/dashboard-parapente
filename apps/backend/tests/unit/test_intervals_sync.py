import asyncio
from datetime import date
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

import config
from intervals_sync import (
    _acquire_shared_lock,
    _release_shared_lock,
    _renew_shared_lock,
    intervals_status,
)
from schemas import IntervalsSyncRequest


def test_intervals_sync_request_rejects_reversed_range():
    with pytest.raises(ValidationError, match="date_from must be on or before date_to"):
        IntervalsSyncRequest(date_from=date(2026, 7, 2), date_to=date(2026, 7, 1))


def test_intervals_sync_request_accepts_equal_dates():
    request = IntervalsSyncRequest(date_from=date(2026, 7, 1), date_to=date(2026, 7, 1))

    assert request.date_from == request.date_to


def test_intervals_sync_request_accepts_ordered_range():
    request = IntervalsSyncRequest(date_from=date(2026, 7, 1), date_to=date(2026, 7, 2))

    assert request.date_from < request.date_to


def test_intervals_status_reports_configuration_and_types(monkeypatch):
    monkeypatch.setattr(config, "INTERVALS_ICU_API_KEY", "key")
    monkeypatch.setattr(config, "INTERVALS_ICU_ACTIVITY_TYPES", ["HangGliding"])

    status = intervals_status()

    assert status == {"configured": True, "activity_types": ["HangGliding"]}

@pytest.mark.asyncio
async def test_shared_lock_uses_long_lease_and_atomic_release(monkeypatch):
    redis = AsyncMock()
    redis.set.return_value = True
    monkeypatch.setattr(config, "ENVIRONMENT", "production")
    monkeypatch.setattr(config, "USE_FAKE_REDIS", False)

    with patch("intervals_sync.get_redis", new=AsyncMock(return_value=redis)):
        acquired_redis, token = await _acquire_shared_lock()

    assert acquired_redis is redis
    assert token
    assert redis.set.await_args.kwargs["ex"] >= 3600

    await _release_shared_lock(redis, token)

    redis.eval.assert_awaited_once()
    assert "redis.call('del'" in redis.eval.await_args.args[0]


@pytest.mark.asyncio
async def test_lock_renewal_reports_lost_ownership(monkeypatch):
    redis = AsyncMock()
    redis.eval.return_value = 0
    stop = asyncio.Event()
    lock_lost = asyncio.Event()
    monkeypatch.setattr("intervals_sync._lock_lease_seconds", lambda: 0)

    await _renew_shared_lock(redis, "token", stop, lock_lost)

    assert lock_lost.is_set()
