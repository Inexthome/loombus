"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import {
  buildFloorDiscoveryCompanies,
  defaultFloorDiscoveryFilters,
  describeFloorDiscoveryScreen,
  dominantFloorDiscoveryStance,
  filterFloorDiscoveryCompanies,
  type FloorDiscoveryCompany,
  type FloorDiscoveryFilters,
  type FloorSavedScreen,
} from "@/lib/floor-discovery";
import { buildFloorKnowledgeGraph, type FloorGraphRecord } from "@/lib/floor-knowledge-graph";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BarChart3, Bookmark, GitCompareArrows, Radar, RotateCcw, Search, ShieldAlert, Sparkles, Target, X, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "the-floor-discovery-screens-v1";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[var(--loombus-border-muted)] bg-[var(--loombus-surface-muted)] p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{label}</p>
      <p className="mt-1 text-lg font-black text-[var(--loombus-text)]">{value}</p>
    </div>
  );
}

function CompanyCard({ company, selected, onCompare }: { company: FloorDiscoveryCompany; selected: boolean; onCompare: () => void }) {
  const stance = dominantFloorDiscoveryStance(company);
  return (
    <article className="rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-black">{company.ticker}</p>
          <p className="text-xs font-bold text-[var(--loombus-text-muted)]">{company.name ?? "Company Intelligence"}</p>
        </div>
        <button type="button" onClick={onCompare} className={`rounded-full border px-3 py-2 text-xs font-black ${selected ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}>
          {selected ? "Comparing" : "Compare"}
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Theses" value={company.thesisCount} />
        <Stat label="Analysts" value={company.analystCount} />
        <Stat label="Evidence" value={company.evidenceCount} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Stat label="Research momentum" value={company.momentumScore} />
        <Stat label="Avg conviction" value={company.averageConviction ?? "N/A"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1 capitalize">{stance} balance</span>
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1">{company.activity30d} active / 30d</span>
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1">{company.riskCount} risks</span>
        <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1">{company.catalystCount} catalysts</span>
      </div>
      <div className="mt-4 flex gap-2">
        {company.href ? <Link href={company.href} className="inline-flex min-h-10 items-center rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-black text-black">Open company</Link> : null}
        <Link href="/the-floor/knowledge-graph" className="inline-flex min-h-10 items-center rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black">View graph</Link>
      </div>
    </article>
  );
}

export default function TheFloorDiscovery() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FloorGraphRecord[]>([]);
  const [filters, setFilters] = useState<FloorDiscoveryFilters>(() => defaultFloorDiscoveryFilters());
  const [savedScreens, setSavedScreens] = useState<FloorSavedScreen[]>([]);
  const [screenName, setScreenName] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.replace("/login?next=%2Fthe-floor%2Fdiscover");
      return;
    }
    const { data, error } = await supabase.from("floor_theses").select("*").order("created_at", { ascending: false }).limit(300);
    if (!error && data) setRecords(data as FloorGraphRecord[]);
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setSavedScreens(JSON.parse(stored) as FloorSavedScreen[]);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const graph = useMemo(() => buildFloorKnowledgeGraph(records), [records]);
  const companies = useMemo(() => buildFloorDiscoveryCompanies(graph, records), [graph, records]);
  const results = useMemo(() => filterFloorDiscoveryCompanies(companies, filters), [companies, filters]);
  const compared = companies.filter((company) => compareIds.includes(company.id));

  function update<K extends keyof FloorDiscoveryFilters>(key: K, value: FloorDiscoveryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function saveScreen() {
    const name = screenName.trim();
    if (!name) return;
    const next: FloorSavedScreen[] = [{ id: crypto.randomUUID(), name, createdAt: new Date().toISOString(), filters }, ...savedScreens].slice(0, 20);
    setSavedScreens(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setScreenName("");
  }

  function removeScreen(id: string) {
    const next = savedScreens.filter((screen) => screen.id !== id);
    setSavedScreens(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function toggleCompare(id: string) {
    setCompareIds((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 5 ? [...current, id] : current);
  }

  if (loading) return <LoombusLoadingScreen title="Building discovery signals..." message="Connecting companies, themes, risks, catalysts, evidence, and research activity." />;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]"><ArrowLeft className="size-3.5" />Back to The Floor</Link>
          <div className="mt-3 flex items-start gap-3"><Radar className="mt-1 size-7 text-[var(--loombus-gold)]" /><div><h1 className="text-2xl font-black sm:text-3xl">Graph-Powered Discovery</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Discover companies through observable Floor research signals. Momentum reflects research activity, never expected market performance.</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><Stat label="Companies" value={companies.length} /><Stat label="Themes" value={graph.themes.length} /><Stat label="Shared risks" value={graph.risks.length} /><Stat label="Catalysts" value={graph.catalysts.length} /></div>
        </header>

        <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-black">Company Screener</h2><p className="text-xs font-bold text-[var(--loombus-text-muted)]">{describeFloorDiscoveryScreen(filters)}</p></div><button type="button" onClick={() => setFilters(defaultFloorDiscoveryFilters())} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"><RotateCcw className="size-3.5" />Reset</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex items-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3"><Search className="size-4" /><input value={filters.query} onChange={(event) => update("query", event.target.value)} placeholder="Ticker or company" className="min-h-11 w-full bg-transparent text-sm font-bold outline-none" /></label>
            <select value={filters.stance} onChange={(event) => update("stance", event.target.value as FloorDiscoveryFilters["stance"])} className="min-h-11 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-bold"><option value="all">All stance balances</option><option value="bullish">Bullish balance</option><option value="bearish">Bearish balance</option><option value="neutral">Neutral balance</option></select>
            <select value={filters.themeId} onChange={(event) => update("themeId", event.target.value)} className="min-h-11 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-bold"><option value="">All themes</option>{graph.themes.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select>
            <select value={filters.riskId} onChange={(event) => update("riskId", event.target.value)} className="min-h-11 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-bold"><option value="">All risks</option>{graph.risks.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select>
            <select value={filters.catalystId} onChange={(event) => update("catalystId", event.target.value)} className="min-h-11 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-bold"><option value="">All catalysts</option>{graph.catalysts.map((node) => <option key={node.id} value={node.id}>{node.label}</option>)}</select>
            <label className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-xs font-black">Minimum theses<input type="number" min="0" value={filters.minimumTheses} onChange={(event) => update("minimumTheses", Number(event.target.value))} className="mt-1 w-full bg-transparent text-sm outline-none" /></label>
            <label className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-xs font-black">Minimum analysts<input type="number" min="0" value={filters.minimumAnalysts} onChange={(event) => update("minimumAnalysts", Number(event.target.value))} className="mt-1 w-full bg-transparent text-sm outline-none" /></label>
            <label className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-2 text-xs font-black">Minimum evidence<input type="number" min="0" value={filters.minimumEvidence} onChange={(event) => update("minimumEvidence", Number(event.target.value))} className="mt-1 w-full bg-transparent text-sm outline-none" /></label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-xs font-black"><input type="checkbox" checked={filters.activeOnly} onChange={(event) => update("activeOnly", event.target.checked)} />Only companies with research activity in the last 30 days</label>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section><div className="mb-3 flex items-center justify-between"><h2 className="font-black">{results.length} matching companies</h2><p className="text-xs font-bold text-[var(--loombus-text-muted)]">Ranked by explainable research momentum</p></div><div className="grid gap-4 md:grid-cols-2">{results.map((company) => <CompanyCard key={company.id} company={company} selected={compareIds.includes(company.id)} onCompare={() => toggleCompare(company.id)} />)}{results.length === 0 ? <div className="col-span-full rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center"><Search className="mx-auto size-8 text-[var(--loombus-gold)]" /><p className="mt-3 font-black">No companies match this screen.</p></div> : null}</div></section>
          <aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2"><Bookmark className="size-4 text-[var(--loombus-gold)]" /><h2 className="font-black">Saved Screens</h2></div><div className="mt-3 flex gap-2"><input value={screenName} onChange={(event) => setScreenName(event.target.value)} placeholder="Name this screen" className="min-h-10 min-w-0 flex-1 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 text-sm font-bold outline-none" /><button type="button" onClick={saveScreen} className="rounded-xl bg-[var(--loombus-gold)] px-3 text-xs font-black text-black">Save</button></div><div className="mt-3 space-y-2">{savedScreens.map((screen) => <div key={screen.id} className="rounded-xl border border-[var(--loombus-border-muted)] p-3"><div className="flex justify-between gap-2"><button type="button" onClick={() => setFilters(screen.filters)} className="text-left"><p className="text-sm font-black">{screen.name}</p><p className="mt-1 text-[10px] font-bold text-[var(--loombus-text-subtle)]">{describeFloorDiscoveryScreen(screen.filters)}</p></button><button type="button" onClick={() => removeScreen(screen.id)}><X className="size-4" /></button></div></div>)}{!savedScreens.length ? <p className="py-4 text-center text-xs font-bold text-[var(--loombus-text-muted)]">Saved screens stay private in this browser.</p> : null}</div></div>
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2"><GitCompareArrows className="size-4 text-[var(--loombus-gold)]" /><h2 className="font-black">Compare Workspace</h2></div><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">Select up to five companies.</p><div className="mt-3 space-y-2">{compared.map((company) => <div key={company.id} className="rounded-xl border border-[var(--loombus-border-muted)] p-3"><div className="flex items-center justify-between"><p className="font-black">{company.ticker}</p><button type="button" onClick={() => toggleCompare(company.id)}><X className="size-4" /></button></div><div className="mt-2 grid grid-cols-2 gap-1 text-[10px] font-bold"><span>Momentum {company.momentumScore}</span><span>Theses {company.thesisCount}</span><span>Evidence {company.evidenceCount}</span><span>Risks {company.riskCount}</span></div></div>)}{!compared.length ? <p className="py-4 text-center text-xs font-bold text-[var(--loombus-text-muted)]">Choose companies from the results to compare their research footprint.</p> : null}</div></div>
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2"><Sparkles className="size-4 text-[var(--loombus-gold)]" /><h2 className="font-black">Discovery prompts</h2></div><div className="mt-3 space-y-2 text-xs font-bold text-[var(--loombus-text-muted)]"><p className="flex gap-2"><Target className="size-4 shrink-0" />Find evidence-dense companies with limited analyst coverage.</p><p className="flex gap-2"><ShieldAlert className="size-4 shrink-0" />Explore companies sharing a disclosed risk.</p><p className="flex gap-2"><Zap className="size-4 shrink-0" />Compare recurring catalysts across active research.</p><p className="flex gap-2"><BarChart3 className="size-4 shrink-0" />Use momentum to inspect research activity, not price direction.</p></div></div>
          </aside>
        </div>
      </div>
    </main>
  );
}
