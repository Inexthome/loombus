"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { FLOOR_WATCHLIST_KEY, FloorWatchItem } from "@/lib/floor-research-hub";
import { getFloorCompany } from "@/lib/floor-companies";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Bell,
  Building2,
  CalendarPlus,
  Clock3,
  PlayCircle,
  Search,
  UserRoundCheck,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";

type Author = { username: string | null; full_name: string | null } | null;
type Thesis = {
  id: string;
  ticker: string;
  stance: string;
  conviction: number;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  author: Author | Author[];
};
type Session = { id: string; title: string; focus: string; scheduledAt: string; replayUrl: string; summary: string };
type View = "companies" | "analysts" | "alerts" | "sessions";

const SESSION_KEY = "loombus.floor.sessions.v1";
const card = "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";
const input = "min-h-11 w-full rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 text-sm outline-none focus:border-[var(--loombus-gold)]";

function authorName(author: Thesis["author"]) {
  const profile = Array.isArray(author) ? author[0] : author;
  return profile?.full_name?.trim() || profile?.username?.trim() || "Floor analyst";
}

function readLocal<T>(key: string): T[] {
  try { return JSON.parse(window.localStorage.getItem(key) ?? "[]") as T[]; } catch { return []; }
}

export default function TheFloorNetworkCenter({ initialView = "companies" }: { initialView?: View }) {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(initialView);
  const [query, setQuery] = useState("");
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [watches, setWatches] = useState<FloorWatchItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState("");
  const [focus, setFocus] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [replayUrl, setReplayUrl] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { window.location.replace("/login?next=%2Fthe-floor%2Fnetwork"); return; }
      const { data } = await supabase.from("floor_theses").select("id, ticker, stance, conviction, thesis, catalysts, risks, created_at, author:profiles!floor_theses_author_id_fkey(username, full_name)").order("created_at", { ascending: false }).limit(400);
      setTheses((data ?? []) as unknown as Thesis[]);
      setWatches(readLocal<FloorWatchItem>(FLOOR_WATCHLIST_KEY));
      setSessions(readLocal<Session>(SESSION_KEY));
      setLoading(false);
    })();
  }, []);

  const companies = useMemo(() => {
    const grouped = new Map<string, Thesis[]>();
    for (const thesis of theses) grouped.set(thesis.ticker, [...(grouped.get(thesis.ticker) ?? []), thesis]);
    return [...grouped.entries()].map(([ticker, items]) => {
      const company = getFloorCompany(ticker);
      return { ...company, items, analysts: new Set(items.map((item) => authorName(item.author))).size, average: items.reduce((sum,item) => sum + item.conviction, 0) / items.length };
    }).filter((item) => !query.trim() || `${item.ticker} ${item.name} ${item.sector ?? ""} ${item.industry ?? ""}`.toLowerCase().includes(query.toLowerCase())).sort((a,b) => b.items.length - a.items.length);
  }, [query, theses]);

  const analysts = useMemo(() => {
    const grouped = new Map<string, Thesis[]>();
    for (const thesis of theses) {
      const name = authorName(thesis.author);
      grouped.set(name, [...(grouped.get(name) ?? []), thesis]);
    }
    return [...grouped.entries()].map(([name, items]) => ({ name, items, companies: [...new Set(items.map((item) => item.ticker))], average: items.reduce((sum,item) => sum + item.conviction,0)/items.length, latest: items[0]?.created_at })).filter((item) => !query.trim() || item.name.toLowerCase().includes(query.toLowerCase()) || item.companies.join(" ").toLowerCase().includes(query.toLowerCase())).sort((a,b) => b.items.length - a.items.length);
  }, [query, theses]);

  const alerts = useMemo(() => watches.flatMap((watch) => {
    const label = watch.label.toLowerCase();
    return theses.filter((thesis) => {
      const text = `${thesis.ticker} ${authorName(thesis.author)} ${thesis.thesis} ${thesis.catalysts} ${thesis.risks}`.toLowerCase();
      return watch.type === "company" ? thesis.ticker.toLowerCase() === label : text.includes(label);
    }).slice(0, 8).map((thesis) => ({ id: `${watch.id}-${thesis.id}`, watch, thesis }));
  }).sort((a,b) => Date.parse(b.thesis.created_at) - Date.parse(a.thesis.created_at)), [theses, watches]);

  function saveSession(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const next = [{ id: crypto.randomUUID(), title: title.trim(), focus: focus.trim(), scheduledAt, replayUrl: replayUrl.trim(), summary: summary.trim() }, ...sessions];
    setSessions(next); window.localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setTitle(""); setFocus(""); setScheduledAt(""); setReplayUrl(""); setSummary("");
  }

  if (loading) return <LoombusLoadingScreen title="Opening Floor Network..." message="Loading companies, analysts, watched research, and sessions." />;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className={card}>
          <Link href="/the-floor" className="inline-flex items-center gap-2 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-4" /> Back to The Floor</Link>
          <div className="mt-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Coverage and continuity</p><h1 className="mt-1 text-3xl font-black">Floor Network Center</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Find covered companies and analysts, monitor watched research signals, and organize live sessions and replay knowledge.</p></div>
          <nav className="mt-5 flex gap-2 overflow-x-auto">{([
            ["companies","Companies",Building2],["analysts","Analysts",UserRoundCheck],["alerts","Research Alerts",Bell],["sessions","Live and Replays",Video],
          ] as const).map(([id,label,Icon]) => <button key={id} onClick={() => setView(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black ${view === id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><Icon className="size-4 text-[var(--loombus-gold)]" />{label}</button>)}</nav>
        </header>

        {view === "companies" || view === "analysts" ? <div className={card}><label className="flex items-center gap-2"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder={view === "companies" ? "Search ticker, company, sector, or industry" : "Search analyst or covered company"} /></label></div> : null}

        {view === "companies" ? <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{companies.map((company) => <Link key={company.ticker} href={`/the-floor/company/${company.ticker}`} className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-black text-[var(--loombus-gold)]">{company.ticker}</p><h2 className="mt-1 font-black">{company.name}</h2></div><Building2 className="size-5" /></div><p className="mt-3 text-xs text-[var(--loombus-text-muted)]">{company.sector ?? "Sector unclassified"} · {company.industry ?? "Industry unclassified"}</p><div className="mt-4 grid grid-cols-3 gap-2 text-center">{[["Theses",company.items.length],["Analysts",company.analysts],["Conviction",company.average.toFixed(1)]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-[var(--loombus-surface-muted)] p-2"><p className="font-black">{value}</p><p className="text-[9px] font-black text-[var(--loombus-text-subtle)]">{label}</p></div>)}</div></Link>)}</section> : null}

        {view === "analysts" ? <section className="grid gap-4 md:grid-cols-2">{analysts.map((analyst) => <article key={analyst.name} className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase text-[var(--loombus-gold)]">Coverage analyst</p><h2 className="mt-1 text-lg font-black">{analyst.name}</h2></div><Users className="size-5" /></div><p className="mt-3 text-sm text-[var(--loombus-text-muted)]">{analyst.items.length} published {analyst.items.length === 1 ? "thesis" : "theses"} · Average conviction {analyst.average.toFixed(1)}/5</p><div className="mt-4 flex flex-wrap gap-2">{analyst.companies.map((ticker) => <Link key={ticker} href={`/the-floor/company/${ticker}`} className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{ticker}</Link>)}</div><Link href="/the-floor/academy" className="mt-4 inline-flex text-xs font-black">View reputation standards →</Link></article>)}</section> : null}

        {view === "alerts" ? <section className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]"><aside className={card}><Bell className="size-5 text-[var(--loombus-gold)]" /><h2 className="mt-3 font-black">Watched signals</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{watches.length} active {watches.length === 1 ? "watch" : "watches"}</p><Link href="/the-floor/hub" className="mt-4 inline-flex rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black">Manage watchlists</Link></aside><div className="space-y-3">{alerts.length ? alerts.map(({id,watch,thesis}) => <Link key={id} href={`/the-floor/company/${thesis.ticker}`} className={`${card} block`}><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-[var(--loombus-gold-surface)] px-2 py-1 text-[10px] font-black text-[var(--loombus-gold)]">{watch.type}: {watch.label}</span><span className="text-xs font-black">{thesis.ticker}</span><time className="ml-auto text-[10px] text-[var(--loombus-text-subtle)]">{new Date(thesis.created_at).toLocaleDateString()}</time></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{thesis.thesis}</p></Link>) : <div className={card}><p className="text-sm text-[var(--loombus-text-muted)]">No matching research alerts yet. Add companies, themes, risks, analysts, or catalysts in the Research Hub.</p></div>}</div></section> : null}

        {view === "sessions" ? <section className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]"><form onSubmit={saveSession} className={card}><CalendarPlus className="size-5 text-[var(--loombus-gold)]" /><h2 className="mt-3 font-black">Add session or replay</h2><p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">Create a private session plan or preserve a replay summary.</p><div className="mt-4 space-y-3"><input value={title} onChange={(e)=>setTitle(e.target.value)} className={input} placeholder="Session title" /><input value={focus} onChange={(e)=>setFocus(e.target.value)} className={input} placeholder="Company, sector, or theme" /><input type="datetime-local" value={scheduledAt} onChange={(e)=>setScheduledAt(e.target.value)} className={input} /><input value={replayUrl} onChange={(e)=>setReplayUrl(e.target.value)} className={input} placeholder="Replay URL, optional" /><textarea value={summary} onChange={(e)=>setSummary(e.target.value)} rows={5} className={`${input} py-3`} placeholder="Session agenda or replay summary" /><button className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-black text-black"><CalendarPlus className="size-4" /> Save privately</button></div></form><div className="space-y-4">{sessions.length ? sessions.map((session) => <article key={session.id} className={card}><div className="flex justify-between gap-3"><div><p className="text-xs font-black uppercase text-[var(--loombus-gold)]">{session.replayUrl ? "Replay" : "Scheduled session"}</p><h2 className="mt-1 text-lg font-black">{session.title}</h2></div>{session.replayUrl ? <PlayCircle className="size-5" /> : <Clock3 className="size-5" />}</div><p className="mt-2 text-xs text-[var(--loombus-text-muted)]">{session.focus || "General research"}{session.scheduledAt ? ` · ${new Date(session.scheduledAt).toLocaleString()}` : ""}</p>{session.summary ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{session.summary}</p> : null}{session.replayUrl ? <a href={session.replayUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-black text-[var(--loombus-gold)]">Open replay</a> : null}</article>) : <div className={card}><Video className="size-6 text-[var(--loombus-gold)]" /><h2 className="mt-3 font-black">No sessions scheduled</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Upcoming sessions and replay summaries will appear here.</p></div>}</div></section> : null}

        <section className={card}><p className="text-xs leading-5 text-[var(--loombus-text-muted)]"><strong className="text-[var(--loombus-text)]">Current release:</strong> Directories and alerts derive from observable Floor research. Session plans and replays are private to this browser until the collaborative cloud data layer is introduced.</p></section>
      </div>
    </main>
  );
}
