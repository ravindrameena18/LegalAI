"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AnalysisProgress } from "@/components/analysis-progress";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  ApiError,
  getDocumentAnalysis,
  listDocuments,
  normalizeLegalAnalysisData,
  triggerDocumentAnalysis,
  type AnalysisDetail,
  type ClauseItem,
  type DocumentItem,
  type LegalAnalysisData,
  type RiskItem,
} from "@/lib/api-client";

function AnalysisContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const initialDocId = searchParams.get("document_id") || "";
  const sessionIdParam = searchParams.get("session_id") || "";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string>(initialDocId);
  const [analysis, setAnalysis] = useState<AnalysisDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "risks" | "clauses" | "covenants" | "gaps">("overview");

  // Evidence Inspector Drawer State
  const [inspectedEvidence, setInspectedEvidence] = useState<{
    title: string;
    source_text: string;
    page?: number | null;
    section?: string | null;
    confidence?: number;
    explanation?: string;
    action?: string;
  } | null>(null);

  // Load user's ready documents
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    listDocuments()
      .then((docs) => {
        if (!isMounted) return;
        const readyDocs = docs.filter((d) => d.processing_status === "ready");
        setDocuments(readyDocs);
        if (!selectedDocId && readyDocs.length > 0) {
          setSelectedDocId(readyDocs[0].id);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.id, selectedDocId]);

  // Listen for document deletion event: gracefully clear and redirect if active doc is deleted
  useEffect(() => {
    const handleDocDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name: string }>;
      const deletedId = customEvent.detail?.id;
      if (!deletedId) return;

      setDocuments((prev) => prev.filter((d) => d.id !== deletedId));
      if (selectedDocId === deletedId) {
        window.location.href = `/documents?notice=${encodeURIComponent("Document deleted. Select another document to continue.")}`;
        router.push(`/documents?notice=${encodeURIComponent("Document deleted. Select another document to continue.")}`);
      }
    };
    window.addEventListener("legalai:document-deleted", handleDocDeleted);
    return () => window.removeEventListener("legalai:document-deleted", handleDocDeleted);
  }, [selectedDocId]);

  const documentIdParam = searchParams.get("document_id") || "";
  const autoParam = searchParams.get("auto") || "";

  // Sync selectedDocId if document_id query parameter changes
  useEffect(() => {
    if (documentIdParam && documentIdParam !== selectedDocId) {
      setSelectedDocId(documentIdParam);
    }
  }, [documentIdParam, selectedDocId]);

  // Load analysis for selected document
  useEffect(() => {
    if (!selectedDocId) return;

    let isMounted = true;
    getDocumentAnalysis(selectedDocId)
      .then((data) => {
        if (isMounted) {
          setAnalysis(data);
          setError(null);
        }
      })
      .catch(async (err: unknown) => {
        if (!isMounted) return;
        if (err instanceof ApiError && err.status === 404) {
          // If auto query param is provided and document has no existing analysis, auto-trigger analysis
          if (autoParam === "true") {
            try {
              setIsAnalyzing(true);
              const data = await triggerDocumentAnalysis(selectedDocId, false);
              if (isMounted) {
                setAnalysis(data);
                setError(null);
              }
            } catch (autoErr: unknown) {
              if (isMounted) {
                setAnalysis(null);
                setError(
                  autoErr instanceof ApiError
                    ? autoErr.detail
                    : autoErr instanceof Error
                      ? autoErr.message
                      : "AI document analysis failed.",
                );
              }
            } finally {
              if (isMounted) {
                setIsAnalyzing(false);
              }
            }
          } else {
            setAnalysis(null);
          }
        } else {
          setError(
            err instanceof ApiError
              ? err.detail
              : err instanceof Error
                ? err.message
                : "Failed to load document analysis.",
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDocId, autoParam]);

  const handleRunAnalysis = async (force: boolean = false) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const data = await triggerDocumentAnalysis(selectedDocId, force);
      setAnalysis(data);
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "AI document analysis failed.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedDoc = documents.find((d) => d.id === selectedDocId);

  // Normalization layer: guarantees all collections are arrays and all sections exist
  const data: LegalAnalysisData | null = analysis
    ? normalizeLegalAnalysisData(analysis.structured_data)
    : null;

  const criticalRisks = data?.risks.filter((r) => r.severity === "CRITICAL") || [];
  const highRisks = data?.risks.filter((r) => r.severity === "HIGH") || [];
  const mediumRisks = data?.risks.filter((r) => r.severity === "MEDIUM") || [];
  const lowRisks = data?.risks.filter((r) => r.severity === "LOW") || [];
  const backToChatHref = sessionIdParam
    ? `/chat/${sessionIdParam}`
    : selectedDocId
      ? `/dashboard?document_id=${selectedDocId}`
      : "/dashboard";

  return (
    <AppShell>
      <div className="analysis-workspace-container">
        {/* Legal Mandatory Disclaimer Banner */}
        <div className="legal-disclaimer-banner" role="alert">
          <span className="disclaimer-icon">⚖️</span>
          <div className="disclaimer-text">
            <strong>{t("analysis.disclaimer_title")}</strong>
            <p>
              {t("analysis.disclaimer_text")}
            </p>
          </div>
        </div>

      {/* Header & Document Switcher */}
      <div className="analysis-page-header">
        <div>
          <span className="eyebrow">{t("analysis.eyebrow")}</span>
          <h1>{t("analysis.title")}</h1>
          <p>
            {t("analysis.subtitle")}
          </p>
        </div>

        <div className="analysis-header-controls">
          <Link
            href={backToChatHref}
            className="back-to-chat-btn"
            title="Return to AI Copilot Chat"
          >
            {t("analysis.back_to_chat")}
          </Link>

          {documents.length > 0 && (
            <label className="doc-select-label">
              {t("analysis.active_doc_label")}
              <select
                value={selectedDocId}
                onChange={(e) => {
                  setSelectedDocId(e.target.value);
                  setIsLoading(true);
                }}
                className="doc-select"
                aria-label="Select document to view analysis"
              >
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.file_type.toUpperCase()})
                  </option>
                ))}
              </select>
            </label>
          )}

          {selectedDocId && (
            <button
              type="button"
              className="primary-button"
              onClick={() => handleRunAnalysis(true)}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? t("analysis.analyzing_btn") : analysis ? t("analysis.reanalyze_btn") : t("analysis.analyze_btn")}
            </button>
          )}
        </div>
      </div>

      {/* Error / Missing API Key Banner */}
      {error && (
        <div className="auth-error-banner" role="alert" style={{ marginBottom: "20px" }}>
          <strong>Analysis Notice: </strong>
          <span>{error}</span>
          {error.includes("GEMINI_API_KEY") && (
            <p style={{ margin: "6px 0 0", fontSize: "12px", opacity: 0.9 }}>
              To enable Gemini AI analysis, obtain an API key from Google AI Studio and configure GEMINI_API_KEY in your backend server environment.
            </p>
          )}
        </div>
      )}

      {/* Loading State */}
      {isAnalyzing ? (
        <AnalysisProgress />
      ) : isLoading ? (
        <div className="doc-loading-state" style={{ padding: "64px 20px" }}>
          <span className="upload-spinner" style={{ width: "24px", height: "24px" }} />
          <h3 style={{ margin: "16px 0 6px", color: "var(--ink)" }}>{t("analysis.loading_title")}</h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {t("analysis.loading_desc")}
          </p>
        </div>
      ) : !selectedDocId ? (
        <div className="doc-empty-state">
          <div className="empty-icon">📁</div>
          <h3>{t("analysis.empty_no_docs_title")}</h3>
          <p>{t("analysis.empty_no_docs_desc")}</p>
          <Link href="/documents" className="primary-button">
            Go to Documents Workspace
          </Link>
        </div>
      ) : !analysis || !data ? (
        <div className="doc-empty-state">
          <div className="empty-icon">⚖️</div>
          <h3>{t("analysis.empty_not_analyzed_title")}</h3>
          <p>
            {t("analysis.empty_not_analyzed_desc", { name: selectedDoc?.name || "Selected document" })}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => handleRunAnalysis(false)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? t("analysis.analyzing_btn") : t("analysis.analyze_btn")}
          </button>
        </div>
      ) : analysis.status === "failed" ? (
        <div className="doc-empty-state">
          <div className="empty-icon">⚠️</div>
          <h3>{t("analysis.failed_title")}</h3>
          <p>
            {analysis.error_message || "The Gemini analysis encountered an error while processing the document."}
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => handleRunAnalysis(true)}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? "Retrying..." : "Retry Analysis with Google Gemini"}
          </button>
        </div>
      ) : (
        <>
          {/* Analysis Workspace Tabs */}
          <div className="analysis-tabs-bar" role="tablist" aria-label="Document Analysis Sections">
            <button
              type="button"
              role="tab"
              id="tab-overview"
              aria-controls="tabpanel-overview"
              aria-selected={activeTab === "overview"}
              className={`analysis-tab ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              <span className="analysis-tab-title">{t("analysis.tab.overview")}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-risks"
              aria-controls="tabpanel-risks"
              aria-selected={activeTab === "risks"}
              className={`analysis-tab ${activeTab === "risks" ? "active" : ""}`}
              onClick={() => setActiveTab("risks")}
            >
              <span className="analysis-tab-title">{t("analysis.tab.risks")}</span>
              <span className="analysis-tab-badge">{data.risks.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-clauses"
              aria-controls="tabpanel-clauses"
              aria-selected={activeTab === "clauses"}
              className={`analysis-tab ${activeTab === "clauses" ? "active" : ""}`}
              onClick={() => setActiveTab("clauses")}
            >
              <span className="analysis-tab-title">{t("analysis.tab.clauses")}</span>
              <span className="analysis-tab-badge">{data.important_clauses.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-covenants"
              aria-controls="tabpanel-covenants"
              aria-selected={activeTab === "covenants"}
              className={`analysis-tab ${activeTab === "covenants" ? "active" : ""}`}
              onClick={() => setActiveTab("covenants")}
            >
              <span className="analysis-tab-title">{t("analysis.tab.covenants")}</span>
            </button>
            <button
              type="button"
              role="tab"
              id="tab-gaps"
              aria-controls="tabpanel-gaps"
              aria-selected={activeTab === "gaps"}
              className={`analysis-tab ${activeTab === "gaps" ? "active" : ""}`}
              onClick={() => setActiveTab("gaps")}
            >
              <span className="analysis-tab-title">{t("analysis.tab.gaps")}</span>
              <span className="analysis-tab-badge">{data.missing_or_unclear_information.length}</span>
            </button>
          </div>

          {/* TAB 1: Overview & Summary */}
          {activeTab === "overview" && (
            <div
              className="analysis-tab-content"
              id="tabpanel-overview"
              role="tabpanel"
              aria-labelledby="tab-overview"
            >
              {/* Executive Summary Surface */}
              <div className="surface-card analysis-card" style={{ marginBottom: "20px" }}>
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">Section 1 & 2</span>
                    <h2>Executive Summary & Agreement Type</h2>
                  </div>
                  <span className="format-tag format-docx" style={{ fontSize: "11px", padding: "4px 10px" }}>
                    {data.document_type}
                  </span>
                </div>
                <p className="summary-text">{data.executive_summary}</p>
              </div>

              {/* Contracting Parties Table */}
              <div className="surface-card analysis-card" style={{ marginBottom: "20px" }}>
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">Section 3</span>
                    <h2>Identified Contracting Parties</h2>
                  </div>
                </div>
                {data.parties.length === 0 ? (
                  <p className="text-muted">No parties identified in the provided document.</p>
                ) : (
                  <div className="parties-grid">
                    {data.parties.map((party, idx) => (
                      <div key={idx} className="party-card">
                        <strong className="party-name">{party.name}</strong>
                        <span className="party-role">{party.role}</span>
                        {party.notice_address && party.notice_address !== "Not found in the provided document." && (
                          <small className="party-address">{party.notice_address}</small>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Key Provisions Grid */}
              <div className="provisions-grid">
                {/* Important Dates */}
                <div className="surface-card analysis-card">
                  <span className="eyebrow">Section 4</span>
                  <h3>Important Dates</h3>
                  {data.important_dates.length === 0 ? (
                    <p className="text-muted">No key dates identified in the provided document.</p>
                  ) : (
                    <ul className="info-list">
                      {data.important_dates.map((d, idx) => (
                        <li key={idx}>
                          <strong>{d.title}:</strong> {d.date}
                          {d.source_text && (
                            <button
                              type="button"
                              className="evidence-inline-btn"
                              onClick={() =>
                                setInspectedEvidence({
                                  title: d.title,
                                  source_text: d.source_text || "",
                                  page: d.page,
                                })
                              }
                            >
                              Evidence ↗
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Financial Terms */}
                <div className="surface-card analysis-card">
                  <span className="eyebrow">Section 5</span>
                  <h3>Financial & Payment Terms</h3>
                  {data.financial_terms.length === 0 ? (
                    <p className="text-muted">No financial terms identified in the provided document.</p>
                  ) : (
                    <ul className="info-list">
                      {data.financial_terms.map((f, idx) => (
                        <li key={idx}>
                          <strong>{f.term}:</strong> {f.amount_or_rate} — {f.details}
                          {f.source_text && (
                            <button
                              type="button"
                              className="evidence-inline-btn"
                              onClick={() =>
                                setInspectedEvidence({
                                  title: f.term,
                                  source_text: f.source_text || "",
                                  page: f.page,
                                })
                              }
                            >
                              Evidence ↗
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Obligations */}
                <div className="surface-card analysis-card">
                  <span className="eyebrow">Section 6</span>
                  <h3>Key Obligations</h3>
                  {data.obligations.length === 0 ? (
                    <p className="text-muted">No obligations identified in the provided document.</p>
                  ) : (
                    <ul className="info-list">
                      {data.obligations.slice(0, 5).map((o, idx) => (
                        <li key={idx}>
                          <strong>{o.party}:</strong> {o.obligation}
                          {o.source_text && (
                            <button
                              type="button"
                              className="evidence-inline-btn"
                              onClick={() =>
                                setInspectedEvidence({
                                  title: `Obligation: ${o.party}`,
                                  source_text: o.source_text || "",
                                  page: o.page,
                                })
                              }
                            >
                              Evidence ↗
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Rights */}
                <div className="surface-card analysis-card">
                  <span className="eyebrow">Section 7</span>
                  <h3>Key Rights & Options</h3>
                  {data.rights.length === 0 ? (
                    <p className="text-muted">No rights identified in the provided document.</p>
                  ) : (
                    <ul className="info-list">
                      {data.rights.slice(0, 5).map((r, idx) => (
                        <li key={idx}>
                          <strong>{r.party}:</strong> {r.right}
                          {r.source_text && (
                            <button
                              type="button"
                              className="evidence-inline-btn"
                              onClick={() =>
                                setInspectedEvidence({
                                  title: `Right: ${r.party}`,
                                  source_text: r.source_text || "",
                                  page: r.page,
                                })
                              }
                            >
                              Evidence ↗
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Risks Assessment */}
          {activeTab === "risks" && (
            <div
              className="analysis-tab-content"
              id="tabpanel-risks"
              role="tabpanel"
              aria-labelledby="tab-risks"
            >
              {/* Severity Metrics summary */}
              <div className="risk-metrics-row">
                <div className="risk-metric-box metric-critical">
                  <span>CRITICAL RISKS</span>
                  <strong>{criticalRisks.length}</strong>
                </div>
                <div className="risk-metric-box metric-high">
                  <span>HIGH RISKS</span>
                  <strong>{highRisks.length}</strong>
                </div>
                <div className="risk-metric-box metric-medium">
                  <span>MEDIUM RISKS</span>
                  <strong>{mediumRisks.length}</strong>
                </div>
                <div className="risk-metric-box metric-low">
                  <span>LOW RISKS</span>
                  <strong>{lowRisks.length}</strong>
                </div>
              </div>

              {data.risks.length === 0 ? (
                <div className="doc-empty-state">
                  <h3>No risks identified.</h3>
                  <p>No high or critical liability provisions were identified based strictly on the text.</p>
                </div>
              ) : (
                <div className="risks-cards-list">
                  {data.risks.map((risk: RiskItem, idx: number) => {
                    const sevClass = `severity-${risk.severity.toLowerCase()}`;
                    return (
                      <article key={idx} className={`risk-card ${sevClass}`}>
                        <div className="risk-header">
                          <span className={`risk-pill ${sevClass}`}>{risk.severity}</span>
                          <h3>{risk.title}</h3>
                          <span className="source-meta" style={{ marginLeft: "auto" }}>
                            {risk.page ? `Page ${risk.page}` : "Page not specified"}
                            {risk.section ? ` • ${risk.section}` : ""}
                          </span>
                        </div>

                        <div className="risk-why-box" style={{ marginTop: "6px" }}>
                          <strong style={{ fontSize: "11px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: "4px" }}>
                            Why this matters:
                          </strong>
                          <p className="risk-explanation" style={{ margin: 0 }}>{risk.explanation}</p>
                        </div>

                        {risk.suggested_review_action && (
                          <div className="risk-action-box">
                            <strong>Recommended Counsel Action: </strong>
                            <span>{risk.suggested_review_action}</span>
                          </div>
                        )}

                        <div className="risk-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            {selectedDocId && risk.page && (
                              <Link
                                href={`/documents/${selectedDocId}#page-${risk.page}`}
                                className="secondary-button-link"
                                style={{ fontSize: "11px", textDecoration: "none" }}
                              >
                                View in Document →
                              </Link>
                            )}
                            <Link
                              href={`/assistant?doc=${selectedDocId}&query=${encodeURIComponent("What should we negotiate regarding this risk: " + risk.title)}`}
                              className="secondary-button-link"
                              style={{ fontSize: "11px", textDecoration: "none" }}
                            >
                              Ask AI ↗
                            </Link>
                          </div>

                          <button
                            type="button"
                            className="view-source-btn"
                            onClick={() =>
                              setInspectedEvidence({
                                title: risk.title,
                                source_text: risk.source_text,
                                page: risk.page,
                                section: risk.section,
                                confidence: risk.confidence,
                                explanation: risk.explanation,
                                action: risk.suggested_review_action,
                              })
                            }
                          >
                            Inspect Verbatim Evidence ↗
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Clauses & Terms */}
          {activeTab === "clauses" && (
            <div
              className="analysis-tab-content"
              id="tabpanel-clauses"
              role="tabpanel"
              aria-labelledby="tab-clauses"
            >
              {data.important_clauses.length === 0 ? (
                <div className="doc-empty-state">
                  <h3>No clauses identified.</h3>
                  <p>No specific important clauses were identified in the provided document.</p>
                </div>
              ) : (
                <div className="clauses-cards-list">
                  {data.important_clauses.map((clause: ClauseItem, idx: number) => (
                    <article key={idx} className="clause-card">
                      <div className="clause-card-header">
                        <div>
                          <span className="clause-type-tag">{clause.clause_type}</span>
                          <h3>{clause.title}</h3>
                        </div>
                        <div className="clause-badges">
                          <span className="importance-badge">Importance: {clause.importance}</span>
                          <span className={`risk-level-badge risk-${clause.risk_level.toLowerCase()}`}>
                            Risk: {clause.risk_level}
                          </span>
                        </div>
                      </div>
                      <p className="clause-explanation">{clause.explanation}</p>
                      <div className="verbatim-quote-box">
                        <span className="quote-label">VERBATIM CONTRACT TEXT:</span>
                        <p>&ldquo;{clause.original_text}&rdquo;</p>
                      </div>
                      <div className="clause-card-footer">
                        <span className="source-meta">
                          {clause.page ? `Page ${clause.page}` : "Page not specified"}
                          {clause.section ? ` • ${clause.section}` : ""}
                        </span>
                        <button
                          type="button"
                          className="view-source-btn"
                          onClick={() =>
                            setInspectedEvidence({
                              title: `${clause.clause_type}: ${clause.title}`,
                              source_text: clause.original_text,
                              page: clause.page,
                              section: clause.section,
                              explanation: clause.explanation,
                            })
                          }
                        >
                          Full Evidence View ↗
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: Contract Covenants & Protections */}
          {activeTab === "covenants" && (
            <div
              className="analysis-tab-content"
              id="tabpanel-covenants"
              role="tabpanel"
              aria-labelledby="tab-covenants"
            >
              <div className="covenants-grid">
                {/* Confidentiality */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 10</span>
                  <h3>Confidentiality & Non-Disclosure</h3>
                  <p><strong>Scope:</strong> {data.confidentiality.definition_scope}</p>
                  <p><strong>Duration:</strong> {data.confidentiality.duration}</p>
                  <p><strong>Exclusions:</strong> {data.confidentiality.standard_exclusions}</p>
                  {data.confidentiality.source_text && (
                    <button
                      type="button"
                      className="evidence-inline-btn"
                      onClick={() =>
                        setInspectedEvidence({
                          title: "Confidentiality Provision",
                          source_text: data.confidentiality.source_text || "",
                          page: data.confidentiality.page,
                        })
                      }
                    >
                      Inspect Source Evidence ↗
                    </button>
                  )}
                </article>

                {/* Liability */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 11</span>
                  <h3>Limitation of Liability</h3>
                  <p><strong>Damage Caps:</strong> {data.liability.caps}</p>
                  <p><strong>Consequential Damages:</strong> {data.liability.consequential_damages_exclusion}</p>
                  <p><strong>Carveouts:</strong> {data.liability.carveouts}</p>
                  {data.liability.source_text && (
                    <button
                      type="button"
                      className="evidence-inline-btn"
                      onClick={() =>
                        setInspectedEvidence({
                          title: "Limitation of Liability Provision",
                          source_text: data.liability.source_text || "",
                          page: data.liability.page,
                        })
                      }
                    >
                      Inspect Source Evidence ↗
                    </button>
                  )}
                </article>

                {/* Indemnification */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 12</span>
                  <h3>Indemnification Obligations</h3>
                  <p><strong>Scope:</strong> {data.indemnity.scope}</p>
                  <p><strong>Covered Parties:</strong> {data.indemnity.covered_parties}</p>
                  <p><strong>Procedure:</strong> {data.indemnity.procedure}</p>
                </article>

                {/* Intellectual Property */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 13</span>
                  <h3>Intellectual Property & Licenses</h3>
                  <p><strong>IP Ownership:</strong> {data.intellectual_property.ownership}</p>
                  <p><strong>Work for Hire:</strong> {data.intellectual_property.work_for_hire}</p>
                  <p><strong>License Grant:</strong> {data.intellectual_property.license_grant}</p>
                </article>

                {/* Governing Law & Jurisdiction */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 14 & 15</span>
                  <h3>Governing Law & Jurisdiction</h3>
                  <p><strong>Governing Law:</strong> {data.governing_law.governing_state_or_nation}</p>
                  <p><strong>Court Venue:</strong> {data.jurisdiction.court_venue}</p>
                  <p><strong>Exclusivity:</strong> {data.jurisdiction.exclusive}</p>
                </article>

                {/* Dispute Resolution */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 16</span>
                  <h3>Dispute Resolution & Escalation</h3>
                  <p><strong>Mechanism:</strong> {data.dispute_resolution.mechanism}</p>
                  <p><strong>Escalation Steps:</strong> {data.dispute_resolution.escalation_steps}</p>
                  <p><strong>Rules:</strong> {data.dispute_resolution.rules}</p>
                </article>

                {/* Warranties & Representations */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 17 & 18</span>
                  <h3>Warranties & Disclaimers</h3>
                  <p><strong>Warranties:</strong> {data.warranties.express_warranties}</p>
                  <p><strong>Disclaimers:</strong> {data.warranties.disclaimers}</p>
                  <p><strong>Corporate Authority:</strong> {data.representations.corporate_authority}</p>
                </article>

                {/* Data Protection & Privacy */}
                <article className="surface-card covenant-card">
                  <span className="eyebrow">Section 21</span>
                  <h3>Data Protection & Security</h3>
                  <p><strong>Applicable:</strong> {data.data_protection.applicable}</p>
                  <p><strong>Security Standards:</strong> {data.data_protection.security_standards}</p>
                  <p><strong>Breach Notice Window:</strong> {data.data_protection.breach_notification_window}</p>
                </article>
              </div>
            </div>
          )}

          {/* TAB 5: Missing Terms & Gaps */}
          {activeTab === "gaps" && (
            <div
              className="analysis-tab-content"
              id="tabpanel-gaps"
              role="tabpanel"
              aria-labelledby="tab-gaps"
            >
              <div className="surface-card analysis-card">
                <div className="card-heading">
                  <div>
                    <span className="eyebrow">Section 24</span>
                    <h2>Omitted Provisions & Ambiguities</h2>
                  </div>
                </div>
                <p className="text-muted" style={{ marginBottom: "16px" }}>
                  Items typically expected in this agreement class that were absent or unclearly drafted.
                </p>
                {data.missing_or_unclear_information.length === 0 ? (
                  <p className="text-green">No major omissions detected in the document.</p>
                ) : (
                  <ul className="omissions-list" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                    {data.missing_or_unclear_information.map((item, idx: number) => (
                      <li
                        key={idx}
                        style={{
                          background: "var(--card-bg-subtle)",
                          border: "1px solid var(--line)",
                          borderRadius: "8px",
                          padding: "14px 18px",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "12px",
                        }}
                      >
                        <span className="omission-marker">⚠️</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                            <strong style={{ color: "var(--ink)", fontSize: "14px" }}>{item.term}</strong>
                            {(item.page != null || item.section) && (
                              <span style={{ fontSize: "11px", color: "var(--muted)", fontFamily: "monospace" }}>
                                {item.page != null ? `Page ${item.page}` : ""}
                                {item.page != null && item.section ? " • " : ""}
                                {item.section ? `Sec: ${item.section}` : ""}
                              </span>
                            )}
                          </div>
                          <p style={{ margin: 0, color: "var(--muted)", fontSize: "13px" }}>{item.explanation}</p>
                          {item.source_text && (
                            <div style={{ marginTop: "6px", fontSize: "12px", background: "var(--surface)", padding: "6px 10px", borderLeft: "2px solid var(--amber)", color: "var(--ink)", fontFamily: "monospace" }}>
                              &ldquo;{item.source_text}&rdquo;
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Evidence Inspector Drawer / Modal */}
      {inspectedEvidence && (
        <div className="evidence-modal-backdrop" onClick={() => setInspectedEvidence(null)}>
          <div className="evidence-modal" onClick={(e) => e.stopPropagation()}>
            <div className="evidence-modal-header">
              <div>
                <span className="eyebrow">Source Evidence Verification</span>
                <h2>{inspectedEvidence.title}</h2>
              </div>
              <button
                type="button"
                className="close-modal-btn"
                onClick={() => setInspectedEvidence(null)}
                aria-label="Close evidence inspector"
              >
                ✕
              </button>
            </div>

            <div className="evidence-modal-body">
              <div className="evidence-citation-meta">
                <span>
                  <strong>Page: </strong>
                  {inspectedEvidence.page ? `Page ${inspectedEvidence.page}` : "Page not specified"}
                </span>
                {inspectedEvidence.section && (
                  <span>
                    <strong>Section: </strong>
                    {inspectedEvidence.section}
                  </span>
                )}
                {inspectedEvidence.confidence && (
                  <span>
                    <strong>Confidence: </strong>
                    {(inspectedEvidence.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              <div className="verbatim-evidence-container">
                <span className="quote-label">VERBATIM SOURCE TEXT EXTRACTED FROM DOCUMENT:</span>
                <blockquote className="evidence-blockquote">
                  &ldquo;{inspectedEvidence.source_text}&rdquo;
                </blockquote>
              </div>

              {inspectedEvidence.explanation && (
                <div className="evidence-analysis-box">
                  <strong>AI Explanation:</strong>
                  <p>{inspectedEvidence.explanation}</p>
                </div>
              )}

              {inspectedEvidence.action && (
                <div className="risk-action-box" style={{ marginTop: "12px" }}>
                  <strong>Recommended Review Action:</strong>
                  <p>{inspectedEvidence.action}</p>
                </div>
              )}
            </div>

            <div className="evidence-modal-footer">
              <button
                type="button"
                className="primary-button"
                onClick={() => setInspectedEvidence(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function AnalysisPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="doc-loading-state">
            <span className="upload-spinner" />
            <span>Loading Analysis Workspace...</span>
          </div>
        </AppShell>
      }
    >
      <AnalysisContent />
    </Suspense>
  );
}