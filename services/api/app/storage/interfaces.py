from typing import Protocol
from uuid import UUID


class StorageService(Protocol):
    """Storage abstraction for saving, reading, and purging documents."""

    def save_file(self, user_id: UUID, document_id: UUID, filename: str, content: bytes) -> str:
        """Persist document bytes and return a unique storage key."""
        ...

    def get_file(self, storage_key: str) -> bytes:
        """Retrieve stored document bytes given a storage key."""
        ...

    def delete_file(self, storage_key: str) -> bool:
        """Purge stored document bytes given a storage key."""
        ...

