"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  DownloadIcon,
  ExternalLinkIcon,
  FileTextIcon,
  SearchIcon,
  SparklesIcon,
} from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  listReports,
  listDocuments,
  type ReportItem as ApiReportItem,
} from "@/lib/api-client";

interface ReportDisplayItem {
  id: string;
  docId: string;
  analysisId?: string | null;
  versionId?: string | null;
  name: string;
  docName: string;
  fileType: string;
  created: string;
  status: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  riskScore?: number;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [reportsData, setReportsData] = useState<ApiReportItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!user) return;

    listReports()
      .then((data) => {
        if (isMounted) setReportsData(data);
      })
      .catch(async () => {
        // Fallback gracefully to listDocuments if reports endpoint is unreachable
        try {
          const docs = await listDocuments();
          if (isMounted) {
            const fallbackReports: ApiReportItem[] = docs.map((doc) => ({
              id: `rep-${doc.id}`,
              document_id: doc.id,
              document_name: doc.name,
              format: "pdf",
              status: doc.processing_status === "ready" ? "COMPLETED" : "PROCESSING",
              risk_level: "LOW",
              risk_score: 0,
              created_at: doc.created_at,
            }));
            setReportsData(fallbackReports);
          }
        } catch {
          if (isMounted) setReportsData([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const handleDocDeleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; name: string }>;
      const deletedId = customEvent.detail?.id;
      if (deletedId) {
        setReportsData((prev) => prev.filter((d) => d.document_id !== deletedId));
      }
    };
    window.addEventListener("legalai:document-deleted", handleDocDeleted);
    return () => window.removeEventListener("legalai:document-deleted", handleDocDeleted);
  }, []);

  const reports: ReportDisplayItem[] = reportsData.map((rep) => ({
    id: rep.id,
    docId: rep.document_id,
    analysisId: rep.analysis_id,
    versionId: rep.version_id,
    name: `Executive Legal Intelligence Brief — ${rep.document_name.replace(/\.[^/.]+$/, "")}`,
    docName: rep.document_name,
    fileType: rep.document_name.split(".").pop()?.toUpperCase() || "PDF",
    created: new Date(rep.created_at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    status: rep.status,
    riskLevel: rep.risk_level,
    riskScore: rep.risk_score,
  }));

  const filteredReports = reports.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.docName.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrint = (_report: ReportDisplayItem) => {
    window.print();
  };

  return (
    <AppShell>
      <div className="reports-page-container">
        {/* Header */}
        <div className="reports-header-bar">
          <div>
            <span className="eyebrow">{language === "hi" ? "निर्यात एवं इंटेलिजेंस" : "Export & Intelligence"}</span>
            <h1 className="reports-title">{language === "hi" ? "कानूनी रिपोर्ट्स" : "Reports"}</h1>
            <p className="reports-subtitle">
              {language === "hi"
                ? "ऑडिट-तैयार कानूनी सारांश, जोखिम मूल्यांकन और प्रिंट करने योग्य कानूनी दस्तावेज।"
                : "Comprehensive AI risk assessments, executive briefings, and printable legal intelligence dossiers."}
            </p>
          </div>

          <div className="reports-header-actions">
            <Link href="/analysis" className="primary-button-modern">
              <SparklesIcon size={15} />
              <span>{language === "hi" ? "नई रिपोर्ट तैयार करें" : "Generate New Report"}</span>
            </Link>
          </div>
        </div>

        {/* Search Toolbar */}
        <div className="reports-toolbar">
          <div className="toolbar-search-wrap" style={{ maxWidth: "420px" }}>
            <SearchIcon size={14} className="toolbar-search-icon" />
            <input
              type="text"
              placeholder={language === "hi" ? "रिपोर्ट या दस्तावेज़ खोजें..." : "Search reports or documents..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="toolbar-search-input"
            />
          </div>
        </div>

        {/* Reports List */}
        {isLoading ? (
          <div className="doc-loading-state">
            <span className="upload-spinner" />
            <p>{language === "hi" ? "रिपोर्ट लोड हो रही हैं..." : "Loading generated reports..."}</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="doc-empty-state">
            <div className="empty-icon">📊</div>
            <h3>{language === "hi" ? "अभी तक कोई रिपोर्ट नहीं बनाई गई" : "No reports generated yet"}</h3>
            <p>
              {language === "hi"
                ? "आपके अपलोड किए गए दस्तावेज़ों पर Gemini AI विश्लेषण चलाने के बाद रिपोर्ट स्वचालित रूप से तैयार की जाती हैं।"
                : "Reports are generated automatically after running Gemini AI analysis on your uploaded documents."}
            </p>
            <Link href="/analysis" className="primary-button-modern" style={{ margin: "0 auto" }}>
              {language === "hi" ? "विश्लेषण कार्यक्षेत्र खोलें →" : "Run Analysis Workspace →"}
            </Link>
          </div>
        ) : (
          <div className="reports-list-grid">
            {filteredReports.map((report) => (
              <div key={report.id} className="report-item-card">
                <div className="report-card-top">
                  <div className="report-card-icon">
                    <FileTextIcon size={20} />
                  </div>
                  <div className="report-card-info">
                    <h3 className="report-name">{report.name}</h3>
                    <div className="report-submeta">
                      <span>{language === "hi" ? "दस्तावेज़:" : "Document:"} <strong>{report.docName}</strong></span>
                      <span className="dot-sep">•</span>
                      <span>{language === "hi" ? "निर्मित:" : "Generated:"} {report.created}</span>
                    </div>
                  </div>
                </div>

                <div className="report-card-footer">
                  <div className="report-badges-wrap">
                    <span className={`status-pill status-${report.status.toLowerCase()}`}>
                      {language === "hi"
                        ? report.status === "COMPLETED" ? "पूर्ण" : report.status === "PROCESSING" ? "प्रसंस्करण जारी" : report.status
                        : report.status}
                    </span>
                    <span className={`risk-pill severity-${report.riskLevel.toLowerCase()}`}>
                      {language === "hi"
                        ? `${report.riskLevel === "LOW" ? "कम" : report.riskLevel === "MEDIUM" ? "मध्यम" : report.riskLevel === "HIGH" ? "उच्च" : "गंभीर"} जोखिम`
                        : `${report.riskLevel} RISK`}
                    </span>
                  </div>

                  <div className="report-actions-wrap">
                    <Link
                      href={`/analysis?document_id=${report.docId}`}
                      className="doc-row-action-btn view-btn"
                    >
                      <ExternalLinkIcon size={12} />
                      <span>{language === "hi" ? "विश्लेषण देखें" : "View Analysis"}</span>
                    </Link>

                    <button
                      type="button"
                      className="doc-row-action-btn"
                      onClick={() => handlePrint(report)}
                      title={language === "hi" ? "PDF रिपोर्ट निर्यात या प्रिंट करें" : "Export or print PDF report"}
                    >
                      <DownloadIcon size={12} />
                      <span>{language === "hi" ? "PDF निर्यात करें" : "Export PDF"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}