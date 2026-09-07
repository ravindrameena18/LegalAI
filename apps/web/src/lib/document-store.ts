/**
 * Persistent document tombstone store.
 * Tracks deleted document IDs in localStorage to prevent stale caches or un-synced state
 * from resurrecting deleted documents across refreshes or navigation.
 */

const DELETED_DOCS_KEY = "legalai_deleted_doc_ids";

export function getDeletedDocumentIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_DOCS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((id) => typeof id === "string" && id.trim().length > 0));
    }
  } catch {
    // Ignore storage parse errors
  }
  return new Set();
}

export function markDocumentDeleted(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const current = getDeletedDocumentIds();
    current.add(id);
    localStorage.setItem(DELETED_DOCS_KEY, JSON.stringify(Array.from(current)));
  } catch (err) {
    console.warn("Failed to record deleted document tombstone:", err);
  }
}

export function isDocumentDeleted(id: string): boolean {
  if (!id) return false;
  return getDeletedDocumentIds().has(id);
}

export function filterOutDeletedDocuments<T extends { id: string }>(docs: T[]): T[] {
  if (!Array.isArray(docs) || docs.length === 0) return [];
  const deletedIds = getDeletedDocumentIds();
  if (deletedIds.size === 0) return docs;
  return docs.filter((d) => d && d.id && !deletedIds.has(d.id));
}

