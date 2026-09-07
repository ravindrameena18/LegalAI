"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/language-context";
import {
  legalResearchService,
  type ActSectionItem,
  type CaseLawItem,
  type LegalSearchResponse,
  type RecentSearchItem,
  type SavedResearchItem,
} from "@/lib/legal-research-service";
import {
  BookOpenIcon,
  BookmarkCheckIcon,
  BookmarkIcon,
  ChevronRightIcon,
  FileSearchIcon,
  FileTextPlusIcon,
  FilterIcon,
  HistoryIcon,
  ScaleIcon,
  SearchIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TrashIcon,
  UploadCloudIcon,
  XIcon,
} from "@/components/icons";
import { JudgmentDetailModal } from "@/components/research/judgment-detail-modal";
import { PrecedentFinderModal } from "@/components/research/precedent-finder-modal";
import { CitationCheckerModal } from "@/components/research/citation-checker-modal";
import { ResearchBriefModal } from "@/components/research/research-brief-modal";
import { UploadJudgmentModal } from "@/components/research/upload-judgment-modal";

type MainTab = "cases" | "acts" | "precedents" | "saved";

export default function ResearchPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { t, isHindi } = useLanguage();

  // Role guard: LAWYER and ADMIN only. Client is redirected to dashboard
  useEffect(() => {
    if (!isAuthLoading && user && user.role?.toUpperCase() === "CLIENT") {
      router.push("/dashboard");
    }
  }, [user, isAuthLoading, router]);

  // Main search state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSource, setSelectedSource] = useState("all");
  const [courtFilter, setCourtFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"relevance" | "date_desc" | "date_asc" | "court">("relevance");
  const [activeTab, setActiveTab] = useState<MainTab>("cases");
  const [isSearching, setIsSearching] = useState(false);

  // Full research response
  const [searchResponse, setSearchResponse] = useState<LegalSearchResponse | null>(null);
  const [actResults, setActResults] = useState<ActSectionItem[]>([]);
  const [savedItems, setSavedItems] = useState<SavedResearchItem[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearchItem[]>([]);

  // Modal workflows
  const [selectedCaseForDetail, setSelectedCaseForDetail] = useState<CaseLawItem | null>(null);
  const [isPrecedentFinderOpen, setIsPrecedentFinderOpen] = useState(false);
  const [isCitationCheckerOpen, setIsCitationCheckerOpen] = useState(false);
  const [isBriefModalOpen, setIsBriefModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [briefInitialPrompt, setBriefInitialPrompt] = useState("");
  const [briefInitialSection, setBriefInitialSection] = useState("");

  // Mobile drawer for right sidebar
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);

  const userId = user?.id || "lawyer-default";

  // Load initial research and saved library
  useEffect(() => {
    legalResearchService.search("", { sortBy: "relevance" }).then((res) => {
      setSearchResponse(res);
    });
    legalResearchService.searchActs("").then(setActResults);

    if (userId) {
      setSavedItems(legalResearchService.getSavedResearch(userId));
      setRecentSearches(legalResearchService.getRecentSearches(userId));
    }
  }, [userId]);

  // Execute search
  const handlePerformSearch = async (
    query: string,
    overrideOptions?: {
      source?: string;
      court?: string;
      year?: string;
      sort?: "relevance" | "date_desc" | "date_asc" | "court";
    }
  ) => {
    setIsSearching(true);
    const source = overrideOptions?.source ?? selectedSource;
    const court = overrideOptions?.court ?? courtFilter;
    const year = overrideOptions?.year ?? yearFilter;
    const sort = overrideOptions?.sort ?? sortBy;

    try {
      const res = await legalResearchService.search(query, {
        source,
        courtFilter: court,
        yearFilter: year,
        sortBy: sort,
      });
      setSearchResponse(res);

      const acts = await legalResearchService.searchActs(query);
      setActResults(acts);

      if (query.trim() && userId) {
        legalResearchService.addRecentSearch(userId, query, source === "all" ? "All Sources" : source);
        setRecentSearches(legalResearchService.getRecentSearches(userId));
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handlePerformSearch(searchQuery);
  };

  const handleChipClick = (suggestionText: string) => {
    setSearchQuery(suggestionText);
    handlePerformSearch(suggestionText);
  };

  const handleActShortcutClick = (actName: string) => {
    setSearchQuery(actName);
    setActiveTab("acts");
    handlePerformSearch(actName);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    handlePerformSearch("");
  };

  // Saved Items handling
  const isCaseSaved = useMemo(() => {
    const set = new Set(savedItems.map((item) => item.reference));
    return (cit: string) => set.has(cit);
  }, [savedItems]);

  const handleToggleSaveCase = (caseItem: CaseLawItem) => {
    if (!userId) return;
    const existing = savedItems.find((s) => s.reference === caseItem.citation);
    if (existing) {
      legalResearchService.deleteSavedResearch(userId, existing.id);
      setSavedItems((prev) => prev.filter((s) => s.id !== existing.id));
    } else {
      const saved = legalResearchService.saveResearch(userId, {
        type: "case",
        title: caseItem.title,
        reference: caseItem.citation,
        summary: caseItem.ratioDecidendi || caseItem.summary,
        tags: [caseItem.court, `${caseItem.year}`],
        data: caseItem,
      });
      setSavedItems((prev) => [saved, ...prev]);
    }
  };

  const handleDeleteSavedItem = (id: string) => {
    if (!userId) return;
    legalResearchService.deleteSavedResearch(userId, id);
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearRecentSearches = () => {
    if (!userId) return;
    legalResearchService.clearRecentSearches(userId);
    setRecentSearches([]);
  };

  const handleDeleteRecentSearch = (id: string) => {
    if (!userId) return;
    legalResearchService.deleteRecentSearch(userId, id);
    setRecentSearches((prev) => prev.filter((s) => s.id !== id));
  };

  const handleGenerateBriefForCase = (caseItem: CaseLawItem) => {
    setBriefInitialPrompt(caseItem.issues?.[0] || caseItem.ratioDecidendi);
    setBriefInitialSection(caseItem.sectionsReferred.join(", "));
    setIsBriefModalOpen(true);
  };

  // Scroll to source card
  const handleScrollToSource = (sourceId: number) => {
    const el = document.getElementById(`official-source-${sourceId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-pulse");
      setTimeout(() => el.classList.remove("highlight-pulse"), 2500);
    }
  };

  const displayedCases = searchResponse?.cases || [];
  const _latestCases = searchResponse?.latestCases || [];
  const summary = searchResponse?.summary;
  const provision = searchResponse?.provision;
  const potentialProvisions = searchResponse?.provisions || [];
  const statuteMapping = searchResponse?.statuteMapping;
  const precedents = searchResponse?.precedents;
  const sources = searchResponse?.sources || [];
  const isUnconfigured = searchResponse?.isUnconfiguredQuery || false;

  const formattedMarkdown = summary?.formattedMarkdown;
  const processedMarkdown = useMemo(() => {
    if (!formattedMarkdown) return "";
    return formattedMarkdown.replace(
      /\[Source (\d+)\](?!\()/g,
      "[[Source $1]](#official-source-$1)"
    );
  }, [formattedMarkdown]);

  return (
    <AppShell>
      <div className="research-page-container">
        {/* TOP HEADER */}
        <header className="research-top-header">
          <div className="research-header-meta">
            <nav className="research-breadcrumbs" aria-label="Breadcrumbs">
              <span className="breadcrumb-segment">{isHindi ? "कार्यक्षेत्र" : "Workspace"}</span>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-segment current">{t("nav.research")}</span>
            </nav>
            <div className="research-status-badge">
              <span className="status-indicator-dot" />
              <span className="status-indicator-text">{t("research.status_grounded")}</span>
            </div>
          </div>

          <div className="research-title-area">
            <h1 className="research-main-title">{t("research.title")}</h1>
            <p className="research-subtitle">
              {t("research.subtitle")}
            </p>
          </div>
        </header>

        {/* MAIN WORKSPACE LAYOUT (2 Columns) */}
        <div className="research-layout-grid">
          {/* LEFT COLUMN: Main research canvas */}
          <main className="research-main-canvas">
            {/* 1. MAIN SEARCH AREA */}
            <section className="research-search-section" aria-label="Legal Search">
              <form onSubmit={handleSearchSubmit} className="research-search-box">
                <span className="search-icon-wrap" aria-hidden="true">
                  <SearchIcon size={20} />
                </span>
                <input
                  type="text"
                  className="research-search-input"
                  placeholder={t("research.search_placeholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search judgments, acts, sections"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="research-search-clear-btn"
                    onClick={handleClearSearch}
                    aria-label="Clear search"
                  >
                    <XIcon size={16} />
                  </button>
                )}
                <div className="search-source-select-wrap">
                  <select
                    className="research-source-select"
                    value={selectedSource}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedSource(val);
                      handlePerformSearch(searchQuery, { source: val });
                    }}
                    aria-label="Filter source"
                  >
                    <option value="all">{t("research.source.all")}</option>
                    <option value="supreme_court">{t("research.source.sc")}</option>
                    <option value="high_courts">{t("research.source.hc")}</option>
                    <option value="central_acts">{t("research.source.central")}</option>
                    <option value="state_acts">{t("research.source.state")}</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="research-search-submit-btn"
                  disabled={isSearching}
                >
                  {isSearching ? <span className="spinner-dots" /> : t("research.search_btn")}
                </button>
              </form>

              {/* FILTERS TOOLBAR */}
              <div className="research-filters-bar">
                <div className="filter-group">
                  <span className="filter-label">{isHindi ? "अदालत:" : "Court:"}</span>
                  <select
                    className="filter-select"
                    value={courtFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCourtFilter(val);
                      handlePerformSearch(searchQuery, { court: val });
                    }}
                    aria-label="Filter by Court"
                  >
                    <option value="all">{t("research.court.all")}</option>
                    <option value="supreme_court">{t("research.court.sc")}</option>
                    <option value="high_court">{t("research.court.hc")}</option>
                    <option value="district_courts">{t("research.court.dc")}</option>
                  </select>
                </div>

                <div className="filter-group">
                  <span className="filter-label">{isHindi ? "वर्ष:" : "Year:"}</span>
                  <select
                    className="filter-select"
                    value={yearFilter}
                    onChange={(e) => {
                      const val = e.target.value;
                      setYearFilter(val);
                      handlePerformSearch(searchQuery, { year: val });
                    }}
                    aria-label="Filter by Year"
                  >
                    <option value="all">{t("research.year.all")}</option>
                    <option value="1_year">{t("research.year.1")}</option>
                    <option value="3_years">{t("research.year.3")}</option>
                    <option value="5_years">{t("research.year.5")}</option>
                  </select>
                </div>

                <div className="filter-group">
                  <span className="filter-label">{isHindi ? "क्रमबद्ध:" : "Sort By:"}</span>
                  <select
                    className="filter-select"
                    value={sortBy}
                    onChange={(e) => {
                      const val = e.target.value as typeof sortBy;
                      setSortBy(val);
                      handlePerformSearch(searchQuery, { sort: val });
                    }}
                    aria-label="Sort by criterion"
                  >
                    <option value="relevance">{t("research.sort.relevance")}</option>
                    <option value="date_desc">{t("research.sort.newest")}</option>
                    <option value="date_asc">{t("research.sort.oldest")}</option>
                    <option value="court">{t("research.sort.court")}</option>
                  </select>
                </div>
              </div>

              {/* Suggested Searches Chips (English & Hinglish) */}
              <div className="research-suggestions-row">
                <span className="suggestions-label">{t("research.suggested_label")}</span>
                <div className="suggestions-chips-wrap">
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("IPC Section 300")}
                  >
                    IPC Section 300
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("IPC Section 34")}
                  >
                    IPC Section 34
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("BNS murder")}
                  >
                    BNS murder
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("Section 138 NI Act latest judgments")}
                  >
                    Section 138 NI Act latest judgments
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("arbitration latest Supreme Court judgments")}
                  >
                    Arbitration Supreme Court
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("anticipatory bail latest cases")}
                  >
                    Anticipatory bail latest cases
                  </button>
                  <button
                    type="button"
                    className="suggestion-chip"
                    onClick={() => handleChipClick("contract breach Supreme Court")}
                  >
                    Contract breach Supreme Court
                  </button>
                </div>
              </div>
            </section>

            {/* UNCONFIGURED / ZERO-HALLUCINATION NOTICE */}
            {isUnconfigured && (
              <div className="research-unconfigured-banner" role="alert">
                <div className="banner-icon">
                  <ShieldAlertIcon size={22} />
                </div>
                <div className="banner-content">
                  <h4>Verified Legal Source Not Found</h4>
                  <p>
                    {searchResponse?.warningMessage ||
                      "In compliance with strict legal ethics and user safety standards, LegalAI never fabricates case names, citations, sections, or court holdings. No matching record was found in the indexed official database. Please refine your search query."}
                  </p>
                </div>
              </div>
            )}

            {/* 2. AI LEGAL RESEARCH SUMMARY (PANEL 9) */}
            {summary && (
              <section className="ai-research-summary-card" aria-label="AI Legal Research Summary">
                <div className="summary-header-row">
                  <div className="summary-title-wrap">
                    <span className="summary-sparkle-icon">
                      <SparklesIcon size={18} />
                    </span>
                    <h2 className="summary-card-title">AI Legal Research Summary</h2>
                  </div>
                  <span className="summary-grounded-badge">
                    <ShieldCheckIcon size={14} /> Grounded in Verified Sources
                  </span>
                </div>

                {/* Point-wise Structured Markdown Answer */}
                {summary.formattedMarkdown ? (
                  <div className="summary-markdown-wrapper">
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h3: ({ children }) => <h3 className="summary-md-h3">{children}</h3>,
                        h4: ({ children }) => <h4 className="summary-md-h4">{children}</h4>,
                        p: ({ children }) => <p className="summary-md-p">{children}</p>,
                        ul: ({ children }) => <ul className="summary-md-ul">{children}</ul>,
                        ol: ({ children }) => <ol className="summary-md-ol">{children}</ol>,
                        li: ({ children }) => <li className="summary-md-li">{children}</li>,
                        blockquote: ({ children }) => (
                          <blockquote className="summary-md-blockquote">{children}</blockquote>
                        ),
                        a: ({ href, children }) => {
                          if (href && (href.startsWith("#official-source-") || href.startsWith("#source-"))) {
                            const match = href.match(/#official-source-(\d+)|#source-(\d+)/);
                            const sourceNum = match ? parseInt(match[1] || match[2], 10) : 1;
                            return (
                              <button
                                type="button"
                                className="inline-citation-chip"
                                onClick={() => handleScrollToSource(sourceNum)}
                                title={`Jump to Source ${sourceNum}`}
                              >
                                {children}
                              </button>
                            );
                          }
                          return (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="summary-md-link"
                            >
                              {children}
                            </a>
                          );
                        },
                        strong: ({ children }) => <strong className="summary-md-strong">{children}</strong>,
                        code: ({ children }) => <code className="summary-md-code">{children}</code>,
                      }}
                    >
                      {processedMarkdown}
                    </Markdown>
                  </div>
                ) : (
                  <>
                    {/* Direct Answer with inline source chips */}
                    <div className="summary-direct-answer-box">
                      <p className="summary-answer-text">
                        {summary.directAnswer.split(/(\[Source \d+\])/g).map((chunk, idx) => {
                          const match = chunk.match(/\[Source (\d+)\]/);
                          if (match) {
                            const sId = parseInt(match[1], 10);
                            return (
                              <button
                                key={idx}
                                type="button"
                                className="inline-citation-chip"
                                onClick={() => handleScrollToSource(sId)}
                                title={`Jump to Source ${sId}`}
                              >
                                {chunk}
                              </button>
                            );
                          }
                          return <span key={idx}>{chunk}</span>;
                        })}
                      </p>
                    </div>

                    {/* Structured Summary Elements */}
                    <div className="summary-structured-grid">
                      {summary.applicableLaw.length > 0 && (
                        <div className="summary-grid-col">
                          <h4 className="summary-section-label">Applicable Law</h4>
                          <div className="applicable-tags-wrap">
                            {summary.applicableLaw.map((law, idx) => (
                              <span key={idx} className="applicable-law-pill">{law}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {summary.keyPrinciples.length > 0 && (
                        <div className="summary-grid-col">
                          <h4 className="summary-section-label">Key Legal Principles</h4>
                          <ul className="summary-bullet-list">
                            {summary.keyPrinciples.slice(0, 4).map((kp, idx) => (
                              <li key={idx}>{kp}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {summary.latestDevelopments && (
                      <div className="summary-callout-box latest-dev">
                        <strong>Latest Developments:</strong> {summary.latestDevelopments}
                      </div>
                    )}

                    {summary.practicalInterpretation && (
                      <div className="summary-callout-box practical-tip">
                        <strong>Practical Practice Note:</strong> {summary.practicalInterpretation}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}

            {/* POTENTIALLY RELEVANT PROVISIONS (FOR CONDUCT/DISPUTE QUERIES) */}
            {potentialProvisions.length > 0 && (
              <section className="potentially-relevant-provisions-card" aria-label="Potentially Relevant Provisions">
                <div className="provisions-header-row">
                  <div className="provisions-title-group">
                    <span className="provisions-icon-badge">
                      <ScaleIcon size={18} />
                    </span>
                    <div>
                      <h3 className="provisions-card-title">Potentially Relevant Legal Provisions</h3>
                      <p className="provisions-disclaimer">
                        ⚖️ Based on the facts and conduct described, multiple statutory provisions may apply. Additional facts are required to determine applicability, and final applicability depends on judicial interpretation.
                      </p>
                    </div>
                  </div>
                  <span className="provisions-count-pill">{potentialProvisions.length} Provisions Identified</span>
                </div>

                <div className="provisions-grid">
                  {potentialProvisions.map((item, pIdx) => (
                    <div key={pIdx} className="provision-item-card">
                      <div className="provision-card-top">
                        <div className="provision-badges">
                          <span className="provision-act-badge">{item.act}</span>
                          <span className="provision-sec-badge">{item.section}</span>
                        </div>
                        {item.sourceUrl && (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="provision-source-link"
                            title="Open Official Gazette / Statute"
                          >
                            Official Gazette ↗
                          </a>
                        )}
                      </div>

                      <h4 className="provision-item-title">{item.title}</h4>
                      <p className="provision-why-relevant">
                        <strong>Why it may apply:</strong> {item.whyRelevant}
                      </p>
                      {item.statutoryEffect && (
                        <div className="provision-effect-box">
                          <span className="effect-label">Statutory Effect / Consequence:</span> {item.statutoryEffect}
                        </div>
                      )}
                      <div className="provision-card-actions">
                        <button
                          type="button"
                          className="btn-text-action"
                          onClick={() => handleChipClick(`${item.act} ${item.section}`)}
                        >
                          Search this provision →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. RELEVANT LAW & OLD ↔ CURRENT LAW TRANSITION MAPPING (PANEL 3) */}
            {provision && (
              <section className="statute-transition-section" aria-label="Relevant Law & Statutory Transition">
                <div className="statute-transition-card">
                  <div className="statute-card-top-row">
                    <div className="statute-title-group">
                      <span className="statute-badge-act">{provision.actCode}</span>
                      <span className="statute-badge-sec">{provision.sectionNumber}</span>
                      <span className="statute-badge-status">{provision.status}</span>
                    </div>
                    {statuteMapping && (
                      <span className="transition-authority-tag">
                        Authoritative: {statuteMapping.statutoryAuthority}
                      </span>
                    )}
                  </div>

                  <h3 className="statute-main-title">{provision.sectionTitle}</h3>
                  <p className="statute-full-act">{provision.actTitle} ({provision.enactmentYear})</p>
                  <p className="statute-meaning-text">{provision.whatItMeans}</p>

                  {/* SIDE-BY-SIDE TRANSITION COMPARISON */}
                  {statuteMapping && (
                    <div className="transition-comparison-box">
                      <div className="transition-cols-row">
                        {/* Old Law Column */}
                        <div className="transition-col old-law">
                          <span className="col-tag old">OLD LAW (REPLACED)</span>
                          <h4 className="col-provision-name">{statuteMapping.oldAct}</h4>
                          <div className="col-sec-number">{statuteMapping.oldSection}: {statuteMapping.oldTitle}</div>
                          <span className="status-note repealed">Repealed w.e.f. July 1, 2024</span>
                        </div>

                        <div className="transition-arrow-divider">
                          <ChevronRightIcon size={20} />
                        </div>

                        {/* Current Law Column */}
                        <div className="transition-col current-law">
                          <span className="col-tag current">CURRENT LAW (IN FORCE)</span>
                          <h4 className="col-provision-name">{statuteMapping.currentAct}</h4>
                          <div className="col-sec-number">{statuteMapping.currentSection}: {statuteMapping.currentTitle}</div>
                          <span className="status-note in-force">Effective from {statuteMapping.effectiveDate}</span>
                        </div>
                      </div>

                      {/* How the law changed narrative */}
                      <div className="how-law-changed-narrative">
                        <h5>How the Law Changed:</h5>
                        <p>{statuteMapping.howLawChanged}</p>
                      </div>

                      {/* Key Differences */}
                      {statuteMapping.keyDifferences.length > 0 && (
                        <div className="key-differences-block">
                          <h5>Key Differences & Additions:</h5>
                          <ul>
                            {statuteMapping.keyDifferences.map((diff, idx) => (
                              <li key={idx}>{diff}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ingredients */}
                  {provision.ingredients.length > 0 && (
                    <div className="statute-ingredients-block">
                      <h5>Important Statutory Ingredients:</h5>
                      <ul>
                        {provision.ingredients.map((ing, idx) => (
                          <li key={idx}>{ing}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Punishment / Remedy */}
                  {provision.punishmentOrRemedy && (
                    <div className="statute-punishment-callout">
                      <strong>Punishment / Statutory Remedy:</strong> {provision.punishmentOrRemedy}
                    </div>
                  )}

                  {/* Related provisions */}
                  {provision.relatedProvisions.length > 0 && (
                    <div className="related-provisions-row">
                      <span className="related-label">Related Provisions:</span>
                      {provision.relatedProvisions.map((rp, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="related-sec-pill"
                          onClick={() => handleChipClick(rp)}
                        >
                          {rp}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 4. TABS & RESULT LISTS */}
            <section className="research-results-section" aria-label="Search Results">
              <div className="results-header-bar">
                <div className="results-tabs-wrap" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "cases"}
                    className={`results-tab-btn ${activeTab === "cases" ? "active" : ""}`}
                    onClick={() => setActiveTab("cases")}
                  >
                    <ScaleIcon size={16} />
                    <span>{t("research.tab.cases")}</span>
                    <span className="results-count-pill">{displayedCases.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "acts"}
                    className={`results-tab-btn ${activeTab === "acts" ? "active" : ""}`}
                    onClick={() => setActiveTab("acts")}
                  >
                    <BookOpenIcon size={16} />
                    <span>{t("research.tab.acts")}</span>
                    <span className="results-count-pill">{actResults.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "precedents"}
                    className={`results-tab-btn ${activeTab === "precedents" ? "active" : ""}`}
                    onClick={() => setActiveTab("precedents")}
                  >
                    <FileSearchIcon size={16} />
                    <span>{t("research.tab.precedents")}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "saved"}
                    className={`results-tab-btn ${activeTab === "saved" ? "active" : ""}`}
                    onClick={() => setActiveTab("saved")}
                  >
                    <BookmarkIcon size={16} />
                    <span>{t("research.tab.library")}</span>
                    <span className="results-count-pill">{savedItems.length}</span>
                  </button>
                </div>

                <div className="results-toolbar">
                  <button
                    type="button"
                    className="mobile-tools-toggle-btn"
                    onClick={() => setIsRightDrawerOpen((prev) => !prev)}
                    aria-label="Toggle Research Tools Panel"
                  >
                    <FilterIcon size={16} />
                    <span>{isHindi ? "उपकरण और कानून" : "Tools & Acts"}</span>
                  </button>
                </div>
              </div>

              {/* TAB 1: CASES / JUDGMENTS */}
              {activeTab === "cases" && (
                <div className="results-list-wrap">
                  {isSearching ? (
                    <div className="research-loading-state">
                      <div className="skeleton-card" />
                      <div className="skeleton-card" />
                      <div className="skeleton-card" />
                      <p className="loading-state-note">Searching verified official sources…</p>
                    </div>
                  ) : displayedCases.length === 0 ? (
                    <div className="research-empty-state">
                      <ScaleIcon size={36} />
                      <h3>No verified legal cases found.</h3>
                      <p>Try searching broader terms or select a different court or act category.</p>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={handleClearSearch}
                      >
                        Reset Search Filters
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* LATEST RELEVANT CASES SUB-HEADER */}
                      <div className="cases-list-headline-row">
                        <h3 className="cases-list-headline">
                          {searchResponse?.query ? `Judgments for "${searchResponse.query}"` : "Verified Landmark & Latest Judgments"}
                        </h3>
                        <span className="cases-count-text">
                          Showing {displayedCases.length} verified judgments
                        </span>
                      </div>

                      {displayedCases.map((item) => (
                        <article key={item.id} className="case-result-card">
                          <div className="card-header-row">
                            <div className="card-badge-group">
                              <span className="court-badge">{item.court}</span>
                              <span className="citation-badge">{item.citation}</span>
                              <span className="year-badge">{item.year}</span>
                            </div>
                            {item.relevanceScore && (
                              <div className="relevance-indicator" title="Source Grounding Relevance Index">
                                <SparklesIcon size={12} />
                                <span>{item.relevanceScore}% Match</span>
                              </div>
                            )}
                          </div>

                          <h3
                            className="case-card-title"
                            onClick={() => setSelectedCaseForDetail(item)}
                          >
                            {item.title}
                          </h3>

                          <div className="case-card-meta-row">
                            {item.caseNumber && <span>Case: {item.caseNumber}</span>}
                            <span>•</span>
                            <span>Decided: {item.judgmentDate}</span>
                            <span>•</span>
                            <span>Bench: {item.bench}</span>
                          </div>

                          {item.whyRelevant && (
                            <div className="case-why-relevant-callout">
                              <strong>Why Relevant:</strong> {item.whyRelevant}
                            </div>
                          )}

                          <p className="case-card-summary">{item.summary}</p>

                          <div className="case-card-ratio-callout">
                            <strong>Ratio Decidendi:</strong> {item.ratioDecidendi}
                          </div>

                          {item.relevantSection && (
                            <div className="case-card-sections-row">
                              <span className="sections-label">Relevant Provision:</span>
                              <span className="section-tag-pill">{item.relevantSection}</span>
                            </div>
                          )}

                          <div className="case-card-footer">
                            <div className="card-source-tag">
                              Source: {item.source}
                            </div>
                            <div className="card-actions-group">
                              <button
                                type="button"
                                className={`card-save-btn ${isCaseSaved(item.citation) ? "saved" : ""}`}
                                onClick={() => handleToggleSaveCase(item)}
                                aria-label={isCaseSaved(item.citation) ? "Remove from saved" : "Save case"}
                              >
                                {isCaseSaved(item.citation) ? (
                                  <>
                                    <BookmarkCheckIcon size={15} /> Saved
                                  </>
                                ) : (
                                  <>
                                    <BookmarkIcon size={15} /> Save
                                  </>
                                )}
                              </button>
                              {item.sourceUrl && (
                                <a
                                  href={item.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="card-open-source-btn"
                                  title="Open in Official Court Registry"
                                >
                                  Open Source ↗
                                </a>
                              )}
                              <button
                                type="button"
                                className="card-view-btn"
                                onClick={() => setSelectedCaseForDetail(item)}
                              >
                                View Judgment <ChevronRightIcon size={14} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </>
                  )}
                </div>
              )}

              {/* TAB 2: ACTS & SECTIONS */}
              {activeTab === "acts" && (
                <div className="results-list-wrap">
                  {actResults.length === 0 ? (
                    <div className="research-empty-state">
                      <BookOpenIcon size={36} />
                      <h3>No matching acts or sections found.</h3>
                      <p>Try searching by act name (e.g. BNS, NI Act, Arbitration) or section number.</p>
                    </div>
                  ) : (
                    actResults.map((act) => (
                      <article key={act.id} className="act-result-card">
                        <div className="act-header-row">
                          <div className="act-badges">
                            <span className="act-short-code">{act.actShortCode}</span>
                            <span className="act-jurisdiction-badge">{act.jurisdiction} Act</span>
                            <span className="act-year-badge">{act.enactmentYear}</span>
                          </div>
                          <span className="act-section-number">{act.sectionNumber}</span>
                        </div>

                        <h3 className="act-section-title">{act.sectionTitle}</h3>
                        <p className="act-full-name">{act.actTitle}</p>
                        <p className="act-description-text">{act.description}</p>

                        <div className="act-key-points">
                          <strong>Key Statutory Points:</strong>
                          <ul>
                            {act.keyPoints.map((pt, idx) => (
                              <li key={idx}>{pt}</li>
                            ))}
                          </ul>
                        </div>

                        {act.punishmentOrRemedy && (
                          <div className="act-remedy-box">
                            <strong>Statutory Effect / Penalty:</strong> {act.punishmentOrRemedy}
                          </div>
                        )}

                        <div className="act-card-footer">
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => {
                              setSearchQuery(act.sectionNumber);
                              setActiveTab("cases");
                              handlePerformSearch(act.sectionNumber);
                            }}
                          >
                            <SearchIcon size={13} /> Find Cases on {act.sectionNumber}
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: PRECEDENTS */}
              {activeTab === "precedents" && (
                <div className="results-list-wrap">
                  <div className="precedent-tab-banner">
                    <div>
                      <h3 className="precedent-tab-title">Precedent Classification</h3>
                      <p className="precedent-tab-desc">
                        Comparing supporting versus contrary and distinguishing authorities for judicial evaluation.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => setIsPrecedentFinderOpen(true)}
                    >
                      <FileSearchIcon size={15} /> Open Custom Precedent Finder
                    </button>
                  </div>

                  <div className="precedents-dual-columns">
                    {/* Supporting Precedents Column */}
                    <div className="precedent-col supporting">
                      <h4 className="precedent-col-header supporting">
                        Supporting Precedents ({precedents?.supportingPrecedents.length || 0})
                      </h4>
                      {(!precedents || precedents.supportingPrecedents.length === 0) ? (
                        <p className="precedent-empty">No supporting precedents found for current filter.</p>
                      ) : (
                        precedents.supportingPrecedents.map((item) => (
                          <div key={item.id} className="precedent-mini-card supporting">
                            <div className="precedent-mini-top">
                              <span className="court-pill">{item.court}</span>
                              <span className="cit-pill">{item.citation}</span>
                            </div>
                            <h5
                              className="precedent-mini-title"
                              onClick={() => setSelectedCaseForDetail(item)}
                            >
                              {item.title}
                            </h5>
                            <p className="precedent-mini-ratio">{item.ratioDecidendi}</p>
                            <div className="precedent-mini-footer">
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => setSelectedCaseForDetail(item)}
                              >
                                View Details →
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Contrary / Distinguishing Precedents Column */}
                    <div className="precedent-col contrary">
                      <h4 className="precedent-col-header contrary">
                        Contrary / Distinguishing Precedents ({precedents?.contraryPrecedents.length || 0})
                      </h4>
                      {(!precedents || precedents.contraryPrecedents.length === 0) ? (
                        <p className="precedent-empty">No contrary or distinguishing precedents identified.</p>
                      ) : (
                        precedents.contraryPrecedents.map((item) => (
                          <div key={item.id} className="precedent-mini-card contrary">
                            <div className="precedent-mini-top">
                              <span className="court-pill">{item.court}</span>
                              <span className="cit-pill">{item.citation}</span>
                            </div>
                            <h5
                              className="precedent-mini-title"
                              onClick={() => setSelectedCaseForDetail(item)}
                            >
                              {item.title}
                            </h5>
                            <p className="precedent-mini-ratio">{item.ratioDecidendi}</p>
                            <div className="precedent-mini-footer">
                              <button
                                type="button"
                                className="link-btn"
                                onClick={() => setSelectedCaseForDetail(item)}
                              >
                                View Details →
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SAVED ITEMS (MY RESEARCH LIBRARY) */}
              {activeTab === "saved" && (
                <div className="results-list-wrap">
                  {savedItems.length === 0 ? (
                    <div className="research-empty-state">
                      <BookmarkIcon size={36} />
                      <h3>No legal research saved yet.</h3>
                      <p>Click &ldquo;Save&rdquo; on any case law, citation, or research brief to build your library.</p>
                    </div>
                  ) : (
                    <div className="saved-library-grid">
                      {savedItems.map((item) => (
                        <div key={item.id} className="saved-item-card">
                          <div className="saved-card-top">
                            <span className={`saved-type-tag ${item.type}`}>
                              {item.type.toUpperCase()}
                            </span>
                            <span className="saved-date-tag">Saved {item.savedAt}</span>
                          </div>
                          <h4 className="saved-item-title">{item.title}</h4>
                          <div className="saved-item-ref">{item.reference}</div>
                          <p className="saved-item-summary">{item.summary}</p>

                          <div className="saved-card-actions">
                            {item.type === "case" && (
                              <button
                                type="button"
                                className="btn-secondary btn-sm"
                                onClick={() => setSelectedCaseForDetail(item.data as CaseLawItem)}
                              >
                                View Case
                              </button>
                            )}
                            <button
                              type="button"
                              className="saved-delete-btn"
                              onClick={() => handleDeleteSavedItem(item.id)}
                              title="Remove from saved library"
                              aria-label="Remove"
                            >
                              <TrashIcon size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 5. OFFICIAL RESEARCH SOURCES (PANEL 6 & 7) */}
            <section className="official-sources-section" aria-label="Official Legal Sources">
              <div className="official-sources-header">
                <h3 className="sources-section-title">Verified Legal Authorities & Registries</h3>
                <p className="sources-section-subtitle">
                  In strict compliance with zero-hallucination legal standards, all data is retrieved from and verified against official government and court registries.
                </p>
              </div>

              <div className="official-sources-grid">
                {sources.map((src, idx) => (
                  <div key={src.id} id={`official-source-${idx + 1}`} className="official-source-card">
                    <div className="source-card-header">
                      <span className="source-number-pill">Source {idx + 1}</span>
                      <span className={`source-status-badge ${src.status.toLowerCase()}`}>
                        {src.status === "CONNECTED" ? "● Connected" : "Official Portal"}
                      </span>
                    </div>
                    <h4 className="source-card-name">{src.name}</h4>
                    <div className="source-card-type">{src.sourceType}</div>
                    <p className="source-card-desc">{src.description}</p>
                    <div className="source-card-footer">
                      <span className="source-retrieved-at">Retrieved: {src.retrievedAt}</span>
                      <a
                        href={src.officialUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-open-link"
                      >
                        Open Source ↗
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </main>

          {/* RIGHT COLUMN: RESEARCH UTILITIES, POPULAR ACTS & RECENT SEARCHES */}
          <aside className={`research-sidebar-panel ${isRightDrawerOpen ? "open" : ""}`}>
            <div className="research-panel-header mobile-only">
              <h3>{t("research.widget.tools")}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsRightDrawerOpen(false)}
                aria-label="Close tools panel"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Widget 1: Research Quick Tools */}
            <div className="research-widget-card">
              <h4 className="widget-title">{t("research.widget.tools")}</h4>
              <div className="widget-quick-actions">
                <button
                  type="button"
                  className="quick-tool-row"
                  onClick={() => setIsUploadModalOpen(true)}
                >
                  <span className="quick-tool-icon"><UploadCloudIcon size={16} /></span>
                  <span className="quick-tool-label">{t("research.tool.upload")}</span>
                </button>
                <button
                  type="button"
                  className="quick-tool-row"
                  onClick={() => setIsBriefModalOpen(true)}
                >
                  <span className="quick-tool-icon"><FileTextPlusIcon size={16} /></span>
                  <span className="quick-tool-label">{t("research.tool.brief")}</span>
                </button>
                <button
                  type="button"
                  className="quick-tool-row"
                  onClick={() => setIsCitationCheckerOpen(true)}
                >
                  <span className="quick-tool-icon"><ShieldCheckIcon size={16} /></span>
                  <span className="quick-tool-label">{t("research.tool.verify")}</span>
                </button>
                <button
                  type="button"
                  className="quick-tool-row"
                  onClick={() => setIsPrecedentFinderOpen(true)}
                >
                  <span className="quick-tool-icon"><FileSearchIcon size={16} /></span>
                  <span className="quick-tool-label">{t("research.tool.precedent")}</span>
                </button>
                <button
                  type="button"
                  className="quick-tool-row"
                  onClick={() => setActiveTab("saved")}
                >
                  <span className="quick-tool-icon"><BookmarkIcon size={16} /></span>
                  <span className="quick-tool-label">{t("research.tab.library")} ({savedItems.length})</span>
                </button>
              </div>
            </div>

            {/* Widget 2: Popular Acts & Transitions Shortcuts */}
            <div className="research-widget-card">
              <h4 className="widget-title">{t("research.widget.popular_acts")}</h4>
              <div className="popular-acts-list">
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Bharatiya Nyaya Sanhita (BNS)")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Bharatiya Nyaya Sanhita (BNS)</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Bharatiya Nagarik Suraksha Sanhita (BNSS)")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Bharatiya Nagarik Suraksha Sanhita (BNSS)</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Bharatiya Sakshya Adhiniyam (BSA)")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Bharatiya Sakshya Adhiniyam (BSA)</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Constitution of India")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Constitution of India</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Negotiable Instruments Act")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Negotiable Instruments Act</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Arbitration and Conciliation Act")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Arbitration and Conciliation Act</span>
                </button>
                <button
                  type="button"
                  className="popular-act-btn"
                  onClick={() => handleActShortcutClick("Transfer of Property Act")}
                >
                  <span className="act-bullet">§</span>
                  <span className="act-name">Transfer of Property Act</span>
                </button>
              </div>
            </div>

            {/* Widget 3: Recent Searches */}
            <div className="research-widget-card">
              <div className="widget-header-row">
                <h4 className="widget-title">{t("research.widget.recent")}</h4>
                {recentSearches.length > 0 && (
                  <button
                    type="button"
                    className="clear-recent-btn"
                    onClick={handleClearRecentSearches}
                  >
                    {isHindi ? "सभी हटाएं" : "Clear All"}
                  </button>
                )}
              </div>
              {recentSearches.length === 0 ? (
                <p className="widget-empty-note">{isHindi ? "कोई हालिया खोज नहीं" : "No recent searches"}</p>
              ) : (
                <div className="recent-searches-list">
                  {recentSearches.map((rec) => (
                    <div key={rec.id} className="recent-search-item-row">
                      <button
                        type="button"
                        className="recent-search-btn"
                        onClick={() => {
                          setSearchQuery(rec.query);
                          handlePerformSearch(rec.query);
                        }}
                      >
                        <HistoryIcon size={14} />
                        <span className="recent-query-text">{rec.query}</span>
                      </button>
                      <button
                        type="button"
                        className="recent-del-btn"
                        onClick={() => handleDeleteRecentSearch(rec.id)}
                        title="Remove from history"
                        aria-label="Remove"
                      >
                        <XIcon size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* MODAL DIALOGS */}
        <JudgmentDetailModal
          caseItem={selectedCaseForDetail}
          onClose={() => setSelectedCaseForDetail(null)}
          onSave={handleToggleSaveCase}
          isSaved={selectedCaseForDetail ? isCaseSaved(selectedCaseForDetail.citation) : false}
          onGenerateBrief={handleGenerateBriefForCase}
        />

        <PrecedentFinderModal
          isOpen={isPrecedentFinderOpen}
          onClose={() => setIsPrecedentFinderOpen(false)}
          onViewCase={(caseItem) => {
            setIsPrecedentFinderOpen(false);
            setSelectedCaseForDetail(caseItem);
          }}
        />

        <CitationCheckerModal
          isOpen={isCitationCheckerOpen}
          onClose={() => setIsCitationCheckerOpen(false)}
          onSelectCaseByCitation={(cit) => {
            setSearchQuery(cit);
            handlePerformSearch(cit);
          }}
        />

        <ResearchBriefModal
          isOpen={isBriefModalOpen}
          onClose={() => setIsBriefModalOpen(false)}
          initialPrompt={briefInitialPrompt}
          initialSection={briefInitialSection}
          onSaveBrief={(brief) => {
            if (!userId) return;
            const saved = legalResearchService.saveResearch(userId, {
              type: "brief",
              title: brief.title,
              reference: brief.inputs.legalIssue.slice(0, 40),
              summary: brief.conclusion,
              tags: ["Research Brief", "Source Grounded"],
              data: brief,
            });
            setSavedItems((prev) => [saved, ...prev]);
          }}
        />

        <UploadJudgmentModal
          isOpen={isUploadModalOpen}
          onClose={() => setIsUploadModalOpen(false)}
        />
      </div>
    </AppShell>
  );
}