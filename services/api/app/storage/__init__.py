from functools import lru_cache
from app.storage.interfaces import StorageService
from app.storage.local import LocalStorageService


@lru_cache
def get_storage_service() -> StorageService:
    """Return configured storage provider (defaults to secure local storage)."""
    return LocalStorageService()

