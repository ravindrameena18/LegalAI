"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpIcon, FileTextIcon, SquareIcon, UploadCloudIcon } from "./icons";
import { useLanguage } from "@/lib/language-context";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  onStop?: () => void;
  isLoading?: boolean;
  activeDocName?: string | null;
  onAttachClick?: () => void;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onStop,
  isLoading = false,
  activeDocName,
  onAttachClick,
  placeholder = "Ask LegalAI about this document...",
}: ChatInputProps) {
  const { t, isHindi } = useLanguage();
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [text]);

  const handleSend = () => {
    if (!text.trim() || isLoading) return;
    onSendMessage(text.trim());
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleButtonClick = () => {
    if (isLoading) {
      onStop?.();
      return;
    }
    handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading) {
        handleSend();
      }
    }
  };

  const hasText = text.trim().length > 0;

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-container">
        {activeDocName && (
          <div className="chat-active-doc-badge">
            <FileTextIcon size={12} className="text-blue-400" />
            <span className="doc-name">{activeDocName}</span>
          </div>
        )}
        <div className="chat-input-inner">
          {onAttachClick && (
            <button
              type="button"
              className="attach-btn"
              onClick={onAttachClick}
              title={t("chat.attach_title")}
              aria-label={t("chat.attach_title")}
            >
              <UploadCloudIcon size={18} />
            </button>
          )}

          <textarea
            ref={textareaRef}
            className="chat-textarea"
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={activeDocName ? placeholder : (isHindi ? "बातचीत शुरू करने के लिए दस्तावेज़ अपलोड या चुनें..." : "Upload or select a document to start chatting...")}
            disabled={isLoading}
          />

          <button
            type="button"
            className={`send-button ${
              isLoading ? "active stop-mode" : hasText ? "active" : ""
            }`}
            onClick={handleButtonClick}
            disabled={!isLoading && !hasText}
            aria-label={isLoading ? t("chat.stop_generating") : t("chat.send")}
            title={isLoading ? t("chat.stop_generating") : t("chat.send")}
          >
            {isLoading ? <SquareIcon size={14} /> : <ArrowUpIcon size={16} />}
          </button>
        </div>
      </div>
      <div className="chat-input-hint">
        <span>
          {isHindi ? (
            <>भेजने के लिए <strong>Enter</strong> दबाएँ, नई पंक्ति के लिए <strong>Shift + Enter</strong></>
          ) : (
            <>Press <strong>Enter</strong> to send, <strong>Shift + Enter</strong> for new line</>
          )}
        </span>
      </div>
    </div>
  );
}

