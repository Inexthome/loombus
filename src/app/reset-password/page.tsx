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
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-16">
      <div className="mx-auto max-w-xl">
        <Link
          href="/login"
          className="mb-10 inline-block text-sm text-zinc-500 transition hover:text-white sm:mb-12"
        >
          ← Back to login
        </Link>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-7">
          <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus password reset
          </p>

          <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Set a new password.
          </h1>

          {!hasSession ? (
            <div className="rounded-2xl border border-zinc-800 bg-black p-5">
              <p role="status" aria-live="polite" className="text-sm leading-relaxed text-zinc-400">
                {message || "This reset link is missing or expired. Request a new password reset email and use the newest link."}
              </p>

              <Link
                href="/forgot-password"
                className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="leading-relaxed text-zinc-400">
                Enter a new password for your Loombus account.
              </p>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">New password</label>
                <input
                  type="password"
                  value={password}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-zinc-400">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                />
              </div>

              <button
                type="submit"
                disabled={saving || success}
                className="w-full rounded-full bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Updating password..." : success ? "Password updated" : "Update password"}
              </button>

              {message ? (
                <p
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-zinc-400"
                >
                  {message}
                </p>
              ) : null}

              {success ? (
                <Link
                  href="/login"
                  className="block w-full rounded-full border border-zinc-800 px-6 py-3 text-center text-sm font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-white"
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
