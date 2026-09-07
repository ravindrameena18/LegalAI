import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import type { DocumentItem, DocumentDetail, AnalysisDetail } from "@/lib/api-client";
import { PasswordPromptModal } from "./password-prompt-modal";
import { DocumentRow } from "./document-row";
import { ChatWorkspace } from "./chat-workspace";
import { saveChatSession } from "@/lib/chat-store";

const { MockApiError, mockDocStore, mockAnalysisStore } = vi.hoisted(() => {
  class MockApiError extends Error {
    constructor(public status: number, public detail: string) {
      super(detail);
      this.name = "ApiError";
    }
  }
  const mockDocStore: Record<string, unknown> = {};
  const mockAnalysisStore: Record<string, unknown> = {};
  return { MockApiError, mockDocStore, mockAnalysisStore };
});

vi.mock("@/lib/api-client", () => ({
  ApiError: MockApiError,
  askDocumentQuestion: vi.fn(async () => {
    throw new Error("Fallback to client QA in mock tests");
  }),
  unlockDocument: vi.fn(async (id: string, password: string) => {
    if (password === "correct123") {
      const unlocked: DocumentDetail = {
        id,
        name: "Confidential_Agreement.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 20480,
        status: "ready",
        processing_status: "ready",
        page_count: 3,
        is_encrypted: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        pages: [
          { page_number: 1, text: "Commercial Agreement between Alpha Corp and Beta Services Inc." },
          { page_number: 2, text: "Payment terms: Invoices payable net 30 days. Consulting rate is $250 per hour." },
          { page_number: 3, text: "Contractor obligations: The contractor shall deliver weekly milestone reports and maintain compliance." },
        ],
      };
      mockDocStore[id] = unlocked;
      return unlocked;
    }
    throw new MockApiError(400, "Incorrect password. Please try again.");
  }),
  getDocument: vi.fn(async (id: string) => {
    if (mockDocStore[id]) {
      return mockDocStore[id] as DocumentDetail;
    }
    return {
      id,
      name: "Document.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 1024,
      status: "ready",
      processing_status: "ready",
      page_count: 1,
      is_encrypted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages: [{ page_number: 1, text: "Default document text." }],
    } as DocumentDetail;
  }),
  getDocumentAnalysis: vi.fn(async (id: string) => {
    if (mockAnalysisStore[id]) {
      return mockAnalysisStore[id] as AnalysisDetail;
    }
    throw new MockApiError(404, "No analysis found.");
  }),
  triggerDocumentAnalysis: vi.fn(async (id: string) => {
    return {
      id: `analysis-${id}`,
      document_id: id,
      version_id: "v1",
      status: "completed",
      risk_count: 0,
      clause_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      structured_data: {
        executive_summary: "Analyzed agreement summary.",
        document_type: "Agreement",
        parties: [],
        important_dates: [],
        financial_terms: [],
        obligations: [],
        rights: [],
        termination: { for_cause: "", for_convenience: "", notice_period: "", consequences: "" },
        renewal: { type: "", terms: "", notice_window: "" },
        confidentiality: { definition_scope: "", duration: "", standard_exclusions: "" },
        liability: { caps: "", consequential_damages_exclusion: "", carveouts: "" },
        indemnity: { scope: "", covered_parties: "", procedure: "" },
        intellectual_property: { ownership: "", work_for_hire: "", license_grant: "" },
        governing_law: { governing_state_or_nation: "" },
        jurisdiction: { court_venue: "", exclusive: "" },
        dispute_resolution: { mechanism: "", escalation_steps: "", rules: "" },
        warranties: { express_warranties: "", disclaimers: "" },
        representations: { corporate_authority: "", regulatory_compliance: "" },
        non_compete: { applicable: "", scope: "", duration: "", territory: "" },
        non_solicitation: { applicable: "", scope: "", duration: "", territory: "" },
        data_protection: { applicable: "", security_standards: "", breach_notification_window: "" },
        important_clauses: [],
        risks: [],
        missing_or_unclear_information: [],
      },
    } as unknown as AnalysisDetail;
  }),
  uploadDocument: vi.fn(async (file: File) => {
    return {
      id: "doc-uploaded-1",
      name: file.name,
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: file.size,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as DocumentItem;
  }),
}));

describe("Password-Protected PDF Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("PasswordPromptModal renders document title, password field, and toggle", () => {
    const mockDoc: DocumentItem = {
      id: "doc-pwd-1",
      name: "Confidential_Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 20480,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    render(
      <PasswordPromptModal
        isOpen={true}
        document={mockDoc}
        onSuccess={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByText("Password-Protected PDF")).toBeInTheDocument();
    expect(screen.getByText("Confidential_Agreement.pdf")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Enter document password") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("password");

    // Toggle show password
    const toggleBtn = screen.getByLabelText("Show password");
    fireEvent.click(toggleBtn);
    expect(input.type).toBe("text");
    expect(screen.getByLabelText("Hide password")).toBeInTheDocument();
  });

  test("PasswordPromptModal displays error banner on wrong password", async () => {
    const mockDoc: DocumentItem = {
      id: "doc-pwd-1",
      name: "Confidential_Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 20480,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onSuccess = vi.fn();

    render(
      <PasswordPromptModal
        isOpen={true}
        document={mockDoc}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Enter document password");
    fireEvent.change(input, { target: { value: "wrongPass" } });

    const submitBtn = screen.getByRole("button", { name: /Unlock & Process/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Incorrect password. Please try again.")).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });

  test("PasswordPromptModal succeeds on correct password and invokes callback", async () => {
    const mockDoc: DocumentItem = {
      id: "doc-pwd-1",
      name: "Confidential_Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 20480,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onSuccess = vi.fn();

    render(
      <PasswordPromptModal
        isOpen={true}
        document={mockDoc}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Enter document password");
    fireEvent.change(input, { target: { value: "correct123" } });

    const submitBtn = screen.getByRole("button", { name: /Unlock & Process/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-pwd-1",
          status: "ready",
          processing_status: "ready",
          is_encrypted: false,
        })
      );
    });
  });

  test("PasswordPromptModal allows retry after wrong password and succeeds on correct password", async () => {
    const mockDoc: DocumentItem = {
      id: "doc-pwd-retry-1",
      name: "Protected_Loan_Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 20480,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onSuccess = vi.fn();

    render(
      <PasswordPromptModal
        isOpen={true}
        document={mockDoc}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("Enter document password");

    // 1. First attempt with wrong password
    fireEvent.change(input, { target: { value: "wrongPass1" } });
    const submitBtn = screen.getByRole("button", { name: /Unlock & Process/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Incorrect password. Please try again.")).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();

    // 2. Retry with correct password without modal closing
    fireEvent.change(input, { target: { value: "correct123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "doc-pwd-retry-1",
          status: "ready",
          processing_status: "ready",
          is_encrypted: false,
        })
      );
    });
  });

  test("DocumentRow displays Password Required badge and Unlock button", () => {
    const lockedDoc: DocumentItem = {
      id: "doc-locked",
      name: "Locked_Contract.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 15000,
      status: "password_required",
      processing_status: "password_required",
      page_count: 0,
      is_encrypted: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onUnlock = vi.fn();

    render(
      <DocumentRow
        document={lockedDoc}
        onAnalyze={vi.fn()}
        onDelete={vi.fn()}
        onUnlock={onUnlock}
        downloadUrl="/api/documents/doc-locked/download"
      />
    );

    expect(screen.getByText("Password Required")).toBeInTheDocument();
    const unlockBtn = screen.getByRole("button", { name: "Unlock Locked_Contract.pdf" });
    expect(unlockBtn).toBeInTheDocument();

    fireEvent.click(unlockBtn);
    expect(onUnlock).toHaveBeenCalledWith(lockedDoc);
  });
});

describe("Password-Protected PDF Chat & Grounded QA Integration", () => {
  const unlockedProtectedDoc: DocumentDetail = {
    id: "doc-pwd-chat-1",
    name: "Unlocked_Contract.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: 25000,
    status: "ready",
    processing_status: "ready",
    page_count: 3,
    is_encrypted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pages: [
      { page_number: 1, text: "Services Agreement between Alpha Corp and Beta Services Inc." },
      { page_number: 2, text: "Payment terms: Invoices payable net 30 days from receipt. Rate is $250 per hour." },
      { page_number: 3, text: "Contractor obligations: The contractor shall deliver weekly milestone reports and maintain cybersecurity compliance." },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    mockDocStore[unlockedProtectedDoc.id] = unlockedProtectedDoc;
  });

  test("Chat Question against unlocked password PDF returns grounded answer and page citation", async () => {
    render(<ChatWorkspace documents={[unlockedProtectedDoc]} initialDocId={unlockedProtectedDoc.id} />);

    // Click suggestion chip for payment terms
    const paymentChip = screen.getByRole("button", { name: "What are the payment terms?" });
    fireEvent.click(paymentChip);

    // Expect thinking indicator
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    // Resolves with grounded payment terms snippet from decrypted Page 2
    await waitFor(
      () => {
        expect(screen.getAllByText(/Payment Terms:/i).length).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );

    expect(screen.getByText(/Invoices payable net 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/\$250 per hour/i)).toBeInTheDocument();
  });

  test("Multiple different questions against unlocked PDF answer accurately from decrypted pages", async () => {
    render(<ChatWorkspace documents={[unlockedProtectedDoc]} initialDocId={unlockedProtectedDoc.id} />);

    // 1. Obligations question
    const obligationsChip = screen.getByRole("button", { name: "What are the contractor's obligations?" });
    fireEvent.click(obligationsChip);

    await waitFor(
      () => {
        expect(screen.getAllByText(/Contractor Obligations:/i).length).toBeGreaterThan(0);
      },
      { timeout: 2500 },
    );
    expect(screen.getByText(/weekly milestone reports/i)).toBeInTheDocument();

    // 2. Input custom query for payment
    const input = screen.getByPlaceholderText("Ask anything about this document...");
    fireEvent.change(input, { target: { value: "What is the rate per hour?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(
      () => {
        expect(screen.getByText(/relevant passages found/i)).toBeInTheDocument();
      },
      { timeout: 2500 },
    );
    expect(screen.getAllByText(/\$250 per hour/i).length).toBeGreaterThan(0);
  });

  test("Document Isolation: Chat retrieves only its own document text across multiple PDFs", async () => {
    const docAlpha: DocumentDetail = {
      id: "doc-alpha",
      name: "Alpha_Contract.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 15000,
      status: "ready",
      processing_status: "ready",
      page_count: 1,
      is_encrypted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages: [{ page_number: 1, text: "Alpha Corporation agreement. Hourly consulting rate is $175 per hour." }],
    };

    const docBeta: DocumentDetail = {
      id: "doc-beta",
      name: "Beta_Contract.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 18000,
      status: "ready",
      processing_status: "ready",
      page_count: 1,
      is_encrypted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      pages: [{ page_number: 1, text: "Beta Limited partnership. Retainer fee is $9000 monthly retainer." }],
    };

    mockDocStore["doc-alpha"] = docAlpha;
    mockDocStore["doc-beta"] = docBeta;

    // Render with doc-alpha
    const { unmount } = render(<ChatWorkspace documents={[docAlpha, docBeta]} initialDocId="doc-alpha" />);

    const paymentChip = screen.getByRole("button", { name: "What are the payment terms?" });
    fireEvent.click(paymentChip);

    await waitFor(
      () => {
        expect(screen.getByText(/\$175 per hour/i)).toBeInTheDocument();
      },
      { timeout: 2500 },
    );
    // Beta text must NOT appear
    expect(screen.queryByText(/9000 monthly retainer/i)).toBeNull();

    unmount();

    // Render with doc-beta
    render(<ChatWorkspace documents={[docAlpha, docBeta]} initialDocId="doc-beta" />);

    const paymentChipBeta = screen.getByRole("button", { name: "What are the payment terms?" });
    fireEvent.click(paymentChipBeta);

    await waitFor(
      () => {
        expect(screen.getByText(/9000 monthly retainer/i)).toBeInTheDocument();
      },
      { timeout: 2500 },
    );
    // Alpha text must NOT appear
    expect(screen.queryByText(/\$175 per hour/i)).toBeNull();
  });

  test("Reopening an existing chat for an unlocked protected PDF retrieves correct content", async () => {
    const sessionId = "session-reopen-test-123";
    saveChatSession(
      {
        id: sessionId,
        title: "Unlocked Contract Review",
        userId: "guest",
        documentId: unlockedProtectedDoc.id,
        documentName: unlockedProtectedDoc.name,
        messages: [
          {
            id: "msg-1",
            sender: "user",
            content: "Hello",
            timestamp: "10:00 AM",
          },
          {
            id: "msg-2",
            sender: "assistant",
            content: "Ready to assist with Unlocked_Contract.pdf",
            timestamp: "10:01 AM",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      "guest",
    );

    render(
      <ChatWorkspace
        sessionId={sessionId}
        documents={[unlockedProtectedDoc]}
        initialDocId={unlockedProtectedDoc.id}
      />
    );

    // Existing messages are displayed
    expect(screen.getByText("Ready to assist with Unlocked_Contract.pdf")).toBeInTheDocument();

    // Ask a new grounded question
    const input = screen.getByPlaceholderText("Ask anything about this document...");
    fireEvent.change(input, { target: { value: "What are the payment terms?" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await waitFor(
      () => {
        expect(screen.getByText(/\$250 per hour/i)).toBeInTheDocument();
      },
      { timeout: 2500 },
    );
  });
});

