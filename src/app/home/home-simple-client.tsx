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

  const homeRows = [
    {
      href: "/notifications",
      title: "Recent activity",
      detail: "Replies, follows, and updates waiting for your attention.",
      icon: Sparkles,
    },
    {
      href: "/my-discussions",
      title: "Your discussions",
      detail: "Revisit conversations you started and see what changed.",
      icon: Eye,
    },
    {
      href: "/saved",
      title: "Continue your signal",
      detail: "Return to discussions and ideas you saved for later.",
      icon: ChevronRight,
    },
  ];

  return (
    <main className="home-simple-page min-h-screen text-[var(--loombus-text)]">
      <div className="home-simple-shell">
        <header className="home-simple-header">
          <div>
            <p className="home-simple-eyebrow">Loombus Home</p>
            <h1>
              Welcome back, <span>{getFirstName(profile, email)}</span>.
            </h1>
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

        <section className="mt-10" aria-labelledby="home-signal-title">
          <div className="border-b border-[var(--loombus-border)] pb-4">
            <p className="home-simple-eyebrow">Your signal today</p>
            <h2 id="home-signal-title" className="mt-2 text-2xl font-black sm:text-3xl">
              Pick up where your ideas left off.
            </h2>
          </div>

          <div>
            {homeRows.map(({ href, title, detail, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-center gap-4 border-b border-[var(--loombus-border)] py-5 transition"
              >
                <Icon
                  className="size-5 shrink-0 text-[var(--loombus-gold)]"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <strong className="block text-base font-black">{title}</strong>
                  <span className="mt-1 block text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {detail}
                  </span>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--loombus-text-subtle)] transition group-hover:translate-x-0.5 group-hover:text-[var(--loombus-gold)]"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10" aria-labelledby="home-insights-title">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--loombus-border)] pb-4">
            <div>
              <p className="home-simple-eyebrow">Private viewer insights</p>
              <h2 id="home-insights-title" className="mt-2 text-2xl font-black sm:text-3xl">
                Understand your signal.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Discussion views, profile viewers, and member activity live in one private analytics workspace.
              </p>
            </div>
            <Link
              href="/insights"
              className="inline-flex items-center gap-2 py-2 text-sm font-black text-[var(--loombus-gold)]"
            >
              Open Insights
              <BarChart3 className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
