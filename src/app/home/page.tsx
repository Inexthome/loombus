"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { supabase } from "@/lib/supabase/client";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";

type OAuthProvider = "google" | "apple";
type HomeAuthState = "checking" | "logged_out" | "logged_in";

type HomeProfile = {
  full_name: string | null;
  username: string | null;
  bio?: string | null;
  date_of_birth?: string | null;
};

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

function withTimeout<T>(promise: PromiseLike<T>, label: string, ms = 5000): Promise<T> {
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

export default function Home() {
  const [authState, setAuthState] = useState<HomeAuthState>("checking");
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [message, setMessage] = useState("");
  const [workingProvider, setWorkingProvider] = useState<OAuthProvider | null>(null);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [ageDateOfBirth, setAgeDateOfBirth] = useState("");
  const [ageVerificationMessage, setAgeVerificationMessage] = useState("");
  const [savingAgeVerification, setSavingAgeVerification] = useState(false);
  const [hasAgeVerification, setHasAgeVerification] = useState(false);

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
        setAgeDateOfBirth("");
        setHasAgeVerification(false);
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
        const session = await withTimeout(waitForHomeSession(), "Home session check", 7000);

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

        const metadataDateOfBirth =
          typeof currentUser.user_metadata?.date_of_birth === "string"
            ? currentUser.user_metadata.date_of_birth
            : typeof currentUser.user_metadata?.dateOfBirth === "string"
              ? currentUser.user_metadata.dateOfBirth
              : "";

        const accessToken = session?.access_token ?? "";

        if (accessToken) {
          fetch("/api/messages/unread-count", {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
              if (payload && typeof payload.unreadCount === "number") {
                setUnreadMessageCount(payload.unreadCount);
              }
            })
            .catch(() => setUnreadMessageCount(0));

          supabase
            .from("notifications")
            .select("id", { count: "exact", head: true })
            .is("read_at", null)
            .then(
              ({ count }) => {
                if (isMounted) setUnreadNotificationCount(count ?? 0);
              },
              () => {
                if (isMounted) setUnreadNotificationCount(0);
              }
            );

          supabase
            .from("bookmarks")
            .select("id", { count: "exact", head: true })
            .then(
              ({ count }) => {
                if (isMounted) setSavedCount(count ?? 0);
              },
              () => {
                if (isMounted) setSavedCount(0);
              }
            );
        }

        try {
          const { data: profileData, error: profileError } = await withTimeout(
            supabase
              .from("profiles")
              .select("full_name, username, bio, date_of_birth")
              .eq("id", currentUser.id)
              .maybeSingle(),
            "Home profile check"
          );

          if (profileError) {
            console.error("Unable to load home profile greeting.", profileError);
          }

          if (isMounted) {
            const nextProfile = (profileData ?? null) as HomeProfile | null;
            const resolvedDateOfBirth = nextProfile?.date_of_birth ?? metadataDateOfBirth;

            setProfile(nextProfile);
            setAgeDateOfBirth(resolvedDateOfBirth ?? "");
            setHasAgeVerification(Boolean(resolvedDateOfBirth));
          }

          if (!profileData?.date_of_birth && metadataDateOfBirth && accessToken) {
            const metadataAgeBand = getAgeBandFromDateOfBirth(metadataDateOfBirth);

            if (metadataAgeBand && metadataAgeBand !== "under_13") {
              fetch("/api/profile/age", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ dateOfBirth: metadataDateOfBirth }),
              }).catch(() => {
                // The prompt stays hidden from valid auth metadata even if backfill fails.
              });
            }
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

  async function handleAgeVerification() {
    if (savingAgeVerification) {
      return;
    }

    setAgeVerificationMessage("");

    const ageBand = getAgeBandFromDateOfBirth(ageDateOfBirth);

    if (!ageBand) {
      setAgeVerificationMessage("Enter a valid date of birth.");
      return;
    }

    if (ageBand === "under_13") {
      setAgeVerificationMessage("Loombus is not available to members under 13.");
      return;
    }

    setSavingAgeVerification(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/profile/age", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ dateOfBirth: ageDateOfBirth }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setAgeVerificationMessage(result.error ?? "Unable to save age verification.");
        return;
      }

      setProfile((current) => ({
        full_name: current?.full_name ?? null,
        username: current?.username ?? null,
        bio: current?.bio ?? null,
        date_of_birth: result.dateOfBirth ?? ageDateOfBirth,
      }));
      setHasAgeVerification(true);
      setAgeVerificationMessage("Age verification saved.");
    } finally {
      setSavingAgeVerification(false);
    }
  }

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
      const publicMessage = error instanceof Error ? error.message : "Unable to start OAuth signup.";
      setMessage(`${provider === "apple" ? "Apple" : "Google"} signup error: ${publicMessage}`);
      setWorkingProvider(null);
    }
  }

  if (authState === "checking") {
    return (
      <LoombusLoadingScreen
        title="Loading home..."
        message="Checking your session and preparing your workspace."
      />
    );
  }

  if (authState === "logged_in") {
    const greetingName = getGreetingName(profile, email);
    const displayName = greetingName || "there";
    const totalAttentionCount = unreadMessageCount + unreadNotificationCount + savedCount;
    const needsAgeVerification = !hasAgeVerification;
    const publicProfileGate = validatePublicProfileCompletion({
      fullName: profile?.full_name ?? null,
      username: profile?.username ?? null,
      bio: profile?.bio ?? null,
    });
    const needsPublicProfileCompletion = !publicProfileGate.ok;

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
        action: unreadNotificationCount > 0 ? "Review notifications" : "View notifications",
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
      <main className="loombus-home-canvas min-h-screen px-3 py-4 pb-28 text-[var(--loombus-text)] sm:px-6 lg:py-12">
        <div className="mx-auto max-w-5xl">
          <section className="loombus-home-shell loombus-home-hero-shell rounded-[1.75rem] border p-4 shadow-2xl sm:rounded-[2rem] sm:p-8 lg:p-10">
            <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.22em] text-[var(--loombus-text-muted)] sm:mb-3 sm:text-sm sm:tracking-[0.3em]">
              Loombus Signal Brief
            </p>

            <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:items-stretch">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
                  Welcome back, {displayName}.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--loombus-text-muted)] sm:mt-4 sm:text-lg">
                  Here is what needs attention across your Loombus activity.
                </p>
              </div>

              <div className="rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 sm:rounded-[1.5rem] sm:p-4">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-[var(--loombus-text-muted)] sm:text-xs">
                  Today’s quote
                </p>
                <p className="mt-2 text-base font-medium leading-relaxed sm:mt-3 sm:text-lg">
                  “Create more signal than noise.”
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--loombus-text-muted)] sm:mt-3 sm:text-sm">
                  A useful contribution makes the next person think more clearly.
                </p>
              </div>
            </div>
          </section>

          {needsPublicProfileCompletion && (
            <section className="mt-4 loombus-home-shell rounded-[1.75rem] border border-amber-500/30 p-4 sm:mt-6 sm:rounded-[2rem] sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-muted)] sm:text-xs">
                    Public identity required
                  </p>
                  <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                    Complete your public profile before joining discussions.
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                    {publicProfileGate.message} You can browse Loombus, but posting and replying require a complete public identity.
                  </p>
                </div>
                <Link
                  href="/profile"
                  className="inline-flex w-full items-center justify-center rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90 sm:w-auto"
                >
                  Complete profile
                </Link>
              </div>
            </section>
          )}

          {needsAgeVerification && (
            <section className="mt-4 loombus-home-shell rounded-[1.75rem] border p-4 sm:mt-6 sm:rounded-[2rem] sm:p-7">
              <div className="mb-4">
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-muted)] sm:text-xs">
                  Age verification
                </p>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Confirm your age to continue safely.
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                  Choose your month, day, and year. This helps Loombus apply the right safety protections.
                </p>
              </div>

              <DateOfBirthSelect
                value={ageDateOfBirth}
                onChange={setAgeDateOfBirth}
                idPrefix="home-age-verification"
                disabled={savingAgeVerification}
                className="grid gap-3 sm:grid-cols-3"
                selectClassName="w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-[var(--loombus-text)] outline-none focus:border-[var(--loombus-text-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={handleAgeVerification}
                disabled={savingAgeVerification}
                className="mt-4 w-full rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {savingAgeVerification ? "Saving..." : "Confirm age"}
              </button>

              {ageVerificationMessage && (
                <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
                  {ageVerificationMessage}
                </p>
              )}
            </section>
          )}

          <section className="mt-4 loombus-home-shell rounded-[1.75rem] border p-4 sm:mt-6 sm:rounded-[2rem] sm:p-7">
            <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-muted)] sm:text-xs sm:tracking-[0.24em]">
                  Needs attention
                </p>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {totalAttentionCount > 0
                    ? `${totalAttentionCount.toLocaleString()} item${totalAttentionCount === 1 ? "" : "s"} waiting on you.`
                    : "Nothing urgent is waiting right now."}
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                Live activity summary
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {needsAttentionCards.map((card) => (
                <Link
                  key={card.title}
                  href={card.href}
                  className={`loombus-home-status-card rounded-[1.35rem] border p-4 transition active:scale-[0.99] sm:rounded-[1.5rem] sm:p-5 ${
                    card.urgent ? "loombus-home-primary-tile" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[var(--loombus-text-muted)]">
                        {card.title}
                      </p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight sm:mt-2 sm:text-3xl">
                        {card.value}
                      </p>
                    </div>
                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)]">
                      {card.urgent ? "New" : "Clear"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--loombus-text-muted)] sm:mt-4">
                    {card.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-4 loombus-home-shell rounded-[1.75rem] border p-4 sm:mt-6 sm:rounded-[2rem] sm:p-7">
            <div className="mb-4 sm:mb-5">
              <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-muted)] sm:text-xs sm:tracking-[0.24em]">
                Loombus updates
              </p>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
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
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 text-sm leading-relaxed text-[var(--loombus-text-muted)] sm:p-4"
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
          A high-signal discussion platform for thoughtful conversations, sharper ideas, and cleaner community dialogue.
        </p>

        <div className="w-full rounded-3xl border border-zinc-900 bg-zinc-950/60 p-5 shadow-2xl shadow-black/30 space-y-3 loombus-mobile-visitor-auth-card">
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
          <p className="pt-3 text-xs leading-relaxed text-zinc-500 loombus-mobile-visitor-legal">
            By creating an account or continuing with Apple, Google, or email, you confirm that you are at least 13 years old and agree to the{" "}
            <Link href="/terms" className="text-zinc-400 underline-offset-4 hover:underline">Terms</Link>,{" "}
            <Link href="/privacy" className="text-zinc-400 underline-offset-4 hover:underline">Privacy Policy</Link>,{" "}
            <Link href="/cookies" className="text-zinc-400 underline-offset-4 hover:underline">Cookie Use</Link>,{" "}
            <Link href="/guidelines" className="text-zinc-400 underline-offset-4 hover:underline">Community Guidelines</Link>, and{" "}
            <Link href="/safety" className="text-zinc-400 underline-offset-4 hover:underline">Safety</Link>.
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
          <Link href="/about" className="transition hover:text-zinc-300">About</Link>
          <Link href="/guidelines" className="transition hover:text-zinc-300">Guidelines</Link>
          <Link href="/safety" className="transition hover:text-zinc-300">Safety</Link>
          <Link href="/terms" className="transition hover:text-zinc-300">Terms</Link>
          <Link href="/privacy" className="transition hover:text-zinc-300">Privacy</Link>
          <Link href="/cookies" className="transition hover:text-zinc-300">Cookies</Link>
          <Link href="/accessibility" className="transition hover:text-zinc-300">Accessibility</Link>
          <Link href="/contact" className="transition hover:text-zinc-300">Contact</Link>
        </nav>
      </footer>
    </main>
  );
}
