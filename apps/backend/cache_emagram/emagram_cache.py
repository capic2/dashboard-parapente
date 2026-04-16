"""Redis caching for emagram sounding data."""

import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class EmagramCache:
    """Redis cache for sounding data.

    Uses the shared async Redis client from ``cache.get_redis`` so weather/admin
    cache views and emagram cache always point to the same backend.
    """

    async def _get_client(self):
        from cache import get_redis

        return await get_redis()

    def _generate_key(self, station_code: str, sounding_time: str, date_str: str) -> str:
        """Generate cache key for sounding"""
        key_str = f"emagram:sounding:{station_code}:{sounding_time}:{date_str}"
        return key_str

    async def get_sounding(
        self, station_code: str, sounding_time: str, date: datetime
    ) -> dict[str, Any] | None:
        """
        Get cached sounding data

        Returns:
            Cached sounding dict or None if not found/expired
        """
        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)

            redis_client = await self._get_client()
            cached = await redis_client.get(key)
            if cached:
                return json.loads(cached)

            return None

        except Exception as e:
            logger.warning("Cache get error: %s", e)
            return None

    async def set_sounding(
        self,
        station_code: str,
        sounding_time: str,
        date: datetime,
        sounding_data: dict[str, Any],
        ttl_hours: int = 24,
    ) -> bool:
        """
        Cache sounding data

        Args:
            ttl_hours: Time to live in hours (default: 24)

        Returns:
            True if cached successfully
        """
        if not sounding_data.get("success"):
            return False

        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)

            # Cache for ttl_hours
            ttl_seconds = ttl_hours * 3600

            if isinstance(sounding_data, dict):
                sounding_data["cached_at"] = datetime.now(timezone.utc).isoformat()
            redis_client = await self._get_client()
            await redis_client.setex(key, ttl_seconds, json.dumps(sounding_data))

            return True

        except Exception as e:
            logger.warning("Cache set error: %s", e)
            return False

    async def invalidate_sounding(
        self, station_code: str, sounding_time: str, date: datetime
    ) -> bool:
        """Invalidate cached sounding"""
        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)
            redis_client = await self._get_client()
            await redis_client.delete(key)
            return True

        except Exception as e:
            logger.warning("Cache invalidate error: %s", e)
            return False

    async def get_stats(self) -> dict[str, Any]:
        """Get cache statistics"""
        try:
            redis_client = await self._get_client()
            info = await redis_client.info("stats")
            keys_count = await redis_client.dbsize()

            return {
                "enabled": True,
                "total_keys": keys_count,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    info.get("keyspace_hits", 0)
                    / max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
                )
                * 100,
            }

        except Exception as e:
            return {"enabled": True, "error": str(e)}


# Global cache instance
_cache_instance = None


def get_cache() -> EmagramCache:
    """Get global cache instance (singleton)"""
    global _cache_instance

    if _cache_instance is None:
        _cache_instance = EmagramCache()

    return _cache_instance
