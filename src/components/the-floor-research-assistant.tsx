"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { buildResearchAssistantBrief, type ResearchAssistantThesis } from "@/lib/floor-research-assistant";
import { companyPath, normalizeFloorTicker } from "@/lib/floor-companies";
import { supabase } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, BrainCircuit, Search, ShieldQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export default function TheFloorResearchAssistant() {
  const [loading, setLoading] = useState(true);
  const [ticker, setTicker] = useState("");
  const [activeTicker, setActiveTicker] = useState("");
  const [theses, setTheses] = useState<ResearchAssistantThesis[]>([]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        window.location.replace("/login?next=%2Fthe-floor%2Fresearch-assistant");
        return;
      }
      const { data } = await supabase
        .from("floor_theses")
        .select("id, ticker, stance, conviction, thesis, catalysts, risks, exit_plan, created_at, floor_calls(status, outcome)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (mounted) {
        setTheses((data ?? []) as unknown as ResearchAssistantThesis[]);
        setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const brief = useMemo(
    () => (activeTicker ? buildResearchAssistantBrief(activeTicker, theses) : null),
    [activeTicker, theses]
  );

  if (loading) {
    return <LoombusLoadingScreen title="Loading Research Assistant..." message="Organizing Floor evidence and recorded outcomes." />;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]">
            <ArrowLeft className="size-3.5" /> Back to The Floor
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <BrainCircuit className="mt-1 size-7 text-[var(--loombus-gold)]" />
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Research Assistant</h1>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Ask the platform to organize published theses, disagreement, disclosed risks, catalysts, and resolved calls. It does not issue buy or sell ratings.
              </p>
            </div>
          </div>
          <form
            className="mt-5 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const normalized = normalizeFloorTicker(ticker);
              if (normalized) setActiveTicker(normalized);
            }}
          >
            <input
              value={ticker}
              onChange={(event) => setTicker(event.target.value.toUpperCase())}
              placeholder="Enter a ticker, such as NVDA"
              className="min-h-12 flex-1 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm outline-none focus:border-amber-400"
            />
            <button className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-[#cbab5b] px-5 text-sm font-black text-[#17120a]">
              <Search className="size-4" /> Research
            </button>
          </form>
        </header>

        {!brief ? (
          <section className="rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
            <ShieldQuestion className="mx-auto size-8 text-[var(--loombus-text-subtle)]" />
            <p className="mt-3 text-sm font-bold text-[var(--loombus-text-muted)]">Enter a ticker to build an evidence brief from The Floor.</p>
          </section>
        ) : (
          <>
            <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-gold)]">{brief.ticker}</p>
                  <h2 className="mt-1 text-xl font-black">{brief.companyName}</h2>
                </div>
                <Link href={companyPath(brief.ticker)} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-xs font-black">
                  Open Company Intelligence
                </Link>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--loombus-text-muted)]">{brief.synthesis}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                {[
                  ["Research", brief.thesisCount],
                  ["Bull", brief.stance.bull],
                  ["Bear", brief.stance.bear],
                  ["Neutral", brief.stance.neutral],
                  ["Avg. conviction", brief.averageConviction ?? "—"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-[var(--loombus-page-bg)] p-3">
                    <p className="text-xs font-bold text-[var(--loombus-text-subtle)]">{label}</p>
                    <p className="mt-1 text-lg font-black">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              {[
                ["Catalysts in published research", brief.catalysts],
                ["Risks in published research", brief.risks],
                ["Questions still unresolved", brief.unresolvedQuestions],
              ].map(([title, items]) => (
                <section key={title as string} className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <h3 className="font-black">{title as string}</h3>
                  {(items as string[]).length ? (
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {(items as string[]).map((item) => <li key={item} className="rounded-2xl bg-[var(--loombus-page-bg)] p-3">{item}</li>)}
                    </ul>
                  ) : <p className="mt-3 text-sm text-[var(--loombus-text-subtle)]">No structured evidence is available yet.</p>}
                </section>
              ))}
              <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <h3 className="font-black">Recorded accountability</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(brief.accountability).map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-[var(--loombus-page-bg)] p-3">
                      <p className="capitalize text-[var(--loombus-text-subtle)]">{label}</p>
                      <p className="mt-1 text-lg font-black">{value}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
