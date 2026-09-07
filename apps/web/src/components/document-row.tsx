"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DownloadIcon,
  FileTextIcon,
  LockIcon,
  MoreHorizontalIcon,
  SparklesIcon,
  TrashIcon,
} from "./icons";
import { useLanguage } from "@/lib/language-context";
import type { DocumentItem } from "@/lib/api-client";

interface DocumentRowProps {
  document: DocumentItem;
  onAnalyze: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onUnlock?: (doc: DocumentItem) => void;
  downloadUrl: string;
  isAnalyzing?: boolean;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return isoString;
  }
}

export function DocumentRow({
  document,
  onAnalyze,
  onDelete,
  onUnlock,
  downloadUrl,
  isAnalyzing = false,
}: DocumentRowProps) {
  const { language, t } = useLanguage();
  const isReady = document.processing_status === "ready";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or escape key
  useEffect(() => {
    if (!menuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };

    window.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="doc-item-row">
      <div className="doc-item-main">
        <div className="doc-item-icon-wrap">
          <FileTextIcon size={18} className="doc-icon-svg" />
          <span className={`format-badge format-${document.file_type.toLowerCase()}`}>
            {document.file_type.toUpperCase()}
          </span>
        </div>

        <div className="doc-item-details">
          <Link href={`/documents/${document.id}`} className="doc-item-title">
            {document.name}
          </Link>
          <div className="doc-item-submeta">
            <span>{document.page_count} {document.page_count === 1 ? (language === "hi" ? "पृष्ठ" : "page") : (language === "hi" ? "पृष्ठ" : "pages")}</span>
            <span className="dot-sep">•</span>
            <span>{formatBytes(document.file_size)}</span>
            <span className="dot-sep">•</span>
            <span>{language === "hi" ? `अपलोड किया गया: ${formatDate(document.created_at)}` : `Uploaded ${formatDate(document.created_at)}`}</span>
          </div>
        </div>
      </div>

      <div className="doc-item-status-wrap">
        <span className={`status-pill status-${document.processing_status.toLowerCase()}`}>
          {document.processing_status === "password_required" ? (
            <>
              <LockIcon size={12} className="inline mr-1" />
              {language === "hi" ? "पासवर्ड आवश्यक" : "Password Required"}
            </>
          ) : document.processing_status === "ocr_required" ? (
            language === "hi" ? "ओसीआर आवश्यक" : "OCR Required"
          ) : document.processing_status === "ready" ? (
            language === "hi" ? "तैयार" : "READY"
          ) : (
            document.processing_status.toUpperCase()
          )}
        </span>
      </div>

      <div className="doc-item-actions">
        {/* [Unlock] */}
        {document.processing_status === "password_required" && onUnlock && (
          <button
            type="button"
            className="doc-row-action-btn unlock-btn"
            onClick={() => onUnlock(document)}
            title={language === "hi" ? "पासवर्ड-सुरक्षित PDF अनलॉक करें" : "Unlock password-protected PDF"}
            aria-label={`Unlock ${document.name}`}
          >
            <LockIcon size={12} />
            <span>{language === "hi" ? "अनलॉक" : "Unlock"}</span>
          </button>
        )}

        {/* [Open] */}
        <Link
          href={`/documents/${document.id}`}
          className="doc-row-action-btn view-btn"
          title={language === "hi" ? "दस्तावेज़ खोलें" : "Open document"}
          aria-label={`Open ${document.name}`}
        >
          <span>{language === "hi" ? "खोलें" : "Open"}</span>
        </Link>

        {/* [Download] */}
        <a
          href={downloadUrl}
          download={document.name}
          className="doc-row-action-btn download-btn"
          title={language === "hi" ? "मूल फ़ाइल डाउनलोड करें" : "Download original file"}
          aria-label={`Download ${document.name}`}
        >
          <DownloadIcon size={12} />
          <span>{language === "hi" ? "डाउनलोड" : "Download"}</span>
        </a>

        {/* [✦ Analyze] */}
        {isReady && (
          <button
            type="button"
            className="doc-row-action-btn analyze-btn"
            onClick={() => onAnalyze(document.id)}
            disabled={isAnalyzing}
            title={language === "hi" ? "Google Gemini AI के साथ विश्लेषण करें" : "Analyze with Google Gemini AI"}
            aria-label={`Analyze ${document.name}`}
          >
            <SparklesIcon size={12} />
            <span>{isAnalyzing ? (language === "hi" ? "विश्लेषण हो रहा है..." : "Analyzing...") : (language === "hi" ? "✦ विश्लेषण" : "✦ Analyze")}</span>
          </button>
        )}

        {/* [•••] Action Menu */}
        <div className="doc-row-menu-container" ref={menuRef}>
          <button
            type="button"
            className={`doc-row-action-btn more-btn ${menuOpen ? "active" : ""}`}
            onClick={() => setMenuOpen(!menuOpen)}
            title={language === "hi" ? "अधिक विकल्प" : "More actions"}
            aria-label={language === "hi" ? `${document.name} के लिए अधिक विकल्प` : `More actions for ${document.name}`}
            aria-expanded={menuOpen}
          >
            <MoreHorizontalIcon size={15} />
          </button>

          {menuOpen && (
            <div className="doc-row-dropdown-menu" role="menu">
              {document.processing_status === "password_required" && onUnlock && (
                <button
                  type="button"
                  className="dropdown-item text-amber-400"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onUnlock(document);
                  }}
                >
                  <LockIcon size={14} />
                  <span>{language === "hi" ? "अनलॉक" : "Unlock"}</span>
                </button>
              )}

              <Link
                href={`/documents/${document.id}`}
                className="dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <FileTextIcon size={14} />
                <span>{language === "hi" ? "खोलें" : "Open"}</span>
              </Link>

              {isReady && (
                <button
                  type="button"
                  className="dropdown-item"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onAnalyze(document.id);
                  }}
                  disabled={isAnalyzing}
                >
                  <SparklesIcon size={14} className="text-blue-400" />
                  <span>{language === "hi" ? "विश्लेषण" : "Analyze"}</span>
                </button>
              )}

              <a
                href={downloadUrl}
                download={document.name}
                className="dropdown-item"
                role="menuitem"
                onClick={() => setMenuOpen(false)}
              >
                <DownloadIcon size={14} />
                <span>{language === "hi" ? "डाउनलोड" : "Download"}</span>
              </a>

              <div className="dropdown-divider" role="separator" />

              <button
                type="button"
                className="dropdown-item destructive"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(document.id, document.name);
                }}
              >
                <TrashIcon size={14} />
                <span>{language === "hi" ? "हटाएं" : "Delete"}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
