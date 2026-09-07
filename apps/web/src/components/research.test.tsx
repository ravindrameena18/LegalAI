import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ResearchPage from "@/app/research/page";
import { legalResearchService } from "@/lib/legal-research-service";
import type { User } from "@/lib/api-client";

let mockUser: User | null = {
  id: "lawyer-test-1",
  name: "Advocate Sharma",
  email: "sharma@law.in",
  role: "LAWYER",
};

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/research",
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    isLoading: false,
    isAuthenticated: !!mockUser,
    error: null,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    clearError: vi.fn(),
  }),
}));

describe("Source-Grounded Legal Research Workspace (/research)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUser = {
      id: "lawyer-test-1",
      name: "Advocate Sharma",
      email: "sharma@law.in",
      role: "LAWYER",
    };
  });

  test("direct service search returns provision and mapping", async () => {
    const res = await legalResearchService.search("IPC Section 300");
    expect(res.provision).toBeDefined();
    expect(res.statuteMapping?.currentSection).toBe("Section 101");
  });

  test("renders top header with breadcrumbs, Source-Grounded AI badge, and main titles", async () => {
    render(<ResearchPage />);

    expect(screen.getAllByText("Workspace").length).toBeGreaterThanOrEqual(1);
    const researchHeadings = screen.getAllByText("Legal Research");
    expect(researchHeadings.length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Source-Grounded AI")).toBeInTheDocument();
    expect(screen.getByText("Source-Grounded Legal Research")).toBeInTheDocument();
    expect(
      screen.getByText(/Verified legal search across Supreme Court of India judgments/i),
    ).toBeInTheDocument();
  });

  test("renders search input, filter dropdowns, and suggested benchmark chips", async () => {
    render(<ResearchPage />);

    const searchInput = screen.getByPlaceholderText(
      /Ask a legal question or search case laws, acts, or sections/i,
    );
    expect(searchInput).toBeInTheDocument();

    expect(screen.getByLabelText(/Filter source/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by Court/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Filter by Year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Sort by criterion/i)).toBeInTheDocument();

    // Suggested benchmark chips
    expect(screen.getByText("IPC Section 300")).toBeInTheDocument();
    expect(screen.getByText("IPC Section 34")).toBeInTheDocument();
    expect(screen.getByText("BNS murder")).toBeInTheDocument();
    expect(screen.getByText("Section 138 NI Act latest judgments")).toBeInTheDocument();
    expect(screen.getByText("Arbitration Supreme Court")).toBeInTheDocument();
    expect(screen.getByText("Anticipatory bail latest cases")).toBeInTheDocument();
    expect(screen.getByText("Contract breach Supreme Court")).toBeInTheDocument();
  });

  test("renders initial judgments, tabs, and official sources section", async () => {
    render(<ResearchPage />);

    // Wait for initial judgments
    await waitFor(() => {
      expect(screen.getAllByText(/Supreme Court of India/i).length).toBeGreaterThanOrEqual(1);
    });

    // Verify tabs
    expect(screen.getByRole("tab", { name: /Relevant Cases/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Acts & Sections/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Precedent Finder/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /My Library/i })).toBeInTheDocument();

    // Verify Official Legal Authorities & Registries footer
    expect(screen.getByText("Verified Legal Authorities & Registries")).toBeInTheDocument();
    expect(screen.getAllByText("Open Source ↗").length).toBeGreaterThanOrEqual(3);
  });

  test("searching 'IPC Section 300' renders AI Summary, Old Law vs Current Law comparison, and Virsa Singh precedent", async () => {
    render(<ResearchPage />);

    const chip300 = screen.getByText("IPC Section 300");
    fireEvent.click(chip300);

    // AI Summary card
    await waitFor(() => {
      expect(screen.getByText("AI Legal Research Summary")).toBeInTheDocument();
      expect(screen.getByText(/Grounded in Verified Sources/i)).toBeInTheDocument();
    });

    // Old Law vs Current Law transition comparison
    await waitFor(() => {
      expect(screen.getByText("OLD LAW (REPLACED)")).toBeInTheDocument();
      expect(screen.getByText("CURRENT LAW (IN FORCE)")).toBeInTheDocument();
      expect(screen.getAllByText(/Bharatiya Nyaya Sanhita, 2023 \(BNS\)/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/Section 101: Murder/i)).toBeInTheDocument();
      expect(screen.getByText("How the Law Changed:")).toBeInTheDocument();
      expect(screen.getByText("Key Differences & Additions:")).toBeInTheDocument();
    });

    // Cases displayed
    await waitFor(() => {
      expect(screen.getByText(/Virsa Singh v. State of Punjab/i)).toBeInTheDocument();
    });
  });

  test("searching 'IPC Section 34' displays transition to BNS Section 3(5) Common Intention", async () => {
    render(<ResearchPage />);

    const chip34 = screen.getByText("IPC Section 34");
    fireEvent.click(chip34);

    await waitFor(() => {
      expect(screen.getByText(/Section 3\(5\): Common Intention/i)).toBeInTheDocument();
      expect(screen.getByText(/Barendra Kumar Ghosh/i)).toBeInTheDocument();
    });
  });

  test("searching 'anticipatory bail latest cases' renders CrPC 438 to BNSS 482 transition and Sushila Aggarwal ruling", async () => {
    render(<ResearchPage />);

    const bailChip = screen.getByText("Anticipatory bail latest cases");
    fireEvent.click(bailChip);

    await waitFor(() => {
      expect(screen.getByText(/Section 482: Direction for grant of bail/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Sushila Aggarwal and Others v. State/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  test("precedent finder tab separates Supporting from Contrary/Distinguishing precedents", async () => {
    render(<ResearchPage />);

    // Switch to Precedent Finder tab
    const precedentTab = screen.getByRole("tab", { name: /Precedent Finder/i });
    fireEvent.click(precedentTab);

    await waitFor(() => {
      expect(screen.getByText("Precedent Classification")).toBeInTheDocument();
      expect(screen.getByText(/Supporting Precedents/i)).toBeInTheDocument();
      expect(screen.getByText(/Contrary \/ Distinguishing Precedents/i)).toBeInTheDocument();
    });
  });

  test("opens JudgmentDetailModal when clicking View Judgment and includes Open Official Judgment link", async () => {
    render(<ResearchPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/View Judgment/i).length).toBeGreaterThanOrEqual(1);
    });

    const viewButtons = screen.getAllByRole("button", { name: /View Judgment/i });
    fireEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("RATIO DECIDENDI (KEY LEGAL PRINCIPLE)")).toBeInTheDocument();
      expect(screen.getByText("Case Overview")).toBeInTheDocument();
      expect(screen.getByText(/Open Official Judgment ↗/i)).toBeInTheDocument();
    });

    const closeBtns = screen.getAllByRole("button", { name: "Close" });
    fireEvent.click(closeBtns[0]);
  });

  test("unconfigured query displays clear zero-fabrication safety notice without fake cases", async () => {
    render(<ResearchPage />);

    const searchInput = screen.getByPlaceholderText(
      /Ask a legal question or search case laws, acts, or sections/i,
    );
    fireEvent.change(searchInput, { target: { value: "completely unknown random phrase 987654" } });
    fireEvent.submit(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Verified Legal Source Not Found")).toBeInTheDocument();
      expect(screen.getByText(/In compliance with strict legal ethics/i)).toBeInTheDocument();
      expect(screen.getByText(/No verified legal cases found/i)).toBeInTheDocument();
    });
  });

  test("saves and deletes items in My Library", async () => {
    render(<ResearchPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Save case/i }).length).toBeGreaterThanOrEqual(1);
    });

    const saveButtons = screen.getAllByRole("button", { name: /Save case/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Remove from saved/i })).toBeInTheDocument();
    });

    // Go to My Library tab
    const savedTab = screen.getByRole("tab", { name: /My Library/i });
    fireEvent.click(savedTab);

    await waitFor(() => {
      expect(screen.getAllByText(/Saved/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByTitle("Remove from saved library")).toBeInTheDocument();
    });

    const deleteBtn = screen.getByTitle("Remove from saved library");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(screen.getByText(/No legal research saved yet/i)).toBeInTheDocument();
    });
  });

  test("renders point-wise structured markdown answer with headings and legal application notice", async () => {
    render(<ResearchPage />);

    const chip300 = screen.getByText("IPC Section 300");
    fireEvent.click(chip300);

    await waitFor(() => {
      expect(screen.getByText("AI Legal Research Summary")).toBeInTheDocument();
      expect(screen.getByText(/APPLICABLE LAW/i)).toBeInTheDocument();
      expect(screen.getByText(/WHY IT MAY APPLY/i)).toBeInTheDocument();
      expect(screen.getByText(/KEY REQUIREMENTS \/ INGREDIENTS/i)).toBeInTheDocument();
      expect(screen.getByText(/CURRENT LEGAL POSITION/i)).toBeInTheDocument();
    });
  });

  test("conduct query 'dhokhadhadi fraud' renders Potentially Relevant Legal Provisions card with ethical disclaimer and multi-statute sections", async () => {
    render(<ResearchPage />);

    const searchInput = screen.getByPlaceholderText(
      /Ask a legal question or search case laws, acts, or sections/i,
    );
    fireEvent.change(searchInput, { target: { value: "dhokhadhadi fraud 420" } });
    fireEvent.submit(searchInput);

    await waitFor(() => {
      expect(screen.getByText("Potentially Relevant Legal Provisions")).toBeInTheDocument();
      expect(
        screen.getByText(/Based on the facts and conduct described, multiple statutory provisions may apply/i),
      ).toBeInTheDocument();
      // Cheating provision
      expect(screen.getAllByText(/Cheating and dishonestly inducing delivery of property/i).length).toBeGreaterThanOrEqual(1);
      // Criminal breach of trust provision
      expect(screen.getAllByText(/Criminal breach of trust/i).length).toBeGreaterThanOrEqual(1);
      // IT Act provision
      expect(screen.getAllByText(/Information Technology Act, 2000/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  test("redirects CLIENT users away from /research to /dashboard", async () => {
    mockUser = {
      id: "client-1",
      name: "Client User",
      email: "client@test.com",
      role: "CLIENT",
    };

    render(<ResearchPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
