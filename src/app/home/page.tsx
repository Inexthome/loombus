"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import { supabase } from "@/lib/supabase/client";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { AppleLogoMark, GoogleLogoMark } from "@/components/auth-provider-icons";

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

type HomeActivationStep = {
  title: string;
  description: string;
  href: string;
  action: string;
  done: boolean;
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
  const [mobileAuthSheet, setMobileAuthSheet] = useState<"join" | "return" | null>(null);
  const [returnEmailMode, setReturnEmailMode] = useState(false);
  const [returnEmail, setReturnEmail] = useState("");
  const [returnPassword, setReturnPassword] = useState("");
  const [returnEmailLoading, setReturnEmailLoading] = useState(false);
  const [joinEmailMode, setJoinEmailMode] = useState(false);
  const [joinFullName, setJoinFullName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinDateOfBirth, setJoinDateOfBirth] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinConfirmPassword, setJoinConfirmPassword] = useState("");
  const [joinEmailLoading, setJoinEmailLoading] = useState(false);
  const [joinSignupComplete, setJoinSignupComplete] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [authoredDiscussionCount, setAuthoredDiscussionCount] = useState(0);
  const [replyCount, setReplyCount] = useState(0);
  const [stickyCount, setStickyCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
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
        setSavedCount(0);
        setAuthoredDiscussionCount(0);
        setReplyCount(0);
        setStickyCount(0);
        setFollowingCount(0);
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

          supabase
            .from("discussions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUser.id)
            .is("deleted_at", null)
            .then(
              ({ count }) => {
                if (isMounted) setAuthoredDiscussionCount(count ?? 0);
              },
              () => {
                if (isMounted) setAuthoredDiscussionCount(0);
              }
            );

          supabase
            .from("replies")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUser.id)
            .is("deleted_at", null)
            .then(
              ({ count }) => {
                if (isMounted) setReplyCount(count ?? 0);
              },
              () => {
                if (isMounted) setReplyCount(0);
              }
            );

          supabase
            .from("sticky_items")
            .select("id", { count: "exact", head: true })
            .eq("user_id", currentUser.id)
            .eq("item_type", "discussion")
            .then(
              ({ count }) => {
                if (isMounted) setStickyCount(count ?? 0);
              },
              () => {
                if (isMounted) setStickyCount(0);
              }
            );

          supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("follower_id", currentUser.id)
            .then(
              ({ count }) => {
                if (isMounted) setFollowingCount(count ?? 0);
              },
              () => {
                if (isMounted) setFollowingCount(0);
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

  async function signUpWithEmailFromHome() {
    if (joinEmailLoading) {
      return;
    }

    setMessage("");
    setJoinSignupComplete(false);

    if (joinPassword !== joinConfirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const ageBand = getAgeBandFromDateOfBirth(joinDateOfBirth);

    if (!ageBand) {
      setMessage("Enter a valid date of birth.");
      return;
    }

    if (ageBand === "under_13") {
      setMessage("Loombus is not available to members under 13.");
      return;
    }

    setJoinEmailLoading(true);

    const { error } = await supabase.auth.signUp({
      email: joinEmail,
      password: joinPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/discussions`,
        data: {
          full_name: joinFullName.trim(),
          date_of_birth: joinDateOfBirth,
        },
      },
    });

    if (error) {
      const publicMessage = error.message.toLowerCase().includes("sending confirmation email")
        ? "Loombus could not send the confirmation email. Please try Google signup or contact support if this continues."
        : error.message;

      setMessage(`Email signup error: ${publicMessage}`);
      setJoinEmailLoading(false);
      return;
    }

    setJoinSignupComplete(true);
    setJoinPassword("");
    setJoinConfirmPassword("");
    setMessage("Signup successful. Check your email to confirm your account.");
    setJoinEmailLoading(false);
  }

  async function signInWithEmailFromHome() {
    if (returnEmailLoading) {
      return;
    }

    setMessage("");
    setReturnEmailLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: returnEmail,
      password: returnPassword,
    });

    if (error) {
      setMessage(`Email sign-in error: ${error.message}`);
      setReturnEmailLoading(false);
      return;
    }

    window.location.replace("/discussions");
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
    const hasKeptUsefulDiscussion = savedCount > 0 || stickyCount > 0;
    const activationSteps: HomeActivationStep[] = [
      {
        title: "Complete your public profile",
        description: "Let people know who is contributing before you join the conversation.",
        href: "/profile",
        action: needsPublicProfileCompletion ? "Complete profile" : "View profile",
        done: !needsPublicProfileCompletion,
      },
      {
        title: "Create your first discussion",
        description: "Ask something with a topic, real-world context, and a clear purpose.",
        href: "/create",
        action: authoredDiscussionCount > 0 ? "Create another" : "Start discussion",
        done: authoredDiscussionCount > 0,
      },
      {
        title: "Reply with signal",
        description: "Add context, experience, evidence, or a useful question to someone else's thread.",
        href: "/discussions",
        action: replyCount > 0 ? "Find another thread" : "Find a discussion",
        done: replyCount > 0,
      },
      {
        title: "Keep one useful discussion",
        description: "Save or Sticky a discussion so Loombus becomes a place you return to, not just scroll through.",
        href: hasKeptUsefulDiscussion ? "/saved" : "/discussions",
        action: hasKeptUsefulDiscussion ? "Review kept ideas" : "Browse discussions",
        done: hasKeptUsefulDiscussion,
      },
      {
        title: "Follow one thoughtful contributor",
        description: "Build your signal circle around people whose replies and discussions are worth seeing again.",
        href: "/people",
        action: followingCount > 0 ? "Find more people" : "Find contributors",
        done: followingCount > 0,
      },
    ];
    const completedActivationSteps = activationSteps.filter((step) => step.done).length;
    const activationPercent = Math.round(
      (completedActivationSteps / activationSteps.length) * 100
    );

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

          <section className="mt-4 loombus-home-shell rounded-[1.75rem] border p-4 sm:mt-6 sm:rounded-[2rem] sm:p-7">
            <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[var(--loombus-text-muted)] sm:text-xs sm:tracking-[0.24em]">
                  Getting started
                </p>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  Build your first signal loop.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--loombus-text-muted)]">
                  Complete these steps so Loombus becomes useful quickly: show up clearly, contribute, keep useful ideas, and follow good signal.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]">
                <span className="font-semibold text-[var(--loombus-text)]">
                  {completedActivationSteps}/{activationSteps.length}
                </span>{" "}
                complete
              </div>
            </div>

            <div className="mb-4 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface)]">
              <div
                className="h-full rounded-full bg-[var(--loombus-primary-bg)] transition-all"
                style={{ width: `${activationPercent}%` }}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-5">
              {activationSteps.map((step, index) => (
                <Link
                  key={step.title}
                  href={step.href}
                  className="rounded-[1.35rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 transition hover:border-[var(--loombus-text-subtle)] active:scale-[0.99]"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs text-[var(--loombus-text-muted)]">
                      Step {index + 1}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        step.done
                          ? "bg-[var(--loombus-primary-bg)] text-[var(--loombus-primary-text)]"
                          : "border border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"
                      }`}
                    >
                      {step.done ? "Done" : "Next"}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold leading-snug text-[var(--loombus-text)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--loombus-text-muted)]">
                    {step.description}
                  </p>
                  <p className="mt-4 text-xs font-medium text-[var(--loombus-text)]">
                    {step.action} →
                  </p>
                </Link>
              ))}
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
            onClick={() => {
              setJoinEmailMode(false);
              setJoinSignupComplete(false);
              setMobileAuthSheet("join");
            }}
            className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Join the conversation
          </button>

          <button
            type="button"
            onClick={() => {
              setReturnEmailMode(false);
              setMobileAuthSheet("return");
            }}
            className="w-full rounded-full border border-zinc-500 bg-zinc-900/60 px-6 py-3 text-sm font-medium text-white transition hover:border-zinc-300 hover:bg-zinc-800"
          >
            Return to Loombus
          </button>

          <p className="pt-3 text-xs leading-relaxed text-zinc-500 loombus-mobile-visitor-legal">
            By creating an account or continuing with Apple, Google, or email, you confirm that you are at least 13 years old and agree to the{" "}
            <Link href="/terms" className="font-semibold text-zinc-200 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-white">Terms</Link>,{" "}
            <Link href="/privacy" className="font-semibold text-zinc-200 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-white">Privacy Policy</Link>,{" "}
            <Link href="/cookies" className="font-semibold text-zinc-200 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-white">Cookie Policy</Link>,{" "}
            <Link href="/guidelines" className="font-semibold text-zinc-200 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-white">Community Guidelines</Link>, and{" "}
            <Link href="/safety" className="font-semibold text-zinc-200 underline decoration-zinc-500 underline-offset-4 transition hover:text-white hover:decoration-white">Safety</Link>.
          </p>
        </div>

        {mobileAuthSheet ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
            <div className="w-full max-w-xl rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 text-left shadow-2xl shadow-black/50">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500">
                    {mobileAuthSheet === "join" ? "Join Loombus" : "Return to Loombus"}
                  </p>
                  <h2 className="text-2xl font-semibold tracking-tight text-white">
                    {mobileAuthSheet === "join" ? "Join the conversation." : "Welcome back."}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-500">
                    {mobileAuthSheet === "join"
                      ? "Join a calmer, higher-signal environment for thoughtful discussion."
                      : "Return to your high-signal discussion environment."}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setMobileAuthSheet(null);
                    setReturnEmailMode(false);
                    setJoinEmailMode(false);
                    setJoinSignupComplete(false);
                  }}
                  className="rounded-full border border-zinc-800 px-3 py-1 text-sm text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300"
                >
                  Close
                </button>
              </div>

              <button
                type="button"
                onClick={() => signUpWithProvider("google")}
                disabled={Boolean(workingProvider)}
                className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-700 bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <GoogleLogoMark className="h-5 w-5" />
                <span>
                  {workingProvider === "google"
                    ? "Opening Google..."
                    : mobileAuthSheet === "join"
                      ? "Sign up with Google"
                      : "Continue with Google"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => signUpWithProvider("apple")}
                disabled={Boolean(workingProvider)}
                className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-zinc-700 bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <AppleLogoMark className="h-5 w-5" />
                <span>
                  {workingProvider === "apple"
                    ? "Opening Apple..."
                    : mobileAuthSheet === "join"
                      ? "Sign up with Apple"
                      : "Continue with Apple"}
                </span>
              </button>

              {mobileAuthSheet === "join" ? (
                joinEmailMode ? (
                  joinSignupComplete ? (
                    <div className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                      <p className="text-sm font-medium text-zinc-200">
                        Check your email to confirm your account.
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        After confirming, return to Loombus and sign in.
                      </p>
                    </div>
                  ) : (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        void signUpWithEmailFromHome();
                      }}
                      className="space-y-4 rounded-2xl border border-zinc-800 bg-black/40 p-4"
                    >
                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Full name
                        </label>
                        <input
                          type="text"
                          value={joinFullName}
                          autoComplete="name"
                          required
                          onChange={(event) => setJoinFullName(event.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Email
                        </label>
                        <input
                          type="email"
                          value={joinEmail}
                          autoComplete="email"
                          required
                          onChange={(event) => setJoinEmail(event.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Date of birth
                        </label>
                        <DateOfBirthSelect
                          value={joinDateOfBirth}
                          onChange={setJoinDateOfBirth}
                          idPrefix="home-signup-date-of-birth"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Password
                        </label>
                        <input
                          type="password"
                          value={joinPassword}
                          autoComplete="new-password"
                          required
                          onChange={(event) => setJoinPassword(event.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                        />
                      </div>

                      <div>
                        <label className="mb-2 block text-sm text-zinc-400">
                          Confirm password
                        </label>
                        <input
                          type="password"
                          value={joinConfirmPassword}
                          autoComplete="new-password"
                          required
                          minLength={6}
                          onChange={(event) => setJoinConfirmPassword(event.target.value)}
                          className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={joinEmailLoading}
                        className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {joinEmailLoading ? "Creating account..." : "Sign up with email"}
                      </button>
                    </form>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => setJoinEmailMode(true)}
                    className="w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                  >
                    Sign up with email
                  </button>
                )
              ) : returnEmailMode ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void signInWithEmailFromHome();
                  }}
                  className="space-y-4 rounded-2xl border border-zinc-800 bg-black/40 p-4"
                >
                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Email
                    </label>
                    <input
                      type="email"
                      value={returnEmail}
                      autoComplete="email"
                      required
                      onChange={(event) => setReturnEmail(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm text-zinc-400">
                      Password
                    </label>
                    <input
                      type="password"
                      value={returnPassword}
                      autoComplete="current-password"
                      required
                      onChange={(event) => setReturnPassword(event.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={returnEmailLoading}
                    className="w-full rounded-full bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {returnEmailLoading ? "Signing in..." : "Sign in with email"}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setReturnEmailMode(true)}
                  className="w-full rounded-full border border-zinc-800 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-600 hover:text-white"
                >
                  Sign in with email
                </button>
              )}
            </div>
          </div>
        ) : null}

        {message && (
          <p className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm leading-relaxed text-zinc-400">
            {message}
          </p>
        )}

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
