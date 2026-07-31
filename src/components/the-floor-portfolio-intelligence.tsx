"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { companyPath, getFloorCompany, normalizeFloorTicker } from "@/lib/floor-companies";
import {
  buildPosition,
  buildWatchlistItem,
  calculatePortfolioIntelligence,
  FLOOR_PORTFOLIO_STORAGE_KEY,
  FLOOR_WATCHLIST_STORAGE_KEY,
  type PortfolioPosition,
  type WatchlistItem,
} from "@/lib/floor-portfolio";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, BookmarkPlus, BriefcaseBusiness, Eye, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

type ResearchRow = { ticker: string; stance: "long" | "short" | "neutral" };

function readStored<T>(key: string): T[] {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T[]) : [];
  } catch {
    return [];
  }
}

export default function TheFloorPortfolioIntelligence() {
  const [loading, setLoading] = useState(true);
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [research, setResearch] = useState<ResearchRow[]>([]);
  const [ticker, setTicker] = useState("");
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");
  const [watchTicker, setWatchTicker] = useState("");
  const [watchReason, setWatchReason] = useState("");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fportfolio");
        return;
      }
      const { data } = await supabase.from("floor_theses").select("ticker, stance").limit(500);
      if (!mounted) return;
      setPositions(readStored<PortfolioPosition>(FLOOR_PORTFOLIO_STORAGE_KEY));
      setWatchlist(readStored<WatchlistItem>(FLOOR_WATCHLIST_STORAGE_KEY));
      setResearch((data ?? []) as ResearchRow[]);
      setLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(FLOOR_PORTFOLIO_STORAGE_KEY, JSON.stringify(positions));
  }, [loading, positions]);

  useEffect(() => {
    if (!loading) window.localStorage.setItem(FLOOR_WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  }, [loading, watchlist]);

  const intelligence = useMemo(() => calculatePortfolioIntelligence(positions), [positions]);
  const totalWeight = useMemo(() => positions.reduce((sum, item) => sum + item.weight, 0), [positions]);

  const researchByTicker = useMemo(() => {
    const map = new Map<string, { total: number; bull: number; bear: number; neutral: number }>();
    for (const row of research) {
      const key = normalizeFloorTicker(row.ticker);
      const current = map.get(key) ?? { total: 0, bull: 0, bear: 0, neutral: 0 };
      current.total += 1;
      if (row.stance === "long") current.bull += 1;
      else if (row.stance === "short") current.bear += 1;
      else current.neutral += 1;
      map.set(key, current);
    }
    return map;
  }, [research]);

  function addPosition(event: FormEvent) {
    event.preventDefault();
    const cleanTicker = normalizeFloorTicker(ticker);
    const parsedWeight = Number(weight);
    if (!cleanTicker || !Number.isFinite(parsedWeight) || parsedWeight <= 0) return;
    setPositions((current) => {
      const withoutTicker = current.filter((item) => item.ticker !== cleanTicker);
      return [...withoutTicker, buildPosition(cleanTicker, parsedWeight, note)];
    });
    setTicker("");
    setWeight("");
    setNote("");
  }

  function addWatch(event: FormEvent) {
    event.preventDefault();
    const cleanTicker = normalizeFloorTicker(watchTicker);
    if (!cleanTicker) return;
    setWatchlist((current) => {
      if (current.some((item) => item.ticker === cleanTicker)) return current;
      return [...current, buildWatchlistItem(cleanTicker, watchReason)];
    });
    setWatchTicker("");
    setWatchReason("");
  }

  if (loading) {
    return <LoombusLoadingScreen title="Loading Portfolio Intelligence..." message="Mapping your positions to accountable Floor research." />;
  }

  const fieldClass = "min-h-11 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 text-sm text-[var(--loombus-text)] outline-none focus:border-amber-400";

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]">
            <ArrowLeft className="size-3.5" /> Back to The Floor
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <BriefcaseBusiness className="mt-1 size-7 text-[var(--loombus-gold)]" />
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Portfolio Intelligence</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                A private research workspace for understanding concentration, thesis coverage, and unresolved questions. Loombus does not execute trades or issue recommendations.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Positions", intelligence.totalPositions],
            ["Structure", intelligence.diversificationLabel],
            ["Largest weight", intelligence.topPosition ? `${intelligence.topPosition.ticker} ${intelligence.concentration}%` : "—"],
            [totalWeight > 100 ? "Overallocated" : "Unallocated", totalWeight > 100 ? `${Math.round((totalWeight - 100) * 100) / 100}%` : `${intelligence.unallocatedWeight}%`],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
              <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{label}</p>
              <p className="mt-2 text-xl font-black">{value}</p>
            </div>
          ))}
        </section>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <h2 className="text-lg font-black">Research portfolio</h2>
            <form onSubmit={addPosition} className="mt-4 grid gap-3 sm:grid-cols-[.7fr_.7fr_1.6fr_auto]">
              <input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} placeholder="Ticker" className={fieldClass} />
              <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" min="0.01" max="100" step="0.01" placeholder="Weight %" className={fieldClass} />
              <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Your thesis or reason" className={fieldClass} />
              <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#cbab5b] px-4 text-sm font-black text-[#17120a]"><Plus className="size-4" /> Add</button>
            </form>

            <div className="mt-4 space-y-3">
              {positions.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-6 text-center text-sm font-bold text-[var(--loombus-text-muted)]">Add positions to begin mapping your portfolio against Floor research.</p>
              ) : positions.sort((a, b) => b.weight - a.weight).map((position) => {
                const company = getFloorCompany(position.ticker);
                const coverage = researchByTicker.get(position.ticker) ?? { total: 0, bull: 0, bear: 0, neutral: 0 };
                return (
                  <article key={position.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={companyPath(position.ticker)} className="font-black text-[var(--loombus-gold)]">{position.ticker}</Link>
                        <p className="truncate text-sm font-bold">{company.name}</p>
                        <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{coverage.total} theses · {coverage.bull} bull · {coverage.bear} bear · {coverage.neutral} neutral</p>
                        {position.thesisNote ? <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{position.thesisNote}</p> : null}
                      </div>
                      <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-sm font-black text-[var(--loombus-gold)]">{position.weight}%</span>
                      <button onClick={() => setPositions((items) => items.filter((item) => item.id !== position.id))} aria-label={`Remove ${position.ticker}`} className="p-2 text-[var(--loombus-text-subtle)]"><Trash2 className="size-4" /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><Eye className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-lg font-black">Watchlist</h2></div>
            <form onSubmit={addWatch} className="mt-4 space-y-3">
              <input value={watchTicker} onChange={(event) => setWatchTicker(event.target.value.toUpperCase())} placeholder="Ticker" className={`${fieldClass} w-full`} />
              <input value={watchReason} onChange={(event) => setWatchReason(event.target.value)} placeholder="What are you waiting to learn?" className={`${fieldClass} w-full`} />
              <button className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--loombus-border)] text-sm font-black"><BookmarkPlus className="size-4" /> Add to watchlist</button>
            </form>
            <div className="mt-4 space-y-2">
              {watchlist.map((item) => (
                <div key={item.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3">
                  <div className="flex items-center gap-2">
                    <Link href={companyPath(item.ticker)} className="font-black text-[var(--loombus-gold)]">{item.ticker}</Link>
                    <button onClick={() => setWatchlist((items) => items.filter((entry) => entry.id !== item.id))} className="ml-auto p-1 text-[var(--loombus-text-subtle)]" aria-label={`Remove ${item.ticker}`}><Trash2 className="size-4" /></button>
                  </div>
                  {item.reason ? <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{item.reason}</p> : null}
                </div>
              ))}
              {watchlist.length === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No companies watched yet.</p> : null}
            </div>
          </section>
        </div>

        <p className="text-center text-xs leading-5 text-[var(--loombus-text-subtle)]">Portfolio entries are stored privately in this browser for this first release. They are not synced, shared, or connected to a brokerage.</p>
      </div>
    </main>
  );
}
