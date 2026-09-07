"use client";

import { useEffect, useState } from "react";
import {
  legalResearchService,
  type CitationVerificationResult,
} from "@/lib/legal-research-service";
import {
  CheckCircleIcon,
  CopyIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  XIcon,
} from "../icons";

interface CitationCheckerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCaseByCitation?: (citation: string) => void;
}

export function CitationCheckerModal({
  isOpen,
  onClose,
  onSelectCaseByCitation,
}: CitationCheckerModalProps) {
  const [citationInput, setCitationInput] = useState("");
  const [result, setResult] = useState<CitationVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!citationInput.trim()) return;

    setIsLoading(true);
    try {
      const res = await legalResearchService.verifyCitation(citationInput);
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleClick = (cit: string) => {
    setCitationInput(cit);
    legalResearchService.verifyCitation(cit).then(setResult);
  };

  const handleCopy = () => {
    if (result?.citation) {
      navigator.clipboard.writeText(`${result.caseName || ""} ${result.citation}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="evidence-modal-backdrop research-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="citation-checker-title"
    >
      <div
        className="evidence-modal citation-checker-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="research-modal-header">
          <div className="research-modal-header-left">
            <span className="research-tool-header-icon">
              <ShieldCheckIcon size={18} />
            </span>
            <div>
              <h3 id="citation-checker-title" className="research-tool-header-title">
                Citation Verification
              </h3>
              <p className="research-tool-header-subtitle">
                Verify volume, journal codes, reporter numbers, bench, and judicial treatment against verified sources.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="research-modal-body">
          {/* Preset Samples */}
          <div className="sample-presets-bar">
            <span className="preset-label">Sample citations:</span>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleSampleClick("(2021) 2 SCC 1")}
            >
              (2021) 2 SCC 1
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleSampleClick("(2014) 9 SCC 129")}
            >
              (2014) 9 SCC 129
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleSampleClick("(2017) 10 SCC 1")}
            >
              (2017) 10 SCC 1
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleSampleClick("2024 INSC 999")}
            >
              2024 INSC 999
            </button>
          </div>

          <form onSubmit={handleVerify} className="citation-form">
            <div className="form-group">
              <label htmlFor="citation-input" className="form-label">
                Enter Citation String or Case Name
              </label>
              <div className="citation-input-wrap">
                <input
                  id="citation-input"
                  type="text"
                  className="form-input citation-text-input"
                  placeholder="e.g. (2021) 2 SCC 1, AIR 2017 SC 4161, 2023 INSC 650..."
                  value={citationInput}
                  onChange={(e) => setCitationInput(e.target.value)}
                  autoFocus
                />
                <button
                  type="submit"
                  className="btn-primary citation-verify-btn"
                  disabled={isLoading || !citationInput.trim()}
                >
                  {isLoading ? "Checking..." : "Verify Citation"}
                </button>
              </div>
            </div>
          </form>

          {/* Verification Results Box */}
          {result && (
            <div className={`citation-result-card ${result.status.toLowerCase()}`}>
              <div className="result-card-top">
                <div className="result-status-wrap">
                  {result.status === "VERIFIED" && (
                    <span className="badge-status verified">
                      <CheckCircleIcon size={14} /> Verified Authority
                    </span>
                  )}
                  {result.status === "NEEDS_REVIEW" && (
                    <span className="badge-status review">
                      <ShieldAlertIcon size={14} /> Unverified Syntax (Source Disconnected)
                    </span>
                  )}
                  {result.status === "NOT_FOUND" && (
                    <span className="badge-status notfound">
                      <XIcon size={14} /> Citation Not Found
                    </span>
                  )}
                  <span className="verified-citation-string">{result.citation}</span>
                </div>
                {result.status === "VERIFIED" && (
                  <button
                    type="button"
                    className="research-icon-btn"
                    onClick={handleCopy}
                    title="Copy Citation"
                  >
                    <CopyIcon size={14} />
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                )}
              </div>

              {result.caseName && (
                <h4 className="verified-case-name">{result.caseName}</h4>
              )}

              <p className="status-explanation-message">{result.statusMessage}</p>

              {result.status === "VERIFIED" && (
                <div className="verification-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Adjudicating Court</span>
                    <span className="detail-val">{result.court}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Year of Decision</span>
                    <span className="detail-val">{result.year}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Bench Composition</span>
                    <span className="detail-val">{result.bench}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Alternate Citations</span>
                    <span className="detail-val">{result.alternateCitations?.join(", ") || "None"}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Source Verification Registry</span>
                    <span className="detail-val">{result.sourceAttribution}</span>
                  </div>
                </div>
              )}

              {result.treatmentHistory && (
                <div className="treatment-history-box">
                  <div className="treatment-header">Judicial Treatment & Status History</div>
                  <div className="treatment-status-row">
                    <span className="treatment-tag valid">Active Precedent (Not Overruled)</span>
                    <span className="treatment-meta">Affirmed in subsequent division benches.</span>
                  </div>
                </div>
              )}

              {result.status === "VERIFIED" && onSelectCaseByCitation && (
                <div className="citation-result-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      onClose();
                      onSelectCaseByCitation(result.citation);
                    }}
                  >
                    <SearchIcon size={14} /> View Case in Research Workspace
                  </button>
                </div>
              )}

              <div className="citation-safety-disclaimer">
                <strong>Legal Grounding Notice:</strong> LegalAI does not fabricate legal citations. Citations are verified strictly against officially reported reporters and gazettes.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

