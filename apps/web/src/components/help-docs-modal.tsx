"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
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

export interface HelpDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
}

export function HelpDocsModal({
  isOpen,
  onClose,
  initialCategory = "getting-started",
}: HelpDocsModalProps) {
  const { isHindi, t } = useLanguage();
  const [activeCategory, setActiveCategory] = useState<string>(initialCategory);
  const [expandedFaqs, setExpandedFaqs] = useState<Record<string, boolean>>({});

  const modalBoxRef = useRef<HTMLDivElement>(null);

  const navGroups = useMemo(() => getHelpNavGroups(isHindi), [isHindi]);
  const helpArticles = useMemo(() => getHelpArticles(isHindi), [isHindi]);
  const helpFaqs = useMemo(() => getHelpFaqs(isHindi), [isHindi]);

  // Flatten categories list for lookups
  const allCategories = useMemo<HelpCategoryItem[]>(() => {
    return navGroups.flatMap((g) => g.items);
  }, [navGroups]);

  // Reset category when modal opens
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setActiveCategory(initialCategory);
      setExpandedFaqs({});
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

  // Keyboard accessibility: Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFaq = (id: string) => {
    setExpandedFaqs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const categoryArticles = useMemo<HelpArticle[]>(() => {
    return helpArticles.filter((a) => a.category === activeCategory);
  }, [helpArticles, activeCategory]);

  const categoryFaqs = useMemo<FaqItem[]>(() => {
    if (activeCategory === "faq") return helpFaqs;
    return helpFaqs.filter((f) => f.category === activeCategory);
  }, [helpFaqs, activeCategory]);

  const currentCategoryObj = allCategories.find((c) => c.id === activeCategory);

  if (!isOpen) return null;

  return (
    <div
      className="help-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
    >
      <div className="help-modal-card" ref={modalBoxRef}>
        {/* LEFT TWO-COLUMN NAVIGATION PANE */}
        <aside className="help-nav-pane" aria-label="Help categories">
          {/* Top Bar: Close Button (mobile) + Brand Title */}
          <div className="help-nav-topbar">
            <button
              type="button"
              className="help-close-icon-btn mobile-only"
              onClick={onClose}
              aria-label="Close help"
              title="Close (Esc)"
            >
              <XIcon size={17} />
            </button>
            <span className="help-nav-brand">{t("help.brand")}</span>
          </div>

          {/* Grouped Category Navigation List */}
          <nav className="help-category-list">
            {navGroups.map((group) => (
              <div key={group.label} className="help-nav-group">
                <div className="help-nav-group-label">{group.label}</div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeCategory === item.id;
                  const count =
                    item.id === "faq"
                      ? helpFaqs.length
                      : helpArticles.filter((a) => a.category === item.id).length;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`help-category-btn ${isActive ? "active" : ""}`}
                      onClick={() => setActiveCategory(item.id)}
                      aria-selected={isActive}
                      role="tab"
                    >
                      <Icon size={16} className="help-category-icon" />
                      <span className="help-category-label">{item.label}</span>
                      {count > 0 && (
                        <span className="help-category-count">{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Bottom helper footnote */}
          <div className="help-nav-footer">
            <span className="help-nav-footer-text">
              {t("help.footer_brand")}
            </span>
          </div>
        </aside>

        {/* RIGHT CONTENT PANE */}
        <main
          className="help-content-pane"
          id="help-content-area"
          role="tabpanel"
        >
          {/* Top Modal Header */}
          <div className="help-content-header">
            <div>
              <h2 id="help-modal-title" className="help-pane-title">
                {t("help.pane_title")}
              </h2>
              <p className="help-pane-subtitle">
                {t("help.pane_subtitle")}
              </p>
            </div>
            <button
              type="button"
              className="help-desktop-close"
              onClick={onClose}
              aria-label="Close help"
              title="Close (Esc)"
            >
              <XIcon size={18} />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="help-scroll-body">
            {/* Active Category Header Banner */}
            {currentCategoryObj && (
              <div className="help-category-header-banner">
                <h3 className="help-category-headline">
                  {currentCategoryObj.label}
                </h3>
                <p className="help-category-desc">
                  {currentCategoryObj.description}
                </p>
              </div>
            )}

            {/* Articles List */}
            {categoryArticles.length > 0 && (
              <div className="help-articles-stack">
                {categoryArticles.map((article) => (
                  <article key={article.id} className="help-article-card">
                    <div className="help-article-card-header">
                      <h4 className="help-article-card-title">{article.title}</h4>
                    </div>
                    <p className="help-article-card-summary">
                      {article.summary}
                    </p>
                    <div className="help-article-card-body">
                      {article.content}
                    </div>
                  </article>
                ))}
              </div>
            )}

            {/* FAQ Items Section */}
            {activeCategory === "faq" && (
              <div className="help-faq-section">
                <div className="help-faq-header">
                  <h4 className="help-faq-title">
                    {t("help.faq_title")}
                  </h4>
                  <span className="help-faq-subtitle">
                    {t("help.faq_quick_subtitle")}
                  </span>
                </div>

                <div className="help-faq-list">
                  {categoryFaqs.map((faq) => {
                    const isExpanded = !!expandedFaqs[faq.id];
                    return (
                      <div
                        key={faq.id}
                        className={`help-faq-card ${isExpanded ? "expanded" : ""}`}
                      >
                        <button
                          type="button"
                          className="help-faq-question-btn"
                          onClick={() => toggleFaq(faq.id)}
                          aria-expanded={isExpanded}
                        >
                          <span className="help-faq-question-text">
                            {faq.question}
                          </span>
                          <span className="help-faq-chevron">
                            {isExpanded ? (
                              <ChevronUpIcon size={16} />
                            ) : (
                              <ChevronDownIcon size={16} />
                            )}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="help-faq-answer-pane">
                            {faq.answer}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
