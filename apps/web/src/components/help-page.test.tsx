import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import HelpPage from "@/app/help/page";
import { AppShell } from "./app-shell";
import { LanguageProvider } from "@/lib/language-context";

// Mock router and auth
vi.mock("next/navigation", () => ({
  usePathname: () => "/help",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

let mockUserRole: "LAWYER" | "CLIENT" = "LAWYER";

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-123", name: "Counsel Test", role: mockUserRole },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
  }),
}));

describe("Help & Docs Center (/help)", () => {
  beforeEach(() => {
    mockUserRole = "LAWYER";
    vi.clearAllMocks();
  });

  test("1. Renders Help & Docs header, subtitle, and search bar", () => {
    render(<HelpPage />);

    expect(screen.getByRole("heading", { name: "Help & Docs", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Learn how to use LegalAI, analyze documents, compare contracts, and get the most from your workspace."
      )
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search help, guides, and FAQs...")).toBeInTheDocument();
  });

  test("2. Category navigation switches displayed guides", async () => {
    render(<HelpPage />);

    // Default category is Getting Started
    expect(screen.getByRole("heading", { name: "1. What is LegalAI?", level: 2 })).toBeInTheDocument();

    // Click "Compare Documents" category
    const compareCategoryBtn = screen.getByRole("button", { name: /compare documents/i });
    fireEvent.click(compareCategoryBtn);

    // Shows compare guide
    expect(screen.getByRole("heading", { name: "Comparing Contracts & Versions", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText(/If both document slots contain the same document, comparison cannot be started/i)
    ).toBeInTheDocument();

    // Click "AI Copilot / Chat" category
    const copilotCategoryBtn = screen.getByRole("button", { name: /ai copilot \/ chat/i });
    fireEvent.click(copilotCategoryBtn);

    expect(screen.getByRole("heading", { name: "Asking Questions & Grounding", level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText(/AI-generated information should be reviewed by a qualified legal professional/i)
    ).toBeInTheDocument();
  });

  test("3. Search filters guides and FAQs instantly and shows empty state when nothing matches", async () => {
    render(<HelpPage />);

    const searchInput = screen.getByPlaceholderText("Search help, guides, and FAQs...");

    // Search for "password"
    fireEvent.change(searchInput, { target: { value: "password" } });

    // Should display password articles and FAQs
    expect(screen.getByRole("heading", { name: "3. Password-Protected PDFs", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Can LegalAI process password-protected PDFs?")).toBeInTheDocument();

    // Search for non-existent term
    fireEvent.change(searchInput, { target: { value: "xyzunmatchedquery999" } });

    expect(screen.getByText("No results found")).toBeInTheDocument();
    const clearButtons = screen.getAllByRole("button", { name: /clear search/i });
    expect(clearButtons.length).toBeGreaterThanOrEqual(1);

    // Click clear search button
    fireEvent.click(clearButtons[0]);

    // Restores default view
    expect(screen.getByRole("heading", { name: "1. What is LegalAI?", level: 2 })).toBeInTheDocument();
  });

  test("4. FAQ accordion items expand and collapse correctly", async () => {
    render(<HelpPage />);

    // Switch to FAQ category
    const faqCategoryBtn = screen.getByRole("button", { name: /frequently asked questions/i });
    fireEvent.click(faqCategoryBtn);

    // Look for question
    const faqBtn = screen.getByRole("button", { name: /what file types are supported\?/i });
    expect(faqBtn).toBeInTheDocument();

    // Answer initially collapsed
    expect(screen.queryByText(/LegalAI currently supports/i)).toBeNull();

    // Click to expand
    fireEvent.click(faqBtn);
    expect(screen.getByText(/LegalAI currently supports/i)).toBeInTheDocument();

    // Click to collapse
    fireEvent.click(faqBtn);
    expect(screen.queryByText(/LegalAI currently supports/i)).toBeNull();
  });

  test("5. Lawyer and Client workspaces both have access to Help & Docs", () => {
    // Lawyer role
    mockUserRole = "LAWYER";
    const { unmount } = render(<HelpPage />);
    expect(screen.getByRole("heading", { name: "Help & Docs" })).toBeInTheDocument();
    unmount();

    // Client role
    mockUserRole = "CLIENT";
    render(<HelpPage />);
    expect(screen.getByRole("heading", { name: "Help & Docs" })).toBeInTheDocument();
  });

  test("6. Contact Support button opens support dialog and dismisses cleanly", () => {
    render(<HelpPage />);

    const supportBtn = screen.getByRole("button", { name: /contact support/i });
    fireEvent.click(supportBtn);

    // Modal appears
    expect(screen.getByRole("heading", { name: "Contact Workspace Support" })).toBeInTheDocument();
    expect(
      screen.getByText(/please reach out to your designated workspace administrator/i)
    ).toBeInTheDocument();

    // Click Close
    const closeBtn = screen.getByRole("button", { name: "Close" });
    fireEvent.click(closeBtn);

    expect(screen.queryByRole("heading", { name: "Contact Workspace Support" })).toBeNull();
  });

  test("7. AppShell profile menu includes Help & Docs link to /help", () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    );

    // Profile trigger button
    const profileBtn = screen.getByRole("button", { name: /counsel test/i });
    fireEvent.click(profileBtn);

    // Link to /help exists in profile menu
    const helpLink = screen.getByRole("link", { name: /help & docs/i });
    expect(helpLink).toBeInTheDocument();
    expect(helpLink).toHaveAttribute("href", "/help");
  });

  test("8. Renders large hero section with 'How can we help you?' and modern search bar", () => {
    render(<HelpPage />);

    expect(
      screen.getByRole("heading", { name: "How can we help you?", level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Learn how to use LegalAI, analyze documents, compare contracts, and get the most from your workspace."
      )
    ).toBeInTheDocument();
  });

  test("9. Topic cards render and clicking a topic card activates that documentation category", () => {
    render(<HelpPage />);

    // Topic card for Contract Comparison exists
    const compareTopicCard = screen.getByRole("button", { name: /contract comparison/i });
    expect(compareTopicCard).toBeInTheDocument();

    // Click it to switch to compare documentation
    fireEvent.click(compareTopicCard);
    expect(
      screen.getByRole("heading", { name: "Comparing Contracts & Versions", level: 2 })
    ).toBeInTheDocument();

    // Topic card for AI Legal Assistant exists
    const aiTopicCard = screen.getByRole("button", { name: /ai legal assistant/i });
    expect(aiTopicCard).toBeInTheDocument();
    fireEvent.click(aiTopicCard);
    expect(
      screen.getByRole("heading", { name: "Asking Questions & Grounding", level: 2 })
    ).toBeInTheDocument();
  });

  test("10. Popular search chips update search query and filter results", () => {
    render(<HelpPage />);

    const pdfChip = screen.getByRole("button", { name: "PDF Upload" });
    fireEvent.click(pdfChip);

    expect(screen.getByPlaceholderText("Search help, guides, and FAQs...")).toHaveValue("PDF Upload");
    expect(
      screen.getByRole("heading", { name: "2. Uploading a Legal Document", level: 2 })
    ).toBeInTheDocument();
  });

  test("11. Mouse movement near right edge reveals the scrollbar smoothly", () => {
    const { container } = render(<HelpPage />);

    const scrollContainer = container.querySelector(".help-page-container") as HTMLElement;
    expect(scrollContainer).toBeInTheDocument();
    expect(scrollContainer.classList.contains("scrollbar-revealed")).toBe(false);

    // Mock getBoundingClientRect
    vi.spyOn(scrollContainer, "getBoundingClientRect").mockReturnValue({
      right: 1000,
      left: 0,
      top: 0,
      bottom: 800,
      width: 1000,
      height: 800,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    // Move mouse near the right edge (x = 980, which is >= 1000 - 48 = 952)
    fireEvent.mouseMove(scrollContainer, { clientX: 980 });
    expect(scrollContainer.classList.contains("scrollbar-revealed")).toBe(true);

    // Move mouse away from the right edge (x = 400)
    fireEvent.mouseLeave(scrollContainer);
    expect(scrollContainer.classList.contains("scrollbar-revealed")).toBe(false);
  });

  test("12. Renders Help & Docs fully localized in Hindi", () => {
    window.localStorage.setItem("legalai-language", "hi");
    render(
      <LanguageProvider>
        <HelpPage />
      </LanguageProvider>
    );

    // Header & Knowledge Base badge
    expect(screen.getByText("LegalAI ज्ञान कोष")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "सहायता और दस्तावेज़", level: 1 })).toBeInTheDocument();

    // Hero section
    expect(screen.getByRole("heading", { name: "हम आपकी क्या सहायता कर सकते हैं?", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/जानें कि LegalAI का उपयोग कैसे करें/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("सहायता, गाइड और अक्सर पूछे जाने वाले प्रश्न खोजें...")).toBeInTheDocument();

    // Topic cards
    expect(screen.getByRole("button", { name: /अनुबंध तुलना/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /AI कानूनी सहायक/i })).toBeInTheDocument();

    // Categories
    expect(screen.getByRole("button", { name: /दस्तावेज़ों की तुलना करें/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /अक्सर पूछे जाने वाले प्रश्न/i })).toBeInTheDocument();

    // Default article in Hindi
    expect(screen.getByRole("heading", { name: "1. LegalAI क्या है?", level: 2 })).toBeInTheDocument();

    // Support button & modal
    const supportBtn = screen.getByRole("button", { name: /सहायता से संपर्क करें/i });
    fireEvent.click(supportBtn);

    expect(screen.getByRole("heading", { name: "कार्यक्षेत्र सहायता से संपर्क करें" })).toBeInTheDocument();
    expect(screen.getByText(/अपने निर्दिष्ट कार्यक्षेत्र व्यवस्थापक से संपर्क करें/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "बंद करें" })).toBeInTheDocument();
  });
});


