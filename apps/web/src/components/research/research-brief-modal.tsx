"use client";

import { useEffect, useState } from "react";
import {
  legalResearchService,
  type ResearchBriefData,
  type ResearchBriefInput,
} from "@/lib/legal-research-service";
import {
  BookmarkCheckIcon,
  BookmarkIcon,
  CopyIcon,
  DownloadIcon,
  FileTextPlusIcon,
  SparklesIcon,
  XIcon,
} from "../icons";

interface ResearchBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveBrief?: (brief: ResearchBriefData) => void;
  initialPrompt?: string;
  initialSection?: string;
}

export function ResearchBriefModal({
  isOpen,
  onClose,
  onSaveBrief,
  initialPrompt = "",
  initialSection = "",
}: ResearchBriefModalProps) {
  const [legalIssue, setLegalIssue] = useState(initialPrompt);
  const [facts, setFacts] = useState("");
  const [relevantSections, setRelevantSections] = useState(initialSection);
  const [jurisdiction, setJurisdiction] = useState("Supreme Court of India & High Courts");
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedBrief, setGeneratedBrief] = useState<ResearchBriefData | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const [prevPrompt, setPrevPrompt] = useState(initialPrompt);
  const [prevSection, setPrevSection] = useState(initialSection);

  if (initialPrompt !== prevPrompt) {
    setPrevPrompt(initialPrompt);
    if (!legalIssue) {
      setLegalIssue(initialPrompt);
    }
  }

  if (initialSection !== prevSection) {
    setPrevSection(initialSection);
    if (!relevantSections) {
      setRelevantSections(initialSection);
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalIssue.trim() || !facts.trim()) return;

    setIsGenerating(true);
    try {
      const briefInput: ResearchBriefInput = {
        legalIssue,
        facts,
        relevantSections,
        jurisdiction,
        additionalInstructions,
      };
      const brief = await legalResearchService.generateResearchBrief(briefInput);
      setGeneratedBrief(brief);
      setIsSaved(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleLoadSample = (type: "arbitration" | "cheque") => {
    if (type === "arbitration") {
      setLegalIssue("Arbitrability of landlord-tenant eviction disputes under Transfer of Property Act");
      setFacts("Client is a commercial lessor who entered into a registered lease agreement containing an ICC arbitration clause. Lessee defaulted on rent and refused to vacate upon expiry. Lessee claims dispute is non-arbitrable under rent law.");
      setRelevantSections("Section 8 & 11, Arbitration and Conciliation Act, 1996; Section 111, Transfer of Property Act, 1882");
      setJurisdiction("Supreme Court of India");
      setAdditionalInstructions("Focus on recent three-judge bench tests for non-arbitrability.");
    } else {
      setLegalIssue("Territorial jurisdiction in Section 138 NI Act and statutory presumption under Section 139");
      setFacts("Cheque issued towards discharge of commercial consultancy fees was returned dishonoured with remark 'Funds Insufficient'. Accused argues consideration was inadequate and cheque was handed over as security.");
      setRelevantSections("Section 138, 139, 142(2), Negotiable Instruments Act, 1881");
      setJurisdiction("High Court & Sessions Court");
      setAdditionalInstructions("Highlight reversal of burden of proof and drawer's obligation.");
    }
  };

  const handleCopyMarkdown = () => {
    if (!generatedBrief) return;
    const md = `
# ${generatedBrief.title}
*Generated: ${generatedBrief.generatedAt}*

## Research Question
${generatedBrief.researchQuestion}

## Relevant Statutes & Enactments
${generatedBrief.relevantStatutes.map((s) => `- ${s}`).join("\n")}

## Leading Precedents
${generatedBrief.leadingPrecedents.map((p) => `### ${p.title}\n**Citation:** ${p.citation}\n**Principle:** ${p.principle}`).join("\n\n")}

## Supporting Authorities
${generatedBrief.supportingAuthorities.map((a) => `- ${a}`).join("\n")}

## Contrary / Distinguishing Authorities
${generatedBrief.contraryAuthorities.map((c) => `- ${c}`).join("\n")}

## Legal Analysis
${generatedBrief.legalAnalysis}

## Practical Considerations
${generatedBrief.practicalConsiderations.map((p) => `- ${p}`).join("\n")}

## Conclusion
${generatedBrief.conclusion}

## Sources
${generatedBrief.sources.join(", ")}
    `.trim();

    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = () => {
    if (!generatedBrief) return;
    window.print();
  };

  const handleSave = () => {
    if (!generatedBrief || !onSaveBrief) return;
    onSaveBrief(generatedBrief);
    setIsSaved(true);
  };

  return (
    <div
      className="evidence-modal-backdrop research-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="brief-modal-title"
    >
      <div
        className="evidence-modal research-brief-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="research-modal-header">
          <div className="research-modal-header-left">
            <span className="research-tool-header-icon">
              <FileTextPlusIcon size={18} />
            </span>
            <div>
              <h3 id="brief-modal-title" className="research-tool-header-title">
                AI Legal Research Brief Generator
              </h3>
              <p className="research-tool-header-subtitle">
                Generate comprehensive, court-ready research briefs grounded strictly in verified legal authorities.
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
          {!generatedBrief ? (
            <div>
              {/* Preset Scenarios */}
              <div className="sample-presets-bar">
                <span className="preset-label">Load scenario:</span>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => handleLoadSample("arbitration")}
                >
                  Arbitration Reference Brief
                </button>
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => handleLoadSample("cheque")}
                >
                  Cheque Dishonour Defense Brief
                </button>
              </div>

              <form onSubmit={handleGenerate} className="brief-input-form">
                <div className="form-group">
                  <label htmlFor="brief-issue" className="form-label">
                    Legal Issue / Core Question <span className="required-star">*</span>
                  </label>
                  <input
                    id="brief-issue"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Whether tenant disputes under general law are arbitrable..."
                    value={legalIssue}
                    onChange={(e) => setLegalIssue(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="brief-facts" className="form-label">
                    Facts / Background <span className="required-star">*</span>
                  </label>
                  <textarea
                    id="brief-facts"
                    className="form-textarea"
                    rows={4}
                    placeholder="Describe facts, contractual relationship, breach or relief sought..."
                    value={facts}
                    onChange={(e) => setFacts(e.target.value)}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="brief-sections" className="form-label">
                      Relevant Sections / Statutes
                    </label>
                    <input
                      id="brief-sections"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Section 11 Arbitration Act, Section 138 NI Act"
                      value={relevantSections}
                      onChange={(e) => setRelevantSections(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="brief-jurisdiction" className="form-label">
                      Jurisdiction
                    </label>
                    <input
                      id="brief-jurisdiction"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Supreme Court of India, High Court of Delhi"
                      value={jurisdiction}
                      onChange={(e) => setJurisdiction(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="brief-instructions" className="form-label">
                    Special Strategic Instructions (Optional)
                  </label>
                  <input
                    id="brief-instructions"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Emphasize interim relief, focus on latest 2024 judgments..."
                    value={additionalInstructions}
                    onChange={(e) => setAdditionalInstructions(e.target.value)}
                  />
                </div>

                <div className="brief-form-actions">
                  <button
                    type="submit"
                    className="btn-primary generate-brief-submit-btn"
                    disabled={isGenerating || !legalIssue.trim() || !facts.trim()}
                  >
                    {isGenerating ? (
                      <>
                        <span className="spinner-dots" /> Synthesizing Legal Authorities...
                      </>
                    ) : (
                      <>
                        <SparklesIcon size={16} /> Generate Research Brief
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Generated Brief Display */
            <div className="brief-output-container">
              <div className="brief-actions-top-bar">
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setGeneratedBrief(null)}
                >
                  ← Edit Inputs
                </button>
                <div className="brief-export-btns">
                  <button
                    type="button"
                    className="research-icon-btn"
                    onClick={handleCopyMarkdown}
                    title="Copy Markdown"
                  >
                    <CopyIcon size={15} />
                    <span>{copied ? "Copied" : "Copy"}</span>
                  </button>
                  <button
                    type="button"
                    className="research-icon-btn"
                    onClick={handleExportPDF}
                    title="Print / Save PDF"
                  >
                    <DownloadIcon size={15} />
                    <span>Export PDF</span>
                  </button>
                  {onSaveBrief && (
                    <button
                      type="button"
                      className={`research-icon-btn ${isSaved ? "active" : ""}`}
                      onClick={handleSave}
                      title="Save to Library"
                    >
                      {isSaved ? <BookmarkCheckIcon size={15} /> : <BookmarkIcon size={15} />}
                      <span>{isSaved ? "Saved" : "Save Brief"}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Document Sheet */}
              <div className="brief-document-sheet printable-brief">
                <div className="sheet-header">
                  <div className="sheet-watermark">LEGAL RESEARCH BRIEF</div>
                  <h3 className="sheet-title">{generatedBrief.title}</h3>
                  <div className="sheet-date">Date of Preparation: {generatedBrief.generatedAt}</div>
                </div>

                {/* 1. Research Question */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">1. Question of Law Formulated</h4>
                  <p className="sheet-text">{generatedBrief.researchQuestion}</p>
                </div>

                {/* 2. Applicable Statutes */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">2. Relevant Statutes & Provisions</h4>
                  <div className="sheet-chip-list">
                    {generatedBrief.relevantStatutes.map((statute, idx) => (
                      <span key={idx} className="sheet-chip">{statute}</span>
                    ))}
                  </div>
                </div>

                {/* 3. Leading Precedents */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">3. Leading Precedents & Rulings</h4>
                  <div className="sheet-precedents-list">
                    {generatedBrief.leadingPrecedents.map((p, idx) => (
                      <div key={idx} className="sheet-precedent-card">
                        <div className="p-title-row">
                          <strong>{p.title}</strong>
                          <span className="p-citation">{p.citation}</span>
                        </div>
                        <p className="p-principle"><strong>Principle:</strong> {p.principle}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Supporting Authorities */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">4. Supporting Authorities & Propositions</h4>
                  <ul className="sheet-bullet-list">
                    {generatedBrief.supportingAuthorities.map((auth, idx) => (
                      <li key={idx}>{auth}</li>
                    ))}
                  </ul>
                </div>

                {/* 5. Contrary / Distinguishing Authorities */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">5. Anticipated Contrary Authorities & Rebuttals</h4>
                  <ul className="sheet-bullet-list">
                    {generatedBrief.contraryAuthorities.map((contra, idx) => (
                      <li key={idx}>{contra}</li>
                    ))}
                  </ul>
                </div>

                {/* 6. Legal Analysis */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">6. Legal Analysis & Application to Facts</h4>
                  <p className="sheet-text">{generatedBrief.legalAnalysis}</p>
                </div>

                {/* 7. Practical Considerations */}
                <div className="sheet-section">
                  <h4 className="sheet-section-title">7. Practical Considerations & Procedural Strategy</h4>
                  <ul className="sheet-bullet-list">
                    {generatedBrief.practicalConsiderations.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ul>
                </div>

                {/* 8. Conclusion */}
                <div className="sheet-section conclusion">
                  <h4 className="sheet-section-title">8. Summary Conclusion</h4>
                  <p className="sheet-text">{generatedBrief.conclusion}</p>
                </div>

                {/* Sources Footer */}
                <div className="sheet-sources-footer">
                  <strong>Verified Grounding:</strong> {generatedBrief.sources.join(" • ")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
