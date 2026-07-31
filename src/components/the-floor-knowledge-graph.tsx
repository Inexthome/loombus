"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import {
  buildFloorKnowledgeGraph,
  connectedFloorNodes,
  type FloorGraphNode,
  type FloorGraphRecord,
} from "@/lib/floor-knowledge-graph";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, Building2, CircleDot, GitFork, Link2, Search, ShieldAlert, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const NODE_ICONS = {
  company: Building2,
  thesis: CircleDot,
  analyst: Sparkles,
  catalyst: Zap,
  risk: ShieldAlert,
  theme: GitFork,
  evidence: Link2,
} as const;

function nodeLabel(node: FloorGraphNode) {
  return node.count > 1 ? `${node.label} · ${node.count}` : node.label;
}

export default function TheFloorKnowledgeGraph() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<FloorGraphRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      window.location.replace("/login?next=%2Fthe-floor%2Fknowledge-graph");
      return;
    }

    const { data, error } = await supabase
      .from("floor_theses")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (!error && data) setRecords(data as FloorGraphRecord[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const graph = useMemo(() => buildFloorKnowledgeGraph(records), [records]);
  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const connected = selected ? connectedFloorNodes(graph, selected.id) : [];
  const normalizedQuery = query.trim().toLowerCase();
  const searchResults = normalizedQuery
    ? graph.nodes
        .filter((node) => `${node.label} ${node.subtitle ?? ""} ${node.type}`.toLowerCase().includes(normalizedQuery))
        .sort((a, b) => b.count - a.count)
        .slice(0, 40)
    : [];

  if (loading) {
    return <LoombusLoadingScreen title="Building the research graph..." message="Connecting companies, analysts, theses, catalysts, risks, themes, and evidence." />;
  }

  function NodeButton({ node }: { node: FloorGraphNode }) {
    const Icon = NODE_ICONS[node.type];
    return (
      <button
        type="button"
        onClick={() => setSelectedId(node.id)}
        className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
          selectedId === node.id
            ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]"
            : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] hover:border-[var(--loombus-gold)]"
        }`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[var(--loombus-surface-muted)]">
          <Icon className="size-4 text-[var(--loombus-gold)]" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-[var(--loombus-text)]">{nodeLabel(node)}</span>
          <span className="block truncate text-xs font-bold capitalize text-[var(--loombus-text-subtle)]">
            {node.subtitle ?? node.type}
          </span>
        </span>
      </button>
    );
  }

  const sections = [
    { title: "Companies", items: graph.companies.slice(0, 12) },
    { title: "Themes", items: graph.themes.slice(0, 12) },
    { title: "Shared risks", items: graph.risks.slice(0, 12) },
    { title: "Recurring catalysts", items: graph.catalysts.slice(0, 12) },
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)] hover:text-[var(--loombus-text)]">
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            Back to The Floor
          </Link>
          <div className="mt-3 flex items-start gap-3">
            <GitFork className="mt-1 size-7 text-[var(--loombus-gold)]" aria-hidden="true" />
            <div>
              <h1 className="text-2xl font-black sm:text-3xl">Research Knowledge Graph</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Explore observable relationships across Floor research. Connections come from published theses and disclosed evidence, not inferred market claims.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Nodes", graph.nodes.length],
              ["Relationships", graph.edges.length],
              ["Companies", graph.companies.length],
              ["Themes", graph.themes.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl border border-[var(--loombus-border-muted)] bg-[var(--loombus-surface-muted)] p-3">
                <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{label}</p>
                <p className="mt-1 text-xl font-black">{value}</p>
              </div>
            ))}
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="space-y-5">
            <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
              <label className="flex items-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3">
                <Search className="size-4 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search companies, themes, risks, catalysts, analysts..."
                  className="min-h-11 w-full bg-transparent text-sm font-bold outline-none placeholder:text-[var(--loombus-text-subtle)]"
                />
              </label>
              {normalizedQuery ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {searchResults.length ? searchResults.map((node) => <NodeButton key={node.id} node={node} />) : (
                    <p className="col-span-full py-6 text-center text-sm font-bold text-[var(--loombus-text-muted)]">No graph nodes match that search.</p>
                  )}
                </div>
              ) : null}
            </div>

            {!normalizedQuery ? sections.map((section) => (
              <div key={section.title} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <h2 className="text-sm font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">{section.title}</h2>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {section.items.length ? section.items.map((node) => <NodeButton key={node.id} node={node} />) : (
                    <p className="col-span-full py-5 text-sm font-bold text-[var(--loombus-text-muted)]">No structured {section.title.toLowerCase()} are available yet.</p>
                  )}
                </div>
              </div>
            )) : null}
          </section>

          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/10">
              {selected ? (
                <>
                  <p className="text-xs font-black uppercase tracking-wide text-[var(--loombus-text-subtle)]">Selected {selected.type}</p>
                  <h2 className="mt-2 text-xl font-black">{selected.label}</h2>
                  {selected.subtitle ? <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{selected.subtitle}</p> : null}
                  <p className="mt-3 text-xs font-bold text-[var(--loombus-text-subtle)]">Observed in {selected.count} research connection{selected.count === 1 ? "" : "s"}.</p>
                  {selected.href ? (
                    <Link href={selected.href} className="mt-4 inline-flex min-h-10 items-center rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-black text-black">
                      Open source object
                    </Link>
                  ) : null}
                  <div className="mt-5 border-t border-[var(--loombus-border-muted)] pt-4">
                    <h3 className="text-sm font-black">Direct connections</h3>
                    <div className="mt-3 flex flex-col gap-2">
                      {connected.length ? connected.slice(0, 30).map((node) => <NodeButton key={node.id} node={node} />) : (
                        <p className="text-sm font-bold text-[var(--loombus-text-muted)]">No direct connections were found.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-10 text-center">
                  <GitFork className="mx-auto size-9 text-[var(--loombus-gold)]" aria-hidden="true" />
                  <h2 className="mt-3 text-lg font-black">Select a node</h2>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--loombus-text-muted)]">
                    Choose any company, theme, risk, catalyst, analyst, thesis, or evidence item to inspect its direct relationships.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
