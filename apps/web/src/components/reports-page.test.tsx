import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ReportsPage from "@/app/reports/page";
import type { DocumentItem, ReportItem } from "@/lib/api-client";

// Mock router and auth
vi.mock("next/navigation", () => ({
  usePathname: () => "/reports",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Counsel Test", role: "LAWYER" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const mockDocs: DocumentItem[] = [
  {
    id: "doc-1",
    name: "Master_Services_Agreement_Final_Signed_Execution_Version_2026_Enterprise_Confidential.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: 45000,
    status: "ready",
    processing_status: "ready",
    page_count: 12,
    created_at: "2026-03-01T10:00:00Z",
    updated_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "doc-2",
    name: "Non_Disclosure_Agreement.docx",
    file_type: "docx",
    mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    file_size: 18000,
    status: "ready",
    processing_status: "processing",
    page_count: 3,
    created_at: "2026-03-02T11:30:00Z",
    updated_at: "2026-03-02T11:30:00Z",
  },
];

const mockReports: ReportItem[] = [
  {
    id: "rep-1",
    document_id: "doc-1",
    document_name: "Master_Services_Agreement_Final_Signed_Execution_Version_2026_Enterprise_Confidential.pdf",
    format: "pdf",
    status: "COMPLETED",
    risk_level: "HIGH",
    risk_score: 18,
    created_at: "2026-03-01T10:00:00Z",
  },
  {
    id: "rep-2",
    document_id: "doc-2",
    document_name: "Non_Disclosure_Agreement.docx",
    format: "pdf",
    status: "PROCESSING",
    risk_level: "LOW",
    risk_score: 2,
    created_at: "2026-03-02T11:30:00Z",
  },
];

const { mockListDocs, mockListReports } = vi.hoisted(() => ({
  mockListDocs: vi.fn(),
  mockListReports: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    listDocuments: mockListDocs,
    listReports: mockListReports,
  };
});

describe("ReportsPage typography & layout", () => {
  beforeEach(() => {
    mockListDocs.mockResolvedValue(mockDocs);
    mockListReports.mockResolvedValue(mockReports);
  });

  test("renders reports list grid with proper card hierarchy", async () => {
    render(<ReportsPage />);

    // Wait for documents to load
    await waitFor(() => {
      expect(screen.getAllByText(/Master_Services_Agreement_Final/i).length).toBeGreaterThanOrEqual(1);
    });

    // Check titles
    const titles = document.querySelectorAll(".report-name");
    expect(titles.length).toBe(2);
    expect(titles[0].textContent).toContain("Executive Legal Intelligence Brief — Master_Services_Agreement_Final_Signed_Execution_Version_2026_Enterprise_Confidential");

    // Check metadata
    const submetas = document.querySelectorAll(".report-submeta");
    expect(submetas.length).toBe(2);
    expect(submetas[0].textContent).toContain("Document:");
    expect(submetas[0].textContent).toContain("Generated:");

    // Check badges
    const statusPills = document.querySelectorAll(".status-pill");
    expect(statusPills.length).toBe(2);
    expect(statusPills[0].textContent?.trim()).toBe("COMPLETED");
    expect(statusPills[1].textContent?.trim()).toBe("PROCESSING");

    const riskPills = document.querySelectorAll(".risk-pill");
    expect(riskPills.length).toBe(2);
    expect(riskPills[0].textContent?.trim()).toBe("HIGH RISK");
    expect(riskPills[1].textContent?.trim()).toBe("LOW RISK");

    // Check action buttons
    const viewButtons = screen.getAllByRole("link", { name: /view analysis/i });
    expect(viewButtons.length).toBe(2);
    expect(viewButtons[0]).toHaveAttribute("href", "/analysis?document_id=doc-1");

    const exportButtons = screen.getAllByRole("button", { name: /export pdf/i });
    expect(exportButtons.length).toBe(2);
  });

  test("triggers print dialog when Export PDF is clicked", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /export pdf/i }).length).toBe(2);
    });

    const exportButtons = screen.getAllByRole("button", { name: /export pdf/i });
    fireEvent.click(exportButtons[0]);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  test("filters reports using the search toolbar", async () => {
    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.getAllByText(/Master_Services_Agreement_Final/i).length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText(/search reports or documents/i);
    fireEvent.change(searchInput, { target: { value: "Non_Disclosure" } });

    expect(screen.queryAllByText(/Master_Services_Agreement_Final/i).length).toBe(0);
    expect(screen.getAllByText(/Non_Disclosure_Agreement/i).length).toBeGreaterThanOrEqual(1);
  });
});
