"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getFloorCompany } from "@/lib/floor-companies";
import { mergeFloorLocalWithCloud } from "@/lib/floor-cloud-data";
import { FLOOR_WATCHLIST_KEY, type FloorWatchItem } from "@/lib/floor-research-hub";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BellRing,
  BookOpen,
  CalendarDays,
  Clock3,
  Search,
  ShieldCheck,
  Target,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Author = { id: string; username: string | null; full_name: string | null } | null;
type Call = { id: string; prediction: string; status: "pending" | "resolved" | "void"; outcome: string | null; resolves_by: string };
type Thesis = {
  id: string;
  ticker: string;
  stance: "long" | "short" | "neutral";
  conviction: number;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  author: Author | Author[];
  floor_calls: Call[] | null;
};
type Room = { id: string; name: string; focus: string; objective: string; updated_at: string };
type EarningsEvent = { symbol: string; name: string; date: string; time: string | null; epsEstimate: number | null; revenueEstimate: number | null };
type MarketResponse = { provider: string; delayed: boolean; earnings: { available: boolean; message: string | null; events: EarningsEvent[] } };
type WindowFilter = "all" | "7" | "14";

const card = "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";

function profile(author: Thesis["author"]) { return Array.isArray(author) ? author[0] ?? null : author; }
function authorName(author: Thesis["author"]) { const item = profile(author); return item?.full_name?.trim() || item?.username?.trim() || "Floor analyst"; }
function readLocalWatches() { try { return JSON.parse(window.localStorage.getItem(FLOOR_WATCHLIST_KEY) ?? "[]") as FloorWatchItem[]; } catch { return []; } }
function normalize(value: string) { return value.trim().toUpperCase(); }
function dayDistance(date: string) { return Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000); }
function dateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
function timingLabel(value: string | null) {
  if (!value) return "Time not supplied";
  const normalized = value.toLowerCase();
  if (normalized.includes("before") || normalized === "bmo") return "Before market open";
  if (normalized.includes("after") || normalized === "amc") return "After market close";
  return value;
}
function includesTicker(room: Room, ticker: string, companyName: string) {
  const source = `${room.focus} ${room.objective} ${room.name}`.toLowerCase();
  return source.includes(ticker.toLowerCase()) || (companyName !== ticker && source.includes(companyName.toLowerCase()));
}

export default function TheFloorEarningsCenter() {
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [windowFilter, setWindowFilter] = useState<WindowFilter>("all");
  const [coveredOnly, setCoveredOnly] = useState(false);
  const [market, setMarket] = useState<MarketResponse | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [watches, setWatches] = useState<FloorWatchItem[]>([]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const initialQuery = new URLSearchParams(window.location.search).get("query")?.trim();
      if (initialQuery) setQuery(initialQuery);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.replace("/login?next=%2Fthe-floor%2Fearnings"); return; }
      const localWatches = readLocalWatches();
      const [thesisResult, roomResult, cloudWatches] = await Promise.all([
        supabase.from("floor_theses").select("id, ticker, stance, conviction, thesis, catalysts, risks, created_at, author:profiles!floor_theses_author_id_fkey(id, username, full_name), floor_calls(id, prediction, status, outcome, resolves_by)").or("lifecycle_status.is.null,lifecycle_status.neq.deleted").order("created_at", { ascending: false }).limit(500),
        supabase.from("floor_research_rooms").select("id, name, focus, objective, updated_at").order("updated_at", { ascending: false }).limit(100),
        mergeFloorLocalWithCloud(auth.user.id, "watch", localWatches).catch(() => localWatches),
      ]);
      if (!mounted) return;
      setTheses((thesisResult.data ?? []) as unknown as Thesis[]);
      setRooms((roomResult.data ?? []) as Room[]);
      setWatches(cloudWatches);
      window.localStorage.setItem(FLOOR_WATCHLIST_KEY, JSON.stringify(cloudWatches));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    void fetch("/api/floor/market")
      .then(async (response) => { if (!response.ok) throw new Error("Feed unavailable"); return response.json() as Promise<MarketResponse>; })
      .then((value) => { if (mounted) setMarket(value); })
      .catch(() => undefined)
      .finally(() => { if (mounted) setFeedLoading(false); });
    return () => { mounted = false; };
  }, []);

  const coverage = useMemo(() => {
    const grouped = new Map<string, Thesis[]>();
    for (const thesis of theses) {
      const ticker = normalize(thesis.ticker);
      grouped.set(ticker, [...(grouped.get(ticker) ?? []), thesis]);
    }
    return grouped;
  }, [theses]);

  const events = useMemo(() => (market?.earnings.events ?? []).map((event) => {
    const ticker = normalize(event.symbol);
    const company = getFloorCompany(ticker);
    const records = coverage.get(ticker) ?? [];
    const calls = records.flatMap((item) => item.floor_calls ?? []);
    const analysts = new Map<string, { id: string; name: string }>();
    for (const item of records) { const itemProfile = profile(item.author); analysts.set(itemProfile?.id ?? authorName(item.author), { id: itemProfile?.id ?? "", name: authorName(item.author) }); }
    const relatedRooms = rooms.filter((room) => includesTicker(room, ticker, company.name));
    const watched = watches.some((watch) => watch.type === "company" && normalize(watch.label) === ticker);
    return { ...event, ticker, company, records, calls, analysts: [...analysts.values()], relatedRooms, watched, daysAway: dayDistance(event.date) };
  }).filter((event) => {
    const matchesQuery = !query.trim() || `${event.ticker} ${event.name} ${event.company.name} ${event.company.sector ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesWindow = windowFilter === "all" || (event.daysAway >= 0 && event.daysAway <= Number(windowFilter));
    return matchesQuery && matchesWindow && (!coveredOnly || event.records.length > 0);
  }).sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker)), [coverage, coveredOnly, market, query, rooms, watches, windowFilter]);

  const coveredEvents = events.filter((event) => event.records.length > 0);
  const watchedEvents = events.filter((event) => event.watched);
  const pendingCalls = events.flatMap((event) => event.calls).filter((call) => call.status === "pending");

  if (loading) return <LoombusLoadingScreen title="Opening Earnings Center..." message="Connecting the calendar to Floor research and accountability." />;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--loombus-gold)_20%,transparent),transparent_42%),var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <Link href="/the-floor" className="inline-flex items-center gap-2 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-4" /> Back to The Floor</Link>
          <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Event-driven research</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">The Floor Earnings Center</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">See which companies report next, then move directly into the theses, falsifiable calls, analysts, and private Research Rooms already covering them.</p></div>
            <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><p className="text-xs font-black uppercase text-[var(--loombus-text-subtle)]">Calendar source</p><p className="mt-1 text-sm font-black">{market?.provider ?? "Twelve Data"}</p><p className="mt-1 text-[10px] font-bold text-[var(--loombus-text-muted)]">Delayed and cached · Estimates are provider supplied</p></div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[[CalendarDays, "Upcoming events", events.length], [BookOpen, "Covered on The Floor", coveredEvents.length], [Target, "Pending attached calls", pendingCalls.length], [BellRing, "Watched companies", watchedEvents.length]].map(([Icon, label, value]) => { const MetricIcon = Icon as typeof CalendarDays; return <article key={String(label)} className={card}><MetricIcon className="size-5 text-[var(--loombus-gold)]"/><p className="mt-4 text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></article>; })}
        </section>

        <section className={card} aria-label="Earnings filters">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 lg:max-w-md"><Search className="size-4 text-[var(--loombus-text-subtle)]"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Search company, ticker, or sector" /></label>
            <div className="flex gap-2 overflow-x-auto pb-1">{([ ["all", "All dates"], ["7", "Next 7 days"], ["14", "Next 14 days"] ] as const).map(([id, label]) => <button key={id} type="button" onClick={() => setWindowFilter(id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-black ${windowFilter === id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)]"}`}>{label}</button>)}<button type="button" onClick={() => setCoveredOnly((value) => !value)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-black ${coveredOnly ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)]"}`}>Floor coverage only</button></div>
          </div>
        </section>

        {feedLoading ? <section className={card}><p className="text-sm font-bold text-[var(--loombus-text-muted)]">Loading the earnings calendar...</p></section> : null}
        {!feedLoading && !market?.earnings.available ? <section className={card}><CalendarDays className="size-6 text-[var(--loombus-gold)]"/><h2 className="mt-3 text-lg font-black">Live earnings data is temporarily unavailable</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Your Floor research and coverage remain accessible through Company Intelligence, theses, calls, analysts, Research Rooms, and Network Center watch signals.</p><div className="mt-4 flex flex-wrap gap-2"><Link href="/the-floor/companies" className="inline-flex min-h-10 items-center rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-black text-black">Open Company Intelligence</Link><Link href="/the-floor/my-theses" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">Open My Theses</Link><Link href="/the-floor/network" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">Open Network Center</Link></div></section> : null}

        {!feedLoading && market?.earnings.available && events.length ? <section className="space-y-4">{events.map((event) => (
          <article key={`${event.ticker}-${event.date}`} className={card}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-3"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-xs font-black text-[var(--loombus-gold)]">{event.ticker.slice(0,4)}</span><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-black">{event.ticker} · {event.company.name !== event.ticker ? event.company.name : event.name}</h2>{event.watched ? <span className="rounded-full bg-[var(--loombus-gold-surface)] px-2 py-1 text-[10px] font-black text-[var(--loombus-gold)]">Watched</span> : null}</div><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{[event.company.sector, event.company.industry].filter(Boolean).join(" · ") || "Company classification unavailable"}</p></div></div>
              <div className="rounded-2xl bg-[var(--loombus-page-bg)] px-4 py-3 lg:text-right"><p className="text-sm font-black">{dateLabel(event.date)}</p><p className="mt-1 text-xs font-bold text-[var(--loombus-gold)]">{timingLabel(event.time)}</p><p className="mt-1 text-[10px] text-[var(--loombus-text-subtle)]">{event.daysAway === 0 ? "Today" : event.daysAway === 1 ? "Tomorrow" : `${event.daysAway} days away`}</p></div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><BookOpen className="size-4 text-[var(--loombus-gold)]"/><p className="mt-2 text-xl font-black">{event.records.length}</p><p className="text-[10px] font-bold text-[var(--loombus-text-muted)]">Active theses</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><Target className="size-4 text-[var(--loombus-gold)]"/><p className="mt-2 text-xl font-black">{event.calls.length}</p><p className="text-[10px] font-bold text-[var(--loombus-text-muted)]">Attached calls</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><UserRoundCheck className="size-4 text-[var(--loombus-gold)]"/><p className="mt-2 text-xl font-black">{event.analysts.length}</p><p className="text-[10px] font-bold text-[var(--loombus-text-muted)]">Covering analysts</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><Users className="size-4 text-[var(--loombus-gold)]"/><p className="mt-2 text-xl font-black">{event.relatedRooms.length}</p><p className="text-[10px] font-bold text-[var(--loombus-text-muted)]">Related rooms</p></div>
              <div className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><Clock3 className="size-4 text-[var(--loombus-gold)]"/><p className="mt-2 text-sm font-black">{event.epsEstimate === null ? "Not supplied" : event.epsEstimate.toLocaleString()}</p><p className="text-[10px] font-bold text-[var(--loombus-text-muted)]">EPS estimate</p></div>
            </div>

            {event.records[0] ? <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><div className="flex flex-wrap items-center gap-2 text-xs font-black"><span className="rounded-full bg-[var(--loombus-gold-surface)] px-2 py-1 text-[var(--loombus-gold)]">Latest Floor thesis</span><span>{event.records[0].stance} · conviction {event.records[0].conviction}/5</span><span className="ml-auto text-[var(--loombus-text-subtle)]">{authorName(event.records[0].author)}</span></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{event.records[0].thesis}</p></div> : <div className="mt-4 rounded-2xl border border-dashed border-[var(--loombus-border)] p-4"><p className="text-sm font-black">Coverage gap</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">No active Floor thesis is connected to this ticker yet. The calendar event is not a research opinion.</p></div>}

            <div className="mt-4 flex flex-wrap gap-2"><Link href={`/the-floor/company/${encodeURIComponent(event.ticker)}`} className="inline-flex min-h-10 items-center rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-black text-black">Open Company Intelligence</Link>{event.analysts.slice(0,2).map((analyst) => analyst.id ? <Link key={analyst.id} href={`/the-floor/analyst/${analyst.id}`} className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">{analyst.name}</Link> : null)}{event.relatedRooms.length ? <Link href="/the-floor/rooms" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">Open Research Rooms</Link> : null}<Link href="/the-floor/network" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">{event.watched ? "Open Network alert" : "Watch in Network Center"}</Link></div>
          </article>
        ))}</section> : null}

        {!feedLoading && market?.earnings.available && !events.length ? <section className={card}><Search className="size-6 text-[var(--loombus-gold)]"/><h2 className="mt-3 text-lg font-black">No matching earnings events</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Try a wider date window, clear the search, or include companies without existing Floor coverage.</p></section> : null}

        <section className={card}><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--loombus-gold)]"/><p className="text-xs leading-5 text-[var(--loombus-text-muted)]"><strong className="text-[var(--loombus-text)]">Integrity:</strong> Earnings dates and estimates come from Twelve Data and may be delayed, revised, or unavailable on the current plan. Floor coverage counts only observable member research and private rooms visible to you. Nothing here is a buy or sell rating.</p></div></section>
      </div>
    </main>
  );
}
