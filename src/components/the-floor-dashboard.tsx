"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { buildFloorKnowledgeGraph, type FloorGraphRecord } from "@/lib/floor-knowledge-graph";
import { buildFloorDashboard, explainFloorCompany } from "@/lib/floor-dashboard";
import { supabase } from "@/lib/supabase/client";
import { Activity, ArrowLeft, BarChart3, GitFork, Search, ShieldAlert, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

export default function TheFloorDashboard() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FloorGraphRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.replace("/login?next=%2Fthe-floor%2Fdashboard");
      return;
    }
    const { data, error } = await supabase.from("floor_theses").select("*").order("created_at", { ascending: false }).limit(300);
    if (!error && data) setRecords(data as FloorGraphRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const graph = useMemo(() => buildFloorKnowledgeGraph(records), [records]);
  const dashboard = useMemo(() => buildFloorDashboard(graph, records), [graph, records]);
  const companies = useMemo(() => {
    const value = query.trim().toLowerCase();
    return dashboard.companies.filter((company) => !value || `${company.ticker} ${company.name ?? ""}`.toLowerCase().includes(value));
  }, [dashboard.companies, query]);
  const selected = dashboard.companies.find((company) => company.ticker === selectedTicker) ?? null;

  if (loading) return <LoombusLoadingScreen title="Preparing institutional dashboards..." message="Summarizing research activity, evidence, risks, catalysts, themes, and analyst coverage." />;

  const panels = [
    { title: "Themes", items: dashboard.topThemes, Icon: GitFork },
    { title: "Emerging risks", items: dashboard.topRisks, Icon: ShieldAlert },
    { title: "Recurring catalysts", items: dashboard.topCatalysts, Icon: Zap },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-3.5" />Back to The Floor</Link>
          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><div className="flex items-center gap-3"><BarChart3 className="size-7 text-[var(--loombus-gold)]" /><h1 className="text-2xl font-black sm:text-3xl">Institutional Research Dashboard</h1></div><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">See what changed across observable Floor research. Every metric is traceable to published theses and disclosed evidence.</p></div>
            <div className="flex gap-2"><Link href="/the-floor/discover" className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black">Discovery</Link><Link href="/the-floor/knowledge-graph" className="rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black">Knowledge Graph</Link></div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2 lg:grid-cols-6">{[["Companies", dashboard.companies.length], ["Active 30d", dashboard.activeCompanies.length], ["Theses", dashboard.totalTheses], ["Analysts", dashboard.totalAnalysts], ["Evidence", dashboard.totalEvidence], ["Avg conviction", dashboard.averageConviction ?? "Unknown"]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><p className="text-[11px] font-black uppercase text-[var(--loombus-text-subtle)]">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>)}</div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="space-y-5">
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-black">Research Momentum</h2><p className="text-sm text-[var(--loombus-text-muted)]">Research activity, not stock-price momentum.</p></div><label className="flex items-center gap-2 rounded-2xl bg-[var(--loombus-surface-muted)] px-3"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search company or ticker" className="min-h-10 bg-transparent text-sm font-bold outline-none" /></label></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">{companies.slice(0, 12).map((company) => <button type="button" key={company.id} onClick={() => setSelectedTicker(company.ticker)} className={`rounded-2xl border p-4 text-left ${selectedTicker === company.ticker ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border-muted)] bg-[var(--loombus-surface-muted)]"}`}><div className="flex justify-between gap-3"><div><p className="text-lg font-black">{company.ticker}</p><p className="text-xs font-bold text-[var(--loombus-text-muted)]">{company.name ?? "Company"}</p></div><div className="rounded-xl bg-[var(--loombus-surface)] px-3 py-2 text-center"><p className="text-[10px] font-black uppercase">Momentum</p><p className="text-xl font-black text-[var(--loombus-gold)]">{company.momentumScore}</p></div></div><div className="mt-3 grid grid-cols-3 text-xs font-bold"><span>{company.thesisCount} theses</span><span>{company.analystCount} analysts</span><span>{company.activity30d} recent</span></div></button>)}</div>
            </div>
            <div className="grid gap-5 lg:grid-cols-3">{panels.map(({ title, items, Icon }) => <div key={title} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2"><Icon className="size-4 text-[var(--loombus-gold)]" /><h2 className="text-sm font-black uppercase">{title}</h2></div><div className="mt-3 space-y-2">{items.slice(0, 8).map((item) => <div key={item.id} className="flex justify-between gap-3 rounded-xl bg-[var(--loombus-surface-muted)] px-3 py-2"><span className="truncate text-sm font-bold">{item.label}</span><span className="text-xs font-black text-[var(--loombus-gold)]">{item.count}</span></div>)}</div></div>)}</div>
          </section>

          <aside className="space-y-5">
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2"><Activity className="size-5 text-[var(--loombus-gold)]" /><h2 className="text-lg font-black">Live Research Activity</h2></div><div className="mt-4 space-y-3">{dashboard.events.slice(0, 15).map((event) => <Link key={event.id} href={event.href ?? "/the-floor"} className="block rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><p className="text-xs font-black uppercase text-[var(--loombus-text-subtle)]">{event.ticker} · {event.type}</p><p className="mt-1 text-sm font-black">{event.title}</p><p className="mt-1 line-clamp-2 text-xs text-[var(--loombus-text-muted)]">{event.detail}</p></Link>)}</div></div>
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">{selected ? (() => { const explanation = explainFloorCompany(selected); return <><h2 className="text-lg font-black">{selected.ticker} Explainability</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Why this company appears where it does.</p><div className="mt-4 space-y-2">{explanation.reasons.map((reason) => <div key={reason} className="rounded-xl bg-[var(--loombus-surface-muted)] px-3 py-2 text-sm font-bold">{reason}</div>)}</div><p className="mt-4 text-xs leading-5 text-[var(--loombus-text-subtle)]">{explanation.disclaimer}</p>{selected.href ? <Link href={selected.href} className="mt-4 inline-flex rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black">Open Company Intelligence</Link> : null}</>; })() : <div className="py-10 text-center"><h2 className="text-lg font-black">Select a company</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Inspect the observable inputs behind its dashboard position.</p></div>}</div>
          </aside>
        </div>
        <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><p className="text-sm leading-6 text-[var(--loombus-text-muted)]"><strong className="text-[var(--loombus-text)]">Dashboard integrity:</strong> Metrics derive from existing Floor thesis records and graph relationships. They do not represent market performance, future returns, or financial advice. Missing fields remain unknown.</p></section>
      </div>
    </main>
  );
}
