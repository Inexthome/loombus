"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type OAuthProvider = "google" | "apple";
type HomeAuthState = "checking" | "logged_out" | "logged_in";

type HomeProfile = {
  full_name: string | null;
  username: string | null;
};

function getGreetingName(profile: HomeProfile | null, email: string | null) {
  const profileName = profile?.full_name?.trim() || profile?.username?.trim();

  if (profileName) {
    return profileName.split(/\s+/)[0];
  }

  if (email) {
    const emailName = email.split("@")[0]?.trim();

    if (emailName) {
      return emailName;
    }
  }

  return "";
}

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

async function waitForHomeSession(maxAttempts = 20) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data } = await supabase.auth.getSession();

    if (data.session) {
      return data.session;
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return null;
}

type HomeSignalCard = {
  title: string;
  value: string;
  description: string;
  href: string;
  action: string;
  urgent?: boolean;
};

const loombusUpdates = [
  "Discussions are now the main post-login destination.",
  "Create composer tools were simplified into a compact action row.",
  "Settings was cleaned up so controls and reference links are easier to find.",
];

export default function Home() {
  const [authState, setAuthState] = useState<HomeAuthState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [message, setMessage] = useState("");
  const [workingProvider, setWorkingProvider] = useState<OAuthProvider | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setAuthState("logged_in");
      } else {
        setEmail(null);
        setProfile(null);
        setAuthState("logged_out");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // loombus:home-auth-listener

  useEffect(() => {
    let isMounted = true;

    async function checkAuthState() {
      try {
        const session = await withTimeout(
          waitForHomeSession(),
          "Home session check",
          7000
        );

        if (!isMounted) {
          return;
        }

        const currentUser = session?.user ?? null;

        if (!currentUser) {
          setEmail(null);
          setProfile(null);
          setAuthState("logged_out");
          return;
        }

        setEmail(currentUser.email ?? null);
        setAuthState("logged_in");

        const accessToken = session?.access_token ?? "";

        if (accessToken) {
          fetch("/api/messages/unread-count", {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })
            .then((response) => response.ok ? response.json() : null)
            .then((payload) => {
              if (payload && typeof payload.unreadCount === "number") {
                setUnreadMessageCount(payload.unreadCount);
              }
            })
            .catch(() => {
              setUnreadMessageCount(0);
            });

          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .then(
              ({ count }) => {
                if (isMounted) {
                  setUnreadNotificationCount(count ?? 0);
                }
              },
              () => {
                if (isMounted) {
                  setUnreadNotificationCount(0);
                }
              }
            );

          supabase
            .from("bookmarks")
            .select("id", { count: "exact", head: true })
            .then(
              ({ count }) => {
                if (isMounted) {
                  setSavedCount(count ?? 0);
                }
              },
              () => {
                if (isMounted) {
                  setSavedCount(0);
                }
              }
            );
        }

        try {
          const { data: profileData, error: profileError } = await withTimeout(
            supabase
              .from("profiles")
              .select("full_name, username")
              .eq("id", currentUser.id)
              .maybeSingle(),
            "Home profile check"
          );

          if (profileError) {
            console.error("Unable to load home profile greeting.", profileError);
          }

          if (isMounted) {
            setProfile((profileData ?? null) as HomeProfile | null);
          }
        } catch (profileError) {
          console.error("Unable to load home profile greeting.", profileError);
        }
      } catch (error) {
        console.error("Unable to check home authentication state.", error);

        if (isMounted) {
          setEmail(null);
          setProfile(null);
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
    if (workingProvider) {
      return;
    }

    setMessage("");
    setWorkingProvider(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/discussions`,
        },
      });

      if (error) {
        setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${error.message}`);
        setWorkingProvider(null);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to start OAuth signup.";
      setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${message}`);
      setWorkingProvider(null);
    }
  }

  if (authState === "checking") {
    return (
      <main className="min-h-screen bg-black px-4 py-16 text-white sm:px-6">
        <div className="mx-auto max-w-5xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            Loombus
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">
            Loading home...
          </h1>
          <p className="mt-4 text-zinc-500">
            Checking your session and preparing your workspace.
          </p>
        </div>
      </main>
    );
  }

  if (authState === "logged_in") {
    const greetingName = getGreetingName(profile, email);
    const displayName = greetingName || "there";
    const totalAttentionCount =
      unreadMessageCount + unreadNotificationCount + savedCount;

    const needsAttentionCards: HomeSignalCard[] = [
      {
        title: "Messages",
        value: unreadMessageCount.toLocaleString(),
        description:
          unreadMessageCount > 0
            ? "Private conversations are waiting for you."
            : "No unread private messages right now.",
        href: "/messages",
        action: unreadMessageCount > 0 ? "Open messages" : "View messages",
        urgent: unreadMessageCount > 0,
      },
      {
        title: "Notifications",
        value: unreadNotificationCount.toLocaleString(),
        description:
          unreadNotificationCount > 0
            ? "Replies, follows, and platform activity need review."
            : "No unread alerts right now.",
        href: "/notifications",
        action:
          unreadNotificationCount > 0
            ? "Review notifications"
            : "View notifications",
        urgent: unreadNotificationCount > 0,
      },
      {
        title: "Saved",
        value: savedCount.toLocaleString(),
        description:
          savedCount > 0
            ? "Return to discussions you marked as worth keeping."
            : "Save useful discussions to build your personal signal shelf.",
        href: "/saved",
        action: savedCount > 0 ? "Review saved" : "Browse discussions",
        urgent: savedCount > 0,
      },
    ];

    return (
      <main className="loombus-home-canvas min-h-screen px-4 py-6 text-[var(--loombus-text)] sm:px-6 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <section className="loombus-home-shell loombus-home-hero-shell rounded-[2rem] border p-5 shadow-2xl sm:p-8 lg:p-10">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.26em] text-[var(--loombus-text-muted)] sm:text-sm sm:tracking-[0.3em]">
              Loombus Signal Brief
            </p>

            <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  Welcome back, {displayName}.
                </h1>

                <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--loombus-text-muted)] sm:text-lg">
                  Here is what needs attention across your Loombus activity.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-muted)]">
                  Today’s quote
                </p>

                <p className="mt-3 text-lg font-medium leading-relaxed">
                  “Create more signal than noise.”
                </p>

                <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                  A useful contribution is one that makes the next person think more clearly.
                </p>
              </div>
            </div>
          </section>

          <section className="mt-6 loombus-home-shell rounded-[2rem] border p-5 sm:p-7">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--loombus-text-muted)]">
                  Needs attention
                </p>

                <h2 className="text-2xl font-semibold tracking-tight">
                  {totalAttentionCount > 0
                    ? `${totalAttentionCount.toLocaleString()} item${totalAttentionCount === 1 ? "" : "s"} waiting on you.`
                    : "Nothing urgent is waiting right now."}
                </h2>
              </div>

              <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                Live activity summary
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {needsAttentionCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className={`loombus-home-status-card rounded-[1.5rem] border p-5 transition active:scale-[0.99] ${
                    card.urgent ? "loombus-home-primary-tile" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--loombus-text-muted)]">
                        {card.title}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">
                        {card.value}
                      </p>
                    </div>

                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)]">
                      {card.urgent ? "New" : "Clear"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-6 loombus-home-shell rounded-[2rem] border p-5 sm:p-7">
            <div className="mb-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--loombus-text-muted)]">
                Loombus updates
              </p>

              <h2 className="text-2xl font-semibold tracking-tight">
                What changed recently.
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                Platform notes and product changes will live here as Loombus grows.
              </p>
            </div>

            <div className="grid gap-3">
              {loombusUpdates.map((update) => (
                <div
                  key={update}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm leading-relaxed text-[var(--loombus-text-muted)]"
                >
                  {update}
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    );
  }

  // loombus-authenticated-home-render

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

        <div className="w-full rounded-3xl border border-zinc-900 bg-zinc-950/60 p-5 shadow-2xl shadow-black/30 space-y-3 loombus-mobile-visitor-auth-card">
          <>
            <button
              type="button"
              onClick={() => signUpWithProvider("apple")}
              disabled={Boolean(workingProvider)}
              className="w-full rounded-full border border-zinc-700 bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {workingProvider === "apple" ? "Opening Apple..." : "Sign up with Apple"}
            </button>

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
              className="block w-full rounded-full border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-white loombus-mobile-visitor-create"
            >
              Create Account
            </Link>
          </>

          <p className="pt-3 text-xs leading-relaxed text-zinc-500 loombus-mobile-visitor-legal">
            By creating an account or continuing with Apple, Google, or email, you confirm that you are at least 13 years old and agree to the{" "}
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

        <p className="mt-7 text-sm text-zinc-500 loombus-mobile-visitor-existing">
          Already have an account?{" "}
          <Link href="/login" className="text-zinc-200 underline-offset-4 hover:underline loombus-mobile-visitor-signin">
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
