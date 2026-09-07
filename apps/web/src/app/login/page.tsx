"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const { login, isLoading, error: authError, clearError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    clearError();
    setFormError(null);

    if (!email.trim()) {
      setFormError("Email address is required.");
      return;
    }

    if (!password) {
      setFormError("Password is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email: email.trim(), password });
      router.push(from);
    } catch (err: unknown) {
      const errMessage =
        err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setFormError(errMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeError = formError || authError;

  return (
    <div className="auth-card-container">
      <div className="auth-surface-card">
        <div className="auth-header">
          <span className="eyebrow">Secure Access</span>
          <h1>Sign in to LegalAI</h1>
          <p>Access your confidential legal document intelligence workspace.</p>
        </div>

        {activeError && (
          <div className="auth-error-banner" role="alert">
            <span className="error-icon" aria-hidden="true">⚠</span>
            <span>{activeError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="lawyer@firm.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting || isLoading}
              required
            />
          </div>

          <button
            type="submit"
            className="auth-submit-button"
            disabled={isSubmitting || isLoading}
          >
            {isSubmitting ? "Signing in..." : "Sign in to workspace"}
          </button>
        </form>

        <div className="auth-footer-prompt">
          <span>Don&apos;t have an account?</span>
          <Link href="/register" className="auth-alt-link">
            Create account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="loading-text">Loading...</div>}>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}