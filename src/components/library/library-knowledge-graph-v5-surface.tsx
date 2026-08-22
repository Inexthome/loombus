"use client";

import Link from "next/link";
import { ArrowRight, GitBranch, Loader2, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LibraryKnowledgeGraphV4Surface } from "@/components/library/library-knowledge-graph-v4-surface";

type NodeKind = "publication" | "claim" | "knowledge" | "discussion";
type GraphNode = { id: string; kind: NodeKind; title: string; subtitle?: string | null; href?: string | null };
type GraphEdge = { id: string; from: string; to: string; label: string; family: "evidence" | "membership" | "derivation" | "promotion" };
type SavedView = { id: string; name: string; from: string; to: string; maxHops: number; direction: "any" | "forward"; createdAt: string };
type PathResult = { nodes: string[]; edges: GraphEdge[] };

type Claim = { id: string; statement: string; claim_type: string; status: string };
type Knowledge = { id: string; title: string; knowledge_type: string; status: string };
type ResearchItem = { id: string; publication_id: string };
type Evidence = { claim_id: string; research_item_id: string; relation: string };
type KnowledgeClaim = { knowledge_object_id: string; claim_id: string; role: string };
type Publication = { id: string; title: string; author_name: string | null };
type Discussion = { id: string; title: string; topic: string };
type DC = { discussion_id: string; claim_id: string | null };
type DK = { discussion_id: string; knowledge_object_id: string | null };
type RC = { discussion_id: string; claim_id: string | null };
type RK = { discussion_id: string; knowledge_object_id: string | null };
type Promotion = { discussion_id: string; knowledge_object_id: string | null };

const kindLabel: Record<NodeKind, string> = { publication: "Publication", claim: "Claim", knowledge: "Knowledge", discussion: "Discussion" };
const nodeKey = (kind: NodeKind, id: string) => `${kind}:${id}`;
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const compact = (value: string, max = 90) => value.trim().length <= max ? value.trim() : `${value.trim().slice(0, max - 1)}…`;

function findShortestPath(start: string, target: string, edges: GraphEdge[], maxHops: number, direction: "any" | "forward"): PathResult | null {
  if (!start || !target) return null;
  if (start === target) return { nodes: [start], edges: [] };
  const adjacency = new Map<string, Array<{ next: string; edge: GraphEdge }>>();
  const add = (from: string, next: string, edge: GraphEdge) => {
    const rows = adjacency.get(from) ?? [];
    rows.push({ next, edge });
    adjacency.set(from, rows);
  };
  for (const edge of edges) {
    add(edge.from, edge.to, edge);
    if (direction === "any") add(edge.to, edge.from, edge);
  }
  const queue: Array<{ key: string; nodes: string[]; pathEdges: GraphEdge[] }> = [{ key: start, nodes: [start], pathEdges: [] }];
  const visited = new Map<string, number>([[start, 0]]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.pathEdges.length >= maxHops) continue;
    for (const step of adjacency.get(current.key) ?? []) {
      const nextDepth = current.pathEdges.length + 1;
      const seenDepth = visited.get(step.next);
      if (seenDepth !== undefined && seenDepth <= nextDepth) continue;
      const nextNodes = [...current.nodes, step.next];
      const nextEdges = [...current.pathEdges, step.edge];
      if (step.next === target) return { nodes: nextNodes, edges: nextEdges };
      visited.set(step.next, nextDepth);
      queue.push({ key: step.next, nodes: nextNodes, pathEdges: nextEdges });
    }
  }
  return null;
}

function SemanticExplorer() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [maxHops, setMaxHops] = useState(4);
  const [direction, setDirection] = useState<"any" | "forward">("any");
  const [nodeQuery, setNodeQuery] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [viewName, setViewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to use private semantic graph exploration.");
      setLoading(false);
      return;
    }
    setMemberId(authData.user.id);
    const [claimsR, knowledgeR, itemsR, evidenceR, membershipsR, dcR, dkR, rcR, rkR, promotionsR] = await Promise.all([
      supabase.from("library_research_claims").select("id, statement, claim_type, status"),
      supabase.from("library_knowledge_objects").select("id, title, knowledge_type, status"),
      supabase.from("library_research_items").select("id, publication_id"),
      supabase.from("library_research_claim_evidence").select("claim_id, research_item_id, relation"),
      supabase.from("library_knowledge_claims").select("knowledge_object_id, claim_id, role"),
      supabase.from("library_discussion_claim_derivations").select("discussion_id, claim_id"),
      supabase.from("library_discussion_knowledge_derivations").select("discussion_id, knowledge_object_id"),
      supabase.from("library_reply_claim_derivations").select("discussion_id, claim_id"),
      supabase.from("library_reply_knowledge_derivations").select("discussion_id, knowledge_object_id"),
      supabase.from("library_knowledge_discussion_promotions").select("discussion_id, knowledge_object_id"),
    ]);
    const required = [claimsR, knowledgeR, itemsR, evidenceR, membershipsR, dcR, dkR, rcR, rkR, promotionsR];
    if (required.some((result) => result.error)) {
      setError("Unable to load the complete private graph for path exploration.");
      setLoading(false);
      return;
    }
    const claims = (claimsR.data ?? []) as Claim[];
    const knowledge = (knowledgeR.data ?? []) as Knowledge[];
    const items = (itemsR.data ?? []) as ResearchItem[];
    const evidence = (evidenceR.data ?? []) as Evidence[];
    const memberships = (membershipsR.data ?? []) as KnowledgeClaim[];
    const dc = (dcR.data ?? []) as DC[];
    const dk = (dkR.data ?? []) as DK[];
    const rc = (rcR.data ?? []) as RC[];
    const rk = (rkR.data ?? []) as RK[];
    const promotions = (promotionsR.data ?? []) as Promotion[];
    const publicationIds = [...new Set(items.map((row) => row.publication_id))];
    const discussionIds = [...new Set([...dc, ...dk, ...rc, ...rk, ...promotions].map((row) => row.discussion_id))];
    const [publicationsR, discussionsR] = await Promise.all([
      publicationIds.length ? supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds) : Promise.resolve({ data: [], error: null }),
      discussionIds.length ? supabase.from("discussions").select("id, title, topic").in("id", discussionIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    const publications = (publicationsR.data ?? []) as Publication[];
    const discussions = (discussionsR.data ?? []) as Discussion[];
    const nextNodes: GraphNode[] = [
      ...publications.map((row) => ({ id: row.id, kind: "publication" as const, title: row.title, subtitle: row.author_name, href: `/library/read/${row.id}` })),
      ...claims.map((row) => ({ id: row.id, kind: "claim" as const, title: compact(row.statement), subtitle: `${pretty(row.claim_type)} · ${pretty(row.status)}`, href: "/library/research/evidence" })),
      ...knowledge.map((row) => ({ id: row.id, kind: "knowledge" as const, title: row.title, subtitle: `${pretty(row.knowledge_type)} · ${pretty(row.status)}`, href: "/library/research/evidence" })),
      ...discussions.map((row) => ({ id: row.id, kind: "discussion" as const, title: row.title, subtitle: row.topic, href: `/discussions/${row.id}` })),
    ];
    const itemById = new Map(items.map((row) => [row.id, row]));
    const edgeIds = new Set<string>();
    const nextEdges: GraphEdge[] = [];
    const push = (from: string, to: string, label: string, family: GraphEdge["family"]) => {
      const id = `${from}|${to}|${label}`;
      if (edgeIds.has(id)) return;
      edgeIds.add(id);
      nextEdges.push({ id, from, to, label, family });
    };
    for (const row of evidence) { const item = itemById.get(row.research_item_id); if (item) push(nodeKey("publication", item.publication_id), nodeKey("claim", row.claim_id), row.relation, "evidence"); }
    for (const row of memberships) push(nodeKey("claim", row.claim_id), nodeKey("knowledge", row.knowledge_object_id), row.role, "membership");
    for (const row of dc) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from opening post", "derivation");
    for (const row of dk) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from opening post", "derivation");
    for (const row of rc) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from reply", "derivation");
    for (const row of rk) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from reply", "derivation");
    for (const row of promotions) if (row.knowledge_object_id) push(nodeKey("knowledge", row.knowledge_object_id), nodeKey("discussion", row.discussion_id), "promoted to discussion", "promotion");
    const keys = new Set(nextNodes.map((node) => nodeKey(node.kind, node.id)));
    setNodes(nextNodes);
    setEdges(nextEdges.filter((edge) => keys.has(edge.from) && keys.has(edge.to)));
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!memberId) return;
    try {
      const raw = window.localStorage.getItem(`loombus:library:graph-views:v1:${memberId}`);
      setSavedViews(raw ? JSON.parse(raw) as SavedView[] : []);
    } catch { setSavedViews([]); }
  }, [memberId]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [nodeKey(node.kind, node.id), node])), [nodes]);
  const path = useMemo(() => findShortestPath(fromKey, toKey, edges, maxHops, direction), [direction, edges, fromKey, maxHops, toKey]);
  const filteredOptions = useMemo(() => {
    const needle = nodeQuery.trim().toLowerCase();
    return nodes.filter((node) => !needle || [node.title, node.subtitle, node.kind].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))).slice(0, 400);
  }, [nodeQuery, nodes]);

  const persistViews = (next: SavedView[]) => {
    setSavedViews(next);
    if (memberId) window.localStorage.setItem(`loombus:library:graph-views:v1:${memberId}`, JSON.stringify(next));
  };
  const saveView = () => {
    if (!fromKey || !toKey) return;
    const name = viewName.trim() || `${nodeMap.get(fromKey)?.title ?? "Start"} → ${nodeMap.get(toKey)?.title ?? "Target"}`;
    const next: SavedView = { id: crypto.randomUUID(), name: compact(name, 120), from: fromKey, to: toKey, maxHops, direction, createdAt: new Date().toISOString() };
    persistViews([next, ...savedViews].slice(0, 20));
    setViewName("");
  };

  if (loading) return <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6"><div className="grid min-h-40 place-items-center rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]"><Loader2 className="size-5 animate-spin text-[var(--loombus-gold)]" /></div></section>;

  return <section className="bg-[var(--loombus-page-bg)] px-4 pb-24 text-[var(--loombus-text)] sm:px-6" aria-label="Knowledge Graph semantic exploration"><div className="mx-auto max-w-7xl rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Semantic exploration · v5</p><h2 className="mt-1 text-2xl font-black">How are two ideas connected?</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Find the shortest recorded path through publications, claims, synthesized knowledge, and discussions. Paths are derived only from your existing private provenance graph; they do not create or infer new facts.</p></div><div className="rounded-full bg-[var(--loombus-surface-strong)] px-3 py-1.5 text-xs text-[var(--loombus-text-subtle)]">Saved views stay on this device</div></div>
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm">{error}</div> : null}
    <div className="mt-5 flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-2.5"><Search className="size-4 text-[var(--loombus-text-subtle)]" /><input value={nodeQuery} onChange={(event) => setNodeQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Filter node choices…" /></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_1fr_150px_170px] lg:items-center"><select value={fromKey} onChange={(event) => setFromKey(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="">Choose start node</option>{filteredOptions.map((node) => <option key={`from:${node.kind}:${node.id}`} value={nodeKey(node.kind, node.id)}>{kindLabel[node.kind]} · {compact(node.title, 70)}</option>)}</select><ArrowRight className="hidden size-4 text-[var(--loombus-gold)] lg:block" /><select value={toKey} onChange={(event) => setToKey(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="">Choose target node</option>{filteredOptions.map((node) => <option key={`to:${node.kind}:${node.id}`} value={nodeKey(node.kind, node.id)}>{kindLabel[node.kind]} · {compact(node.title, 70)}</option>)}</select><select value={maxHops} onChange={(event) => setMaxHops(Number(event.target.value))} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value={2}>Up to 2 hops</option><option value={3}>Up to 3 hops</option><option value={4}>Up to 4 hops</option><option value={5}>Up to 5 hops</option></select><select value={direction} onChange={(event) => setDirection(event.target.value as "any" | "forward")} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="any">Either direction</option><option value="forward">Recorded direction only</option></select></div>

    <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
      {!fromKey || !toKey ? <p className="text-sm text-[var(--loombus-text-muted)]">Choose two nodes to calculate their shortest recorded connection.</p> : path ? <div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-black text-[var(--loombus-gold)]">Shortest recorded path · {path.edges.length} hop{path.edges.length === 1 ? "" : "s"}</p><div className="flex gap-2"><input value={viewName} onChange={(event) => setViewName(event.target.value)} placeholder="View name (optional)" className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-1.5 text-xs outline-none" /><button type="button" onClick={saveView} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-black text-[var(--loombus-gold)]"><Save className="size-3.5" /> Save view</button></div></div><div className="mt-4 space-y-3">{path.nodes.map((key, index) => { const node = nodeMap.get(key); if (!node) return null; const edge = index < path.edges.length ? path.edges[index] : null; const nextKey = path.nodes[index + 1]; const forward = edge ? edge.from === key && edge.to === nextKey : false; return <div key={`${key}:${index}`}><div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{kindLabel[node.kind]}</p><p className="mt-1 text-sm font-black">{node.title}</p>{node.subtitle ? <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{node.subtitle}</p> : null}</div>{node.href ? <Link href={node.href} className="text-xs font-black text-[var(--loombus-gold)]">Open source →</Link> : null}</div></div>{edge ? <div className="ml-5 border-l-2 border-[var(--loombus-gold)] py-2 pl-4 text-xs"><span className="font-black text-[var(--loombus-gold)]">{forward ? "Recorded forward" : "Traversed reverse"}</span> · {pretty(edge.label)} · {pretty(edge.family)} <Link href={`/library/research/evidence/provenance?relation=${encodeURIComponent(edge.label)}`} className="ml-2 font-black text-[var(--loombus-gold)]"><GitBranch className="mr-1 inline size-3" />Trace provenance</Link></div> : null}</div>; })}</div></div> : <p className="text-sm text-[var(--loombus-text-muted)]">No recorded connection was found within {maxHops} hops using the selected direction rule. This does not mean the ideas are unrelated; it means the current private graph has no path under those constraints.</p>}
    </div>

    {savedViews.length > 0 ? <div className="mt-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Saved graph views</p><div className="mt-2 grid gap-2 md:grid-cols-2">{savedViews.map((view) => <div key={view.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3"><button type="button" onClick={() => { setFromKey(view.from); setToKey(view.to); setMaxHops(view.maxHops); setDirection(view.direction); }} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-black">{view.name}</p><p className="mt-1 text-[11px] text-[var(--loombus-text-subtle)]">{view.maxHops} hops max · {view.direction === "any" ? "either direction" : "recorded direction"}</p></button><button type="button" onClick={() => persistViews(savedViews.filter((row) => row.id !== view.id))} className="rounded-full border border-[var(--loombus-border)] p-2 text-[var(--loombus-text-subtle)]" aria-label={`Delete saved view ${view.name}`}><Trash2 className="size-3.5" /></button></div>)}</div></div> : null}
  </div></section>;
}

export function LibraryKnowledgeGraphV5Surface() {
  return <><LibraryKnowledgeGraphV4Surface /><SemanticExplorer /></>;
}
