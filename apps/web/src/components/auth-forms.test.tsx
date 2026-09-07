import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";

const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSearchParams: () => ({
    get: (param: string) => (param === "from" ? "/documents" : null),
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

// Mock auth context
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockClearError = vi.fn();

import type { User } from "@/lib/api-client";

let mockAuthState = {
  user: null as User | null,
  isLoading: false,
  isAuthenticated: false,
  error: null as string | null,
  login: mockLogin,
  register: mockRegister,
  logout: mockLogout,
  refresh: vi.fn(),
  clearError: mockClearError,
};

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => mockAuthState,
}));

import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/register/page";
import { AppShell } from "./app-shell";

describe("Authentication Frontend Components", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState = {
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,
      login: mockLogin,
      register: mockRegister,
      logout: mockLogout,
      refresh: vi.fn(),
      clearError: mockClearError,
    };
  });

  test("renders login form and submits credentials", async () => {
    mockLogin.mockResolvedValueOnce(undefined);

    render(<LoginPage />);

    expect(screen.getByRole("heading", { name: /sign in to legalai/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/work email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "attorney@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "StrongPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in to workspace/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "attorney@example.com",
        password: "StrongPass123!",
      });
      expect(mockPush).toHaveBeenCalledWith("/documents");
    });
  });

  test("validates required fields on login form submission", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: /sign in to workspace/i }));

    expect(await screen.findByText(/email address is required/i)).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  test("renders registration form and validates password matching", async () => {
    render(<RegisterPage />);

    expect(
      screen.getByRole("heading", { name: /create your legalai account/i }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Jessica Pearson" },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "jessica@pearson.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "LegalTech2026!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "DifferentPass123!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create workspace account/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/passwords do not match/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  test("successfully submits valid registration", async () => {
    mockRegister.mockResolvedValueOnce(undefined);

    render(<RegisterPage />);

    fireEvent.change(screen.getByLabelText(/full name/i), {
      target: { value: "Harvey Specter" },
    });
    fireEvent.change(screen.getByLabelText(/work email/i), {
      target: { value: "harvey@specter.com" },
    });
    fireEvent.change(screen.getByLabelText(/^password/i), {
      target: { value: "WinningCase2026!" },
    });
    fireEvent.change(screen.getByLabelText(/confirm password/i), {
      target: { value: "WinningCase2026!" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create workspace account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: "Harvey Specter",
        email: "harvey@specter.com",
        role: "LAWYER",
        password: "WinningCase2026!",
        confirmPassword: "WinningCase2026!",
      });
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });

  test("renders AppShell with authenticated user profile and triggers logout", async () => {
    mockAuthState.user = {
      id: "123e4567-e89b-12d3-a456-426614174000",
      name: "Mike Ross",
      email: "mike@ross.com",
      role: "LAWYER",
    };
    mockAuthState.isAuthenticated = true;

    render(
      <AppShell>
        <div>Protected Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Mike Ross")).toBeInTheDocument();
    expect(screen.getByText("LAWYER", { selector: ".role-tag" })).toBeInTheDocument();
    expect(screen.getByText("MR")).toBeInTheDocument();

    // Open profile menu
    const profileTrigger = screen.getByRole("button", { name: /mike ross/i });
    expect(profileTrigger).toBeInTheDocument();
    fireEvent.click(profileTrigger);

    const signOutBtn = screen.getByRole("button", { name: /sign out/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });

  test("getBaseUrl resolves NEXT_PUBLIC_API_BASE_URL and strips trailing slashes", async () => {
    const { getBaseUrl } = await import("@/lib/api-client");
    const origEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

    try {
      process.env.NEXT_PUBLIC_API_BASE_URL = "https://legalai-api-dqmg.onrender.com/";
      expect(getBaseUrl()).toBe("https://legalai-api-dqmg.onrender.com");

      delete process.env.NEXT_PUBLIC_API_BASE_URL;
      expect(getBaseUrl()).toBe("http://localhost:8000");
    } finally {
      process.env.NEXT_PUBLIC_API_BASE_URL = origEnv;
    }
  });

  test("setAuthToken manages localStorage, legalai_session cookie, and getRequestHeaders", async () => {
    const { getAuthToken, setAuthToken, getRequestHeaders } = await import("@/lib/api-client");

    setAuthToken("test-jwt-token-123");
    expect(getAuthToken()).toBe("test-jwt-token-123");
    expect(localStorage.getItem("legalai_token")).toBe("test-jwt-token-123");
    expect(document.cookie).toContain("legalai_session=test-jwt-token-123");

    const headers = getRequestHeaders({ Accept: "application/json" });
    expect(headers.get("Authorization")).toBe("Bearer test-jwt-token-123");
    expect(headers.get("Accept")).toBe("application/json");

    setAuthToken(null);
    expect(getAuthToken()).toBeNull();
    expect(localStorage.getItem("legalai_token")).toBeNull();

    const headersAfterClear = getRequestHeaders();
    expect(headersAfterClear.get("Authorization")).toBeNull();
  });
});

