import type { MessageData } from "@/components/chat-message";
import { deleteChatSessionApi } from "@/lib/api-client";
import { isDocumentDeleted, markDocumentDeleted } from "./document-store";

export type StoredMessage = MessageData;

export interface StoredChatSession {
  id: string;
  title: string;
  userId: string;
  documentId?: string | null;
  documentName?: string | null;
  documentRemoved?: boolean;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PREFIX = "legalai_chat_sessions_";
const DELETED_SESSIONS_KEY = "legalai_deleted_chat_ids";

function getStorageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId || "guest"}`;
}

export function getDeletedSessionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DELETED_SESSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed);
    }
  } catch {}
  return new Set();
}

function markSessionDeleted(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const deleted = getDeletedSessionIds();
    deleted.add(id);
    localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(deleted)));
  } catch {}
}

function unmarkSessionDeleted(id: string): void {
  if (typeof window === "undefined" || !id) return;
  try {
    const deleted = getDeletedSessionIds();
    if (deleted.has(id)) {
      deleted.delete(id);
      localStorage.setItem(DELETED_SESSIONS_KEY, JSON.stringify(Array.from(deleted)));
    }
  } catch {}
}

export function generateChatTitle(firstMessage: string, docName?: string | null): string {
  if (firstMessage && firstMessage.trim()) {
    // Clean and shorten user query
    const cleaned = firstMessage
      .replace(/^(\s*please|\s*can you|\s*could you|\s*what are|\s*how)\s+/i, "")
      .trim();
    const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    if (capitalized.length > 28) {
      return capitalized.slice(0, 28) + "...";
    }
    return capitalized;
  }
  if (docName) {
    const cleanDoc = docName.replace(/\.[^/.]+$/, "");
    return cleanDoc.length > 28 ? cleanDoc.slice(0, 28) + "..." : cleanDoc;
  }
  return "New Consultation";
}

export function listChatSessions(userId: string): StoredChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const deletedIds = getDeletedSessionIds();
    const primaryKey = getStorageKey(userId);
    const raw = localStorage.getItem(primaryKey);
    let sessions: StoredChatSession[] = [];
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) sessions = [...parsed];
    }

    // Merge sessions from guest if userId is a specific logged-in user
    if (userId && userId !== "guest") {
      const guestRaw = localStorage.getItem(getStorageKey("guest"));
      if (guestRaw) {
        try {
          const guestParsed = JSON.parse(guestRaw);
          if (Array.isArray(guestParsed)) {
            for (const s of guestParsed) {
              if (s && s.id && !sessions.some((existing) => existing.id === s.id)) {
                sessions.push(s);
              }
            }
          }
        } catch {}
      }
    }

    // Deduplicate by ID and exclude any deleted sessions
    const seenIds = new Set<string>();
    const unique = sessions.filter((s: StoredChatSession) => {
      if (!s || !s.id || seenIds.has(s.id) || deletedIds.has(s.id)) return false;
      seenIds.add(s.id);
      return true;
    });

    const sanitized = unique.map((s) => {
      if (s.documentId && isDocumentDeleted(s.documentId)) {
        return {
          ...s,
          documentId: null,
          documentName: null,
          documentRemoved: true,
        };
      }
      return s;
    });

    return sanitized.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  } catch (err) {
    console.warn("Failed to read chat sessions from localStorage:", err);
    return [];
  }
}

export function getChatSession(id: string, userId?: string): StoredChatSession | null {
  if (typeof window === "undefined" || !id) return null;
  if (getDeletedSessionIds().has(id)) return null;

  const sanitizeSession = (session: StoredChatSession | null): StoredChatSession | null => {
    if (!session) return null;
    if (session.documentId && isDocumentDeleted(session.documentId)) {
      return {
        ...session,
        documentId: null,
        documentName: null,
        documentRemoved: true,
      };
    }
    return session;
  };

  if (userId) {
    const sessions = listChatSessions(userId);
    const found = sessions.find((s) => s.id === id);
    if (found) return sanitizeSession(found);
  }

  // Fallback: search all storage keys starting with STORAGE_PREFIX
  try {
    const deletedIds = getDeletedSessionIds();
    const targetKey = userId ? getStorageKey(userId) : null;
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key && key.startsWith(STORAGE_PREFIX) && key !== targetKey) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const match = parsed.find((s: StoredChatSession) => s && s.id === id && !deletedIds.has(s.id));
            if (match) return sanitizeSession(match);
          }
        }
      }
    }
  } catch (err) {
    console.warn("Failed in getChatSession fallback:", err);
  }

  return null;
}

export function createChatSession(
  userId: string,
  initialData?: {
    id?: string;
    title?: string;
    documentId?: string | null;
    documentName?: string | null;
    messages?: StoredMessage[];
  },
): StoredChatSession {
  if (initialData?.id) {
    unmarkSessionDeleted(initialData.id);
  }

  const sessions = listChatSessions(userId);

  // If user clicks New Chat and an empty, untouched New Chat session already exists, reuse it
  const isDefaultNew =
    !initialData ||
    (!initialData.documentId && (!initialData.messages || initialData.messages.length === 0));

  if (isDefaultNew) {
    const existingEmpty = sessions.find(
      (s) =>
        (!s.messages || s.messages.length === 0) &&
        !s.documentId &&
        (s.title === "New Chat" || s.title === "New Consultation"),
    );
    if (existingEmpty) {
      return existingEmpty;
    }
  }

  // Clean up any older empty sessions without messages or documents to prevent duplicate "New Chat" list clutter
  const cleanedSessions = isDefaultNew
    ? sessions.filter(
        (s) => (s.messages && s.messages.length > 0) || s.documentId,
      )
    : sessions;

  const newSession: StoredChatSession = {
    id: initialData?.id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `session-${Date.now()}`),
    title: initialData?.title || "New Chat",
    userId: userId || "guest",
    documentId: initialData?.documentId || null,
    documentName: initialData?.documentName || null,
    messages: initialData?.messages || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [newSession, ...cleanedSessions.filter((s) => s.id !== newSession.id)];

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("legalai:chats-updated", {
        detail: { sessionId: newSession.id, action: "created" },
      }),
    );
  } catch (err) {
    console.warn("Failed to write new chat session:", err);
  }

  return newSession;
}

export function saveChatSession(session: StoredChatSession, userId: string): void {
  if (typeof window === "undefined") return;
  // If this session was deleted, do not re-save or resurrect it
  if (getDeletedSessionIds().has(session.id)) return;

  const sessions = listChatSessions(userId);
  const existingIdx = sessions.findIndex((s) => s.id === session.id);

  const updatedSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  };

  let updatedList: StoredChatSession[];
  if (existingIdx >= 0) {
    updatedList = [...sessions];
    updatedList[existingIdx] = updatedSession;
  } else {
    updatedList = [updatedSession, ...sessions];
  }

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updatedList));
    window.dispatchEvent(
      new CustomEvent("legalai:chats-updated", {
        detail: { sessionId: session.id, action: "saved" },
      }),
    );
  } catch (err) {
    console.warn("Failed to save chat session:", err);
  }
}

export function deleteChatSession(id: string, _userId?: string): void {
  if (typeof window === "undefined" || !id) return;

  // 1. Mark in deleted tombstone set so it can never be resurrected or read
  markSessionDeleted(id);

  // 2. Snapshot all keys in localStorage to safely clean without shifting
  try {
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              const clean = parsed.filter((s: StoredChatSession) => s && s.id !== id && !getDeletedSessionIds().has(s.id));
              localStorage.setItem(key, JSON.stringify(clean));
            }
          } catch {}
        }
      } else if (
        key === `legalai_chat_${id}` ||
        key === `legalai_chat_session_${id}` ||
        key.includes(id)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.warn("Failed to clean localStorage for deleted chat session:", err);
  }

  // 3. Clear from sessionStorage
  try {
    const sessionKeys = Object.keys(sessionStorage);
    for (const key of sessionKeys) {
      if (
        key === `legalai_chat_${id}` ||
        key === `legalai_chat_session_${id}` ||
        key.includes(id)
      ) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {}

  // 4. Notify backend to cascade delete ChatMessage & ChatSession rows from database
  deleteChatSessionApi(id).catch(() => {});

  // 5. Dispatch event so all components immediately remove the chat and reset active views
  try {
    window.dispatchEvent(
      new CustomEvent("legalai:chats-updated", {
        detail: { sessionId: id, action: "deleted" },
      }),
    );
  } catch {}
}

export function handleDocumentDeletedInChatStore(deletedDocId: string, _userId?: string): void {
  if (typeof window === "undefined" || !deletedDocId) return;

  // 1. Mark in permanent document tombstone store
  markDocumentDeleted(deletedDocId);

  // 2. Iterate all session storage keys to safely unlink without key omission
  try {
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
      if (key.startsWith(STORAGE_PREFIX)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              let changed = false;
              const updated = parsed.map((s: StoredChatSession) => {
                if (s && s.documentId === deletedDocId) {
                  changed = true;
                  return {
                    ...s,
                    documentId: null,
                    documentName: null,
                    documentRemoved: true,
                    updatedAt: new Date().toISOString(),
                  };
                }
                return s;
              });
              if (changed) {
                localStorage.setItem(key, JSON.stringify(updated));
              }
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    console.warn("Failed to scrub deleted document from chat sessions:", err);
  }

  // 3. Dispatch event
  try {
    window.dispatchEvent(
      new CustomEvent("legalai:chats-updated", {
        detail: { deletedDocId, action: "document_unlinked" },
      }),
    );
  } catch {}
}
