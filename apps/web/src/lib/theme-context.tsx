"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark" | "dark-navy";

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  supportedThemes: readonly Theme[];
}

export const THEME_STORAGE_KEY = "legalai-theme";
export const DEFAULT_THEME: Theme = "dark-navy";
export const SUPPORTED_THEMES: readonly Theme[] = ["light", "dark", "dark-navy"] as const;

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const fromDom = document.documentElement.getAttribute("data-theme") as Theme | null;
    if (fromDom && SUPPORTED_THEMES.includes(fromDom)) {
      return fromDom;
    }

    const fromStorage = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
    if (fromStorage && SUPPORTED_THEMES.includes(fromStorage)) {
      return fromStorage;
    }
  } catch {
    // Gracefully handle sandboxed/restricted iframe or storage disabled
  }

  return DEFAULT_THEME;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const applyThemeToDom = (newTheme: Theme) => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("data-theme", newTheme);
    document.documentElement.style.colorScheme = newTheme === "light" ? "light" : "dark";
  };

  const setTheme = (newTheme: Theme) => {
    if (!SUPPORTED_THEMES.includes(newTheme)) return;

    setThemeState(newTheme);
    applyThemeToDom(newTheme);

    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      window.dispatchEvent(
        new CustomEvent("legalai:theme-changed", { detail: { theme: newTheme } }),
      );
    } catch {
      // Ignore storage write errors
    }
  };

  // Sync on mount and listen to cross-tab / window changes
  useEffect(() => {
    applyThemeToDom(theme);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const nextTheme = e.newValue as Theme;
        if (SUPPORTED_THEMES.includes(nextTheme)) {
          setThemeState(nextTheme);
          applyThemeToDom(nextTheme);
        }
      }
    };

    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      if (custom.detail?.theme && SUPPORTED_THEMES.includes(custom.detail.theme)) {
        setThemeState(custom.detail.theme);
        applyThemeToDom(custom.detail.theme);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("legalai:theme-changed", handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("legalai:theme-changed", handleCustomChange);
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, supportedThemes: SUPPORTED_THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {},
      supportedThemes: SUPPORTED_THEMES,
    };
  }
  return context;
}

