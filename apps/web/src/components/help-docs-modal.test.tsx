import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { HelpDocsModal } from "./help-docs-modal";

describe("HelpDocsModal Component", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
  });

  test("does not render when isOpen is false", () => {
    render(<HelpDocsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("renders modal when isOpen is true with 3 nav groups and default category", () => {
    render(<HelpDocsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HELP & DOCS" })).toBeInTheDocument();

    // Check nav group labels
    expect(screen.getByText("GETTING STARTED")).toBeInTheDocument();
    expect(screen.getByText("LEGALAI FEATURES")).toBeInTheDocument();
    expect(screen.getByText("SUPPORT")).toBeInTheDocument();

    // Default category is Getting Started
    expect(screen.getByRole("heading", { name: "1. What is LegalAI?" })).toBeInTheDocument();
  });

  test("left navigation does not render search box or shortcut and starts directly with categories", () => {
    render(<HelpDocsModal isOpen={true} onClose={onClose} />);

    expect(screen.queryByPlaceholderText(/search/i)).toBeNull();
    expect(screen.queryByText(/⌘K/i)).toBeNull();
    expect(screen.getByText("GETTING STARTED")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /getting started/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /dashboard & ai copilot/i })).toBeInTheDocument();
  });

  test("switching categories updates displayed articles and documentation", () => {
    render(<HelpDocsModal isOpen={true} onClose={onClose} />);

    // Click "Compare Documents" tab
    const compareTab = screen.getByRole("tab", { name: /compare documents/i });
    fireEvent.click(compareTab);

    expect(screen.getByRole("heading", { name: "Comparing Contracts & Versions" })).toBeInTheDocument();
    expect(
      screen.getByText(/If both document slots contain the same document, comparison cannot be started/i)
    ).toBeInTheDocument();

    // Click "Legal Research" tab
    const researchTab = screen.getByRole("tab", { name: /legal research/i });
    fireEvent.click(researchTab);

    expect(screen.getByRole("heading", { name: "Source-Grounded Legal Research Engine" })).toBeInTheDocument();
    expect(screen.getByText(/Indian penal statutes/i)).toBeInTheDocument();

    // Click "AI & Analysis" tab
    const aiTab = screen.getByRole("tab", { name: /ai & analysis/i });
    fireEvent.click(aiTab);

    expect(screen.getByRole("heading", { name: "AI Models, Grounding & Analysis Settings" })).toBeInTheDocument();
  });

  test("FAQ category displays expandable accordions", () => {
    render(<HelpDocsModal isOpen={true} onClose={onClose} />);

    const faqTab = screen.getByRole("tab", { name: /frequently asked questions/i });
    fireEvent.click(faqTab);

    expect(screen.getAllByRole("heading", { name: "Frequently Asked Questions" }).length).toBeGreaterThanOrEqual(1);

    // Look for a question button
    const questionBtn = screen.getByRole("button", { name: /what file types are supported\?/i });
    expect(questionBtn).toBeInTheDocument();

    // Answer is initially not visible
    expect(screen.queryByText(/LegalAI currently supports/i)).toBeNull();

    // Click to expand
    fireEvent.click(questionBtn);
    expect(screen.getByText(/LegalAI currently supports/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(questionBtn);
    expect(screen.queryByText(/LegalAI currently supports/i)).toBeNull();
  });

  test("closes when close button, backdrop, or Escape key is triggered", () => {
    render(<HelpDocsModal isOpen={true} onClose={onClose} />);

    // Click desktop/mobile close button
    const closeBtns = screen.getAllByRole("button", { name: "Close help" });
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Press Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    // Click backdrop overlay
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);

    // Clicking inside modal card does NOT trigger onClose
    const modalCard = backdrop.querySelector(".help-modal-card")!;
    fireEvent.click(modalCard);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test("locks body scroll when opened and restores on unmount", () => {
    const { unmount } = render(<HelpDocsModal isOpen={true} onClose={onClose} />);
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });
});
