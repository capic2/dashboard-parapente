"""
Redis caching for emagram sounding data
Avoids re-downloading same sounding multiple times
"""

import redis
import json
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import os


class EmagramCache:
    """Redis cache for sounding data"""
    
    def __init__(self):
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        try:
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            self.enabled = True
            self.redis_client.ping()  # Test connection
        except (redis.ConnectionError, redis.TimeoutError):
            self.enabled = False
            self.redis_client = None
    
    def _generate_key(self, station_code: str, sounding_time: str, date_str: str) -> str:
        """Generate cache key for sounding"""
        key_str = f"emagram:sounding:{station_code}:{sounding_time}:{date_str}"
        return key_str
    
    def get_sounding(
        self,
        station_code: str,
        sounding_time: str,
        date: datetime
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached sounding data
        
        Returns:
            Cached sounding dict or None if not found/expired
        """
        if not self.enabled:
            return None
        
        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)
            
            cached = self.redis_client.get(key)
            if cached:
                return json.loads(cached)
            
            return None
            
        except Exception as e:
            print(f"Cache get error: {e}")
            return None
    
    def set_sounding(
        self,
        station_code: str,
        sounding_time: str,
        date: datetime,
        sounding_data: Dict[str, Any],
        ttl_hours: int = 24
    ) -> bool:
        """
        Cache sounding data
        
        Args:
            ttl_hours: Time to live in hours (default: 24)
        
        Returns:
            True if cached successfully
        """
        if not self.enabled or not sounding_data.get('success'):
            return False
        
        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)
            
            # Cache for ttl_hours
            ttl_seconds = ttl_hours * 3600
            
            self.redis_client.setex(
                key,
                ttl_seconds,
                json.dumps(sounding_data)
            )
            
            return True
            
        except Exception as e:
            print(f"Cache set error: {e}")
            return False
    
    def invalidate_sounding(
        self,
        station_code: str,
        sounding_time: str,
        date: datetime
    ) -> bool:
        """Invalidate cached sounding"""
        if not self.enabled:
            return False
        
        try:
            date_str = date.strftime("%Y-%m-%d")
            key = self._generate_key(station_code, sounding_time, date_str)
            self.redis_client.delete(key)
            return True
            
        except Exception as e:
            print(f"Cache invalidate error: {e}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if not self.enabled:
            return {"enabled": False}
        
        try:
            info = self.redis_client.info("stats")
            keys_count = self.redis_client.dbsize()
            
            return {
                "enabled": True,
                "total_keys": keys_count,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
                "hit_rate": (
                    info.get("keyspace_hits", 0) / 
                    max(info.get("keyspace_hits", 0) + info.get("keyspace_misses", 0), 1)
                ) * 100
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
