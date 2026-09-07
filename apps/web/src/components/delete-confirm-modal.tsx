"use client";

import { useEffect, useRef } from "react";
import { ShieldAlertIcon, TrashIcon, XIcon } from "./icons";
import { useLanguage } from "@/lib/language-context";

interface DeleteConfirmModalProps {
  isOpen: boolean;
  documentName: string;
  isDeleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({
  isOpen,
  documentName,
  isDeleting = false,
  onConfirm,
  onCancel,
}: DeleteConfirmModalProps) {
  const { t } = useLanguage();
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus cancel button for safe default
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
    >
      <div className="delete-modal-box">
        <div className="delete-modal-header">
          <div className="delete-modal-icon-badge">
            <ShieldAlertIcon size={20} className="delete-warning-svg" />
          </div>
          <div className="delete-modal-titles">
            <h2 id="delete-dialog-title" className="delete-modal-title">
              {t("delete.modal_title")}
            </h2>
          </div>
          <button
            type="button"
            className="delete-modal-close"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close delete dialog"
          >
            <XIcon size={16} />
          </button>
        </div>

        <div className="delete-modal-body">
          <p id="delete-dialog-description" className="delete-modal-copy">
            {(() => {
              const warningTemplate = t("delete.modal_desc");
              const parts = warningTemplate.split("{name}");
              return (
                <>
                  {parts[0]}
                  <strong className="delete-doc-name">{documentName}</strong>
                  {parts[1] || ""}
                </>
              );
            })()}
          </p>
        </div>

        <div className="delete-modal-actions">
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn-modal-cancel"
            onClick={onCancel}
            disabled={isDeleting}
          >
            {t("delete.cancel")}
          </button>
          <button
            type="button"
            className="btn-modal-delete"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <>
                <span className="spinner-dots-mini" />
                <span>{t("delete.deleting")}</span>
              </>
            ) : (
              <>
                <TrashIcon size={14} />
                <span>{t("delete.confirm_btn")}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

