"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  BarChartIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CompareIcon,
  ExternalLinkIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  LockIcon,
  SearchIcon,
  ShieldAlertIcon,
  SparklesIcon,
  UploadCloudIcon,
  XIcon,
} from "@/components/icons";
import {
  getHelpArticles,
  getHelpFaqs,
  getHelpNavGroups,
  type FaqItem,
  type HelpArticle,
  type HelpCategoryItem,
} from "@/components/help-data";
import { useLanguage } from "@/lib/language-context";

interface TopicCard {
  categoryId: string;
  title: string;
  description: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
  theme: string;
  badge: string;
  countLabel: string;
}

const getTopicCards = (isHindi: boolean): TopicCard[] => [
  {
    categoryId: "getting-started",
    title: isHindi ? "प्लेटफ़ॉर्म ऑनबोर्डिंग" : "Platform Onboarding",
    description: isHindi
      ? "प्लेटफ़ॉर्म अवलोकन, समर्थित कानूनी दस्तावेज़ प्रारूप और अपलोड कार्यप्रवाह।"
      : "Platform overview, supported legal document formats, and upload workflows.",
    icon: HomeIcon,
    theme: "theme-blue",
    badge: isHindi ? "4 लेख" : "4 articles",
    countLabel: isHindi ? "गाइड" : "guides",
  },
  {
    categoryId: "ai-copilot",
    title: isHindi ? "AI कानूनी सहायक" : "AI Legal Assistant",
    description: isHindi
      ? "दस्तावेज़-आधारित प्रश्न, उद्धरण, संकेत और कानूनी अस्वीकरण।"
      : "Document-grounded queries, citations, prompts, and legal disclaimers.",
    icon: SparklesIcon,
    theme: "theme-purple",
    badge: isHindi ? "3 लेख" : "3 articles",
    countLabel: isHindi ? "सुविधाएं" : "features",
  },
  {
    categoryId: "analysis",
    title: isHindi ? "अनुबंध और जोखिम विश्लेषण" : "Contract & Risk Analysis",
    description: isHindi
      ? "24-श्रेणी अनुबंध विवरण, जोखिम स्तर पद्धति और अनुबंध शर्तें।"
      : "24-category contract breakdown, risk tier methodology, and covenants.",
    icon: FileTextIcon,
    theme: "theme-emerald",
    badge: isHindi ? "4 लेख" : "4 articles",
    countLabel: isHindi ? "श्रेणियां" : "categories",
  },
  {
    categoryId: "compare",
    title: isHindi ? "अनुबंध तुलना" : "Contract Comparison",
    description: isHindi
      ? "रेडलाइनिंग, साथ-साथ और एकीकृत तुलना, संस्करण प्रतिस्थापन, और जोखिम अंतर।"
      : "Redlining, side-by-side & unified diffs, version replacement, and risk delta.",
    icon: CompareIcon,
    theme: "theme-cyan",
    badge: isHindi ? "4 लेख" : "4 articles",
    countLabel: isHindi ? "उपकरण" : "tools",
  },
  {
    categoryId: "reports",
    title: isHindi ? "कार्यकारी रिपोर्ट" : "Executive Reports",
    description: isHindi
      ? "निश्चित जोखिम वर्गीकरण, कार्यकारी सारांश और PDF निर्यात।"
      : "Deterministic risk classification, executive briefs, and PDF exports.",
    icon: BarChartIcon,
    theme: "theme-amber",
    badge: isHindi ? "3 लेख" : "3 articles",
    countLabel: isHindi ? "रिपोर्ट" : "briefs",
  },
  {
    categoryId: "privacy",
    title: isHindi ? "सुरक्षा और गोपनीयता" : "Security & Privacy",
    description: isHindi
      ? "इन-मेमोरी PDF पासवर्ड प्रबंधन, टेनेंसी सीमाएं और शून्य-प्रशिक्षण नीतियां।"
      : "In-memory PDF password handling, tenancy boundaries, and zero-training policies.",
    icon: LockIcon,
    theme: "theme-rose",
    badge: isHindi ? "3 लेख" : "3 articles",
    countLabel: isHindi ? "नीतियां" : "policies",
  },
];

const getCategories = (isHindi: boolean): HelpCategoryItem[] => [
  { id: "getting-started", label: isHindi ? "शुरुआत करें" : "Getting Started", icon: HomeIcon, description: isHindi ? "अवलोकन, अपलोड कार्यप्रवाह और दस्तावेज़ स्थिति" : "Overview, upload workflows, and document statuses" },
  { id: "ai-copilot", label: isHindi ? "AI कोपायलट / चैट" : "AI Copilot / Chat", icon: SparklesIcon, description: isHindi ? "दस्तावेज़-आधारित चैट, संकेत और उद्धरण" : "Document-grounded chat, prompts, and citations" },
  { id: "analysis", label: isHindi ? "दस्तावेज़ विश्लेषण" : "Document Analysis", icon: FileTextIcon, description: isHindi ? "24-अनुभाग कानूनी विश्लेषण, जोखिम और शर्तें" : "24-section legal breakdown, risks, and covenants" },
  { id: "compare", label: isHindi ? "दस्तावेज़ों की तुलना करें" : "Compare Documents", icon: CompareIcon, description: isHindi ? "अनुबंध रेडलाइनिंग, अंतर मेट्रिक्स और जोखिम अंतर" : "Contract redlining, diff metrics, and risk delta" },
  { id: "reports", label: isHindi ? "रिपोर्ट और बुद्धिमत्ता" : "Reports & Intelligence", icon: BarChartIcon, description: isHindi ? "कार्यकारी विवरण, जोखिम स्कोरिंग और PDF निर्यात" : "Executive briefs, risk scoring, and PDF export" },
  { id: "documents", label: isHindi ? "दस्तावेज़ प्रबंधन" : "Document Management", icon: UploadCloudIcon, description: isHindi ? "भंडारण, प्रसंस्करण चरण और दस्तावेज़ हटाना" : "Storage, processing stages, and deletion" },
  { id: "workspaces", label: isHindi ? "वकील और मुवक्किल कार्यक्षेत्र" : "Lawyer & Client Workspaces", icon: CheckCircleIcon, description: isHindi ? "भूमिका नेविगेशन और उपलब्ध क्षमताएं" : "Role navigation and available capabilities" },
  { id: "privacy", label: isHindi ? "गोपनीयता और सुरक्षा" : "Privacy & Security", icon: LockIcon, description: isHindi ? "टेनेंसी, केवल-मेमोरी पासवर्ड और डेटा सुरक्षा" : "Tenancy, memory-only passwords, and data safety" },
  { id: "troubleshooting", label: isHindi ? "समस्या निवारण" : "Troubleshooting", icon: ShieldAlertIcon, description: isHindi ? "अपलोड, अनलॉक, विश्लेषण और API त्रुटियों का समाधान" : "Resolving upload, unlock, analysis, and API errors" },
  { id: "faq", label: isHindi ? "अक्सर पूछे जाने वाले प्रश्न" : "Frequently Asked Questions", icon: HelpCircleIcon, description: isHindi ? "सामान्य प्रश्न और त्वरित उत्तर" : "Common questions and fast answers" },
];

export default function HelpPage() {
  const { isHindi, t } = useLanguage();
  const topicCards = useMemo(() => getTopicCards(isHindi), [isHindi]);
  const categories = useMemo(() => getCategories(isHindi), [isHindi]);
  const [activeCategory, setActiveCategory] = useState<string>("getting-started");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqs, setExpandedFaqs] = useState<Record<string, boolean>>({});
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [isScrollbarRevealed, setIsScrollbarRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keyboard shortcut: Ctrl+K or Cmd+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Smooth right-side scrolling area hover tracking
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    // Reveal scrollbar if mouse is within 48px of the right edge of the scrolling area
    const isNearRightEdge = e.clientX >= rect.right - 48;
    if (isNearRightEdge) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setIsScrollbarRevealed(true);
    } else {
      if (isScrollbarRevealed && !hideTimerRef.current) {
        hideTimerRef.current = setTimeout(() => {
          setIsScrollbarRevealed(false);
          hideTimerRef.current = null;
        }, 150);
      }
    }
  };

  const handleMouseLeave = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setIsScrollbarRevealed(false);
  };

  const handleScroll = () => {
    setIsScrollbarRevealed(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsScrollbarRevealed(false);
      hideTimerRef.current = null;
    }, 1000);
  };

  const toggleFaq = (id: string) => {
    setExpandedFaqs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const faqItems = useMemo(() => getHelpFaqs(isHindi), [isHindi]);
  const articles = useMemo(() => getHelpArticles(isHindi), [isHindi]);

  // Filter articles and FAQs based on instant search
  const filteredArticles = useMemo(() => {
    if (!searchQuery.trim()) {
      return articles.filter((a) => a.category === activeCategory);
    }
    const q = searchQuery.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    return articles.filter((a) => {
      const matchExact =
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q));
      if (matchExact) return true;
      const targetText = `${a.title} ${a.summary} ${a.tags.join(" ")}`.toLowerCase();
      return terms.every((term) => targetText.includes(term));
    });
  }, [searchQuery, activeCategory, articles]);

  const filteredFaqs = useMemo(() => {
    if (!searchQuery.trim()) {
      return faqItems;
    }
    const q = searchQuery.toLowerCase().trim();
    const terms = q.split(/\s+/).filter(Boolean);
    return faqItems.filter((f) => {
      const matchExact =
        f.question.toLowerCase().includes(q) ||
        f.tags.some((t) => t.toLowerCase().includes(q));
      if (matchExact) return true;
      const targetText = `${f.question} ${f.tags.join(" ")}`.toLowerCase();
      return terms.every((term) => targetText.includes(term));
    });
  }, [searchQuery, faqItems]);

  const isSearchActive = !!searchQuery.trim();
  const hasResults = filteredArticles.length > 0 || (isSearchActive && filteredFaqs.length > 0) || activeCategory === "faq";

  return (
    <AppShell>
      <div
        ref={containerRef}
        className={`help-page-container ${isScrollbarRevealed ? "scrollbar-revealed" : ""}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onScroll={handleScroll}
      >
        <div className="help-inner-wrap">
          {/* Top Title Bar */}
          <div className="help-header-bar">
            <div className="help-header-badge">
              <SparklesIcon size={13} className="text-blue-400" />
              <span>{t("help_page.kb_badge")}</span>
            </div>
            <h1 className="help-title">{t("help.brand")}</h1>
          </div>

          {/* Large Hero Section */}
          <section className="help-hero-card" aria-labelledby="help-hero-title">
            <div className="help-hero-glow" aria-hidden="true" />
            <div className="help-hero-content">
              <span className="help-hero-pill">
                <HelpCircleIcon size={14} />
                <span>{t("help_page.hero_pill")}</span>
              </span>

              <h2 id="help-hero-title" className="help-hero-heading">
                {t("help_page.hero_heading")}
              </h2>

              <p className="help-hero-subheading">
                {t("help_page.hero_subheading")}
              </p>

              {/* Modern Search Bar */}
              <div className="help-search-box-wrapper">
                <div className="help-search-box">
                  <SearchIcon size={19} className="help-search-icon" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    className="help-search-input"
                    placeholder={t("help_page.search_placeholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label={t("help_page.search_aria")}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="help-search-clear-btn"
                      onClick={() => setSearchQuery("")}
                      aria-label={t("help_page.clear_search")}
                    >
                      <XIcon size={16} />
                    </button>
                  ) : (
                    <span className="help-search-shortcut" title={t("help_page.shortcut_title")}>
                      <kbd>⌘</kbd><kbd>K</kbd>
                    </span>
                  )}
                </div>

                {/* Quick Search Suggestions */}
                <div className="help-search-quick-tags" aria-label="Suggested search terms">
                  <span className="help-quick-tag-label">{t("help_page.popular_label")}</span>
                  {(isHindi
                    ? ["PDF अपलोड", "पासवर्ड सुरक्षित", "तुलना अंतर", "जोखिम स्कोरिंग", "AI अस्वीकरण", "समस्या निवारण"]
                    : ["PDF Upload", "Password Protected", "Compare Diffs", "Risk Scoring", "AI Disclaimer", "Troubleshooting"]
                  ).map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="help-quick-tag-btn"
                      onClick={() => {
                        setSearchQuery(term);
                        const docsEl = document.getElementById("help-documentation-section");
                        docsEl?.scrollIntoView?.({ behavior: "smooth" });
                      }}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Explore Topics Grid (Clean rounded cards with appropriate icons) */}
          <section className="help-topics-section" aria-labelledby="help-topics-heading">
            <div className="help-topics-header">
              <div>
                <h3 id="help-topics-heading" className="help-topics-title">
                  {t("help_page.explore_topics")}
                </h3>
                <p className="help-topics-subtitle">
                  {t("help_page.explore_topics_sub")}
                </p>
              </div>
            </div>

            <div className="help-topics-grid">
              {topicCards.map((card) => {
                const Icon = card.icon;
                const isSelected = !isSearchActive && activeCategory === card.categoryId;
                return (
                  <button
                    key={card.categoryId}
                    type="button"
                    className={`help-topic-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setActiveCategory(card.categoryId);
                      if (searchQuery) setSearchQuery("");
                      const docsEl = document.getElementById("help-documentation-section");
                      docsEl?.scrollIntoView?.({ behavior: "smooth" });
                    }}
                  >
                    <div className="help-topic-card-top">
                      <div className={`help-topic-icon-wrap ${card.theme}`}>
                        <Icon size={20} />
                      </div>
                      <span className="help-topic-count">{card.badge}</span>
                    </div>
                    <h4 className="help-topic-card-title">{card.title}</h4>
                    <p className="help-topic-card-desc">{card.description}</p>
                    <div className="help-topic-card-footer">
                      <span>{isHindi ? `${card.countLabel} देखें` : `View ${card.countLabel}`}</span>
                      <span className="help-topic-arrow">→</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Main Documentation Layout */}
          <div className="help-layout" id="help-documentation-section">
          {/* Left Category Navigation */}
          <nav className="help-sidebar" aria-label="Help categories">
            <div style={{ padding: "4px 8px 6px", fontSize: "11px", fontWeight: 600, color: "var(--dim)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("help_page.categories_heading")}
            </div>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = !isSearchActive && activeCategory === cat.id;
              const count = cat.id === "faq" ? faqItems.length : articles.filter((a) => a.category === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  className={`help-category-btn ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    if (searchQuery) setSearchQuery("");
                  }}
                >
                  <div className="help-category-left">
                    <Icon size={16} />
                    <span>{cat.label}</span>
                  </div>
                  <span className="help-category-count">{count}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Content Area */}
          <main className="help-content-area" id="help-main-content">
            {/* Search Results Notification */}
            {isSearchActive && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", paddingBottom: "12px" }}>
                <span style={{ fontSize: "14px", color: "var(--ink)" }}>
                  {isHindi ? (
                  <><strong>&quot;{searchQuery}&quot;</strong> के खोज परिणाम ({filteredArticles.length} गाइड, {filteredFaqs.length} अक्सर पूछे जाने वाले प्रश्न)</>
                ) : (
                  <>Search results for <strong>&quot;{searchQuery}&quot;</strong> ({filteredArticles.length} guides, {filteredFaqs.length} FAQs)</>
                )}
                </span>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{ background: "transparent", border: "none", color: "#60a5fa", fontSize: "13px", cursor: "pointer" }}
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Empty State when no search results */}
            {!hasResults && (
              <div style={{
                background: "var(--surface)",
                border: "1px dashed var(--line)",
                borderRadius: "14px",
                padding: "48px 24px",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(239, 68, 68, 0.1)", color: "#f87171", display: "grid", placeItems: "center" }}>
                  <SearchIcon size={24} />
                </div>
                <h3 style={{ margin: 0, fontSize: "17px", color: "var(--ink)" }}>{t("help_page.no_results_title")}</h3>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)", maxWidth: "420px", lineHeight: "1.5" }}>
                  {isHindi
                  ? `हम "${searchQuery}" से मेल खाने वाले कोई लेख या अक्सर पूछे जाने वाले प्रश्न नहीं ढूंढ सके। सामान्य कीवर्ड जैसे PDF, जोखिम, तुलना खोजें या बाईं ओर कोई श्रेणी चुनें।`
                  : `We couldn't find any articles or FAQs matching "${searchQuery}". Try searching for general keywords like PDF, risk, compare, or select a category on the left.`}
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  style={{
                    marginTop: "8px",
                    background: "rgba(59, 130, 246, 0.15)",
                    border: "1px solid rgba(59, 130, 246, 0.3)",
                    color: "#93c5fd",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  Clear Search
                </button>
              </div>
            )}

            {/* Articles List */}
            {filteredArticles.map((article) => (
              <article key={article.id} className="help-article-card">
                <div className="help-article-header">
                  <h2 className="help-article-title">{article.title}</h2>
                  <span style={{ fontSize: "12px", color: "var(--dim)" }}>{article.summary}</span>
                </div>
                <div>{article.content}</div>
              </article>
            ))}

            {/* FAQ Section (displayed when active category is faq or when searching) */}
            {(activeCategory === "faq" || (isSearchActive && filteredFaqs.length > 0)) && (
              <section className="help-article-card">
                <div className="help-article-header">
                  <h2 className="help-article-title">
                    <HelpCircleIcon size={20} style={{ color: "#60a5fa" }} />
                    {isHindi ? `अक्सर पूछे जाने वाले प्रश्न (${filteredFaqs.length})` : `Frequently Asked Questions (${filteredFaqs.length})`}
                  </h2>
                  <p className="help-article-desc">
                    {t("help_page.faq_desc")}
                  </p>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                  {filteredFaqs.map((faq) => {
                    const isExpanded = !!expandedFaqs[faq.id];
                    return (
                      <div key={faq.id} className="help-faq-item">
                        <button
                          type="button"
                          className="help-faq-btn"
                          onClick={() => toggleFaq(faq.id)}
                          aria-expanded={isExpanded}
                        >
                          <span>{faq.question}</span>
                          {isExpanded ? <ChevronUpIcon size={16} style={{ color: "#60a5fa" }} /> : <ChevronDownIcon size={16} style={{ color: "var(--muted)" }} />}
                        </button>
                        {isExpanded && <div className="help-faq-body">{faq.answer}</div>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Still Need Help? Contact Support Card */}
            <div className="help-support-card">
              <div className="help-support-left">
                <h3>{t("help_page.still_need_help")}</h3>
                <p>{t("help_page.still_need_help_sub")}</p>
              </div>
              <button
                type="button"
                className="btn-support-contact"
                onClick={() => setShowSupportModal(true)}
              >
                <span>{t("help_page.contact_support")}</span>
                <ExternalLinkIcon size={13} />
              </button>
            </div>
          </main>
        </div>
        </div>

        {/* Support Modal (Reuses existing app dialog patterns) */}
        {showSupportModal && (
          <div
            className="modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowSupportModal(false);
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="support-dialog-title"
          >
            <div className="password-modal-box" style={{ maxWidth: "480px" }}>
              <div className="password-modal-header">
                <div className="password-modal-icon-badge" style={{ background: "rgba(59, 130, 246, 0.12)", color: "#60a5fa", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
                  <HelpCircleIcon size={20} />
                </div>
                <div className="password-modal-titles">
                  <h2 id="support-dialog-title" className="password-modal-title">
                    {t("help_page.support_modal_title")}
                  </h2>
                  <p className="password-modal-subtitle">
                    {t("help_page.support_modal_sub")}
                  </p>
                </div>
                <button
                  type="button"
                  className="password-modal-close"
                  onClick={() => setShowSupportModal(false)}
                  aria-label="Close dialog"
                >
                  <XIcon size={16} />
                </button>
              </div>

              <div style={{ fontSize: "13.5px", color: "var(--muted)", lineHeight: "1.6", margin: "16px 0 20px" }}>
                <p style={{ margin: "0 0 10px" }}>
                  {t("help_page.support_modal_desc")}
                </p>
                <div style={{ background: "var(--card-bg-subtle)", border: "1px solid var(--line)", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", color: "var(--dim)", textTransform: "uppercase", marginBottom: "4px" }}>{t("help_page.support_status_label")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#34d399", fontWeight: 500, fontSize: "13px" }}>
                    <CheckCircleIcon size={14} />
                    <span>{t("help_page.support_status_msg")}</span>
                  </div>
                </div>
              </div>

              <div className="password-modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setShowSupportModal(false)}
                >
                  {t("help_page.close")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

