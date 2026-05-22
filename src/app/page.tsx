"use client";

import Link from "next/link";
import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

type OAuthProvider = "google";

export default function Home() {
  const [message, setMessage] = useState("");
  const [workingProvider, setWorkingProvider] = useState<OAuthProvider | null>(null);

  async function signUpWithProvider(provider: OAuthProvider) {
    setMessage("");
    setWorkingProvider(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        setMessage(
          "Google sign up is not available yet. Please create an account with email instead."
        );
      }
    } finally {
      setWorkingProvider(null);
    }
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <img
          src="/assets/brand/loombus-mark-transparent.png"
          alt=""
          className="mb-6 h-16 w-16 object-contain"
        />

        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-zinc-500">
          Loombus
        </p>

        <h1 className="mb-5 text-5xl font-semibold tracking-tight md:text-6xl">
          Signal over noise.
        </h1>

        <p className="mb-10 max-w-lg leading-relaxed text-zinc-400">
          A high-signal discussion platform for thoughtful conversations,
          sharper ideas, and cleaner community dialogue.
        </p>

        <div className="w-full space-y-3">
          <button
            type="button"
            onClick={() => signUpWithProvider("google")}
            disabled={Boolean(workingProvider)}
            className="w-full rounded-full border border-zinc-700 bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {workingProvider === "google" ? "Opening Google..." : "Sign up with Google"}
          </button>

          <div className="flex items-center gap-3 py-2 text-xs uppercase tracking-[0.2em] text-zinc-700">
            <span className="h-px flex-1 bg-zinc-900" />
            Or
            <span className="h-px flex-1 bg-zinc-900" />
          </div>

          <Link
            href="/signup"
            className="block w-full rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white"
          >
            Create Account
          </Link>
        </div>

        {message && (
          <p className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-400">
            {message}
          </p>
        )}

        <p className="mt-8 text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-zinc-200 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      <footer className="mx-auto mt-10 flex max-w-4xl flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 text-sm text-zinc-600 md:flex-row">
        <p>© {new Date().getFullYear()} Loombus. All rights reserved.</p>

        <nav className="flex flex-wrap justify-center gap-4">
          <Link href="/about" className="transition hover:text-zinc-300">
            About
          </Link>
          <Link href="/guidelines" className="transition hover:text-zinc-300">
            Guidelines
          </Link>
          <Link href="/safety" className="transition hover:text-zinc-300">
            Safety
          </Link>
          <Link href="/terms" className="transition hover:text-zinc-300">
            Terms
          </Link>
          <Link href="/privacy" className="transition hover:text-zinc-300">
            Privacy
          </Link>
          <Link href="/cookies" className="transition hover:text-zinc-300">
            Cookies
          </Link>
          <Link href="/accessibility" className="transition hover:text-zinc-300">
            Accessibility
          </Link>
          <Link href="/contact" className="transition hover:text-zinc-300">
            Contact
          </Link>
        </nav>
      </footer>
    </main>
  );
}
