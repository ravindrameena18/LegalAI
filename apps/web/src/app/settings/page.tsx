"use client";

import { AppShell } from "@/components/app-shell";
import { useLanguage } from "@/lib/language-context";

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <AppShell>
      <div className="dashboard-page" style={{ padding: "32px" }}>
        <div className="dashboard-hero-card" style={{ maxWidth: "800px" }}>
          <span className="eyebrow">{t("settings.page_eyebrow")}</span>
          <h1 className="hero-title">{t("settings.page_title")}</h1>
          <p className="hero-subtitle">
            {t("settings.page_subtitle")}
          </p>
        </div>
      </div>
    </AppShell>
  );
}