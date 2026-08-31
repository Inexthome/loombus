"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { getAuthErrorMessage } from "@/lib/auth-error-message";
import { supabase } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (sending) {
      return;
    }

    setMessage("");
    setSending(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        setMessage(getAuthErrorMessage(error, "recovery"));
        return;
      }

      setSent(true);
      setMessage(
        "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder."
      );
    } catch (error) {
      setMessage(getAuthErrorMessage(error, "recovery"));
    } finally {
      setSending(false);
    }
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
            Loombus account recovery
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Reset your password.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
            Enter the email address connected to your Loombus account. We will send a secure reset link.
          </p>
        </header>

        <section className="py-8 sm:py-10">
          <div className="border-b border-[color:var(--loombus-border)] pb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">
              Recovery email
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">Request a secure reset link</h2>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <div>
              <label htmlFor="recovery-email" className="block text-sm font-medium text-[color:var(--loombus-text)]">
                Email
              </label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                value={email}
                autoComplete="email"
                inputMode="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={sent}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 min-h-12 w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
              />
            </div>

            <button
              type="submit"
              disabled={sending || sent}
              className="min-h-12 w-full border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-gold)] px-6 py-3 text-sm font-semibold text-[#17140B] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--loombus-gold)]"
            >
              {sending ? "Sending reset email..." : sent ? "Reset email sent" : "Send reset email"}
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

            {sent ? (
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
        </section>
      </div>
    </main>
  );
}
