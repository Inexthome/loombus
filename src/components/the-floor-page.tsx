"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import type { FloorAnalysisData } from "@/components/the-floor-analysis-section";
import {
  FloorThesisCard,
  type FloorCallCardData,
  type FloorThesisCardData,
} from "@/components/the-floor-thesis-card";
import {
  FLOOR_CATALYSTS_MAX,
  FLOOR_EXIT_PLAN_MAX,
  FLOOR_HORIZON_OPTIONS,
  FLOOR_RISKS_MAX,
  FLOOR_STANCE_OPTIONS,
  FLOOR_THESIS_MAX,
  FLOOR_TICKER_MAX,
  floorDisplayName,
  type FloorHorizon,
  type FloorStance,
} from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { Loader2, MessagesSquare, Plus, ScrollText, Send, Trophy, X } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

type FloorAuthorEmbed = { username: string | null; full_name: string | null } | null;

type FloorThesisRow = {
  id: string;
  author_id: string;
  ticker: string;
  stance: FloorStance;
  conviction: number;
  horizon: FloorHorizon;
  entry_zone_low: number | null;
  entry_zone_high: number | null;
  exit_plan: string;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  lifecycle_status: "active" | "withdrawn" | "deleted";
  author: FloorAuthorEmbed | FloorAuthorEmbed[] | null;
  floor_calls: FloorCallCardData[] | null;
  floor_thesis_analyses: FloorAnalysisData[] | null;
};

function authorName(author: FloorThesisRow["author"]) {
  const profile = Array.isArray(author) ? author[0] ?? null : author;
  return floorDisplayName(profile?.full_name, profile?.username);
}

function toCardData(row: FloorThesisRow): FloorThesisCardData {
  return {
    id: row.id,
    ticker: row.ticker,
    stance: row.stance,
    conviction: row.conviction,
    horizon: row.horizon,
    entry_zone_low: row.entry_zone_low,
    entry_zone_high: row.entry_zone_high,
    exit_plan: row.exit_plan,
    thesis: row.thesis,
    catalysts: row.catalysts,
    risks: row.risks,
    created_at: row.created_at,
    lifecycle_status: row.lifecycle_status === "withdrawn" ? "withdrawn" : "active",
    author_name: authorName(row.author),
    calls: [...(row.floor_calls ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ),
    analysis: row.floor_thesis_analyses?.[0] ?? null,
  };
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";
const textareaClass =
  "w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none placeholder:text-[var(--loombus-text-subtle)] focus:border-amber-400 focus:ring-4 focus:ring-amber-100/20";
const labelClass = "mb-2 block text-sm font-black text-[var(--loombus-text)]";

export default function TheFloorPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [theses, setTheses] = useState<FloorThesisRow[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const [ticker, setTicker] = useState("");
  const [stance, setStance] = useState<FloorStance>("long");
  const [conviction, setConviction] = useState(3);
  const [horizon, setHorizon] = useState<FloorHorizon>("months");
  const [entryZoneLow, setEntryZoneLow] = useState("");
  const [entryZoneHigh, setEntryZoneHigh] = useState("");
  const [exitPlan, setExitPlan] = useState("");
  const [thesisText, setThesisText] = useState("");
  const [catalysts, setCatalysts] = useState("");
  const [risks, setRisks] = useState("");

  const reloadTimer = useRef<number | null>(null);

  const loadTheses = useCallback(async () => {
    const { data, error } = await supabase
      .from("floor_theses")
      .select(
        "id, author_id, ticker, stance, conviction, horizon, entry_zone_low, entry_zone_high, exit_plan, thesis, catalysts, risks, created_at, lifecycle_status, author:profiles!floor_theses_author_id_fkey(username, full_name), floor_calls(id, prediction, comparator, target_value, target_value_high, resolves_by, status, outcome, outcome_note, resolved_value, created_at), floor_thesis_analyses(id, steelman, redteam, blind_spots, model, created_at)"
      )
      .or("lifecycle_status.is.null,lifecycle_status.neq.deleted")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!error && data) {
      setTheses(data as unknown as FloorThesisRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function guardAndLoad() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor");
        return;
      }
      if (mounted) {
        setUserId(auth.user.id);
        await loadTheses();
      }
    }
    void guardAndLoad();
    return () => {
      mounted = false;
    };
  }, [loadTheses]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const openComposer = () => setComposerOpen(true);
    const timer = params.get("compose") === "1" ? window.setTimeout(openComposer, 0) : null;
    window.addEventListener("loombus:floor-open-thesis-composer", openComposer);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("loombus:floor-open-thesis-composer", openComposer);
    };
  }, []);

  useEffect(() => {
    const scheduleReload = () => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      reloadTimer.current = window.setTimeout(() => {
        reloadTimer.current = null;
        void loadTheses();
      }, 180);
    };
    const channel = supabase
      .channel("the-floor:theses")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_theses" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_calls" },
        scheduleReload
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "floor_thesis_analyses" },
        scheduleReload
      )
      .subscribe();
    const fallback = window.setInterval(() => void loadTheses(), 30_000);
    return () => {
      if (reloadTimer.current !== null) window.clearTimeout(reloadTimer.current);
      window.clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [loadTheses]);

  function resetComposer() {
    setTicker("");
    setStance("long");
    setConviction(3);
    setHorizon("months");
    setEntryZoneLow("");
    setEntryZoneHigh("");
    setExitPlan("");
    setThesisText("");
    setCatalysts("");
    setRisks("");
  }

  async function submitThesis(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setMessage("");
    setMessageIsError(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch("/api/floor/theses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ticker,
          stance,
          conviction,
          horizon,
          entryZoneLow: entryZoneLow || null,
          entryZoneHigh: entryZoneHigh || null,
          exitPlan,
          thesis: thesisText,
          catalysts,
          risks,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to post your thesis.");
      resetComposer();
      setComposerOpen(false);
      setMessage("Your thesis is live on The Floor.");
      await loadTheses();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to post your thesis.");
      setMessageIsError(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <LoombusLoadingScreen
        title="Loading The Floor..."
        message="Gathering accountable theses and track records."
      />
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-5">
        <header id="post-thesis" className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">The Floor</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                The house never issues buy or sell ratings. Every thesis here is scored on the
                quality of its reasoning and the author&apos;s track record &mdash; never a
                recommendation.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/the-floor/discussion"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 text-sm font-black text-[var(--loombus-text-muted)] hover:border-amber-300"
              >
                <MessagesSquare className="size-4" aria-hidden="true" />
                Discussion
              </Link>
              <Link
                href="/the-floor/leaderboard"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 text-sm font-black text-[var(--loombus-text-muted)] hover:border-amber-300"
              >
                <Trophy className="size-4" aria-hidden="true" />
                Leaderboard
              </Link>
              <button
                type="button"
                onClick={() => setComposerOpen((open) => !open)}
                aria-expanded={composerOpen}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#cbab5b] px-5 text-sm font-black text-[#17120a]"
              >
                {composerOpen ? <X className="size-4" /> : <Plus className="size-4" />}
                {composerOpen ? "Close composer" : "Post a thesis"}
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
              messageIsError
                ? "border-rose-500/30 bg-rose-500/10 text-rose-400"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            }`}
          >
            {message}
          </div>
        ) : null}

        {composerOpen ? (
          <form
            onSubmit={submitThesis}
            className="space-y-4 rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-sm sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block">
                <span className={labelClass}>Ticker</span>
                <input
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value.toUpperCase().slice(0, FLOOR_TICKER_MAX))}
                  required
                  maxLength={FLOOR_TICKER_MAX}
                  placeholder="NVDA"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className={labelClass}>Horizon</span>
                <select
                  value={horizon}
                  onChange={(event) => setHorizon(event.target.value as FloorHorizon)}
                  className={inputClass}
                >
                  {FLOOR_HORIZON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="block">
                <span className={labelClass}>Conviction</span>
                <div className="flex min-h-12 items-center gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setConviction(level)}
                      aria-pressed={conviction === level}
                      aria-label={`Conviction ${level} of 5`}
                      className={`size-8 rounded-full border text-xs font-black ${
                        level <= conviction
                          ? "border-amber-400 bg-amber-400/20 text-amber-500"
                          : "border-[var(--loombus-border)] text-[var(--loombus-text-subtle)]"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {FLOOR_STANCE_OPTIONS.map((option) => {
                const active = stance === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setStance(option.value)}
                    aria-pressed={active}
                    className={`rounded-2xl border p-3 text-left text-sm font-black transition ${
                      active
                        ? "border-amber-400 bg-amber-50 text-zinc-950 ring-2 ring-amber-200/70 dark:bg-amber-400/10 dark:text-amber-100 dark:ring-amber-500/20"
                        : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] text-[var(--loombus-text-muted)] hover:border-amber-300"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Entry zone low (optional)</span>
                <input
                  value={entryZoneLow}
                  onChange={(event) => setEntryZoneLow(event.target.value)}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="140"
                  className={inputClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Entry zone high (optional)</span>
                <input
                  value={entryZoneHigh}
                  onChange={(event) => setEntryZoneHigh(event.target.value)}
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder="150"
                  className={inputClass}
                />
              </label>
            </div>

            <label className="block">
              <span className={labelClass}>Exit plan</span>
              <textarea
                value={exitPlan}
                onChange={(event) => setExitPlan(event.target.value.slice(0, FLOOR_EXIT_PLAN_MAX))}
                rows={2}
                required
                maxLength={FLOOR_EXIT_PLAN_MAX}
                placeholder="Trim on 25% gain, stop at -12%"
                className={textareaClass}
              />
            </label>

            <label className="block">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-black text-[var(--loombus-text)]">Thesis</span>
                <span className="text-xs font-bold text-[var(--loombus-text-subtle)]">
                  {thesisText.length}/{FLOOR_THESIS_MAX}
                </span>
              </div>
              <textarea
                value={thesisText}
                onChange={(event) => setThesisText(event.target.value.slice(0, FLOOR_THESIS_MAX))}
                rows={5}
                required
                maxLength={FLOOR_THESIS_MAX}
                placeholder="Make the falsifiable case. What has to be true, and how would you know you're wrong?"
                className={textareaClass}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>Catalysts (optional)</span>
                <textarea
                  value={catalysts}
                  onChange={(event) => setCatalysts(event.target.value.slice(0, FLOOR_CATALYSTS_MAX))}
                  rows={3}
                  maxLength={FLOOR_CATALYSTS_MAX}
                  placeholder="What could move this, and when?"
                  className={textareaClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Risks (optional)</span>
                <textarea
                  value={risks}
                  onChange={(event) => setRisks(event.target.value.slice(0, FLOOR_RISKS_MAX))}
                  rows={3}
                  maxLength={FLOOR_RISKS_MAX}
                  placeholder="What would prove this thesis wrong?"
                  className={textareaClass}
                />
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !ticker.trim() || !exitPlan.trim() || !thesisText.trim()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#cbab5b] px-5 text-sm font-black text-[#17120a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                Post thesis
              </button>
            </div>
          </form>
        ) : null}

        {theses.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <ScrollText className="size-8 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-bold text-[var(--loombus-text-muted)]">
              No theses posted yet. Be the first to make a falsifiable case.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {theses.map((row) => (
              <FloorThesisCard
                key={row.id}
                thesis={toCardData(row)}
                canManage={row.author_id === userId}
                onManaged={loadTheses}
                canAddCall={row.author_id === userId && row.lifecycle_status === "active"}
                onCallPosted={loadTheses}
                canRequestAnalysis={row.author_id === userId && row.lifecycle_status === "active"}
                onAnalysisGenerated={loadTheses}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
