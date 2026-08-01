"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowLeft, BarChart3, BookOpen, CalendarClock, MessageSquare, Scale, ShieldCheck, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { getFloorCompany, normalizeFloorTicker } from "@/lib/floor-companies";
import { floorDisplayName, floorHorizonLabel, floorStanceLabel, type FloorHorizon, type FloorStance } from "@/lib/floor-shared";
import { normalizePublicText } from "@/lib/public-text";

type AuthorEmbed = { username: string | null; full_name: string | null } | null;
type CallRow = {
  id: string;
  prediction: string;
  status: "pending" | "resolved" | "void";
  outcome: "correct" | "incorrect" | "partial" | null;
  resolves_by: string;
  created_at: string;
};
type ThesisRow = {
  id: string;
  ticker: string;
  stance: FloorStance;
  conviction: number;
  horizon: FloorHorizon;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
  author: AuthorEmbed | AuthorEmbed[] | null;
  floor_calls: CallRow[] | null;
};

type Tab = "overview" | "research" | "bull" | "bear" | "timeline" | "discussion" | "analysts";

function authorName(author: ThesisRow["author"]) {
  const profile = Array.isArray(author) ? author[0] ?? null : author;
  return floorDisplayName(profile?.full_name, profile?.username);
}

function confidenceScore(theses: ThesisRow[]) {
  if (!theses.length) return 0;
  const resolved = theses.flatMap((item) => item.floor_calls ?? []).filter((call) => call.status === "resolved");
  const transparency = Math.min(100, 45 + theses.length * 4);
  const breadth = new Set(theses.map((item) => item.stance)).size * 15;
  const accountability = resolved.length ? Math.min(100, 50 + resolved.length * 8) : 25;
  return Math.round(transparency * 0.4 + breadth * 0.25 + accountability * 0.35);
}

function confidenceLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 50) return "Developing";
  return "Early";
}

export default function CompanyIntelligencePage({ ticker: rawTicker }: { ticker: string }) {
  const ticker = normalizeFloorTicker(rawTicker);
  const company = getFloorCompany(ticker);
  const [loading, setLoading] = useState(true);
  const [theses, setTheses] = useState<ThesisRow[]>([]);
  const [tab, setTab] = useState<Tab>("overview");

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace(`/login?next=${encodeURIComponent(`/the-floor/company/${ticker}`)}`);
        return;
      }
      const { data, error } = await supabase
        .from("floor_theses")
        .select("id, ticker, stance, conviction, horizon, thesis, catalysts, risks, created_at, author:profiles!floor_theses_author_id_fkey(username, full_name), floor_calls(id, prediction, status, outcome, resolves_by, created_at)")
        .eq("ticker", ticker)
        .or("lifecycle_status.is.null,lifecycle_status.neq.deleted")
        .order("created_at", { ascending: false });
      if (mounted && !error) setTheses((data ?? []) as unknown as ThesisRow[]);
      if (mounted) setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [ticker]);

  const longCount = theses.filter((item) => item.stance === "long").length;
  const shortCount = theses.filter((item) => item.stance === "short").length;
  const neutralCount = theses.filter((item) => item.stance === "neutral").length;
  const averageConviction = theses.length
    ? theses.reduce((sum, item) => sum + item.conviction, 0) / theses.length
    : 0;
  const analystCount = new Set(theses.map((item) => authorName(item.author))).size;
  const resolvedCalls = theses.flatMap((item) => item.floor_calls ?? []).filter((call) => call.status === "resolved");
  const confidence = confidenceScore(theses);

  const filtered = useMemo(() => {
    if (tab === "bull") return theses.filter((item) => item.stance === "long");
    if (tab === "bear") return theses.filter((item) => item.stance === "short");
    return theses;
  }, [tab, theses]);

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "research", label: "Research" },
    { id: "bull", label: "Bull" },
    { id: "bear", label: "Bear" },
    { id: "timeline", label: "Timeline" },
    { id: "discussion", label: "Discussion" },
    { id: "analysts", label: "Analysts" },
  ];

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/the-floor" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-gold)]">
          <ArrowLeft className="size-4" aria-hidden="true" /> Back to Opening Bell
        </Link>

        <header className="mt-4 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--loombus-gold)_20%,transparent),transparent_42%),var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="grid size-14 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-lg font-black text-[var(--loombus-gold)]">{ticker.slice(0, 2)}</span>
                <div>
                  <p className="text-sm font-black text-[var(--loombus-gold)]">{ticker}</p>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{company.name}</h1>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-[var(--loombus-text-muted)]">
                {[company.exchange, company.sector, company.industry, company.country].filter(Boolean).map((value) => (
                  <span key={value} className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-1">{value}</span>
                ))}
              </div>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                {company.description ?? "This company intelligence page is being built from accountable research published by members of The Floor."}
              </p>
            </div>
            <div className="min-w-52 rounded-3xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_40%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Research Confidence</p>
              <div className="mt-2 flex items-end gap-2"><span className="text-5xl font-black">{confidence}</span><span className="pb-1 text-sm font-black text-[var(--loombus-text-muted)]">{confidenceLabel(confidence)}</span></div>
              <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">Measures the depth, transparency, viewpoint breadth, and resolved accountability of the research ecosystem. It is not a buy or sell rating.</p>
            </div>
          </div>
        </header>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label={`${ticker} research tools`}>
          <Link href="/the-floor/intelligence" className="shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-xs font-black">Market Intelligence</Link>
          <Link href={`/the-floor/knowledge-graph?query=${encodeURIComponent(ticker)}`} className="shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-xs font-black">Knowledge Graph</Link>
          <Link href={`/the-floor/research-assistant?ticker=${encodeURIComponent(ticker)}`} className="shrink-0 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-xs font-black">Ask AI Assistant</Link>
          <Link href="/the-floor/workspace" className="shrink-0 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black">Open Research Workspace</Link>
        </div>

        <nav className="mt-4 flex gap-2 overflow-x-auto pb-2" aria-label={`${ticker} intelligence sections`}>
          {tabs.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-black ${tab === item.id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)]"}`}>{item.label}</button>
          ))}
        </nav>

        {loading ? <div className="mt-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center text-sm font-bold text-[var(--loombus-text-muted)]">Loading company research...</div> : null}

        {!loading && tab === "overview" ? (
          <div className="mt-5 space-y-5">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [BookOpen, "Active theses", theses.length.toString()],
                [Scale, "Bull / Bear / Neutral", `${longCount} / ${shortCount} / ${neutralCount}`],
                [BarChart3, "Average conviction", theses.length ? `${averageConviction.toFixed(1)} / 5` : "No data"],
                [Users, "Contributors", analystCount.toString()],
              ].map(([Icon, label, value]) => {
                const MetricIcon = Icon as typeof BookOpen;
                return <article key={String(label)} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><MetricIcon className="size-5 text-[var(--loombus-gold)]"/><p className="mt-4 text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{String(label)}</p><p className="mt-1 text-2xl font-black">{String(value)}</p></article>;
              })}
            </section>
            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-3xl border border-emerald-500/20 bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 text-lg font-black"><ShieldCheck className="size-5 text-emerald-400"/>Bull case</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{longCount ? `${longCount} published bullish ${longCount === 1 ? "thesis" : "theses"}. Open the Bull tab to compare catalysts, evidence, and risks.` : "No bullish thesis has been published yet."}</p></div>
              <div className="rounded-3xl border border-rose-500/20 bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Scale className="size-5 text-rose-400"/>Bear case</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{shortCount ? `${shortCount} published bearish ${shortCount === 1 ? "thesis" : "theses"}. Open the Bear tab to inspect the counter-case.` : "No bearish thesis has been published yet."}</p></div>
            </section>
            <section className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Activity className="size-5 text-[var(--loombus-gold)]"/>Accountability</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{resolvedCalls.length ? `${resolvedCalls.length} falsifiable ${resolvedCalls.length === 1 ? "call has" : "calls have"} reached resolution and remain attached to the original research.` : "No calls have resolved yet. Research Confidence will deepen as claims reach their deadlines and outcomes remain visible."}</p></section>
          </div>
        ) : null}

        {!loading && ["research", "bull", "bear"].includes(tab) ? (
          <section className="mt-5 space-y-4">
            {filtered.length ? filtered.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs font-black"><span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-[var(--loombus-gold)]">{floorStanceLabel(item.stance)}</span><span className="rounded-full bg-[var(--loombus-surface-muted)] px-3 py-1 text-[var(--loombus-text-muted)]">{floorHorizonLabel(item.horizon)}</span><span className="ml-auto text-[var(--loombus-text-subtle)]">Conviction {item.conviction}/5</span></div>
                <p className="mt-4 whitespace-pre-line text-sm leading-6">{normalizePublicText(item.thesis)}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2"><div><p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Catalysts</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text-muted)]">{normalizePublicText(item.catalysts) || "Not provided"}</p></div><div><p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Risks</p><p className="mt-1 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text-muted)]">{normalizePublicText(item.risks) || "Not provided"}</p></div></div>
                <p className="mt-4 border-t border-[var(--loombus-border-muted)] pt-3 text-xs font-bold text-[var(--loombus-text-subtle)]">{authorName(item.author)} · {new Date(item.created_at).toLocaleDateString()}</p>
              </article>
            )) : <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center text-sm font-bold text-[var(--loombus-text-muted)]">No research is available in this section yet.</div>}
          </section>
        ) : null}

        {!loading && tab === "timeline" ? <section className="mt-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 text-lg font-black"><CalendarClock className="size-5 text-[var(--loombus-gold)]"/>Research timeline</h2><div className="mt-5 space-y-4">{theses.flatMap((item) => [{ id: `thesis-${item.id}`, date: item.created_at, label: `${floorStanceLabel(item.stance)} thesis published`, detail: authorName(item.author) }, ...(item.floor_calls ?? []).map((call) => ({ id: `call-${call.id}`, date: call.status === "resolved" ? call.resolves_by : call.created_at, label: call.status === "resolved" ? `Prediction resolved: ${call.outcome ?? "resolved"}` : "Falsifiable prediction added", detail: call.prediction }))]).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((event) => <div key={event.id} className="relative border-l-2 border-[var(--loombus-border)] pl-5"><span className="absolute -left-[5px] top-1 size-2 rounded-full bg-[var(--loombus-gold)]"/><p className="text-xs font-black text-[var(--loombus-text-subtle)]">{new Date(event.date).toLocaleDateString()}</p><p className="mt-1 text-sm font-black">{event.label}</p><p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">{normalizePublicText(event.detail)}</p></div>)}</div></section> : null}

        {!loading && tab === "discussion" ? <section className="mt-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center"><MessageSquare className="mx-auto size-7 text-[var(--loombus-gold)]"/><h2 className="mt-3 text-lg font-black">Company discussion</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--loombus-text-muted)]">Ticker-specific discussion threads will be attached here in the next data-layer expansion. General Floor discussion remains available now.</p><Link href="/the-floor/discussion" className="mt-4 inline-flex rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-black">Open Floor discussion</Link></section> : null}

        {!loading && tab === "analysts" ? <section className="mt-5 rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 text-lg font-black"><Users className="size-5 text-[var(--loombus-gold)]"/>Coverage contributors</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{Array.from(new Set(theses.map((item) => authorName(item.author)))).map((name) => { const coverage = theses.filter((item) => authorName(item.author) === name); return <article key={name} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><p className="font-black">{name}</p><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{coverage.length} {coverage.length === 1 ? "thesis" : "theses"} · Average conviction {(coverage.reduce((sum,item) => sum + item.conviction, 0) / coverage.length).toFixed(1)}</p></article>; })}</div></section> : null}
      </div>
    </main>
  );
}
