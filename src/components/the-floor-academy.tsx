"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Award,
  BookOpen,
  CheckCircle2,
  FileText,
  GraduationCap,
  Printer,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Call = { status: string; outcome: string | null };
type Author = { username: string | null; full_name: string | null } | null;
type Thesis = {
  id: string;
  ticker: string;
  stance: string;
  conviction: number;
  thesis: string;
  catalysts: string;
  risks: string;
  exit_plan: string;
  created_at: string;
  author: Author | Author[];
  floor_calls: Call[] | null;
};

type View = "reports" | "analysts" | "challenges" | "academy";
const card = "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";
const ACADEMY_KEY = "loombus.floor.academy.progress.v1";

const lessons = [
  { id: "thesis", title: "Build a falsifiable thesis", description: "Turn an opinion into a claim with observable conditions, horizon, and invalidation criteria." },
  { id: "evidence", title: "Separate evidence from narrative", description: "Identify primary sources, label assumptions, and disclose what remains unknown." },
  { id: "risk", title: "Steelman the counter-case", description: "Write the strongest opposing argument and specify the risk most likely to invalidate your view." },
  { id: "calls", title: "Make accountable calls", description: "Define a measurable prediction, comparator, resolution date, and outcome standard before the result is known." },
  { id: "revision", title: "Revise without rewriting history", description: "Preserve the original thesis and add dated revisions when evidence or conviction changes." },
];

const challenges = [
  { title: "Strongest counter-case", prompt: "Choose a current bullish thesis and produce the strongest evidence-backed bearish counter-case.", skill: "Risk analysis" },
  { title: "Evidence audit", prompt: "Find a thesis with unsupported claims and identify the primary evidence required to test each claim.", skill: "Evidence quality" },
  { title: "Falsifiable catalyst", prompt: "Convert a broad catalyst into a measurable event with a deadline and explicit pass or fail condition.", skill: "Accountability" },
  { title: "Shared-risk map", prompt: "Identify one disclosed risk connecting at least three companies and explain the observable relationship.", skill: "Knowledge graph" },
];

function authorName(author: Thesis["author"]) {
  const value = Array.isArray(author) ? author[0] : author;
  return value?.full_name?.trim() || value?.username?.trim() || "Floor analyst";
}

function researchScore(items: Thesis[]) {
  if (!items.length) return 0;
  const complete = items.filter((item) => item.thesis.trim() && item.risks.trim() && item.catalysts.trim() && item.exit_plan.trim()).length;
  const calls = items.flatMap((item) => item.floor_calls ?? []);
  const resolved = calls.filter((call) => call.status === "resolved");
  const outcomes = resolved.filter((call) => call.outcome === "correct").length;
  const completeness = complete / items.length;
  const accountability = Math.min(1, calls.length / Math.max(1, items.length));
  const outcomeQuality = resolved.length ? outcomes / resolved.length : 0;
  return Math.round(completeness * 55 + accountability * 25 + outcomeQuality * 20);
}

export default function TheFloorAcademy() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("reports");
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState("");
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [completed, setCompleted] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Facademy");
        return;
      }
      const { data } = await supabase
        .from("floor_theses")
        .select("id, ticker, stance, conviction, thesis, catalysts, risks, exit_plan, created_at, author:profiles!floor_theses_author_id_fkey(username, full_name), floor_calls(status, outcome)")
        .order("created_at", { ascending: false })
        .limit(300);
      setTheses((data ?? []) as unknown as Thesis[]);
      try { setCompleted(JSON.parse(window.localStorage.getItem(ACADEMY_KEY) ?? "[]") as string[]); } catch { setCompleted([]); }
      setLoading(false);
    })();
  }, []);

  const tickers = useMemo(() => [...new Set(theses.map((item) => item.ticker))].sort(), [theses]);
  const reportTicker = selectedTicker || tickers[0] || "";
  const reportItems = theses.filter((item) => item.ticker === reportTicker);
  const analysts = useMemo(() => {
    const grouped = new Map<string, Thesis[]>();
    for (const thesis of theses) {
      const name = authorName(thesis.author);
      grouped.set(name, [...(grouped.get(name) ?? []), thesis]);
    }
    return [...grouped.entries()].map(([name, items]) => {
      const calls = items.flatMap((item) => item.floor_calls ?? []);
      const resolved = calls.filter((call) => call.status === "resolved");
      return {
        name,
        items,
        score: researchScore(items),
        companies: new Set(items.map((item) => item.ticker)).size,
        calls: calls.length,
        resolved: resolved.length,
        correct: resolved.filter((call) => call.outcome === "correct").length,
      };
    }).filter((item) => !query.trim() || item.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.score - a.score || b.items.length - a.items.length);
  }, [query, theses]);

  function toggleLesson(id: string) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    setCompleted(next);
    window.localStorage.setItem(ACADEMY_KEY, JSON.stringify(next));
  }

  if (loading) return <LoombusLoadingScreen title="Opening The Floor Academy..." message="Preparing reports, challenges, and learning progress." />;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className={card}>
          <Link href="/the-floor" className="inline-flex items-center gap-2 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-4" /> Back to The Floor</Link>
          <div className="mt-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Learn, demonstrate, document</p><h1 className="mt-1 text-3xl font-black">Academy and Research Standards</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Turn transparent research into professional reports, measurable reputation, structured challenges, and practical learning.</p></div>
          <nav className="mt-5 flex gap-2 overflow-x-auto">
            {([
              ["reports", "Reports", FileText],
              ["analysts", "Analyst Reputation", Users],
              ["challenges", "Challenges", Trophy],
              ["academy", "Academy", GraduationCap],
            ] as const).map(([id, label, Icon]) => <button key={id} onClick={() => setView(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black ${view === id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><Icon className="size-4 text-[var(--loombus-gold)]" /> {label}</button>)}
          </nav>
        </header>

        {view === "reports" ? (
          <section className="space-y-4">
            <div className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Institutional company report</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">A printable research brief generated from observable Floor records.</p></div><div className="flex gap-2"><select value={reportTicker} onChange={(event) => setSelectedTicker(event.target.value)} className="rounded-full border border-[var(--loombus-border)] bg-transparent px-4 py-2 text-sm font-black">{tickers.map((ticker) => <option key={ticker}>{ticker}</option>)}</select><button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black"><Printer className="size-4" /> Print report</button></div></div>
            </div>
            <article className={`${card} print:border-0 print:shadow-none`}>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">The Floor Research Report</p><h2 className="mt-2 text-3xl font-black">{reportTicker || "No covered company"}</h2><p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">Generated {new Date().toLocaleDateString()} · Based on {reportItems.length} published {reportItems.length === 1 ? "thesis" : "theses"}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-4">{[["Bullish", reportItems.filter((item) => item.stance === "long").length],["Bearish", reportItems.filter((item) => item.stance === "short").length],["Neutral", reportItems.filter((item) => item.stance === "neutral").length],["Avg. conviction", reportItems.length ? (reportItems.reduce((sum,item) => sum + item.conviction,0)/reportItems.length).toFixed(1) : "—"]].map(([label,value]) => <div key={String(label)} className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><p className="text-xs font-black text-[var(--loombus-text-subtle)]">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div>
              <div className="mt-5 space-y-4">{reportItems.slice(0,10).map((item) => <section key={item.id} className="rounded-2xl border border-[var(--loombus-border)] p-4"><div className="flex justify-between gap-3"><p className="font-black">{authorName(item.author)} · {item.stance}</p><p className="text-xs font-black">{item.conviction}/5</p></div><p className="mt-3 text-sm leading-6">{item.thesis}</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-black uppercase">Catalysts</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{item.catalysts || "Not disclosed"}</p></div><div><p className="text-xs font-black uppercase">Risks</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">{item.risks || "Not disclosed"}</p></div></div></section>)}</div>
              <p className="mt-5 border-t border-[var(--loombus-border)] pt-4 text-xs leading-5 text-[var(--loombus-text-muted)]">This report summarizes member research and accountable records. It is not a Loombus rating, recommendation, or forecast.</p>
            </article>
          </section>
        ) : null}

        {view === "analysts" ? (
          <section className="space-y-4">
            <div className={card}><label className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Find an analyst" /></label></div>
            <div className="grid gap-4 md:grid-cols-2">{analysts.map((analyst, index) => <article key={analyst.name} className={card}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-[var(--loombus-gold)]">Rank {index + 1}</p><h2 className="mt-1 text-lg font-black">{analyst.name}</h2></div><div className="text-right"><p className="text-3xl font-black">{analyst.score}</p><p className="text-[10px] font-black uppercase text-[var(--loombus-text-subtle)]">Research score</p></div></div><div className="mt-4 grid grid-cols-4 gap-2 text-center">{[["Theses",analyst.items.length],["Companies",analyst.companies],["Calls",analyst.calls],["Resolved",analyst.resolved]].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-[var(--loombus-surface-muted)] p-2"><p className="font-black">{value}</p><p className="text-[9px] font-black text-[var(--loombus-text-subtle)]">{label}</p></div>)}</div><p className="mt-4 text-xs leading-5 text-[var(--loombus-text-muted)]">Score reflects research completeness, use of accountable calls, and resolved outcomes. It does not use followers, likes, or popularity.</p></article>)}</div>
          </section>
        ) : null}

        {view === "challenges" ? (
          <section className="grid gap-4 md:grid-cols-2">{challenges.map((challenge, index) => <article key={challenge.title} className={card}><div className="flex items-center justify-between"><Trophy className="size-5 text-[var(--loombus-gold)]" /><span className="text-xs font-black text-[var(--loombus-text-subtle)]">Challenge {index + 1}</span></div><h2 className="mt-4 text-lg font-black">{challenge.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{challenge.prompt}</p><div className="mt-4 flex items-center justify-between gap-3"><span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{challenge.skill}</span><Link href="/the-floor/workspace" className="text-xs font-black">Start in Workspace →</Link></div></article>)}</section>
        ) : null}

        {view === "academy" ? (
          <section className="grid gap-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">{lessons.map((lesson, index) => { const done = completed.includes(lesson.id); return <article key={lesson.id} className={card}><div className="flex items-start gap-4"><button onClick={() => toggleLesson(lesson.id)} aria-label={done ? "Mark lesson incomplete" : "Mark lesson complete"} className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border ${done ? "border-emerald-400 bg-emerald-400/15 text-emerald-400" : "border-[var(--loombus-border)]"}`}>{done ? <CheckCircle2 className="size-5" /> : index + 1}</button><div><h2 className="text-lg font-black">{lesson.title}</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{lesson.description}</p><div className="mt-3 flex gap-3"><Link href="/the-floor/workspace" className="text-xs font-black text-[var(--loombus-gold)]">Practice in Workspace</Link><Link href="/the-floor/research-assistant" className="text-xs font-black">Challenge with AI</Link></div></div></div></article>; })}</div>
            <aside className="space-y-4"><div className={card}><Award className="size-6 text-[var(--loombus-gold)]" /><h2 className="mt-3 font-black">Learning progress</h2><p className="mt-2 text-4xl font-black">{completed.length}/{lessons.length}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)]" style={{width:`${Math.round(completed.length/lessons.length*100)}%`}} /></div></div><div className={card}><Sparkles className="size-5 text-[var(--loombus-gold)]" /><h2 className="mt-3 font-black">Standard over popularity</h2><p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">Academy progress teaches research discipline. It does not certify investment skill or guarantee outcomes.</p></div></aside>
          </section>
        ) : null}

        <section className={card}><p className="flex gap-2 text-xs leading-5 text-[var(--loombus-text-muted)]"><ShieldCheck className="size-4 shrink-0 text-[var(--loombus-gold)]" /> Analyst reputation and reports use observable Floor records. Missing evidence remains missing, unresolved calls remain unresolved, and popularity is excluded from scoring.</p></section>
      </div>
    </main>
  );
}
