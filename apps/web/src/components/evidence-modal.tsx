"use client";

import { useEffect } from "react";
import { CheckCircleIcon, CopyIcon, FileTextIcon, XIcon } from "./icons";
import { useLanguage } from "@/lib/language-context";

export interface EvidenceData {
  title: string;
  source_text: string;
  page?: number | null;
  section?: string | null;
  confidence?: number | null;
  explanation?: string | null;
  action?: string | null;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

interface EvidenceModalProps {
  evidence: EvidenceData | null;
  onClose: () => void;
  onJumpToDocument?: (page: number) => void;
}

export function EvidenceModal({ evidence, onClose, onJumpToDocument }: EvidenceModalProps) {
  const { t, language } = useLanguage();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!evidence) return null;

  const handleCopySnippet = () => {
    if (evidence.source_text) {
      navigator.clipboard.writeText(evidence.source_text);
    }
  };

  return (
    <div
      className="evidence-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="evidence-modal-title"
    >
      <div
        className="evidence-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "680px", borderRadius: "16px", overflow: "hidden" }}
      >
        <div className="evidence-modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "grid", placeItems: "center", width: "32px", height: "32px", borderRadius: "8px", background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa" }}>
              <FileTextIcon size={18} />
            </span>
            <div>
              <span className="eyebrow" style={{ fontSize: "10px", letterSpacing: "0.08em", color: "#60a5fa" }}>
                {t("evidence.eyebrow")}
              </span>
              <h2 id="evidence-modal-title" style={{ margin: "2px 0 0", fontSize: "16px", fontWeight: 600, color: "var(--ink)" }}>
                {evidence.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="close-modal-btn"
            onClick={onClose}
            aria-label="Close evidence inspector"
            style={{ borderRadius: "8px", padding: "6px" }}
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="evidence-modal-body" style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Metadata badges */}
          <div className="evidence-citation-meta" style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
            {evidence.page && (
              <span style={{ padding: "4px 10px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--blue)", fontSize: "11px", fontWeight: 600 }}>
                {t("evidence.page_badge", { page: evidence.page })}
              </span>
            )}
            {evidence.section && (
              <span style={{ padding: "4px 10px", borderRadius: "6px", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--blue)", fontSize: "11px", fontWeight: 600 }}>
                {t("evidence.section_badge", { section: evidence.section })}
              </span>
            )}
            {evidence.severity && (
              <span className={`risk-pill severity-${evidence.severity.toLowerCase()}`}>
                {evidence.severity} {language === "hi" ? "जोखिम" : "RISK"}
              </span>
            )}
            {typeof evidence.confidence === "number" && (
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--muted)" }}>
                {t("evidence.confidence", { pct: (evidence.confidence * 100).toFixed(0) })}
              </span>
            )}
          </div>

          {/* Verbatim snippet */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {t("evidence.verbatim_title")}
              </span>
              <button
                type="button"
                onClick={handleCopySnippet}
                style={{ display: "flex", alignItems: "center", gap: "5px", background: "transparent", border: 0, color: "#60a5fa", fontSize: "11px", cursor: "pointer" }}
              >
                <CopyIcon size={13} /> {t("evidence.copy_excerpt")}
              </button>
            </div>
            <div className="verbatim-evidence-container" style={{ borderRadius: "10px" }}>
              <blockquote className="evidence-blockquote">
                &ldquo;{evidence.source_text || "Source text referenced from document."}&rdquo;
              </blockquote>
            </div>
          </div>

          {/* Explanation */}
          {evidence.explanation && (
            <div className="evidence-analysis-box" style={{ background: "var(--card-bg-subtle)", padding: "14px 16px", borderRadius: "10px", border: "1px solid var(--line)" }}>
              <strong style={{ color: "var(--ink)", fontSize: "12px", marginBottom: "4px" }}>
                {t("evidence.analysis_title")}
              </strong>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", lineHeight: 1.6 }}>
                {evidence.explanation}
              </p>
            </div>
          )}

          {/* Action Recommendation */}
          {evidence.action && (
            <div style={{ display: "flex", gap: "10px", alignItems: "flex-start", background: "rgba(59, 130, 246, 0.08)", padding: "12px 16px", borderRadius: "10px", border: "1px solid rgba(59, 130, 246, 0.2)" }}>
              <span style={{ color: "#60a5fa", marginTop: "2px" }}>
                <CheckCircleIcon size={16} />
              </span>
              <div>
                <strong style={{ display: "block", fontSize: "12px", color: "#93c5fd", marginBottom: "2px" }}>
                  {t("evidence.recommended_action")}
                </strong>
                <p style={{ margin: 0, fontSize: "12px", color: "#bfdbfe", lineHeight: 1.5 }}>
                  {evidence.action}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="evidence-modal-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--modal-nav-bg)", borderTop: "1px solid var(--line)", padding: "12px 24px" }}>
          {evidence.page && onJumpToDocument ? (
            <button
              type="button"
              onClick={() => {
                onJumpToDocument(evidence.page!);
                onClose();
              }}
              className="primary-button"
              style={{ padding: "8px 16px", fontSize: "12px", borderRadius: "8px", cursor: "pointer" }}
            >
              {t("evidence.open_viewer", { page: evidence.page })}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "1px solid var(--line)", color: "var(--muted)", padding: "8px 16px", fontSize: "12px", borderRadius: "8px", cursor: "pointer" }}
          >
            {t("evidence.dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}

