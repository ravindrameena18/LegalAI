import React from "react";
import {
  BarChartIcon,
  CheckCircleIcon,
  CompareIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  LockIcon,
  ScaleIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "@/components/icons";

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  content: React.ReactNode;
  tags: string[];
}

export interface FaqItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category?: string;
  tags: string[];
}

export interface HelpCategoryItem {
  id: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
  description: string;
}

export interface HelpNavGroup {
  label: string;
  items: HelpCategoryItem[];
}

export const HELP_NAV_GROUPS: HelpNavGroup[] = [
  {
    label: "GETTING STARTED",
    items: [
      {
        id: "getting-started",
        label: "Getting Started",
        icon: HomeIcon,
        description: "Platform overview, upload workflows, and document statuses",
      },
      {
        id: "ai-copilot",
        label: "Dashboard & AI Copilot",
        icon: SparklesIcon,
        description: "Document-grounded chat, suggested prompts, and citations",
      },
      {
        id: "documents",
        label: "Documents",
        icon: UploadCloudIcon,
        description: "Storage, processing stages, and document lifecycle",
      },
      {
        id: "compare",
        label: "Compare Documents",
        icon: CompareIcon,
        description: "Contract redlining, diff metrics, and risk trajectory",
      },
      {
        id: "reports",
        label: "Reports",
        icon: BarChartIcon,
        description: "Executive intelligence briefs, risk scoring, and PDF export",
      },
    ],
  },
  {
    label: "LEGALAI FEATURES",
    items: [
      {
        id: "analysis",
        label: "Document Analysis",
        icon: FileTextIcon,
        description: "24-section legal breakdown, risks, covenants, and missing terms",
      },
      {
        id: "ai-analysis",
        label: "AI & Analysis",
        icon: SparklesIcon,
        description: "Gemini models, temperature, and strict zero-hallucination grounding",
      },
      {
        id: "workspaces",
        label: "Lawyer & Client Workspaces",
        icon: CheckCircleIcon,
        description: "Role navigation and available capabilities",
      },
      {
        id: "legal-research",
        label: "Legal Research",
        icon: ScaleIcon,
        description: "Statutory provisions, Old Law ↔ Current Law transitions, and Supreme Court precedents",
      },
    ],
  },
  {
    label: "SUPPORT",
    items: [
      {
        id: "privacy",
        label: "Privacy & Security",
        icon: LockIcon,
        description: "Tenancy isolation, volatile memory-only passwords, and data safety",
      },
      {
        id: "troubleshooting",
        label: "Troubleshooting",
        icon: ShieldAlertIcon,
        description: "Resolving upload, unlock, analysis, and API issues",
      },
      {
        id: "faq",
        label: "Frequently Asked Questions",
        icon: HelpCircleIcon,
        description: "Common questions and verified answers",
      },
    ],
  },
];

export const HELP_FAQS: FaqItem[] = [
  {
    id: "faq-1",
    question: "What file types are supported?",
    category: "getting-started",
    answer: (
      <p>
        LegalAI currently supports <strong>PDF (.pdf)</strong> (including password-protected PDFs), <strong>Word documents (.docx)</strong>, and <strong>Plain Text files (.txt)</strong>. Uploaded files must be under 50 MB in size.
      </p>
    ),
    tags: ["file types", "pdf", "docx", "txt", "format", "upload", "size limit"],
  },
  {
    id: "faq-2",
    question: "How do I upload a document?",
    category: "documents",
    answer: (
      <p>
        You can upload a document by navigating to the <strong>Documents</strong> section or using the quick upload widget on your <strong>Dashboard</strong>. Drag and drop your file into the designated upload dropzone, or click <strong>Browse Files</strong>. Once uploaded, the document begins processing automatically.
      </p>
    ),
    tags: ["upload", "documents", "dashboard", "browse", "drag and drop"],
  },
  {
    id: "faq-3",
    question: "Can LegalAI process password-protected PDFs?",
    category: "getting-started",
    answer: (
      <p>
        Yes. When you upload a password-protected PDF, LegalAI detects the encryption and displays a <strong>Password-Protected PDF</strong> prompt. After you enter the correct password, the document is unlocked and processed into your workspace with a <strong>Ready</strong> status.
      </p>
    ),
    tags: ["password", "protected", "pdf", "encryption", "unlock"],
  },
  {
    id: "faq-4",
    question: "Does LegalAI store my PDF password?",
    category: "privacy",
    answer: (
      <p>
        <strong>No.</strong> PDF passwords are used strictly in-memory during the temporary decryption and text extraction step. The password is never stored in the database, never logged, and never included in any API responses.
      </p>
    ),
    tags: ["password", "security", "privacy", "storage", "pdf"],
  },
  {
    id: "faq-5",
    question: "Can I ask questions about my document?",
    category: "ai-copilot",
    answer: (
      <p>
        Yes! In the <strong>AI Copilot</strong> (accessible directly on your Dashboard or in individual chat sessions), select any uploaded document from the context bar. You can then ask natural language questions, click suggested prompts, and receive answers grounded directly in the document with cited source excerpts.
      </p>
    ),
    tags: ["chat", "ai", "copilot", "ask", "questions", "grounding"],
  },
  {
    id: "faq-6",
    question: "Can I compare two documents?",
    category: "compare",
    answer: (
      <p>
        Yes. Visit the <strong>Compare</strong> page to redline two contract versions (e.g. Original Draft vs. Revised Draft). You can either upload new files or select existing workspace documents. LegalAI identifies added, removed, and modified clauses, assesses risk impact, and presents a side-by-side redline.
      </p>
    ),
    tags: ["compare", "redline", "diff", "clauses", "versions"],
  },
  {
    id: "faq-7",
    question: "Why can't I compare the same document twice?",
    category: "compare",
    answer: (
      <p>
        Comparison is designed to detect meaningful contractual and legal differences between distinct drafts or agreements. If both slots point to the same document, LegalAI displays the message <em>&quot;Please select two different documents to compare.&quot;</em> and keeps the Compare button disabled to prevent redundant compute. You can use the <strong>[Replace]</strong> button on either slot to choose a different document.
      </p>
    ),
    tags: ["compare", "same document", "duplicate", "warning", "disabled"],
  },
  {
    id: "faq-8",
    question: "What does High Risk mean?",
    category: "analysis",
    answer: (
      <p>
        A <strong>High Risk</strong> or <strong>Critical Risk</strong> classification indicates the presence of clauses that could significantly shift commercial liability, impose uncapped indemnities, grant unilateral termination, or omit statutory safeguards. Risk levels are deterministic AI-assisted assessments grounded in findings; they should always be reviewed by legal counsel in commercial context.
      </p>
    ),
    tags: ["risk", "high risk", "critical", "classification", "liability"],
  },
  {
    id: "faq-9",
    question: "Can I export a report?",
    category: "reports",
    answer: (
      <p>
        Yes. On the <strong>Reports</strong> page, every completed report includes an <strong>Export PDF</strong> button that triggers your browser&apos;s formatted print and PDF generation view. You can also export comparison text summaries directly from the Compare page using <strong>Export Summary</strong>.
      </p>
    ),
    tags: ["export", "pdf", "reports", "print", "download"],
  },
  {
    id: "faq-10",
    question: 'What does "Not found in the provided document" mean?',
    category: "ai-copilot",
    answer: (
      <p>
        LegalAI is strictly source-grounded. If your question asks about terms, provisions, or entities that do not appear anywhere in the selected contract, the AI explicitly states that the information is not found. This grounding protects you against AI hallucinations and ensures answers rely only on facts in the contract.
      </p>
    ),
    tags: ["not found", "grounding", "chat", "evidence", "hallucination"],
  },
  {
    id: "faq-11",
    question: "Is LegalAI a replacement for a lawyer?",
    category: "workspaces",
    answer: (
      <p>
        <strong>No.</strong> LegalAI is an intelligence assistant built to accelerate document review, flag potential risks, and streamline comparison. AI-generated findings must be reviewed by a qualified legal professional and should not be treated as a substitute for professional legal advice or formal representation.
      </p>
    ),
    tags: ["disclaimer", "replacement", "lawyer", "advice", "attorney"],
  },
  {
    id: "faq-12",
    question: "What should I do if something looks incorrect?",
    category: "troubleshooting",
    answer: (
      <p>
        You can use the <strong>Re-analyze Document</strong> action on the Analysis page to run a fresh, comprehensive evaluation. If an error persists or an API issue occurs, verify that the document is in the <strong>Ready</strong> state and consult the <strong>Troubleshooting</strong> guide.
      </p>
    ),
    tags: ["incorrect", "re-analyze", "troubleshooting", "error", "accuracy"],
  },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // 1. Getting Started
  {
    id: "what-is-legalai",
    category: "getting-started",
    title: "1. What is LegalAI?",
    summary: "Overview of LegalAI's core capabilities, document review engine, and workspace.",
    tags: ["overview", "ai", "legalai", "getting started", "features"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI is an enterprise-grade AI legal copilot designed to help legal counsels, attorneys, and clients review legal agreements with high speed and accuracy. It provides:
        </p>
        <ul className="help-article-points">
          <li><strong>Source-Grounded AI Copilot:</strong> Ask questions about any contract with exact citations to sections and page numbers.</li>
          <li><strong>Structured 24-Section Legal Analysis:</strong> Automated extraction of key clauses, covenants, liability caps, and omissions.</li>
          <li><strong>Deterministic Risk Scoring:</strong> Grounded risk classification (Critical, High, Medium, Low) derived directly from extracted findings.</li>
          <li><strong>Side-by-Side Document Comparison:</strong> Track added, removed, and modified clauses between contract drafts with risk trajectory analysis.</li>
          <li><strong>Executive Intelligence Reports:</strong> On-demand briefs with exportable PDF summaries for internal or client review.</li>
        </ul>
      </>
    ),
  },
  {
    id: "uploading-documents",
    category: "getting-started",
    title: "2. Uploading a Legal Document",
    summary: "Supported formats, size limits, and the upload pipeline.",
    tags: ["upload", "documents", "pdf", "docx", "txt", "processing", "workspace"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI supports standard legal document formats up to 50 MB:
        </p>
        <ul className="help-article-points">
          <li><strong>PDF (.pdf):</strong> Standard PDFs as well as password-encrypted PDFs.</li>
          <li><strong>Word Documents (.docx):</strong> Microsoft Word legal drafts.</li>
          <li><strong>Plain Text (.txt):</strong> Formatted ASCII / UTF-8 text documents.</li>
        </ul>
        <div className="help-callout help-callout-info">
          <SparklesIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Processing Pipeline:</strong> When uploaded, documents are parsed, chunked, and vectorized. Once processing completes, the document status changes to <strong>Ready</strong>, making it instantly available for Chat, Analysis, and Compare.
          </div>
        </div>
      </>
    ),
  },
  {
    id: "password-protected-pdfs",
    category: "getting-started",
    title: "3. Password-Protected PDFs",
    summary: "How encrypted documents are safely handled and processed.",
    tags: ["password", "protected", "pdf", "security", "unlock", "encryption"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI natively supports password-protected PDFs without compromising security:
        </p>
        <ul className="help-article-points">
          <li><strong>Automatic Detection:</strong> When an encrypted PDF is uploaded or selected, the system detects password protection and prompts for the password.</li>
          <li><strong>In-Memory Unlock:</strong> Your password is used solely in memory during decryption and text extraction. It is never written to disk or database tables.</li>
          <li><strong>Immediate Status Transition:</strong> Upon entering the correct password, extraction completes and the document enters the <strong>Ready</strong> state.</li>
          <li><strong>Retry Protection:</strong> If an incorrect password is entered, the modal displays an error message and allows you to retry.</li>
        </ul>
      </>
    ),
  },
  {
    id: "document-statuses",
    category: "getting-started",
    title: "4. Understanding Document Statuses",
    summary: "Definitions of document lifecycle states across LegalAI.",
    tags: ["status", "uploading", "processing", "ready", "failed", "password_required"],
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(59, 130, 246, 0.15)", color: "#60a5fa" }}>UPLOADING</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>File is being transmitted to the secure server storage.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>PROCESSING</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Text extraction, legal chunking, and semantic embedding are actively running.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>READY</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Extraction complete. Fully available for AI Chat, Analysis, Compare, and Reports.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(245, 158, 11, 0.2)", color: "#fbbf24" }}>PASSWORD REQUIRED</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>Encrypted PDF awaiting user password entry to decrypt and process.</span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "baseline" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>FAILED</span>
          <span style={{ fontSize: "13px", color: "var(--muted)" }}>File was corrupted or unreadable. Can be removed and re-uploaded.</span>
        </div>
      </div>
    ),
  },

  // 2. AI Copilot / Chat
  {
    id: "ai-copilot-asking",
    category: "ai-copilot",
    title: "Asking Questions & Grounding",
    summary: "How to interact with the AI Copilot and interpret source citations.",
    tags: ["chat", "copilot", "grounding", "citations", "evidence", "disclaimer", "ai"],
    content: (
      <>
        <p className="help-article-desc">
          The AI Copilot allows you to interrogate contracts conversationally. It is grounded in the active document selected via the Document Context Bar.
        </p>
        <ul className="help-article-points">
          <li><strong>Suggested Questions:</strong> Click pre-built prompts (e.g. <em>&quot;What are the termination conditions?&quot;</em> or <em>&quot;Summarize liability limits&quot;</em>) for quick discovery.</li>
          <li><strong>Evidence & Citations:</strong> Answers highlight specific contract clauses and page numbers as citations.</li>
          <li><strong>&quot;Not found in the provided document&quot;:</strong> If a query references topics absent from the contract, the model explicitly flags that the information is absent rather than guessing.</li>
          <li><strong>New Chat & Sessions:</strong> Click <strong>New Chat</strong> in the sidebar to start a fresh thread. Deleting a chat only deletes the conversation, leaving your uploaded document untouched.</li>
        </ul>
        <div className="help-callout help-callout-warning">
          <ShieldAlertIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Legal Disclaimer:</strong> AI-generated information should be reviewed by a qualified legal professional and should not be treated as a substitute for legal advice.
          </div>
        </div>
      </>
    ),
  },

  // 3. Document Analysis
  {
    id: "document-analysis-guide",
    category: "analysis",
    title: "24-Section Legal Analysis",
    summary: "Navigating comprehensive contract analysis and risk assessments.",
    tags: ["analysis", "clauses", "risks", "covenants", "gaps", "re-analyze"],
    content: (
      <>
        <p className="help-article-desc">
          Document Analysis evaluates agreements across 24 standard legal categories:
        </p>
        <ul className="help-article-points">
          <li><strong>Overview & Summary:</strong> Highlights contract type, governing law, parties, term duration, and executive summary.</li>
          <li><strong>Risks Assessment:</strong> Categorizes legal liabilities into Critical, High, Medium, and Low severity with recommended mitigation.</li>
          <li><strong>Clauses & Terms:</strong> Verbatim extracts and analysis across confidentiality, indemnification, liability caps, and warranties.</li>
          <li><strong>Contract Covenants & Protections:</strong> Identifies positive and negative covenants, audit rights, and remedies.</li>
          <li><strong>Missing Terms & Gaps:</strong> Flags absent protective clauses (e.g. mutual indemnity carveouts, force majeure, notice periods).</li>
          <li><strong>Re-analyze Document:</strong> To control costs, existing completed analyses are reused. Clicking <strong>Re-analyze</strong> forces a fresh Gemini re-evaluation.</li>
        </ul>
      </>
    ),
  },

  // 4. Compare Documents
  {
    id: "compare-documents-guide",
    category: "compare",
    title: "Comparing Contracts & Versions",
    summary: "Side-by-side redlining, risk trajectory, and slot replacement.",
    tags: ["compare", "redline", "diff", "replace", "clauses", "versions"],
    content: (
      <>
        <p className="help-article-desc">
          The <strong>Compare</strong> page allows you to benchmark two contracts (e.g., Original Draft vs. Revised Draft):
        </p>
        <ul className="help-article-points">
          <li><strong>Slot Selection & Replacement:</strong> Upload new files or choose from existing workspace documents. Each slot features an independent <strong>[Replace]</strong> menu allowing instant replacement without affecting the other slot.</li>
          <li><strong>Difference Classification:</strong> Identifies <strong>Added</strong>, <strong>Removed</strong>, <strong>Modified</strong>, and <strong>Unchanged</strong> clauses.</li>
          <li><strong>Risk Delta:</strong> Measures the commercial and legal impact of contract modifications rather than superficial textual word counts.</li>
          <li><strong>Side-by-Side Redline:</strong> Compares excerpts side-by-side with section headings and page citations.</li>
        </ul>
        <div className="help-callout help-callout-warning">
          <ShieldAlertIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Same-Document Restriction:</strong> If both document slots contain the same document, comparison cannot be started. Replace one of the slots with a different document to proceed.
          </div>
        </div>
      </>
    ),
  },

  // 5. Reports
  {
    id: "reports-guide",
    category: "reports",
    title: "Executive Reports & Risk Scoring",
    summary: "Generating intelligence briefs, understanding risk levels, and exporting PDFs.",
    tags: ["reports", "risk score", "critical", "high", "medium", "low", "export", "pdf"],
    content: (
      <>
        <p className="help-article-desc">
          The <strong>Reports</strong> section produces publication-ready Executive Legal Intelligence Briefs:
        </p>
        <ul className="help-article-points">
          <li><strong>Deterministic Risk Scoring:</strong> Overall risk classification is calculated via a grounded mathematical formula based strictly on findings (Critical = 10 pts, High = 5 pts, Medium = 2 pts, Low = 1 pt). The same document findings will always produce the identical risk classification.</li>
          <li><strong>Classification Tiers:</strong>
            <ul style={{ marginTop: "4px", paddingLeft: "16px" }}>
              <li><strong style={{ color: "#ef4444" }}>CRITICAL:</strong> Severe liability or structural risk requiring immediate redrafting.</li>
              <li><strong style={{ color: "#f87171" }}>HIGH RISK:</strong> Material unmitigated commercial exposure or one-sided indemnity.</li>
              <li><strong style={{ color: "#fbbf24" }}>MEDIUM RISK:</strong> Standard commercial provisions needing adjustment or clarification.</li>
              <li><strong style={{ color: "#34d399" }}>LOW RISK:</strong> Minor ambiguities with minimal financial or legal exposure.</li>
            </ul>
          </li>
          <li><strong>Export PDF:</strong> Click <strong>Export PDF</strong> to trigger clean browser-based printing or PDF saving.</li>
          <li><strong>View Analysis:</strong> Seamless link directly to the full 24-section analysis view for in-depth inspection.</li>
        </ul>
      </>
    ),
  },

  // 6. Documents Management
  {
    id: "document-management-guide",
    category: "documents",
    title: "Document Lifecycle & Management",
    summary: "Managing uploads, viewing details, and understanding deletion boundaries.",
    tags: ["documents", "management", "delete", "storage", "lifecycle", "account"],
    content: (
      <>
        <p className="help-article-desc">
          The <strong>Documents</strong> section serves as your central repository for uploaded legal agreements:
        </p>
        <ul className="help-article-points">
          <li><strong>Document Detail & Versions:</strong> View extracted text, chunk count, file size, and upload timestamps.</li>
          <li><strong>Trigger Analysis:</strong> Run initial legal analysis directly from the document row or detail card.</li>
          <li><strong>Deleting Documents:</strong> Deleting a document removes the file from storage and purges its chunks and embeddings. This is distinct from deleting a chat session (which only removes chat message history).</li>
        </ul>
      </>
    ),
  },

  // 7. AI & Analysis
  {
    id: "ai-analysis-guide",
    category: "ai-analysis",
    title: "AI Models, Grounding & Analysis Settings",
    summary: "Understanding Gemini model inference, temperature controls, and prompt grounding.",
    tags: ["ai", "gemini", "temperature", "tokens", "grounding", "risk", "settings"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI uses Gemini multimodal foundation models configured with zero-temperature deterministic parameters for consistent legal analysis:
        </p>
        <ul className="help-article-points">
          <li><strong>Document-Grounding Engine:</strong> Every answer is synthesized directly from parsed contract text rather than general web memories.</li>
          <li><strong>Inference Temperature:</strong> Maintained at 0.0–0.2 to prioritize factual fidelity, strict extraction, and non-hallucinatory evaluation.</li>
          <li><strong>Clause Extraction:</strong> Verbatim quotes preserve legal grammar, cross-references, and statutory phrasing.</li>
        </ul>
      </>
    ),
  },

  // 8. Workspaces
  {
    id: "lawyer-client-workspaces",
    category: "workspaces",
    title: "Lawyer vs. Client Workspace",
    summary: "Role-specific navigation and capabilities available in LegalAI.",
    tags: ["workspaces", "lawyer", "client", "roles", "navigation", "research", "dashboard"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI tailors the navigation experience based on your assigned role:
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px", color: "#60a5fa", fontSize: "14px" }}>Lawyer Workspace</h4>
            <ul className="help-article-points" style={{ paddingLeft: "16px" }}>
              <li><strong>Dashboard:</strong> Integrated AI Copilot and quick document intake.</li>
              <li><strong>Documents:</strong> Full document repository management.</li>
              <li><strong>Compare:</strong> Contract version redlining.</li>
              <li><strong>Analysis:</strong> Full 24-section legal breakdown.</li>
              <li><strong>Legal Research:</strong> Statutory and case law research.</li>
              <li><strong>Reports:</strong> Executive briefs and PDF exports.</li>
            </ul>
          </div>
          <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "10px", padding: "16px" }}>
            <h4 style={{ margin: "0 0 8px", color: "#c084fc", fontSize: "14px" }}>Client Workspace</h4>
            <ul className="help-article-points" style={{ paddingLeft: "16px" }}>
              <li><strong>Dashboard:</strong> Contract intelligence overview and AI Copilot.</li>
              <li><strong>Documents:</strong> Upload and review client agreements.</li>
              <li><strong>Compare:</strong> Benchmark commercial contract terms.</li>
              <li><strong>Reports:</strong> Executive summaries and risk overviews.</li>
            </ul>
          </div>
        </div>
      </>
    ),
  },

  // 9. Legal Research
  {
    id: "legal-research-guide",
    category: "legal-research",
    title: "Source-Grounded Legal Research Engine",
    summary: "Search statutory provisions, Old Law ↔ Current Law transitions, and Supreme Court precedents.",
    tags: ["legal research", "bns", "ipc", "crpc", "bnss", "judgments", "supreme court", "precedents", "statutes"],
    content: (
      <>
        <p className="help-article-desc">
          The <strong>Legal Research</strong> workspace provides source-grounded legal intelligence across Indian penal statutes, civil dispute codes, and apex court precedents:
        </p>
        <ul className="help-article-points">
          <li><strong>Natural Language & Hinglish Search:</strong> Enter natural queries such as <em>&quot;IPC Section 300&quot;</em>, <em>&quot;Section 138 NI Act&quot;</em>, or conduct questions like <em>&quot;dhokhadhadi fraud 420&quot;</em> or <em>&quot;property kabja trespass&quot;</em>.</li>
          <li><strong>Old Law ↔ Current Law Transitions:</strong> Authoritative mappings between colonial-era codes (IPC 1860, CrPC 1973, IEA 1872) and newly enacted statutes (BNS 2023, BNSS 2023, BSA 2023) detailing effective dates, repealed status, and key differences.</li>
          <li><strong>Potentially Relevant Provisions:</strong> Multi-statute identification with statutory effects, essential ingredients, and judicial application notices.</li>
          <li><strong>Precedent Finder:</strong> Dual-column precedent classification separating Supporting Precedents from Contrary / Distinguishing Precedents.</li>
          <li><strong>Zero Hallucination Guarantee:</strong> Direct, clickable links to official Supreme Court and India Code registries without phantom citations.</li>
        </ul>
      </>
    ),
  },

  // 10. Privacy & Security
  {
    id: "privacy-security-guide",
    category: "privacy",
    title: "Privacy, Tenancy & Data Security",
    summary: "How LegalAI protects your legal documents and sensitive information.",
    tags: ["privacy", "security", "tenancy", "rbac", "passwords", "storage", "account"],
    content: (
      <>
        <p className="help-article-desc">
          LegalAI implements strict access controls and isolated storage:
        </p>
        <ul className="help-article-points">
          <li><strong>Workspace Tenancy:</strong> Documents and chat sessions are strictly partitioned by authenticated user and workspace tenancy. Users can only access documents they own or are authorized to review.</li>
          <li><strong>No Password Persistence:</strong> Passwords for protected PDFs are held in volatile memory only during extraction and are never stored in the database or logged.</li>
          <li><strong>Secure Backend Storage:</strong> Documents are stored within the application&apos;s configured secure storage repository.</li>
          <li><strong>Prudent Information Sharing:</strong> We recommend avoiding the upload of unnecessary personal identity numbers unless essential to the legal review.</li>
        </ul>
        <div className="help-callout help-callout-info">
          <CheckCircleIcon size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Human Verification:</strong> While LegalAI uses state-of-the-art grounded AI models, human legal oversight remains necessary before finalizing agreements or executing legal strategies.
          </div>
        </div>
      </>
    ),
  },

  // 11. Troubleshooting
  {
    id: "troubleshooting-guide",
    category: "troubleshooting",
    title: "Troubleshooting Common Issues",
    summary: "Step-by-step resolution for upload, processing, and chat issues.",
    tags: ["troubleshooting", "errors", "upload", "password", "api", "chat", "compare", "reports"],
    content: (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>PDF won&apos;t upload?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Verify that the file is under 50 MB, is a valid .pdf/.docx/.txt format, and your internet connection is stable. If the file is damaged, try re-saving it or re-exporting from your PDF reader.
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>Password-protected PDF unlocking issues?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Ensure you enter the correct user password. If you receive an invalid password error, verify Caps Lock and retry.
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>Analysis not appearing?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Confirm the document has reached the <strong>Ready</strong> state. Then click <strong>Analyze Document</strong> on the Analysis page.
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>Chat Copilot not responding?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Make sure a document is actively selected in the Document Context Bar and the document status is Ready.
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>Compare button disabled?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Check that both Document 1 and Document 2 slots are populated, both documents are <strong>Ready</strong>, and you have not selected the exact same document in both slots.
          </p>
        </div>
        <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "14px" }}>
          <strong style={{ color: "var(--ink)", fontSize: "14px" }}>Report not generating?</strong>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: "13px" }}>
            Reports require a completed document analysis first. Navigate to <strong>Analysis</strong> to trigger and complete the evaluation before generating the executive brief.
          </p>
        </div>
      </div>
    ),
  },
];

import { HELP_NAV_GROUPS_HI, HELP_FAQS_HI, HELP_ARTICLES_HI } from "./help-data-hi";

export function getHelpNavGroups(isHindi?: boolean): HelpNavGroup[] {
  return isHindi ? HELP_NAV_GROUPS_HI : HELP_NAV_GROUPS;
}

export function getHelpFaqs(isHindi?: boolean): FaqItem[] {
  return isHindi ? HELP_FAQS_HI : HELP_FAQS;
}

export function getHelpArticles(isHindi?: boolean): HelpArticle[] {
  return isHindi ? HELP_ARTICLES_HI : HELP_ARTICLES;
}


