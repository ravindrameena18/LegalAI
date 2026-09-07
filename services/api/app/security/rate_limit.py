import logging
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.redis import get_redis_client

logger = logging.getLogger("legalai.ratelimit")

# Thread-safe in-memory cache for development/testing when Redis is unconfigured
_in_memory_lock = Lock()
_in_memory_buckets: dict[str, list[float]] = defaultdict(list)

# Status cache to avoid continuous connection attempts when Redis is offline
_redis_available = False
_last_redis_check = 0.0
_REDIS_RETRY_INTERVAL = 30.0


def _check_in_memory_rate_limit(key: str, times: int, seconds: int) -> bool:
    now = time.time()
    cutoff = now - seconds
    with _in_memory_lock:
        timestamps = _in_memory_buckets[key]
        # Keep only timestamps within window
        valid_timestamps = [t for t in timestamps if t > cutoff]
        if len(valid_timestamps) >= times:
            _in_memory_buckets[key] = valid_timestamps
            return False
        valid_timestamps.append(now)
        _in_memory_buckets[key] = valid_timestamps
        return True


def _check_redis_rate_limit(key: str, times: int, seconds: int) -> bool:
    global _redis_available, _last_redis_check
    now = time.time()

    # If previously determined unavailable, only retry after _REDIS_RETRY_INTERVAL
    if not _redis_available and (now - _last_redis_check < _REDIS_RETRY_INTERVAL):
        return _check_in_memory_rate_limit(key, times, seconds)

    try:
        redis_client = get_redis_client()
        redis_client.connection_pool.connection_kwargs["socket_connect_timeout"] = 0.05
        redis_client.ping()
        _redis_available = True
        _last_redis_check = now
        redis_key = f"rate_limit:{key}"
        current = redis_client.incr(redis_key)
        if current == 1:
            redis_client.expire(redis_key, seconds)
        return current <= times
    except Exception as exc:
        _redis_available = False
        _last_redis_check = now
        logger.debug(
            "Redis rate limiting connection unavailable (%s); using in-memory fallback.",
            exc,
        )
        return _check_in_memory_rate_limit(key, times, seconds)


class RateLimiter:
    """
    Rate limiter for protecting sensitive endpoints (login, registration).
    Uses Redis when available, falling back to an in-memory window.
    """

    def __init__(self, times: int = 5, seconds: int = 60, prefix: str = "endpoint"):
        self.times = times
        self.seconds = seconds
        self.prefix = prefix

    def __call__(self, request: Request) -> None:
        client_ip = request.client.host if request.client else "unknown"
        key = f"{self.prefix}:{client_ip}"

        allowed = _check_redis_rate_limit(key, self.times, self.seconds)
        if not allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later.",
                headers={"Retry-After": str(self.seconds)},
            )


def clear_in_memory_rate_limits() -> None:
    """Utility for testing cleanup."""
    with _in_memory_lock:
        _in_memory_buckets.clear()
    try:
        redis_client = get_redis_client()
        keys = redis_client.keys("rate_limit:*")
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass

