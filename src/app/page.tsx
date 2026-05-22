"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type OAuthProvider = "google";
type HomeAuthState = "checking" | "logged_out" | "logged_in";

function withTimeout<T>(
  promise: PromiseLike<T>,
  label: string,
  ms = 5000
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

const memberCards = [
  {
    title: "Create",
    description: "Start a structured, high-signal discussion.",
    href: "/create",
    primary: true,
  },
  {
    title: "Discussions",
    description: "Browse the full discussion feed.",
    href: "/discussions",
  },
  {
    title: "People",
    description: "Find thoughtful contributors across Loombus.",
    href: "/people",
  },
  {
    title: "Notifications",
    description: "Review replies, follows, and account activity.",
    href: "/notifications",
  },
  {
    title: "Dashboard",
    description: "View your profile status, subscription, and activity summary.",
    href: "/dashboard",
  },
  {
    title: "Following",
    description: "See discussions from people you follow.",
    href: "/following",
  },
  {
    title: "Saved",
    description: "Return to discussions you saved.",
    href: "/saved",
  },
  {
    title: "My Activity",
    description: "View your discussions, replies, saves, and notifications.",
    href: "/my-activity",
  },
  {
    title: "Settings",
    description: "Manage your account, profile, and platform tools.",
    href: "/settings",
  },
];

export default function Home() {
  const [authState, setAuthState] = useState<HomeAuthState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [workingProvider, setWorkingProvider] = useState<OAuthProvider | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkAuthState() {
      try {
        const { data, error } = await withTimeout(
          supabase.auth.getUser(),
          "Home authentication check"
        );

        if (!isMounted) {
          return;
        }

        if (error || !data.user) {
          setEmail(null);
          setAuthState("logged_out");
          return;
        }

        setEmail(data.user.email ?? null);
        setAuthState("logged_in");
      } catch (error) {
        console.error("Unable to check home authentication state.", error);

        if (isMounted) {
          setEmail(null);
          setAuthState("logged_out");
        }
      }
    }

    checkAuthState();

    return () => {
      isMounted = false;
    };
  }, []);

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

  if (authState === "checking") {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <section className="mx-auto flex min-h-[72vh] max-w-xl flex-col items-center justify-center text-center">
          <img
            src="/assets/brand/loombus-mark-transparent.png"
            alt=""
            className="mb-6 h-14 w-14 object-contain"
          />

          <p className="text-zinc-500">Loading Loombus...</p>
        </section>
      </main>
    );
  }

  if (authState === "logged_in") {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <section className="mx-auto max-w-6xl">
          <div className="mb-10">
            <p className="mb-4 text-sm uppercase tracking-[0.35em] text-zinc-500">
              Member Home
            </p>

            <h1 className="mb-5 text-5xl font-semibold tracking-tight md:text-6xl">
              Welcome back to Loombus.
            </h1>

            <p className="max-w-3xl leading-relaxed text-zinc-400">
              Continue your discussions, find people, create something useful,
              or manage your account from one organized home screen.
            </p>

            {email && (
              <p className="mt-5 text-sm text-zinc-600">
                Signed in as {email}
              </p>
            )}
          </div>

          <div className="mb-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {memberCards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className={`rounded-3xl border p-6 transition hover:-translate-y-0.5 hover:border-zinc-600 ${
                  card.primary
                    ? "border-zinc-500 bg-white text-black hover:bg-zinc-200"
                    : "border-zinc-800 bg-zinc-950 text-white hover:bg-zinc-900"
                }`}
              >
                <h2 className="mb-3 text-2xl font-semibold">
                  {card.title}
                </h2>

                <p
                  className={`text-sm leading-relaxed ${
                    card.primary ? "text-zinc-700" : "text-zinc-500"
                  }`}
                >
                  {card.description}
                </p>
              </Link>
            ))}
          </div>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Platform focus
            </p>

            <h2 className="mb-3 text-2xl font-medium">
              Keep the signal high.
            </h2>

            <p className="max-w-3xl leading-relaxed text-zinc-400">
              Loombus is built for thoughtful discussion, useful contribution,
              and cleaner community dialogue. Create with purpose, reply with
              clarity, and use the safety tools when needed.
            </p>
          </section>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <section className="mx-auto flex min-h-[72vh] max-w-xl flex-col items-center justify-center text-center">
        <img
          src="/assets/brand/loombus-mark-transparent.png"
          alt=""
          className="mb-6 h-14 w-14 object-contain"
        />

        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-zinc-500">
          Loombus
        </p>

        <h1 className="mb-5 text-5xl font-semibold tracking-tight md:text-6xl">
          Signal over noise.
        </h1>

        <p className="mb-10 max-w-lg text-lg leading-relaxed text-zinc-400">
          A high-signal discussion platform for thoughtful conversations,
          sharper ideas, and cleaner community dialogue.
        </p>

        <div className="w-full rounded-3xl border border-zinc-900 bg-zinc-950/60 p-5 shadow-2xl shadow-black/30 space-y-3">
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

          <p className="pt-3 text-xs leading-relaxed text-zinc-500">
            By creating an account or continuing with Google, you agree to the{" "}
            <Link href="/terms" className="text-zinc-400 underline-offset-4 hover:underline">
              Terms
            </Link>
            ,{" "}
            <Link href="/privacy" className="text-zinc-400 underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            ,{" "}
            <Link href="/cookies" className="text-zinc-400 underline-offset-4 hover:underline">
              Cookie Use
            </Link>
            ,{" "}
            <Link href="/guidelines" className="text-zinc-400 underline-offset-4 hover:underline">
              Community Guidelines
            </Link>
            , and{" "}
            <Link href="/safety" className="text-zinc-400 underline-offset-4 hover:underline">
              Safety
            </Link>
            .
          </p>
        </div>

        {message && (
          <p className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-400">
            {message}
          </p>
        )}

        <p className="mt-7 text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="text-zinc-200 underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      <footer className="mx-auto mt-12 flex max-w-5xl flex-col items-center justify-between gap-4 border-t border-zinc-900 pt-8 text-sm text-zinc-600 md:flex-row">
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
