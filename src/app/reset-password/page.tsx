"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { supabase } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function checkSession() {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          setMessage(getAuthErrorMessage(error, "reset"));
          setHasSession(false);
          return;
        }

        setHasSession(Boolean(data.session));
      } catch (error) {
        setMessage(getAuthErrorMessage(error, "reset"));
        setHasSession(false);
      } finally {
        setCheckingSession(false);
      }
    }

    void checkSession();
  }, []);

  async function handleResetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setMessage("");
    setSuccess(false);

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setMessage(getAuthErrorMessage(error, "reset"));
        return;
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setMessage("Password updated. You can now return to Loombus and sign in.");
    } catch (error) {
      setMessage(getAuthErrorMessage(error, "reset"));
    } finally {
      setSaving(false);
    }
  }

  if (checkingSession) {
    return (
      <LoombusLoadingScreen
        eyebrow="Loombus account"
        title="Preparing password reset..."
        message="Checking your secure reset session."
      />
    );
  }

  return (
    <main
      data-loombus-auth-shell
      data-loombus-password-recovery-editorial
      className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-16"
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center text-sm text-[color:var(--loombus-text-muted)] underline decoration-[color:var(--loombus-border)] underline-offset-4 transition hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
        >
          ← Back to login
        </Link>

        <header className="border-b border-[color:var(--loombus-border)] py-10 sm:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
            Loombus password reset
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Set a new password.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
            Use the secure recovery session from your newest reset email to update your Loombus password.
          </p>
        </header>

        <section className="py-8 sm:py-10">
          <div className="border-b border-[color:var(--loombus-border)] pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
              Secure recovery
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">
              {hasSession ? "Choose your new password" : "Reset link unavailable"}
            </h2>
          </div>

          {!hasSession ? (
            <div className="pt-6">
              <p role="status" aria-live="polite" className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                {message || "This reset link is missing or expired. Request a new password reset email and use the newest link."}
              </p>

              <div className="mt-6 border-t border-[color:var(--loombus-border)] pt-5">
                <Link
                  href="/forgot-password"
                  className="inline-flex min-h-12 items-center border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                >
                  Request a new reset link
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="mt-6 space-y-6">
              <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Enter a new password for your Loombus account.
              </p>

              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                  New password
                </label>
                <input
                  id="new-password"
                  name="new-password"
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                />
              </div>

              <div>
                <label htmlFor="confirm-new-password" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  name="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                />
              </div>

              <button
                type="submit"
                disabled={saving || success}
                className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
              >
                {saving ? "Updating password..." : success ? "Password updated" : "Update password"}
              </button>

              {message ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="border-t border-[color:var(--loombus-border)] pt-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]"
                >
                  {message}
                </p>
              ) : null}

              {success ? (
                <div className="border-t border-[color:var(--loombus-border)] pt-5">
                  <Link
                    href="/login"
                    className="inline-flex min-h-11 items-center border-b border-[color:var(--loombus-gold)] px-0 py-2 text-sm font-medium text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
                  >
                    Return to login
                  </Link>
                </div>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
