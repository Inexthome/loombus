"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { DateOfBirthSelect } from "@/components/date-of-birth-select";
import { DiscussionViewerInsights } from "@/components/discussion-viewer-insights";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { ProfileViewersPanel } from "@/components/profile-viewers-panel";
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
        setNotice(error instanceof Error ? error.message : "Home could not be loaded. Refresh and try again.");
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
    return <LoombusLoadingScreen title="Loading Home..." message="Preparing your private insights." />;
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
            <button type="button" onClick={() => void confirmDob()} disabled={dobSaving}>
              {dobSaving ? "Saving..." : "Confirm date of birth"}
            </button>
          </section>
        ) : null}

        <section id="insights" className="home-simple-insights" aria-labelledby="home-insights-title">
          <div className="home-simple-insights-heading">
            <p>Insights</p>
            <h2 id="home-insights-title">Your private viewer insights.</h2>
            <span>See who is viewing your discussions and profile.</span>
          </div>

          <DiscussionViewerInsights />
          <ProfileViewersPanel />
        </section>
      </div>
    </main>
  );
}
