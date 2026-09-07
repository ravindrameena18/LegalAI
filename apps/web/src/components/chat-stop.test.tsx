import { fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ChatInput } from "./chat-input";
import { ChatWorkspace } from "./chat-workspace";
import { createChatSession, getChatSession } from "@/lib/chat-store";
import type { DocumentItem } from "@/lib/api-client";

describe("ChatInput - Send / Stop Button UX States", () => {
  test("State 1 (Idle & Empty): renders disabled up-arrow send button", () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<ChatInput onSendMessage={onSend} onStop={onStop} isLoading={false} />);

    const button = screen.getByRole("button", { name: "Send message" });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button.classList.contains("stop-mode")).toBe(false);

    // Clicking while disabled does not trigger callbacks
    fireEvent.click(button);
    expect(onSend).not.toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  test("State 1 (Idle & Text): enables up-arrow send button and sends message", () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<ChatInput onSendMessage={onSend} onStop={onStop} isLoading={false} />);

    const textarea = screen.getByPlaceholderText(/upload or select a document/i);
    fireEvent.change(textarea, { target: { value: "Summarize the agreement" } });

    const button = screen.getByRole("button", { name: "Send message" });
    expect(button).not.toBeDisabled();
    expect(button.classList.contains("active")).toBe(true);
    expect(button.classList.contains("stop-mode")).toBe(false);

    fireEvent.click(button);
    expect(onSend).toHaveBeenCalledWith("Summarize the agreement");
    expect(onStop).not.toHaveBeenCalled();
  });

  test("State 2 (AI Running): switches to active square Stop button, clickable even when input is empty", () => {
    const onSend = vi.fn();
    const onStop = vi.fn();

    render(<ChatInput onSendMessage={onSend} onStop={onStop} isLoading={true} />);

    // Shows Stop button with accessible label
    const stopBtn = screen.getByRole("button", { name: "Stop generating" });
    expect(stopBtn).toBeInTheDocument();
    // Must remain clickable even when input is empty!
    expect(stopBtn).not.toBeDisabled();
    expect(stopBtn.classList.contains("stop-mode")).toBe(true);

    // Textarea is disabled during generation
    const textarea = screen.getByPlaceholderText(/upload or select a document/i);
    expect(textarea).toBeDisabled();

    // Clicking triggers onStop
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("ChatWorkspace - Stop AI Request & Lifecycle Integration", () => {
  const sampleDoc: DocumentItem = {
    id: "doc-test-1",
    name: "Master_Services_Agreement.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: 64000,
    status: "ready",
    processing_status: "ready",
    page_count: 8,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  test("TEST 1: Send a question -> button changes ↑ -> ■, AI finishes -> ■ -> ↑", async () => {
    const session = createChatSession("guest", {
      documentId: sampleDoc.id,
      documentName: sampleDoc.name,
    });

    render(<ChatWorkspace sessionId={session.id} documents={[sampleDoc]} initialDocId={sampleDoc.id} />);

    // Initially idle Send button
    expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Ask (anything|LegalAI) about this document.../i);
    fireEvent.change(textarea, { target: { value: "What are the governing laws?" } });

    // Click Send
    const sendBtn = screen.getByRole("button", { name: "Send message" });
    fireEvent.click(sendBtn);

    // Button immediately transforms: ↑ -> ■ (Stop generating)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });
    // Processing indicator visible
    expect(screen.getByText(/reviewing document clauses/i)).toBeInTheDocument();

    // When AI finishes, transforms: ■ -> ↑
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
      },
      { timeout: 2000 },
    );

    // Processing indicator gone
    expect(screen.queryByText(/reviewing document clauses/i)).toBeNull();
    // Response rendered
    expect(screen.getByText(/governing law/i)).toBeInTheDocument();
  });

  test("TEST 2: Click suggestion chip -> ↑ -> ■, click Stop -> stops AI request, preserves user message, re-enables input", async () => {
    const session = createChatSession("guest", {
      documentId: sampleDoc.id,
      documentName: sampleDoc.name,
    });

    render(<ChatWorkspace sessionId={session.id} documents={[sampleDoc]} initialDocId={sampleDoc.id} />);

    // Click chip "Summarize this document"
    const chip = screen.getByRole("button", { name: /summarize/i });
    fireEvent.click(chip);

    // Verify user message rendered and button switched to Stop
    expect(screen.getByText("Summarize this document", { selector: ".user-message-bubble p" })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    const stopBtn = screen.getByRole("button", { name: "Stop generating" });
    fireEvent.click(stopBtn);

    // Request stops: button reverts to ↑, thinking indicator removed
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
    });
    expect(screen.queryByText(/reviewing document clauses/i)).toBeNull();

    // User's message remains intact!
    expect(screen.getByText("Summarize this document", { selector: ".user-message-bubble p" })).toBeInTheDocument();

    // Input is re-enabled
    const textarea = screen.getByPlaceholderText(/Ask (anything|LegalAI) about this document.../i);
    expect(textarea).not.toBeDisabled();
  });

  test("TEST 3: Start another analysis immediately after stopping -> no duplicate or stuck loading state", async () => {
    const session = createChatSession("guest", {
      documentId: sampleDoc.id,
      documentName: sampleDoc.name,
    });

    render(<ChatWorkspace sessionId={session.id} documents={[sampleDoc]} initialDocId={sampleDoc.id} />);

    // Send query 1
    const textarea = screen.getByPlaceholderText(/Ask (anything|LegalAI) about this document.../i);
    fireEvent.change(textarea, { target: { value: "Query 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    // Immediately stop
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
    });

    // Immediately send query 2
    fireEvent.change(textarea, { target: { value: "Query 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    // Goes to Stop state again cleanly without duplication
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    // Let it finish normally
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "Send message" })).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  test("TEST 5: Switching chat session while AI is thinking cleanly aborts without corrupting new chat state", async () => {
    const session1 = createChatSession("guest", {
      title: "Chat 1",
      documentId: sampleDoc.id,
      documentName: sampleDoc.name,
    });
    const session2 = createChatSession("guest", {
      title: "Chat 2",
    });

    const { rerender } = render(
      <ChatWorkspace key={session1.id} sessionId={session1.id} documents={[sampleDoc]} initialDocId={sampleDoc.id} />,
    );

    // Start request in session 1
    const textarea = screen.getByPlaceholderText(/Ask (anything|LegalAI) about this document.../i);
    fireEvent.change(textarea, { target: { value: "Deep risk check" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop generating" })).toBeInTheDocument();
    });

    // Switch to session 2 while session 1 was thinking
    rerender(
      <ChatWorkspace key={session2.id} sessionId={session2.id} documents={[sampleDoc]} />,
    );

    // Session 2 is clean empty state, not in a stuck loading state
    expect(screen.getByText("LegalAI Document Copilot")).toBeInTheDocument();
    expect(screen.queryByText(/reviewing document clauses/i)).toBeNull();
  });
});
