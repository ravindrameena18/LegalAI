import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { DocumentItem } from "@/lib/api-client";

let mockDocs: DocumentItem[] = [];

vi.mock("next/navigation", () => ({
  usePathname: () => "/documents",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({ id: "doc-123" }),
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

vi.mock("@/lib/api-client", () => ({
  listDocuments: vi.fn(async () => mockDocs),
  uploadDocument: vi.fn(async (file: File) => ({
    id: "new-doc-1",
    name: file.name,
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: file.size,
    status: "ready",
    processing_status: "ready",
    page_count: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })),
  deleteDocument: vi.fn(async () => ({ message: "Deleted" })),
  getDocumentDownloadUrl: (id: string) => `/api/documents/${id}/download`,
  getDocument: vi.fn(async () => ({
    id: "doc-123",
    name: "NDA_Agreement.pdf",
    file_type: "pdf",
    mime_type: "application/pdf",
    file_size: 15000,
    status: "ready",
    processing_status: "ready",
    page_count: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    pages: [{ page_number: 1, text: "Extracted confidentiality terms." }],
  })),
}));

import DocumentsPage from "@/app/documents/page";
import DocumentDetailPage from "@/app/documents/[id]/page";
import { DocumentRow } from "@/components/document-row";

describe("Documents Workspace Frontend UI", () => {
  test("renders documents table with metadata and status pills", async () => {
    mockDocs = [
      {
        id: "doc-1",
        name: "Master_Services_Agreement.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 120000,
        status: "ready",
        processing_status: "ready",
        page_count: 5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "doc-2",
        name: "Scanned_Deed.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 85000,
        status: "ocr_required",
        processing_status: "ocr_required",
        page_count: 2,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    render(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Master_Services_Agreement.pdf")).toBeInTheDocument();
      expect(screen.getByText("Scanned_Deed.pdf")).toBeInTheDocument();
    });

    expect(screen.getByText("READY", { selector: ".status-pill" })).toBeInTheDocument();
    expect(screen.getByText("OCR Required", { selector: ".status-pill" })).toBeInTheDocument();
  });

  test("filters documents list by search input", async () => {
    mockDocs = [
      {
        id: "doc-1",
        name: "Employment_Agreement.docx",
        file_type: "docx",
        mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        file_size: 45000,
        status: "ready",
        processing_status: "ready",
        page_count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "doc-2",
        name: "Commercial_Lease.pdf",
        file_type: "pdf",
        mime_type: "application/pdf",
        file_size: 95000,
        status: "ready",
        processing_status: "ready",
        page_count: 4,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    render(<DocumentsPage />);

    await waitFor(() => {
      expect(screen.getByText("Employment_Agreement.docx")).toBeInTheDocument();
      expect(screen.getByText("Commercial_Lease.pdf")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search documents by name/i);
    fireEvent.change(searchInput, { target: { value: "Lease" } });

    await waitFor(() => {
      expect(screen.queryByText("Employment_Agreement.docx")).not.toBeInTheDocument();
      expect(screen.getByText("Commercial_Lease.pdf")).toBeInTheDocument();
    });
  });

  test("renders document details page with extracted text preview", async () => {
    render(<DocumentDetailPage />);

    await waitFor(() => {
      expect(screen.getByText("NDA_Agreement.pdf")).toBeInTheDocument();
      expect(screen.getByText("Extracted confidentiality terms.")).toBeInTheDocument();
    });
  });

  test("DocumentRow three-dot menu opens dropdown with theme-ready classes and destructive Delete", () => {
    const doc: DocumentItem = {
      id: "doc-test-1",
      name: "Non_Disclosure_Agreement.pdf",
      file_type: "pdf",
      mime_type: "application/pdf",
      file_size: 52000,
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
        downloadUrl="/api/documents/doc-test-1/download"
      />,
    );

    const moreBtn = screen.getByRole("button", { name: /more actions/i });
    expect(moreBtn).toHaveClass("doc-row-action-btn", "more-btn");
    expect(moreBtn).not.toHaveClass("active");

    fireEvent.click(moreBtn);

    expect(moreBtn).toHaveClass("active");
    const dropdownMenu = screen.getByRole("menu");
    expect(dropdownMenu).toHaveClass("doc-row-dropdown-menu");

    expect(screen.getByRole("menuitem", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /analyze/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /download/i })).toBeInTheDocument();

    const deleteItem = screen.getByRole("menuitem", { name: /delete/i });
    expect(deleteItem).toBeInTheDocument();
    expect(deleteItem).toHaveClass("dropdown-item", "destructive");
  });
});
