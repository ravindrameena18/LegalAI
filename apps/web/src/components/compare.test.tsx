import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import ComparePage from "@/app/compare/page";
import type { ComparisonResponse, DocumentItem } from "@/lib/api-client";

// Mock router and auth
vi.mock("next/navigation", () => ({
  usePathname: () => "/compare",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Counsel Test", role: "LAWYER" },
    isLoading: false,
    isAuthenticated: true,
  }),
}));

const mockDocA: DocumentItem = {
  id: "doc-111",
  name: "Master_Services_Agreement_v1.pdf",
  file_type: "pdf",
  mime_type: "application/pdf",
  file_size: 24000,
  status: "ready",
  processing_status: "ready",
  page_count: 4,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockDocB: DocumentItem = {
  id: "doc-222",
  name: "Master_Services_Agreement_v2.pdf",
  file_type: "pdf",
  mime_type: "application/pdf",
  file_size: 28000,
  status: "ready",
  processing_status: "ready",
  page_count: 5,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockProtectedDoc: DocumentItem = {
  id: "doc-333",
  name: "Confidential_Addendum_PROTECTED.pdf",
  file_type: "pdf",
  mime_type: "application/pdf",
  file_size: 15000,
  status: "password_required",
  processing_status: "password_required",
  page_count: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockComparisonResult: ComparisonResponse = {
  id: "comp-999",
  doc_a_id: "doc-111",
  doc_b_id: "doc-222",
  doc_a_label: "Original Draft (v1)",
  doc_b_label: "Revised Draft (v2)",
  status: "completed",
  created_at: new Date().toISOString(),
  result_data: {
    executive_summary: "Key structural modifications detected in limitation of liability and indemnification.",
    doc_a_title: "Original Draft (v1)",
    doc_b_title: "Revised Draft (v2)",
    metrics: {
      total_changes: 3,
      added_count: 1,
      removed_count: 0,
      modified_count: 2,
      unchanged_count: 4,
      overall_risk_impact: "HIGH",
    },
    important_changes: [
      {
        title: "Liability Cap Doubled",
        category: "Limitation of Liability",
        severity: "HIGH",
        description: "Aggregate liability cap increased from 1x to 2x annual contract fees.",
        legal_impact: "Increases commercial financial exposure.",
      },
    ],
    clause_comparisons: [
      {
        topic: "Limitation of Liability",
        clause_title: "Limitation of Liability",
        change_type: "modified",
        risk_level: "HIGH",
        risk_score: 8.5,
        risk_reason: "Liability cap was doubled from $10k to $20k.",
        legal_impact: "Increases aggregate breach exposure.",
        doc_a_text: "Liability is capped at $10,000.",
        doc_b_text: "Liability is capped at $20,000 with uncapped IP carveout.",
        doc_a_page: 2,
        doc_b_page: 2,
        doc_a_section: "Section 5",
        doc_b_section: "Section 5",
        change_summary: "Cap increased and IP carveouts removed from limit.",
      },
      {
        topic: "Payment Terms",
        clause_title: "Payment Terms",
        change_type: "modified",
        risk_level: "MEDIUM",
        risk_score: 5.5,
        risk_reason: "Payment window accelerated from net 30 to net 15.",
        legal_impact: "Accelerates default triggers.",
        doc_a_text: "Net 30 days.",
        doc_b_text: "Net 15 days.",
        doc_a_page: 1,
        doc_b_page: 1,
        doc_a_section: "Section 2",
        doc_b_section: "Section 2",
        change_summary: "Payment window shortened to 15 days.",
      },
      {
        topic: "Audit Rights",
        clause_title: "Audit Rights",
        change_type: "added",
        risk_level: "LOW",
        risk_score: 2.0,
        risk_reason: "Audit rights added without penalty terms.",
        legal_impact: "Allows periodic operational inspection.",
        doc_a_text: null,
        doc_b_text: "Annual audit permitted upon 10 days notice.",
        doc_a_page: null,
        doc_b_page: 3,
        doc_a_section: null,
        doc_b_section: "Section 8",
        change_summary: "New audit right provision added.",
      },
    ],
  },
};

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    listDocuments: vi.fn(async () => [mockDocA, mockDocB, mockProtectedDoc]),
    uploadDocument: vi.fn(async (file: File) => ({
      ...mockDocA,
      id: `uploaded-${file.name}`,
      name: file.name,
      file_size: file.size || 24000,
      processing_status: file.name.includes("PROTECTED") ? "password_required" : "ready",
      status: file.name.includes("PROTECTED") ? "password_required" : "ready",
    })),
    unlockDocument: vi.fn(async (_id: string, pwd: string) => {
      if (pwd === "correct_password") {
        return {
          ...mockProtectedDoc,
          processing_status: "ready",
          status: "ready",
          page_count: 6,
        };
      }
      throw new Error("Invalid password provided");
    }),
    createComparison: vi.fn(async () => mockComparisonResult),
  };
});

describe("Compare Documents Feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renders compare page header and two upload cards", async () => {
    render(<ComparePage />);

    expect(screen.getByRole("heading", { name: "Compare Documents", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText("Upload two legal documents to identify differences, risks, clauses, and important changes.")
    ).toBeInTheDocument();

    // Check Document 1 and Document 2 upload cards
    expect(screen.getByRole("heading", { name: "Document 1", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Document 2", level: 3 })).toBeInTheDocument();

    // Compare Documents button initially disabled
    const compareBtn = screen.getByRole("button", { name: /compare documents/i });
    expect(compareBtn).toBeDisabled();
  });

  test("warns and prevents comparison when identical document is selected in both slots", async () => {
    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toHaveTextContent("(3)");
    });

    // Open workspace picker for Document 1
    const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
    fireEvent.click(pickers[0]);

    // Select Document A for slot 1
    const docAOption1 = await screen.findByText("Master_Services_Agreement_v1.pdf");
    fireEvent.click(docAOption1);

    // Open workspace picker for Document 2
    const remainingPickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
    fireEvent.click(remainingPickers[0]);

    // Select Document A for slot 2 as well
    const docAOptions = await screen.findAllByText("Master_Services_Agreement_v1.pdf");
    fireEvent.click(docAOptions[docAOptions.length - 1]);

    // Same document warning must appear
    expect(screen.getByText("Please select two different documents to compare.")).toBeInTheDocument();

    // Compare button remains disabled
    const compareBtn = screen.getByRole("button", { name: /compare documents/i });
    expect(compareBtn).toBeDisabled();
  });

  test("shows Unlock PDF button when a password-protected document is selected", async () => {
    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toHaveTextContent("(3)");
    });

    const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
    fireEvent.click(pickers[0]);

    const protectedOption = await screen.findByText("Confidential_Addendum_PROTECTED.pdf");
    fireEvent.click(protectedOption);

    // Shows Unlock PDF button
    expect(await screen.findByRole("button", { name: /unlock pdf/i })).toBeInTheDocument();
  });

  test("successful comparison renders metrics, summary, important changes, and side-by-side clauses", async () => {
    const { createComparison } = await import("@/lib/api-client");

    render(<ComparePage />);

    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toHaveTextContent("(3)");
    });

    // Select Doc A for slot 1
    const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
    fireEvent.click(pickers[0]);
    const docAOption = await screen.findByText("Master_Services_Agreement_v1.pdf");
    fireEvent.click(docAOption);

    // Select Doc B for slot 2
    const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
    fireEvent.click(pickerB[0]);
    const docBOption = await screen.findByText("Master_Services_Agreement_v2.pdf");
    fireEvent.click(docBOption);

    // Compare button should now be enabled
    const compareBtn = screen.getByRole("button", { name: /compare documents/i });
    expect(compareBtn).not.toBeDisabled();

    // Trigger comparison
    fireEvent.click(compareBtn);

    // Verify createComparison was called
    await waitFor(() => {
      expect(createComparison).toHaveBeenCalledWith({
        doc_a_id: "doc-111",
        doc_b_id: "doc-222",
        doc_a_label: "Master_Services_Agreement_v1.pdf",
        doc_b_label: "Master_Services_Agreement_v2.pdf",
      });
    });

    // Check Results Dashboard
    expect(await screen.findByText("AI Executive Comparison Summary")).toBeInTheDocument();
    expect(screen.getByText("Key structural modifications detected in limitation of liability and indemnification.")).toBeInTheDocument();

    // Check Metrics
    expect(screen.getByText("Total Changes")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // total changes
    expect(screen.getByText("Added Clauses")).toBeInTheDocument();
    expect(screen.getByText("Removed Clauses")).toBeInTheDocument();
    expect(screen.getByText("Overall Risk Impact")).toBeInTheDocument();

    // Check Important Changes
    expect(screen.getByText("Liability Cap Doubled")).toBeInTheDocument();
    expect(screen.getByText("Aggregate liability cap increased from 1x to 2x annual contract fees.")).toBeInTheDocument();

    // Check Side-by-Side Clause Redline
    expect(screen.getByText("Side-by-Side Clause Redline")).toBeInTheDocument();
    expect(screen.getByText("Limitation of Liability")).toBeInTheDocument();
    expect(screen.getByText('"Liability is capped at $10,000."')).toBeInTheDocument();
    expect(screen.getByText('"Liability is capped at $20,000 with uncapped IP carveout."')).toBeInTheDocument();

    // Test filter tabs: Click "MODIFIED" tab
    const modifiedTab = screen.getByRole("button", { name: "MODIFIED" });
    fireEvent.click(modifiedTab);
    expect(screen.getByText("Limitation of Liability")).toBeInTheDocument();
    expect(screen.queryByText("Audit Rights")).toBeNull(); // Added clause hidden when filtering for modified

    // Export button is available
    expect(screen.getByRole("button", { name: /export summary/i })).toBeInTheDocument();
  });

  describe("Document Replacement and Edge Cases", () => {
    test("TEST 1: Select A + B -> Replace Document 1 with C -> Result = C + B", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A for slot 1
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      const docAOption = await screen.findByText("Master_Services_Agreement_v1.pdf");
      fireEvent.click(docAOption);

      // Select Doc B for slot 2
      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      const docBOption = await screen.findByText("Master_Services_Agreement_v2.pdf");
      fireEvent.click(docBOption);

      // Verify A + B selected
      expect(screen.getByText("Master_Services_Agreement_v1.pdf")).toBeInTheDocument();
      expect(screen.getByText("Master_Services_Agreement_v2.pdf")).toBeInTheDocument();

      // Replace Document 1 with File C
      const fileInputA = screen.getByTestId("file-input-a");
      const fileC = new File(["sample content C"], "Vendor_Agreement_Final_v3.pdf", { type: "application/pdf" });
      fireEvent.change(fileInputA, { target: { files: [fileC] } });

      // Result must be C + B
      await waitFor(() => {
        expect(screen.getByText("Vendor_Agreement_Final_v3.pdf")).toBeInTheDocument();
      });
      expect(screen.getByText("Master_Services_Agreement_v2.pdf")).toBeInTheDocument();
      expect(screen.queryByText("Master_Services_Agreement_v1.pdf")).toBeNull();
    });

    test("TEST 2: Select A + B -> Replace Document 2 with C -> Result = A + C", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A for slot 1
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      const docAOption = await screen.findByText("Master_Services_Agreement_v1.pdf");
      fireEvent.click(docAOption);

      // Select Doc B for slot 2
      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      const docBOption = await screen.findByText("Master_Services_Agreement_v2.pdf");
      fireEvent.click(docBOption);

      // Replace Document 2 with File C
      const fileInputB = screen.getByTestId("file-input-b");
      const fileC = new File(["sample content C"], "Vendor_Agreement_Final_v3.pdf", { type: "application/pdf" });
      fireEvent.change(fileInputB, { target: { files: [fileC] } });

      // Result must be A + C
      await waitFor(() => {
        expect(screen.getByText("Vendor_Agreement_Final_v3.pdf")).toBeInTheDocument();
      });
      expect(screen.getByText("Master_Services_Agreement_v1.pdf")).toBeInTheDocument();
      expect(screen.queryByText("Master_Services_Agreement_v2.pdf")).toBeNull();
    });

    test("TEST 3: Select A + A -> warning shown -> Replace Document 2 with B -> warning disappears & Compare enabled", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A in slot 1
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      const docAOption1 = await screen.findByText("Master_Services_Agreement_v1.pdf");
      fireEvent.click(docAOption1);

      // Select Doc A in slot 2
      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      const docAOptions = await screen.findAllByText("Master_Services_Agreement_v1.pdf");
      fireEvent.click(docAOptions[docAOptions.length - 1]);

      // Warning shown and compare disabled
      expect(screen.getByText("Please select two different documents to compare.")).toBeInTheDocument();
      const compareBtn = screen.getByRole("button", { name: /compare documents/i });
      expect(compareBtn).toBeDisabled();

      // Click Replace on Document 2
      const replaceButtons = screen.getAllByRole("button", { name: /replace/i });
      fireEvent.click(replaceButtons[1]);

      // Click Doc B from dropdown menu
      const docBOptions = await screen.findAllByText("Master_Services_Agreement_v2.pdf");
      fireEvent.click(docBOptions[docBOptions.length - 1]);

      // Warning disappears and Compare button becomes enabled
      await waitFor(() => {
        expect(screen.queryByText("Please select two different documents to compare.")).toBeNull();
      });
      expect(compareBtn).not.toBeDisabled();
      expect(screen.getByText("Master_Services_Agreement_v1.pdf")).toBeInTheDocument();
      expect(screen.getByText("Master_Services_Agreement_v2.pdf")).toBeInTheDocument();
    });

    test("TEST 4: Replace with password-protected PDF -> password prompt -> correct password -> Ready", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A in slot 1, Doc B in slot 2
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      // Click Replace on Document 2
      const replaceButtons = screen.getAllByRole("button", { name: /replace/i });
      fireEvent.click(replaceButtons[1]);

      // Select protected document
      const protectedOptions = await screen.findAllByText("Confidential_Addendum_PROTECTED.pdf");
      fireEvent.click(protectedOptions[protectedOptions.length - 1]);

      // Password prompt modal appears
      expect(await screen.findByRole("heading", { name: "Password-Protected PDF" })).toBeInTheDocument();

      // Enter correct password and submit
      const passwordInput = screen.getByPlaceholderText(/enter document password/i);
      fireEvent.change(passwordInput, { target: { value: "correct_password" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock & process/i }));

      // Modal closes and Ready status badge appears
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Password-Protected PDF" })).toBeNull();
      });
      const readyBadges = await screen.findAllByText("Ready");
      expect(readyBadges.length).toBeGreaterThanOrEqual(2);
    });

    test("TEST 5: Replace with password-protected PDF -> wrong password -> error shown -> retry works", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A in slot 1, Doc B in slot 2
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      // Click Replace on Document 2
      const replaceButtons = screen.getAllByRole("button", { name: /replace/i });
      fireEvent.click(replaceButtons[1]);

      // Select protected document
      const protectedOptions = await screen.findAllByText("Confidential_Addendum_PROTECTED.pdf");
      fireEvent.click(protectedOptions[protectedOptions.length - 1]);

      // Modal opens
      expect(await screen.findByRole("heading", { name: "Password-Protected PDF" })).toBeInTheDocument();

      // Submit incorrect password
      const passwordInput = screen.getByPlaceholderText(/enter document password/i);
      fireEvent.change(passwordInput, { target: { value: "wrong_password" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock & process/i }));

      // Error message is displayed in modal
      expect(await screen.findByText(/invalid password provided/i)).toBeInTheDocument();

      // Retry with correct password
      fireEvent.change(passwordInput, { target: { value: "correct_password" } });
      fireEvent.click(screen.getByRole("button", { name: /unlock & process/i }));

      // Modal closes and slot updates to Ready
      await waitFor(() => {
        expect(screen.queryByRole("heading", { name: "Password-Protected PDF" })).toBeNull();
      });
      const readyBadges = await screen.findAllByText("Ready");
      expect(readyBadges.length).toBeGreaterThanOrEqual(2);
    });

    test("TEST 6: Remove Document 1 -> only Document 1 is removed -> Document 2 remains", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A in slot 1, Doc B in slot 2
      const pickersA = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersA[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickersB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickersB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      // Remove Document 1
      const removeButtons = screen.getAllByRole("button", { name: /remove document 1/i });
      fireEvent.click(removeButtons[0]);

      // Document 1 reset to upload dropzone
      expect(screen.getByText(/upload or drag document 1/i)).toBeInTheDocument();

      // Document 2 remains intact
      expect(screen.getByText("Master_Services_Agreement_v2.pdf")).toBeInTheDocument();
    });

    test("TEST 7: renders directional risk reason and legal impact on clause cards", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      const compareBtn = screen.getByRole("button", { name: /compare documents/i });
      fireEvent.click(compareBtn);

      expect(await screen.findByText("Liability cap was doubled from $10k to $20k.")).toBeInTheDocument();
      expect(screen.getByText("Increases aggregate breach exposure.")).toBeInTheDocument();
      expect(screen.getByText("Payment window accelerated from net 30 to net 15.")).toBeInTheDocument();
    });

    test("TEST 8: verifies vertical section order: Executive Summary -> Side-by-Side Clause Redline -> Key Legal Changes", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      const compareBtn = screen.getByRole("button", { name: /compare documents/i });
      fireEvent.click(compareBtn);

      const summaryHeading = await screen.findByRole("heading", { name: "AI Executive Comparison Summary", level: 3 });
      const sideBySideHeading = screen.getByRole("heading", { name: "Side-by-Side Clause Redline", level: 3 });
      const keyChangesHeading = screen.getByRole("heading", { name: "Key Legal Changes & Risk Differences", level: 3 });

      // Node.DOCUMENT_POSITION_FOLLOWING = 4
      const summaryToSide = summaryHeading.compareDocumentPosition(sideBySideHeading);
      const sideToKey = sideBySideHeading.compareDocumentPosition(keyChangesHeading);

      expect(summaryToSide & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(sideToKey & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    test("TEST 9: when comparison fails, old comparison result is cleared and only error is visible", async () => {
      const { createComparison } = await import("@/lib/api-client");
      const mockCreateComparison = vi.mocked(createComparison);

      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // 1. First run: Successful comparison
      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      const compareBtn = screen.getByRole("button", { name: /compare documents/i });
      fireEvent.click(compareBtn);

      // Verify result appears
      expect(await screen.findByText("Total Changes")).toBeInTheDocument();
      expect(screen.getByText("AI Executive Comparison Summary")).toBeInTheDocument();

      // 2. Mock next comparison to fail (e.g. AI quota exceeded)
      mockCreateComparison.mockRejectedValueOnce(
        new Error("AI comparison analysis is temporarily unavailable because the AI service quota/rate limit has been reached.")
      );

      // 3. Click Compare Documents again (triggers failure)
      fireEvent.click(compareBtn);

      // 4. MUST show error banner and MUST NOT show any previous comparison result
      expect(await screen.findByTestId("compare-error-banner")).toBeInTheDocument();
      expect(screen.getByText(/AI comparison analysis is temporarily unavailable/i)).toBeInTheDocument();
      expect(screen.getByText(/The current documents were not compared. No previous comparison result is being displayed./i)).toBeInTheDocument();

      // Old metrics and clauses MUST NOT remain visible
      expect(screen.queryByText("Total Changes")).toBeNull();
      expect(screen.queryByText("AI Executive Comparison Summary")).toBeNull();
      expect(screen.queryByText("Side-by-Side Clause Redline")).toBeNull();
      expect(screen.queryByText("Key Legal Changes & Risk Differences")).toBeNull();
    });

    test("TEST 10: replacing Document 1 immediately clears previous comparison result", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A and Doc B, then compare
      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      fireEvent.click(screen.getByRole("button", { name: /compare documents/i }));
      expect(await screen.findByText("Total Changes")).toBeInTheDocument();

      // Replace Document 1 with a new file
      const fileInputA = screen.getByTestId("file-input-a");
      const fileC = new File(["sample content C"], "Vendor_Agreement_Final_v3.pdf", { type: "application/pdf" });
      fireEvent.change(fileInputA, { target: { files: [fileC] } });

      await waitFor(() => {
        expect(screen.getByText("Vendor_Agreement_Final_v3.pdf")).toBeInTheDocument();
      });

      // Previous result MUST disappear immediately
      expect(screen.queryByText("Total Changes")).toBeNull();
      expect(screen.queryByText("Side-by-Side Clause Redline")).toBeNull();
      expect(screen.queryByText("AI Executive Comparison Summary")).toBeNull();
    });

    test("TEST 11: swapping Document 1 and Document 2 immediately clears previous comparison result", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A and Doc B, then compare
      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      fireEvent.click(screen.getByRole("button", { name: /compare documents/i }));
      expect(await screen.findByText("Total Changes")).toBeInTheDocument();

      // Click Swap Documents button
      const swapBtn = screen.getByRole("button", { name: /swap document 1 and document 2/i });
      fireEvent.click(swapBtn);

      // Previous comparison result MUST be cleared
      expect(screen.queryByText("Total Changes")).toBeNull();
      expect(screen.queryByText("Side-by-Side Clause Redline")).toBeNull();
      expect(screen.queryByText("AI Executive Comparison Summary")).toBeNull();
    });

    test("TEST 12: removing Document 1 immediately clears previous comparison result", async () => {
      render(<ComparePage />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /choose from uploaded documents/i })[0]).toBeInTheDocument();
      });

      // Select Doc A and Doc B, then compare
      const pickers = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickers[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v1.pdf"));

      const pickerB = screen.getAllByRole("button", { name: /choose from uploaded documents/i });
      fireEvent.click(pickerB[0]);
      fireEvent.click(await screen.findByText("Master_Services_Agreement_v2.pdf"));

      fireEvent.click(screen.getByRole("button", { name: /compare documents/i }));
      expect(await screen.findByText("Total Changes")).toBeInTheDocument();

      // Click Remove on Document 1
      const removeButtons = screen.getAllByRole("button", { name: /remove document 1/i });
      fireEvent.click(removeButtons[0]);

      // Previous comparison result MUST be cleared immediately
      expect(screen.queryByText("Total Changes")).toBeNull();
      expect(screen.queryByText("Side-by-Side Clause Redline")).toBeNull();
      expect(screen.queryByText("AI Executive Comparison Summary")).toBeNull();
    });
  });
});
