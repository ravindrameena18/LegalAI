const mockGetHealth = vi.fn(async () => ({ status: "ok", version: "1.0.0" }));
const mockLogout = vi.fn(async () => {});

let mockUser = { id: "u-123", name: "Counsel Test", email: "counsel@law.com", role: "LAWYER" };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    onClick,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/api-client", () => ({
  getHealth: () => mockGetHealth(),
}));

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: mockUser,
    logout: mockLogout,
    isLoading: false,
    isAuthenticated: true,
  }),
}));

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ThemeProvider } from "@/lib/theme-context";
import { SettingsModal } from "./settings-modal";

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("SettingsModal Component", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    mockUser = { id: "u-123", name: "Counsel Test", email: "counsel@law.com", role: "LAWYER" };
  });

  test("does not render anything when isOpen is false", () => {
    renderWithTheme(<SettingsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("renders modal with exactly 7 categories and default General category when open", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();

    // Verify all 7 categories exist
    expect(screen.getByRole("tab", { name: /general/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /appearance/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /workspace/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /documents/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /ai & analysis/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /privacy & security/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /notifications/i })).toBeInTheDocument();

    // Verify duplicate Help & Support tab is completely removed from Settings
    expect(screen.queryByRole("tab", { name: /help & support/i })).toBeNull();

    // Default category is General
    expect(screen.getByRole("heading", { name: "General" })).toBeInTheDocument();
    expect(screen.getAllByText("Counsel Test").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("counsel@law.com")).toBeInTheDocument();
  });

  test("switching categories displays the corresponding content pane", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} />);

    // Switch to Appearance
    fireEvent.click(screen.getByRole("tab", { name: /appearance/i }));
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByText("Theme Palette")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Light" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dark Navy" })).toBeInTheDocument();

    // Switch to AI & Analysis
    fireEvent.click(screen.getByRole("tab", { name: /ai & analysis/i }));
    expect(screen.getByRole("heading", { name: "AI & Analysis" })).toBeInTheDocument();
    expect(screen.getByText("gemini-3.5-flash (Active)")).toBeInTheDocument();
    expect(screen.getByText("Inference Temperature")).toBeInTheDocument();

    // Switch to Privacy & Security
    fireEvent.click(screen.getByRole("tab", { name: /privacy & security/i }));
    expect(screen.getByRole("heading", { name: "Privacy & Security" })).toBeInTheDocument();
    expect(screen.getByText("Argon2 (pwdlib[argon2])")).toBeInTheDocument();

    // Switch to Workspace (which now houses telemetry & diagnostics)
    fireEvent.click(screen.getByRole("tab", { name: /workspace/i }));
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /test backend connection/i })).toBeInTheDocument();
  });

  test("appearance theme controls switch between Light, Dark, and Dark Navy", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="appearance" />);

    const lightBtn = screen.getByRole("radio", { name: "Light" });
    const darkBtn = screen.getByRole("radio", { name: "Dark" });
    const navyBtn = screen.getByRole("radio", { name: "Dark Navy" });

    // Initial default is dark-navy
    expect(navyBtn).toHaveAttribute("aria-checked", "true");

    // Click Light
    fireEvent.click(lightBtn);
    expect(lightBtn).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("legalai-theme")).toBe("light");

    // Click Dark
    fireEvent.click(darkBtn);
    expect(darkBtn).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("legalai-theme")).toBe("dark");

    // Click Dark Navy
    fireEvent.click(navyBtn);
    expect(navyBtn).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark-navy");
    expect(window.localStorage.getItem("legalai-theme")).toBe("dark-navy");
  });

  test("search filtering filters category list based on keywords", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} />);

    const searchInput = screen.getByPlaceholderText(/search settings\.\.\./i);

    // Search for "temperature"
    fireEvent.change(searchInput, { target: { value: "temperature" } });

    expect(screen.getByRole("tab", { name: /ai & analysis/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /appearance/i })).toBeNull();
    expect(screen.queryByRole("tab", { name: /notifications/i })).toBeNull();

    // Search for non-existent keyword
    fireEvent.change(searchInput, { target: { value: "xyznonexistent123" } });
    expect(screen.getByText(/no settings match/i)).toBeInTheDocument();

    // Clear search
    const clearBtn = screen.getByRole("button", { name: /clear search/i });
    fireEvent.click(clearBtn);
    expect(screen.getByRole("tab", { name: /appearance/i })).toBeInTheDocument();
  });

  test("close mechanisms: close buttons, escape key, and backdrop click trigger onClose", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} />);

    // 1. Close icon in nav header or content header
    const closeBtns = screen.getAllByRole("button", { name: /close settings/i });
    expect(closeBtns.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(closeBtns[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    // 2. Escape key
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);

    // 3. Backdrop click
    const backdrop = screen.getByRole("dialog");
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test("runs live backend connection test in Workspace settings and reports latency", async () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="workspace" />);

    const testConnBtn = screen.getByRole("button", { name: /test backend connection/i });
    expect(testConnBtn).toBeInTheDocument();

    fireEvent.click(testConnBtn);

    await waitFor(() => {
      expect(mockGetHealth).toHaveBeenCalled();
      expect(screen.getByText(/● OK/i)).toBeInTheDocument();
    });
  });

  test("renders client role workspace information correctly", () => {
    mockUser = { id: "u-456", name: "Client User", email: "client@corp.com", role: "CLIENT" };
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="workspace" />);

    expect(screen.getByText(/client workspace mode/i)).toBeInTheDocument();
  });

  test("Settings modal General category contains Date Format and has NO Session & Security or Log out option", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="general" />);

    // General settings contains Date Format
    expect(screen.getByText("Date Format")).toBeInTheDocument();

    // Verifies duplicate logout is completely removed from Settings modal
    expect(screen.queryByText(/session & security/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /log out/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign out/i })).toBeNull();
  });

  test("Language dropdown contains strictly English (US) and हिंदी (Hindi) and excludes others", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="general" />);

    const languageSelect = screen.getByDisplayValue("English (US)") as HTMLSelectElement;
    expect(languageSelect).toBeInTheDocument();

    const options = Array.from(languageSelect.options).map((opt) => opt.textContent);
    expect(options).toEqual(["English (US)", "हिंदी (Hindi)"]);

    // Excluded languages MUST NOT exist
    expect(options).not.toContain("English (UK)");
    expect(options).not.toContain("Spanish (Español)");
    expect(options).not.toContain("French (Français)");
  });

  test("selecting हिंदी (Hindi) switches interface language and persists", () => {
    renderWithTheme(<SettingsModal isOpen={true} onClose={onClose} initialCategory="general" />);

    const languageSelect = screen.getByDisplayValue("English (US)");
    fireEvent.change(languageSelect, { target: { value: "हिंदी (Hindi)" } });

    // Save notice reflects Hindi update
    expect(screen.getByText(/भाषा प्राथमिकता बदलकर हिंदी \(Hindi\) कर दी गई है/i)).toBeInTheDocument();
  });
});
