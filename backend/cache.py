"""
Redis cache manager for weather data caching.
"""
import os
import json
import hashlib
import logging
from typing import Optional, Any, Dict
from functools import wraps
import redis.asyncio as redis

logger = logging.getLogger(__name__)

# Cache TTL configuration (in seconds)
# Updated for polling system: 30min to stay fresh between hourly polls
CACHE_TTL: Dict[str, int] = {
    "open-meteo": 1800,       # 30 minutes (refreshed by scheduler)
    "weatherapi": 1800,       # 30 minutes (refreshed by scheduler)
    "meteo-parapente": 1800,  # 30 minutes (refreshed by scheduler)
    "meteociel": 1800,        # 30 minutes (refreshed by scheduler)
    "meteoblue": 1800,        # 30 minutes (refreshed by scheduler)
    "forecast": 1800,         # 30 minutes (combined forecast)
    "summary": 1800,          # 30 minutes (site summary)
}

# Redis connection pool (singleton)
_redis_pool: Optional[redis.Redis] = None


async def get_redis() -> redis.Redis:
    """
    Get or create Redis connection pool.
    
    In development/test mode, uses fakeredis (in-memory mock) by default.
    Set USE_FAKE_REDIS=false to use a real Redis server even in dev mode.
    
    Returns:
        Redis client instance
    """
    global _redis_pool
    
    if _redis_pool is None:
        environment = os.getenv("ENVIRONMENT", "production")
        use_fake_redis = os.getenv("USE_FAKE_REDIS", "true").lower() == "true"
        
        # Use fakeredis in development/test mode (unless explicitly disabled)
        if environment in ["development", "test"] and use_fake_redis:
            try:
                from fakeredis import FakeAsyncRedis
                _redis_pool = FakeAsyncRedis(decode_responses=True)
                logger.info("Using FakeRedis (in-memory mock) for development")
            except ImportError:
                logger.warning("fakeredis not installed, falling back to real Redis. Install with: pip install fakeredis")
                use_fake_redis = False
        
        # Use real Redis in production or if fakeredis is disabled/unavailable
        if not use_fake_redis or environment not in ["development", "test"]:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = int(os.getenv("REDIS_PORT", "6379"))
            
            logger.info(f"Connecting to Redis at {redis_host}:{redis_port}")
            
            _redis_pool = redis.Redis(
                host=redis_host,
                port=redis_port,
                db=0,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
            )
        
        # Test connection
        try:
            await _redis_pool.ping()
            logger.info("Redis connection established successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
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


async def get_cached(key: str) -> Optional[Any]:
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
