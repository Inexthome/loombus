"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CircleDot,
  Filter,
  GitBranch,
  Loader2,
  MessageSquare,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type NodeKind = "publication" | "claim" | "knowledge" | "discussion";
type GraphNode = {
  id: string;
  kind: NodeKind;
  title: string;
  subtitle?: string | null;
  type?: string | null;
  status?: string | null;
  href?: string | null;
};
type GraphEdge = { id: string; from: string; to: string; label: string; family: "evidence" | "membership" | "derivation" | "promotion" };

type Claim = { id: string; statement: string; claim_type: string; status: string };
type Knowledge = { id: string; title: string; summary: string | null; knowledge_type: string; status: string };
type ResearchItem = { id: string; publication_id: string };
type Evidence = { claim_id: string; research_item_id: string; relation: string };
type KnowledgeClaim = { knowledge_object_id: string; claim_id: string; role: string };
type Publication = { id: string; title: string; author_name: string | null };
type Discussion = { id: string; title: string; topic: string };
type DiscussionClaimDerivation = { discussion_id: string; claim_id: string | null };
type DiscussionKnowledgeDerivation = { discussion_id: string; knowledge_object_id: string | null };
type ReplyClaimDerivation = { discussion_id: string; reply_id: string; claim_id: string | null };
type ReplyKnowledgeDerivation = { discussion_id: string; reply_id: string; knowledge_object_id: string | null };
type Promotion = { discussion_id: string; knowledge_object_id: string | null };

const kindLabel: Record<NodeKind, string> = {
  publication: "Publications",
  claim: "Claims",
  knowledge: "Knowledge",
  discussion: "Discussions",
};
const kindOrder: NodeKind[] = ["publication", "claim", "knowledge", "discussion"];
const relationOptions = [
  "supports",
  "challenges",
  "context",
  "core",
  "supporting",
  "counterpoint",
  "derived from opening post",
  "derived from reply",
  "promoted to discussion",
];

function nodeKey(kind: NodeKind, id: string) {
  return `${kind}:${id}`;
}
function compact(value: string, max = 150) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function iconFor(kind: NodeKind) {
  if (kind === "publication") return BookOpen;
  if (kind === "discussion") return MessageSquare;
  return CircleDot;
}

export function LibraryKnowledgeGraphV2Surface() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NodeKind | "all">("all");
  const [relationFilter, setRelationFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to view your private Library Knowledge Graph.");
      setLoading(false);
      return;
    }

    const [claimsResult, knowledgeResult, itemsResult, evidenceResult, membershipsResult, discussionClaimResult, discussionKnowledgeResult, replyClaimResult, replyKnowledgeResult, promotionsResult] = await Promise.all([
      supabase.from("library_research_claims").select("id, statement, claim_type, status"),
      supabase.from("library_knowledge_objects").select("id, title, summary, knowledge_type, status"),
      supabase.from("library_research_items").select("id, publication_id"),
      supabase.from("library_research_claim_evidence").select("claim_id, research_item_id, relation"),
      supabase.from("library_knowledge_claims").select("knowledge_object_id, claim_id, role"),
      supabase.from("library_discussion_claim_derivations").select("discussion_id, claim_id"),
      supabase.from("library_discussion_knowledge_derivations").select("discussion_id, knowledge_object_id"),
      supabase.from("library_reply_claim_derivations").select("discussion_id, reply_id, claim_id"),
      supabase.from("library_reply_knowledge_derivations").select("discussion_id, reply_id, knowledge_object_id"),
      supabase.from("library_knowledge_discussion_promotions").select("discussion_id, knowledge_object_id"),
    ]);
    const required = [claimsResult, knowledgeResult, itemsResult, evidenceResult, membershipsResult, discussionClaimResult, discussionKnowledgeResult, replyClaimResult, replyKnowledgeResult, promotionsResult];
    if (required.some((result) => result.error)) {
      setError("Unable to load the complete private knowledge network.");
      setLoading(false);
      return;
    }

    const claims = (claimsResult.data ?? []) as Claim[];
    const knowledge = (knowledgeResult.data ?? []) as Knowledge[];
    const items = (itemsResult.data ?? []) as ResearchItem[];
    const evidence = (evidenceResult.data ?? []) as Evidence[];
    const memberships = (membershipsResult.data ?? []) as KnowledgeClaim[];
    const discussionClaims = (discussionClaimResult.data ?? []) as DiscussionClaimDerivation[];
    const discussionKnowledge = (discussionKnowledgeResult.data ?? []) as DiscussionKnowledgeDerivation[];
    const replyClaims = (replyClaimResult.data ?? []) as ReplyClaimDerivation[];
    const replyKnowledge = (replyKnowledgeResult.data ?? []) as ReplyKnowledgeDerivation[];
    const promotions = (promotionsResult.data ?? []) as Promotion[];

    const publicationIds = [...new Set(items.map((item) => item.publication_id))];
    const discussionIds = [...new Set([
      ...discussionClaims.map((row) => row.discussion_id),
      ...discussionKnowledge.map((row) => row.discussion_id),
      ...replyClaims.map((row) => row.discussion_id),
      ...replyKnowledge.map((row) => row.discussion_id),
      ...promotions.map((row) => row.discussion_id),
    ])];
    const [publicationResult, discussionResult] = await Promise.all([
      publicationIds.length ? supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds) : Promise.resolve({ data: [], error: null }),
      discussionIds.length ? supabase.from("discussions").select("id, title, topic").in("id", discussionIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    if (publicationResult.error || discussionResult.error) setError("The graph loaded, but some source labels are unavailable.");

    const publications = (publicationResult.data ?? []) as Publication[];
    const discussions = (discussionResult.data ?? []) as Discussion[];
    const nextNodes: GraphNode[] = [
      ...publications.map((row) => ({ id: row.id, kind: "publication" as const, title: row.title, subtitle: row.author_name, type: "publication", href: `/library/read/${row.id}` })),
      ...claims.map((row) => ({ id: row.id, kind: "claim" as const, title: compact(row.statement), subtitle: `${pretty(row.claim_type)} · ${pretty(row.status)}`, type: row.claim_type, status: row.status, href: "/library/research/evidence" })),
      ...knowledge.map((row) => ({ id: row.id, kind: "knowledge" as const, title: row.title, subtitle: `${pretty(row.knowledge_type)} · ${pretty(row.status)}`, type: row.knowledge_type, status: row.status, href: "/library/research/evidence" })),
      ...discussions.map((row) => ({ id: row.id, kind: "discussion" as const, title: row.title, subtitle: row.topic, type: row.topic, href: `/discussions/${row.id}` })),
    ];

    const itemById = new Map(items.map((item) => [item.id, item]));
    const nextEdges: GraphEdge[] = [];
    const push = (from: string, to: string, label: string, family: GraphEdge["family"]) => {
      const id = `${from}|${to}|${label}`;
      if (!nextEdges.some((edge) => edge.id === id)) nextEdges.push({ id, from, to, label, family });
    };
    for (const row of evidence) {
      const item = itemById.get(row.research_item_id);
      if (item) push(nodeKey("publication", item.publication_id), nodeKey("claim", row.claim_id), row.relation, "evidence");
    }
    for (const row of memberships) push(nodeKey("claim", row.claim_id), nodeKey("knowledge", row.knowledge_object_id), row.role, "membership");
    for (const row of discussionClaims) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from opening post", "derivation");
    for (const row of discussionKnowledge) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from opening post", "derivation");
    for (const row of replyClaims) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from reply", "derivation");
    for (const row of replyKnowledge) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from reply", "derivation");
    for (const row of promotions) if (row.knowledge_object_id) push(nodeKey("knowledge", row.knowledge_object_id), nodeKey("discussion", row.discussion_id), "promoted to discussion", "promotion");

    const nodeKeys = new Set(nextNodes.map((node) => nodeKey(node.kind, node.id)));
    setNodes(nextNodes);
    setEdges(nextEdges.filter((edge) => nodeKeys.has(edge.from) && nodeKeys.has(edge.to)));
    setLoading(false);
  }, []);

  useEffect(() => { void loadGraph(); }, [loadGraph]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [nodeKey(node.kind, node.id), node])), [nodes]);
  const selectedNode = selectedKey ? nodeMap.get(selectedKey) ?? null : null;
  const selectedEdges = useMemo(() => selectedKey ? edges.filter((edge) => edge.from === selectedKey || edge.to === selectedKey) : [], [edges, selectedKey]);
  const allowedEdgeIds = useMemo(() => new Set(edges.filter((edge) => relationFilter === "all" || edge.label === relationFilter).map((edge) => edge.id)), [edges, relationFilter]);
  const connectedKeys = useMemo(() => new Set(selectedEdges.filter((edge) => allowedEdgeIds.has(edge.id)).flatMap((edge) => [edge.from, edge.to])), [allowedEdgeIds, selectedEdges]);
  const needle = query.trim().toLocaleLowerCase();
  const statuses = useMemo(() => [...new Set(nodes.map((node) => node.status).filter((value): value is string => Boolean(value)))].sort(), [nodes]);

  const visibleByKind = useMemo(() => {
    const map = new Map<NodeKind, GraphNode[]>();
    for (const kind of kindOrder) {
      const rows = nodes.filter((node) => {
        if (node.kind !== kind) return false;
        if (kindFilter !== "all" && node.kind !== kindFilter) return false;
        if (statusFilter !== "all" && node.status !== statusFilter) return false;
        if (needle && ![node.title, node.subtitle, node.type, node.status].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(needle))) return false;
        if (relationFilter !== "all") {
          const key = nodeKey(node.kind, node.id);
          if (!edges.some((edge) => allowedEdgeIds.has(edge.id) && (edge.from === key || edge.to === key))) return false;
        }
        return true;
      });
      map.set(kind, rows);
    }
    return map;
  }, [allowedEdgeIds, edges, kindFilter, needle, nodes, relationFilter, statusFilter]);

  const activeFilterCount = [kindFilter !== "all", relationFilter !== "all", statusFilter !== "all"].filter(Boolean).length;
  const clearFilters = () => { setKindFilter("all"); setRelationFilter("all"); setStatusFilter("all"); };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href="/library/research/evidence" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Evidence & Knowledge</Link>
          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Private relationship map · v2</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Knowledge Graph</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Investigate how publications, claims, synthesized knowledge, and discussions connect. Filter the network, inspect directionality, and jump into the provenance behind a relationship. This graph is private and read-only.</p>
            </div>
            <Link href="/library/research/evidence/provenance" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)]"><GitBranch className="size-4" /> Provenance</Link>
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4" aria-label="Knowledge Graph filters">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-3 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-2.5">
              <Search className="size-4 text-[var(--loombus-text-subtle)]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles, types, topics, and statuses…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <div className="grid gap-2 sm:grid-cols-3 xl:w-[610px]">
              <label className="flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-xs font-black"><Filter className="size-3.5" /><select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as NodeKind | "all")} className="min-w-0 flex-1 bg-transparent text-sm font-normal outline-none"><option value="all">All node types</option>{kindOrder.map((kind) => <option key={kind} value={kind}>{kindLabel[kind]}</option>)}</select></label>
              <label className="rounded-xl border border-[var(--loombus-border)] px-3 py-2"><select value={relationFilter} onChange={(e) => setRelationFilter(e.target.value)} className="w-full bg-transparent text-sm outline-none"><option value="all">All relationships</option>{relationOptions.map((relation) => <option key={relation} value={relation}>{pretty(relation)}</option>)}</select></label>
              <label className="rounded-xl border border-[var(--loombus-border)] px-3 py-2"><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full bg-transparent text-sm outline-none"><option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{pretty(status)}</option>)}</select></label>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--loombus-text-subtle)]">
            <span>{nodes.length} nodes · {edges.length} relationships{activeFilterCount ? ` · ${activeFilterCount} active filters` : ""}</span>
            {activeFilterCount ? <button type="button" onClick={clearFilters} className="inline-flex items-center gap-1 font-black text-[var(--loombus-gold)]"><X className="size-3.5" /> Clear filters</button> : null}
          </div>
        </section>

        <section className="mt-6 overflow-x-auto pb-3" aria-label="Private Library knowledge graph">
          <div className="grid min-w-[1000px] grid-cols-4 gap-4">
            {kindOrder.map((kind) => (
              <div key={kind} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">{kindLabel[kind]}</h2><span className="rounded-full bg-[var(--loombus-surface-strong)] px-2 py-1 text-[11px] font-black text-[var(--loombus-text-subtle)]">{visibleByKind.get(kind)?.length ?? 0}</span></div>
                <div className="space-y-2">
                  {(visibleByKind.get(kind) ?? []).map((node) => {
                    const key = nodeKey(node.kind, node.id);
                    const active = selectedKey === key;
                    const connected = !selectedKey || connectedKeys.has(key);
                    const Icon = iconFor(kind);
                    const degree = edges.filter((edge) => edge.from === key || edge.to === key).length;
                    return (
                      <button key={key} type="button" onClick={() => setSelectedKey(active ? null : key)} className={`w-full rounded-2xl border p-3 text-left transition ${active ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]"}`} style={{ opacity: connected ? 1 : 0.35 }} aria-pressed={active}>
                        <div className="flex items-start gap-2"><Icon className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" /><div className="min-w-0 flex-1"><p className="text-sm font-black leading-5">{node.title}</p>{node.subtitle ? <p className="mt-1 text-[11px] leading-4 text-[var(--loombus-text-subtle)]">{node.subtitle}</p> : null}<p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">{degree} relationship{degree === 1 ? "" : "s"}</p></div></div>
                      </button>
                    );
                  })}
                  {(visibleByKind.get(kind)?.length ?? 0) === 0 ? <p className="rounded-xl bg-[var(--loombus-surface-strong)] p-3 text-xs text-[var(--loombus-text-subtle)]">No matching nodes.</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Relationship inspector</p>
              <h2 className="mt-1 text-xl font-black">{selectedNode ? selectedNode.title : "Select a node"}</h2>
              {selectedNode ? <div className="mt-2 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[var(--loombus-surface-strong)] px-2.5 py-1 font-black">{kindLabel[selectedNode.kind]}</span>{selectedNode.type ? <span className="rounded-full bg-[var(--loombus-surface-strong)] px-2.5 py-1">{pretty(selectedNode.type)}</span> : null}{selectedNode.status ? <span className="rounded-full bg-[var(--loombus-surface-strong)] px-2.5 py-1">{pretty(selectedNode.status)}</span> : null}</div> : null}
            </div>
            {selectedNode?.href ? <Link href={selectedNode.href} className="text-sm font-black text-[var(--loombus-gold)]">Open source →</Link> : null}
          </div>
          {!selectedNode ? <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Select any node to isolate its direct neighborhood, inspect directionality, and trace the relationship back to provenance.</p> : (
            <div className="mt-5 space-y-3">
              {selectedEdges.filter((edge) => allowedEdgeIds.has(edge.id)).map((edge) => {
                const outgoing = edge.from === selectedKey;
                const otherKey = outgoing ? edge.to : edge.from;
                const other = nodeMap.get(otherKey);
                if (!other) return null;
                const focusKind = selectedNode.kind === "claim" || selectedNode.kind === "knowledge" ? selectedNode.kind : other.kind === "claim" || other.kind === "knowledge" ? other.kind : "";
                const focusId = focusKind === selectedNode.kind ? selectedNode.id : other.id;
                const provenanceHref = focusKind ? `/library/research/evidence/provenance?focusKind=${focusKind}&focusId=${encodeURIComponent(focusId)}&relation=${encodeURIComponent(edge.label)}` : "/library/research/evidence/provenance";
                return (
                  <div key={edge.id} className="grid gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <button type="button" onClick={() => setSelectedKey(otherKey)} className="text-left">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]"><span>{outgoing ? "Outgoing" : "Incoming"}</span><ArrowRight className={`size-3.5 ${outgoing ? "" : "rotate-180"}`} /><span>{pretty(edge.label)}</span><span className="rounded-full bg-[var(--loombus-gold-surface)] px-2 py-0.5 text-[10px] text-[var(--loombus-gold)]">{pretty(edge.family)}</span></div>
                      <p className="mt-2 text-sm font-black">{other.title}</p><p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{kindLabel[other.kind]}{other.subtitle ? ` · ${other.subtitle}` : ""}</p>
                    </button>
                    <Link href={provenanceHref} className="inline-flex items-center justify-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black text-[var(--loombus-gold)]"><GitBranch className="size-3.5" /> Trace provenance</Link>
                  </div>
                );
              })}
              {selectedEdges.filter((edge) => allowedEdgeIds.has(edge.id)).length === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No direct relationships match the current relationship filter.</p> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
