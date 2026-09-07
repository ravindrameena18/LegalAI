"use client";

import { useEffect, useState } from "react";
import { CheckCircleIcon, SparklesIcon } from "./icons";

interface Step {
  label: string;
  detail: string;
}

const STEPS: Step[] = [
  { label: "Document processed", detail: "Validated file integrity and format structure" },
  { label: "Text extracted", detail: "Normalized pages and section boundaries" },
  { label: "Clauses identified", detail: "Parsed legal covenants, dates, and financial terms" },
  { label: "Risk analysis", detail: "Cross-referencing liability, indemnities, and termination terms" },
  { label: "Final review", detail: "Validating against 24-section legal schema" },
];

export function AnalysisProgress() {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="analysis-progress-card">
      <div className="progress-card-header">
        <div className="progress-sparkle-avatar">
          <SparklesIcon size={18} className="text-blue-400 animate-spin" />
        </div>
        <div>
          <h3>Analyzing document with Google Gemini AI...</h3>
          <p>Synthesizing 24-section legal intelligence report and grounding citations.</p>
        </div>
      </div>

      <div className="steps-timeline">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div
              key={idx}
              className={`timeline-step ${isDone ? "step-done" : isCurrent ? "step-current" : "step-pending"}`}
            >
              <div className="step-marker">
                {isDone ? (
                  <CheckCircleIcon size={16} className="text-emerald-400" />
                ) : isCurrent ? (
                  <span className="current-pulse-dot" />
                ) : (
                  <span className="pending-ring" />
                )}
              </div>
              <div className="step-content">
                <strong className="step-title">{step.label}</strong>
                <span className="step-detail">{step.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

