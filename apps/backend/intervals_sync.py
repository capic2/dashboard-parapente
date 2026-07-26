import asyncio
import logging
import uuid
from datetime import date, timedelta
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

import config
from cache import get_redis
from database import SessionLocal
from external_flight_import import import_external_activities
from intervals_icu import IntervalsClient

logger = logging.getLogger(__name__)
_LOCK_KEY = "dashboard-parapente:intervals-sync"
_RENEW_LOCK_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('expire', KEYS[1], ARGV[2])
end
return 0
"""
_RELEASE_LOCK_SCRIPT = """
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
"""


def _lock_lease_seconds() -> int:
    return max(3600, config.INTERVALS_ICU_SYNC_INTERVAL_MINUTES * 60 * 6)


def intervals_status() -> dict[str, Any]:
    configured = bool(config.INTERVALS_ICU_API_KEY)
    enabled = config.INTERVALS_ICU_SYNC_ENABLED
    activity_types = list(config.INTERVALS_ICU_ACTIVITY_TYPES)
    return {
        "configured": configured,
        "enabled": enabled,
        "automatic_sync_ready": configured and enabled and bool(activity_types),
        "awaiting_activity_type": configured and not activity_types,
        "interval_minutes": config.INTERVALS_ICU_SYNC_INTERVAL_MINUTES,
        "lookback_days": config.INTERVALS_ICU_SYNC_LOOKBACK_DAYS,
        "activity_types": activity_types,
    }


async def _acquire_shared_lock() -> tuple[Any | None, str | None]:
    if config.ENVIRONMENT != "production" and config.USE_FAKE_REDIS:
        return None, None
    token = str(uuid.uuid4())
    try:
        redis = await get_redis()
        acquired = await redis.set(
            _LOCK_KEY,
            token,
            ex=_lock_lease_seconds(),
            nx=True,
        )
        return (redis, token) if acquired else (redis, "")
    except Exception:
        logger.warning("Intervals sync skipped because the distributed lock is unavailable")
        return None, ""


async def _release_shared_lock(redis: Any | None, token: str | None) -> None:
    if redis is None or not token:
        return
    try:
        await redis.eval(_RELEASE_LOCK_SCRIPT, 1, _LOCK_KEY, token)
    except Exception:
        logger.warning("Could not release the Intervals sync lock", exc_info=True)


async def _renew_shared_lock(
    redis: Any, token: str, stop: asyncio.Event, lock_lost: asyncio.Event
) -> None:
    interval = _lock_lease_seconds() / 3
    while not stop.is_set():
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except TimeoutError:
            try:
                renewed = await redis.eval(
                    _RENEW_LOCK_SCRIPT,
                    1,
                    _LOCK_KEY,
                    token,
                    _lock_lease_seconds(),
                )
                if not renewed:
                    logger.warning("Intervals sync lost its distributed lock")
                    lock_lost.set()
                    return
            except Exception:
                logger.warning("Could not renew the Intervals sync lock", exc_info=True)
                lock_lost.set()
                return


async def scheduled_intervals_sync() -> None:
    redis, token = await _acquire_shared_lock()
    if token == "":
        return
    stop_renewal = asyncio.Event()
    lock_lost = asyncio.Event()
    renewal_task = (
        asyncio.create_task(_renew_shared_lock(redis, token, stop_renewal, lock_lost))
        if redis is not None and token
        else None
    )
    today = date.today()
    client = IntervalsClient(config.INTERVALS_ICU_API_KEY, config.INTERVALS_ICU_BASE_URL)
    db = SessionLocal()
    try:
        activities = await client.list_activities(
            today - timedelta(days=config.INTERVALS_ICU_SYNC_LOOKBACK_DAYS),
            today,
            config.INTERVALS_ICU_ACTIVITY_TYPES,
        )
        await import_external_activities(
            db,
            "intervals_icu",
            client,
            activities,
            should_stop=lock_lost.is_set,
        )
    except Exception:
        db.rollback()
        logger.exception("Scheduled Intervals sync failed")
    finally:
        db.close()
        stop_renewal.set()
        if renewal_task is not None:
            await renewal_task
        await _release_shared_lock(redis, token)


def register_intervals_sync(scheduler: AsyncIOScheduler) -> bool:
    if not intervals_status()["automatic_sync_ready"]:
        return False
    scheduler.add_job(
        scheduled_intervals_sync,
        trigger=IntervalTrigger(minutes=config.INTERVALS_ICU_SYNC_INTERVAL_MINUTES),
        id="intervals_icu_sync",
        name="Intervals.icu activity polling",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    return True
