"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  BarChartIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CompareIcon,
  FileTextIcon,
  HelpCircleIcon,
  HomeIcon,
  LogOutIcon,
  MenuIcon,
  PlusIcon,
  ScaleIcon,
  SettingsIcon,
  SidebarCollapseIcon,
  SparklesIcon,
  TrashIcon,
  XIcon,
} from "./icons";
import {
  createChatSession,
  deleteChatSession,
  listChatSessions,
  type StoredChatSession,
} from "@/lib/chat-store";
import { useLanguage } from "@/lib/language-context";
import type { TranslationKey } from "@/lib/translations";
import { SettingsModal } from "./settings-modal";
import { HelpDocsModal } from "./help-docs-modal";

interface NavItem {
  icon?: (props: { size?: number; className?: string }) => React.JSX.Element;
  glyph?: string;
  label: string;
  translationKey: TranslationKey;
  href: string;
  roles?: string[];
  badge?: string;
  ariaLabel?: string;
}

const navigationItems: NavItem[] = [
  { icon: HomeIcon, label: "Dashboard", translationKey: "nav.dashboard", href: "/dashboard", ariaLabel: "Dashboard" },
  { icon: FileTextIcon, label: "Documents", translationKey: "nav.documents", href: "/documents" },
  { icon: CompareIcon, label: "Compare", translationKey: "nav.compare", href: "/compare" },
  { glyph: "✦", label: "Analysis", translationKey: "nav.analysis", href: "/analysis", roles: ["LAWYER", "ADMIN"] },
  { icon: ScaleIcon, label: "Legal Research", translationKey: "nav.research", href: "/research", roles: ["LAWYER", "ADMIN"] },
  { icon: BarChartIcon, label: "Reports", translationKey: "nav.reports", href: "/reports" },
  { glyph: "📋", label: "Audit Logs", translationKey: "nav.audit_logs", href: "/audit-logs", roles: ["ADMIN"] },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const { t, isHindi } = useLanguage();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<StoredChatSession[]>([]);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpDocsOpen, setIsHelpDocsOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOpenSettings = () => setIsSettingsOpen(true);
    window.addEventListener("legalai:open-settings", handleOpenSettings);
    return () => window.removeEventListener("legalai:open-settings", handleOpenSettings);
  }, []);

  useEffect(() => {
    const handleOpenHelp = () => setIsHelpDocsOpen(true);
    window.addEventListener("legalai:open-help", handleOpenHelp);
    return () => window.removeEventListener("legalai:open-help", handleOpenHelp);
  }, []);

  useEffect(() => {
    if (pathname === "/settings") {
      setIsSettingsOpen(true);
    }
  }, [pathname]);

  const handleCloseSettings = () => {
    setIsSettingsOpen(false);
    if (pathname === "/settings") {
      router.push("/dashboard");
    }
  };

  const handleCloseHelpDocs = () => {
    setIsHelpDocsOpen(false);
    if (pathname === "/help") {
      router.push("/dashboard");
    }
  };

  // Close profile menu on outside click or Escape key
  useEffect(() => {
    if (!isProfileMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  // Close profile menu on route change
  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname]);

  // Load user's recent chats for the sidebar
  useEffect(() => {
    const currentUserId = user?.id || "guest";
    const refreshChats = () => {
      const sessions = listChatSessions(currentUserId);
      setRecentChats(sessions.slice(0, 15));
    };
    refreshChats();

    window.addEventListener("legalai:chats-updated", refreshChats);
    return () => {
      window.removeEventListener("legalai:chats-updated", refreshChats);
    };
  }, [user?.id]);

  useEffect(() => {
    // Client-side guard for protected routes
    if (!isLoading && !user && pathname && !["/login", "/register"].includes(pathname)) {
      router.push(`/login?from=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, user?.id, pathname, router]);

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleStartNewChat = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const newSession = createChatSession(user?.id || "guest");
    router.push(`/chat/${newSession.id}`);
  };

  const handleDeleteChat = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const currentUserId = user?.id || "guest";
    setRecentChats((prev) => prev.filter((c) => c.id !== chatId));
    deleteChatSession(chatId, currentUserId);
    if (pathname === `/chat/${chatId}` || pathname.startsWith(`/chat/${chatId}/`)) {
      router.push("/dashboard");
    }
  };

  const handleOpenMobileDrawer = () => {
    setCollapsed(false);
    setMobileDrawerOpen(true);
  };

  const userRole = user?.role?.toUpperCase();
  const visibleNav = navigationItems.filter((item) => {
    if (!item.roles) return true;
    if (!userRole) return !item.roles.includes("ADMIN");
    return item.roles.includes(userRole);
  });

  return (
    <div className={`app-frame ${collapsed ? "sidebar-collapsed" : ""}`}>
      {/* Mobile Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Modern Collapsible Sidebar */}
      <aside className={`sidebar ${mobileDrawerOpen ? "mobile-open" : ""}`}>
        {/* Top Header: Brand Logo & Collapse Trigger */}
        <div className="sidebar-top-bar">
          {collapsed ? (
            <button
              type="button"
              className="brand-collapsed-toggle"
              onClick={() => setCollapsed(false)}
              aria-label="Open sidebar"
              title="Open sidebar"
            >
              <span className="brand-mark">
                <SparklesIcon size={15} />
              </span>
            </button>
          ) : (
            <>
              <Link className="brand" href="/dashboard" title="LegalAI Home">
                <span className="brand-mark">
                  <SparklesIcon size={15} />
                </span>
                <span className="brand-copy">
                  LegalAI
                  <span className="brand-subtitle">{isHindi ? "दस्तावेज़ बुद्धिमत्ता" : "Document Intelligence"}</span>
                </span>
              </Link>

              {/* Desktop collapse toggle */}
              <button
                type="button"
                className="sidebar-toggle-btn desktop-only"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setCollapsed(true);
                }}
                title={isHindi ? "साइडबार समेटें" : "Collapse sidebar"}
                aria-label={isHindi ? "साइडबार समेटें" : "Collapse sidebar"}
              >
                <SidebarCollapseIcon size={16} />
              </button>
            </>
          )}

          {/* Mobile close button */}
          <button
            type="button"
            className="sidebar-toggle-btn mobile-only"
            onClick={() => setMobileDrawerOpen(false)}
            aria-label={isHindi ? "मेनू बंद करें" : "Close menu"}
          >
            <XIcon size={18} />
          </button>
        </div>

        {/* Sidebar Body (Hidden when collapsed) */}
        {!collapsed && (
          <div className="sidebar-body">
            {/* Action: New Chat Button */}
            <div className="sidebar-action-container">
              <button
                type="button"
                className="new-chat-btn"
                onClick={handleStartNewChat}
                title={isHindi ? "नई चैट शुरू करें" : "Start New Chat"}
                aria-label={isHindi ? "नई चैट" : "New Chat"}
              >
                <PlusIcon size={16} />
                <span>{isHindi ? t("nav.new_chat") : "New Chat"}</span>
              </button>
            </div>

            {/* Primary Navigation */}
            <nav className="nav-group" aria-label="Main navigation">
              <p className="nav-label">{isHindi ? t("nav.workspace") : "Workspace"}</p>
              {visibleNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/" && pathname.startsWith(item.href + "/"));
                const displayLabel = isHindi ? t(item.translationKey) : item.label;
                return (
                  <Link
                    className={`nav-link ${isActive ? "active" : ""}`}
                    href={item.href}
                    key={item.href}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={displayLabel}
                  >
                    {item.icon ? (
                      <span className="nav-icon-wrap" aria-hidden="true">
                        <item.icon size={21} />
                      </span>
                    ) : (
                      <span className="nav-glyph" aria-hidden="true">
                        {item.glyph}
                      </span>
                    )}
                    <span>{displayLabel}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Recent Chats Section */}
            <div className="recent-chats-section">
              <div className="recent-chats-header">
                <p className="nav-label">{isHindi ? t("nav.recent_chats") : "Recent Chats"}</p>
              </div>

              {recentChats.length === 0 ? (
                <p className="sidebar-empty-note">{isHindi ? t("nav.no_chats_yet") : "No chats yet"}</p>
              ) : (
                <div className="recent-chats-list">
                  {recentChats.slice(0, 8).map((chat) => {
                    const chatTitle = chat.title || chat.documentName || "New Chat";
                    const isActive = pathname === `/chat/${chat.id}`;
                    return (
                      <div key={chat.id} className="recent-chat-item-row">
                        <Link
                          href={`/chat/${chat.id}`}
                          className={`recent-chat-link ${isActive ? "active" : ""}`}
                          title={chatTitle}
                          style={{ flex: 1, minWidth: 0 }}
                        >
                          <span className="recent-chat-icon" aria-hidden="true">
                            💬
                          </span>
                          <span className="recent-chat-title">{chatTitle}</span>
                        </Link>
                        <button
                          type="button"
                          className="recent-chat-delete-trigger"
                          onClick={(e) => handleDeleteChat(e, chat.id)}
                          title={`Delete ${chatTitle}`}
                          aria-label={`Delete chat ${chatTitle}`}
                        >
                          <TrashIcon size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sidebar Footer: Profile Trigger & Popover Menu */}
            <div className="sidebar-footer">
              {isLoading ? (
                <div className="profile animate-pulse">
                  <span className="avatar">…</span>
                  <span className="profile-copy">
                    Workspace
                    <br />
                    <small>Loading session...</small>
                  </span>
                </div>
              ) : user ? (
                <div className="profile-menu-container" ref={profileMenuRef}>
                  {/* Profile Dropdown Popover */}
                  {isProfileMenuOpen && (
                    <div
                      className="profile-menu-popover"
                      role="menu"
                      aria-label="Profile actions"
                      id="profile-dropdown-menu"
                    >
                      <div className="profile-menu-header">
                        <span className="avatar">{getInitials(user.name)}</span>
                        <div className="profile-menu-header-info">
                          <strong className="profile-menu-name">{user.name}</strong>
                          <small className="role-tag">{user.role}</small>
                        </div>
                      </div>

                      <div className="profile-menu-divider" role="separator" />

                      <Link
                        href="/settings"
                        className="profile-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileMenuOpen(false);
                          setIsSettingsOpen(true);
                        }}
                      >
                        <SettingsIcon size={15} className="menu-item-icon" />
                        <span>{isHindi ? t("profile.settings") : "Settings"}</span>
                      </Link>

                      <Link
                        href="/help"
                        className="profile-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileMenuOpen(false);
                          setIsHelpDocsOpen(true);
                        }}
                      >
                        <HelpCircleIcon size={15} className="menu-item-icon" />
                        <span>{isHindi ? t("profile.help_docs") : "Help & Docs"}</span>
                      </Link>

                      <div className="profile-menu-divider" role="separator" />

                      <button
                        type="button"
                        className="profile-menu-item profile-menu-item-danger"
                        aria-label={isHindi ? t("profile.sign_out") : "Sign out"}
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        <LogOutIcon size={15} className="menu-item-icon" />
                        <span>{isHindi ? t("profile.sign_out") : "Sign out"}</span>
                      </button>
                    </div>
                  )}

                  {/* Profile Trigger Button */}
                  <button
                    type="button"
                    className={`profile-trigger-card ${isProfileMenuOpen ? "open" : ""}`}
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="true"
                    aria-controls="profile-dropdown-menu"
                    title={`${user.name} (${user.role})`}
                  >
                    <div className="profile-trigger-left">
                      <span className="avatar">{getInitials(user.name)}</span>
                      <div className="profile-trigger-info">
                        <div className="profile-trigger-name-row">
                          <strong className="profile-name">{user.name}</strong>
                        </div>
                        <div className="profile-trigger-role-row">
                          <small className="role-tag">{user.role}</small>
                        </div>
                        <p
                          className="role-ux-note"
                          title="Role-based UI is for ergonomics only. Backend enforces all permissions."
                        >
                          {isHindi ? `कार्यक्षेत्र: ${user.role}` : `RBAC: ${user.role} workspace`}
                        </p>
                      </div>
                    </div>
                    <span className="profile-trigger-chevron" aria-hidden="true">
                      {isProfileMenuOpen ? (
                        <ChevronUpIcon size={14} />
                      ) : (
                        <ChevronDownIcon size={14} />
                      )}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="profile">
                  <span className="avatar">G</span>
                  <span className="profile-copy">
                    Guest workspace
                    <br />
                    <Link href="/login" className="login-link">
                      Sign in
                    </Link>
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Collapsed Sidebar Rail (Icon-Only) */}
        {collapsed && (
          <div className="collapsed-sidebar-body">
            {/* Action: New Chat Button (Icon only) */}
            <div className="collapsed-action-container">
              <button
                type="button"
                className="collapsed-nav-item collapsed-new-chat-btn"
                onClick={handleStartNewChat}
                title="New Chat"
                data-tooltip="New Chat"
                aria-label="New Chat"
              >
                <PlusIcon size={20} />
              </button>
            </div>

            <div className="collapsed-rail-divider" role="separator" />

            {/* Primary Navigation (Icons only) */}
            <nav className="collapsed-nav-group" aria-label="Main navigation">
              {visibleNav.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/" && pathname.startsWith(item.href + "/"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`collapsed-nav-item ${isActive ? "active" : ""}`}
                    title={item.label}
                    data-tooltip={item.label}
                    aria-label={item.label}
                    aria-current={isActive ? "page" : undefined}
                  >
                    {item.icon ? (
                      <span className="collapsed-icon-wrap" aria-hidden="true">
                        <item.icon size={23} />
                      </span>
                    ) : (
                      <span className="collapsed-glyph" aria-hidden="true">
                        {item.glyph}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>

            <div className="collapsed-rail-divider" role="separator" />

            {/* Recent Chats (Icon only) */}
            <div className="collapsed-chats-group">
              <Link
                href={recentChats.length > 0 ? `/chat/${recentChats[0].id}` : "/chat"}
                className={`collapsed-nav-item ${pathname.startsWith("/chat") ? "active" : ""}`}
                title="Recent Chats"
                data-tooltip="Recent Chats"
                aria-label="Recent Chats"
              >
                <span className="recent-chat-icon" aria-hidden="true">
                  💬
                </span>
              </Link>
            </div>

            {/* Spacer pushing utility and profile to bottom */}
            <div className="collapsed-spacer" />

            {/* Bottom Profile Group (Settings & Help are accessible only via profile menu) */}
            <div className="collapsed-profile-container">
              {isLoading ? (
                <div className="collapsed-avatar-btn animate-pulse">
                  <span className="avatar avatar-collapsed">…</span>
                </div>
              ) : user ? (
                <div className="profile-menu-container collapsed-profile-menu-container" ref={profileMenuRef}>
                  {isProfileMenuOpen && (
                    <div
                      className="profile-menu-popover collapsed-popover"
                      role="menu"
                      aria-label="Profile actions"
                      id="profile-dropdown-menu-collapsed"
                    >
                      <div className="profile-menu-header">
                        <span className="avatar">{getInitials(user.name)}</span>
                        <div className="profile-menu-header-info">
                          <strong className="profile-menu-name">{user.name}</strong>
                          <small className="role-tag">{user.role}</small>
                        </div>
                      </div>

                      <div className="profile-menu-divider" role="separator" />

                      <Link
                        href="/settings"
                        className="profile-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileMenuOpen(false);
                          setIsSettingsOpen(true);
                        }}
                      >
                        <SettingsIcon size={15} className="menu-item-icon" />
                        <span>Settings</span>
                      </Link>

                      <Link
                        href="/help"
                        className="profile-menu-item"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsProfileMenuOpen(false);
                          setIsHelpDocsOpen(true);
                        }}
                      >
                        <HelpCircleIcon size={15} className="menu-item-icon" />
                        <span>Help & Docs</span>
                      </Link>

                      <div className="profile-menu-divider" role="separator" />

                      <button
                        type="button"
                        className="profile-menu-item profile-menu-item-danger"
                        aria-label="Sign out"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          handleLogout();
                        }}
                      >
                        <LogOutIcon size={15} className="menu-item-icon" />
                        <span>Sign out</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    className={`collapsed-avatar-btn ${isProfileMenuOpen ? "open" : ""}`}
                    onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                    aria-expanded={isProfileMenuOpen}
                    aria-haspopup="true"
                    aria-controls="profile-dropdown-menu-collapsed"
                    title={`${user.name} (${user.role})`}
                    data-tooltip={isProfileMenuOpen ? undefined : user.name}
                    aria-label={`${user.name} profile`}
                  >
                    <span className="avatar avatar-collapsed">{getInitials(user.name)}</span>
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="collapsed-avatar-btn"
                  title="Sign in"
                  data-tooltip="Sign in"
                  aria-label="Sign in"
                >
                  <span className="avatar avatar-collapsed">G</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* Main Workspace Frame */}
      <div className="main-viewport">
        {/* Top bar for mobile trigger and status indicator */}
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="mobile-menu-btn"
              onClick={handleOpenMobileDrawer}
              aria-label="Open navigation menu"
            >
              <MenuIcon size={20} />
            </button>
            <span className="topbar-breadcrumb">
              <span className="workspace-heading">Workspace</span>
              <span className="sep">/</span>
              <span className="sub-title">
                {pathname === "/" || pathname === "/dashboard"
                  ? "AI Copilot"
                  : pathname?.replace("/", "").toUpperCase() || "AI Copilot"}
              </span>
            </span>
          </div>

          <div className="topbar-meta">
            <div className="system-live-pill">
              <span className="live-dot" />
              <span>AI Ready</span>
            </div>

            {user ? (
              <span className="role-meta-badge">
                <strong>{user.role}</strong>
              </span>
            ) : (
              <span>Session required</span>
            )}
            <span className="phase-badge">LEGALAI</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">{children}</main>
      </div>

      {/* ChatGPT-Style Centered Elevated Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={handleCloseSettings}
      />

      {/* Centered Elevated Help & Docs Modal */}
      <HelpDocsModal
        isOpen={isHelpDocsOpen}
        onClose={handleCloseHelpDocs}
      />
    </div>
  );
}