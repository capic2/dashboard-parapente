import asyncio
from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError

import config
from intervals_sync import (
    _acquire_shared_lock,
    _release_shared_lock,
    _renew_shared_lock,
    intervals_status,
    register_intervals_sync,
    scheduled_intervals_sync,
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


def test_scheduler_registers_only_when_fully_ready(monkeypatch):
    scheduler = MagicMock()
    monkeypatch.setattr(config, "INTERVALS_ICU_SYNC_ENABLED", True)
    monkeypatch.setattr(config, "INTERVALS_ICU_API_KEY", "key")
    monkeypatch.setattr(config, "INTERVALS_ICU_ACTIVITY_TYPES", [])

    assert register_intervals_sync(scheduler) is False
    assert intervals_status()["awaiting_activity_type"] is True
    assert intervals_status()["automatic_sync_ready"] is False
    scheduler.add_job.assert_not_called()

    monkeypatch.setattr(config, "INTERVALS_ICU_ACTIVITY_TYPES", ["HangGliding"])
    assert register_intervals_sync(scheduler) is True
    kwargs = scheduler.add_job.call_args.kwargs
    assert kwargs["max_instances"] == 1
    assert kwargs["coalesce"] is True


@pytest.mark.asyncio
async def test_scheduled_sync_fails_closed_when_shared_lock_is_unavailable():
    with (
        patch("intervals_sync._acquire_shared_lock", new=AsyncMock(return_value=(None, ""))),
        patch("intervals_sync.SessionLocal") as session_local,
    ):
        await scheduled_intervals_sync()
    session_local.assert_not_called()


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
