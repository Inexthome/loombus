"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, Eye, Plus, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getAgeBandFromDateOfBirth } from "@/lib/age-safety";
import { supabase } from "@/lib/supabase/client";

type HomeProfile = {
  full_name: string | null;
  username: string | null;
};

function getFirstName(profile: HomeProfile | null, email: string | null) {
  const source =
    profile?.full_name?.trim() ||
    profile?.username?.trim() ||
    email?.split("@")[0]?.trim() ||
    "there";

  return source.split(/\s+/)[0];
}

export default function HomeSimpleClient() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<HomeProfile | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [dob, setDob] = useState("");
  const [dobConfirmed, setDobConfirmed] = useState(true);
  const [dobSaving, setDobSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadHome() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;
        const user = session?.user;

        if (!session || !user) {
          window.location.replace("/login?next=%2Fhome");
          return;
        }

        const [profileResult, sensitiveResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, username")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("profile_sensitive")
            .select("date_of_birth")
            .eq("id", user.id)
            .maybeSingle(),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (sensitiveResult.error) throw sensitiveResult.error;
        if (!mounted) return;

        const storedDob =
          typeof sensitiveResult.data?.date_of_birth === "string"
            ? sensitiveResult.data.date_of_birth
            : "";

        setEmail(user.email ?? null);
        setProfile((profileResult.data as HomeProfile | null) ?? null);
        setDob(storedDob);
        setDobConfirmed(Boolean(storedDob));
      } catch (error) {
        if (!mounted) return;
        setNotice(
          error instanceof Error
            ? error.message
            : "Home could not be loaded. Refresh and try again."
        );
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadHome();
    return () => {
      mounted = false;
    };
  }, []);

  async function confirmDob() {
    const band = getAgeBandFromDateOfBirth(dob);
    if (!band) {
      setNotice("Enter a valid date of birth.");
      return;
    }
    if (band === "under_13") {
      setNotice("This account is not eligible to use Loombus.");
      return;
    }

    setDobSaving(true);
    setNotice("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const response = token
      ? await fetch("/api/profile/age", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dateOfBirth: dob }),
        })
      : null;

    if (response?.ok) {
      setDobConfirmed(true);
      setNotice("Date of birth saved.");
    } else {
      setNotice("Unable to save date of birth.");
    }

    setDobSaving(false);
  }

  if (loading) {
    return (
      <LoombusLoadingScreen
        title="Loading Home..."
        message="Preparing your signal brief."
      />
    );
  }

  return (
    <main className="home-simple-page min-h-screen text-[var(--loombus-text)]">
      <div className="home-simple-shell">
        <header className="home-simple-header">
          <div>
            <p className="home-simple-eyebrow">Loombus Home</p>
            <h1>
              Welcome back, <span>{getFirstName(profile, email)}</span>.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
              Your signal brief, recent activity, and next useful actions in one place.
            </p>
          </div>

          <Link href="/create" className="home-simple-create">
            <Plus className="h-4 w-4" />
            Create discussion
          </Link>
        </header>

        {notice ? <div className="home-simple-notice">{notice}</div> : null}

        {!dobConfirmed ? (
          <section className="home-simple-age-gate">
            <div>
              <strong>Confirm your date of birth</strong>
              <p>This information is stored separately from your public profile.</p>
            </div>
            <DateOfBirthSelect
              value={dob}
              onChange={setDob}
              idPrefix="home-age"
              disabled={dobSaving}
              className="home-simple-dob"
              selectClassName="home-simple-select"
            />
            <button
              type="button"
              onClick={() => void confirmDob()}
              disabled={dobSaving}
            >
              {dobSaving ? "Saving..." : "Confirm date of birth"}
            </button>
          </section>
        ) : null}

        <section className="mt-8">
          <div className="mb-4">
            <p className="home-simple-eyebrow">Your signal today</p>
            <h2 className="mt-2 text-2xl font-black sm:text-3xl">
              Pick up where your ideas left off.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Link
              href="/notifications"
              className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:border-[var(--loombus-gold)]"
            >
              <Sparkles
                className="size-5 text-[var(--loombus-gold)]"
                aria-hidden="true"
              />
              <strong className="mt-5 block text-lg">Recent activity</strong>
              <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                Replies, follows, and updates waiting for your attention.
              </span>
            </Link>

            <Link
              href="/my-discussions"
              className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:border-[var(--loombus-gold)]"
            >
              <Eye
                className="size-5 text-[var(--loombus-gold)]"
                aria-hidden="true"
              />
              <strong className="mt-5 block text-lg">Your discussions</strong>
              <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                Revisit conversations you started and see what changed.
              </span>
            </Link>

            <Link
              href="/saved"
              className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 transition hover:border-[var(--loombus-gold)]"
            >
              <ChevronRight
                className="size-5 text-[var(--loombus-gold)]"
                aria-hidden="true"
              />
              <strong className="mt-5 block text-lg">Continue your signal</strong>
              <span className="mt-2 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                Return to discussions and ideas you saved for later.
              </span>
            </Link>
          </div>
        </section>

        <section className="mt-6 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] text-[var(--loombus-gold)]">
                <BarChart3 className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="home-simple-eyebrow">Private viewer insights</p>
                <h2 className="mt-2 text-xl font-black sm:text-2xl">
                  See how your signal is reaching people.
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                  Open your private analytics for discussion views, profile viewers, and member activity.
                </p>
              </div>
            </div>

            <Link
              href="/insights"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-black transition hover:opacity-90"
            >
              Open Insights
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
