"use client";

import { useEffect, useState } from "react";
import { legalResearchService, type CaseLawItem, type PrecedentResult } from "@/lib/legal-research-service";
import {
  FileSearchIcon,
  ScaleIcon,
  SparklesIcon,
  XIcon,
} from "../icons";

interface PrecedentFinderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewCase: (item: CaseLawItem) => void;
}

export function PrecedentFinderModal({
  isOpen,
  onClose,
  onViewCase,
}: PrecedentFinderModalProps) {
  const [facts, setFacts] = useState("");
  const [legalIssue, setLegalIssue] = useState("");
  const [relevantSection, setRelevantSection] = useState("");
  const [keywords, setKeywords] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PrecedentResult | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalIssue.trim() && !facts.trim()) return;

    setIsLoading(true);
    try {
      const res = await legalResearchService.findPrecedents({
        facts,
        legalIssue,
        relevantSection,
        keywords,
      });
      setResult(res);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadSample = (sampleType: "arbitration" | "cheque" | "contract") => {
    if (sampleType === "arbitration") {
      setFacts("Landlord entered into commercial lease with arbitration clause. Lease is not governed by state rent control act. Tenant disputes notice of termination and resists arbitration referral.");
      setLegalIssue("Whether landlord-tenant disputes under general Transfer of Property Act are arbitrable under Section 11 of the Arbitration and Conciliation Act?");
      setRelevantSection("Section 11, Arbitration Act / Section 111, Transfer of Property Act");
      setKeywords("arbitrability, tenancy, lease, Section 8, Section 11");
    } else if (sampleType === "cheque") {
      setFacts("Cheque was issued in Delhi, presented in Mumbai, and dishonoured at payee's branch in Bengaluru. Accused challenges jurisdiction of Delhi magistrate.");
      setLegalIssue("Territorial jurisdiction for filing complaint under Section 138 of Negotiable Instruments Act post-2015 amendments.");
      setRelevantSection("Section 138, Section 142(2), NI Act");
      setKeywords("territorial jurisdiction, drawee bank, cheque dishonour");
    } else {
      setFacts("Bidder deposited 25% earnest money for public tender. Default occurred in balance payment. Authority cancelled contract and forfeited entire deposit despite re-auctioning at higher profit.");
      setLegalIssue("Can earnest money deposit be forfeited under Section 74 of Contract Act without proving actual loss or legal injury?");
      setRelevantSection("Section 74, Indian Contract Act");
      setKeywords("forfeiture, earnest money, liquidated damages, penalty");
    }
  };

  return (
    <div
      className="evidence-modal-backdrop research-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="precedent-finder-title"
    >
      <div
        className="evidence-modal precedent-finder-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="research-modal-header">
          <div className="research-modal-header-left">
            <span className="research-tool-header-icon">
              <FileSearchIcon size={18} />
            </span>
            <div>
              <h3 id="precedent-finder-title" className="research-tool-header-title">
                Precedent Finder
              </h3>
              <p className="research-tool-header-subtitle">
                Find matching case law, supporting authorities, and contrary precedents grounded in verified Indian law.
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
          {/* Quick Presets */}
          <div className="sample-presets-bar">
            <span className="preset-label">Load sample scenario:</span>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleLoadSample("arbitration")}
            >
              Arbitration & Tenancy
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleLoadSample("cheque")}
            >
              Cheque Dishonour (S. 138)
            </button>
            <button
              type="button"
              className="preset-chip"
              onClick={() => handleLoadSample("contract")}
            >
              Breach & Earnest Money
            </button>
          </div>

          <form onSubmit={handleSearch} className="precedent-finder-form">
            <div className="form-group">
              <label htmlFor="pf-issue" className="form-label">
                Legal Issue / Question of Law <span className="required-star">*</span>
              </label>
              <input
                id="pf-issue"
                type="text"
                className="form-input"
                placeholder="e.g. Whether dispute under lease agreement is arbitrable under Section 11..."
                value={legalIssue}
                onChange={(e) => setLegalIssue(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="pf-facts" className="form-label">
                Case Facts / Background <span className="required-star">*</span>
              </label>
              <textarea
                id="pf-facts"
                className="form-textarea"
                rows={3}
                placeholder="Briefly state key material facts..."
                value={facts}
                onChange={(e) => setFacts(e.target.value)}
                required
              />
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label htmlFor="pf-section" className="form-label">
                  Relevant Section / Act
                </label>
                <input
                  id="pf-section"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Section 11 Arbitration Act, Section 74 Contract Act"
                  value={relevantSection}
                  onChange={(e) => setRelevantSection(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="pf-keywords" className="form-label">
                  Keywords / Legal Principles
                </label>
                <input
                  id="pf-keywords"
                  type="text"
                  className="form-input"
                  placeholder="e.g. non-arbitrability, liquidated damages, in rem"
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary search-submit-btn"
              disabled={isLoading || (!legalIssue.trim() && !facts.trim())}
            >
              {isLoading ? (
                <>
                  <span className="spinner-dots" /> Searching Precedents...
                </>
              ) : (
                <>
                  <SparklesIcon size={16} /> Find Relevant Precedents
                </>
              )}
            </button>
          </form>

          {/* Results Section */}
          {result && (
            <div className="precedent-results-container">
              <div className="precedent-results-header">
                <h4>Precedent Analysis for &ldquo;{result.queryIssue}&rdquo;</h4>
                <span className="precedent-section-pill">{result.relevantSection}</span>
              </div>

              {/* Dual Columns: Supporting vs Contrary */}
              <div className="precedent-columns-grid">
                {/* Supporting Precedents */}
                <div className="precedent-column supporting">
                  <div className="column-header">
                    <span className="status-dot green" />
                    <h5>Supporting Authorities ({result.supportingPrecedents.length})</h5>
                  </div>
                  {result.supportingPrecedents.map((item) => (
                    <div key={item.id} className="precedent-card supporting">
                      <div className="card-top">
                        <span className="court-tag">{item.court}</span>
                        <span className="citation-tag">{item.citation}</span>
                      </div>
                      <h6 className="card-title">{item.title}</h6>
                      <p className="card-ratio">{item.ratioDecidendi}</p>
                      {item.relevanceExplanation && (
                        <div className="card-relevance-note">
                          <strong>Why Supporting:</strong> {item.relevanceExplanation}
                        </div>
                      )}
                      <div className="card-footer">
                        <button
                          type="button"
                          className="btn-view-details"
                          onClick={() => onViewCase(item)}
                        >
                          <ScaleIcon size={13} /> View Full Judgment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Contrary / Distinguishing Precedents */}
                <div className="precedent-column contrary">
                  <div className="column-header">
                    <span className="status-dot amber" />
                    <h5>Contrary / Distinguishing Authorities ({result.contraryPrecedents.length})</h5>
                  </div>
                  {result.contraryPrecedents.map((item) => (
                    <div key={item.id} className="precedent-card contrary">
                      <div className="card-top">
                        <span className="court-tag">{item.court}</span>
                        <span className="citation-tag">{item.citation}</span>
                      </div>
                      <h6 className="card-title">{item.title}</h6>
                      <p className="card-ratio">{item.ratioDecidendi}</p>
                      {item.relevanceExplanation && (
                        <div className="card-relevance-note">
                          <strong>How Distinguishable:</strong> {item.relevanceExplanation}
                        </div>
                      )}
                      <div className="card-footer">
                        <button
                          type="button"
                          className="btn-view-details"
                          onClick={() => onViewCase(item)}
                        >
                          <ScaleIcon size={13} /> View Full Judgment
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
