"use client";

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { EvidenceModal, type EvidenceData } from "@/components/evidence-modal";
import {
  ArrowUpIcon,
  BarChartIcon,
  CheckCircleIcon,
  CompareIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  LockIcon,
  PlusIcon,
  ShieldAlertIcon,
  SparklesIcon,
  TrashIcon,
  UploadCloudIcon,
  XIcon,
} from "@/components/icons";
import { PasswordPromptModal } from "@/components/password-prompt-modal";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  ApiError,
  createComparison,
  listDocuments,
  uploadDocument,
  type ClauseComparisonItem,
  type ComparisonResponse,
  type DocumentDetail,
  type DocumentItem,
} from "@/lib/api-client";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ComparePage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();

  // Document states for Left (Doc 1) and Right (Doc 2)
  const [docA, setDocA] = useState<DocumentItem | null>(null);
  const [docB, setDocB] = useState<DocumentItem | null>(null);
  const [labelA, setLabelA] = useState("");
  const [labelB, setLabelB] = useState("");

  // Loading & upload states
  const [isUploadingA, setIsUploadingA] = useState(false);
  const [isUploadingB, setIsUploadingB] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareStage, setCompareStage] = useState("Analyzing documents...");
  const [error, setError] = useState<string | null>(null);

  // Available documents in workspace
  const [workspaceDocs, setWorkspaceDocs] = useState<DocumentItem[]>([]);
  const [isSelectOpenA, setIsSelectOpenA] = useState(false);
  const [isSelectOpenB, setIsSelectOpenB] = useState(false);
  const [isReplaceOpenA, setIsReplaceOpenA] = useState(false);
  const [isReplaceOpenB, setIsReplaceOpenB] = useState(false);
  const replaceDropdownRefA = useRef<HTMLDivElement>(null);
  const replaceDropdownRefB = useRef<HTMLDivElement>(null);

  // Close replace dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (replaceDropdownRefA.current && !replaceDropdownRefA.current.contains(e.target as Node)) {
        setIsReplaceOpenA(false);
      }
      if (replaceDropdownRefB.current && !replaceDropdownRefB.current.contains(e.target as Node)) {
        setIsReplaceOpenB(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Password prompt modal state
  const [passwordModalDoc, setPasswordModalDoc] = useState<{
    doc: DocumentItem;
    target: "A" | "B";
  } | null>(null);

  // Comparison result & lifecycle state
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [comparisonStatus, setComparisonStatus] = useState<"idle" | "processing" | "success" | "error">("idle");
  const [clauseFilter, setClauseFilter] = useState<"ALL" | "ADDED" | "REMOVED" | "MODIFIED" | "HIGH_RISK">("ALL");

  // Evidence modal state
  const [activeEvidence, setActiveEvidence] = useState<EvidenceData | null>(null);

  // File input refs
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  // Load workspace documents
  useEffect(() => {
    if (!user) return;
    listDocuments()
      .then((docs) => setWorkspaceDocs(docs))
      .catch((err) => console.error("Failed to load workspace documents:", err));
  }, [user]);

  // Stage timer for comparison animation
  useEffect(() => {
    if (!isComparing) return;
    const stages = [
      "Analyzing document structures...",
      "Comparing clauses and covenants...",
      "Detecting modifications and omissions...",
      "Evaluating legal risk trajectories...",
      "Finalizing side-by-side redline...",
    ];
    let i = 0;
    setCompareStage(stages[0]);
    const timer = setInterval(() => {
      i = (i + 1) % stages.length;
      setCompareStage(stages[i]);
    }, 1200);
    return () => clearInterval(timer);
  }, [isComparing]);

  // Requirement 11 & 12: Clear comparison immediately whenever document selection changes or either document is removed/replaced
  useEffect(() => {
    if (comparison && (!docA || !docB || comparison.doc_a_id !== docA.id || comparison.doc_b_id !== docB.id)) {
      setComparison(null);
      setComparisonStatus("idle");
    }
  }, [docA?.id, docB?.id, comparison]);

  const handleFileUpload = async (file: File, target: "A" | "B") => {
    setError(null);
    setComparison(null);
    setComparisonStatus("idle");
    const setIsUploading = target === "A" ? setIsUploadingA : setIsUploadingB;
    setIsUploading(true);

    try {
      const uploaded = await uploadDocument(file);
      if (target === "A") {
        setDocA(uploaded);
        if (!labelA || labelA === docA?.name) {
          setLabelA(uploaded.name);
        }
        setIsReplaceOpenA(false);
        setIsSelectOpenA(false);
      } else {
        setDocB(uploaded);
        if (!labelB || labelB === docB?.name) {
          setLabelB(uploaded.name);
        }
        setIsReplaceOpenB(false);
        setIsSelectOpenB(false);
      }

      // Check if password required
      if (uploaded.processing_status === "password_required" || uploaded.status === "password_required") {
        setPasswordModalDoc({ doc: uploaded, target });
      }

      // Refresh workspace docs list
      listDocuments().then(setWorkspaceDocs).catch(() => {});
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to upload document.";
      setError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSelectWorkspaceDoc = (selectedDoc: DocumentItem, target: "A" | "B") => {
    setError(null);
    setComparison(null);
    setComparisonStatus("idle");
    if (target === "A") {
      setDocA(selectedDoc);
      if (!labelA || labelA === docA?.name) {
        setLabelA(selectedDoc.name);
      }
      setIsSelectOpenA(false);
      setIsReplaceOpenA(false);
    } else {
      setDocB(selectedDoc);
      if (!labelB || labelB === docB?.name) {
        setLabelB(selectedDoc.name);
      }
      setIsSelectOpenB(false);
      setIsReplaceOpenB(false);
    }

    if (selectedDoc.processing_status === "password_required" || selectedDoc.status === "password_required") {
      setPasswordModalDoc({ doc: selectedDoc, target });
    }
  };

  const handleSwapDocuments = () => {
    // Immediately clear previous comparison result on swap (Requirement 12)
    setComparison(null);
    setComparisonStatus("idle");
    setError(null);

    const prevDocA = docA;
    const prevDocB = docB;
    const prevLabelA = labelA;
    const prevLabelB = labelB;

    setDocA(prevDocB);
    setDocB(prevDocA);
    setLabelA(prevLabelB || (prevDocB ? prevDocB.name : ""));
    setLabelB(prevLabelA || (prevDocA ? prevDocA.name : ""));
  };

  const handleUnlockSuccess = (unlocked: DocumentDetail) => {
    if (!passwordModalDoc) return;
    const target = passwordModalDoc.target;
    if (target === "A") {
      setDocA(unlocked);
    } else {
      setDocB(unlocked);
    }
    setPasswordModalDoc(null);
  };

  const isSameDoc = !!(docA && docB && docA.id === docB.id);
  const canCompare =
    !!docA &&
    !!docB &&
    !isSameDoc &&
    docA.processing_status === "ready" &&
    docB.processing_status === "ready" &&
    !isComparing;

  const handleRunCompare = async () => {
    if (isComparing) return;
    if (!docA || !docB) return;
    if (isSameDoc) {
      setError("Please select two different documents to compare.");
      setComparison(null);
      setComparisonStatus("error");
      return;
    }

    // 1. CLEAR OLD RESULT BEFORE EVERY NEW COMPARISON (Requirement 1 & 5)
    setComparison(null);
    setError(null);
    setIsComparing(true);
    setCompareStage("Analyzing document structures...");
    setComparisonStatus("processing");

    try {
      const res = await createComparison({
        doc_a_id: docA.id,
        doc_b_id: docB.id,
        doc_a_label: labelA.trim() || docA.name,
        doc_b_label: labelB.trim() || docB.name,
      });

      // Requirement 11: Validate document identity matches current selection
      if (res.doc_a_id === docA.id && res.doc_b_id === docB.id) {
        setComparison(res);
        setComparisonStatus("success");
      } else {
        setComparison(null);
        setComparisonStatus("error");
        setError("Comparison result does not match currently selected documents.");
      }
    } catch (err: unknown) {
      // Requirement 2 & 5: FAILED REQUEST = NO RESULT!
      setComparison(null);
      setComparisonStatus("error");
      const msg = err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Comparison failed.";
      setError(msg);
    } finally {
      setIsComparing(false);
    }
  };

  const handleExportSummary = () => {
    if (!comparison) return;
    const resData = comparison.result_data;
    let report = `LEGALAI DOCUMENT COMPARISON REPORT\n`;
    report += `===================================\n`;
    report += `Document 1: ${comparison.doc_a_label}\n`;
    report += `Document 2: ${comparison.doc_b_label}\n`;
    report += `Date: ${new Date(comparison.created_at).toLocaleString()}\n\n`;
    report += `EXECUTIVE SUMMARY\n`;
    report += `-----------------\n`;
    report += `${resData.executive_summary}\n\n`;
    report += `SUMMARY METRICS\n`;
    report += `---------------\n`;
    report += `Total Changes: ${resData.metrics.total_changes}\n`;
    report += `Added Clauses: ${resData.metrics.added_count}\n`;
    report += `Removed Clauses: ${resData.metrics.removed_count}\n`;
    report += `Modified Clauses: ${resData.metrics.modified_count}\n`;
    report += `Overall Risk Impact: ${resData.metrics.overall_risk_impact}\n\n`;
    report += `KEY HIGH-IMPACT CHANGES\n`;
    report += `-----------------------\n`;
    for (const item of resData.important_changes) {
      report += `[${item.severity}] ${item.title} (${item.category})\n`;
      report += `Description: ${item.description}\n`;
      report += `Legal Impact: ${item.legal_impact}\n\n`;
    }
    report += `CLAUSE COMPARISON\n`;
    report += `-----------------\n`;
    for (const c of resData.clause_comparisons) {
      report += `Topic: ${c.topic} [${c.change_type.toUpperCase()}] Risk: ${c.risk_level}${c.risk_score ? ` (Score: ${c.risk_score}/10)` : ""}\n`;
      report += `Summary: ${c.change_summary}\n`;
      if (c.risk_reason) report += `Risk Reason: ${c.risk_reason}\n`;
      if (c.legal_impact) report += `Legal Impact: ${c.legal_impact}\n`;
      if (c.doc_a_text) report += `Doc 1 Excerpt: "${c.doc_a_text}" (Page ${c.doc_a_page ?? "N/A"})\n`;
      if (c.doc_b_text) report += `Doc 2 Excerpt: "${c.doc_b_text}" (Page ${c.doc_b_page ?? "N/A"})\n`;
      report += `\n`;
    }

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Comparison_${comparison.doc_a_label}_vs_${comparison.doc_b_label}.txt`.replace(/[^a-zA-Z0-9._-]/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  // Filter clause items
  const filteredClauses = (comparison?.result_data.clause_comparisons || []).filter((clause) => {
    if (clauseFilter === "ALL") return true;
    if (clauseFilter === "ADDED") return clause.change_type === "added";
    if (clauseFilter === "REMOVED") return clause.change_type === "removed";
    if (clauseFilter === "MODIFIED") return clause.change_type === "modified";
    if (clauseFilter === "HIGH_RISK") return clause.risk_level === "HIGH";
    return true;
  });

  const renderUploadSlot = (
    target: "A" | "B",
    doc: DocumentItem | null,
    setDoc: (d: DocumentItem | null) => void,
    label: string,
    setLabel: (s: string) => void,
    isUploading: boolean,
    isSelectOpen: boolean,
    setIsSelectOpen: (b: boolean) => void,
    isReplaceOpen: boolean,
    setIsReplaceOpen: (b: boolean) => void,
    replaceDropdownRef: React.RefObject<HTMLDivElement | null>,
    fileInputRef: React.RefObject<HTMLInputElement | null>,
    slotTitle: string,
    slotBadge: string,
  ) => {
    return (
      <div className="compare-card" style={{
        background: "var(--surface)",
        border: "1px solid var(--line)",
        borderRadius: "14px",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        position: "relative",
      }}>
        {/* Slot Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              background: target === "A" ? "rgba(59, 130, 246, 0.15)" : "rgba(168, 85, 247, 0.15)",
              color: target === "A" ? "#60a5fa" : "#c084fc",
              padding: "3px 8px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}>
              {slotBadge}
            </span>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>{slotTitle}</h3>
          </div>

          {doc && (
            <div style={{ display: "flex", gap: "8px", position: "relative" }} ref={replaceDropdownRef}>
              <button
                type="button"
                aria-label={`Replace ${slotTitle}`}
                aria-expanded={isReplaceOpen}
                onClick={() => {
                  setIsReplaceOpen(!isReplaceOpen);
                  if (target === "A") setIsReplaceOpenB(false);
                  else setIsReplaceOpenA(false);
                }}
                style={{
                  background: isReplaceOpen ? "rgba(59, 130, 246, 0.15)" : "transparent",
                  border: isReplaceOpen ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "4px 10px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: isReplaceOpen ? "#60a5fa" : "var(--muted)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                Replace
                <span style={{ fontSize: "9px", marginLeft: "2px" }}>{isReplaceOpen ? "▲" : "▼"}</span>
              </button>

              <button
                type="button"
                aria-label={`Remove ${slotTitle}`}
                onClick={() => {
                  setDoc(null);
                  setLabel("");
                  setComparison(null);
                  setComparisonStatus("idle");
                  setError(null);
                  setIsReplaceOpen(false);
                  setIsSelectOpen(false);
                }}
                style={{
                  background: "transparent",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  fontSize: "12px",
                  color: "#ef4444",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <TrashIcon size={13} />
                Remove
              </button>

              {/* Replace Dropdown Popover */}
              {isReplaceOpen && (
                <div
                  className="replace-dropdown-menu"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: "6px",
                    width: "320px",
                    maxWidth: "90vw",
                    background: "var(--panel)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    boxShadow: "0 12px 30px rgba(0, 0, 0, 0.6)",
                    zIndex: 40,
                    overflow: "hidden",
                  }}
                >
                  {/* Upload from Computer Option */}
                  <button
                    type="button"
                    onClick={() => {
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                        fileInputRef.current.click();
                      }
                      setIsReplaceOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      background: "rgba(59, 130, 246, 0.08)",
                      color: "#93c5fd",
                      border: 0,
                      borderBottom: "1px solid var(--line)",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.16)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)")}
                  >
                    <UploadCloudIcon size={16} />
                    <span>Upload from Computer...</span>
                  </button>

                  {/* Workspace Documents Header */}
                  <div
                    style={{
                      padding: "8px 12px 4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--dim)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      background: "var(--card-bg-subtle)",
                    }}
                  >
                    Choose from uploaded documents ({workspaceDocs.length})
                  </div>

                  {/* Workspace Documents List */}
                  <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                    {workspaceDocs.length === 0 ? (
                      <div style={{ padding: "12px", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
                        No documents found in workspace.
                      </div>
                    ) : (
                      workspaceDocs.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            handleSelectWorkspaceDoc(item, target);
                            setIsReplaceOpen(false);
                          }}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            textAlign: "left",
                            background: item.id === doc.id ? "rgba(59, 130, 246, 0.12)" : "transparent",
                            border: 0,
                            borderBottom: "1px solid var(--line-subtle)",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            color: "var(--ink)",
                            fontSize: "13px",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)")}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = item.id === doc.id ? "rgba(59, 130, 246, 0.12)" : "transparent")
                          }
                        >
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "8px" }}>
                            <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</strong>
                            <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                              {formatBytes(item.file_size)} • {item.file_type.toUpperCase()}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "10px",
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background:
                                item.processing_status === "ready" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                              color: item.processing_status === "ready" ? "#34d399" : "#fbbf24",
                              flexShrink: 0,
                            }}
                          >
                            {item.processing_status}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Custom Version Label Input */}
        <div>
          <label style={{ display: "block", fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
            Version Label (Optional)
          </label>
          <input
            type="text"
            placeholder={doc ? doc.name : `e.g. ${target === "A" ? "Original Version (v1)" : "Revised Draft (v2)"}`}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            style={{
              width: "100%",
              background: "var(--input-bg)",
              border: "1px solid var(--input-border)",
              borderRadius: "8px",
              padding: "8px 12px",
              color: "var(--ink)",
              fontSize: "13px",
              outline: "none",
            }}
          />
        </div>

        {/* Selected Document View */}
        {doc ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0], target);
              }
            }}
            style={{
              background: "var(--card-bg-subtle)",
              border: "1px solid var(--line)",
              borderRadius: "10px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "8px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#60a5fa",
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}>
                <FileTextIcon size={20} />
              </div>
              <div style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere", wordBreak: "break-word" }}>
                <p
                  title={doc.name}
                  style={{
                    margin: 0,
                    fontWeight: 500,
                    fontSize: "14px",
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    lineHeight: 1.35,
                  }}
                >
                  {doc.name}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                  {formatBytes(doc.file_size)} • {doc.page_count ? `${doc.page_count} page${doc.page_count > 1 ? "s" : ""}` : doc.file_type.toUpperCase()}
                </p>
              </div>

              {/* Status badge */}
              <div>
                {doc.processing_status === "ready" ? (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(16, 185, 129, 0.15)",
                    color: "#34d399",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    fontWeight: 500,
                  }}>
                    <CheckCircleIcon size={13} />
                    Ready
                  </span>
                ) : doc.processing_status === "password_required" || doc.status === "password_required" ? (
                  <button
                    type="button"
                    onClick={() => setPasswordModalDoc({ doc, target })}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      background: "rgba(245, 158, 11, 0.2)",
                      border: "1px solid rgba(245, 158, 11, 0.4)",
                      color: "#fbbf24",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <LockIcon size={13} />
                    Unlock PDF
                  </button>
                ) : (
                  <span style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "rgba(59, 130, 246, 0.15)",
                    color: "#60a5fa",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "11px",
                  }}>
                    {doc.processing_status}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Upload Dropzone */
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files?.[0]) {
                handleFileUpload(e.dataTransfer.files[0], target);
              }
            }}
            style={{
              border: "2px dashed var(--line)",
              borderRadius: "10px",
              padding: "24px 16px",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--card-bg-subtle)",
              cursor: "pointer",
              transition: "border-color 0.2s ease",
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{
              width: "48px",
              height: "48px",
              borderRadius: "12px",
              background: "rgba(59, 130, 246, 0.1)",
              color: "#60a5fa",
              display: "grid",
              placeItems: "center",
              marginBottom: "12px",
            }}>
              {isUploading ? (
                <SparklesIcon size={24} className="animate-spin" />
              ) : (
                <UploadCloudIcon size={24} />
              )}
            </div>

            <p style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 500 }}>
              {isUploading ? "Uploading & Processing..." : `Upload or drag ${slotTitle}`}
            </p>
            <p style={{ margin: "0 0 12px", fontSize: "12px", color: "var(--muted)" }}>
              Supports PDF (including password-protected), DOCX, TXT
            </p>

            <button
              type="button"
              disabled={isUploading}
              style={{
                background: "rgba(59, 130, 246, 0.15)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                color: "#93c5fd",
                padding: "6px 14px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
            >
              Browse Files
            </button>
          </div>
        )}

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          data-testid={`file-input-${target.toLowerCase()}`}
          style={{ display: "none" }}
          accept=".pdf,.docx,.txt"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              handleFileUpload(e.target.files[0], target);
            }
            e.target.value = "";
          }}
        />

        {/* Workspace Document Selector */}
        {!doc && (
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", margin: "4px 0" }}>
              <div style={{ height: "1px", flex: 1, background: "var(--line)" }} />
              <span style={{ fontSize: "11px", color: "var(--dim)", textTransform: "uppercase" }}>or select from workspace</span>
              <div style={{ height: "1px", flex: 1, background: "var(--line)" }} />
            </div>

            <button
              type="button"
              onClick={() => setIsSelectOpen(!isSelectOpen)}
              style={{
                width: "100%",
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                padding: "8px 12px",
                fontSize: "13px",
                color: "var(--muted)",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              <span>Choose from uploaded documents ({workspaceDocs.length})</span>
              <span style={{ fontSize: "10px" }}>▼</span>
            </button>

            {isSelectOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                marginTop: "4px",
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                maxHeight: "220px",
                overflowY: "auto",
                zIndex: 20,
                boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
              }}>
                {workspaceDocs.length === 0 ? (
                  <div style={{ padding: "12px", fontSize: "12px", color: "var(--muted)", textAlign: "center" }}>
                    No documents found in workspace.
                  </div>
                ) : (
                  workspaceDocs.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectWorkspaceDoc(item, target)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        textAlign: "left",
                        background: "transparent",
                        border: 0,
                        borderBottom: "1px solid var(--line-subtle)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        color: "var(--ink)",
                        fontSize: "13px",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59, 130, 246, 0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginRight: "8px" }}>
                        <strong>{item.name}</strong>
                        <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                          {formatBytes(item.file_size)} • {item.file_type.toUpperCase()}
                        </div>
                      </div>
                      <span style={{
                        fontSize: "10px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: item.processing_status === "ready" ? "rgba(16, 185, 129, 0.15)" : "rgba(245, 158, 11, 0.15)",
                        color: item.processing_status === "ready" ? "#34d399" : "#fbbf24",
                      }}>
                        {item.processing_status}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Requirement 10 & 11: Only render comparison results when the current comparison successfully completed for currently selected documents
  const hasValidComparison = Boolean(
    comparison &&
    comparisonStatus === "success" &&
    !error &&
    !isComparing &&
    docA &&
    docB &&
    comparison.doc_a_id === docA.id &&
    comparison.doc_b_id === docB.id
  );

  return (
    <AppShell>
      <div className="workspace-main" style={{ height: "100%", overflowY: "auto", overflowX: "hidden", padding: "24px", minWidth: 0, maxWidth: "100%" }}>
        <div style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", minWidth: 0 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <span style={{
                  display: "grid",
                  placeItems: "center",
                  width: "34px",
                  height: "34px",
                  borderRadius: "10px",
                  background: "rgba(59, 130, 246, 0.15)",
                  color: "#60a5fa",
                }}>
                  <CompareIcon size={20} />
                </span>
                <h1 style={{ margin: 0, fontSize: "24px", fontWeight: 700 }}>
                  {language === "hi" ? "दस्तावेज़ तुलना" : "Compare Documents"}
                </h1>
              </div>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: "14px" }}>
                {language === "hi"
                  ? "अंतर, जोखिम, खंड और महत्वपूर्ण परिवर्तनों की पहचान के लिए दो कानूनी दस्तावेज़ अपलोड करें।"
                  : "Upload two legal documents to identify differences, risks, clauses, and important changes."}
              </p>
            </div>

            {hasValidComparison && comparison && (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleExportSummary}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "var(--card-bg)",
                    border: "1px solid var(--line)",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    color: "var(--ink)",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <DownloadIcon size={15} />
                  {language === "hi" ? "सारांश निर्यात करें" : "Export Summary"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setComparison(null);
                    setComparisonStatus("idle");
                    setError(null);
                    setDocA(null);
                    setDocB(null);
                    setLabelA("");
                    setLabelB("");
                  }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "rgba(59, 130, 246, 0.12)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    color: "#93c5fd",
                    borderRadius: "8px",
                    padding: "8px 14px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  <PlusIcon size={15} />
                  {language === "hi" ? "नई तुलना" : "New Comparison"}
                </button>
              </div>
            )}
          </div>

          {/* Same Document Warning Banner */}
          {isSameDoc && (
            <div style={{
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "10px",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              color: "#f87171",
              fontSize: "14px",
            }}>
              <ShieldAlertIcon size={18} />
              <span>{language === "hi" ? "तुलना करने के लिए कृपया दो अलग-अलग दस्तावेज़ चुनें।" : "Please select two different documents to compare."}</span>
            </div>
          )}

          {/* Error Banner / Card (Requirement 2 & 16: FAILED REQUEST = NO RESULT) */}
          {error && (
            <div
              data-testid="compare-error-banner"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "12px",
                padding: "18px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#f87171" }}>
                  <ShieldAlertIcon size={20} style={{ flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: "15px" }}>
                    {error.toLowerCase().includes("quota") || error.toLowerCase().includes("rate limit")
                      ? (language === "hi" ? "एआई तुलना अनुपलब्ध" : "AI Comparison Unavailable")
                      : (language === "hi" ? "तुलना अनुपलब्ध" : "Comparison Unavailable")}
                  </span>
                </div>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setError(null)}
                  style={{ background: "transparent", border: 0, color: "#f87171", cursor: "pointer", padding: "4px" }}
                >
                  <XIcon size={16} />
                </button>
              </div>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--ink)", lineHeight: 1.5 }}>
                {error}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                {language === "hi"
                  ? "वर्तमान दस्तावेज़ों की तुलना नहीं की जा सकी। कोई पुराना परिणाम प्रदर्शित नहीं किया जा रहा है।"
                  : "The current documents were not compared. No previous comparison result is being displayed."}
              </p>
            </div>
          )}

          {/* Swap Documents Toolbar (Requirement 12) */}
          {docA && docB && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                aria-label="Swap Document 1 and Document 2"
                onClick={handleSwapDocuments}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--card-bg)",
                  border: "1px solid var(--line)",
                  borderRadius: "6px",
                  padding: "6px 14px",
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#93c5fd",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <CompareIcon size={14} />
                <span>{language === "hi" ? "दस्तावेज़ आपस में बदलें" : "Swap Documents"}</span>
              </button>
            </div>
          )}

          {/* Two Upload Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            {renderUploadSlot(
              "A",
              docA,
              setDocA,
              labelA,
              setLabelA,
              isUploadingA,
              isSelectOpenA,
              setIsSelectOpenA,
              isReplaceOpenA,
              setIsReplaceOpenA,
              replaceDropdownRefA,
              fileInputRefA,
              language === "hi" ? "दस्तावेज़ 1" : "Document 1",
              "ORIGINAL",
            )}

            {renderUploadSlot(
              "B",
              docB,
              setDocB,
              labelB,
              setLabelB,
              isUploadingB,
              isSelectOpenB,
              setIsSelectOpenB,
              isReplaceOpenB,
              setIsReplaceOpenB,
              replaceDropdownRefB,
              fileInputRefB,
              language === "hi" ? "दस्तावेज़ 2" : "Document 2",
              "REVISION",
            )}
          </div>

          {/* Compare Documents Primary Action Bar */}
          <div style={{
            background: "var(--panel)",
            border: "1px solid var(--line)",
            borderRadius: "12px",
            padding: "16px 20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
          }}>
            <div style={{ fontSize: "13px", color: "var(--muted)" }}>
              {!docA || !docB
                ? (language === "hi" ? "तुलना शुरू करने के लिए दोनों दस्तावेज़ चुनें।" : "Select both Document 1 and Document 2 to enable comparison.")
                : isSameDoc
                ? (language === "hi" ? "दोनों स्लॉट एक ही दस्तावेज़ की ओर संकेत कर रहे हैं।" : "Both document slots point to the same document.")
                : docA.processing_status !== "ready" || docB.processing_status !== "ready"
                ? (language === "hi" ? "तुलना करने से पहले दोनों दस्तावेज़ तैयार होने चाहिए।" : "Both documents must be unlocked and READY before comparing.")
                : (language === "hi" ? "अनुबंधों की तुलना के लिए तैयार।" : "Ready to compare contract versions.")}
            </div>

            <button
              type="button"
              disabled={!canCompare}
              onClick={handleRunCompare}
              style={{
                background: canCompare
                  ? "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                  : "rgba(30, 41, 59, 0.6)",
                color: canCompare ? "#ffffff" : "var(--dim)",
                border: 0,
                borderRadius: "8px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                cursor: canCompare ? "pointer" : "not-allowed",
                boxShadow: canCompare ? "0 4px 14px rgba(37, 99, 235, 0.35)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {isComparing ? (
                <>
                  <SparklesIcon size={16} className="animate-spin" />
                  <span>{compareStage}</span>
                </>
              ) : (
                <>
                  <CompareIcon size={16} />
                  <span>{language === "hi" ? "दस्तावेज़ों की तुलना करें" : "Compare Documents"}</span>
                </>
              )}
            </button>
          </div>

          {/* Loading Indicator when comparison is processing (Requirement 9) */}
          {isComparing && (
            <div
              data-testid="compare-loading-indicator"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "14px",
                padding: "36px 20px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px",
              }}
            >
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(59, 130, 246, 0.12)",
                color: "#60a5fa",
                display: "grid",
                placeItems: "center",
              }}>
                <SparklesIcon size={24} className="animate-spin" />
              </div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Comparing documents...</h3>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>{compareStage}</p>
            </div>
          )}

          {/* Comparison Results Section (Requirement 10 & 11: Only rendered when current comparison successfully completed) */}
          {hasValidComparison && comparison && (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", marginTop: "12px" }}>
              {/* Metric Overview Strip */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px" }}>
                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {language === "hi" ? "कुल परिवर्तन" : "Total Changes"}
                  </span>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "#60a5fa", marginTop: "4px" }}>
                    {comparison.result_data.metrics.total_changes}
                  </div>
                </div>

                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {language === "hi" ? "जोड़े गए खंड" : "Added Clauses"}
                  </span>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "#34d399", marginTop: "4px" }}>
                    {comparison.result_data.metrics.added_count}
                  </div>
                </div>

                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {language === "hi" ? "हटाए गए खंड" : "Removed Clauses"}
                  </span>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "#f87171", marginTop: "4px" }}>
                    {comparison.result_data.metrics.removed_count}
                  </div>
                </div>

                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {language === "hi" ? "संशोधित खंड" : "Modified Clauses"}
                  </span>
                  <div style={{ fontSize: "28px", fontWeight: 700, color: "#fbbf24", marginTop: "4px" }}>
                    {comparison.result_data.metrics.modified_count}
                  </div>
                </div>

                <div style={{
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}>
                  <span style={{ fontSize: "12px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {language === "hi" ? "समग्र जोखिम" : "Overall Risk Impact"}
                  </span>
                  <div style={{
                    fontSize: "18px",
                    fontWeight: 700,
                    marginTop: "8px",
                    color:
                      comparison.result_data.metrics.overall_risk_impact === "HIGH"
                        ? "#f87171"
                        : comparison.result_data.metrics.overall_risk_impact === "MEDIUM"
                        ? "#fbbf24"
                        : "#34d399",
                  }}>
                    {language === "hi"
                      ? (comparison.result_data.metrics.overall_risk_impact === "HIGH"
                          ? "उच्च"
                          : comparison.result_data.metrics.overall_risk_impact === "MEDIUM"
                          ? "मध्यम"
                          : "निम्न")
                      : comparison.result_data.metrics.overall_risk_impact}
                  </div>
                </div>
              </div>

              {/* Executive Summary Card */}
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "14px",
                padding: "20px",
              }}>
                {/* Quota / AI Unavailable Banner if applicable */}
                {comparison.result_data.analysis_method === "ai_unavailable" && (
                  <div style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    marginBottom: "14px",
                    fontSize: "13px",
                    color: "#fde68a",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    lineHeight: "1.5",
                  }}>
                    <ShieldAlertIcon size={16} style={{ color: "#fbbf24", flexShrink: 0 }} />
                    <span>
                      {comparison.result_data.ai_status_message ||
                        (language === "hi"
                          ? "एआई तुलना विश्लेषण अस्थायी रूप से अनुपलब्ध है। दस्तावेज़ों का अप्रचलित परिणामों से विश्लेषण नहीं किया गया।"
                          : "AI comparison analysis is temporarily unavailable because the AI service quota/rate limit has been reached. The documents were not analyzed using stale results.")}
                    </span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <SparklesIcon size={18} style={{ color: comparison.result_data.analysis_method === "document_text_comparison" ? "var(--muted)" : "#60a5fa" }} />
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                      {comparison.result_data.analysis_method === "document_text_comparison" || comparison.result_data.analysis_method === "ai_unavailable"
                        ? (language === "hi" ? "कार्यकारी तुलना सारांश" : "Executive Comparison Summary")
                        : (language === "hi" ? "एआई कार्यकारी तुलना सारांश" : "AI Executive Comparison Summary")}
                    </h3>
                  </div>

                  {/* Truthful Analysis Method Badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      background: comparison.result_data.analysis_method === "document_text_comparison"
                        ? "var(--card-bg)"
                        : comparison.result_data.analysis_method === "ai_unavailable"
                        ? "rgba(245, 158, 11, 0.15)"
                        : "rgba(59, 130, 246, 0.15)",
                      border: comparison.result_data.analysis_method === "document_text_comparison"
                        ? "1px solid var(--line)"
                        : comparison.result_data.analysis_method === "ai_unavailable"
                        ? "1px solid rgba(245, 158, 11, 0.35)"
                        : "1px solid rgba(59, 130, 246, 0.35)",
                      color: comparison.result_data.analysis_method === "document_text_comparison"
                        ? "var(--muted)"
                        : comparison.result_data.analysis_method === "ai_unavailable"
                        ? "#fbbf24"
                        : "#93c5fd",
                    }}>
                      {comparison.result_data.analysis_method_label || (
                        comparison.result_data.analysis_method === "document_text_comparison"
                          ? "Document Text Comparison"
                          : comparison.result_data.analysis_method === "ai_unavailable"
                          ? "Text comparison only — AI legal analysis unavailable"
                          : "AI Analysis"
                      )}
                    </span>
                    {comparison.result_data.comparison_source && (
                      <span style={{
                        fontSize: "11px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        background: "var(--surface-hover, rgba(255, 255, 255, 0.04))",
                        border: "1px solid var(--line)",
                        color: "var(--muted)",
                      }}>
                        {comparison.result_data.comparison_source}
                      </span>
                    )}
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.6", color: "var(--ink)" }}>
                  {comparison.result_data.executive_summary}
                </p>
              </div>

              {/* Side-by-Side Clause Comparison */}
              <div style={{
                background: "var(--surface)",
                border: "1px solid var(--line)",
                borderRadius: "14px",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                      {language === "hi" ? "क्लॉज रेडलाइन तुलना" : "Side-by-Side Clause Redline"}
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--muted)" }}>
                      Comparing {comparison.doc_a_label} against {comparison.doc_b_label}
                    </p>
                  </div>

                  {/* Filter Tabs */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {(["ALL", "MODIFIED", "ADDED", "REMOVED", "HIGH_RISK"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setClauseFilter(tab)}
                        style={{
                          background: clauseFilter === tab ? "rgba(59, 130, 246, 0.2)" : "transparent",
                          border: clauseFilter === tab ? "1px solid #3b82f6" : "1px solid var(--line)",
                          color: clauseFilter === tab ? "#93c5fd" : "var(--muted)",
                          padding: "4px 10px",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {tab === "ALL" ? "All Clauses" : tab.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clause List / Table */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {filteredClauses.length === 0 ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                      No clauses match the selected filter.
                    </div>
                  ) : (
                    filteredClauses.map((item, idx) => {
                      const isAdded = item.change_type === "added";
                      const isRemoved = item.change_type === "removed";
                      const isModified = item.change_type === "modified";

                      return (
                        <div
                          key={idx}
                          style={{
                            background: "var(--card-bg-subtle)",
                            border: "1px solid var(--line)",
                            borderRadius: "12px",
                            padding: "18px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "14px",
                            minWidth: 0,
                            maxWidth: "100%",
                          }}
                        >
                          {/* Row Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                              <strong style={{ fontSize: "15px", color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                                {item.topic}
                              </strong>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: isAdded
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : isRemoved
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : isModified
                                  ? "rgba(245, 158, 11, 0.15)"
                                  : "rgba(148, 163, 184, 0.1)",
                                color: isAdded
                                  ? "#34d399"
                                  : isRemoved
                                  ? "#f87171"
                                  : isModified
                                  ? "#fbbf24"
                                  : "#94a3b8",
                              }}>
                                {item.change_type}
                              </span>
                            </div>

                            {item.risk_level && item.risk_level !== "NONE" && (
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: "4px",
                                flexShrink: 0,
                                background:
                                  item.risk_level === "HIGH"
                                    ? "rgba(239, 68, 68, 0.15)"
                                    : item.risk_level === "MEDIUM"
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "rgba(16, 185, 129, 0.15)",
                                color:
                                  item.risk_level === "HIGH"
                                    ? "#f87171"
                                    : item.risk_level === "MEDIUM"
                                    ? "#fbbf24"
                                    : "#34d399",
                              }}>
                                Risk: {item.risk_level}
                              </span>
                            )}
                          </div>

                          {/* Summary of change */}
                          {item.change_summary && (
                            <div style={{
                              fontSize: "13px",
                              color: "var(--ink)",
                              lineHeight: "1.5",
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              whiteSpace: "normal",
                            }}>
                              {item.change_summary}
                            </div>
                          )}

                          {/* Dual Column Side-by-Side View */}
                          <div className="compare-side-by-side-grid">
                            {/* Document 1 Snippet */}
                            <div className="compare-side-col-left">
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                marginBottom: "8px",
                                minWidth: 0,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                  <FileTextIcon size={14} style={{ color: "#60a5fa", flexShrink: 0 }} />
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(59, 130, 246, 0.15)",
                                    color: "#60a5fa",
                                    flexShrink: 0,
                                  }}>
                                    DOCUMENT 1
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>Original</span>
                                  <span
                                    title={docA?.name || comparison.doc_a_label}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 500,
                                      color: "var(--ink)",
                                      minWidth: 0,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                      whiteSpace: "normal",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    • {docA?.name || comparison.doc_a_label}
                                  </span>
                                </div>
                                {item.doc_a_page && (
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>
                                    Page {item.doc_a_page}
                                  </span>
                                )}
                              </div>

                              <div style={{
                                background: "var(--card-bg)",
                                border: "1px solid var(--line-subtle)",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                minWidth: 0,
                                maxWidth: "100%",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: item.doc_a_text ? "var(--ink)" : "var(--dim)",
                                  fontStyle: item.doc_a_text ? "normal" : "italic",
                                  lineHeight: "1.5",
                                }}>
                                  {item.doc_a_text ? `"${item.doc_a_text}"` : "Clause not present in this document."}
                                </p>
                              </div>
                            </div>

                            {/* Document 2 Snippet */}
                            <div className="compare-side-col-right">
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                marginBottom: "8px",
                                minWidth: 0,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                  <FileTextIcon size={14} style={{ color: "#c084fc", flexShrink: 0 }} />
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(192, 132, 252, 0.15)",
                                    color: "#c084fc",
                                    flexShrink: 0,
                                  }}>
                                    DOCUMENT 2
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>Revision</span>
                                  <span
                                    title={docB?.name || comparison.doc_b_label}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 500,
                                      color: "var(--ink)",
                                      minWidth: 0,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                      whiteSpace: "normal",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    • {docB?.name || comparison.doc_b_label}
                                  </span>
                                </div>
                                {item.doc_b_page && (
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>
                                    Page {item.doc_b_page}
                                  </span>
                                )}
                              </div>

                              <div style={{
                                background: "var(--card-bg)",
                                border: "1px solid var(--line-subtle)",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                minWidth: 0,
                                maxWidth: "100%",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: item.doc_b_text ? "var(--ink)" : "var(--dim)",
                                  fontStyle: item.doc_b_text ? "normal" : "italic",
                                  lineHeight: "1.5",
                                }}>
                                  {item.doc_b_text ? `"${item.doc_b_text}"` : "Clause removed from this document."}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Risk Reason & Legal Impact at the bottom */}
                          {(item.risk_reason || item.legal_impact) && (
                            <div style={{
                              background: "var(--card-bg)",
                              border: "1px solid var(--line-subtle)",
                              borderRadius: "8px",
                              padding: "12px 14px",
                              display: "flex",
                              flexDirection: "column",
                              gap: "6px",
                              fontSize: "12px",
                              minWidth: 0,
                              overflowWrap: "anywhere",
                              wordBreak: "break-word",
                              whiteSpace: "normal",
                            }}>
                              {item.legal_impact && (
                                <div style={{ color: "#93c5fd", lineHeight: "1.5" }}>
                                  <strong style={{ color: "#60a5fa", marginRight: "6px" }}>Legal Impact:</strong>
                                  <span>{item.legal_impact}</span>
                                </div>
                              )}
                              {item.risk_reason && (
                                <div style={{ color: "var(--muted)", lineHeight: "1.5" }}>
                                  <strong style={{
                                    color:
                                      item.risk_level === "HIGH"
                                        ? "#f87171"
                                        : item.risk_level === "MEDIUM"
                                        ? "#fbbf24"
                                        : "#60a5fa",
                                    marginRight: "6px",
                                  }}>
                                    Risk Analysis:
                                  </strong>
                                  <span>{item.risk_reason}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Key Important Changes */}
              {comparison.result_data.important_changes?.length > 0 && (
                <div style={{ minWidth: 0, maxWidth: "100%" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: 600, margin: "0 0 12px" }}>
                    {language === "hi" ? "मुख्य कानूनी परिवर्तन एवं जोखिम अंतर" : "Key Legal Changes & Risk Differences"}
                  </h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", minWidth: 0 }}>
                    {comparison.result_data.important_changes.map((item, idx) => {
                      const isAdded = item.title.toLowerCase().includes("added");
                      const isRemoved = item.title.toLowerCase().includes("removed");
                      const changeType = isAdded ? "added" : isRemoved ? "removed" : "modified";

                      return (
                        <div
                          key={idx}
                          style={{
                            background: "var(--panel)",
                            border: "1px solid var(--line)",
                            borderRadius: "14px",
                            padding: "20px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            minWidth: 0,
                            maxWidth: "100%",
                          }}
                        >
                          {/* Row Header */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                              <strong style={{ fontSize: "15px", color: "var(--ink)", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                                {item.title}
                              </strong>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: 600,
                                textTransform: "uppercase",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                background: isAdded
                                  ? "rgba(16, 185, 129, 0.15)"
                                  : isRemoved
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : "rgba(245, 158, 11, 0.15)",
                                color: isAdded
                                  ? "#34d399"
                                  : isRemoved
                                  ? "#f87171"
                                  : "#fbbf24",
                              }}>
                                {changeType}
                              </span>
                            </div>

                            <span style={{
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "4px",
                              flexShrink: 0,
                              background:
                                item.severity === "HIGH"
                                  ? "rgba(239, 68, 68, 0.15)"
                                  : item.severity === "MEDIUM"
                                  ? "rgba(245, 158, 11, 0.15)"
                                  : "rgba(16, 185, 129, 0.15)",
                              color:
                                item.severity === "HIGH"
                                  ? "#f87171"
                                  : item.severity === "MEDIUM"
                                  ? "#fbbf24"
                                  : "#34d399",
                            }}>
                              Risk: {item.severity}
                            </span>
                          </div>

                          {/* Side-by-Side Dual Column Layout */}
                          <div className="compare-side-by-side-grid">
                            {/* Document 1 Column */}
                            <div className="compare-side-col-left">
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                marginBottom: "8px",
                                minWidth: 0,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                  <FileTextIcon size={14} style={{ color: "#60a5fa", flexShrink: 0 }} />
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(59, 130, 246, 0.15)",
                                    color: "#60a5fa",
                                    flexShrink: 0,
                                  }}>
                                    DOCUMENT 1
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>Original</span>
                                  <span
                                    title={docA?.name || comparison.doc_a_label}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 500,
                                      color: "var(--ink)",
                                      minWidth: 0,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                      whiteSpace: "normal",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    • {docA?.name || comparison.doc_a_label}
                                  </span>
                                </div>
                              </div>

                              <div style={{
                                background: "var(--card-bg)",
                                border: "1px solid var(--line-subtle)",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                minWidth: 0,
                                maxWidth: "100%",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: isAdded ? "var(--dim)" : "var(--ink)",
                                  fontStyle: isAdded ? "italic" : "normal",
                                  lineHeight: "1.5",
                                }}>
                                  {isAdded
                                    ? "Provision not present in baseline draft."
                                    : `Baseline terms under ${item.category || item.title}.`}
                                </p>
                              </div>
                            </div>

                            {/* Document 2 Column */}
                            <div className="compare-side-col-right">
                              <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "8px",
                                marginBottom: "8px",
                                minWidth: 0,
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                                  <FileTextIcon size={14} style={{ color: "#c084fc", flexShrink: 0 }} />
                                  <span style={{
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    textTransform: "uppercase",
                                    padding: "2px 6px",
                                    borderRadius: "4px",
                                    background: "rgba(192, 132, 252, 0.15)",
                                    color: "#c084fc",
                                    flexShrink: 0,
                                  }}>
                                    DOCUMENT 2
                                  </span>
                                  <span style={{ fontSize: "11px", color: "var(--muted)", flexShrink: 0 }}>Revision</span>
                                  <span
                                    title={docB?.name || comparison.doc_b_label}
                                    style={{
                                      fontSize: "12px",
                                      fontWeight: 500,
                                      color: "var(--ink)",
                                      minWidth: 0,
                                      overflowWrap: "anywhere",
                                      wordBreak: "break-word",
                                      whiteSpace: "normal",
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    • {docB?.name || comparison.doc_b_label}
                                  </span>
                                </div>
                              </div>

                              <div style={{
                                background: "var(--card-bg)",
                                border: "1px solid var(--line-subtle)",
                                borderRadius: "8px",
                                padding: "12px 14px",
                                minWidth: 0,
                                maxWidth: "100%",
                                overflowWrap: "anywhere",
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                              }}>
                                <p style={{
                                  margin: 0,
                                  fontSize: "13px",
                                  color: isRemoved ? "var(--dim)" : "var(--ink)",
                                  fontStyle: isRemoved ? "italic" : "normal",
                                  lineHeight: "1.5",
                                }}>
                                  {isRemoved ? "Provision removed in revision." : <span>{item.description}</span>}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Legal Impact & Risk Analysis Bottom Block */}
                          <div style={{
                            background: "var(--card-bg-subtle)",
                            border: "1px solid var(--line-subtle)",
                            borderRadius: "8px",
                            padding: "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            fontSize: "12px",
                            minWidth: 0,
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                            whiteSpace: "normal",
                          }}>
                            {item.legal_impact && (
                              <div style={{ color: "#93c5fd", lineHeight: "1.5" }}>
                                <strong style={{ color: "#60a5fa", marginRight: "6px" }}>Legal Impact:</strong>
                                <span>{item.legal_impact}</span>
                              </div>
                            )}
                            <div style={{ color: "var(--ink)", lineHeight: "1.5" }}>
                              <strong style={{
                                color:
                                  item.severity === "HIGH"
                                    ? "#f87171"
                                    : item.severity === "MEDIUM"
                                    ? "#fbbf24"
                                    : "#60a5fa",
                                marginRight: "6px",
                              }}>
                                Risk Analysis:
                              </strong>
                              <span>{item.severity} risk trajectory in {item.category || item.title}.</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>

      {/* Password Prompt Modal for Protected PDFs */}
      <PasswordPromptModal
        isOpen={!!passwordModalDoc}
        document={passwordModalDoc?.doc ?? null}
        onSuccess={handleUnlockSuccess}
        onCancel={() => setPasswordModalDoc(null)}
      />

      {/* Grounded Citation Modal */}
      <EvidenceModal
        evidence={activeEvidence}
        onClose={() => setActiveEvidence(null)}
      />
    </AppShell>
  );
}

