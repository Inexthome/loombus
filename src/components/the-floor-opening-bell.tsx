"use client";

import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Activity,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Radio,
  ScrollText,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ThesisActivity = {
  id: string;
  ticker: string;
  stance: string;
  conviction: number;
  thesis: string;
  created_at: string;
  author: { username: string | null; full_name: string | null } | { username: string | null; full_name: string | null }[] | null;
};

type ResolvedCall = {
  id: string;
  outcome: string | null;
  resolved_value: number | null;
  created_at: string;
  thesis: { ticker: string } | { ticker: string }[] | null;
};

function authorLabel(author: ThesisActivity["author"]) {
  const profile = Array.isArray(author) ? author[0] : author;
  return profile?.full_name?.trim() || profile?.username?.trim() || "Floor member";
}

function easternMarketState(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  const total = hour * 60 + minute;
  const businessDay = !["Sat", "Sun"].includes(weekday);
  const open = businessDay && total >= 570 && total < 960;
  const premarket = businessDay && total >= 240 && total < 570;
  const afterHours = businessDay && total >= 960 && total < 1200;
  return open ? "Market open" : premarket ? "Pre-market" : afterHours ? "After hours" : "Market closed";
}

const marketTiles = [
  ["S&P 500", "SPX"],
  ["Nasdaq", "IXIC"],
  ["Dow", "DJI"],
  ["Russell 2000", "RUT"],
  ["VIX", "VIX"],
  ["Gold", "XAU"],
  ["Oil", "WTI"],
  ["10Y Treasury", "US10Y"],
];

export default function TheFloorOpeningBell() {
  const [now, setNow] = useState(() => new Date());
  const [theses, setTheses] = useState<ThesisActivity[]>([]);
  const [resolvedCalls, setResolvedCalls] = useState<ResolvedCall[]>([]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const [thesisResult, callsResult] = await Promise.all([
        supabase
          .from("floor_theses")
          .select("id, ticker, stance, conviction, thesis, created_at, author:profiles!floor_theses_author_id_fkey(username, full_name)")
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("floor_calls")
          .select("id, outcome, resolved_value, created_at, thesis:floor_theses!floor_calls_thesis_id_fkey(ticker)")
          .eq("status", "resolved")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);
      if (!mounted) return;
      if (thesisResult.data) setTheses(thesisResult.data as unknown as ThesisActivity[]);
      if (callsResult.data) setResolvedCalls(callsResult.data as unknown as ResolvedCall[]);
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const highConviction = useMemo(() => theses.filter((item) => item.conviction >= 4).slice(0, 4), [theses]);
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <section id="opening-bell" className="px-4 py-7 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <div className="grid gap-4 lg:grid-cols-[1.45fr_0.55fr]">
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">
                  <BellRing className="size-3.5" /> Opening Bell
                </div>
                <h2 className="mt-4 text-3xl font-black tracking-tight">Your market command center</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{dateLabel}. Start with accountable research, recent outcomes, and the market questions that deserve attention.</p>
              </div>
              <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-right">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Eastern time</p>
                <p className="mt-1 text-lg font-black">{now.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" })}</p>
                <p className="mt-1 text-xs font-bold text-[var(--loombus-gold)]">{easternMarketState(now)}</p>
              </div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4"><ScrollText className="size-5 text-[var(--loombus-gold)]" /><p className="mt-3 text-2xl font-black">{theses.length}</p><p className="text-xs font-bold text-[var(--loombus-text-muted)]">Recent theses reviewed</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4"><Target className="size-5 text-[var(--loombus-gold)]" /><p className="mt-3 text-2xl font-black">{highConviction.length}</p><p className="text-xs font-bold text-[var(--loombus-text-muted)]">High-conviction ideas</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4"><CheckCircle2 className="size-5 text-[var(--loombus-gold)]" /><p className="mt-3 text-2xl font-black">{resolvedCalls.length}</p><p className="text-xs font-bold text-[var(--loombus-text-muted)]">Recent resolved calls</p></div>
            </div>
          </article>

          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><Radio className="size-5 text-[var(--loombus-gold)]" /><h3 className="font-black">Live Floor</h3></div>
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 text-center">
              <Clock3 className="mx-auto size-7 text-[var(--loombus-text-subtle)]" />
              <p className="mt-3 text-sm font-black">No live session scheduled</p>
              <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">Upcoming sessions and replay summaries will appear here.</p>
            </div>
          </article>
        </div>

        <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Market snapshot</p><h3 className="mt-1 text-xl font-black">Core markets</h3></div><span className="text-xs font-bold text-[var(--loombus-text-subtle)]">Live market-data integration ready</span></div>
          <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-4">
            {marketTiles.map(([name, symbol]) => <div key={symbol} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><p className="text-xs font-black text-[var(--loombus-text-subtle)]">{symbol}</p><p className="mt-2 text-sm font-black">{name}</p><p className="mt-3 text-xs font-bold text-[var(--loombus-text-muted)]">Data source pending</p></div>)}
          </div>
        </article>

        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><Sparkles className="size-5 text-[var(--loombus-gold)]" /><h3 className="font-black">High-conviction research</h3></div>
            <div className="mt-4 space-y-3">
              {highConviction.length ? highConviction.map((item) => <a key={item.id} href="#research-feed" className="block rounded-2xl bg-[var(--loombus-page-bg)] p-4"><div className="flex items-center justify-between gap-3"><span className="font-black">{item.ticker}</span><span className="text-xs font-black text-[var(--loombus-gold)]">{item.conviction}/5 conviction</span></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.thesis}</p></a>) : <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">High-conviction theses will appear here as members publish them.</p>}
            </div>
          </article>

          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2"><Users className="size-5 text-[var(--loombus-gold)]" /><h3 className="font-black">Analyst activity</h3></div>
            <div className="mt-4 space-y-3">
              {theses.slice(0, 5).map((item) => <div key={item.id} className="flex gap-3 rounded-2xl bg-[var(--loombus-page-bg)] p-4"><Activity className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" /><div><p className="text-sm font-black">{authorLabel(item.author)} published {item.ticker} research</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{item.stance} thesis · conviction {item.conviction}/5</p></div></div>)}
            </div>
          </article>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><CalendarDays className="size-5 text-[var(--loombus-gold)]" /><h3 className="font-black">Today&apos;s calendar</h3></div><p className="mt-4 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm leading-6 text-[var(--loombus-text-muted)]">Economic events, earnings, Fed events, dividends, and splits will populate here when the calendar feed is connected.</p></article>
          <article className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center gap-2"><TrendingUp className="size-5 text-[var(--loombus-gold)]" /><h3 className="font-black">Recent outcomes</h3></div><div className="mt-4 space-y-3">{resolvedCalls.length ? resolvedCalls.map((call) => { const thesis = Array.isArray(call.thesis) ? call.thesis[0] : call.thesis; return <div key={call.id} className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><p className="text-sm font-black">{thesis?.ticker ?? "Market call"} resolved</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Outcome: {call.outcome ?? "recorded"}{call.resolved_value !== null ? ` · value ${call.resolved_value}` : ""}</p></div>; }) : <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">Resolved predictions will appear here.</p>}</div></article>
        </div>

        <div className="flex justify-center"><Link href="#research-feed" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#cbab5b] px-6 text-sm font-black text-[#17120a]"><ScrollText className="size-4" />Explore all research</Link></div>
      </div>
    </section>
  );
}
