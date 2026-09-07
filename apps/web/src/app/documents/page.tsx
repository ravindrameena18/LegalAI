"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { DeleteConfirmModal } from "@/components/delete-confirm-modal";
import { DocumentRow } from "@/components/document-row";
import { PlusIcon, SearchIcon, SparklesIcon, UploadCloudIcon } from "@/components/icons";
import { PasswordPromptModal } from "@/components/password-prompt-modal";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import { handleDocumentDeletedInChatStore } from "@/lib/chat-store";
import {
  ApiError,
  deleteDocument,
  getDocumentDownloadUrl,
  listDocuments,
  triggerDocumentAnalysis,
  uploadDocument,
  type DocumentDetail,
  type DocumentItem,
} from "@/lib/api-client";

export default function DocumentsPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [passwordPromptDoc, setPasswordPromptDoc] = useState<DocumentItem | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        const notice = params.get("notice");
        if (notice) setNoticeMessage(notice);
      } catch {}
    }
  }, []);

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filters & Search
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "pdf" | "docx" | "txt" | "ready" | "processing">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

  // Uploading state
  const [isUploading, setIsUploading] = useState(false);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    listDocuments()
      .then((data) => {
        if (isMounted) setDocuments(data);
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(
            err instanceof ApiError
              ? err.detail
              : err instanceof Error
                ? err.message
                : "Failed to load documents.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  // Listen for document deletion events from other parts of the UI
  useEffect(() => {
    const handleDocDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name: string }>;
      const deletedId = customEvent.detail?.id;
      if (deletedId) {
        setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
      }
    };
    window.addEventListener("legalai:document-deleted", handleDocDeleted);
    return () => window.removeEventListener("legalai:document-deleted", handleDocDeleted);
  }, []);

  const handleUploadClick = () => {
    setError(null);
    setSuccessMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";

    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (![".pdf", ".docx", ".txt"].includes(ext)) {
      setError(`Unsupported file format '${ext}'. Please choose a PDF, DOCX, or TXT document.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError("File exceeds the 25 MB maximum size limit.");
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const newDoc = await uploadDocument(file);
      setDocuments((prev) => [newDoc, ...prev]);
      if (newDoc.processing_status === "password_required") {
        setPasswordPromptDoc(newDoc);
      } else {
        setSuccessMessage(`Document "${newDoc.name}" uploaded successfully.`);
      }
    } catch (err: unknown) {
      setError(
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
    setDocuments((prev) =>
      prev.map((d) => (d.id === unlockedDoc.id ? { ...d, ...unlockedDoc } : d))
    );
    setSuccessMessage(`Document "${unlockedDoc.name}" unlocked and processed successfully.`);
  };

  const handleAnalyze = (docId: string) => {
    setAnalyzingDocId(docId);
    router.push(`/analysis?document_id=${docId}&auto=true`);
  };

  const handleDeleteTrigger = (docId: string, name: string) => {
    setDeleteTarget({ id: docId, name });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    setNoticeMessage(null);

    try {
      await deleteDocument(deleteTarget.id);

      // Immediately update local UI
      setDocuments((prev) => prev.filter((d) => d.id !== deleteTarget.id));

      // Clean up chat session mappings
      handleDocumentDeletedInChatStore(deleteTarget.id, user?.id || "guest");

      // Notify other components (AppShell sidebar, chat workspace, selectors)
      window.dispatchEvent(
        new CustomEvent("legalai:document-deleted", {
          detail: { id: deleteTarget.id, name: deleteTarget.name },
        }),
      );

      setSuccessMessage("Document deleted successfully.");
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to delete document. Please try again.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Filter & search logic
  const filteredDocuments = useMemo(() => {
    return documents
      .filter((doc) => {
        // Search filter
        if (search.trim() && !doc.name.toLowerCase().includes(search.trim().toLowerCase())) {
          return false;
        }
        // Category tab filter
        if (filterTab === "pdf") return doc.file_type.toLowerCase() === "pdf";
        if (filterTab === "docx") return doc.file_type.toLowerCase() === "docx";
        if (filterTab === "txt") return doc.file_type.toLowerCase() === "txt";
        if (filterTab === "ready") return doc.processing_status.toLowerCase() === "ready";
        if (filterTab === "processing") return doc.processing_status.toLowerCase() === "processing";
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "name") return a.name.localeCompare(b.name);
        if (sortBy === "oldest") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [documents, search, filterTab, sortBy]);

  return (
    <AppShell>
      <div className="doc-library-container">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".pdf,.docx,.txt"
          style={{ display: "none" }}
          aria-label="Upload document file input"
        />

        {/* Top Header */}
        <div className="doc-library-header">
          <div>
            <span className="eyebrow">{language === "hi" ? "दस्तावेज़ इंटेलिजेंस" : "Document Intelligence"}</span>
            <h1 className="library-title">{language === "hi" ? "दस्तावेज़" : "Documents"}</h1>
            <p className="library-subtitle">
              {language === "hi"
                ? "कानूनी विश्लेषण, जोखिम पहचान और तुलना के लिए दस्तावेज़ प्रबंधित करें।"
                : "Manage, search, and run Gemini AI analysis across your legal agreements and evidence."}
            </p>
          </div>

          <div className="library-header-actions">
            <button
              type="button"
              className="primary-button-modern"
              onClick={handleUploadClick}
              disabled={isUploading}
            >
              <PlusIcon size={16} />
              <span>
                {isUploading
                  ? (language === "hi" ? "अपलोड हो रहा है..." : "Uploading...")
                  : (language === "hi" ? "दस्तावेज़ अपलोड करें" : "Upload Document")}
              </span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {noticeMessage && (
          <div className="auth-error-banner" role="status" style={{ backgroundColor: "#2d2417", borderColor: "#78561d", color: "#f8e3a2" }}>
            <span>{noticeMessage}</span>
            <button type="button" className="dismiss-btn" onClick={() => setNoticeMessage(null)}>
              ×
            </button>
          </div>
        )}
        {error && (
          <div className="auth-error-banner" role="alert">
            <span>{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="upload-success-banner" role="status">
            <span>{successMessage}</span>
            <button type="button" className="dismiss-btn" onClick={() => setSuccessMessage(null)}>
              ×
            </button>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="doc-library-toolbar">
          <div className="toolbar-search-wrap">
            <SearchIcon size={15} className="toolbar-search-icon" />
            <input
              type="text"
              placeholder={language === "hi" ? "नाम से दस्तावेज़ खोजें..." : "Search documents by name..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="toolbar-search-input"
            />
            {search && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter tabs */}
          <div className="toolbar-filter-tabs">
            <button
              type="button"
              className={`filter-tab ${filterTab === "all" ? "active" : ""}`}
              onClick={() => setFilterTab("all")}
            >
              {language === "hi" ? "सभी" : "All"} ({documents.length})
            </button>
            <button
              type="button"
              className={`filter-tab ${filterTab === "pdf" ? "active" : ""}`}
              onClick={() => setFilterTab("pdf")}
            >
              PDF
            </button>
            <button
              type="button"
              className={`filter-tab ${filterTab === "docx" ? "active" : ""}`}
              onClick={() => setFilterTab("docx")}
            >
              DOCX
            </button>
            <button
              type="button"
              className={`filter-tab ${filterTab === "ready" ? "active" : ""}`}
              onClick={() => setFilterTab("ready")}
            >
              {language === "hi" ? "तैयार" : "Ready"}
            </button>
          </div>

          {/* Sort Selector */}
          <div className="toolbar-sort-wrap">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name")}
              className="toolbar-sort-select"
              aria-label="Sort documents"
            >
              <option value="newest">{language === "hi" ? "नवीनतम पहले" : "Newest first"}</option>
              <option value="oldest">{language === "hi" ? "पुरातन पहले" : "Oldest first"}</option>
              <option value="name">{language === "hi" ? "वर्णानुक्रम (A-Z)" : "Alphabetical"}</option>
            </select>
          </div>
        </div>

        {/* Documents Content */}
        {isLoading ? (
          <div className="doc-loading-state">
            <span className="upload-spinner" />
            <p>{language === "hi" ? "दस्तावेज़ लोड हो रहे हैं..." : "Loading document library..."}</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="doc-empty-state">
            <div className="empty-icon">📄</div>
            <h3>
              {search
                ? (language === "hi" ? "कोई मेल खाता दस्तावेज़ नहीं मिला" : "No matching documents")
                : (language === "hi" ? "कोई दस्तावेज़ नहीं मिला" : "No documents found")}
            </h3>
            <p>
              {search
                ? (language === "hi" ? `"${search}" से कोई दस्तावेज़ मेल नहीं खाता।` : `No documents matched "${search}". Try adjusting your search query or filter.`)
                : (language === "hi" ? "शुरू करने के लिए PDF, DOCX या TXT प्रारूप में अनुबंध या समझौते अपलोड करें।" : "Upload contracts, NDAs, or agreements in PDF, DOCX, or TXT format to begin.")}
            </p>
            {!search && (
              <button
                type="button"
                className="primary-button-modern"
                onClick={handleUploadClick}
                style={{ margin: "0 auto" }}
              >
                <PlusIcon size={16} />
                <span>{language === "hi" ? "पहला दस्तावेज़ अपलोड करें" : "Upload First Document"}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="doc-library-list">
            {filteredDocuments.map((doc) => (
              <DocumentRow
                key={doc.id}
                document={doc}
                onAnalyze={handleAnalyze}
                onDelete={handleDeleteTrigger}
                onUnlock={(d) => setPasswordPromptDoc(d)}
                downloadUrl={getDocumentDownloadUrl(doc.id)}
                isAnalyzing={analyzingDocId === doc.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Destructive Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        documentName={deleteTarget?.name || ""}
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          if (!isDeleting) setDeleteTarget(null);
        }}
      />

      {/* Password Prompt Modal for Encrypted PDFs */}
      <PasswordPromptModal
        isOpen={!!passwordPromptDoc}
        document={passwordPromptDoc}
        onSuccess={handlePasswordUnlockSuccess}
        onCancel={() => setPasswordPromptDoc(null)}
      />
    </AppShell>
  );
}