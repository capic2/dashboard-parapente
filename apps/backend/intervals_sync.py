import asyncio
import logging
import uuid
from typing import Any

import config
from cache import get_redis

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
    return 3600


def intervals_status() -> dict[str, Any]:
    configured = bool(config.INTERVALS_ICU_API_KEY)
    activity_types = list(config.INTERVALS_ICU_ACTIVITY_TYPES)
    return {
        "configured": configured,
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
