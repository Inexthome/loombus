"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { isIosNativeApp } from "@/lib/native-app";

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
        title: "Messages",
        description: "Open private conversations with mutual followers.",
        href: "/messages",
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

const mobileSignalShortcuts = [
  {
    title: "Setup Guide",
    description: "Learn how to use Loombus.",
    href: "/onboarding",
  },
  {
    title: "My Activity",
    description: "Review your recent Loombus activity.",
    href: "/my-activity",
  },
  {
    title: "My Discussions",
    description: "Return to discussions you started.",
    href: "/my-discussions",
  },
  {
    title: "Reading History",
    description: "Revisit what you opened.",
    href: "/reading-history",
  },
];

export default function Home() {
  const [authState, setAuthState] = useState<HomeAuthState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [message, setMessage] = useState("");
  const [workingProvider, setWorkingProvider] = useState<OAuthProvider | null>(null);
  const [nativeIosApp, setNativeIosApp] = useState(false);

  useEffect(() => {
    setNativeIosApp(isIosNativeApp());
  }, []);
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

        if (!isMounted) {
          return;
        }

        setProfile((profileData ?? null) as HomeProfile | null);
        setAuthState("logged_in");
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
    if (nativeIosApp || isIosNativeApp()) {
      setMessage("Use email and password to create an account inside the Loombus iOS app. Apple and Google signup remain available on the web.");
      return;
    }

    if (workingProvider) {
      return;
    }

    setMessage("");
    setWorkingProvider(provider);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/home`,
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

    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:py-12">
        <div className="mx-auto max-w-6xl">
          <section className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8 lg:p-10">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Loombus Home
            </p>

            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {greetingName ? `Welcome back, ${greetingName}.` : "Welcome back."}
            </h1>

            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-400">
              Return to your discussions, messages, saved items, and account tools from one place.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Link
                href="/messages"
                className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-600"
              >
                <p className="text-sm text-zinc-500">Messages</p>
                <p className="mt-2 text-3xl font-semibold">{unreadMessageCount}</p>
                <p className="mt-1 text-sm text-zinc-500">unread</p>
              </Link>

              <Link
                href="/notifications"
                className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-600"
              >
                <p className="text-sm text-zinc-500">Notifications</p>
                <p className="mt-2 text-3xl font-semibold">{unreadNotificationCount}</p>
                <p className="mt-1 text-sm text-zinc-500">unread</p>
              </Link>

              <Link
                href="/saved"
                className="rounded-2xl border border-zinc-800 bg-black p-5 transition hover:border-zinc-600"
              >
                <p className="text-sm text-zinc-500">Saved</p>
                <p className="mt-2 text-3xl font-semibold">{savedCount}</p>
                <p className="mt-1 text-sm text-zinc-500">items</p>
              </Link>
            </div>
          </section>

          <div className="mt-8 grid gap-6">
            {memberSections.map((section) => (
              <section
                key={section.heading}
                className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 sm:p-8"
              >
                <div className="mb-5">
                  <h2 className="text-2xl font-semibold tracking-tight">
                    {section.heading}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {section.description}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  {section.cards.map((card) => (
                    <Link
                      key={card.href}
                      href={card.href}
                      className={`rounded-2xl border p-5 transition ${
                        card.primary
                          ? "border-white bg-white text-black hover:bg-zinc-200"
                          : "border-zinc-800 bg-black text-white hover:border-zinc-600"
                      }`}
                    >
                      <h3 className="text-lg font-semibold">{card.title}</h3>
                      <p className={`mt-2 text-sm leading-relaxed ${
                        card.primary ? "text-zinc-700" : "text-zinc-500"
                      }`}>
                        {card.description}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-8 rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 sm:p-8 md:hidden">
            <h2 className="text-2xl font-semibold tracking-tight">
              Quick shortcuts
            </h2>

            <div className="mt-5 grid gap-3">
              {mobileSignalShortcuts.map((shortcut) => (
                <Link
                  key={shortcut.href}
                  href={shortcut.href}
                  className="rounded-2xl border border-zinc-800 bg-black p-4 transition hover:border-zinc-600"
                >
                  <p className="font-semibold">{shortcut.title}</p>
                  <p className="mt-1 text-sm text-zinc-500">{shortcut.description}</p>
                </Link>
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
          {nativeIosApp ? (
            <>
              <Link
                href="/signup"
                className="block w-full rounded-full border border-zinc-700 bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 loombus-mobile-visitor-create"
              >
                Sign up with email
              </Link>

              <p className="text-xs leading-relaxed text-zinc-500">
                Use email and password to create an account inside the Loombus iOS app.
              </p>
            </>
          ) : (
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
          )}

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
