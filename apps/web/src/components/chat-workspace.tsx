"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileTextIcon,
  PlusIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "./icons";
import { ChatInput } from "./chat-input";
import { ChatMessage, type MessageData, type CitationItem } from "./chat-message";
import { DocumentContextBar } from "./document-context-bar";
import { EvidenceModal, type EvidenceData } from "./evidence-modal";
import { PasswordPromptModal } from "./password-prompt-modal";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  createChatSession,
  generateChatTitle,
  getChatSession,
  saveChatSession,
  type StoredChatSession,
} from "@/lib/chat-store";
import { isDocumentDeleted } from "@/lib/document-store";
import {
  ApiError,
  askDocumentQuestion,
  getDocument,
  getDocumentAnalysis,
  triggerDocumentAnalysis,
  uploadDocument,
  type AnalysisDetail,
  type DocumentDetail,
  type DocumentItem,
  type DocumentPage,
} from "@/lib/api-client";

interface ChatWorkspaceProps {
  documents: DocumentItem[];
  sessionId?: string;
  initialDocId?: string | null;
  onDocumentUploaded?: (newDoc: DocumentItem) => void;
  onSelectDoc?: (doc: DocumentItem) => void;
}

const EMPTY_STATE_CHIPS = [
  {
    label: "Summarize key obligations",
    query: "Please summarize the key obligations, binding covenants, and performance duties assigned to each party.",
  },
  {
    label: "Identify liability risks",
    query: "What are the most critical liability risks, indemnities, uncapped damages, or one-sided terms in this agreement?",
  },
  {
    label: "Extract termination clauses",
    query: "Extract and review all termination clauses, including for-cause, convenience, notice periods, and post-termination duties.",
  },
  {
    label: "Check compliance terms",
    query: "Check compliance terms, governing law, dispute resolution, confidentiality duration, and regulatory requirements.",
  },
];

const DOC_SUGGESTION_CHIPS = [
  "Summarize this document",
  "What are the payment terms?",
  "Find termination clauses",
  "What are the major risks?",
  "What are the contractor's obligations?",
  "Are there liquidated damages?",
];

function searchPagesForKeywords(
  pages: DocumentPage[] | undefined,
  keywords: string[],
): { page: number; snippet: string }[] {
  if (!pages || pages.length === 0) return [];
  const results: { page: number; snippet: string; score: number }[] = [];

  const cleanKeywords = keywords
    .map((kw) => kw.replace(/[^\w\s-]/g, " ").trim().toLowerCase())
    .filter((kw) => kw.length >= 2);

  if (cleanKeywords.length === 0) return [];

  for (const p of pages) {
    const text = p.text || "";
    const lower = text.toLowerCase();
    let bestIdx = -1;
    let matchCount = 0;
    let matchedKwLen = 0;

    for (const kw of cleanKeywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1) {
        matchCount++;
        if (bestIdx === -1 || idx < bestIdx) {
          bestIdx = idx;
          matchedKwLen = kw.length;
        }
      }
    }

    if (bestIdx !== -1) {
      const start = Math.max(0, bestIdx - 60);
      const end = Math.min(text.length, bestIdx + matchedKwLen + 180);
      let snippet = text.slice(start, end).trim();
      if (start > 0) snippet = "..." + snippet;
      if (end < text.length) snippet = snippet + "...";
      results.push({ page: p.page_number, snippet, score: matchCount });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.map((r) => ({ page: r.page, snippet: r.snippet }));
}

function isHindiOrHinglishQuery(text: string): boolean {
  if (/[\u0900-\u097F]/.test(text)) return true;
  const hinglishKeywords = new Set([
    "kab", "kya", "kisko", "kaun", "kaise", "kitna", "kitne", "kitni",
    "hai", "hain", "hoga", "hogi", "honge", "tha", "thi",
    "isme", "ispe", "iska", "iski", "iske", "paise", "paisa", "rupaye",
    "jama", "karwane", "karwana", "karwa", "dena", "lene", "shartein",
    "shart", "kanoon", "kanun", "adhikar", "samay", "tarikh", "jurmana",
    "nuksan", "samapt", "samapti", "dastavej", "thekedar", "bhugtan",
    "dhara", "niyam", "bhi", "aur", "toh", "nahi", "nahin", "mujhe",
    "aap", "tum", "karo", "karna", "diya", "diye", "deri", "tarike"
  ]);
  const words = text.toLowerCase().split(/[^a-zA-Z0-9]+/);
  return words.some((w) => hinglishKeywords.has(w));
}

export function ChatWorkspace({
  documents = [],
  sessionId: propSessionId,
  initialDocId,
  onDocumentUploaded,
  onSelectDoc,
}: ChatWorkspaceProps) {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { language, t } = useLanguage();
  const userId = user?.id || "guest";

  const [dashboardSessionId, setDashboardSessionId] = useState<string>(() => {
    return typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  });

  const currentSessionId = propSessionId || dashboardSessionId;

  // Read stored session synchronously from storage if on a /chat/[id] session
  const initialStored = typeof window !== "undefined" && propSessionId
    ? getChatSession(propSessionId, userId)
    : null;

  const [activeDoc, setActiveDoc] = useState<DocumentItem | null>(() => {
    if (initialStored?.documentId) {
      if (isDocumentDeleted(initialStored.documentId) || initialStored.documentRemoved) return null;
      const found = documents.find((d) => d.id === initialStored.documentId);
      if (found) return found;
      if (documents.length > 0) return null;
      return {
        id: initialStored.documentId,
        name: initialStored.documentName || "Document",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 0,
        status: "ready",
        processing_status: "ready",
        page_count: 1,
        created_at: initialStored.createdAt || new Date().toISOString(),
        updated_at: initialStored.updatedAt || new Date().toISOString(),
      };
    }
    if (initialDocId && documents.length > 0) {
      return documents.find((d) => d.id === initialDocId) || null;
    }
    return null;
  });

  const [activeDocDetail, setActiveDocDetail] = useState<DocumentDetail | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<AnalysisDetail | null>(null);

  const [messages, setMessages] = useState<MessageData[]>(() => {
    if (initialStored?.messages && initialStored.messages.length > 0) {
      return initialStored.messages;
    }
    return [];
  });

  const [isSessionLoading, setIsSessionLoading] = useState<boolean>(() => {
    if (!propSessionId) return false;
    if (initialStored) return false;
    return !!authLoading;
  });

  const [sessionNotFound, setSessionNotFound] = useState<boolean>(() => {
    if (!propSessionId) return false;
    if (initialStored) return false;
    return !authLoading;
  });

  const [isAiThinking, setIsAiThinking] = useState(false);
  const [inspectedEvidence, setInspectedEvidence] = useState<EvidenceData | null>(null);
  const [deletedNotice, setDeletedNotice] = useState<string | null>(() => {
    if (
      initialStored?.documentRemoved ||
      (initialStored?.documentId && isDocumentDeleted(initialStored.documentId))
    ) {
      return "The document previously associated with this chat has been deleted. Conversation history is preserved.";
    }
    return null;
  });

  const handleStartNewChat = () => {
    const newSession = createChatSession(userId);
    router.push(`/chat/${newSession.id}`);
  };

  // Active AI request tracking for AbortController & timeouts
  const activeAiRequestRef = useRef<{
    abortController: AbortController;
    timerId?: ReturnType<typeof setTimeout>;
  } | null>(null);

  const handleStop = useCallback(() => {
    if (activeAiRequestRef.current) {
      activeAiRequestRef.current.abortController.abort();
      if (activeAiRequestRef.current.timerId) {
        clearTimeout(activeAiRequestRef.current.timerId);
      }
      activeAiRequestRef.current = null;
    }
    setIsAiThinking(false);
  }, []);

  // Abort any active AI request when unmounting or switching sessions
  useEffect(() => {
    return () => {
      if (activeAiRequestRef.current) {
        activeAiRequestRef.current.abortController.abort();
        if (activeAiRequestRef.current.timerId) {
          clearTimeout(activeAiRequestRef.current.timerId);
        }
        activeAiRequestRef.current = null;
      }
    };
  }, [currentSessionId]);

  // Listen for chat deletion events to immediately wipe local conversation state and redirect if open
  useEffect(() => {
    const handleChatsUpdated = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail?.action === "deleted" && detail?.sessionId) {
        if (detail.sessionId === currentSessionId || detail.sessionId === propSessionId) {
          handleStop();
          setMessages([]);
          setActiveDoc(null);
          setActiveDocDetail(null);
          setActiveAnalysis(null);
          setDeletedNotice(null);
          if (propSessionId) {
            setSessionNotFound(true);
            router.push("/dashboard");
          } else {
            setDashboardSessionId(
              typeof crypto !== "undefined" && crypto.randomUUID
                ? crypto.randomUUID()
                : `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            );
          }
        }
      }
    };

    window.addEventListener("legalai:chats-updated", handleChatsUpdated);
    return () => {
      window.removeEventListener("legalai:chats-updated", handleChatsUpdated);
    };
  }, [currentSessionId, propSessionId, handleStop, router]);

  // Upload state
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [passwordPromptDoc, setPasswordPromptDoc] = useState<DocumentItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, isAiThinking]);

  const handleSelectDocument = useCallback((doc: DocumentItem) => {
    if (doc.processing_status === "password_required") {
      setPasswordPromptDoc(doc);
      return;
    }
    handleStop();
    setDeletedNotice(null);
    setActiveDoc(doc);

    // Document isolation: reset details & analysis if switching document
    setActiveDocDetail((prev) => (prev && prev.id === doc.id ? prev : null));
    setActiveAnalysis((prev) => (prev && prev.document_id === doc.id ? prev : null));

    // If doc already contains extracted pages (i.e. DocumentDetail), populate immediately
    if ("pages" in doc && Array.isArray((doc as DocumentDetail).pages) && (doc as DocumentDetail).pages.length > 0) {
      setActiveDocDetail(doc as DocumentDetail);
    }

    if (onSelectDoc) onSelectDoc(doc);

    // Save attached document to current session
    const existing = getChatSession(currentSessionId, userId);
    let initialMsgs = existing?.messages || [];
    if (initialMsgs.length === 0) {
      initialMsgs = [
        {
          id: `intro-${Date.now()}`,
          sender: "assistant",
          content: `${t("chat.ready_greeting")} **${doc.name}**. ${t("chat.ready_subheading")}`,
        },
      ];
    }
    setMessages(initialMsgs);

    saveChatSession(
      {
        id: currentSessionId,
        title: existing?.title && existing.title !== "New Chat" ? existing.title : doc.name.replace(/\.[^/.]+$/, ""),
        userId,
        documentId: doc.id,
        documentName: doc.name,
        messages: initialMsgs,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      userId,
    );
  }, [currentSessionId, handleStop, onSelectDoc, userId, t]);

  // Load chat session from storage or sync active document
  useEffect(() => {
    // 1. If on dashboard without propSessionId
    if (!propSessionId) {
      setIsSessionLoading(false);
      setSessionNotFound(false);
      if (initialDocId && documents.length > 0) {
        const found = documents.find((d) => d.id === initialDocId);
        if (found && activeDoc?.id !== found.id) {
          handleSelectDocument(found);
        }
      }
      return;
    }

    // 2. If on /chat/[id] with propSessionId
    const stored = getChatSession(propSessionId, userId);

    if (!stored) {
      if (authLoading) {
        setIsSessionLoading(true);
        return;
      }
      setIsSessionLoading(false);
      setSessionNotFound(true);
      return;
    }

    // Found stored session!
    setIsSessionLoading(false);
    setSessionNotFound(false);
    setMessages(stored.messages || []);

    if (stored.documentId) {
      if (isDocumentDeleted(stored.documentId) || stored.documentRemoved) {
        setActiveDoc(null);
        setDeletedNotice(
          "The document associated with this consultation has been deleted. Conversation history is preserved.",
        );
      } else {
        const found = documents.find((d) => d.id === stored.documentId);
        if (found) {
          setActiveDoc(found);
        } else if (documents.length > 0) {
          setActiveDoc(null);
          setDeletedNotice(
            "The document associated with this consultation is no longer available. Conversation history is preserved.",
          );
        } else {
          setActiveDoc({
            id: stored.documentId,
            name: stored.documentName || "Document",
            file_type: "pdf",
            mime_type: "application/pdf",
            file_size: 0,
            status: "ready",
            processing_status: "ready",
            page_count: 1,
            created_at: stored.createdAt || new Date().toISOString(),
            updated_at: stored.updatedAt || new Date().toISOString(),
          });
        }
      }
    } else if (stored.documentRemoved) {
      setActiveDoc(null);
      setDeletedNotice(
        "The document associated with this consultation has been removed. Conversation history is preserved.",
      );
    } else {
      setActiveDoc(null);
    }
  }, [propSessionId, userId, authLoading, documents, initialDocId, activeDoc?.id, handleSelectDocument]);

  // Keep activeDoc synchronized with updated server metadata when documents array updates
  useEffect(() => {
    if (activeDoc && documents.length > 0) {
      const refreshed = documents.find((d) => d.id === activeDoc.id);
      if (refreshed) {
        if (
          refreshed.processing_status !== activeDoc.processing_status ||
          refreshed.page_count !== activeDoc.page_count ||
          refreshed.name !== activeDoc.name
        ) {
          setActiveDoc(refreshed);
        }
      } else {
        // activeDoc was deleted or is no longer present in documents
        setActiveDoc(null);
        setActiveDocDetail(null);
        setActiveAnalysis(null);
        setDeletedNotice("Document is no longer available. Select another document to continue.");
      }
    }
  }, [documents, activeDoc]);

  // Load document pages and analysis when active document changes
  useEffect(() => {
    if (!activeDoc) {
      setActiveDocDetail(null);
      setActiveAnalysis(null);
      return;
    }

    let isMounted = true;

    // Load full document details (extracted pages)
    getDocument(activeDoc.id)
      .then((detail) => {
        if (isMounted && detail.id === activeDoc.id) setActiveDocDetail(detail);
      })
      .catch(() => {});

    // Load existing analysis if available
    getDocumentAnalysis(activeDoc.id)
      .then((analysisData) => {
        if (isMounted && analysisData.document_id === activeDoc.id) setActiveAnalysis(analysisData);
      })
      .catch(() => {
        if (isMounted) setActiveAnalysis(null);
      });

    // If messages are empty for this session, add welcoming intro
    setMessages((prev) => {
      if (prev.length === 0) {
        return [
          {
            id: `intro-${Date.now()}`,
            sender: "assistant",
            content: language === "hi"
              ? `मैं **${activeDoc.name}** के बारे में आपके प्रश्नों के उत्तर देने के लिए तैयार हूँ। मुझसे अनुबंध की शर्तों, दायित्वों, जोखिमों, महत्वपूर्ण तिथियों, भुगतान या समाप्ति के बारे में पूछें।`
              : `I'm ready to answer questions about **${activeDoc.name}**. Ask me about clauses, obligations, risks, dates, payments, termination, or anything else in the document.`,
          },
        ];
      }
      return prev;
    });

    return () => {
      isMounted = false;
    };
  }, [activeDoc?.id, activeDoc?.name, activeDoc?.processing_status, activeDoc?.page_count]);

  // Listen for document deletion event: gracefully clear and notify
  useEffect(() => {
    const handleDocDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name: string }>;
      const deletedId = customEvent.detail?.id;
      if (!deletedId) return;

      if (activeDoc?.id === deletedId) {
        setActiveDoc(null);
        setActiveDocDetail(null);
        setActiveAnalysis(null);
        setDeletedNotice("Document deleted. Select another document to continue.");
      }
    };

    window.addEventListener("legalai:document-deleted", handleDocDeleted);
    return () => window.removeEventListener("legalai:document-deleted", handleDocDeleted);
  }, [activeDoc]);

  const handleFileUpload = async (file: File) => {
    setUploadError(null);
    setDeletedNotice(null);
    const validExtensions = [".pdf", ".docx", ".txt"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!validExtensions.includes(ext)) {
      setUploadError(`Unsupported format '${ext}'. Please upload a PDF, DOCX, or TXT file.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setUploadError("File exceeds the 25 MB limit.");
      return;
    }

    setIsUploading(true);
    try {
      const newDoc = await uploadDocument(file);
      if (onDocumentUploaded) onDocumentUploaded(newDoc);
      if (newDoc.processing_status === "password_required") {
        setPasswordPromptDoc(newDoc);
      } else {
        handleSelectDocument(newDoc);
      }
    } catch (err: unknown) {
      setUploadError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to upload document.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handlePasswordUnlockSuccess = (unlockedDoc: DocumentDetail) => {
    setPasswordPromptDoc(null);
    setActiveDoc(unlockedDoc);
    setActiveDocDetail(unlockedDoc);
    setActiveAnalysis(null);
    if (onDocumentUploaded) onDocumentUploaded(unlockedDoc);
    handleSelectDocument(unlockedDoc);

    // Asynchronously retrieve or trigger analysis for the unlocked document
    getDocumentAnalysis(unlockedDoc.id)
      .then((analysisData) => {
        setActiveAnalysis(analysisData);
      })
      .catch(() => {
        triggerDocumentAnalysis(unlockedDoc.id)
          .then((analysisData) => {
            setActiveAnalysis(analysisData);
          })
          .catch(() => {});
      });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  };

  // Conversational response synthesizer based on document pages and analysis structured data
  const handleSendMessage = async (queryText: string) => {
    if (!queryText.trim()) return;

    setDeletedNotice(null);

    // Abort any existing in-flight AI request
    if (activeAiRequestRef.current) {
      activeAiRequestRef.current.abortController.abort();
      if (activeAiRequestRef.current.timerId) {
        clearTimeout(activeAiRequestRef.current.timerId);
      }
      activeAiRequestRef.current = null;
    }

    const controller = new AbortController();
    activeAiRequestRef.current = { abortController: controller };

    const userMsg: MessageData = {
      id: `user-${Date.now()}`,
      sender: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setIsAiThinking(true);

    if (!activeDoc) {
      const timer = setTimeout(() => {
        if (controller.signal.aborted) return;
        const aiMsg: MessageData = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          content: isHindiOrHinglishQuery(queryText)
            ? "कानूनी विश्लेषण, जोखिमों की पहचान या अनुबंध की शर्तों की समीक्षा के लिए कृपया अपने कार्यक्षेत्र से एक कानूनी दस्तावेज़ चुनें या अपलोड करें।"
            : "Please select or upload a legal document from your workspace to ground legal analysis, identify risks, or extract covenants.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          citations: [],
          risk: null,
        };
        const finalMessages = [...nextMessages, aiMsg];
        setMessages(finalMessages);
        setIsAiThinking(false);
        activeAiRequestRef.current = null;

        const session = getChatSession(currentSessionId, userId) || {
          id: currentSessionId,
          title: generateChatTitle(queryText),
          userId,
          documentId: null,
          documentName: null,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        saveChatSession(
          {
            ...session,
            title: session.title === "New Chat" || session.title === "New Consultation" ? generateChatTitle(queryText) : session.title,
            messages: finalMessages,
          },
          userId,
        );
      }, 500);

      if (activeAiRequestRef.current) {
        activeAiRequestRef.current.timerId = timer;
      }
      return;
    }

    // Ensure document details (extracted pages) are loaded and match current activeDoc
    let currentDocDetail = activeDocDetail;
    if (
      !currentDocDetail ||
      currentDocDetail.id !== activeDoc.id ||
      !currentDocDetail.pages ||
      currentDocDetail.pages.length === 0
    ) {
      try {
        currentDocDetail = await getDocument(activeDoc.id);
        if (controller.signal.aborted) return;
        setActiveDocDetail(currentDocDetail);
      } catch {}
    }

    // Ensure analysis data matches current activeDoc and is retrieved or synthesized
    let currentAnalysis = activeAnalysis;
    if (currentAnalysis && currentAnalysis.document_id !== activeDoc.id) {
      currentAnalysis = null;
    }

    const isReady = activeDoc.processing_status === "ready" || currentDocDetail?.processing_status === "ready";
    if (!currentAnalysis && isReady) {
      try {
        currentAnalysis = await getDocumentAnalysis(activeDoc.id);
        if (controller.signal.aborted) return;
        setActiveAnalysis(currentAnalysis);
      } catch {
        try {
          currentAnalysis = await triggerDocumentAnalysis(activeDoc.id, false, controller.signal);
          if (controller.signal.aborted) return;
          setActiveAnalysis(currentAnalysis);
        } catch (err: unknown) {
          if (controller.signal.aborted || (err instanceof DOMException && err.name === "AbortError")) {
            return;
          }
        }
      }
    }

    if (controller.signal.aborted) return;

    // 1. Try to call the multilingual QA API endpoint first
    try {
      const timeoutLimit = typeof process !== "undefined" && process.env.NODE_ENV === "test" ? 100 : 25000;
      let qaTimer: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        qaTimer = setTimeout(() => reject(new Error("QA_NETWORK_TIMEOUT")), timeoutLimit);
      });
      timeoutPromise.catch(() => {});
      const onAbort = () => {
        if (qaTimer) clearTimeout(qaTimer);
      };
      controller.signal.addEventListener("abort", onAbort, { once: true });
      const qaResponse = await Promise.race([
        askDocumentQuestion(activeDoc.id, queryText, controller.signal),
        timeoutPromise,
      ]).finally(() => {
        if (qaTimer) clearTimeout(qaTimer);
        controller.signal.removeEventListener("abort", onAbort);
      });
      if (qaResponse && qaResponse.answer && !controller.signal.aborted) {
        const aiMsg: MessageData = {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          content: qaResponse.answer,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          citations: (qaResponse.citations || []).map((c) => ({
            page: c.page,
            section: c.section,
            title: c.title,
            text: c.text,
            explanation: c.explanation,
          })),
          risk: qaResponse.risk
            ? {
                severity: qaResponse.risk.severity as "HIGH" | "MEDIUM" | "LOW",
                title: qaResponse.risk.title,
                explanation: qaResponse.risk.explanation,
              }
            : null,
        };

        const finalMessages = [...nextMessages, aiMsg];
        setMessages(finalMessages);
        setIsAiThinking(false);
        activeAiRequestRef.current = null;

        const session = getChatSession(currentSessionId, userId) || {
          id: currentSessionId,
          title: generateChatTitle(queryText, activeDoc?.name),
          userId,
          documentId: activeDoc?.id || null,
          documentName: activeDoc?.name || null,
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const newTitle =
          session.title === "New Chat" || session.title === "New Consultation"
            ? generateChatTitle(queryText, activeDoc?.name || session.documentName)
            : session.title;

        saveChatSession(
          {
            ...session,
            title: newTitle,
            documentId: activeDoc?.id ?? session.documentId ?? null,
            documentName: activeDoc?.name ?? session.documentName ?? null,
            messages: finalMessages,
          },
          userId,
        );
        return;
      }
    } catch {
      if (controller.signal.aborted) return;
      // Fallback to local semantic synthesizer when backend is offline or in mock test environment
    }

    const q = queryText.toLowerCase();
    const isHindi = isHindiOrHinglishQuery(queryText);

    const timer = setTimeout(() => {
      if (controller.signal.aborted) return;
      let aiResponseText = "";
      const citations: CitationItem[] = [];
      let detectedRisk: MessageData["risk"] = null;

      const struct = currentAnalysis?.structured_data;
      const pages = currentDocDetail?.pages;

      // 1. Liquidated damages
      const isLiquidatedQuery =
        q.includes("liquidat") ||
        (q.includes("damage") && (q.includes("pre-estimat") || q.includes("liquid"))) ||
        q.includes("हर्जाना") ||
        q.includes("क्षतिपूर्ति") ||
        q.includes("harzana") ||
        q.includes("jurmana") ||
        q.includes("nuksan");

      if (isLiquidatedQuery) {
        const pageMatches = searchPagesForKeywords(pages, ["liquidated damage", "liquidated damages", "liquidated"]);
        const clauseMatch = struct?.important_clauses?.find(
          (c) => c.title.toLowerCase().includes("liquidat") || c.original_text.toLowerCase().includes("liquidat"),
        );
        const liabilityCarveout = struct?.liability?.carveouts && struct.liability.carveouts.toLowerCase().includes("liquidat")
          ? struct.liability.carveouts
          : null;

        if (clauseMatch) {
          aiResponseText = isHindi
            ? `**परिनिर्धारित क्षतिपूर्ति प्रावधान (Liquidated Damages Provision):**\n\n${clauseMatch.original_text}\n\n*विश्लेषण:* ${clauseMatch.explanation}`
            : `**Liquidated Damages Provision:**\n\n${clauseMatch.original_text}\n\n*Analysis:* ${clauseMatch.explanation}`;
          if (clauseMatch.page) {
            citations.push({
              page: clauseMatch.page,
              section: clauseMatch.section || "Liquidated Damages",
              title: clauseMatch.title,
              text: clauseMatch.original_text,
              explanation: clauseMatch.explanation,
            });
          }
        } else if (pageMatches.length > 0) {
          aiResponseText = isHindi
            ? `**परिनिर्धारित क्षतिपूर्ति प्रावधान (Liquidated Damages Provision):**\n\nदस्तावेज़ के पृष्ठ ${pageMatches[0].page} पर उल्लेख मिला:\n\n> "${pageMatches[0].snippet}"`
            : `**Liquidated Damages Provision:**\n\nFound referenced on Page ${pageMatches[0].page}:\n\n> "${pageMatches[0].snippet}"`;
          pageMatches.forEach((m) => {
            citations.push({
              page: m.page,
              section: "Liquidated Damages",
              title: isHindi ? "परिनिर्धारित क्षतिपूर्ति संदर्भ" : "Liquidated Damages Reference",
              text: m.snippet,
              explanation: isHindi ? "दस्तावेज़ में क्षतिपूर्ति का उल्लेख।" : "Liquidated damages term located in document text.",
            });
          });
        } else if (liabilityCarveout) {
          aiResponseText = isHindi
            ? `**दायित्व शर्तों में क्षतिपूर्ति:**\n\n${liabilityCarveout}`
            : `**Liquidated Damages in Liability Terms:**\n\n${liabilityCarveout}`;
          if (struct?.liability?.page) {
            citations.push({
              page: struct.liability.page,
              section: "Liability Terms",
              title: isHindi ? "क्षतिपूर्ति अपवाद" : "Liquidated Damages Carveout",
              text: liabilityCarveout,
              explanation: "Damages provision in liability section.",
            });
          }
        } else {
          aiResponseText = isHindi
            ? `प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nअनुबंध में पूर्व-निर्धारित हर्ज़ाना (liquidated damages) या उल्लंघन संबंधी जुर्माने का कोई उल्लेख नहीं मिला।`
            : `I could not find this information in the provided document.\n\nThere is no mention of liquidated damages or pre-estimated breach penalties in the agreement.`;
        }
      }
      // 2. Payment terms
      else if (
        q.includes("payment") ||
        q.includes("pay") ||
        q.includes("fee") ||
        q.includes("compensation") ||
        q.includes("invoic") ||
        q.includes("billing") ||
        q.includes("paise") ||
        q.includes("paisa") ||
        q.includes("rupaye") ||
        q.includes("jama") ||
        q.includes("karwane") ||
        q.includes("karwana") ||
        q.includes("bhugtan") ||
        q.includes("भुगतान") ||
        q.includes("पैसे") ||
        q.includes("जमा")
      ) {
        const pageMatches = searchPagesForKeywords(pages, ["payment", "fee", "compensation", "invoice", "net 30", "due date", "fees", "rate", "hourly", "payable", "cost", "price"]);
        if (struct?.financial_terms && struct.financial_terms.length > 0) {
          aiResponseText = isHindi
            ? `**भुगतान एवं वित्तीय शर्तें (Payment & Financial Terms):**\n\n` +
              struct.financial_terms.map((f) => `• **${f.term}**: ${f.amount_or_rate}\n  ${f.details}`).join("\n\n")
            : `**Payment & Financial Terms:**\n\n` +
              struct.financial_terms.map((f) => `• **${f.term}**: ${f.amount_or_rate}\n  ${f.details}`).join("\n\n");

          if (isHindi && (q.includes("late") || q.includes("consequence") || q.includes("deri") || q.includes("देरी") || q.includes("विलंब") || q.includes("jurmana"))) {
            aiResponseText += `\n\n**विलंब एवं परिणाम (Late Payment & Consequences):**\nनियत समय पर भुगतान न करने की स्थिति में अनुबंध की शर्तों के अनुसार विलंब शुल्क, ब्याज या कार्य स्थगन का प्रावधान लागू हो सकता है।`;
          }

          struct.financial_terms.forEach((f) => {
            if (f.page) {
              citations.push({
                page: f.page,
                title: f.term,
                text: f.source_text || `${f.amount_or_rate} — ${f.details}`,
                explanation: isHindi ? `वित्तीय प्रावधान: ${f.term}` : `Financial provision: ${f.term}`,
              });
            }
          });
        } else if (pageMatches.length > 0) {
          aiResponseText = isHindi
            ? `**भुगतान शर्तें (Payment Terms):**\n\n` + pageMatches.slice(0, 3).map((m) => `• **पृष्ठ ${m.page}:** ${m.snippet}`).join("\n\n")
            : `**Payment Terms:**\n\n` + pageMatches.slice(0, 3).map((m) => `• **Page ${m.page}:** ${m.snippet}`).join("\n\n");
          pageMatches.slice(0, 3).forEach((m) => {
            citations.push({
              page: m.page,
              section: "Financial Terms",
              title: isHindi ? "भुगतान प्रावधान" : "Payment Provision",
              text: m.snippet,
              explanation: isHindi ? "दस्तावेज़ में भुगतान की शर्तें।" : "Payment terms located in document text.",
            });
          });
        } else {
          aiResponseText = isHindi
            ? `प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nदस्तावेज़ में भुगतान की कोई विशिष्ट समय-सीमा, दरें या चालान संबंधी शर्तें नहीं मिलीं।`
            : `I could not find this information in the provided document.\n\nNo specific payment schedule, rates, or invoicing terms were detected in the agreement.`;
        }
      }
      // 3. Termination provisions
      else if (
        q.includes("terminat") ||
        q.includes("cancel") ||
        q.includes("cure") ||
        q.includes("breach") ||
        q.includes("exit") ||
        q.includes("samapt") ||
        q.includes("samapti") ||
        q.includes("khatam") ||
        q.includes("radd") ||
        q.includes("समाप्त") ||
        q.includes("समाप्ति") ||
        q.includes("रद्द")
      ) {
        const t = struct?.termination;
        const pageMatches = searchPagesForKeywords(pages, ["termination", "terminate", "for convenience", "for cause", "notice of termination"]);

        const hasStructTermination = t && (
          (t.for_cause && t.for_cause !== "Not found in the provided document.") ||
          (t.for_convenience && t.for_convenience !== "Not found in the provided document.") ||
          (t.notice_period && t.notice_period !== "Not found in the provided document.")
        );

        if (hasStructTermination) {
          aiResponseText = isHindi
            ? `**अनुबंध समाप्ति के प्रावधान (Termination Provisions):**\n\n` +
              `• **कारण सहित (For Cause):** ${t.for_cause}\n` +
              `• **सुविधानुसार (For Convenience):** ${t.for_convenience}\n` +
              `• **आवश्यक नोटिस (Required Notice):** ${t.notice_period}\n` +
              `• **परिणाम एवं समाप्ति के बाद के कर्तव्य:** ${t.consequences}`
            : `**Termination Provisions:**\n\n` +
              `• **For Cause:** ${t.for_cause}\n` +
              `• **For Convenience:** ${t.for_convenience}\n` +
              `• **Required Notice:** ${t.notice_period}\n` +
              `• **Consequences & Post-Termination Duties:** ${t.consequences}`;

          if (t.page) {
            citations.push({
              page: t.page,
              section: "Termination Clause",
              title: isHindi ? "समाप्ति प्रावधान" : "Termination Provisions",
              text: t.for_cause !== "Not found in the provided document." ? t.for_cause : t.for_convenience,
              explanation: isHindi ? `नोटिस अवधि: ${t.notice_period}` : `Notice window: ${t.notice_period}`,
            });
          }
        } else if (pageMatches.length > 0) {
          aiResponseText = isHindi
            ? `**अनुबंध समाप्ति के प्रावधान (Termination Provisions):**\n\n` + pageMatches.slice(0, 3).map((m) => `• **पृष्ठ ${m.page}:** ${m.snippet}`).join("\n\n")
            : `**Termination Provisions:**\n\n` + pageMatches.slice(0, 3).map((m) => `• **Page ${m.page}:** ${m.snippet}`).join("\n\n");
          pageMatches.slice(0, 3).forEach((m) => {
            citations.push({
              page: m.page,
              section: "Termination Clause",
              title: isHindi ? "समाप्ति खंड" : "Termination Clause",
              text: m.snippet,
              explanation: isHindi ? "दस्तावेज़ में समाप्ति का प्रावधान।" : "Termination provision in document text.",
            });
          });
        } else {
          aiResponseText = isHindi
            ? `प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nअनुबंध में स्पष्ट समाप्ति या रद्दीकरण प्रावधानों की पहचान नहीं की गई।`
            : `I could not find this information in the provided document.\n\nNo express termination or cancellation provisions were identified in the agreement.`;
        }
      }
      // 4. Major risks
      else if (
        q.includes("risk") ||
        q.includes("liab") ||
        q.includes("danger") ||
        q.includes("harm") ||
        q.includes("exposure") ||
        q.includes("indemn") ||
        q.includes("jokhim") ||
        q.includes("khatra") ||
        q.includes("जोखिम") ||
        q.includes("दायित्व") ||
        q.includes("हानि")
      ) {
        if (struct && struct.risks && struct.risks.length > 0) {
          const topRisk = struct.risks[0];
          detectedRisk = {
            severity: topRisk.severity,
            title: topRisk.title,
            explanation: topRisk.explanation,
          };

          aiResponseText = isHindi
            ? `मैंने **${activeDoc.name}** में कानूनी जोखिमों का विश्लेषण किया है:\n\n` +
              struct.risks.slice(0, 4).map((r) => `• **[${r.severity === "HIGH" ? "उच्च" : r.severity === "MEDIUM" ? "मध्यम" : "निम्न"}] ${r.title}**\n  ${r.explanation}\n  *सुझाई गई कार्यवाही:* ${r.suggested_review_action}`).join("\n\n")
            : `I analyzed the legal risk exposure in **${activeDoc.name}**:\n\n` +
              struct.risks.slice(0, 4).map((r) => `• **[${r.severity}] ${r.title}**\n  ${r.explanation}\n  *Action:* ${r.suggested_review_action}`).join("\n\n");

          struct.risks.slice(0, 4).forEach((r) => {
            citations.push({
              page: r.page,
              section: r.section,
              title: r.title,
              text: r.source_text,
              explanation: r.explanation,
              action: r.suggested_review_action,
              severity: r.severity,
            });
          });
        } else {
          const pageMatches = searchPagesForKeywords(pages, ["liability", "indemnif", "risk", "damages", "breach", "harm", "penalty"]);
          if (pageMatches.length > 0) {
            aiResponseText = isHindi
              ? `**जोखिम एवं देनदारी प्रावधान (Risk & Liability Provisions):**\n\n` + pageMatches.slice(0, 3).map((m) => `• **पृष्ठ ${m.page}:** ${m.snippet}`).join("\n\n")
              : `**Risk & Liability Provisions:**\n\n` + pageMatches.slice(0, 3).map((m) => `• **Page ${m.page}:** ${m.snippet}`).join("\n\n");
            pageMatches.slice(0, 3).forEach((m) => {
              citations.push({
                page: m.page,
                section: "Risk & Liability",
                title: isHindi ? "जोखिम संदर्भ" : "Risk Reference",
                text: m.snippet,
                explanation: isHindi ? "दस्तावेज़ में जोखिम या देनदारी शर्त।" : "Risk or liability term identified in document text.",
              });
            });
          } else {
            aiResponseText = isHindi
              ? `प्रदान किए गए दस्तावेज़ में कोई उच्च-गंभीरता जोखिम या बड़ी देनदारी नहीं मिली। मानक शर्तें लागू हैं।`
              : `No high-severity risks or major liability exposures were identified in the provided document. Standard liability terms apply.`;
          }
        }
      }
      // 5. Obligations / Contractor's obligations
      else if (
        q.includes("obligat") ||
        q.includes("contractor") ||
        q.includes("duty") ||
        q.includes("duties") ||
        q.includes("covenant") ||
        q.includes("responsibilit") ||
        q.includes("kartavya") ||
        q.includes("dayitva") ||
        q.includes("thekedar") ||
        q.includes("कर्तव्य") ||
        q.includes("दायित्व") ||
        q.includes("ठेकेदार")
      ) {
        const isContractorSpecific = q.includes("contractor") || q.includes("thekedar") || q.includes("ठेकेदार");
        const relevantObligations = struct?.obligations
          ? isContractorSpecific
            ? struct.obligations.filter((o) => o.party.toLowerCase().includes("contractor") || o.obligation.toLowerCase().includes("contractor"))
            : struct.obligations
          : [];

        const obligationsToList = relevantObligations.length > 0 ? relevantObligations : (struct?.obligations || []);

        if (obligationsToList.length > 0) {
          aiResponseText = isHindi
            ? `**संविदात्मक दायित्व (Contractual Obligations):**\n\n` +
              obligationsToList.slice(0, 4).map((o) => `• **${o.party}**: ${o.obligation}${o.deadline ? ` *(समय-सीमा: ${o.deadline})*` : ""}`).join("\n\n")
            : `**Contractual Obligations:**\n\n` +
              obligationsToList.slice(0, 4).map((o) => `• **${o.party}**: ${o.obligation}${o.deadline ? ` *(Deadline: ${o.deadline})*` : ""}`).join("\n\n");

          obligationsToList.slice(0, 3).forEach((o) => {
            if (o.page) {
              citations.push({
                page: o.page,
                title: `${o.party} Obligation`,
                text: o.obligation,
                explanation: o.obligation,
              });
            }
          });
        } else {
          const pageMatches = searchPagesForKeywords(pages, ["contractor shall", "contractor will", "contractor agrees", "obligation", "obligations", "duties", "shall deliver", "shall maintain", "shall perform"]);
          if (pageMatches.length > 0) {
            aiResponseText = isHindi
              ? `**${isContractorSpecific ? "ठेकेदार के " : "संविदात्मक "}दायित्व:**\n\n` + pageMatches.slice(0, 3).map((m) => `• **पृष्ठ ${m.page}:** ${m.snippet}`).join("\n\n")
              : `**${isContractorSpecific ? "Contractor " : "Contractual "}Obligations:**\n\n` + pageMatches.slice(0, 3).map((m) => `• **Page ${m.page}:** ${m.snippet}`).join("\n\n");
            pageMatches.slice(0, 3).forEach((m) => {
              citations.push({
                page: m.page,
                section: "Obligations",
                title: isContractorSpecific ? "Contractor Duties" : "Contractual Obligations",
                text: m.snippet,
                explanation: "Contractual obligation identified in text.",
              });
            });
          } else {
            aiResponseText = isHindi
              ? `प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।\n\nअनुबंध में कोई विशिष्ट ${isContractorSpecific ? "ठेकेदार के " : ""}दायित्व या शर्तें नहीं मिलीं।`
              : `I could not find this information in the provided document.\n\nNo specific ${isContractorSpecific ? "contractor " : ""}obligations or covenants were identified in the agreement.`;
          }
        }
      }
      // 6. Summarize this document / Overview
      else if (
        q.includes("summar") ||
        q.includes("overview") ||
        q.includes("purpose") ||
        q.includes("about") ||
        q.includes("saransh") ||
        q.includes("विवरण") ||
        q.includes("सारांश")
      ) {
        if (struct) {
          aiResponseText = isHindi
            ? `**कार्यकारी सारांश (Executive Summary):**\n${struct.executive_summary}\n\n**दस्तावेज़ वर्गीकरण:** ${struct.document_type || "व्यावसायिक कानूनी अनुबंध"}\n\n**संबंधित पक्ष (Parties):**\n` +
              struct.parties.map((p) => `• **${p.name}** — ${p.role}${p.notice_address ? ` (${p.notice_address})` : ""}`).join("\n")
            : `**Executive Summary:**\n${struct.executive_summary}\n\n**Document Classification:** ${struct.document_type || "Commercial Legal Agreement"}\n\n**Key Contracting Parties:**\n` +
              struct.parties.map((p) => `• **${p.name}** — ${p.role}${p.notice_address ? ` (${p.notice_address})` : ""}`).join("\n");

          if (struct.important_dates && struct.important_dates.length > 0) {
            aiResponseText += isHindi
              ? `\n\n**मुख्य समय-सीमा (Timeline):**\n` + struct.important_dates.slice(0, 3).map((d) => `• ${d.title}: **${d.date}**`).join("\n")
              : `\n\n**Key Timeline:**\n` + struct.important_dates.slice(0, 3).map((d) => `• ${d.title}: **${d.date}**`).join("\n");
            struct.important_dates.slice(0, 2).forEach((d) => {
              if (d.page) {
                citations.push({
                  page: d.page,
                  title: d.title,
                  text: d.source_text || d.date,
                  explanation: `Dated milestone: ${d.title}`,
                });
              }
            });
          }
        } else if (pages && pages.length > 0) {
          const firstPageText = pages[0]?.text?.trim() || "";
          const excerpt = firstPageText.slice(0, 240).trim();
          aiResponseText = isHindi
            ? `**${activeDoc.name}** के निकाले गए पाठ पर आधारित सारांश:\n\nदस्तावेज़ में ${activeDoc.page_count || pages.length} पृष्ठ हैं।\n\n${excerpt ? `**आरंभिक अंश:**\n> "${excerpt}..."\n\n` : ""}विस्तृत 24-अनुभाग विश्लेषण के लिए ऊपर हेडर में **✦ विश्लेषण** पर क्लिक करें।`
            : `Here is a summary based on extracted text from **${activeDoc.name}**:\n\nThe document spans ${activeDoc.page_count || pages.length} page(s).\n\n${excerpt ? `**Opening Passage:**\n> "${excerpt}..."\n\n` : ""}Click **✦ Analyze** in the header above to generate a comprehensive 24-section legal breakdown.`;
          if (excerpt) {
            citations.push({
              page: 1,
              title: isHindi ? "दस्तावेज़ परिचय" : "Document Introduction",
              text: excerpt,
              explanation: "Opening excerpt from Page 1.",
            });
          }
        } else {
          aiResponseText = isHindi
            ? `**${activeDoc.name}** में ${activeDoc.page_count} पृष्ठ हैं। कानूनी विश्लेषण के लिए ऊपर **✦ विश्लेषण** पर क्लिक करें।`
            : `Here is a summary based on extracted text from **${activeDoc.name}**:\n\nThe document spans ${activeDoc.page_count} page(s). Click **✦ Analyze** in the header above to generate a comprehensive 24-section legal breakdown.`;
        }
      }
      // 7. General contract QA (governing law, confidentiality, dispute resolution, or keyword search)
      else {
        let answered = false;

        if (struct) {
          if (q.includes("law") || q.includes("jurisdiction") || q.includes("court") || q.includes("state") || q.includes("kanoon") || q.includes("न्यायालय") || q.includes("कानून")) {
            if (struct.governing_law?.governing_state_or_nation && struct.governing_law.governing_state_or_nation !== "Not found in the provided document.") {
              aiResponseText = isHindi
                ? `**लागू कानून एवं अधिकार क्षेत्र (Governing Law & Jurisdiction):**\n\n` +
                  `• **लागू कानून:** ${struct.governing_law.governing_state_or_nation}\n` +
                  `• **अधिकार क्षेत्र:** ${struct.jurisdiction?.court_venue || "मानक अधिकार क्षेत्र"}`
                : `**Governing Law & Jurisdiction:**\n\n` +
                  `• **Governing Law:** ${struct.governing_law.governing_state_or_nation}\n` +
                  `• **Jurisdiction & Venue:** ${struct.jurisdiction?.court_venue || "Standard jurisdiction"}`;
              if (struct.governing_law.page) {
                citations.push({
                  page: struct.governing_law.page,
                  section: "Governing Law",
                  title: "Governing Law",
                  text: struct.governing_law.governing_state_or_nation,
                  explanation: struct.governing_law.governing_state_or_nation,
                });
              }
              answered = true;
            }
          } else if (q.includes("confidential") || q.includes("nda") || q.includes("secret") || q.includes("gopneey") || q.includes("गोपनीयता")) {
            if (struct.confidentiality?.duration && struct.confidentiality.duration !== "Not found in the provided document.") {
              aiResponseText = isHindi
                ? `**गोपनीयता की शर्तें (Confidentiality Terms):**\n\n` +
                  `• **दायरा:** ${struct.confidentiality.definition_scope}\n` +
                  `• **अवधि:** ${struct.confidentiality.duration}\n` +
                  `• **मानक अपवाद:** ${struct.confidentiality.standard_exclusions}`
                : `**Confidentiality Terms:**\n\n` +
                  `• **Scope:** ${struct.confidentiality.definition_scope}\n` +
                  `• **Duration:** ${struct.confidentiality.duration}\n` +
                  `• **Standard Exclusions:** ${struct.confidentiality.standard_exclusions}`;
              if (struct.confidentiality.page) {
                citations.push({
                  page: struct.confidentiality.page,
                  section: "Confidentiality",
                  title: "Confidentiality Scope",
                  text: struct.confidentiality.definition_scope,
                  explanation: `Duration: ${struct.confidentiality.duration}`,
                });
              }
              answered = true;
            }
          }
        }

        if (!answered) {
          // Attempt keyword search against document pages
          const cleanQ = q.replace(/[^\w\s-]/g, " ");
          const words = cleanQ
            .split(/\s+/)
            .filter(
              (w) =>
                w.length > 2 &&
                ![
                  "what", "when", "where", "which", "does", "this", "that", "have",
                  "with", "from", "about", "the", "there", "their", "they", "tell", "show",
                  "give", "please", "find", "explain", "here", "also", "then", "than",
                  "will", "would", "could", "contract", "document", "agreement",
                ].includes(w),
            );
          const pageMatches = words.length > 0 ? searchPagesForKeywords(pages, words) : [];

          if (pageMatches.length > 0) {
            aiResponseText = isHindi
              ? `**${activeDoc.name}** के आधार पर संबंधित अंश:\n\n` +
                pageMatches.slice(0, 3).map((m) => `• **पृष्ठ ${m.page}:** ${m.snippet}`).join("\n\n")
              : `Based on **${activeDoc.name}**, here are the relevant passages found:\n\n` +
                pageMatches.slice(0, 3).map((m) => `• **Page ${m.page}:** ${m.snippet}`).join("\n\n");
            pageMatches.slice(0, 3).forEach((m) => {
              citations.push({
                page: m.page,
                title: isHindi ? "दस्तावेज़ संदर्भ" : "Document Reference",
                text: m.snippet,
                explanation: isHindi ? `पृष्ठ ${m.page} पर संबंधित अंश।` : `Passage matching query located on Page ${m.page}.`,
              });
            });
          } else {
            aiResponseText = isHindi
              ? `प्रदान किए गए दस्तावेज़ में यह जानकारी उपलब्ध नहीं है।`
              : `I could not find this information in the provided document.`;
          }
        }
      }

      const aiMsg: MessageData = {
        id: `ai-${Date.now()}`,
        sender: "assistant",
        content: aiResponseText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        citations,
        risk: detectedRisk,
      };

      const finalMessages = [...nextMessages, aiMsg];
      setMessages(finalMessages);
      setIsAiThinking(false);
      activeAiRequestRef.current = null;

      // Save to chat session store
      const session = getChatSession(currentSessionId, userId) || {
        id: currentSessionId,
        title: generateChatTitle(queryText, activeDoc?.name),
        userId,
        documentId: activeDoc?.id || null,
        documentName: activeDoc?.name || null,
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const newTitle =
        session.title === "New Chat" || session.title === "New Consultation"
          ? generateChatTitle(queryText, activeDoc?.name || session.documentName)
          : session.title;

      saveChatSession(
        {
          ...session,
          title: newTitle,
          documentId: activeDoc?.id ?? session.documentId ?? null,
          documentName: activeDoc?.name ?? session.documentName ?? null,
          messages: finalMessages,
        },
        userId,
      );
    }, typeof process !== "undefined" && process.env.NODE_ENV === "test" ? 50 : 550);

    if (activeAiRequestRef.current) {
      activeAiRequestRef.current.timerId = timer;
    }
  };

  const handleCitationClick = (citation: CitationItem) => {
    setInspectedEvidence({
      title: citation.title || "Contract Source Citation",
      source_text: citation.text || "Verbatim reference from document.",
      page: citation.page,
      section: citation.section,
      explanation: citation.explanation,
      action: citation.action,
      severity: citation.severity,
    });
  };

  if (isSessionLoading) {
    return (
      <div className="doc-loading-state" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
        <div>
          <span className="upload-spinner" />
          <p style={{ marginTop: "12px", color: "var(--muted)", fontSize: "14px" }}>
            {language === "hi" ? "बातचीत लोड हो रही है..." : "Loading conversation..."}
          </p>
        </div>
      </div>
    );
  }

  if (sessionNotFound) {
    return (
      <div
        className="doc-empty-state"
        style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "36px" }}>💬</div>
        <h2 style={{ fontSize: "20px", fontWeight: 600, color: "var(--ink)", margin: 0 }}>
          {language === "hi" ? "बातचीत नहीं मिली" : "Conversation not found"}
        </h2>
        <p style={{ fontSize: "14px", color: "var(--muted)", maxWidth: "420px", margin: 0 }}>
          {language === "hi" ? "यह चैट सत्र मौजूद नहीं है या हटाया जा चुका है।" : "This chat session does not exist or may have been deleted."}
        </p>
        <button
          type="button"
          className="primary-button-modern"
          onClick={handleStartNewChat}
          style={{ marginTop: "8px" }}
        >
          <PlusIcon size={16} />
          <span>{language === "hi" ? "नई चैट शुरू करें" : "Start New Chat"}</span>
        </button>
      </div>
    );
  }

  const showEmptyState = !activeDoc && messages.length === 0;

  const currentEmptyChips = language === "hi"
    ? [
        { label: "मुख्य दायित्वों का सारांश", query: "कृपया प्रत्येक पक्ष के मुख्य दायित्वों और प्रदर्शन कर्तव्यों का सारांश दें।" },
        { label: "देनदारी जोखिमों की पहचान", query: "इस अनुबंध में सबसे महत्वपूर्ण देनदारी जोखिम, क्षतिपूर्ति या एकतरफा शर्तें क्या हैं?" },
        { label: "समाप्ति खंड निकालें", query: "सभी समाप्ति खंडों, नोटिस अवधि और समाप्ति के बाद के कर्तव्यों की समीक्षा करें।" },
        { label: "अनुपालन शर्तों की जाँच", query: "लागू कानून, विवाद समाधान और विनियामक आवश्यकताओं की जाँच करें।" },
      ]
    : EMPTY_STATE_CHIPS;

  const currentDocChips = language === "hi"
    ? [
        "इस दस्तावेज़ का सारांश",
        "भुगतान की शर्तें क्या हैं?",
        "समाप्ति खंड खोजें",
        "प्रमुख जोखिम क्या हैं?",
        "ठेकेदार के क्या दायित्व हैं?",
        "क्या कोई परिनिर्धारित क्षतिपूर्ति (Liquidated Damages) है?",
      ]
    : DOC_SUGGESTION_CHIPS;

  return (
    <div className="chat-workspace-root">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFileUpload(f);
          e.target.value = "";
        }}
        accept=".pdf,.docx,.txt"
        style={{ display: "none" }}
        aria-label="Upload legal document"
      />

      {/* When NO document is selected / clean empty state */}
      {showEmptyState ? (
        <div
          className={`chat-empty-state-container ${isDragOver ? "drag-over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {deletedNotice && (
            <div
              className="auth-error-banner"
              role="status"
              style={{
                backgroundColor: "#2d2417",
                borderColor: "#78561d",
                color: "#f8e3a2",
                maxWidth: "540px",
                margin: "0 auto 16px",
              }}
            >
              <span>{deletedNotice}</span>
              <button type="button" className="dismiss-btn" onClick={() => setDeletedNotice(null)}>
                ×
              </button>
            </div>
          )}

          <div className="empty-state-header">
            <div className="empty-state-badge">
              <SparklesIcon size={14} className="text-blue-400" />
              <span>{language === "hi" ? "लीगल एआई दस्तावेज़ कोपायलट" : "LegalAI Document Copilot"}</span>
            </div>
            <h1 className="empty-state-title">
              {language === "hi" ? "मैं आपके कानूनी दस्तावेज़ में क्या सहायता कर सकता हूँ?" : "How can I help with your legal document?"}
            </h1>
            <p className="empty-state-subtitle">
              {language === "hi" ? "आरंभ करने के लिए एक दस्तावेज़ अपलोड करें या अपने कार्यक्षेत्र से चुनें।" : "Upload a document or select one from your workspace to get started."}
            </p>
          </div>

          {/* Central Upload Card */}
          <div
            className="upload-dropzone-card"
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            aria-label="Upload document dropzone"
          >
            <div className="upload-icon-circle">
              <UploadCloudIcon size={24} />
            </div>
            <div className="upload-text-group">
              <strong>{isUploading ? (language === "hi" ? "सत्यापन एवं अपलोडिंग..." : "Validating & Uploading...") : (language === "hi" ? "कानूनी दस्तावेज़ अपलोड करें" : "Upload Legal Document")}</strong>
              <small>{language === "hi" ? "समर्थित: PDF, DOCX, TXT" : "Supported: PDF, DOCX, TXT"}</small>
            </div>
          </div>

          {uploadError && (
            <div className="auth-error-banner" role="alert" style={{ maxWidth: "520px", margin: "14px auto" }}>
              <span>{uploadError}</span>
            </div>
          )}

          {(() => {
            const availableDocs = documents.filter((d) => d && d.id && !isDocumentDeleted(d.id));
            if (availableDocs.length === 0) return null;
            return (
              <div
                className="empty-state-workspace-picker"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  margin: "-12px auto 20px",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                  {language === "hi" ? "या कार्यक्षेत्र से चुनें:" : "or choose from workspace:"}
                </span>
                <select
                  aria-label="Choose existing document"
                  className="doc-switcher-select"
                  defaultValue=""
                  onChange={(e) => {
                    const found = availableDocs.find((d) => d.id === e.target.value);
                    if (found) handleSelectDocument(found);
                  }}
                >
                  <option value="" disabled>
                    {language === "hi" ? "दस्तावेज़ चुनें..." : "Select a document..."}
                  </option>
                  {availableDocs.map((d) => (
                    <option key={d.id} value={d.id}>
                      📄 {d.name} ({d.page_count}p)
                    </option>
                  ))}
                </select>
              </div>
            );
          })()}

          {/* Quick prompt chips */}
          <div className="suggested-chips-section">
            <div className="chips-grid">
              {currentEmptyChips.map((chip, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="prompt-chip"
                  onClick={() => {
                    fileInputRef.current?.click();
                  }}
                >
                  <SparklesIcon size={12} className="text-blue-400" />
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* When a document IS selected -> Conversational AI Workspace */
        <div className="chat-conversation-layout">
          {/* Top context bar */}
          <DocumentContextBar
            activeDoc={activeDoc}
            documents={documents}
            onSelectDoc={handleSelectDocument}
            sessionId={propSessionId}
          />

          {deletedNotice && (
            <div
              className="auth-error-banner"
              role="status"
              style={{
                backgroundColor: "#2d2417",
                borderColor: "#78561d",
                color: "#f8e3a2",
                margin: "8px 16px",
              }}
            >
              <span>{deletedNotice}</span>
              <button type="button" className="dismiss-btn" onClick={() => setDeletedNotice(null)}>
                ×
              </button>
            </div>
          )}

          {/* Chat message timeline */}
          <div className="chat-messages-scroll-area">
            <div className="chat-messages-inner">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  onCitationClick={handleCitationClick}
                />
              ))}

              {isAiThinking && (
                <div className="chat-message-row assistant-row">
                  <div className="assistant-avatar">
                    <SparklesIcon size={16} />
                  </div>
                  <div className="assistant-thinking-bubble">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                    <span className="thinking-text">
                      {language === "hi" ? "दस्तावेज़ खंडों और संदर्भों की समीक्षा की जा रही है..." : "Reviewing document clauses & citations..."}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Suggested quick prompt chips for active doc */}
          {activeDoc && (
            <div className="active-doc-chips-row">
              {currentDocChips.map((chipText, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="mini-chip"
                  onClick={() => handleSendMessage(chipText)}
                  disabled={isAiThinking}
                >
                  <span>{chipText}</span>
                </button>
              ))}
            </div>
          )}

          {/* Chat input footer */}
          <div className="chat-footer-dock">
            <ChatInput
              onSendMessage={handleSendMessage}
              onStop={handleStop}
              isLoading={isAiThinking}
              activeDocName={activeDoc?.name}
              placeholder={
                activeDoc
                  ? (language === "hi" ? "इस दस्तावेज़ के बारे में कुछ भी पूछें..." : "Ask anything about this document...")
                  : (language === "hi" ? "कानूनी प्रश्न पूछें या दस्तावेज़ अपलोड करें..." : "Ask a legal question or upload a document...")
              }
              onAttachClick={() => fileInputRef.current?.click()}
            />
          </div>
        </div>
      )}

      {/* Grounded Citation / Evidence Inspector Modal */}
      <EvidenceModal
        evidence={inspectedEvidence}
        onClose={() => setInspectedEvidence(null)}
        onJumpToDocument={activeDoc ? (page) => {
          window.location.href = `/documents/${activeDoc.id}#page-${page}`;
          router.push(`/documents/${activeDoc.id}#page-${page}`);
        } : undefined}
      />

      {/* Password Prompt Modal for Encrypted PDFs */}
      <PasswordPromptModal
        isOpen={!!passwordPromptDoc}
        document={passwordPromptDoc}
        onSuccess={handlePasswordUnlockSuccess}
        onCancel={() => setPasswordPromptDoc(null)}
      />
    </div>
  );
}
