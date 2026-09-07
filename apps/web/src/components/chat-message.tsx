"use client";

import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircleIcon, CopyIcon, FileTextIcon, SparklesIcon } from "./icons";
import { useLanguage } from "@/lib/language-context";

export interface CitationItem {
  page?: number | null;
  section?: string | null;
  text?: string | null;
  title?: string;
  explanation?: string;
  action?: string;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | null;
}

export interface MessageData {
  id: string;
  sender: "user" | "assistant";
  content: string;
  timestamp?: string;
  citations?: CitationItem[];
  risk?: {
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    title: string;
    explanation?: string;
  } | null;
}

interface ChatMessageProps {
  message: MessageData;
  onCitationClick?: (citation: CitationItem) => void;
}

export function ChatMessage({ message, onCitationClick }: ChatMessageProps) {
  const { t, isHindi } = useLanguage();
  const [copied, setCopied] = useState(false);
  const isUser = message.sender === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="chat-message-row user-row">
        <div className="user-message-bubble">
          <p className="message-text">{message.content}</p>
        </div>
      </div>
    );
  }

  // Pre-normalize unicode bullet characters to markdown list markers
  const formattedContent = message.content.replace(/^([ \t]*)•\s+/gm, "$1- ");

  return (
    <div className="chat-message-row assistant-row">
      <div className="assistant-avatar">
        <SparklesIcon size={16} />
      </div>

      <div className="assistant-message-body">
        {/* Risk banner if attached */}
        {message.risk && (
          <div className={`message-risk-banner severity-${message.risk.severity.toLowerCase()}`}>
            <span className={`risk-pill severity-${message.risk.severity.toLowerCase()}`}>
              {message.risk.severity} {isHindi ? "जोखिम पाया गया" : "RISK DETECTED"}
            </span>
            <strong>{message.risk.title}</strong>
            {message.risk.explanation && <p>{message.risk.explanation}</p>}
          </div>
        )}

        <div className="message-content-formatted">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children }) => {
                if (href && (href.startsWith("#page-") || href.startsWith("page:"))) {
                  const pageNum = parseInt(href.replace(/^.*page[-:]/, ""), 10);
                  return (
                    <button
                      type="button"
                      className="citation-inline-badge"
                      onClick={() =>
                        onCitationClick &&
                        onCitationClick({ page: pageNum, title: `${isHindi ? "पृष्ठ" : "Page"} ${pageNum} ${t("chat.citation")}` })
                      }
                    >
                      <FileTextIcon size={11} /> {children}
                    </button>
                  );
                }
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                );
              },
              table: ({ children }) => (
                <div className="markdown-table-wrapper">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {formattedContent}
          </Markdown>
        </div>

        {/* Citations section */}
        {message.citations && message.citations.length > 0 && (
          <div className="message-citations-container">
            <span className="citations-label">{t("chat.citations_title")}</span>
            <div className="citations-pill-list">
              {message.citations.map((cite, cIdx) => (
                <button
                  key={cIdx}
                  type="button"
                  className="citation-pill"
                  onClick={() => onCitationClick && onCitationClick(cite)}
                  title={isHindi ? "सत्यापित अनुबंध उद्धरण का निरीक्षण करने के लिए क्लिक करें" : "Click to inspect verbatim contract citation"}
                >
                  <FileTextIcon size={12} />
                  <span>
                    {cite.page ? `${isHindi ? "पृष्ठ" : "Page"} ${cite.page}` : t("chat.source")}
                    {cite.section ? ` · ${isHindi ? "धारा" : "Sec"}: ${cite.section}` : ""}
                  </span>
                  {cite.severity && (
                    <span className={`mini-risk-dot dot-${cite.severity.toLowerCase()}`} />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message footer toolbar */}
        <div className="message-toolbar">
          <button
            type="button"
            className="toolbar-btn"
            onClick={handleCopy}
            title={t("chat.copy")}
          >
            {copied ? (
              <>
                <CheckCircleIcon size={12} className="text-emerald-400" />
                <span>{t("chat.copied")}</span>
              </>
            ) : (
              <>
                <CopyIcon size={12} />
                <span>{t("chat.copy")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

