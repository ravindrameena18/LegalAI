import { en, type TranslationKey } from "./en";
import { hi } from "./hi";

export { en, hi };
export type { TranslationKey };

export type SupportedLanguage = "en" | "hi";

export const translations: Record<SupportedLanguage, Record<TranslationKey, string>> = {
  en,
  hi,
};

export function translate(
  lang: SupportedLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const dictionary = translations[lang] || translations.en;
  let text = dictionary[key] || translations.en[key] || key;

  if (params) {
    Object.entries(params).forEach(([paramKey, paramVal]) => {
      text = text.replaceAll(`{${paramKey}}`, String(paramVal));
    });
  }

  return text;
}

