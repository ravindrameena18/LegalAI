import logging
import os
import re
import shutil
from pathlib import Path
from uuid import UUID

from app.core.config import get_settings
from app.storage.interfaces import StorageService

logger = logging.getLogger("legalai.storage")


def sanitize_filename(filename: str) -> str:
    """Sanitize filename to prevent directory traversal and injection."""
    # Remove directory paths
    base = os.path.basename(filename).strip()
    # Remove null bytes and control chars
    base = base.replace("\x00", "").replace("/", "_").replace("\\", "_")
    # Replace dangerous or whitespace characters
    safe = re.sub(r"[^\w\-.]", "_", base)
    # Ensure not empty and doesn't start with dot
    if not safe or safe.startswith("."):
        safe = f"doc_{safe.lstrip('.')}"
    return safe[:180]  # Limit length


class LocalStorageService(StorageService):
    """Local filesystem storage implementation with traversal security."""

    def __init__(self, root_dir: Path | str | None = None):
        if root_dir is None:
            # Default to root-level storage/documents directory
            base_dir = Path(__file__).resolve().parent.parent.parent
            self.root = (base_dir / "storage" / "documents").resolve()
        else:
            self.root = Path(root_dir).resolve()

        self.root.mkdir(parents=True, exist_ok=True)

    def _resolve_key(self, storage_key: str) -> Path:
        """Resolve storage key securely ensuring it stays within root."""
        # Clean relative key
        clean_key = storage_key.strip().lstrip("/\\")
        target = (self.root / clean_key).resolve()
        if not target.is_relative_to(self.root):
            raise ValueError(f"Directory traversal attempt detected in key: {storage_key}")
        return target

    def save_file(self, user_id: UUID, document_id: UUID, filename: str, content: bytes) -> str:
        safe_name = sanitize_filename(filename)
        user_folder = self.root / str(user_id) / str(document_id)
        user_folder.mkdir(parents=True, exist_ok=True)

        target_file = user_folder / safe_name
        if not target_file.resolve().is_relative_to(self.root):
            raise ValueError("Path traversal violation during file save.")

        target_file.write_bytes(content)
        # Return canonical relative storage key
        relative_key = f"{user_id}/{document_id}/{safe_name}"
        logger.info("Saved document bytes to storage key=%s size=%d", relative_key, len(content))
        return relative_key

    def get_file(self, storage_key: str) -> bytes:
        target = self._resolve_key(storage_key)
        if not target.is_file():
            raise FileNotFoundError(f"Stored file not found for key: {storage_key}")
        return target.read_bytes()

    def delete_file(self, storage_key: str) -> bool:
        try:
            target = self._resolve_key(storage_key)
            if target.is_file():
                target.unlink(missing_ok=True)
                # Clean up parent document folder if empty
                parent_dir = target.parent
                if parent_dir.is_dir() and not any(parent_dir.iterdir()):
                    shutil.rmtree(parent_dir, ignore_errors=True)
                logger.info("Deleted document from storage key=%s", storage_key)
                return True
            return False
        except Exception as exc:
            logger.exception("Failed to delete document storage key=%s: %s", storage_key, exc)
            return False

