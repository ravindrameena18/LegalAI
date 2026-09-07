import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  LanguageProvider,
  useLanguage,
} from "./language-context";

describe("LanguageContext & i18n System", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "en";
  });

  test("defaults to English (US) when no language preference is stored", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    expect(result.current.language).toBe(DEFAULT_LANGUAGE);
    expect(result.current.languageLabel).toBe("English (US)");
    expect(result.current.isHindi).toBe(false);
    expect(result.current.t("nav.dashboard")).toBe("Dashboard");
  });

  test("switching to Hindi updates state, localStorage, and document.documentElement.lang", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    act(() => {
      result.current.setLanguage("hi");
    });

    expect(result.current.language).toBe("hi");
    expect(result.current.languageLabel).toBe("हिंदी (Hindi)");
    expect(result.current.isHindi).toBe(true);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("hi");
    expect(document.documentElement.lang).toBe("hi");

    // Check Hindi dictionary translation
    expect(result.current.t("nav.dashboard")).toBe("डैशबोर्ड");
    expect(result.current.t("documents.title")).toBe("दस्तावेज़");
    expect(result.current.t("compare.title")).toBe("दस्तावेज़ तुलना");
    expect(result.current.t("chat.empty_heading")).toBe("मैं आपके कानूनी दस्तावेज़ में क्या सहायता कर सकता हूँ?");
  });

  test("accepts language label 'हिंदी (Hindi)' and normalizes to 'hi'", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    act(() => {
      result.current.setLanguage("हिंदी (Hindi)");
    });

    expect(result.current.language).toBe("hi");
    expect(result.current.languageLabel).toBe("हिंदी (Hindi)");
    expect(result.current.isHindi).toBe(true);
  });

  test("persists Hindi preference on initialization from localStorage", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "hi");

    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    expect(result.current.language).toBe("hi");
    expect(result.current.languageLabel).toBe("हिंदी (Hindi)");
    expect(result.current.isHindi).toBe(true);
  });

  test("switching back to English updates state and translations", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "hi");

    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    expect(result.current.language).toBe("hi");

    act(() => {
      result.current.setLanguage("English (US)");
    });

    expect(result.current.language).toBe("en");
    expect(result.current.languageLabel).toBe("English (US)");
    expect(result.current.isHindi).toBe(false);
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
    expect(document.documentElement.lang).toBe("en");
    expect(result.current.t("nav.dashboard")).toBe("Dashboard");
  });

  test("interpolates translation parameters", () => {
    const { result } = renderHook(() => useLanguage(), {
      wrapper: LanguageProvider,
    });

    expect(result.current.t("settings.general.save_notice", { lang: "English (US)" })).toBe(
      "Language preference updated to English (US)",
    );

    act(() => {
      result.current.setLanguage("hi");
    });

    expect(result.current.t("settings.general.save_notice", { lang: "हिंदी" })).toBe(
      "भाषा प्राथमिकता बदलकर हिंदी कर दी गई है",
    );
  });
});

