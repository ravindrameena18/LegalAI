"use client";

import Link from "next/link";
import { ChevronDownIcon, FileTextIcon, SparklesIcon } from "./icons";
import type { DocumentItem } from "@/lib/api-client";
import { isDocumentDeleted } from "@/lib/document-store";
import { useLanguage } from "@/lib/language-context";

interface DocumentContextBarProps {
  activeDoc: DocumentItem | null;
  documents: DocumentItem[];
  onSelectDoc: (doc: DocumentItem) => void;
  onAnalyzeClick?: () => void;
  isAnalyzing?: boolean;
  sessionId?: string;
}

export function DocumentContextBar({
  activeDoc,
  documents,
  onSelectDoc,
  onAnalyzeClick,
  isAnalyzing = false,
  sessionId,
}: DocumentContextBarProps) {
  const { t, isHindi } = useLanguage();
  if (!activeDoc || isDocumentDeleted(activeDoc.id)) return null;

  const availableDocs = documents.filter((d) => d && d.id && !isDocumentDeleted(d.id));

  return (
    <div className="doc-context-bar">
      <div className="doc-context-left">
        <div className="doc-context-avatar">
          <FileTextIcon size={16} />
        </div>
        <div className="doc-context-info">
          <div className="doc-context-title-wrap">
            <span className="doc-context-name" title={activeDoc.name}>
              {activeDoc.name}
            </span>
            <span className="doc-context-meta">
              {activeDoc.page_count} {activeDoc.page_count === 1 ? (isHindi ? "पृष्ठ" : "page") : (isHindi ? "पृष्ठ" : "pages")} · {activeDoc.file_type.toUpperCase()}
            </span>
            <span className={`status-pill status-${activeDoc.processing_status.toLowerCase()}`}>
              {activeDoc.processing_status === "ready"
                ? (isHindi ? "तैयार" : "READY")
                : activeDoc.processing_status === "processing"
                  ? (isHindi ? "प्रसंस्करण जारी" : "PROCESSING")
                  : activeDoc.processing_status === "password_required"
                    ? (isHindi ? "पासवर्ड आवश्यक" : "PASSWORD REQUIRED")
                    : activeDoc.processing_status.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      <div className="doc-context-actions">
        {availableDocs.length > 1 && (
          <div className="doc-switcher-dropdown">
            <select
              aria-label={t("chat.switch_doc")}
              value={activeDoc.id}
              onChange={(e) => {
                const found = availableDocs.find((d) => d.id === e.target.value);
                if (found) onSelectDoc(found);
              }}
              className="doc-switcher-select"
            >
              {availableDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  📄 {d.name} ({d.page_count}p)
                </option>
              ))}
            </select>
          </div>
        )}

        <Link
          href={`/analysis?document_id=${activeDoc.id}${sessionId ? `&session_id=${sessionId}` : ""}&auto=true`}
          className="context-action-btn-primary"
          title={isHindi ? "AI कानूनी विश्लेषण कार्यक्षेत्र खोलें" : "Open AI legal analysis workspace"}
        >
          <SparklesIcon size={13} />
          <span>✦ {isHindi ? "विश्लेषण" : "Analyze"}</span>
        </Link>
      </div>
    </div>
  );
}

