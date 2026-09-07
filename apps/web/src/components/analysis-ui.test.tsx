import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";

const mockAnalysisData = {
  id: "analysis-123",
  document_id: "doc-1",
  version_id: "ver-1",
  status: "completed",
  summary: "Comprehensive non-disclosure and intellectual property agreement.",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  risk_count: 2,
  clause_count: 2,
  structured_data: {
    executive_summary: "Comprehensive non-disclosure and intellectual property agreement.",
    document_type: "Mutual Non-Disclosure Agreement",
    parties: [
      { name: "Acme Legal Corp", role: "Disclosing Party", notice_address: "100 Broadway, NY" },
      { name: "Beta Partners LLC", role: "Receiving Party", notice_address: "200 Wall St, NY" },
    ],
    important_dates: [
      { title: "Effective Date", date: "January 1, 2026", source_text: "effective January 1, 2026", page: 1 },
    ],
    financial_terms: [
      { term: "Consideration", amount_or_rate: "Mutual Covenants", details: "No direct fees", page: 1 },
    ],
    obligations: [
      { party: "Beta Partners LLC", obligation: "Maintain strict confidentiality", page: 1 },
    ],
    rights: [
      { party: "Acme Legal Corp", right: "Audit receiving party security standards", page: 2 },
    ],
    termination: {
      for_cause: "Immediate upon material breach",
      for_convenience: "30 days prior written notice",
      notice_period: "30 days",
      consequences: "Prompt return or destruction of materials",
      page: 2,
    },
    renewal: {
      type: "Not found in the provided document.",
      terms: "Not found in the provided document.",
      notice_window: "Not found in the provided document.",
    },
    confidentiality: {
      definition_scope: "All non-public proprietary business data",
      duration: "5 years from disclosure date",
      standard_exclusions: "Public knowledge, independently developed",
      page: 1,
    },
    liability: {
      caps: "Direct damages only capped at $50,000",
      consequential_damages_exclusion: "Excludes special, indirect, or consequential damages",
      carveouts: "Breach of confidentiality obligations",
      page: 3,
    },
    indemnity: {
      scope: "Not found in the provided document.",
      covered_parties: "Not found in the provided document.",
      procedure: "Not found in the provided document.",
    },
    intellectual_property: {
      ownership: "Discloser retains all proprietary rights and title",
      work_for_hire: "Not found in the provided document.",
      license_grant: "No license granted by implication or estoppel",
      page: 2,
    },
    governing_law: {
      governing_state_or_nation: "State of New York",
      page: 3,
    },
    jurisdiction: {
      court_venue: "Courts of New York County, New York",
      exclusive: "Exclusive jurisdiction",
      page: 3,
    },
    dispute_resolution: {
      mechanism: "Binding arbitration before AAA",
      escalation_steps: "30-day executive negotiation",
      rules: "Commercial Arbitration Rules",
      page: 3,
    },
    warranties: {
      express_warranties: "Authority to disclose without third-party infringement",
      disclaimers: "Information provided AS-IS",
      page: 2,
    },
    representations: {
      corporate_authority: "Fully authorized by corporate resolutions",
      regulatory_compliance: "Not found in the provided document.",
      page: 2,
    },
    non_compete: {
      applicable: "Not found in the provided document.",
      scope: "Not found in the provided document.",
      duration: "Not found in the provided document.",
      territory: "Not found in the provided document.",
    },
    non_solicitation: {
      applicable: "Not found in the provided document.",
      scope: "Not found in the provided document.",
      duration: "Not found in the provided document.",
      territory: "Not found in the provided document.",
    },
    data_protection: {
      applicable: "Reasonable administrative and technical safeguards",
      security_standards: "SOC 2 Type II",
      breach_notification_window: "48 hours from discovery",
      page: 2,
    },
    important_clauses: [
      {
        clause_type: "Confidentiality",
        title: "Standard Non-Disclosure Duty",
        original_text: "Recipient shall hold confidential information in strict trust.",
        explanation: "Duty of confidentiality with strict trust standard.",
        page: 1,
        section: "Section 2",
        importance: "HIGH",
        risk_level: "LOW",
        confidence: 0.95,
      },
    ],
    risks: [
      {
        title: "Uncapped Liability Exposure in Confidentiality Carveout",
        severity: "CRITICAL" as const,
        explanation: "Carveout leaves receiving party vulnerable to uncapped damages for technical breach.",
        source_text: "Section 4.1 liability cap shall not apply to breach of Section 2.",
        page: 3,
        section: "Section 4.2",
        confidence: 0.94,
        suggested_review_action: "Insert liability supercap of 2x total contract value.",
      },
    ],
    missing_or_unclear_information: [
      {
        term: "Indemnity Clause",
        explanation: "Indemnity clause is missing from the agreement.",
        page: 2,
        section: "Section 5",
        source_text: "sample indemnity gap",
        confidence: 0.95,
      },
      {
        term: "Renewal Terms",
        explanation: "Renewal mechanism not specified in the document.",
        page: null,
        section: null,
        source_text: null,
        confidence: 0.9,
      },
    ],
  },
};

vi.mock("next/navigation", () => ({
  usePathname: () => "/analysis",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({
    get: (key: string) => (key === "document_id" ? "doc-1" : null),
  }),
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
    user: { id: "user-1", name: "Counsel Test", role: "LAWYER" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    listDocuments: vi.fn(async () => [
      {
        id: "doc-1",
        name: "Acme_NDA_Agreement.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 50000,
        status: "ready",
        processing_status: "ready",
        page_count: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]),
    getDocumentAnalysis: vi.fn(async () => mockAnalysisData),
    triggerDocumentAnalysis: vi.fn(async () => mockAnalysisData),
    getWorkspaceStats: vi.fn(async () => ({
      document_count: 1,
      analysis_count: 1,
      risk_count: 1,
      report_count: 0,
    })),
    getAIProviderStatus: vi.fn(async () => ({
      provider: "gemini",
      model: "gemini-2.5-flash",
      configured: true,
    })),
  };
});

import AnalysisPage from "@/app/analysis/page";

describe("Analysis Workspace Frontend UI", () => {
  test("renders legal disclaimer and executive summary", async () => {
    render(<AnalysisPage />);

    // Check mandatory legal disclaimer
    expect(
      screen.getByText(/LEGAL DISCLAIMER & COMPLIANCE NOTICE/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not provide legal advice and is not a substitute/i),
    ).toBeInTheDocument();

    // Check executive summary loaded
    await waitFor(() => {
      expect(
        screen.getByText(
          "Comprehensive non-disclosure and intellectual property agreement.",
        ),
      ).toBeInTheDocument();
    });

    // Check parties
    expect(screen.getByText("Acme Legal Corp")).toBeInTheDocument();
    expect(screen.getByText("Beta Partners LLC")).toBeInTheDocument();
  });

  test("renders risk cards with CRITICAL severity badge and opens evidence inspector modal", async () => {
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Risks Assessment/i)).toBeInTheDocument();
    });

    // Click Risks Assessment tab
    const risksTab = screen.getByRole("tab", { name: /Risks Assessment/i });
    fireEvent.click(risksTab);

    // Verify risk card appears with CRITICAL severity
    await waitFor(() => {
      expect(
        screen.getByText("Uncapped Liability Exposure in Confidentiality Carveout"),
      ).toBeInTheDocument();
      expect(screen.getByText("CRITICAL")).toBeInTheDocument();
    });

    // Click Inspect Verbatim Evidence button
    const inspectBtn = screen.getByText(/Inspect Verbatim Evidence/i);
    fireEvent.click(inspectBtn);

    // Verify evidence modal opens with verbatim quote
    await waitFor(() => {
      expect(
        screen.getByText(/Source Evidence Verification/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Section 4.1 liability cap shall not apply to breach of Section 2/i,
        ),
      ).toBeInTheDocument();
    });

    // Close modal
    const doneBtn = screen.getByText("Done");
    fireEvent.click(doneBtn);

    await waitFor(() => {
      expect(
        screen.queryByText(/Source Evidence Verification/i),
      ).not.toBeInTheDocument();
    });
  });

  test("renders missing terms and gaps tab with structured items", async () => {
    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Missing Terms & Gaps/i)).toBeInTheDocument();
    });

    // Click Missing Terms tab
    const gapsTab = screen.getByRole("tab", { name: /Missing Terms & Gaps/i });
    fireEvent.click(gapsTab);

    await waitFor(() => {
      expect(screen.getByText("Indemnity Clause")).toBeInTheDocument();
      expect(screen.getByText("Indemnity clause is missing from the agreement.")).toBeInTheDocument();
      expect(screen.getByText("Renewal Terms")).toBeInTheDocument();
      expect(screen.getByText("Renewal mechanism not specified in the document.")).toBeInTheDocument();
    });
  });

  test("renders missing terms backward compatibility with legacy string items", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      structured_data: {
        ...mockAnalysisData.structured_data,
        missing_or_unclear_information: [
          "Legacy Missing Term A",
          "Legacy Missing Term B",
        ] as unknown as [],
      },
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Missing Terms & Gaps/i)).toBeInTheDocument();
    });

    const gapsTab = screen.getByRole("tab", { name: /Missing Terms & Gaps/i });
    fireEvent.click(gapsTab);

    await waitFor(() => {
      expect(screen.getByText("Legacy Missing Term A")).toBeInTheDocument();
      expect(screen.getByText("Legacy Missing Term B")).toBeInTheDocument();
    });
  });

  test("renders proper empty state when missing terms is empty", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      structured_data: {
        ...mockAnalysisData.structured_data,
        missing_or_unclear_information: [],
      },
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Missing Terms & Gaps/i)).toBeInTheDocument();
    });

    const gapsTab = screen.getByRole("tab", { name: /Missing Terms & Gaps/i });
    fireEvent.click(gapsTab);

    await waitFor(() => {
      expect(
        screen.getByText("No major omissions detected in the document."),
      ).toBeInTheDocument();
    });
  });

  test("renders gracefully when parties is null or empty without crashing", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      structured_data: {
        ...mockAnalysisData.structured_data,
        parties: null as unknown as [],
      },
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(
        screen.getByText("No parties identified in the provided document."),
      ).toBeInTheDocument();
    });
  });

  test("renders proper empty state when clauses is empty", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      structured_data: {
        ...mockAnalysisData.structured_data,
        important_clauses: [],
      },
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Clauses & Terms/i)).toBeInTheDocument();
    });

    const clausesTab = screen.getByRole("tab", { name: /Clauses & Terms/i });
    fireEvent.click(clausesTab);

    await waitFor(() => {
      expect(screen.getByText("No clauses identified.")).toBeInTheDocument();
    });
  });

  test("renders proper empty state when risks is empty", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      structured_data: {
        ...mockAnalysisData.structured_data,
        risks: [],
      },
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText(/Risks Assessment/i)).toBeInTheDocument();
    });

    const risksTab = screen.getByRole("tab", { name: /Risks Assessment/i });
    fireEvent.click(risksTab);

    await waitFor(() => {
      expect(screen.getByText("No risks identified.")).toBeInTheDocument();
    });
  });

  test("renders failed analysis state with retry button", async () => {
    const { getDocumentAnalysis } = await import("@/lib/api-client");
    vi.mocked(getDocumentAnalysis).mockResolvedValueOnce({
      ...mockAnalysisData,
      status: "failed",
      error_message: "Gemini quota exceeded or invalid response format.",
      structured_data: {} as unknown as typeof mockAnalysisData.structured_data,
    });

    render(<AnalysisPage />);

    await waitFor(() => {
      expect(screen.getByText("AI Analysis Failed")).toBeInTheDocument();
      expect(
        screen.getByText("Gemini quota exceeded or invalid response format."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Retry Analysis with Google Gemini"),
      ).toBeInTheDocument();
    });
  });
});

