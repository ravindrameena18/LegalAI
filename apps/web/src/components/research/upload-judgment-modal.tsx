"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UploadCloudIcon, XIcon } from "../icons";

interface UploadJudgmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UploadJudgmentModal({ isOpen, onClose }: UploadJudgmentModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="evidence-modal-backdrop research-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-judgment-title"
    >
      <div
        className="evidence-modal upload-judgment-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="research-modal-header">
          <div className="research-modal-header-left">
            <span className="research-tool-header-icon">
              <UploadCloudIcon size={18} />
            </span>
            <div>
              <h3 id="upload-judgment-title" className="research-tool-header-title">
                Upload Judgment / Order
              </h3>
              <p className="research-tool-header-subtitle">
                Upload court orders, judgments, or legal deeds to cross-reference with legal research.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <XIcon size={18} />
          </button>
        </div>

        <div className="research-modal-body">
          <div className="upload-dropzone-card research-upload-zone">
            <input
              type="file"
              id="judgment-file-picker"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setSelectedFile(e.target.files[0]);
                }
              }}
            />
            <label htmlFor="judgment-file-picker" className="dropzone-label">
              <span className="dropzone-icon-wrap">
                <UploadCloudIcon size={28} />
              </span>
              <span className="dropzone-title">
                {selectedFile ? selectedFile.name : "Click to select or drag and drop judgment PDF"}
              </span>
              <span className="dropzone-meta">Supports PDF, DOCX up to 25MB</span>
            </label>
          </div>

          <div className="upload-modal-info-box">
            <p>
              Uploaded legal documents are indexed securely into your lawyer workspace for citation detection, risk extraction, and precedent cross-matching.
            </p>
          </div>

          <div className="upload-modal-actions">
            <Link
              href="/documents"
              className="btn-primary"
              onClick={onClose}
            >
              Go to Full Document Processing Hub →
            </Link>
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

