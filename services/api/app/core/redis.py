from redis import Redis

from app.core.config import get_settings


def get_redis_client() -> Redis:
    """Create a Redis client for jobs, rate limits, and ephemeral state."""
    return Redis.from_url(get_settings().redis_url, decode_responses=True)
