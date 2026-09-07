import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { ThemeProvider, useTheme } from "./theme-context";

describe("ThemeContext & ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  test("defaults to 'dark-navy' when localStorage has no theme saved", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe("dark-navy");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark-navy");
  });

  test("initializes from valid theme in localStorage ('light')", () => {
    window.localStorage.setItem("legalai-theme", "light");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  test("initializes from valid theme in localStorage ('dark')", () => {
    window.localStorage.setItem("legalai-theme", "dark");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  test("falls back to 'dark-navy' if an unknown theme string is in localStorage", () => {
    window.localStorage.setItem("legalai-theme", "invalid-theme-value");

    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe("dark-navy");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark-navy");
  });

  test("setTheme switches theme and updates DOM and localStorage", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    expect(result.current.theme).toBe("dark-navy");

    // Switch to Light
    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(window.localStorage.getItem("legalai-theme")).toBe("light");

    // Switch to Dark
    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem("legalai-theme")).toBe("dark");

    // Switch back to Dark Navy
    act(() => {
      result.current.setTheme("dark-navy");
    });

    expect(result.current.theme).toBe("dark-navy");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark-navy");
    expect(window.localStorage.getItem("legalai-theme")).toBe("dark-navy");
  });

  test("responds to custom 'legalai:theme-changed' window events", () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: ({ children }) => <ThemeProvider>{children}</ThemeProvider>,
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("legalai:theme-changed", { detail: { theme: "light" } })
      );
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});

