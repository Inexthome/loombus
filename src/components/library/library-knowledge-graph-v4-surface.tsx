"use client";

import Link from "next/link";
import { ArrowLeft, GitBranch, Loader2, Maximize2, Minus, Plus, RotateCcw, Search } from "lucide-react";
import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type NodeKind = "publication" | "claim" | "knowledge" | "discussion";
type GraphNode = { id: string; kind: NodeKind; title: string; subtitle?: string | null; type?: string | null; status?: string | null; href?: string | null };
type GraphEdge = { id: string; from: string; to: string; label: string; family: "evidence" | "membership" | "derivation" | "promotion" };
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

type Viewport = { scrollLeft: number; scrollTop: number; clientWidth: number; clientHeight: number; scrollWidth: number; scrollHeight: number };

const kinds: NodeKind[] = ["publication", "claim", "knowledge", "discussion"];
const kindLabel: Record<NodeKind, string> = { publication: "Publications", claim: "Claims", knowledge: "Knowledge", discussion: "Discussions" };
const relationOptions = ["supports", "challenges", "context", "core", "supporting", "counterpoint", "derived from opening post", "derived from reply", "promoted to discussion"];
const xByKind: Record<NodeKind, number> = { publication: 150, claim: 470, knowledge: 790, discussion: 1110 };
const nodeKey = (kind: NodeKind, id: string) => `${kind}:${id}`;
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const compact = (value: string, max = 54) => value.trim().length <= max ? value.trim() : `${value.trim().slice(0, max - 1)}…`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function LibraryKnowledgeGraphV4Surface() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<NodeKind | "all">("all");
  const [relationFilter, setRelationFilter] = useState("all");
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ scrollLeft: 0, scrollTop: 0, clientWidth: 1, clientHeight: 1, scrollWidth: 1, scrollHeight: 1 });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to view your private Library Knowledge Graph.");
      setLoading(false);
      return;
    }

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

    if ([claimsR, knowledgeR, itemsR, evidenceR, membershipsR, dcR, dkR, rcR, rkR, promotionsR].some((result) => result.error)) {
      setError("Unable to load the complete private knowledge network.");
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

    if (publicationsR.error || discussionsR.error) setError("The graph loaded, but some source labels are unavailable.");
    const publications = (publicationsR.data ?? []) as Publication[];
    const discussions = (discussionsR.data ?? []) as Discussion[];
    const nextNodes: GraphNode[] = [
      ...publications.map((row) => ({ id: row.id, kind: "publication" as const, title: row.title, subtitle: row.author_name, type: "publication", href: `/library/read/${row.id}` })),
      ...claims.map((row) => ({ id: row.id, kind: "claim" as const, title: compact(row.statement), subtitle: `${pretty(row.claim_type)} · ${pretty(row.status)}`, type: row.claim_type, status: row.status, href: "/library/research/evidence" })),
      ...knowledge.map((row) => ({ id: row.id, kind: "knowledge" as const, title: row.title, subtitle: `${pretty(row.knowledge_type)} · ${pretty(row.status)}`, type: row.knowledge_type, status: row.status, href: "/library/research/evidence" })),
      ...discussions.map((row) => ({ id: row.id, kind: "discussion" as const, title: row.title, subtitle: row.topic, type: row.topic, href: `/discussions/${row.id}` })),
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
    for (const row of evidence) {
      const item = itemById.get(row.research_item_id);
      if (item) push(nodeKey("publication", item.publication_id), nodeKey("claim", row.claim_id), row.relation, "evidence");
    }
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

  useEffect(() => { void loadGraph(); }, [loadGraph]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [nodeKey(node.kind, node.id), node])), [nodes]);
  const filteredEdges = useMemo(() => edges.filter((edge) => relationFilter === "all" || edge.label === relationFilter), [edges, relationFilter]);
  const needle = query.trim().toLowerCase();
  const baseVisible = useMemo(() => nodes.filter((node) => (kindFilter === "all" || node.kind === kindFilter) && (!needle || [node.title, node.subtitle, node.type, node.status].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle)))), [nodes, kindFilter, needle]);
  const visibleKeys = useMemo(() => new Set(baseVisible.map((node) => nodeKey(node.kind, node.id))), [baseVisible]);
  const selectedEdges = useMemo(() => selectedKey ? filteredEdges.filter((edge) => edge.from === selectedKey || edge.to === selectedKey) : [], [filteredEdges, selectedKey]);
  const neighborhood = useMemo(() => selectedKey ? new Set([selectedKey, ...selectedEdges.flatMap((edge) => [edge.from, edge.to])]) : null, [selectedKey, selectedEdges]);
  const visibleNodes = useMemo(() => baseVisible.filter((node) => !neighborhood || neighborhood.has(nodeKey(node.kind, node.id))), [baseVisible, neighborhood]);
  const canvasEdges = useMemo(() => filteredEdges.filter((edge) => visibleKeys.has(edge.from) && visibleKeys.has(edge.to) && (!neighborhood || (neighborhood.has(edge.from) && neighborhood.has(edge.to)))), [filteredEdges, visibleKeys, neighborhood]);
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const kind of kinds) {
      const rows = visibleNodes.filter((node) => node.kind === kind);
      rows.forEach((node, index) => map.set(nodeKey(node.kind, node.id), { x: xByKind[kind], y: 100 + index * 104 }));
    }
    return map;
  }, [visibleNodes]);
  const maxRows = Math.max(1, ...kinds.map((kind) => visibleNodes.filter((node) => node.kind === kind).length));
  const canvasWidth = 1260;
  const canvasHeight = Math.max(560, 160 + maxRows * 104);
  const selectedNode = selectedKey ? nodeMap.get(selectedKey) ?? null : null;
  const denseMode = canvasEdges.length > 80 || visibleNodes.length > 120;

  const syncViewport = useCallback(() => {
    const element = canvasRef.current;
    if (!element) return;
    setViewport({ scrollLeft: element.scrollLeft, scrollTop: element.scrollTop, clientWidth: element.clientWidth, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, scrollHeight: element.scrollHeight });
  }, []);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    syncViewport();
    const observer = new ResizeObserver(syncViewport);
    observer.observe(element);
    return () => observer.disconnect();
  }, [syncViewport, zoom, canvasHeight, visibleNodes.length]);

  const fitToScreen = useCallback(() => {
    const element = canvasRef.current;
    if (!element) return;
    const next = clamp(Math.min((element.clientWidth - 16) / canvasWidth, (element.clientHeight - 16) / canvasHeight), 0.25, 1.6);
    setZoom(next);
    requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      canvasRef.current.scrollTo({ left: 0, top: 0, behavior: "smooth" });
      syncViewport();
    });
  }, [canvasHeight, syncViewport]);

  const reset = () => {
    setSelectedKey(null);
    setQuery("");
    setKindFilter("all");
    setRelationFilter("all");
    setZoom(1);
    requestAnimationFrame(() => canvasRef.current?.scrollTo({ left: 0, top: 0 }));
  };

  const beginPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !canvasRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a,input,select,[data-graph-node='true']")) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: canvasRef.current.scrollLeft, top: canvasRef.current.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePan = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const element = canvasRef.current;
    if (!drag || !element || drag.pointerId !== event.pointerId) return;
    element.scrollLeft = drag.left - (event.clientX - drag.x);
    element.scrollTop = drag.top - (event.clientY - drag.y);
    syncViewport();
  };
  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  const minimapWidth = 210;
  const minimapHeight = 120;
  const miniScaleX = minimapWidth / canvasWidth;
  const miniScaleY = minimapHeight / canvasHeight;
  const viewRect = {
    x: (viewport.scrollLeft / Math.max(viewport.scrollWidth, 1)) * minimapWidth,
    y: (viewport.scrollTop / Math.max(viewport.scrollHeight, 1)) * minimapHeight,
    width: clamp((viewport.clientWidth / Math.max(viewport.scrollWidth, 1)) * minimapWidth, 10, minimapWidth),
    height: clamp((viewport.clientHeight / Math.max(viewport.scrollHeight, 1)) * minimapHeight, 10, minimapHeight),
  };

  return <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-16"><div className="mx-auto max-w-7xl">
    <header className="border-b border-[var(--loombus-border)] pb-6"><Link href="/library/research/evidence" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Evidence & Knowledge</Link><div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Private relationship map · v4</p><h1 className="mt-1 text-3xl font-black tracking-tight">Knowledge Graph</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Explore larger knowledge networks with pan, fit-to-screen, a minimap, and density-aware relationship labels. This graph is private and read-only.</p></div><Link href="/library/research/evidence/provenance" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)]"><GitBranch className="size-4" /> Provenance</Link></div></header>
    {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="grid gap-3 lg:grid-cols-[1fr_220px_260px_auto]"><label className="flex items-center gap-3 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-2.5"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search graph…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value as NodeKind | "all")} className="rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm"><option value="all">All node types</option>{kinds.map((kind) => <option key={kind} value={kind}>{kindLabel[kind]}</option>)}</select><select value={relationFilter} onChange={(event) => setRelationFilter(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-sm"><option value="all">All relationships</option>{relationOptions.map((relation) => <option key={relation} value={relation}>{pretty(relation)}</option>)}</select><button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-black text-[var(--loombus-gold)]"><RotateCcw className="size-4" /> Reset</button></div></section>

    <section className="mt-6 overflow-hidden rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]" aria-label="Scalable visual Library knowledge topology"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--loombus-border)] px-4 py-3"><div className="text-xs text-[var(--loombus-text-subtle)]">{visibleNodes.length} visible nodes · {canvasEdges.length} visible relationships{denseMode ? " · dense labels simplified" : ""}</div><div className="flex items-center gap-2"><button type="button" onClick={fitToScreen} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black" aria-label="Fit graph to screen"><Maximize2 className="size-3.5" /> Fit</button><button type="button" onClick={() => setZoom((value) => clamp(value - 0.1, 0.25, 1.6))} className="rounded-full border border-[var(--loombus-border)] p-2" aria-label="Zoom out"><Minus className="size-4" /></button><span className="w-12 text-center text-xs font-black">{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => clamp(value + 0.1, 0.25, 1.6))} className="rounded-full border border-[var(--loombus-border)] p-2" aria-label="Zoom in"><Plus className="size-4" /></button></div></div>
      <div className="relative"><div ref={canvasRef} onScroll={syncViewport} onPointerDown={beginPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={endPan} className="h-[62vh] min-h-[520px] cursor-grab overflow-auto bg-[var(--loombus-page-bg)] active:cursor-grabbing"><div style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }}><svg viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} style={{ width: canvasWidth * zoom, height: canvasHeight * zoom }} role="img" aria-label="Knowledge graph node and edge canvas"><defs><marker id="kg4-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--loombus-text-subtle)" /></marker></defs>{canvasEdges.map((edge, index) => { const a = positions.get(edge.from); const b = positions.get(edge.to); if (!a || !b) return null; const active = !selectedKey || edge.from === selectedKey || edge.to === selectedKey; const showLabel = active && (!denseMode || Boolean(selectedKey) || index % Math.max(2, Math.ceil(canvasEdges.length / 60)) === 0); const midX = (a.x + b.x) / 2; const midY = (a.y + b.y) / 2 + ((index % 5) - 2) * 10; return <g key={edge.id} opacity={active ? 1 : 0.14}><line x1={a.x + 96} y1={a.y} x2={b.x - 96} y2={b.y} stroke="var(--loombus-border)" strokeWidth="2" markerEnd="url(#kg4-arrow)" />{showLabel ? <text x={midX} y={midY - 6} textAnchor="middle" fontSize="10" fill="var(--loombus-text-subtle)">{compact(pretty(edge.label), 28)}</text> : null}</g>; })}{visibleNodes.map((node) => { const key = nodeKey(node.kind, node.id); const position = positions.get(key); if (!position) return null; const active = selectedKey === key; const connected = !selectedKey || neighborhood?.has(key); return <g data-graph-node="true" key={key} transform={`translate(${position.x},${position.y})`} opacity={connected ? 1 : 0.18} onClick={() => setSelectedKey(active ? null : key)} className="cursor-pointer"><rect x="-98" y="-34" width="196" height="68" rx="16" fill={active ? "var(--loombus-gold-surface)" : "var(--loombus-surface)"} stroke={active ? "var(--loombus-gold)" : "var(--loombus-border)"} strokeWidth={active ? 2 : 1} /><text x="0" y="-10" textAnchor="middle" fontSize="10" fontWeight="800" fill="var(--loombus-gold)">{kindLabel[node.kind].toUpperCase()}</text><text x="0" y="10" textAnchor="middle" fontSize="12" fontWeight="800" fill="var(--loombus-text)">{compact(node.title, 27)}</text>{node.subtitle ? <text x="0" y="26" textAnchor="middle" fontSize="9" fill="var(--loombus-text-subtle)">{compact(node.subtitle, 32)}</text> : null}</g>; })}</svg></div></div>
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)]/95 p-2 shadow-lg" aria-label="Knowledge Graph minimap"><svg width={minimapWidth} height={minimapHeight} viewBox={`0 0 ${minimapWidth} ${minimapHeight}`}>{canvasEdges.slice(0, 500).map((edge) => { const a = positions.get(edge.from); const b = positions.get(edge.to); if (!a || !b) return null; return <line key={edge.id} x1={a.x * miniScaleX} y1={a.y * miniScaleY} x2={b.x * miniScaleX} y2={b.y * miniScaleY} stroke="var(--loombus-border)" strokeWidth="0.7" />; })}{visibleNodes.slice(0, 1000).map((node) => { const key = nodeKey(node.kind, node.id); const position = positions.get(key); if (!position) return null; return <circle key={key} cx={position.x * miniScaleX} cy={position.y * miniScaleY} r={selectedKey === key ? 3 : 2} fill={selectedKey === key ? "var(--loombus-gold)" : "var(--loombus-text-subtle)"} />; })}<rect x={viewRect.x} y={viewRect.y} width={viewRect.width} height={viewRect.height} fill="none" stroke="var(--loombus-gold)" strokeWidth="1.5" /></svg></div>
      </div>
    </section>

    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Topology inspector</p><h2 className="mt-1 text-xl font-black">{selectedNode ? selectedNode.title : "Select a node on the canvas"}</h2>{selectedNode ? <><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-[var(--loombus-surface-strong)] px-2.5 py-1 font-black">{kindLabel[selectedNode.kind]}</span>{selectedNode.status ? <span className="rounded-full bg-[var(--loombus-surface-strong)] px-2.5 py-1">{pretty(selectedNode.status)}</span> : null}{selectedNode.href ? <Link href={selectedNode.href} className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 font-black text-[var(--loombus-gold)]">Open source →</Link> : null}</div><div className="mt-4 grid gap-2 md:grid-cols-2">{selectedEdges.map((edge) => { const otherKey = edge.from === selectedKey ? edge.to : edge.from; const other = nodeMap.get(otherKey); if (!other) return null; const focusKind = selectedNode.kind === "claim" || selectedNode.kind === "knowledge" ? selectedNode.kind : other.kind === "claim" || other.kind === "knowledge" ? other.kind : ""; const focusId = focusKind === selectedNode.kind ? selectedNode.id : other.id; const trace = focusKind ? `/library/research/evidence/provenance?focusKind=${focusKind}&focusId=${encodeURIComponent(focusId)}&relation=${encodeURIComponent(edge.label)}` : "/library/research/evidence/provenance"; return <div key={edge.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><button type="button" onClick={() => setSelectedKey(otherKey)} className="text-left"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{pretty(edge.label)} · {pretty(edge.family)}</p><p className="mt-1 text-sm font-black">{other.title}</p></button><Link href={trace} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]"><GitBranch className="size-3.5" /> Trace provenance</Link></div>; })}</div></> : <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Drag empty canvas space to pan. Click a node to isolate its direct neighborhood. Use Fit for large graphs and the minimap to stay oriented.</p>}</section>
  </div></main>;
}
