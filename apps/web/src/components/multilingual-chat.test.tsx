import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatWorkspace } from "./chat-workspace";
import { LanguageProvider } from "@/lib/language-context";
import type { AnalysisDetail, DocumentDetail, DocumentItem } from "@/lib/api-client";
import * as apiClient from "@/lib/api-client";

describe("Multilingual Copilot QA System", () => {
  const mockDoc: DocumentItem = {
    id: "doc-multilingual-test",
    name: "Master_Service_Agreement.pdf",
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
      { page_number: 1, text: "Master Consulting Agreement between Apex Global Ltd and Summit Tech Solutions." },
      { page_number: 2, text: "Payment Schedule: Client shall pay all approved invoices within net 30 days of receipt. Late payments shall incur interest at 1.5% per month." },
      { page_number: 3, text: "Termination: Either party may terminate this agreement upon 30 days written notice for convenience." },
      { page_number: 4, text: "Contractor Obligations: Contractor shall maintain strict confidentiality and provide monthly progress reports." },
      { page_number: 5, text: "Governing Law: This agreement shall be governed by the laws of India." },
    ],
  };

  const mockAnalysis: AnalysisDetail = apiClient.normalizeAnalysisDetail({
    id: "analysis-multi-1",
    document_id: "doc-multilingual-test",
    version_id: "v1",
    status: "COMPLETED",
    risk_count: 1,
    clause_count: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    structured_data: {
      executive_summary: "Comprehensive commercial services contract with payment schedules and termination guidelines.",
      document_type: "Master Consulting Agreement",
      parties: [
        { name: "Apex Global Ltd", role: "Client" },
        { name: "Summit Tech Solutions", role: "Contractor" },
      ],
      important_dates: [{ title: "Commencement Date", date: "2026-04-01", page: 1 }],
      financial_terms: [
        { term: "Payment Due", amount_or_rate: "Net 30 days", details: "Late payments incur interest at 1.5% per month", page: 2 },
      ],
      obligations: [
        { party: "Contractor", obligation: "Maintain confidentiality and provide monthly reports", page: 4 },
      ],
      rights: [],
      termination: {
        for_cause: "15 days notice for material breach",
        for_convenience: "30 days prior written notice",
        notice_period: "30 days",
        consequences: "Payment for accrued work only",
        page: 3,
      },
      risks: [
        {
          title: "Late Fee Surcharge",
          severity: "LOW",
          explanation: "Standard 1.5% monthly late fee interest on overdue balances.",
          source_text: "Late payments shall incur interest at 1.5% per month.",
          page: 2,
          section: "Financial Terms",
          confidence: 0.95,
          suggested_review_action: "Ensure accounting team schedules disbursements promptly.",
        },
      ],
      governing_law: { governing_state_or_nation: "Laws of India", page: 5 },
      jurisdiction: { court_venue: "New Delhi", exclusive: "Yes" },
      dispute_resolution: {
        mechanism: "Arbitration in New Delhi",
        escalation_steps: "Executive negotiation",
        rules: "Arbitration and Conciliation Act",
      },
    },
  });

  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(apiClient, "getDocument").mockResolvedValue(mockDocDetail);
    vi.spyOn(apiClient, "getDocumentAnalysis").mockResolvedValue(mockAnalysis);
    vi.spyOn(apiClient, "triggerDocumentAnalysis").mockResolvedValue(mockAnalysis);
    vi.spyOn(apiClient, "askDocumentQuestion").mockRejectedValue(new Error("offline fallback in unit test"));
  });

  test("English query answers in English with accurate financial citations", async () => {
    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "By when do I have to deposit the payment?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/Payment & Financial Terms/i)).toBeDefined();
        expect(screen.getByText(/Net 30 days/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Devanagari Hindi query answers in natural professional Hindi", async () => {
    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "इसमें पैसे कब तक जमा करवाने हैं?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/भुगतान एवं वित्तीय शर्तें/i)).toBeDefined();
        expect(screen.getByText(/Net 30 days/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Hinglish query answers in natural professional Hindi", async () => {
    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "isme paise kab tak jama karwane hain?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/भुगतान एवं वित्तीय शर्तें/i)).toBeDefined();
        expect(screen.getByText(/Net 30 days/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Hinglish query on payment due and late payment consequences addresses both in Hindi", async () => {
    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "payment kab due hai aur late payment ka kya consequence hai?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/भुगतान एवं वित्तीय शर्तें/i)).toBeDefined();
        expect(screen.getByText(/विलंब एवं परिणाम/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Decoupled Language: Hindi UI with English query displays Hindi UI chrome but answers in English", async () => {
    localStorage.setItem("legalai-language", "hi");

    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/प्रश्नों के उत्तर देने के लिए तैयार हूँ/i)).toBeDefined();
      expect(screen.getByText("इस दस्तावेज़ का सारांश")).toBeDefined();
      expect(screen.getByText("भुगतान की शर्तें क्या हैं?")).toBeDefined();
    });

    const input = screen.getByPlaceholderText(/इस दस्तावेज़ के बारे में कुछ भी पूछें/i);
    fireEvent.change(input, { target: { value: "By when do I have to deposit the payment?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message|संदेश भेजें/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        // Answer is in English because user query was English!
        expect(screen.getByText(/Payment & Financial Terms/i)).toBeDefined();
        expect(screen.getByText(/Net 30 days/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Missing clause query explicitly indicates absence without hallucination", async () => {
    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "kya isme liquidated damages ka clause hai?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/पूर्व-निर्धारित हर्ज़ाना/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });

  test("Backend Multilingual QA API integration renders answer with citations", async () => {
    vi.spyOn(apiClient, "askDocumentQuestion").mockResolvedValueOnce({
      answer: "परामर्श अनुबंध के तहत चालान प्राप्ति के 30 दिनों के भीतर भुगतान किया जाना अनिवार्य है।",
      citations: [
        {
          page: 2,
          section: "भुगतान शर्तें",
          title: "भुगतान अनुसूची",
          text: "Client shall pay all approved invoices within net 30 days of receipt.",
          explanation: "भुगतान की देय तिथि चालान प्राप्त होने के 30 दिनों के भीतर है।",
        },
      ],
      found_in_document: true,
      language_detected: "hi",
      risk: null,
    });

    render(
      <LanguageProvider>
        <ChatWorkspace documents={[mockDoc]} initialDocId={mockDoc.id} />
      </LanguageProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Service_Agreement\.pdf/i).length).toBeGreaterThan(0);
    });

    const input = screen.getByPlaceholderText(/Ask anything about this document/i);
    fireEvent.change(input, { target: { value: "isme paise kab dene honge?" } });

    const sendBtn = screen.getByRole("button", { name: /Send message/i });
    fireEvent.click(sendBtn);

    await waitFor(
      () => {
        expect(screen.getByText(/परामर्श अनुबंध के तहत चालान प्राप्ति के 30 दिनों के भीतर भुगतान किया जाना अनिवार्य है।/i)).toBeDefined();
        expect(screen.getByText(/Page 2 · Sec: भुगतान शर्तें/i)).toBeDefined();
      },
      { timeout: 3000 }
    );
  });
});
