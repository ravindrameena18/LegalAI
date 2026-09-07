import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatWorkspace } from "./chat-workspace";
import { DeleteConfirmModal } from "./delete-confirm-modal";
import { DocumentRow } from "./document-row";
import {
  createChatSession,
  deleteChatSession,
  generateChatTitle,
  getChatSession,
  handleDocumentDeletedInChatStore,
  listChatSessions,
  saveChatSession,
} from "@/lib/chat-store";
import type { DocumentItem } from "@/lib/api-client";

describe("Document Deletion & Confirmation Modal (Feature 1)", () => {
  test("renders delete confirmation dialog with exact user-requested copy", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <DeleteConfirmModal
        isOpen={true}
        documentName="1000_Buildings_Professional_Contract_EN.pdf"
        isDeleting={false}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByRole("heading", { name: "Delete document?" })).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to delete/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1000_Buildings_Professional_Contract_EN.pdf"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /All associated analysis data, extracted text, and document references may also be removed/i,
      ),
    ).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    const deleteBtn = screen.getByRole("button", { name: /delete document/i });

    expect(cancelBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(deleteBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  test("DocumentRow displays [Open] [Analyze] [•••] and reveals action dropdown", () => {
    const doc: DocumentItem = {
      id: "doc-sample-1",
      name: "1000_Buildings_Professional_Contract_EN.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 45000,
      status: "ready",
      processing_status: "ready",
      page_count: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const onAnalyze = vi.fn();
    const onDelete = vi.fn();

    render(
      <DocumentRow
        document={doc}
        onAnalyze={onAnalyze}
        onDelete={onDelete}
        downloadUrl="/api/documents/doc-sample-1/download"
      />,
    );

    // Verify Open and Analyze buttons are visible
    expect(screen.getByRole("link", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /analyze/i })).toBeInTheDocument();

    // Verify ••• more actions trigger button
    const moreBtn = screen.getByRole("button", { name: /more actions/i });
    expect(moreBtn).toBeInTheDocument();

    // Open dropdown
    fireEvent.click(moreBtn);

    // Dropdown contains Open, Analyze, Download, Delete
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();
    const deleteMenuItem = screen.getByRole("menuitem", { name: /delete/i });
    expect(deleteMenuItem).toBeInTheDocument();

    // Clicking Delete in dropdown triggers onDelete callback with doc id & name
    fireEvent.click(deleteMenuItem);
    expect(onDelete).toHaveBeenCalledWith("doc-sample-1", "1000_Buildings_Professional_Contract_EN.pdf");
  });
});

describe("Multi-Session Chat & Persistence (Feature 2)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("creates independent chat sessions without deleting previous sessions", () => {
    const userId = "test-counsel-user";

    // Create first chat session
    const sessionA = createChatSession(userId, {
      title: "Contract Risk Review",
      documentId: "doc-1",
      documentName: "NDA_Agreement.pdf",
      messages: [
        { id: "msg-1", sender: "user", content: "Identify all unlimited liability clauses" },
        { id: "msg-2", sender: "assistant", content: "Found critical exposure in Section 4." },
      ],
    });

    expect(sessionA.id).toBeDefined();
    expect(sessionA.title).toBe("Contract Risk Review");

    // Create second independent chat session
    const sessionB = createChatSession(userId, {
      title: "Termination Clause Review",
      documentId: "doc-2",
      documentName: "Employment_Contract.pdf",
      messages: [
        { id: "msg-3", sender: "user", content: "What is the notice period?" },
      ],
    });

    expect(sessionB.id).not.toBe(sessionA.id);

    // Verify both sessions exist in storage
    const allSessions = listChatSessions(userId);
    expect(allSessions.length).toBe(2);

    const retrievedA = getChatSession(sessionA.id, userId);
    const retrievedB = getChatSession(sessionB.id, userId);

    expect(retrievedA?.messages.length).toBe(2);
    expect(retrievedB?.messages.length).toBe(1);
    expect(retrievedA?.documentName).toBe("NDA_Agreement.pdf");
    expect(retrievedB?.documentName).toBe("Employment_Contract.pdf");
  });

  test("generates smart short titles from user legal queries", () => {
    expect(generateChatTitle("Please summarize key obligations for each party")).toBe(
      "Summarize key obligations fo...",
    );
    expect(generateChatTitle("What are the liability risks?")).toBe(
      "The liability risks?",
    );
    expect(generateChatTitle("", "Commercial_Lease_Agreement.pdf")).toBe(
      "Commercial_Lease_Agreement",
    );
    expect(generateChatTitle("")).toBe("New Consultation");
  });

  test("reuses empty New Chat session and prevents duplicate empty sessions in list", () => {
    const userId = "test-new-chat-user";

    // First click on New Chat
    const session1 = createChatSession(userId);
    expect(session1.title).toBe("New Chat");
    expect(listChatSessions(userId).length).toBe(1);

    // Second click on New Chat without typing or uploading anything
    const session2 = createChatSession(userId);
    expect(session2.id).toBe(session1.id);
    expect(listChatSessions(userId).length).toBe(1);

    // Once session1 receives a message or document, a new New Chat creates a separate session
    saveChatSession(
      {
        ...session1,
        documentId: "doc-1",
        documentName: "NDA.pdf",
        messages: [{ id: "m1", sender: "user", content: "Review this NDA" }],
      },
      userId,
    );

    const session3 = createChatSession(userId);
    expect(session3.id).not.toBe(session1.id);
    expect(listChatSessions(userId).length).toBe(2);
  });

  test("unlinks deleted documents from chat sessions when document is removed", () => {
    const userId = "test-user-docs";

    const session = createChatSession(userId, {
      title: "Active Review",
      documentId: "doc-to-delete-123",
      documentName: "Old_Lease.pdf",
      messages: [{ id: "m1", sender: "user", content: "Review lease terms" }],
    });

    expect(getChatSession(session.id, userId)?.documentId).toBe("doc-to-delete-123");

    // Trigger document deleted handler
    handleDocumentDeletedInChatStore("doc-to-delete-123", userId);

    const updated = getChatSession(session.id, userId);
    expect(updated?.documentId).toBeNull();
    expect(updated?.documentName).toBeNull();
    expect(updated?.messages.length).toBe(1);
  });
});

describe("New Chat Clean Empty State UI (ChatWorkspace)", () => {
  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  test("renders only the clean copilot state with no old document context or cards", () => {
    const sampleDocs: DocumentItem[] = [
      {
        id: "doc-prior-1",
        name: "Prior_Agreement.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 50000,
        status: "ready",
        processing_status: "ready",
        page_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const newSession = createChatSession("test-user");

    const { container } = render(
      <ChatWorkspace
        key={newSession.id}
        sessionId={newSession.id}
        documents={sampleDocs}
      />,
    );

    // 1. Badge: LegalAI Document Copilot
    expect(screen.getByText("LegalAI Document Copilot")).toBeInTheDocument();

    // 2. Title: How can I help with your legal document?
    expect(
      screen.getByRole("heading", { name: "How can I help with your legal document?" }),
    ).toBeInTheDocument();

    // 3. Subtitle: Upload a document or select one from your workspace to get started.
    expect(
      screen.getByText("Upload a document or select one from your workspace to get started."),
    ).toBeInTheDocument();

    // 4. Clean upload area with exact label
    expect(screen.getByText("Upload Legal Document")).toBeInTheDocument();
    expect(screen.getByText("Supported: PDF, DOCX, TXT")).toBeInTheDocument();

    // 5. Compact suggestion chips
    expect(screen.getByText("Summarize key obligations")).toBeInTheDocument();
    expect(screen.getByText("Identify liability risks")).toBeInTheDocument();
    expect(screen.getByText("Extract termination clauses")).toBeInTheDocument();
    expect(screen.getByText("Check compliance terms")).toBeInTheDocument();

    // 6. NO quick-doc-select-section or active document cards from previous chats
    expect(screen.queryByText(/choose an active workspace document/i)).toBeNull();
    expect(screen.queryByText("Prior_Agreement.pdf")).toBeNull();
    expect(container.querySelector(".quick-doc-select-section")).toBeNull();
    expect(container.querySelector(".doc-context-bar")).toBeNull();
  });

  test("clicking a suggestion chip triggers file upload dialog instead of binding old document", () => {
    const sampleDocs: DocumentItem[] = [
      {
        id: "doc-prior-1",
        name: "Secret_Contract.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 50000,
        status: "ready",
        processing_status: "ready",
        page_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const newSession = createChatSession("test-user");

    const { container } = render(
      <ChatWorkspace
        key={newSession.id}
        sessionId={newSession.id}
        documents={sampleDocs}
      />,
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    const chip = screen.getByText("Summarize key obligations");
    fireEvent.click(chip);

    // Verifies file input click was called to prompt upload
    expect(clickSpy).toHaveBeenCalled();
    // Verifies Secret_Contract.pdf was NOT automatically selected
    expect(screen.queryByText("Secret_Contract.pdf")).toBeNull();
  });

  test("maintains document isolation between distinct chat sessions", () => {
    const sampleDocs: DocumentItem[] = [
      {
        id: "doc-alpha",
        name: "Alpha_Contract.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 40000,
        status: "ready",
        processing_status: "ready",
        page_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const userId = "guest";

    // Session A bound to Alpha_Contract.pdf
    const sessionA = createChatSession(userId, {
      title: "Alpha Review",
      documentId: "doc-alpha",
      documentName: "Alpha_Contract.pdf",
      messages: [{ id: "m1", sender: "user", content: "Check liabilities" }],
    });

    // Session B is brand new with no document
    const sessionB = createChatSession(userId);

    // Render Session A
    const { unmount } = render(
      <ChatWorkspace
        key={sessionA.id}
        sessionId={sessionA.id}
        documents={sampleDocs}
      />,
    );

    // Session A should display Alpha_Contract.pdf in DocumentContextBar
    expect(screen.getAllByText("Alpha_Contract.pdf").length).toBeGreaterThanOrEqual(1);

    unmount();

    // Render Session B (New Chat)
    render(
      <ChatWorkspace
        key={sessionB.id}
        sessionId={sessionB.id}
        documents={sampleDocs}
      />,
    );

    // Session B must NOT show Alpha_Contract.pdf or document context bar
    expect(screen.queryByText("Alpha_Contract.pdf")).toBeNull();
    expect(screen.getByText("LegalAI Document Copilot")).toBeInTheDocument();
    expect(screen.getByText("Upload Legal Document")).toBeInTheDocument();
  });
});

describe("Recent Chats Restoration & Routing (Feature 3)", () => {
  beforeEach(() => {
    localStorage.clear();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  test("restores exact existing conversation and does NOT render empty state when session has messages", () => {
    const userId = "guest";
    const existingSession = createChatSession(userId, {
      title: "Payment Terms Review",
      documentId: "doc-10",
      documentName: "10.pdf",
      messages: [
        {
          id: "msg-user-1",
          sender: "user",
          content: "What are the payment terms in 10.pdf?",
        },
        {
          id: "msg-assistant-1",
          sender: "assistant",
          content: "Payment terms are net 30 days from invoice date.",
          citations: [
            {
              title: "Payment Terms §4.1",
              page: 4,
              section: "4.1 Fees",
              text: "All invoices shall be settled within net 30 calendar days.",
            },
          ],
        },
      ],
    });

    // Render ChatWorkspace with no documents yet loaded (simulating API latency)
    render(
      <ChatWorkspace
        key={existingSession.id}
        sessionId={existingSession.id}
        documents={[]}
      />,
    );

    // 1. MUST NOT show the New Chat / empty state
    expect(screen.queryByText("How can I help with your legal document?")).toBeNull();
    expect(screen.queryByText("Upload Legal Document")).toBeNull();

    // 2. MUST restore user messages and AI answers
    expect(screen.getByText("What are the payment terms in 10.pdf?")).toBeInTheDocument();
    expect(
      screen.getByText(/Payment terms are net 30 days from invoice date/i),
    ).toBeInTheDocument();

    // 3. MUST display citation pill
    expect(screen.getByText(/Page 4/i)).toBeInTheDocument();

    // 4. MUST restore document context name
    expect(screen.getAllByText("10.pdf").length).toBeGreaterThanOrEqual(1);

    // 5. Input placeholder should reflect document context
    expect(
      screen.getByPlaceholderText("Ask anything about this document..."),
    ).toBeInTheDocument();
  });

  test("displays 'Conversation not found' and 'Start New Chat' button when sessionId does not exist", () => {
    render(
      <ChatWorkspace
        key="non-existent-session-999"
        sessionId="non-existent-session-999"
        documents={[]}
      />,
    );

    // 1. Heading says Conversation not found
    expect(
      screen.getByRole("heading", { name: /conversation not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This chat session does not exist or may have been deleted/i),
    ).toBeInTheDocument();

    // 2. Start New Chat button is rendered
    expect(screen.getByRole("button", { name: /start new chat/i })).toBeInTheDocument();

    // 3. Neither empty state nor conversation layout is rendered
    expect(screen.queryByText("How can I help with your legal document?")).toBeNull();
    expect(screen.queryByText("Upload Legal Document")).toBeNull();
  });

  test("deleting a chat session removes it cleanly from storage across keys", () => {
    const userId = "test-counsel";

    const sessionA = createChatSession(userId, {
      title: "Chat to delete",
      messages: [{ id: "m1", sender: "user", content: "To be deleted" }],
    });

    const sessionB = createChatSession(userId, {
      title: "Chat to keep",
      messages: [{ id: "m2", sender: "user", content: "Keep this" }],
    });

    expect(listChatSessions(userId).length).toBe(2);

    deleteChatSession(sessionA.id, userId);

    const remaining = listChatSessions(userId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(sessionB.id);

    expect(getChatSession(sessionA.id, userId)).toBeNull();
    expect(getChatSession(sessionB.id, userId)).not.toBeNull();
  });

  test("permanently deletes all messages, citations, and metadata without resurrection on refresh", () => {
    const userId = "attorney-user";

    // 1. Create chat session with full history
    const session10 = createChatSession(userId, {
      title: "10",
      documentId: "doc-10",
      documentName: "10.pdf",
      messages: [
        { id: "q1", sender: "user", content: "Summarize this document" },
        { id: "a1", sender: "assistant", content: "Executive summary of 10.pdf", citations: [{ page: 1, title: "Summary", text: "Overview" }] },
        { id: "q2", sender: "user", content: "What are the liabilities?" },
        { id: "a2", sender: "assistant", content: "Liabilities capped at 1x fee.", citations: [{ page: 3, title: "Liability", text: "Cap at 1x" }] },
      ],
    });

    const sessionOther = createChatSession(userId, {
      title: "Other Contract",
      documentId: "doc-other",
      documentName: "other.pdf",
      messages: [
        { id: "oq1", sender: "user", content: "Review other contract" },
      ],
    });

    // Verify initial storage has 2 chats with messages
    expect(listChatSessions(userId).length).toBe(2);
    expect(getChatSession(session10.id, userId)?.messages.length).toBe(4);
    expect(getChatSession(sessionOther.id, userId)?.messages.length).toBe(1);

    // 2. Perform permanent deletion
    deleteChatSession(session10.id, userId);

    // 3. Confirm chat "10" is completely gone
    expect(getChatSession(session10.id, userId)).toBeNull();
    const remaining = listChatSessions(userId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(sessionOther.id);
    expect(remaining[0].messages.length).toBe(1);

    // 4. Simulate page refresh / new queries: confirm deleted chat and messages NEVER return
    const refreshedSessions = listChatSessions(userId);
    expect(refreshedSessions.some((s) => s.id === session10.id)).toBe(false);
    expect(getChatSession(session10.id, userId)).toBeNull();

    // 5. Confirm saveChatSession refuses to resurrect the deleted session
    saveChatSession(
      {
        ...session10,
        messages: [{ id: "zombie", sender: "user", content: "Should not resurrect" }],
      },
      userId,
    );
    expect(getChatSession(session10.id, userId)).toBeNull();
    expect(listChatSessions(userId).some((s) => s.id === session10.id)).toBe(false);
  });
});

