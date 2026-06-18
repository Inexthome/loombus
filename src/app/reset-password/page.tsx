"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";

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
      const { data } = await supabase.auth.getSession();

      setHasSession(Boolean(data.session));
      setCheckingSession(false);
    }

    checkSession();
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

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setMessage(`Password reset error: ${error.message}`);
      setSaving(false);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSuccess(true);
    setMessage("Password updated. You can now continue to Loombus.");
    setSaving(false);
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
    <main className="min-h-screen bg-[var(--loombus-bg)] px-6 py-16 text-[var(--loombus-text)]">
      <div className="mx-auto max-w-xl">
        <Link
          href="/"
          className="mb-10 inline-block text-sm text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]"
        >
          ← Back to home
        </Link>

        <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 shadow-2xl shadow-black/10">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-[var(--loombus-text-muted)]">
            Loombus password reset
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight">
            Set a new password.
          </h1>

          {!hasSession ? (
            <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5">
              <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                This reset link is missing or expired. Return to Loombus and request a new password reset email.
              </p>

              <Link
                href="/"
                className="mt-5 inline-flex rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="leading-relaxed text-[var(--loombus-text-muted)]">
                Enter a new password for your Loombus account.
              </p>

              <div>
                <label className="mb-2 block text-sm text-[var(--loombus-text-muted)]">
                  New password
                </label>
                <input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-text-muted)]"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-[var(--loombus-text-muted)]">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-text-muted)]"
                />
              </div>

              <button
                type="submit"
                disabled={saving || success}
                className="w-full rounded-full bg-[var(--loombus-primary-bg)] px-6 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating password..." : success ? "Password updated" : "Update password"}
              </button>

              {message ? (
                <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                  {message}
                </p>
              ) : null}

              {success ? (
                <Link
                  href="/login"
                  className="block w-full rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-6 py-3 text-center text-sm font-semibold text-[var(--loombus-text)] transition hover:border-[var(--loombus-text-muted)]"
                >
                  Return to login
                </Link>
              ) : null}
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
