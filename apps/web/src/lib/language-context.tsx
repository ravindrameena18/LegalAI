"use client";

import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { translate, type SupportedLanguage, type TranslationKey } from "./translations";

export type LanguageCode = SupportedLanguage;
export type LanguageLabel = "English (US)" | "हिंदी (Hindi)";

export interface LanguageOption {
  code: LanguageCode;
  label: LanguageLabel;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: "en", label: "English (US)" },
  { code: "hi", label: "हिंदी (Hindi)" },
] as const;

export const DEFAULT_LANGUAGE: LanguageCode = "en";
export const LANGUAGE_STORAGE_KEY = "legalai-language";

export interface LanguageContextType {
  language: LanguageCode;
  languageLabel: LanguageLabel;
  setLanguage: (lang: LanguageCode | LanguageLabel | string) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isHindi: boolean;
  supportedLanguages: readonly LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function normalizeLanguage(input: string | null | undefined): LanguageCode {
  if (!input) return DEFAULT_LANGUAGE;
  const lower = input.trim().toLowerCase();
  if (lower === "hi" || lower.startsWith("hi-") || lower.includes("hindi") || lower.includes("हिंदी")) {
    return "hi";
  }
  return "en";
}

function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  try {
    const fromStorage = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (fromStorage) {
      return normalizeLanguage(fromStorage);
    }
  } catch {
    // Gracefully handle restricted storage
  }

  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);

  const applyLanguageToDom = (lang: LanguageCode) => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  };

  const setLanguage = (newLang: LanguageCode | LanguageLabel | string) => {
    const normalized = normalizeLanguage(newLang);
    setLanguageState(normalized);
    applyLanguageToDom(normalized);

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
      window.dispatchEvent(
        new CustomEvent("legalai:language-changed", { detail: { language: normalized } }),
      );
    } catch {
      // Ignore storage write errors
    }
  };

  // Sync on mount and listen to cross-tab / window changes
  useEffect(() => {
    applyLanguageToDom(language);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === LANGUAGE_STORAGE_KEY && e.newValue) {
        const nextLang = normalizeLanguage(e.newValue);
        setLanguageState(nextLang);
        applyLanguageToDom(nextLang);
      }
    };

    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<{ language: LanguageCode }>;
      if (custom.detail?.language) {
        const nextLang = normalizeLanguage(custom.detail.language);
        setLanguageState(nextLang);
        applyLanguageToDom(nextLang);
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("legalai:language-changed", handleCustomChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("legalai:language-changed", handleCustomChange);
    };
  }, [language]);

  const languageLabel: LanguageLabel = language === "hi" ? "हिंदी (Hindi)" : "English (US)";
  const isHindi = language === "hi";
  const t = (key: TranslationKey, params?: Record<string, string | number>) =>
    translate(language, key, params);

  return (
    <LanguageContext.Provider
      value={{
        language,
        languageLabel,
        setLanguage,
        t,
        isHindi,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

const fallbackTranslate = (key: TranslationKey, params?: Record<string, string | number>) =>
  translate(DEFAULT_LANGUAGE, key, params);

const DEFAULT_LANGUAGE_CONTEXT: LanguageContextType = {
  language: DEFAULT_LANGUAGE,
  languageLabel: "English (US)",
  setLanguage: () => {},
  t: fallbackTranslate,
  isHindi: false,
  supportedLanguages: SUPPORTED_LANGUAGES,
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    return DEFAULT_LANGUAGE_CONTEXT;
  }
  return context;
}
