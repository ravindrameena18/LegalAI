import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ChatMessage, type MessageData } from "./chat-message";

describe("ChatMessage Markdown & Citations Rendering", () => {
  test("renders markdown bold and lists without raw asterisks", () => {
    const message: MessageData = {
      id: "msg-1",
      sender: "assistant",
      content: "**Termination Provisions:**\n\n• **For Cause:** Immediate upon material breach.\n• **For Convenience:** 30 days prior written notice.",
    };

    const { container } = render(<ChatMessage message={message} />);

    // Strong elements must be present
    expect(screen.getByText("Termination Provisions:")).toBeInTheDocument();
    expect(screen.getByText("For Cause:")).toBeInTheDocument();
    expect(screen.getByText("For Convenience:")).toBeInTheDocument();

    // Raw markdown asterisks must NOT be rendered in the document
    expect(container.textContent).not.toContain("**Termination Provisions:**");
    expect(container.textContent).not.toContain("**For Cause:**");

    // Must be rendered in <strong> tags
    const strongs = container.querySelectorAll("strong");
    expect(strongs.length).toBeGreaterThanOrEqual(3);

    // Must be rendered in list items
    const listItems = container.querySelectorAll("li");
    expect(listItems.length).toBe(2);
  });

  test("renders markdown headings, tables, and blockquotes", () => {
    const message: MessageData = {
      id: "msg-2",
      sender: "assistant",
      content: "### Liability Overview\n\n> Section 4.1 governs indemnification.\n\n| Clause | Severity |\n| --- | --- |\n| Non-Compete | Low |\n| Indemnity | High |",
    };

    const { container } = render(<ChatMessage message={message} />);

    // Headings
    expect(screen.getByRole("heading", { level: 3, name: "Liability Overview" })).toBeInTheDocument();

    // Blockquote
    const blockquote = container.querySelector("blockquote");
    expect(blockquote).toBeInTheDocument();
    expect(blockquote?.textContent).toContain("Section 4.1 governs indemnification.");

    // Table
    const table = container.querySelector("table");
    expect(table).toBeInTheDocument();
    expect(screen.getByText("Clause")).toBeInTheDocument();
    expect(screen.getByText("Severity")).toBeInTheDocument();
    expect(screen.getByText("Non-Compete")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  test("renders grounded citations as interactive buttons and fires callback", () => {
    const onCitationClick = vi.fn();
    const message: MessageData = {
      id: "msg-3",
      sender: "assistant",
      content: "Review of Section 4 shows liability carveout.",
      citations: [
        {
          page: 2,
          section: "Termination Clause",
          title: "Termination Provision",
          text: "Either party may terminate...",
          severity: "HIGH",
        },
      ],
    };

    render(<ChatMessage message={message} onCitationClick={onCitationClick} />);

    // Citation pill must exist with correct page & section
    const citationBtn = screen.getByRole("button", { name: /Page 2 · Sec: Termination Clause/i });
    expect(citationBtn).toBeInTheDocument();

    // Clicking citation calls onCitationClick with citation data
    fireEvent.click(citationBtn);
    expect(onCitationClick).toHaveBeenCalledTimes(1);
    expect(onCitationClick).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 2,
        section: "Termination Clause",
        severity: "HIGH",
      }),
    );
  });
});

