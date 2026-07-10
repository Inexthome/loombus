"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
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

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      setMessage(`Password reset error: ${error.message}`);
      setSending(false);
      return;
    }

    setSent(true);
    setMessage(
      "If an account exists for that email, a password reset link has been sent. Check your inbox and spam folder."
    );
    setSending(false);
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

        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Loombus account recovery
        </p>

        <h1 className="mb-6 text-4xl font-semibold tracking-tight sm:text-5xl">
          Reset your password.
        </h1>

        <p className="mb-8 leading-relaxed text-zinc-400 sm:mb-10">
          Enter the email address connected to your Loombus account. We will send a secure reset link.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30"
        >
          <div>
            <label className="mb-2 block text-sm text-zinc-400">Email</label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              required
              disabled={sent}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <button
            type="submit"
            disabled={sending || sent}
            className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending reset email..." : sent ? "Reset email sent" : "Send reset email"}
          </button>

          {message ? (
            <p className="rounded-2xl border border-zinc-800 bg-black p-4 text-sm leading-relaxed text-zinc-400">
              {message}
            </p>
          ) : null}

          {sent ? (
            <Link
              href="/login"
              className="block w-full rounded-full border border-zinc-800 px-6 py-3 text-center text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              Return to login
            </Link>
          ) : null}
        </form>
      </div>
    </main>
  );
}
