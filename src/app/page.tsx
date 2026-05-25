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

const memberSections = [
  {
    heading: "Create and read",
    description: "Start new discussions, browse the feed, or catch up on people you follow.",
    cards: [
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
        title: "Following",
        description: "See discussions from people you follow.",
        href: "/following",
      },
    ],
  },
  {
    heading: "Community",
    description: "Find people, review notifications, and return to saved discussions.",
    cards: [
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
        title: "Saved",
        description: "Return to discussions you saved.",
        href: "/saved",
      },
    ],
  },
  {
    heading: "Your account",
    description: "Manage your activity, profile, settings, and subscription tools.",
    cards: [
      {
        title: "Dashboard",
        description: "View your profile status, subscription, and activity summary.",
        href: "/dashboard",
      },
      {
        title: "My Activity",
        description: "View your discussions, replies, saves, and notifications.",
        href: "/my-activity",
      },
      {
        title: "Profile",
        description: "Edit your public profile and member identity.",
        href: "/profile",
      },
      {
        title: "Settings",
        description: "Manage your account, profile, and platform tools.",
        href: "/settings",
      },
      {
        title: "Premium",
        description: "Review subscription features and AI-assisted tools.",
        href: "/premium",
      },
    ],
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
    const ageConfirmed = window.confirm(
      "Loombus is not available to children under 13. Please confirm that you are at least 13 years old to create an account."
    );

    if (!ageConfirmed) {
      setMessage("You must confirm that you are at least 13 years old to create a Loombus account.");
      return;
    }

    setWorkingProvider(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
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
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
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
      <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
        <section className="mx-auto max-w-6xl">
          <div className="md:hidden">
            {/* Mobile Signal Hub */}
            <section className="mb-5 rounded-[2rem] border border-zinc-800 bg-gradient-to-b from-zinc-950 to-black p-5 shadow-2xl shadow-black/40">
              <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500">
                Signal Hub
              </p>

              <h1 className="mb-3 text-3xl font-semibold tracking-tight">
                What matters now.
              </h1>

              <p className="text-sm leading-relaxed text-zinc-500">
                Create, read, reply, and return to the highest-signal parts of Loombus.
              </p>

              {email && (
                <p className="mt-4 truncate text-xs text-zinc-700">
                  {email}
                </p>
              )}
            </section>

            <section className="mb-5">
              <Link
                href="/create"
                className="block rounded-[1.75rem] border border-zinc-500 bg-white p-5 text-black shadow-2xl shadow-black/30 active:scale-[0.99]"
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600">
                  Start signal
                </p>

                <h2 className="text-2xl font-semibold tracking-tight">
                  Create a discussion
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-zinc-700">
                  Turn a clear thought, question, or claim into a focused thread.
                </p>
              </Link>
            </section>

            <section className="mb-5 grid grid-cols-2 gap-3">
              <Link
                href="/discussions"
                className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Read
                </p>
                <h2 className="text-lg font-semibold">Discussions</h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Browse focused conversations.
                </p>
              </Link>

              <Link
                href="/notifications"
                className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Return
                </p>
                <h2 className="text-lg font-semibold">Alerts</h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  See replies, follows, and mentions.
                </p>
              </Link>

              <Link
                href="/following"
                className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  People
                </p>
                <h2 className="text-lg font-semibold">Following</h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Follow selective signal.
                </p>
              </Link>

              <Link
                href="/saved"
                className="rounded-[1.5rem] border border-zinc-800 bg-zinc-950 p-4 active:scale-[0.99]"
              >
                <p className="mb-2 text-xs uppercase tracking-[0.18em] text-zinc-600">
                  Memory
                </p>
                <h2 className="text-lg font-semibold">Saved</h2>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Revisit what is worth keeping.
                </p>
              </Link>
            </section>

            <section className="mb-5 rounded-[1.75rem] border border-zinc-800 bg-zinc-950/70 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-zinc-600">
                    Today’s direction
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">
                    More signal. Less drift.
                  </h2>
                </div>

                <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                  v1
                </span>
              </div>

              <div className="grid gap-2">
                <Link
                  href="/dashboard"
                  className="rounded-2xl border border-zinc-900 bg-black p-3 text-sm text-zinc-300"
                >
                  Dashboard → account, plan, and activity status
                </Link>

                <Link
                  href="/profile"
                  className="rounded-2xl border border-zinc-900 bg-black p-3 text-sm text-zinc-300"
                >
                  Profile → public identity and notification comfort
                </Link>

                <Link
                  href="/settings"
                  className="rounded-2xl border border-zinc-900 bg-black p-3 text-sm text-zinc-300"
                >
                  Settings → account, legal, safety, and platform controls
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-xs uppercase tracking-[0.2em] text-zinc-600">
                Loombus principle
              </p>

              <p className="text-sm leading-relaxed text-zinc-400">
                The goal is not endless scrolling. The goal is cleaner thinking,
                better replies, and conversations worth returning to.
              </p>
            </section>
          </div>

          <div className="hidden md:block">
          <div className="mb-7 sm:mb-10">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500 sm:text-sm sm:tracking-[0.35em]">
              Member Home
            </p>

            <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
              Welcome back to Loombus.
            </h1>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Continue your discussions, find people, create something useful,
              or manage your account from one organized home screen.
            </p>

            {email && (
              <p className="mt-4 text-sm text-zinc-600 sm:mt-5">
                Signed in as {email}
              </p>
            )}
          </div>

          <div className="mb-8 space-y-5 sm:mb-10 sm:space-y-8">
            {memberSections.map((section) => (
              <section
                key={section.heading}
                className="rounded-3xl border border-zinc-900 bg-zinc-950/40 p-4 sm:p-5"
              >
                <div className="mb-4 sm:mb-5">
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    {section.heading}
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-500">
                    {section.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                  {section.cards.map((card) => (
                    <Link
                      key={card.href}
                      href={card.href}
                      className={`rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:border-zinc-600 sm:p-6 ${
                        card.primary
                          ? "border-zinc-500 bg-white text-black hover:bg-zinc-200"
                          : "border-zinc-800 bg-black/40 text-white hover:bg-zinc-900"
                      }`}
                    >
                      <h3 className="mb-2 text-lg font-semibold sm:mb-3 sm:text-xl">
                        {card.title}
                      </h3>

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
              </section>
            ))}
          </div>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Platform focus
            </p>

            <h2 className="mb-3 text-xl font-medium sm:text-2xl">
              Keep the signal high.
            </h2>

            <p className="max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
              Loombus is built for thoughtful discussion, useful contribution,
              and cleaner community dialogue. Create with purpose, reply with
              clarity, and use the safety tools when needed.
            </p>
          </section>
          </div>

        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-6 text-white sm:px-6 sm:py-12 lg:py-16">
      <section className="mx-auto flex min-h-[72vh] max-w-xl flex-col items-center justify-center text-center">
        <img
          src="/assets/brand/loombus-mark-transparent.png"
          alt=""
          className="mb-6 h-14 w-14 object-contain"
        />

        <p className="mb-3 text-xs uppercase tracking-[0.24em] text-zinc-500 sm:text-sm sm:tracking-[0.35em]">
          Loombus
        </p>

        <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-6xl">
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
            By creating an account or continuing with Google, you confirm that you are at least 13 years old and agree to the{" "}
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
