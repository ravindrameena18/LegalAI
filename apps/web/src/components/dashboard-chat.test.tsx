import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatWorkspace } from "./chat-workspace";
import type { AnalysisDetail, DocumentDetail, DocumentItem } from "@/lib/api-client";
import * as apiClient from "@/lib/api-client";

describe("Dashboard Document-Specific AI Chat Workspace", () => {
  const mockDoc: DocumentItem = {
    id: "doc-10-pdf",
    name: "10.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: 102400,
    status: "ready",
    processing_status: "ready",
    page_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const mockDocDetail: DocumentDetail = {
    ...mockDoc,
    pages: [
      { page_number: 1, text: "Commercial Agreement between Alpha Corp and Beta Services Inc." },
      { page_number: 2, text: "Payment terms: Invoices shall be payable net 30 days from receipt. Rate is $150 per hour." },
      { page_number: 3, text: "Termination: Either party may terminate for cause with 15 days notice." },
      { page_number: 4, text: "Contractor obligations: The contractor shall deliver weekly milestone reports and maintain cybersecurity compliance." },
      { page_number: 5, text: "Governing law: This agreement is governed by the laws of the State of Delaware." },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(mockDocDetail);
    const mockAnalysis: AnalysisDetail = {
      id: "analysis-1",
      document_id: "doc-10-pdf",
      version_id: "v1",
      status: "COMPLETED",
      risk_count: 1,
      clause_count: 5,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      structured_data: {
        executive_summary: "Commercial consulting contract covering milestones and standard warranties.",
        document_type: "Master Services Agreement",
        parties: [
          { name: "Alpha Corp", role: "Client" },
          { name: "Beta Services", role: "Contractor" },
        ],
        important_dates: [{ title: "Commencement Date", date: "2026-10-01", page: 1 }],
        financial_terms: [
          { term: "Consulting Rate", amount_or_rate: "$150/hr", details: "Net 30 payment terms", page: 2 },
        ],
        obligations: [
          { party: "Contractor", obligation: "Deliver weekly milestone reports and maintain compliance", page: 4 },
        ],
        rights: [],
        termination: {
          for_cause: "15 days notice for material breach",
          for_convenience: "30 days prior written notice",
          notice_period: "30 days",
          consequences: "Payment for accrued work only",
          page: 3,
        },
        renewal: { type: "Annual", terms: "Written mutual agreement", notice_window: "60 days" },
        confidentiality: { definition_scope: "Proprietary technical info", duration: "3 years", standard_exclusions: "Public domain" },
        liability: { caps: "Total aggregate fees paid", consequential_damages_exclusion: "Standard exclusion", carveouts: "None" },
        indemnity: { scope: "Standard IP infringement", covered_parties: "Client affiliates", procedure: "Prompt notice" },
        intellectual_property: { ownership: "Client owns deliverables", work_for_hire: "Yes", license_grant: "Perpetual" },
        governing_law: { governing_state_or_nation: "State of Delaware", page: 5 },
        jurisdiction: { court_venue: "New Castle County, Delaware", exclusive: "Yes" },
        dispute_resolution: { mechanism: "Binding arbitration", escalation_steps: "Executive negotiation", rules: "AAA" },
        warranties: { express_warranties: "Professional standard", disclaimers: "As-is except express" },
        representations: { corporate_authority: "Fully authorized", regulatory_compliance: "Full compliance" },
        non_compete: { applicable: "No", scope: "N/A", duration: "N/A", territory: "N/A" },
        non_solicitation: { applicable: "Yes", scope: "Employees", duration: "12 months", territory: "Worldwide" },
        data_protection: { applicable: "Yes", security_standards: "SOC 2 Type II", breach_notification_window: "48 hours" },
        important_clauses: [],
        risks: [
          {
            title: "Broad Indemnity Exposure",
            severity: "HIGH",
            explanation: "Indemnity is not capped by standard liability threshold.",
            source_text: "Contractor indemnifies Client without liability cap.",
            page: 4,
            section: "Indemnity",
            confidence: 0.95,
            suggested_review_action: "Negotiate bilateral liability cap on indemnities.",
          },
        ],
        missing_or_unclear_information: [],
      },
    };

    vi.spyOn(apiClient, "getDocumentAnalysis").mockResolvedValue(mockAnalysis);
    vi.spyOn(apiClient, "triggerDocumentAnalysis").mockResolvedValue(mockAnalysis);
    vi.spyOn(apiClient, "askDocumentQuestion").mockRejectedValue(new Error("offline in test"));
  });

  test("STATE 1 (No document selected): renders clean empty copilot state", () => {
    render(<ChatWorkspace documents={[mockDoc]} />);

    expect(screen.getByText("LegalAI Document Copilot")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "How can I help with your legal document?" })).toBeInTheDocument();
    expect(screen.getByText("Upload Legal Document")).toBeInTheDocument();
    expect(screen.getByText("Supported: PDF, DOCX, TXT")).toBeInTheDocument();

    // Context bar is NOT shown in empty state
    expect(screen.queryByText(/open reader/i)).toBeNull();
  });

  test("STATE 2 (Document Selected): displays Document Context Header with ✦ Analyze and NO Open Reader", async () => {
    render(<ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />);

    // Document context header is visible
    expect(screen.getByText("10.pdf", { selector: ".doc-context-name" })).toBeInTheDocument();
    expect(screen.getByText(/5 pages · PDF/i)).toBeInTheDocument();
    expect(screen.getByText("READY")).toBeInTheDocument();

    // Action buttons: ✦ Analyze is present, Open Reader is completely absent
    const analyzeBtn = screen.getByRole("link", { name: /✦ analyze/i });
    expect(analyzeBtn).toBeInTheDocument();
    expect(analyzeBtn).toHaveAttribute("href", `/analysis?document_id=${mockDoc.id}&auto=true`);

    expect(screen.queryByText(/open reader/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /open reader/i })).toBeNull();
  });

  test("STATE 2: renders initial greeting and all 6 compact suggestion chips", async () => {
    render(<ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />);

    // Initial greeting from LegalAI
    expect(
      screen.getByText(/I'm ready to answer questions about/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ask me about clauses, obligations, risks, dates, payments, termination, or anything else in the document/i),
    ).toBeInTheDocument();

    // 6 Compact Suggestion Chips
    expect(screen.getByRole("button", { name: "Summarize this document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What are the payment terms?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Find termination clauses" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What are the major risks?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "What are the contractor's obligations?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Are there liquidated damages?" })).toBeInTheDocument();

    // Chat input placeholder & badge
    const input = screen.getByPlaceholderText("Ask anything about this document...");
    expect(input).toBeInTheDocument();
    expect(screen.getByText("10.pdf", { selector: ".doc-name" })).toBeInTheDocument();
  });

  test("Grounded Question Answering: Answers payment terms with citations", async () => {
    render(<ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />);

    const chip = screen.getByRole("button", { name: "What are the payment terms?" });
    fireEvent.click(chip);

    // Shows thinking state
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    // Resolves with payment terms and page citation
    await waitFor(
      () => {
        expect(screen.getByText(/Payment & Financial Terms/i)).toBeInTheDocument();
      },
      { timeout: 2500 },
    );

    expect(screen.getByText(/\$150\/hr/i)).toBeInTheDocument();
  });

  test("Grounded Question Answering: Liquidated damages NOT found states clearly", async () => {
    render(<ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />);

    const chip = screen.getByRole("button", { name: "Are there liquidated damages?" });
    fireEvent.click(chip);

    await waitFor(
      () => {
        expect(
          screen.getByText(/I could not find this information in the provided document/i),
        ).toBeInTheDocument();
      },
      { timeout: 2500 },
    );

    expect(
      screen.getByText(/There is no mention of liquidated damages or pre-estimated breach penalties/i),
    ).toBeInTheDocument();
  });

  test("STATE 2: Suggested question chips container renders all 6 chips in active-doc-chips-row", () => {
    const { container } = render(<ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />);

    const chipsRow = container.querySelector(".active-doc-chips-row");
    expect(chipsRow).toBeInTheDocument();

    const buttons = chipsRow?.querySelectorAll("button.mini-chip");
    expect(buttons?.length).toBe(6);
    expect(buttons?.[0]).toHaveTextContent("Summarize this document");
    expect(buttons?.[1]).toHaveTextContent("What are the payment terms?");
    expect(buttons?.[2]).toHaveTextContent("Find termination clauses");
    expect(buttons?.[3]).toHaveTextContent("What are the major risks?");
    expect(buttons?.[4]).toHaveTextContent("What are the contractor's obligations?");
    expect(buttons?.[5]).toHaveTextContent("Are there liquidated damages?");
  });
});
