"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { calculateFloorCredibility, type CredibilityThesis } from "@/lib/floor-credibility";
import { floorDisplayName } from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Award, BarChart3, Building2, CalendarDays, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type AnalystThesis = CredibilityThesis & {
  id: string;
  stance: "long" | "short" | "neutral";
};

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Established";
  if (score >= 50) return "Developing";
  return "Emerging";
}

function Metric({ label, value, explanation }: { label: string; value: number; explanation: string }) {
  return (
    <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-[var(--loombus-text)]">{label}</p>
        <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-sm font-black text-[var(--loombus-gold)]">
          {value}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]">
        <div className="h-full rounded-full bg-[var(--loombus-gold)]" style={{ width: `${value}%` }} />
      </div>
      <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-muted)]">{explanation}</p>
    </div>
  );
}

export default function TheFloorAnalystPage({ memberId }: { memberId: string }) {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theses, setTheses] = useState<AnalystThesis[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/the-floor/analyst/${memberId}`)}`);
        return;
      }

      const [{ data: profileData }, { data: thesisData }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name").eq("id", memberId).maybeSingle(),
        supabase
          .from("floor_theses")
          .select(
            "id, ticker, stance, conviction, entry_zone_low, entry_zone_high, exit_plan, thesis, catalysts, risks, created_at, floor_calls(status, outcome, created_at, resolves_by)"
          )
          .eq("author_id", memberId)
          .order("created_at", { ascending: false })
          .limit(250),
      ]);

      if (!mounted) return;
      setProfile((profileData as Profile | null) ?? null);
      setTheses((thesisData as AnalystThesis[] | null) ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const credibility = useMemo(() => calculateFloorCredibility(theses), [theses]);
  const coverage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const thesis of theses) counts.set(thesis.ticker, (counts.get(thesis.ticker) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [theses]);

  if (loading) {
    return <LoombusLoadingScreen title="Loading analyst profile..." message="Computing an explainable research track record." />;
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-3xl rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
          <h1 className="text-2xl font-black">Analyst not found</h1>
          <Link href="/the-floor/leaderboard" className="mt-4 inline-flex text-sm font-black text-[var(--loombus-gold)]">Return to leaderboard</Link>
        </div>
      </main>
    );
  }

  const displayName = floorDisplayName(profile.full_name, profile.username);
  const oldest = theses.length ? theses[theses.length - 1].created_at : null;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor/leaderboard" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]">
            <ArrowLeft className="size-3.5" /> Back to leaderboard
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Floor analyst</p>
              <h1 className="mt-1 text-3xl font-black">{displayName}</h1>
              <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-[var(--loombus-text-muted)]">
                <span>{theses.length} theses</span>
                <span>{coverage.length} companies covered</span>
                {oldest ? <span>Active since {new Date(oldest).toLocaleDateString()}</span> : null}
              </div>
            </div>
            <div className="min-w-40 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Overall credibility</p>
              <p className="mt-1 text-5xl font-black text-[var(--loombus-gold)]">{credibility.overall}</p>
              <p className="mt-1 text-sm font-black">{credibility.confidence}</p>
            </div>
          </div>
        </header>

        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[var(--loombus-gold)]" />
            <h2 className="text-xl font-black">Credibility breakdown</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            This score is computed from published work and resolved outcomes. It cannot be purchased or manually edited, and it is not a rating of any security.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Metric label="Accuracy" value={credibility.accuracy} explanation="Correct resolved calls as a share of correct plus incorrect -- the same formula as the leaderboard." />
            <Metric label="Transparency" value={credibility.transparency} explanation="Entry zones, exit plans, catalysts, risks, and falsifiable calls disclosed before outcomes." />
            <Metric label="Consistency" value={credibility.consistency} explanation="Sustained publishing across time rather than isolated bursts of activity." />
            <Metric label="Research depth" value={credibility.researchDepth} explanation="Completeness of the thesis, supporting factors, risks, and decision framework." />
            <Metric label="Accountability" value={credibility.accountability} explanation="Use of falsifiable calls and the share of those calls that reached a recorded resolution." />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><BarChart3 className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-xl font-black">Track record</h2></div>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Resolved", credibility.resolvedCalls],
                ["Correct", credibility.correctCalls],
                ["Partial", credibility.partialCalls],
                ["Incorrect", credibility.incorrectCalls],
                ["Pending", credibility.pendingCalls],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{label}</p></div>
              ))}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><Building2 className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-xl font-black">Coverage</h2></div>
            {coverage.length ? (
              <div className="mt-5 space-y-3">
                {coverage.slice(0, 10).map(([ticker, count]) => (
                  <Link key={ticker} href={`/the-floor/company/${encodeURIComponent(ticker)}`} className="flex items-center justify-between rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 hover:border-[var(--loombus-gold)]">
                    <span className="font-black">{ticker}</span><span className="text-xs font-bold text-[var(--loombus-text-muted)]">{count} {count === 1 ? "thesis" : "theses"}</span>
                  </Link>
                ))}
              </div>
            ) : <p className="mt-5 text-sm text-[var(--loombus-text-muted)]">No company coverage yet.</p>}
          </section>
        </div>

        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex items-center gap-2"><CalendarDays className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-xl font-black">Research timeline</h2></div>
          {theses.length ? (
            <div className="mt-5 space-y-3">
              {theses.slice(0, 30).map((thesis) => (
                <div key={thesis.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black"><Link href={`/the-floor/company/${encodeURIComponent(thesis.ticker)}`} className="text-[var(--loombus-gold)]">{thesis.ticker}</Link><span className="capitalize text-[var(--loombus-text-muted)]">{thesis.stance}</span><span className="ml-auto text-[var(--loombus-text-subtle)]">{new Date(thesis.created_at).toLocaleDateString()}</span></div>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text)]">{thesis.thesis}</p>
                </div>
              ))}
            </div>
          ) : <div className="mt-5 flex items-center gap-2 text-sm text-[var(--loombus-text-muted)]"><Award className="size-4" /> Credibility begins when accountable research is published.</div>}
        </section>
      </div>
    </main>
  );
}
