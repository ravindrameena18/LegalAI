"use client";

import { useEffect, useRef, useState } from "react";
import { EyeIcon, EyeOffIcon, LockIcon, XIcon } from "./icons";
import { unlockDocument, type DocumentDetail, type DocumentItem } from "@/lib/api-client";
import { useLanguage } from "@/lib/language-context";

interface PasswordPromptModalProps {
  isOpen: boolean;
  document: DocumentItem | null;
  onSuccess: (unlockedDoc: DocumentDetail) => void;
  onCancel: () => void;
}

function PasswordPromptDialog({
  document,
  onSuccess,
  onCancel,
}: {
  document: DocumentItem;
  onSuccess: (unlockedDoc: DocumentDetail) => void;
  onCancel: () => void;
}) {
  const { t } = useLanguage();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLoading, onCancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      const unlockedDoc = await unlockDocument(document.id, password);
      setIsLoading(false);
      onSuccess(unlockedDoc);
    } catch (err: unknown) {
      setIsLoading(false);
      const message = err instanceof Error ? err.message : "Failed to unlock document";
      setError(message.replace(/^ApiError:\s*/, ""));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pwd-dialog-title"
      aria-describedby="pwd-dialog-desc"
    >
      <div className="password-modal-box">
        <div className="password-modal-header">
          <div className="password-modal-icon-badge">
            <LockIcon size={20} className="password-lock-svg" />
          </div>
          <div className="password-modal-titles">
            <h2 id="pwd-dialog-title" className="password-modal-title">
              {t("password.modal_title")}
            </h2>
            <p id="pwd-dialog-desc" className="password-modal-subtitle">
              {t("password.modal_subtitle")}
            </p>
          </div>
          <button
            type="button"
            className="password-modal-close"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <XIcon size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="password-modal-body">
            <div className="password-doc-info">
              <span className="password-doc-label">{t("password.doc_label")}</span>
              <span className="password-doc-name" title={document.name}>
                {document.name}
              </span>
            </div>

            {error && (
              <div className="password-error-banner" role="alert">
                <span className="password-error-icon">!</span>
                <span className="password-error-text">{error}</span>
              </div>
            )}

            <div className="password-input-group">
              <label htmlFor="doc-password-input" className="password-input-label">
                {t("password.input_label")}
              </label>
              <div className="password-input-wrapper">
                <input
                  id="doc-password-input"
                  ref={inputRef}
                  type={showPassword ? "text" : "password"}
                  className="password-input-field"
                  placeholder={t("password.placeholder")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isLoading}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                </button>
              </div>
            </div>
          </div>

          <div className="password-modal-actions">
            <button
              type="button"
              className="btn-modal-cancel"
              onClick={onCancel}
              disabled={isLoading}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              className="btn-modal-unlock"
              disabled={!password.trim() || isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner-dots-mini" />
                  <span>{t("password.unlocking")}</span>
                </>
              ) : (
                <>
                  <LockIcon size={14} />
                  <span>{t("password.unlock_btn")}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PasswordPromptModal({
  isOpen,
  document,
  onSuccess,
  onCancel,
}: PasswordPromptModalProps) {
  if (!isOpen || !document) return null;

  return (
    <PasswordPromptDialog
      key={document.id}
      document={document}
      onSuccess={onSuccess}
      onCancel={onCancel}
    />
  );
}

