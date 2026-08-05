"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import {
  FLOOR_CONVICTION_PROBABILITY,
  floorCalibrationFromBucketCounts,
  floorCalibrationVerdictCopy,
  type FloorCalibrationResult,
} from "@/lib/floor-calibration";
import { calculateFloorCredibility, type CredibilityThesis } from "@/lib/floor-credibility";
import { floorDisplayName } from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Award, BarChart3, Building2, CalendarDays, Gauge, ShieldCheck } from "lucide-react";
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

type CalibrationBucketRow = {
  conviction: number;
  correct_calls: number;
  incorrect_calls: number;
  resolved_binary_calls: number;
};

// Wide viewBox, on-brand colors -- matches the same non-scaling-stroke
// SVG pattern already used for the market-overview chart. Green/red are
// deliberately not used here: this is self-assessment, not a
// buy/sell/direction signal, so the chart identity stays ink/gold.
const CALIBRATION_CHART_WIDTH = 300;
const CALIBRATION_CHART_HEIGHT = 140;
const CALIBRATION_CHART_MARGIN = 16;

function calibrationPoint(conviction: number, valuePct: number) {
  const x = CALIBRATION_CHART_MARGIN + ((conviction - 1) / 4) * (CALIBRATION_CHART_WIDTH - CALIBRATION_CHART_MARGIN * 2);
  const y = (CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_MARGIN) - (valuePct / 100) * (CALIBRATION_CHART_HEIGHT - CALIBRATION_CHART_MARGIN * 2);
  return { x, y };
}

function calibrationPath(values: Array<number | null>) {
  return values
    .map((value, index) => {
      if (value === null) return null;
      const { x, y } = calibrationPoint(index + 1, value);
      return `${index === 0 || values[index - 1] === null ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .filter((segment): segment is string => segment !== null)
    .join(" ");
}

function CalibrationCurve({ calibration }: { calibration: FloorCalibrationResult }) {
  const hitRateValues = calibration.buckets.map((bucket) => bucket.hitRate);
  const statedValues = calibration.buckets.map((bucket) => FLOOR_CONVICTION_PROBABILITY[bucket.conviction] * 100);

  return (
    <svg
      viewBox={`0 0 ${CALIBRATION_CHART_WIDTH} ${CALIBRATION_CHART_HEIGHT}`}
      role="img"
      aria-label="Hit rate versus stated confidence by conviction level"
      className="w-full"
    >
      <path
        d={calibrationPath(statedValues)}
        fill="none"
        stroke="var(--loombus-text-subtle)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d={calibrationPath(hitRateValues)}
        fill="none"
        stroke="var(--loombus-gold)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {calibration.buckets.map((bucket) => {
        if (bucket.hitRate === null) return null;
        const { x, y } = calibrationPoint(bucket.conviction, bucket.hitRate);
        return <circle key={bucket.conviction} cx={x} cy={y} r={3} fill="var(--loombus-gold)" />;
      })}
    </svg>
  );
}

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
  const [calibrationRows, setCalibrationRows] = useState<CalibrationBucketRow[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/the-floor/analyst/${memberId}`)}`);
        return;
      }

      const [{ data: profileData }, { data: thesisData }, { data: calibrationData }] = await Promise.all([
        supabase.from("profiles").select("id, username, full_name").eq("id", memberId).maybeSingle(),
        supabase
          .from("floor_theses")
          .select(
            "id, ticker, stance, conviction, entry_zone_low, entry_zone_high, exit_plan, thesis, catalysts, risks, created_at, floor_calls(status, outcome, created_at, resolves_by)"
          )
          .eq("author_id", memberId)
          .order("created_at", { ascending: false })
          .limit(250),
        // Read through the privacy-gated view, not raw floor_calls, even
        // for a member's own page -- floor_member_calibration already
        // encodes "always visible to yourself, opt-out respected for
        // everyone else" so there's no separate "is this me" branch here.
        supabase
          .from("floor_member_calibration")
          .select("conviction, correct_calls, incorrect_calls, resolved_binary_calls")
          .eq("member_id", memberId),
      ]);

      if (!mounted) return;
      setProfile((profileData as Profile | null) ?? null);
      setTheses((thesisData as AnalystThesis[] | null) ?? []);
      setCalibrationRows((calibrationData as CalibrationBucketRow[] | null) ?? []);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [memberId]);

  const credibility = useMemo(() => calculateFloorCredibility(theses), [theses]);
  const calibration = useMemo(
    () =>
      floorCalibrationFromBucketCounts(
        calibrationRows.map((row) => ({
          conviction: row.conviction,
          correct: row.correct_calls,
          incorrect: row.incorrect_calls,
        }))
      ),
    [calibrationRows]
  );
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

        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex items-center gap-2">
            <Gauge className="size-5 text-[var(--loombus-gold)]" />
            <h2 className="text-xl font-black">Calibration</h2>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            How well stated conviction matched results -- not a judgment of whether any call was a good trade, and never a recommendation.
          </p>

          {calibration.verdict === "building" ? (
            <p className="mt-5 rounded-2xl bg-[var(--loombus-page-bg)] p-4 text-sm font-bold text-[var(--loombus-text-muted)]">
              Building -- {calibration.resolvedBinaryCount} of 10 resolved calls needed before a calibration read appears.
            </p>
          ) : (
            <>
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                  <CalibrationCurve calibration={calibration} />
                  <div className="mt-3 flex flex-wrap gap-4 text-[11px] font-bold text-[var(--loombus-text-muted)]">
                    <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded-full bg-[var(--loombus-gold)]" /> Your hit rate</span>
                    <span className="inline-flex items-center gap-1.5"><i className="inline-block h-0.5 w-4 rounded-full border border-dashed border-[var(--loombus-text-subtle)]" /> Stated confidence (house convention)</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-center">
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Brier score</p>
                  <p className="mt-1 text-4xl font-black text-[var(--loombus-gold)]">{calibration.brier?.toFixed(3)}</p>
                  <p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">Lower is better. 0 = perfect, 0.25 = coin flip.</p>
                  <p className="mt-4 text-sm font-black capitalize">{calibration.verdict.replace("-", " ")}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{floorCalibrationVerdictCopy(calibration.verdict)}</p>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">
                      <th className="pb-2">Conviction</th>
                      <th className="pb-2">Resolved calls</th>
                      <th className="pb-2">Hit rate</th>
                      <th className="pb-2">95% range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calibration.buckets.map((bucket) => (
                      <tr key={bucket.conviction} className="border-t border-[var(--loombus-border)]">
                        <td className="py-2 font-black">{bucket.conviction}/5</td>
                        <td className="py-2 font-bold text-[var(--loombus-text-muted)]">{bucket.n}</td>
                        <td className="py-2 font-bold">{bucket.hitRate === null ? "—" : `${bucket.hitRate.toFixed(0)}%`}</td>
                        <td className="py-2 text-[var(--loombus-text-muted)]">
                          {bucket.wilsonLow === null || bucket.wilsonHigh === null
                            ? "—"
                            : `${bucket.wilsonLow.toFixed(0)}%–${bucket.wilsonHigh.toFixed(0)}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <p className="mt-4 text-[10px] leading-5 text-[var(--loombus-text-subtle)]">
            Brier score uses a house convention mapping stated conviction to a probability of being correct (1/5 = 55%, 2/5 = 62.5%, 3/5 = 70%, 4/5 = 77.5%, 5/5 = 85%) -- a modeling choice, not a fact, disclosed here so the number is checkable.
          </p>
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
