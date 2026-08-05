"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { getFloorCompany } from "@/lib/floor-companies";
import { supabase } from "@/lib/supabase/client";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  Globe2,
  Landmark,
  Search,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Thesis = {
  id: string;
  ticker: string;
  stance: "long" | "short" | "neutral";
  conviction: number;
  thesis: string;
  catalysts: string;
  risks: string;
  created_at: string;
};

type View = "earnings" | "macro" | "sectors";

const MACRO_TOPICS = [
  { name: "Interest rates", terms: ["interest rate", "rates", "fed", "treasury", "yield"] },
  { name: "Inflation", terms: ["inflation", "cpi", "pricing pressure"] },
  { name: "Employment", terms: ["jobs", "employment", "labor", "wages"] },
  { name: "Energy", terms: ["oil", "energy", "power demand", "natural gas"] },
  { name: "Currency", terms: ["dollar", "currency", "foreign exchange", "fx"] },
  { name: "Regulation", terms: ["regulation", "regulatory", "antitrust", "export restriction"] },
  { name: "Supply chain", terms: ["supply chain", "capacity", "shortage", "logistics"] },
];

const card = "rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5";

function sourceText(thesis: Thesis) {
  return `${thesis.thesis} ${thesis.catalysts} ${thesis.risks}`.toLowerCase();
}

function stanceLabel(stance: Thesis["stance"]) {
  return stance === "long" ? "Bullish" : stance === "short" ? "Bearish" : "Neutral";
}

export default function TheFloorMarketIntelligence() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("earnings");
  const [query, setQuery] = useState("");
  const [theses, setTheses] = useState<Thesis[]>([]);

  useEffect(() => {
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fintelligence");
        return;
      }
      const { data } = await supabase
        .from("floor_theses")
        .select("id, ticker, stance, conviction, thesis, catalysts, risks, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      setTheses((data ?? []) as Thesis[]);
      setLoading(false);
    })();
  }, []);

  const companies = useMemo(() => {
    const grouped = new Map<string, Thesis[]>();
    for (const thesis of theses) {
      const ticker = thesis.ticker.toUpperCase();
      grouped.set(ticker, [...(grouped.get(ticker) ?? []), thesis]);
    }
    return [...grouped.entries()]
      .map(([ticker, records]) => {
        const company = getFloorCompany(ticker);
        return {
          ...company,
          records,
          latest: records[0],
          averageConviction: records.reduce((sum, item) => sum + item.conviction, 0) / records.length,
        };
      })
      .filter((company) => !query.trim() || `${company.ticker} ${company.name} ${company.sector ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  }, [query, theses]);

  const sectors = useMemo(() => {
    const grouped = new Map<string, typeof companies>();
    for (const company of companies) {
      const sector = company.sector ?? "Unclassified";
      grouped.set(sector, [...(grouped.get(sector) ?? []), company]);
    }
    return [...grouped.entries()]
      .map(([name, members]) => ({
        name,
        members,
        thesisCount: members.reduce((sum, item) => sum + item.records.length, 0),
        analystConviction: members.reduce((sum, item) => sum + item.averageConviction, 0) / members.length,
        latestAt: members.map((item) => item.latest?.created_at ?? "").sort().reverse()[0] ?? null,
      }))
      .sort((a, b) => b.thesisCount - a.thesisCount);
  }, [companies]);

  const macro = useMemo(() => MACRO_TOPICS.map((topic) => {
    const records = theses.filter((thesis) => topic.terms.some((term) => sourceText(thesis).includes(term)));
    return {
      ...topic,
      records,
      companies: new Set(records.map((record) => record.ticker)).size,
      risks: records.filter((record) => topic.terms.some((term) => record.risks.toLowerCase().includes(term))).length,
    };
  }).sort((a, b) => b.records.length - a.records.length), [theses]);

  if (loading) return <LoombusLoadingScreen title="Opening Market Intelligence..." message="Organizing earnings, macro, and sector research." />;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className={card}>
          <Link href="/the-floor" className="inline-flex items-center gap-2 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-4" /> Back to The Floor</Link>
          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Research-wide monitoring</p>
              <h1 className="mt-1 text-3xl font-black">Market Intelligence</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Study earnings-related research, macro exposure, and sector activity without converting research signals into market forecasts.</p>
            </div>
            <label className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4">
              <Search className="size-4 text-[var(--loombus-text-subtle)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 bg-transparent text-sm outline-none" placeholder="Company, ticker, or sector" />
            </label>
          </div>
          <nav className="mt-5 flex gap-2 overflow-x-auto" aria-label="Market intelligence sections">
            {([
              ["earnings", "Earnings Center", CalendarDays],
              ["macro", "Macro Intelligence", Globe2],
              ["sectors", "Sector Dashboards", BarChart3],
            ] as const).map(([id, label, Icon]) => (
              <button key={id} onClick={() => setView(id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black ${view === id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><Icon className="size-4 text-[var(--loombus-gold)]" /> {label}</button>
            ))}
          </nav>
        </header>

        {view === "earnings" ? (
          <>
            <section className="grid gap-3 sm:grid-cols-3">
              {[
                ["Covered companies", companies.length],
                ["Recent theses", theses.length],
                ["Earnings feed", "Connection ready"],
              ].map(([label, value]) => <div key={String(label)} className={card}><p className="text-xs font-black uppercase text-[var(--loombus-text-subtle)]">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
            </section>
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black">Company earnings research</h2><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">The newest thesis, disclosed catalysts, and risks for each covered company.</p></div><Link href="/the-floor/earnings" className="rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-xs font-black text-black">Open live Earnings Center</Link></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {companies.map((company) => (
                  <Link key={company.ticker} href={`/the-floor/company/${company.ticker}`} className="rounded-2xl border border-[var(--loombus-border)] p-4 transition hover:border-[var(--loombus-gold)]">
                    <div className="flex items-start justify-between gap-3"><div><p className="font-black">{company.ticker} · {company.name}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{company.records.length} {company.records.length === 1 ? "thesis" : "theses"} · Avg. conviction {company.averageConviction.toFixed(1)}/5</p></div><ChevronRight className="size-4" /></div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{company.latest?.thesis}</p>
                    <div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-[var(--loombus-surface-muted)] px-2 py-1 text-[10px] font-black">{stanceLabel(company.latest.stance)}</span>{company.sector ? <span className="rounded-full bg-[var(--loombus-surface-muted)] px-2 py-1 text-[10px] font-black">{company.sector}</span> : null}</div>
                  </Link>
                ))}
              </div>
            </section>
          </>
        ) : null}

        {view === "macro" ? (
          <section className="grid gap-4 md:grid-cols-2">
            {macro.map((topic) => (
              <article key={topic.name} className={card}>
                <div className="flex items-start justify-between gap-3"><div><Landmark className="size-5 text-[var(--loombus-gold)]" /><h2 className="mt-3 text-lg font-black">{topic.name}</h2></div><span className="text-2xl font-black">{topic.records.length}</span></div>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{topic.companies} connected {topic.companies === 1 ? "company" : "companies"} · {topic.risks} explicit risk {topic.risks === 1 ? "mention" : "mentions"}</p>
                <div className="mt-4 flex flex-wrap gap-2">{[...new Set(topic.records.map((record) => record.ticker))].slice(0, 12).map((ticker) => <Link key={ticker} href={`/the-floor/company/${ticker}`} className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-black text-[var(--loombus-gold)]">{ticker}</Link>)}</div>
                {!topic.records.length ? <p className="mt-4 rounded-2xl border border-dashed border-[var(--loombus-border)] p-4 text-xs text-[var(--loombus-text-muted)]">No explicit Floor research connection has been observed yet.</p> : null}
              </article>
            ))}
          </section>
        ) : null}

        {view === "sectors" ? (
          <section className="space-y-4">
            {sectors.map((sector) => (
              <article key={sector.name} className={card}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-xs font-black uppercase text-[var(--loombus-gold)]">Sector dashboard</p><h2 className="mt-1 text-xl font-black">{sector.name}</h2><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{sector.members.length} covered companies · {sector.thesisCount} theses · Average disclosed conviction {sector.analystConviction.toFixed(1)}/5</p></div>
                  <TrendingUp className="size-7 text-[var(--loombus-gold)]" />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{sector.members.map((company) => <Link key={company.ticker} href={`/the-floor/company/${company.ticker}`} className="flex items-center justify-between rounded-2xl bg-[var(--loombus-surface-muted)] p-3"><span><strong>{company.ticker}</strong><small className="ml-2 text-[var(--loombus-text-muted)]">{company.records.length} theses</small></span><Building2 className="size-4" /></Link>)}</div>
              </article>
            ))}
          </section>
        ) : null}

        <section className={card}><p className="text-xs leading-5 text-[var(--loombus-text-muted)]"><strong className="text-[var(--loombus-text)]">Integrity:</strong> This center organizes observable Floor research. It does not infer financial results, live economic data, stock performance, or future returns. External earnings and macro feeds remain clearly marked until connected.</p></section>
      </div>
    </main>
  );
}
