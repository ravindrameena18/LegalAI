"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api-client";

export default function RegisterPage() {
  const router = useRouter();
  const { user, isAuthenticated, register, isLoading, error: authError, clearError } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("LAWYER");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Real-time password validation helpers
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\/]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // If already authenticated, redirect to dashboard
  useEffect(() => {
    if (!isLoading && (user || isAuthenticated)) {
      router.push("/dashboard");
      if (typeof router.refresh === "function") {
        router.refresh();
      }
    }
  }, [user, isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (trimmedName.length < 2) {
      setFormError("Full name must be at least 2 characters.");
      return;
    }

    if (!trimmedEmail) {
      setFormError("Valid work email is required.");
      return;
    }

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial) {
      setFormError(
        "Password must be at least 8 characters and include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      await register({
        name: trimmedName,
        email: trimmedEmail,
        role,
        password,
        confirmPassword,
      });
      router.push("/dashboard");
      if (typeof router.refresh === "function") {
        router.refresh();
      }
    } catch (err: unknown) {
      const errMessage =
        err instanceof ApiError
          ? err.detail
          : err instanceof Error
            ? err.message
            : "Failed to register. Please check your details.";
      setFormError(errMessage);
      setIsSubmitting(false);
    }
  };

  const activeError = formError || authError;

  return (
    <AppShell>
      <div className="auth-card-container">
        <div className="auth-surface-card">
          <div className="auth-header">
            <span className="eyebrow">Identity & Access</span>
            <h1>Create your LegalAI account</h1>
            <p>Establish verified credentials for secure document intelligence.</p>
          </div>

          {activeError && (
            <div className="auth-error-banner" role="alert">
              <span className="error-icon" aria-hidden="true">⚠</span>
              <span>{activeError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                name="name"
                autoComplete="name"
                placeholder="Jane Doe, Esq."
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting || isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Work Email</label>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="attorney@lawfirm.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting || isLoading}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="role">Workspace Role</label>
              <div className="role-selector">
                <button
                  type="button"
                  className={`role-option ${role === "LAWYER" ? "active" : ""}`}
                  onClick={() => setRole("LAWYER")}
                  disabled={isSubmitting || isLoading}
                >
                  <strong>Lawyer / Counsel</strong>
                  <small>Full analysis &amp; drafting access</small>
                </button>
                <button
                  type="button"
                  className={`role-option ${role === "CLIENT" ? "active" : ""}`}
                  onClick={() => setRole("CLIENT")}
                  disabled={isSubmitting || isLoading}
                >
                  <strong>Client / Reviewer</strong>
                  <small>Document review &amp; reports</small>
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                name="password"
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting || isLoading}
                required
              />
            </div>

            <div className="password-rules">
              <span className={`rule-item ${hasMinLength ? "valid" : ""}`}>
                {hasMinLength ? "✓" : "○"} 8+ chars
              </span>
              <span className={`rule-item ${hasUppercase ? "valid" : ""}`}>
                {hasUppercase ? "✓" : "○"} Uppercase
              </span>
              <span className={`rule-item ${hasLowercase ? "valid" : ""}`}>
                {hasLowercase ? "✓" : "○"} Lowercase
              </span>
              <span className={`rule-item ${hasNumber ? "valid" : ""}`}>
                {hasNumber ? "✓" : "○"} Number
              </span>
              <span className={`rule-item ${hasSpecial ? "valid" : ""}`}>
                {hasSpecial ? "✓" : "○"} Symbol
              </span>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting || isLoading}
                required
              />
              {confirmPassword.length > 0 && (
                <span className={`match-hint ${passwordsMatch ? "valid" : "invalid"}`}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="auth-submit-button"
              disabled={isSubmitting || isLoading}
            >
              {isSubmitting ? "Creating account..." : "Create workspace account"}
            </button>
          </form>

          <div className="auth-footer-prompt">
            <span>Already have an account?</span>
            <Link href="/login" className="auth-alt-link">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}