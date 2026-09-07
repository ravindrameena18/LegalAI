const mockPush = vi.fn();
const { mockState } = vi.hoisted(() => ({
  mockState: { pathname: "/dashboard" },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => mockState.pathname,
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));
vi.mock("@/lib/api-client", () => ({
  listDocuments: vi.fn(async () => []),
  deleteDocument: vi.fn(async () => ({ message: "Deleted" })),
}));
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Counsel Test", role: "LAWYER" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AppShell } from "./app-shell";
import { createChatSession } from "@/lib/chat-store";

describe("AppShell Sidebar Navigation & Layout", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  test("renders the LegalAI workspace navigation with Recent Chats and NO Recent Documents", () => {
    render(<AppShell><h1>Workspace</h1></AppShell>);

    // Brand and logo
    expect(screen.getByText("LegalAI")).toBeInTheDocument();
    expect(screen.getByText("Document Intelligence")).toBeInTheDocument();

    // New Chat button is present
    expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();

    // Navigation items
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /documents/i })).toHaveAttribute("href", "/documents");
    expect(screen.getByRole("link", { name: /compare/i })).toHaveAttribute("href", "/compare");
    expect(screen.getByRole("link", { name: /analysis/i })).toHaveAttribute("href", "/analysis");
    const researchLink = screen.getByRole("link", { name: /legal research/i });
    expect(researchLink).toHaveAttribute("href", "/research");
    expect(researchLink.querySelector(".nav-icon-wrap svg")).not.toBeNull();
    expect(screen.getByRole("link", { name: /reports/i })).toHaveAttribute("href", "/reports");
    expect(screen.queryByRole("link", { name: /ai assistant/i })).toBeNull();

    // Recent Chats section exists in sidebar
    expect(screen.getByText("Recent Chats")).toBeInTheDocument();
    expect(document.querySelector(".recent-chats-section")).not.toBeNull();

    // Recent Documents section is completely removed
    expect(screen.queryByText("Recent Documents")).toBeNull();
    expect(document.querySelector(".recent-docs-section")).toBeNull();

    // Footer initially shows ONLY user profile information (no Settings / Help & Docs / Sign out visible)
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /help & docs/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
    expect(screen.getByText("Counsel Test")).toBeInTheDocument();
    expect(screen.getByText("LAWYER", { selector: ".role-tag" })).toBeInTheDocument();
  });

  test("verifies Lawyer sidebar shows only Dashboard, Documents, Compare, Analysis, Legal Research, Reports and NO AI Assistant item", () => {
    render(<AppShell><h1>Workspace</h1></AppShell>);

    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    const workspaceNav = within(sidebar).getByLabelText("Main navigation");
    const workspaceLinks = within(workspaceNav).getAllByRole("link");
    const linkLabels = workspaceLinks.map((l) => l.getAttribute("aria-label"));

    expect(linkLabels).toEqual(["Dashboard", "Documents", "Compare", "Analysis", "Legal Research", "Reports"]);
    expect(within(sidebar).queryByRole("link", { name: /ai assistant/i })).toBeNull();
  });

  test("clicking user profile opens dropdown containing Settings, Help & Docs, and Sign out", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    const profileTrigger = screen.getByRole("button", { name: /counsel test/i });
    expect(profileTrigger).toHaveAttribute("aria-expanded", "false");

    // Initially menu items not visible
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /help & docs/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();

    // Click profile trigger -> opens menu
    fireEvent.click(profileTrigger);
    expect(profileTrigger).toHaveAttribute("aria-expanded", "true");

    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /help & docs/i })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Click profile trigger again -> closes menu
    fireEvent.click(profileTrigger);
    expect(profileTrigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });

  test("clicking Settings in profile menu opens SettingsModal in-place without redirecting", () => {
    render(<AppShell><div>Active Workspace Page</div></AppShell>);

    const profileTrigger = screen.getByRole("button", { name: /counsel test/i });
    fireEvent.click(profileTrigger);

    const settingsLink = screen.getByRole("link", { name: /settings/i });
    expect(settingsLink).toBeInTheDocument();

    // Click Settings
    fireEvent.click(settingsLink);

    // Profile menu is closed
    expect(profileTrigger).toHaveAttribute("aria-expanded", "false");

    // Modal dialog is opened over active page
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Active Workspace Page")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();

    // Closing the modal returns user to workspace
    const closeBtns = screen.getAllByRole("button", { name: /close settings/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Active Workspace Page")).toBeInTheDocument();
  });

  test("clicking Help & Docs in profile menu opens HelpDocsModal in-place without redirecting", () => {
    render(<AppShell><div>Active Workspace Page</div></AppShell>);

    const profileTrigger = screen.getByRole("button", { name: /counsel test/i });
    fireEvent.click(profileTrigger);

    const helpLink = screen.getByRole("link", { name: /help & docs/i });
    expect(helpLink).toBeInTheDocument();

    // Click Help & Docs
    fireEvent.click(helpLink);

    // Profile menu is closed
    expect(profileTrigger).toHaveAttribute("aria-expanded", "false");

    // Modal dialog is opened over active page
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Active Workspace Page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "HELP & DOCS" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "1. What is LegalAI?" })).toBeInTheDocument();

    // Closing the modal returns user to workspace
    const closeBtns = screen.getAllByRole("button", { name: /close help/i });
    fireEvent.click(closeBtns[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Active Workspace Page")).toBeInTheDocument();
  });

  test("profile menu closes on outside click and Escape key", () => {
    render(
      <AppShell>
        <div data-testid="outside-area">Outside Workspace</div>
      </AppShell>,
    );

    const profileTrigger = screen.getByRole("button", { name: /counsel test/i });

    // Open menu
    fireEvent.click(profileTrigger);
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    // Escape closes menu
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();

    // Open menu again
    fireEvent.click(profileTrigger);
    expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();

    // Outside click closes menu
    fireEvent.mouseDown(screen.getByTestId("outside-area"));
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
  });

  test("clicking '+ New Chat' creates a new chat session and navigates to /chat/[id]", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    const newChatBtn = screen.getByRole("button", { name: /new chat/i });
    expect(newChatBtn).toBeInTheDocument();

    fireEvent.click(newChatBtn);

    expect(mockPush).toHaveBeenCalledWith(expect.stringMatching(/\/chat\/.+/));
  });

  test("renders recent chats and clicking a recent chat links to /chat/[id], never /analysis", () => {
    const session1 = createChatSession("user-1", {
      id: "session-sample-123",
      title: "NDA Review Questions",
      documentName: "NDA.pdf",
      messages: [{ id: "m1", sender: "user", content: "Check liabilities" }],
    });

    render(<AppShell><div>Workspace content</div></AppShell>);

    expect(screen.getByText("NDA Review Questions")).toBeInTheDocument();
    const chatLink = screen.getByTitle("NDA Review Questions");
    expect(chatLink).toHaveAttribute("href", `/chat/${session1.id}`);
    expect(chatLink.getAttribute("href")).not.toContain("/analysis");
  });

  test("verifies Recent Documents is completely absent from the sidebar even when documents exist", async () => {
    const { listDocuments } = await import("@/lib/api-client");
    vi.mocked(listDocuments).mockResolvedValueOnce([
      {
        id: "6ef2c16b-96d5-44be-b656-54dfd913ab44",
        name: "10.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 25000,
        status: "ready",
        processing_status: "ready",
        page_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "raveena-doc-id-7788",
        name: "raveena.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 35000,
        status: "ready",
        processing_status: "ready",
        page_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    render(<AppShell><div>Workspace content</div></AppShell>);

    // Recent Documents heading, container, and items must be completely absent from the sidebar
    expect(screen.queryByText("Recent Documents")).toBeNull();
    expect(document.querySelector(".recent-docs-section")).toBeNull();
    expect(screen.queryByText("10.pdf")).toBeNull();
    expect(screen.queryByText("raveena.pdf")).toBeNull();
  });

  test("collapsing sidebar hides text labels but preserves all navigation items as icon-only buttons with tooltips", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    // Initially expanded
    expect(screen.getByText("LegalAI")).toBeInTheDocument();
    expect(screen.getByText("Document Intelligence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /open sidebar/i })).toBeNull();
    expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByText("Recent Chats")).toBeInTheDocument();
    expect(screen.getByText("Counsel Test")).toBeInTheDocument();

    // Click collapse button
    const collapseBtn = screen.getByRole("button", { name: /collapse sidebar/i });
    fireEvent.click(collapseBtn);

    // After collapse:
    // 1. Separate collapse/toggle button is completely gone
    expect(screen.queryByRole("button", { name: /collapse sidebar/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /expand sidebar/i })).toBeNull();

    // 2. LegalAI logo toggle button is present
    const logoToggle = screen.getByRole("button", { name: /open sidebar/i });
    expect(logoToggle).toBeInTheDocument();
    expect(logoToggle).toHaveAttribute("title", "Open sidebar");

    // 3. Navigation items remain functional as icon-only buttons with tooltips
    const newChatBtn = screen.getByRole("button", { name: /new chat/i });
    expect(newChatBtn).toHaveAttribute("title", "New Chat");
    expect(newChatBtn).toHaveAttribute("data-tooltip", "New Chat");

    const dashLink = screen.getByRole("link", { name: /dashboard/i });
    expect(dashLink).toHaveAttribute("title", "Dashboard");
    expect(dashLink).toHaveAttribute("data-tooltip", "Dashboard");

    const docLink = screen.getByRole("link", { name: /documents/i });
    expect(docLink).toHaveAttribute("title", "Documents");
    expect(docLink).toHaveAttribute("data-tooltip", "Documents");

    const compareLink = screen.getByRole("link", { name: /compare/i });
    expect(compareLink).toHaveAttribute("title", "Compare");
    expect(compareLink).toHaveAttribute("data-tooltip", "Compare");

    const reportsLink = screen.getByRole("link", { name: /reports/i });
    expect(reportsLink).toHaveAttribute("title", "Reports");
    expect(reportsLink).toHaveAttribute("data-tooltip", "Reports");

    const recentChatsLink = screen.getByRole("link", { name: /recent chats/i });
    expect(recentChatsLink).toHaveAttribute("title", "Recent Chats");
    expect(recentChatsLink).toHaveAttribute("data-tooltip", "Recent Chats");

    // 4. Settings and Help & Docs must NOT be separate links in collapsed mode (moved inside profile)
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /help & docs/i })).toBeNull();

    // 5. Collapsed profile avatar button is centered and present
    const profileAvatarBtn = screen.getByRole("button", { name: /counsel test profile/i });
    expect(profileAvatarBtn).toHaveAttribute("title", "Counsel Test (LAWYER)");

    // 6. Text labels are hidden within the sidebar
    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
    expect(within(sidebar).queryByText("Document Intelligence")).toBeNull();
    expect(within(sidebar).queryByText("Workspace")).toBeNull();
    expect(within(sidebar).queryByText("Recent Chats")).toBeNull();
    expect(within(sidebar).queryByText("Counsel Test")).toBeNull();

    // 7. .sidebar-collapsed class is applied to app-frame
    expect(document.querySelector(".app-frame")?.classList.contains("sidebar-collapsed")).toBe(true);
  });

  test("clicking the LegalAI logo in collapsed state expands the sidebar back to full view", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    // Collapse the sidebar
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(screen.getByRole("button", { name: /open sidebar/i })).toBeInTheDocument();

    // Click the LegalAI logo to expand
    fireEvent.click(screen.getByRole("button", { name: /open sidebar/i }));

    // Sidebar is expanded again
    expect(screen.queryByRole("button", { name: /open sidebar/i })).toBeNull();
    expect(screen.getByText("LegalAI")).toBeInTheDocument();
    expect(screen.getByText("Document Intelligence")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new chat/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText("Counsel Test")).toBeInTheDocument();
    expect(document.querySelector(".app-frame")?.classList.contains("sidebar-collapsed")).toBe(false);
  });

  test("clicking profile avatar in collapsed state opens the profile popover menu upward with Settings, Help & Docs, and Sign out", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    // Collapse the sidebar
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const avatarBtn = screen.getByRole("button", { name: /counsel test profile/i });
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");

    // Initially Settings, Help & Docs, and Sign out are not visible
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /help & docs/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();

    // Click avatar -> opens upward popover menu containing Settings, Help & Docs, and Sign out
    fireEvent.click(avatarBtn);
    expect(avatarBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /settings/i })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("link", { name: /help & docs/i })).toHaveAttribute("href", "/help");
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Escape closes menu
    fireEvent.keyDown(document, { key: "Escape" });
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /settings/i })).toBeNull();

    // Reopen menu
    fireEvent.click(avatarBtn);
    expect(avatarBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();

    // Click again -> closes menu
    fireEvent.click(avatarBtn);
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  test("renders modern outline SVG icons for Dashboard, Documents, and Reports in both expanded and collapsed modes", () => {
    render(<AppShell><div>Workspace content</div></AppShell>);

    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;

    // 1. In expanded mode: Dashboard, Documents, and Reports contain SVG outline icons
    const dashLink = within(sidebar).getByRole("link", { name: /dashboard/i });
    const dashSvg = dashLink.querySelector("svg");
    expect(dashSvg).not.toBeNull();
    expect(dashSvg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(dashSvg).toHaveAttribute("fill", "none");
    expect(dashSvg).toHaveAttribute("stroke", "currentColor");
    expect(dashSvg).toHaveAttribute("width", "21");
    expect(dashLink.textContent).not.toContain("⌂");

    const docLink = within(sidebar).getByRole("link", { name: /documents/i });
    const docSvg = docLink.querySelector("svg");
    expect(docSvg).not.toBeNull();
    expect(docSvg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(docSvg).toHaveAttribute("fill", "none");
    expect(docSvg).toHaveAttribute("stroke", "currentColor");
    expect(docSvg).toHaveAttribute("width", "21");
    expect(docLink.textContent).not.toContain("▤");

    const compareLink = within(sidebar).getByRole("link", { name: /compare/i });
    const compareSvg = compareLink.querySelector("svg");
    expect(compareSvg).not.toBeNull();
    expect(compareSvg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(compareSvg).toHaveAttribute("fill", "none");
    expect(compareSvg).toHaveAttribute("stroke", "currentColor");
    expect(compareSvg).toHaveAttribute("width", "21");

    const reportsLink = within(sidebar).getByRole("link", { name: /reports/i });
    const reportsSvg = reportsLink.querySelector("svg");
    expect(reportsSvg).not.toBeNull();
    expect(reportsSvg).toHaveAttribute("viewBox", "0 0 24 24");
    expect(reportsSvg).toHaveAttribute("fill", "none");
    expect(reportsSvg).toHaveAttribute("stroke", "currentColor");
    expect(reportsSvg).toHaveAttribute("width", "21");
    expect(reportsLink.textContent).not.toContain("▧");

    // 2. Collapse sidebar and verify icons scale to collapsed target (23px)
    fireEvent.click(within(sidebar).getByRole("button", { name: /collapse sidebar/i }));

    const collapsedDash = within(sidebar).getByRole("link", { name: /dashboard/i });
    const collapsedDashSvg = collapsedDash.querySelector("svg");
    expect(collapsedDashSvg).not.toBeNull();
    expect(collapsedDashSvg).toHaveAttribute("width", "23");

    const collapsedDoc = within(sidebar).getByRole("link", { name: /documents/i });
    const collapsedDocSvg = collapsedDoc.querySelector("svg");
    expect(collapsedDocSvg).not.toBeNull();
    expect(collapsedDocSvg).toHaveAttribute("width", "23");

    const collapsedCompare = within(sidebar).getByRole("link", { name: /compare/i });
    const collapsedCompareSvg = collapsedCompare.querySelector("svg");
    expect(collapsedCompareSvg).not.toBeNull();
    expect(collapsedCompareSvg).toHaveAttribute("width", "23");

    const collapsedReports = within(sidebar).getByRole("link", { name: /reports/i });
    const collapsedReportsSvg = collapsedReports.querySelector("svg");
    expect(collapsedReportsSvg).not.toBeNull();
    expect(collapsedReportsSvg).toHaveAttribute("width", "23");
  });

  test("maintains constant Recent Chat icon class and structure in both expanded and collapsed states", () => {
    createChatSession("user-1", {
      id: "session-sample-123",
      title: "10",
      documentName: "10.pdf",
      messages: [{ id: "m1", sender: "user", content: "Review 10.pdf" }],
    });

    render(<AppShell><div>Workspace content</div></AppShell>);

    const sidebar = document.querySelector<HTMLElement>(".sidebar")!;

    // 1. In expanded state: Recent chat item has recent-chat-icon
    const expandedChatLink = within(sidebar).getByTitle("10");
    const expandedIcon = expandedChatLink.querySelector(".recent-chat-icon");
    expect(expandedIcon).not.toBeNull();
    expect(expandedIcon?.textContent?.trim()).toBe("💬");

    // 2. Collapse the sidebar
    fireEvent.click(within(sidebar).getByRole("button", { name: /collapse sidebar/i }));

    // 3. In collapsed state: Recent chat item has the exact same recent-chat-icon
    const collapsedChatLink = within(sidebar).getByRole("link", { name: /recent chats/i });
    const collapsedIcon = collapsedChatLink.querySelector(".recent-chat-icon");
    expect(collapsedIcon).not.toBeNull();
    expect(collapsedIcon?.textContent?.trim()).toBe("💬");
  });

  describe("Active Navigation Item Consistency Across Routes", () => {
    test("verifies active state on /dashboard", () => {
      mockState.pathname = "/dashboard";
      const { unmount } = render(<AppShell><div>Dashboard Page</div></AppShell>);

      const dashboardLink = screen.getByRole("link", { name: /^dashboard$/i });
      const documentsLink = screen.getByRole("link", { name: /^documents$/i });
      const compareLink = screen.getByRole("link", { name: /^compare$/i });
      const reportsLink = screen.getByRole("link", { name: /^reports$/i });

      expect(dashboardLink).toHaveClass("active");
      expect(dashboardLink).toHaveAttribute("aria-current", "page");

      expect(documentsLink).not.toHaveClass("active");
      expect(documentsLink).not.toHaveAttribute("aria-current");

      expect(compareLink).not.toHaveClass("active");
      expect(compareLink).not.toHaveAttribute("aria-current");

      expect(reportsLink).not.toHaveClass("active");
      expect(reportsLink).not.toHaveAttribute("aria-current");

      unmount();
    });

    test("verifies active state on /documents", () => {
      mockState.pathname = "/documents";
      const { unmount } = render(<AppShell><div>Documents Page</div></AppShell>);

      const dashboardLink = screen.getByRole("link", { name: /^dashboard$/i });
      const documentsLink = screen.getByRole("link", { name: /^documents$/i });
      const compareLink = screen.getByRole("link", { name: /^compare$/i });
      const reportsLink = screen.getByRole("link", { name: /^reports$/i });

      expect(documentsLink).toHaveClass("active");
      expect(documentsLink).toHaveAttribute("aria-current", "page");

      expect(dashboardLink).not.toHaveClass("active");
      expect(dashboardLink).not.toHaveAttribute("aria-current");

      expect(compareLink).not.toHaveClass("active");
      expect(compareLink).not.toHaveAttribute("aria-current");

      expect(reportsLink).not.toHaveClass("active");
      expect(reportsLink).not.toHaveAttribute("aria-current");

      unmount();
    });

    test("verifies active state on /compare", () => {
      mockState.pathname = "/compare";
      const { unmount } = render(<AppShell><div>Compare Page</div></AppShell>);

      const dashboardLink = screen.getByRole("link", { name: /^dashboard$/i });
      const documentsLink = screen.getByRole("link", { name: /^documents$/i });
      const compareLink = screen.getByRole("link", { name: /^compare$/i });
      const reportsLink = screen.getByRole("link", { name: /^reports$/i });

      expect(compareLink).toHaveClass("active");
      expect(compareLink).toHaveAttribute("aria-current", "page");

      expect(dashboardLink).not.toHaveClass("active");
      expect(dashboardLink).not.toHaveAttribute("aria-current");

      expect(documentsLink).not.toHaveClass("active");
      expect(documentsLink).not.toHaveAttribute("aria-current");

      expect(reportsLink).not.toHaveClass("active");
      expect(reportsLink).not.toHaveAttribute("aria-current");

      unmount();
    });

    test("verifies active state on /reports", () => {
      mockState.pathname = "/reports";
      const { unmount } = render(<AppShell><div>Reports Page</div></AppShell>);

      const dashboardLink = screen.getByRole("link", { name: /^dashboard$/i });
      const documentsLink = screen.getByRole("link", { name: /^documents$/i });
      const compareLink = screen.getByRole("link", { name: /^compare$/i });
      const reportsLink = screen.getByRole("link", { name: /^reports$/i });

      expect(reportsLink).toHaveClass("active");
      expect(reportsLink).toHaveAttribute("aria-current", "page");

      expect(dashboardLink).not.toHaveClass("active");
      expect(dashboardLink).not.toHaveAttribute("aria-current");

      expect(documentsLink).not.toHaveClass("active");
      expect(documentsLink).not.toHaveAttribute("aria-current");

      expect(compareLink).not.toHaveClass("active");
      expect(compareLink).not.toHaveAttribute("aria-current");

      unmount();
    });

    test("verifies active state in collapsed sidebar navigation", () => {
      mockState.pathname = "/compare";
      const { unmount } = render(<AppShell><div>Collapsed Compare</div></AppShell>);

      const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
      fireEvent.click(within(sidebar).getByRole("button", { name: /collapse sidebar/i }));

      const collapsedCompare = within(sidebar).getByRole("link", { name: /^compare$/i });
      const collapsedDashboard = within(sidebar).getByRole("link", { name: /^dashboard$/i });

      expect(collapsedCompare).toHaveClass("active");
      expect(collapsedCompare).toHaveAttribute("aria-current", "page");

      expect(collapsedDashboard).not.toHaveClass("active");
      expect(collapsedDashboard).not.toHaveAttribute("aria-current");

      unmount();
    });
  });

  describe("Profile Area Structure & State Consistency", () => {
    test("verifies profile section elements in expanded sidebar", () => {
      render(<AppShell><div>Profile Test</div></AppShell>);

      const footer = document.querySelector(".sidebar-footer")!;
      expect(footer).toBeInTheDocument();

      const triggerCard = footer.querySelector(".profile-trigger-card")!;
      expect(triggerCard).toBeInTheDocument();
      expect(triggerCard).not.toHaveClass("open");
      expect(triggerCard).toHaveAttribute("aria-expanded", "false");

      // Avatar
      const avatar = triggerCard.querySelector(".avatar")!;
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveTextContent("CT");

      // Name
      const name = triggerCard.querySelector(".profile-name")!;
      expect(name).toBeInTheDocument();
      expect(name).toHaveTextContent("Counsel Test");

      // Role tag
      const roleTag = triggerCard.querySelector(".role-tag")!;
      expect(roleTag).toBeInTheDocument();
      expect(roleTag).toHaveTextContent("LAWYER");

      // RBAC note
      const rbacNote = triggerCard.querySelector(".role-ux-note")!;
      expect(rbacNote).toBeInTheDocument();
      expect(rbacNote).toHaveTextContent(/RBAC: LAWYER workspace/i);

      // Chevron
      const chevron = triggerCard.querySelector(".profile-trigger-chevron")!;
      expect(chevron).toBeInTheDocument();

      // Click trigger -> becomes open with open class
      fireEvent.click(triggerCard);
      expect(triggerCard).toHaveClass("open");
      expect(triggerCard).toHaveAttribute("aria-expanded", "true");

      // Click trigger again -> closes
      fireEvent.click(triggerCard);
      expect(triggerCard).not.toHaveClass("open");
      expect(triggerCard).toHaveAttribute("aria-expanded", "false");
    });

    test("verifies profile trigger in collapsed sidebar", () => {
      render(<AppShell><div>Collapsed Profile Test</div></AppShell>);

      const sidebar = document.querySelector<HTMLElement>(".sidebar")!;
      fireEvent.click(within(sidebar).getByRole("button", { name: /collapse sidebar/i }));

      const collapsedBtn = screen.getByRole("button", { name: /counsel test profile/i });
      expect(collapsedBtn).toHaveClass("collapsed-avatar-btn");
      expect(collapsedBtn).not.toHaveClass("open");
      expect(collapsedBtn).toHaveAttribute("aria-expanded", "false");

      // Click -> opens menu and gets open class
      fireEvent.click(collapsedBtn);
      expect(collapsedBtn).toHaveClass("open");
      expect(collapsedBtn).toHaveAttribute("aria-expanded", "true");

      // Click again -> closes
      fireEvent.click(collapsedBtn);
      expect(collapsedBtn).not.toHaveClass("open");
      expect(collapsedBtn).toHaveAttribute("aria-expanded", "false");
    });
  });
});