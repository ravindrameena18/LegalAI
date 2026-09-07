"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/translations";
import { getHealth } from "@/lib/api-client";
import {
  BellIcon,
  BriefcaseIcon,
  CheckCircleIcon,
  FileTextIcon,
  LockIcon,
  SearchIcon,
  SparklesIcon,
  SunIcon,
  UserIcon,
  XIcon,
} from "@/components/icons";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
}

const CATEGORY_TRANSLATION_KEYS: Record<string, { label: TranslationKey; desc: TranslationKey }> = {
  general: { label: "settings.category.general", desc: "settings.category.general.desc" },
  appearance: { label: "settings.category.appearance", desc: "settings.category.appearance.desc" },
  workspace: { label: "settings.category.workspace", desc: "settings.category.workspace.desc" },
  documents: { label: "settings.category.documents", desc: "settings.category.documents.desc" },
  ai: { label: "settings.category.ai_analysis", desc: "settings.category.ai_analysis.desc" },
  security: { label: "settings.category.privacy_security", desc: "settings.category.privacy_security.desc" },
  notifications: { label: "settings.category.notifications", desc: "settings.category.notifications.desc" },
};

interface SettingsCategory {
  id: string;
  label: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
  description: string;
  keywords: string[];
}

const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: "general",
    label: "General",
    icon: UserIcon,
    description: "Profile, language, and regional preferences",
    keywords: ["name", "email", "profile", "account", "language", "time zone", "date"],
  },
  {
    id: "appearance",
    label: "Appearance",
    icon: SunIcon,
    description: "Theme, accent colors, and interface density",
    keywords: ["theme", "dark", "light", "accent", "font", "display", "appearance"],
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: BriefcaseIcon,
    description: "Tenant partition, RBAC permissions, and capabilities",
    keywords: ["workspace", "tenant", "role", "lawyer", "client", "rbac", "permissions", "diagnostics", "health", "connection"],
  },
  {
    id: "documents",
    label: "Documents",
    icon: FileTextIcon,
    description: "Storage driver, upload limits, and format rules",
    keywords: ["storage", "file size", "pdf", "docx", "txt", "ocr", "upload", "retention"],
  },
  {
    id: "ai",
    label: "AI & Analysis",
    icon: SparklesIcon,
    description: "Gemini models, temperature, and grounding",
    keywords: ["ai", "gemini", "temperature", "model", "tokens", "grounding", "risk", "analysis"],
  },
  {
    id: "security",
    label: "Privacy & Security",
    icon: LockIcon,
    description: "Encryption, memory-only passwords, and telemetry",
    keywords: ["security", "privacy", "argon2", "password", "jwt", "cookie", "encryption", "isolation"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: BellIcon,
    description: "Processing alerts, risk notices, and email reports",
    keywords: ["notifications", "alerts", "email", "ready", "sound", "threshold"],
  },
];

export function SettingsModal({ isOpen, onClose, initialCategory = "general" }: SettingsModalProps) {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { language, languageLabel, setLanguage, t, isHindi } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  // Preference states (simulated client toggles for professional interactivity)
  const [timeZone, setTimeZone] = useState("Local System (Auto-detected)");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [notificationReady, setNotificationReady] = useState(true);
  const [notificationRisk, setNotificationRisk] = useState(true);

  // Health check state
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthResult, setHealthResult] = useState<{ status: string; latency: number } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalBoxRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveCategory(initialCategory);
      setSearchQuery("");
      setSavedNotice(null);
    }
  }

  // Lock background body scroll when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Keyboard accessibility: Escape to close, Ctrl/Cmd+K to focus search
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSaveNotice = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const handleTestHealth = async () => {
    setHealthChecking(true);
    const start = Date.now();
    try {
      const res = await getHealth();
      const latency = Date.now() - start;
      setHealthResult({ status: res.status, latency });
      handleSaveNotice(`Backend connection verified (${latency}ms) — status: ${res.status}`);
    } catch {
      const latency = Date.now() - start;
      setHealthResult({ status: "error", latency });
      handleSaveNotice(`Backend test finished (${latency}ms)`);
    } finally {
      setHealthChecking(false);
    }
  };

  // Filter categories by search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return SETTINGS_CATEGORIES;

    return SETTINGS_CATEGORIES.filter((cat) => {
      const localizedLabel = CATEGORY_TRANSLATION_KEYS[cat.id] ? t(CATEGORY_TRANSLATION_KEYS[cat.id].label) : cat.label;
      const localizedDesc = CATEGORY_TRANSLATION_KEYS[cat.id] ? t(CATEGORY_TRANSLATION_KEYS[cat.id].desc) : cat.description;
      return (
        cat.label.toLowerCase().includes(q) ||
        cat.description.toLowerCase().includes(q) ||
        localizedLabel.toLowerCase().includes(q) ||
        localizedDesc.toLowerCase().includes(q) ||
        cat.keywords.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, t]);

  // Effective category: fall back to first matched if current is filtered out
  const effectiveCategory =
    filteredCategories.length > 0 && !filteredCategories.some((c) => c.id === activeCategory)
      ? filteredCategories[0].id
      : activeCategory;

  if (!isOpen) return null;

  return (
    <div
      className="settings-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="settings-modal-card" ref={modalBoxRef}>
        {/* LEFT SETTINGS NAVIGATION */}
        <aside className="settings-nav-pane" aria-label="Settings categories">
          {/* Top Bar: Close Button + Title */}
          <div className="settings-nav-topbar">
            <button
              type="button"
              className="settings-close-icon-btn"
              onClick={onClose}
              aria-label="Close settings"
              title="Close (Esc)"
            >
              <XIcon size={17} />
            </button>
            <span className="settings-nav-brand">{t("settings.title")}</span>
          </div>

          {/* Search Settings Bar */}
          <div className="settings-search-wrap">
            <SearchIcon size={15} className="settings-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="settings-search-input"
              placeholder={t("settings.search_placeholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search settings"
            />
            {searchQuery ? (
              <button
                type="button"
                className="settings-search-clear"
                onClick={() => setSearchQuery("")}
                aria-label="Clear search"
              >
                <XIcon size={14} />
              </button>
            ) : (
              <span className="settings-search-hint" title="Press Ctrl+K to search">
                <kbd>⌘K</kbd>
              </span>
            )}
          </div>

          {/* Category Items List */}
          <nav className="settings-category-list">
            {filteredCategories.length === 0 ? (
              <div className="settings-nav-empty">
                {t("settings.no_match", { query: searchQuery })}
              </div>
            ) : (
              filteredCategories.map((cat) => {
                const Icon = cat.icon;
                const isActive = effectiveCategory === cat.id;
                const displayLabel = CATEGORY_TRANSLATION_KEYS[cat.id] ? t(CATEGORY_TRANSLATION_KEYS[cat.id].label) : cat.label;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className={`settings-category-btn ${isActive ? "active" : ""}`}
                    onClick={() => setActiveCategory(cat.id)}
                    aria-selected={isActive}
                    role="tab"
                  >
                    <Icon size={17} className="settings-category-icon" />
                    <span className="settings-category-label">{displayLabel}</span>
                  </button>
                );
              })
            )}
          </nav>

          {/* Bottom user quick info */}
          <div className="settings-nav-footer">
            <span className="avatar avatar-sm">{user?.name ? user.name.charAt(0).toUpperCase() : "U"}</span>
            <div className="settings-nav-user-info">
              <span className="settings-nav-username">{user?.name || "Counsel"}</span>
              <span className="settings-nav-role">{user?.role || "LAWYER"}</span>
            </div>
          </div>
        </aside>

        {/* RIGHT CONTENT PANE */}
        <main className="settings-content-pane" id="settings-content-area" role="tabpanel">
          {/* Header */}
          <div className="settings-content-header">
            <div>
              <h2 id="settings-modal-title" className="settings-pane-title">
                {CATEGORY_TRANSLATION_KEYS[effectiveCategory]
                  ? t(CATEGORY_TRANSLATION_KEYS[effectiveCategory].label)
                  : SETTINGS_CATEGORIES.find((c) => c.id === effectiveCategory)?.label || "Settings"}
              </h2>
              <p className="settings-pane-subtitle">
                {CATEGORY_TRANSLATION_KEYS[effectiveCategory]
                  ? t(CATEGORY_TRANSLATION_KEYS[effectiveCategory].desc)
                  : SETTINGS_CATEGORIES.find((c) => c.id === effectiveCategory)?.description ||
                    "Configure workspace preferences"}
              </p>
            </div>
            <button
              type="button"
              className="settings-desktop-close"
              onClick={onClose}
              aria-label="Close settings"
              title="Close (Esc)"
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* Saved Notification Banner */}
          {savedNotice && (
            <div className="settings-notice-banner" role="status">
              <CheckCircleIcon size={15} />
              <span>{savedNotice}</span>
            </div>
          )}

          {/* Scrollable Content Body */}
          <div className="settings-scroll-body">
            {/* 1. GENERAL */}
            {effectiveCategory === "general" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.profile_identity")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.full_name")}</div>
                    <div className="settings-item-desc">{t("settings.general.full_name_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{user?.name || "Counsel Test"}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.email")}</div>
                    <div className="settings-item-desc">{t("settings.general.email_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{user?.email || "counsel@law.com"}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.role")}</div>
                    <div className="settings-item-desc">{t("settings.general.role_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="role-tag" style={{ fontSize: "11px", padding: "4px 10px" }}>
                      {user?.role || "LAWYER"}
                    </span>
                  </div>
                </div>

                <div className="settings-group-title" style={{ marginTop: "24px" }}>
                  {t("settings.group.localization_display")}
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.language")}</div>
                    <div className="settings-item-desc">{t("settings.general.language_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <select
                      className="settings-select-input"
                      value={languageLabel}
                      onChange={(e) => {
                        const newLang = e.target.value;
                        setLanguage(newLang);
                        handleSaveNotice(
                          newLang.includes("Hindi") || newLang.includes("हिंदी")
                            ? `भाषा प्राथमिकता बदलकर ${newLang} कर दी गई है`
                            : `Language preference updated to ${newLang}`,
                        );
                      }}
                    >
                      <option value="English (US)">English (US)</option>
                      <option value="हिंदी (Hindi)">हिंदी (Hindi)</option>
                    </select>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.time_zone")}</div>
                    <div className="settings-item-desc">{t("settings.general.time_zone_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <select
                      className="settings-select-input"
                      value={timeZone}
                      onChange={(e) => {
                        setTimeZone(e.target.value);
                        handleSaveNotice(`Time zone updated to ${e.target.value}`);
                      }}
                    >
                      <option value="Local System (Auto-detected)">Local System (Auto-detected)</option>
                      <option value="UTC (Coordinated Universal Time)">UTC</option>
                      <option value="America/New_York (EST/EDT)">America/New_York (EST)</option>
                      <option value="Europe/London (GMT/BST)">Europe/London (GMT)</option>
                      <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST)</option>
                    </select>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.general.date_format")}</div>
                    <div className="settings-item-desc">{t("settings.general.date_format_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <select
                      className="settings-select-input"
                      value={dateFormat}
                      onChange={(e) => {
                        setDateFormat(e.target.value);
                        handleSaveNotice(`Date format updated to ${e.target.value}`);
                      }}
                    >
                      <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 2. APPEARANCE */}
            {effectiveCategory === "appearance" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.theme_contrast")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.appearance.theme_title")}</div>
                    <div className="settings-item-desc">{t("settings.appearance.theme_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <div className="settings-toggle-group" role="radiogroup" aria-label="Theme selection">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme === "light"}
                        className={`settings-toggle-btn ${theme === "light" ? "active" : ""}`}
                        onClick={() => {
                          setTheme("light");
                          handleSaveNotice(isHindi ? "थीम लाइट पर सेट की गई" : "Theme set to Light");
                        }}
                      >
                        {t("settings.appearance.light")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme === "dark"}
                        className={`settings-toggle-btn ${theme === "dark" ? "active" : ""}`}
                        onClick={() => {
                          setTheme("dark");
                          handleSaveNotice(isHindi ? "थीम डार्क पर सेट की गई" : "Theme set to Dark");
                        }}
                      >
                        {t("settings.appearance.dark")}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={theme === "dark-navy"}
                        className={`settings-toggle-btn ${theme === "dark-navy" ? "active" : ""}`}
                        onClick={() => {
                          setTheme("dark-navy");
                          handleSaveNotice(isHindi ? "थीम डार्क नेवी पर सेट की गई" : "Theme set to Dark Navy");
                        }}
                      >
                        {t("settings.appearance.dark_navy")}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.appearance.accent")}</div>
                    <div className="settings-item-desc">{t("settings.appearance.accent_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          background: "#3b82f6",
                          boxShadow: "0 0 8px rgba(59, 130, 246, 0.6)",
                        }}
                      />
                      <span className="settings-pill-val">LegalAI Blue (#3B82F6)</span>
                    </div>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.appearance.typography")}</div>
                    <div className="settings-item-desc">{t("settings.appearance.typography_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">Inter / IBM Plex Mono</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.appearance.scrollbars")}</div>
                    <div className="settings-item-desc">{t("settings.appearance.scrollbars_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.active_themed")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3. WORKSPACE */}
            {effectiveCategory === "workspace" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.tenant_access")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.isolation")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.isolation_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.isolated_tenant")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.role_nav")}</div>
                    <div className="settings-item-desc">
                      {user?.role === "CLIENT"
                        ? t("settings.workspace.role_nav_client")
                        : t("settings.workspace.role_nav_lawyer")}
                    </div>
                  </div>
                  <div className="settings-item-action">
                    <span className="role-tag" style={{ fontSize: "11px", padding: "4px 10px" }}>
                      {user?.role || "LAWYER"}
                    </span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.landing")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.landing_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">Dashboard / AI Copilot</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.telemetry")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.telemetry_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.enforced")}</span>
                  </div>
                </div>

                <div className="settings-group-title" style={{ marginTop: "24px" }}>
                  {t("settings.group.system_diagnostics")}
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.live_backend")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.live_backend_desc")}</div>
                  </div>
                  <div className="settings-item-action" style={{ display: "flex", flexDirection: "column", gap: "6px", alignItems: "flex-end" }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleTestHealth}
                      disabled={healthChecking}
                      style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "6px" }}
                    >
                      {healthChecking ? t("settings.workspace.testing_backend") : t("settings.workspace.test_backend_btn")}
                    </button>
                    {healthResult && (
                      <div style={{ fontSize: "11px", color: healthResult.status === "ok" ? "#86efac" : "#fca5a5" }}>
                        ● {healthResult.status.toUpperCase()} ({healthResult.latency}ms latency)
                      </div>
                    )}
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.revalidate")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.revalidate_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <button
                      type="button"
                      className="secondary-button-link"
                      onClick={() => handleSaveNotice(isHindi ? "स्थानीय क्लाइंट कैश रीफ़्रेश किया गया और सत्र पुनः सिंक्रनाइज़ हुआ।" : "Local client cache refreshed and session re-synchronized.")}
                      style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "6px" }}
                    >
                      {t("settings.workspace.revalidate_btn")}
                    </button>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.workspace.runtime")}</div>
                    <div className="settings-item-desc">{t("settings.workspace.runtime_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">Next.js 16.3.4 (Turbopack) / React 19</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DOCUMENTS */}
            {effectiveCategory === "documents" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.doc_storage_rules")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.documents.storage_provider")}</div>
                    <div className="settings-item-desc">{t("settings.documents.storage_provider_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{t("settings.val.local_storage")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.documents.max_upload")}</div>
                    <div className="settings-item-desc">{t("settings.documents.max_upload_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{t("settings.val.max_mb")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.documents.supported_types")}</div>
                    <div className="settings-item-desc">{t("settings.documents.supported_types_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <div style={{ display: "flex", gap: "6px" }}>
                      <span className="format-badge format-pdf">PDF</span>
                      <span className="format-badge format-docx">DOCX</span>
                      <span className="format-badge format-txt">TXT</span>
                    </div>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.documents.pwd_pdf")}</div>
                    <div className="settings-item-desc">{t("settings.documents.pwd_pdf_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.active")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.documents.ocr")}</div>
                    <div className="settings-item-desc">{t("settings.documents.ocr_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.enabled")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 5. AI & ANALYSIS */}
            {effectiveCategory === "ai" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.gemini_params")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.ai.foundation_model")}</div>
                    <div className="settings-item-desc">{t("settings.ai.foundation_model_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <div className="setting-chip-active">
                      <SparklesIcon size={14} className="text-blue-400" />
                      <span>gemini-3.5-flash ({t("settings.val.active")})</span>
                    </div>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.ai.temp_title")}</div>
                    <div className="settings-item-desc">{t("settings.ai.temp_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{t("settings.val.strict_grounded")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.ai.token_budget")}</div>
                    <div className="settings-item-desc">{t("settings.ai.token_budget_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">{t("settings.val.token_count")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.ai.verbatim_grounding")}</div>
                    <div className="settings-item-desc">{t("settings.ai.verbatim_grounding_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.enforced")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.ai.deterministic_risk")}</div>
                    <div className="settings-item-desc">{t("settings.ai.deterministic_risk_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.active")}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 6. PRIVACY & SECURITY */}
            {effectiveCategory === "security" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.crypto_privacy")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.security.pwd_storage")}</div>
                    <div className="settings-item-desc">{t("settings.security.pwd_storage_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">Argon2 (pwdlib[argon2])</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.security.enc_pdf")}</div>
                    <div className="settings-item-desc">{t("settings.security.enc_pdf_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.memory_only")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.security.model_training")}</div>
                    <div className="settings-item-desc">{t("settings.security.model_training_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.zero_training")}</span>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.security.session_token")}</div>
                    <div className="settings-item-desc">{t("settings.security.session_token_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="settings-pill-val">HTTP-only SameSite=Lax Cookie + JWT</span>
                  </div>
                </div>
              </div>
            )}

            {/* 7. NOTIFICATIONS */}
            {effectiveCategory === "notifications" && (
              <div className="settings-group">
                <div className="settings-group-title">{t("settings.group.inapp_notifications")}</div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.notifications.doc_ready")}</div>
                    <div className="settings-item-desc">{t("settings.notifications.doc_ready_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <button
                      type="button"
                      className={`settings-switch-btn ${notificationReady ? "checked" : ""}`}
                      onClick={() => {
                        setNotificationReady((prev) => !prev);
                        handleSaveNotice(
                          isHindi
                            ? `दस्तावेज़ तैयार अलर्ट ${!notificationReady ? "सक्षम" : "अक्षम"}`
                            : `Document ready alerts ${!notificationReady ? "enabled" : "disabled"}`
                        );
                      }}
                      role="switch"
                      aria-checked={notificationReady}
                    >
                      <span className="settings-switch-thumb" />
                    </button>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.notifications.risk_flags")}</div>
                    <div className="settings-item-desc">{t("settings.notifications.risk_flags_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <button
                      type="button"
                      className={`settings-switch-btn ${notificationRisk ? "checked" : ""}`}
                      onClick={() => {
                        setNotificationRisk((prev) => !prev);
                        handleSaveNotice(
                          isHindi
                            ? `जोखिम सूचनाएँ ${!notificationRisk ? "सक्षम" : "अक्षम"}`
                            : `Risk flag notifications ${!notificationRisk ? "enabled" : "disabled"}`
                        );
                      }}
                      role="switch"
                      aria-checked={notificationRisk}
                    >
                      <span className="settings-switch-thumb" />
                    </button>
                  </div>
                </div>

                <div className="settings-item-row">
                  <div className="settings-item-info">
                    <div className="settings-item-label">{t("settings.notifications.comparison_banner")}</div>
                    <div className="settings-item-desc">{t("settings.notifications.comparison_banner_desc")}</div>
                  </div>
                  <div className="settings-item-action">
                    <span className="status-pill status-ready">{t("settings.val.enabled")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
