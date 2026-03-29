"""
Redis cache manager for weather data caching.
"""

import hashlib
import json
import logging
import os
from datetime import datetime
from functools import wraps
from typing import TYPE_CHECKING, Any

# Conditional import to avoid requiring redis in development
if TYPE_CHECKING:
    import redis.asyncio as redis
else:
    redis = None  # Will be imported dynamically when needed

logger = logging.getLogger(__name__)

# Cache TTL configuration (in seconds)
# Aligned with scheduler: 60min TTL matches hourly polling (no cache gaps)
CACHE_TTL: dict[str, int] = {
    "open-meteo": 3600,  # 60 minutes (refreshed hourly by scheduler)
    "weatherapi": 3600,  # 60 minutes (refreshed hourly by scheduler)
    "meteo-parapente": 3600,  # 60 minutes (refreshed hourly by scheduler)
    "meteociel": 3600,  # 60 minutes (refreshed hourly by scheduler)
    "meteoblue": 3600,  # 60 minutes (refreshed hourly by scheduler)
    "forecast": 3600,  # 60 minutes (combined forecast, aligned with scheduler)
    "summary": 3600,  # 60 minutes (site summary)
}

# Redis connection pool (singleton)
_redis_pool: Any | None = None


async def get_redis() -> Any:
    """
    Get or create Redis connection pool.

    In development/test mode, uses fakeredis (in-memory mock) by default.
    Set USE_FAKE_REDIS=false to use a real Redis server even in dev mode.

    Returns:
        Redis client instance
    """
    global _redis_pool

    if _redis_pool is None:
        from config import REDIS_HOST, REDIS_PORT, USE_FAKE_REDIS

        environment = os.getenv("ENVIRONMENT", "production")

        # Use fakeredis in development/test mode (unless explicitly disabled)
        if environment in ["development", "test"] and USE_FAKE_REDIS:
            try:
                from fakeredis import FakeAsyncRedis

                _redis_pool = FakeAsyncRedis(decode_responses=True)
                logger.info("✅ Using FakeRedis (in-memory mock) for development")
                return _redis_pool  # Skip ping test for FakeRedis
            except ImportError:
                logger.warning(
                    "fakeredis not installed, falling back to real Redis. Install with: pip install fakeredis"
                )

        # Use real Redis in production or if fakeredis is disabled/unavailable
        if not USE_FAKE_REDIS or environment not in ["development", "test"]:
            # Import redis only when needed
            import redis.asyncio as redis_module

            # Debug: show what we're trying to connect to
            logger.info(f"Environment: {environment}")
            logger.info(f"USE_FAKE_REDIS: {USE_FAKE_REDIS}")
            logger.info(f"REDIS_HOST: {REDIS_HOST}")
            logger.info(f"REDIS_PORT: {REDIS_PORT}")
            logger.info(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT}")

            _redis_pool = redis_module.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=0,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )

            # Test connection for real Redis only with retries
            max_retries = 3
            retry_delay = 2  # seconds

            for attempt in range(max_retries):
                try:
                    await _redis_pool.ping()
                    logger.info(
                        f"✅ Redis connection established successfully at {REDIS_HOST}:{REDIS_PORT}"
                    )
                    break
                except Exception as e:
                    if attempt < max_retries - 1:
                        logger.warning(
                            f"Redis connection attempt {attempt + 1}/{max_retries} failed: {e}"
                        )
                        logger.info(f"Retrying in {retry_delay} seconds...")
                        import asyncio

                        await asyncio.sleep(retry_delay)
                    else:
                        logger.error(
                            f"Failed to connect to Redis after {max_retries} attempts: {e}"
                        )
                        _redis_pool = None
                        raise

    return _redis_pool


async def close_redis():
    """Close Redis connection pool."""
    global _redis_pool
    if _redis_pool:
        await _redis_pool.close()
        _redis_pool = None
        logger.info("Redis connection closed")


def generate_cache_key(prefix: str, **params) -> str:
    """
    Generate a unique cache key from parameters.

    Args:
        prefix: Cache key prefix (e.g., "forecast", "source:meteoblue")
        **params: Key-value parameters to hash

    Returns:
        Unique cache key string
    """
    # Sort params for consistent hashing
    sorted_params = sorted(params.items())
    params_str = json.dumps(sorted_params, sort_keys=True)
    params_hash = hashlib.md5(params_str.encode()).hexdigest()[:8]

    return f"weather:{prefix}:{params_hash}"


async def get_cached(key: str) -> Any | None:
    """
    Get cached data by key.

    Args:
        key: Cache key

    Returns:
        Cached data (parsed from JSON) or None if not found
    """
    try:
        redis_client = await get_redis()
        cached = await redis_client.get(key)

        if cached:
            logger.debug(f"Cache HIT: {key}")
            return json.loads(cached)
        else:
            logger.debug(f"Cache MISS: {key}")
            return None

    except Exception as e:
        logger.warning(f"Cache get error for {key}: {e}")
        return None


async def set_cached(key: str, data: Any, ttl: int):
    """
    Set cached data with TTL.

    Args:
        key: Cache key
        data: Data to cache (will be JSON serialized)
        ttl: Time-to-live in seconds
    """
    try:
        if isinstance(data, dict):
            data["cached_at"] = datetime.now(datetime.UTC).isoformat()
        redis_client = await get_redis()
        serialized = json.dumps(data)
        await redis_client.setex(key, ttl, serialized)
        logger.debug(f"Cache SET: {key} (TTL: {ttl}s)")

    except Exception as e:
        logger.warning(f"Cache set error for {key}: {e}")


async def delete_cached(pattern: str):
    """
    Delete cached data matching pattern.

    Args:
        pattern: Redis key pattern (e.g., "weather:forecast:*")
    """
    try:
        redis_client = await get_redis()
        keys = []
        async for key in redis_client.scan_iter(match=pattern):
            keys.append(key)

        if keys:
            await redis_client.delete(*keys)
            logger.info(f"Deleted {len(keys)} cache keys matching: {pattern}")

    except Exception as e:
        logger.warning(f"Cache delete error for pattern {pattern}: {e}")


def cached(prefix: str, ttl_key: str):
    """
    Decorator for caching function results.

    Args:
        prefix: Cache key prefix
        ttl_key: Key in CACHE_TTL dict for TTL value

    Usage:
        @cached(prefix="forecast", ttl_key="forecast")
        async def get_forecast(lat, lon, day):
            ...
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function arguments
            cache_key = generate_cache_key(prefix, args=args, kwargs=kwargs)

            # Try cache first
            cached_result = await get_cached(cache_key)
            if cached_result is not None:
                return cached_result

            # Call function
            result = await func(*args, **kwargs)

            # Cache result
            ttl = CACHE_TTL.get(ttl_key, 300)
            await set_cached(cache_key, result, ttl)

            return result

        return wrapper

    return decorator
