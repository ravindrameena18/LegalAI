import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { User } from "@/lib/api-client";

let mockUser: User | null = null;

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
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

import { AppShell } from "./app-shell";

describe("Frontend Role-Aware Navigation", () => {
  test("LAWYER sees full analysis and research tool navigation", () => {
    mockUser = {
      id: "lawyer-1",
      name: "Counsel Smith",
      email: "smith@law.com",
      role: "LAWYER",
    };

    render(
      <AppShell>
        <div>Lawyer Content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /analysis/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ai assistant/i })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /legal research/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
    expect(screen.getByText(/rbac: lawyer workspace/i)).toBeInTheDocument();
  });

  test("CLIENT portal navigation hides internal lawyer workbench items", () => {
    mockUser = {
      id: "client-1",
      name: "Acme Corp Client",
      email: "contact@acme.com",
      role: "CLIENT",
    };

    render(
      <AppShell>
        <div>Client Content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /compare/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /reports/i })).toBeInTheDocument();

    // Lawyer workbench tools are excluded for client role
    expect(screen.queryByRole("link", { name: /analysis/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /ai assistant/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /legal research/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /audit logs/i })).not.toBeInTheDocument();
    expect(screen.getByText(/rbac: client workspace/i)).toBeInTheDocument();
  });

  test("ADMIN sees administrative audit logs in navigation", () => {
    mockUser = {
      id: "admin-1",
      name: "System Admin",
      email: "admin@legalai.corp",
      role: "ADMIN",
    };

    render(
      <AppShell>
        <div>Admin Content</div>
      </AppShell>,
    );

    expect(screen.getByRole("link", { name: /audit logs/i })).toBeInTheDocument();
    expect(screen.getByText(/rbac: admin workspace/i)).toBeInTheDocument();
  });
});

