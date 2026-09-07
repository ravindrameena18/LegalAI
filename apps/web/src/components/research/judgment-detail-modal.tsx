"use client";

import { useEffect, useState } from "react";
import { type CaseLawItem } from "@/lib/legal-research-service";
import {
  BookmarkCheckIcon,
  BookmarkIcon,
  CopyIcon,
  DownloadIcon,
  FileTextIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "../icons";

interface JudgmentDetailModalProps {
  caseItem: CaseLawItem | null;
  onClose: () => void;
  onSave?: (item: CaseLawItem) => void;
  isSaved?: boolean;
  onGenerateBrief?: (item: CaseLawItem) => void;
}

type TabKey =
  | "overview"
  | "facts_issues"
  | "reasoning_ratio"
  | "precedents_statutes"
  | "paragraphs";

export function JudgmentDetailModal({
  caseItem,
  onClose,
  onSave,
  isSaved = false,
  onGenerateBrief,
}: JudgmentDetailModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!caseItem) return null;

  const handleCopyCitation = () => {
    navigator.clipboard.writeText(`${caseItem.title}, ${caseItem.citation}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSummary = () => {
    const content = `
${caseItem.title}
Citation: ${caseItem.citation}
Court: ${caseItem.court}
Judgment Date: ${caseItem.judgmentDate}
Bench: ${caseItem.bench}

CASE OVERVIEW
${caseItem.summary}

RATIO DECIDENDI
${caseItem.ratioDecidendi}

FACTS
${caseItem.facts}

ISSUES FRAMED
${(caseItem.issues || []).map((issue, idx) => `${idx + 1}. ${issue}`).join("\n")}

ARGUMENTS OF APPELLANT
${(caseItem.argumentsAppellant || []).map((arg) => `* ${arg}`).join("\n")}

ARGUMENTS OF RESPONDENT
${(caseItem.argumentsRespondent || []).map((arg) => `* ${arg}`).join("\n")}

COURT'S REASONING
${caseItem.reasoning || ""}

DECISION / OPERATIVE ORDER
${caseItem.decision || ""}

SECTIONS / ACTS REFERRED
${(caseItem.sectionsReferred || []).map((s) => `* ${s}`).join("\n")}

CASES REFERRED
${(caseItem.casesReferred || []).map((c) => `* ${c}`).join("\n")}

SOURCE
${caseItem.source}
    `.trim();

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${caseItem.title.replace(/[^a-z0-9]/gi, "_")}_Summary.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="evidence-modal-backdrop research-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="judgment-modal-title"
    >
      <div
        className="evidence-modal research-judgment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="research-modal-header">
          <div className="research-modal-header-left">
            <span className="research-badge-court">
              <ScaleIcon size={14} />
              {caseItem.court}
            </span>
            <span className="research-badge-citation">{caseItem.citation}</span>
            <span className="research-badge-year">{caseItem.year}</span>
          </div>
          <div className="research-modal-header-actions">
            <button
              type="button"
              className="research-icon-btn"
              onClick={handleCopyCitation}
              title="Copy Citation"
              aria-label="Copy Citation"
            >
              <CopyIcon size={16} />
              <span>{copied ? "Copied!" : "Copy"}</span>
            </button>
            <button
              type="button"
              className="research-icon-btn"
              onClick={handleDownloadSummary}
              title="Download Summary"
              aria-label="Download Summary"
            >
              <DownloadIcon size={16} />
              <span>Summary</span>
            </button>
            {onSave && (
              <button
                type="button"
                className={`research-icon-btn ${isSaved ? "active" : ""}`}
                onClick={() => onSave(caseItem)}
                title={isSaved ? "Saved to Library" : "Save Case"}
                aria-label="Save Case"
              >
                {isSaved ? <BookmarkCheckIcon size={16} /> : <BookmarkIcon size={16} />}
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>
            )}
            <button
              type="button"
              className="modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <XIcon size={18} />
            </button>
          </div>
        </div>

        {/* Title Bar */}
        <div className="research-judgment-title-bar">
          <h2 id="judgment-modal-title" className="research-judgment-heading">
            {caseItem.title}
          </h2>
          <div className="research-judgment-meta">
            {caseItem.caseNumber && <span>Case No: {caseItem.caseNumber}</span>}
            <span>•</span>
            <span>Date: {caseItem.judgmentDate}</span>
            <span>•</span>
            <span>Bench: {caseItem.bench}</span>
          </div>
          {caseItem.relevanceExplanation && (
            <div className="research-relevance-callout">
              <SparklesIcon size={15} />
              <span><strong>Precedent Relevance:</strong> {caseItem.relevanceExplanation}</span>
            </div>
          )}
        </div>

        {/* Tabs Bar */}
        <div className="research-modal-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            className={`research-modal-tab ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Overview & Ratio
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "facts_issues"}
            className={`research-modal-tab ${activeTab === "facts_issues" ? "active" : ""}`}
            onClick={() => setActiveTab("facts_issues")}
          >
            Facts & Arguments
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "reasoning_ratio"}
            className={`research-modal-tab ${activeTab === "reasoning_ratio" ? "active" : ""}`}
            onClick={() => setActiveTab("reasoning_ratio")}
          >
            Reasoning & Decision
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "precedents_statutes"}
            className={`research-modal-tab ${activeTab === "precedents_statutes" ? "active" : ""}`}
            onClick={() => setActiveTab("precedents_statutes")}
          >
            Statutes & Precedents
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "paragraphs"}
            className={`research-modal-tab ${activeTab === "paragraphs" ? "active" : ""}`}
            onClick={() => setActiveTab("paragraphs")}
          >
            Key Paragraphs ({caseItem.keyParagraphs?.length || 0})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="research-modal-body">
          {activeTab === "overview" && (
            <div className="research-tab-content">
              {/* Ratio Decidendi Highlight */}
              <div className="research-ratio-box">
                <div className="research-section-tag">RATIO DECIDENDI (KEY LEGAL PRINCIPLE)</div>
                <p className="research-ratio-text">{caseItem.ratioDecidendi}</p>
              </div>

              {/* Case Overview */}
              <div className="research-detail-section">
                <h4 className="research-detail-title">Case Overview</h4>
                <p className="research-detail-text">{caseItem.summary}</p>
              </div>

              {/* Operative Decision */}
              <div className="research-detail-section">
                <h4 className="research-detail-title">Decision / Operative Order</h4>
                <p className="research-detail-text">{caseItem.decision}</p>
              </div>

              {/* Citation & Source Information */}
              <div className="research-detail-section">
                <h4 className="research-detail-title">Citation Information & Source</h4>
                <div className="research-meta-grid">
                  <div className="meta-card">
                    <span className="meta-label">Primary Citation</span>
                    <span className="meta-value">{caseItem.citation}</span>
                  </div>
                  <div className="meta-card">
                    <span className="meta-label">Alternate Citations</span>
                    <span className="meta-value">{(caseItem.alternateCitations || []).join(", ") || "None"}</span>
                  </div>
                  <div className="meta-card">
                    <span className="meta-label">Source Verification</span>
                    <span className="meta-value">{caseItem.source}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "facts_issues" && (
            <div className="research-tab-content">
              <div className="research-detail-section">
                <h4 className="research-detail-title">Facts of the Case</h4>
                <p className="research-detail-text">{caseItem.facts}</p>
              </div>

              <div className="research-detail-section">
                <h4 className="research-detail-title">Issues Framed by Court</h4>
                <ol className="research-styled-list">
                  {(caseItem.issues || []).map((issue, idx) => (
                    <li key={idx}><strong>Issue {idx + 1}:</strong> {issue}</li>
                  ))}
                </ol>
              </div>

              <div className="research-args-grid">
                <div className="args-card appellant">
                  <h5>Arguments for Appellant / Petitioner</h5>
                  <ul>
                    {(caseItem.argumentsAppellant || []).map((arg, idx) => (
                      <li key={idx}>{arg}</li>
                    ))}
                  </ul>
                </div>
                <div className="args-card respondent">
                  <h5>Arguments for Respondent / State</h5>
                  <ul>
                    {(caseItem.argumentsRespondent || []).map((arg, idx) => (
                      <li key={idx}>{arg}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeTab === "reasoning_ratio" && (
            <div className="research-tab-content">
              <div className="research-detail-section">
                <h4 className="research-detail-title">Court&apos;s Analysis & Reasoning</h4>
                <p className="research-detail-text">{caseItem.reasoning}</p>
              </div>

              <div className="research-ratio-box">
                <div className="research-section-tag">RATIO DECIDENDI</div>
                <p className="research-ratio-text">{caseItem.ratioDecidendi}</p>
              </div>

              <div className="research-detail-section">
                <h4 className="research-detail-title">Final Order & Disposition</h4>
                <p className="research-detail-text">{caseItem.decision}</p>
              </div>
            </div>
          )}

          {activeTab === "precedents_statutes" && (
            <div className="research-tab-content">
              <div className="research-detail-section">
                <h4 className="research-detail-title">Applicable Law & Statutes</h4>
                <div className="research-chip-tags">
                  {(caseItem.applicableLaw || []).map((law, idx) => (
                    <span key={idx} className="research-law-chip">{law}</span>
                  ))}
                </div>
              </div>

              <div className="research-detail-section">
                <h4 className="research-detail-title">Sections / Acts Referred</h4>
                <ul className="research-bullet-list">
                  {(caseItem.sectionsReferred || []).map((sec, idx) => (
                    <li key={idx}>{sec}</li>
                  ))}
                </ul>
              </div>

              <div className="research-detail-section">
                <h4 className="research-detail-title">Cases Referred & Discussed</h4>
                <ul className="research-bullet-list">
                  {(caseItem.casesReferred || []).map((cRef, idx) => (
                    <li key={idx}>{cRef}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {activeTab === "paragraphs" && (
            <div className="research-tab-content">
              <p className="research-tab-note">
                Key extracted paragraphs containing the ratio decidendi and operative findings:
              </p>
              <div className="research-paragraphs-list">
                {(caseItem.keyParagraphs || []).map((p) => (
                  <div key={p.paraNumber} className="research-para-card">
                    <span className="para-num-badge">¶ {p.paraNumber}</span>
                    <blockquote className="para-quote">
                      &ldquo;{p.text}&rdquo;
                    </blockquote>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="research-modal-footer">
          <div className="source-disclaimer">
            <span>Verified Source: Grounded strictly in officially reported judgments.</span>
          </div>
          <div className="footer-btns-group">
            {caseItem.sourceUrl && (
              <a
                href={caseItem.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary research-btn official-source-link"
                title="Open Official Judgment in Court Portal"
              >
                <span>Open Official Judgment ↗</span>
              </a>
            )}
            {onGenerateBrief && (
              <button
                type="button"
                className="btn-secondary research-btn"
                onClick={() => {
                  onClose();
                  onGenerateBrief(caseItem);
                }}
              >
                <FileTextIcon size={15} />
                <span>Generate Brief</span>
              </button>
            )}
            <button
              type="button"
              className="btn-primary research-btn"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
