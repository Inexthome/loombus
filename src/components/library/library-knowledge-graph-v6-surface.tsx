"use client";

import Link from "next/link";
import { FolderPlus, GitBranch, Loader2, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { LibraryKnowledgeGraphV4Surface } from "@/components/library/library-knowledge-graph-v4-surface";

type NodeKind = "publication" | "claim" | "knowledge" | "discussion";
type GraphNode = { id: string; kind: NodeKind; title: string; subtitle?: string | null; href?: string | null };
type GraphEdge = { id: string; from: string; to: string; label: string; family: "evidence" | "membership" | "derivation" | "promotion" };
type Workspace = { id: string; name: string; description: string | null; created_at: string; updated_at: string };
type SavedView = { id: string; workspace_id: string | null; name: string; start_node_key: string; target_node_key: string; max_hops: number; direction_mode: "any" | "forward"; created_at: string; updated_at: string };
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

const nodeKey = (kind: NodeKind, id: string) => `${kind}:${id}`;
const pretty = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const compact = (value: string, max = 90) => value.trim().length <= max ? value.trim() : `${value.trim().slice(0, max - 1)}…`;

function findShortestPath(start: string, target: string, edges: GraphEdge[], maxHops: number, direction: "any" | "forward"): PathResult | null {
  if (!start || !target) return null;
  if (start === target) return { nodes: [start], edges: [] };
  const adjacency = new Map<string, Array<{ next: string; edge: GraphEdge }>>();
  const add = (from: string, next: string, edge: GraphEdge) => adjacency.set(from, [...(adjacency.get(from) ?? []), { next, edge }]);
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
      const depth = current.pathEdges.length + 1;
      if ((visited.get(step.next) ?? Number.POSITIVE_INFINITY) <= depth) continue;
      const nodes = [...current.nodes, step.next];
      const pathEdges = [...current.pathEdges, step.edge];
      if (step.next === target) return { nodes, edges: pathEdges };
      visited.set(step.next, depth);
      queue.push({ key: step.next, nodes, pathEdges });
    }
  }
  return null;
}

function PersistentSemanticExplorer() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [fromKey, setFromKey] = useState("");
  const [toKey, setToKey] = useState("");
  const [maxHops, setMaxHops] = useState(4);
  const [direction, setDirection] = useState<"any" | "forward">("any");
  const [nodeQuery, setNodeQuery] = useState("");
  const [viewName, setViewName] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError("Sign in to use your private graph workspace."); setLoading(false); return; }
    const [claimsR, knowledgeR, itemsR, evidenceR, membershipsR, dcR, dkR, rcR, rkR, promotionsR, workspacesR, viewsR] = await Promise.all([
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
      supabase.from("library_graph_workspaces").select("id, name, description, created_at, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_graph_saved_views").select("id, workspace_id, name, start_node_key, target_node_key, max_hops, direction_mode, created_at, updated_at").order("updated_at", { ascending: false }),
    ]);
    const graphResults = [claimsR, knowledgeR, itemsR, evidenceR, membershipsR, dcR, dkR, rcR, rkR, promotionsR];
    if (graphResults.some((result) => result.error) || workspacesR.error || viewsR.error) { setError("Unable to load the complete private graph workspace."); setLoading(false); return; }
    const claims = (claimsR.data ?? []) as Claim[]; const knowledge = (knowledgeR.data ?? []) as Knowledge[]; const items = (itemsR.data ?? []) as ResearchItem[];
    const evidence = (evidenceR.data ?? []) as Evidence[]; const memberships = (membershipsR.data ?? []) as KnowledgeClaim[]; const dc = (dcR.data ?? []) as DC[]; const dk = (dkR.data ?? []) as DK[]; const rc = (rcR.data ?? []) as RC[]; const rk = (rkR.data ?? []) as RK[]; const promotions = (promotionsR.data ?? []) as Promotion[];
    const publicationIds = [...new Set(items.map((row) => row.publication_id))];
    const discussionIds = [...new Set([...dc, ...dk, ...rc, ...rk, ...promotions].map((row) => row.discussion_id))];
    const [publicationsR, discussionsR] = await Promise.all([
      publicationIds.length ? supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds) : Promise.resolve({ data: [], error: null }),
      discussionIds.length ? supabase.from("discussions").select("id, title, topic").in("id", discussionIds).is("deleted_at", null) : Promise.resolve({ data: [], error: null }),
    ]);
    const publications = (publicationsR.data ?? []) as Publication[]; const discussions = (discussionsR.data ?? []) as Discussion[];
    const nextNodes: GraphNode[] = [
      ...publications.map((row) => ({ id: row.id, kind: "publication" as const, title: row.title, subtitle: row.author_name, href: `/library/read/${row.id}` })),
      ...claims.map((row) => ({ id: row.id, kind: "claim" as const, title: compact(row.statement), subtitle: `${pretty(row.claim_type)} · ${pretty(row.status)}`, href: "/library/research/evidence" })),
      ...knowledge.map((row) => ({ id: row.id, kind: "knowledge" as const, title: row.title, subtitle: `${pretty(row.knowledge_type)} · ${pretty(row.status)}`, href: "/library/research/evidence" })),
      ...discussions.map((row) => ({ id: row.id, kind: "discussion" as const, title: row.title, subtitle: row.topic, href: `/discussions/${row.id}` })),
    ];
    const itemById = new Map(items.map((row) => [row.id, row])); const edgeIds = new Set<string>(); const nextEdges: GraphEdge[] = [];
    const push = (from: string, to: string, label: string, family: GraphEdge["family"]) => { const id = `${from}|${to}|${label}`; if (!edgeIds.has(id)) { edgeIds.add(id); nextEdges.push({ id, from, to, label, family }); } };
    for (const row of evidence) { const item = itemById.get(row.research_item_id); if (item) push(nodeKey("publication", item.publication_id), nodeKey("claim", row.claim_id), row.relation, "evidence"); }
    for (const row of memberships) push(nodeKey("claim", row.claim_id), nodeKey("knowledge", row.knowledge_object_id), row.role, "membership");
    for (const row of dc) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from opening post", "derivation");
    for (const row of dk) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from opening post", "derivation");
    for (const row of rc) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from reply", "derivation");
    for (const row of rk) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from reply", "derivation");
    for (const row of promotions) if (row.knowledge_object_id) push(nodeKey("knowledge", row.knowledge_object_id), nodeKey("discussion", row.discussion_id), "promoted to discussion", "promotion");
    const keys = new Set(nextNodes.map((node) => nodeKey(node.kind, node.id)));
    setNodes(nextNodes); setEdges(nextEdges.filter((edge) => keys.has(edge.from) && keys.has(edge.to))); setWorkspaces((workspacesR.data ?? []) as Workspace[]); setSavedViews((viewsR.data ?? []) as SavedView[]); setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [nodeKey(node.kind, node.id), node])), [nodes]);
  const path = useMemo(() => findShortestPath(fromKey, toKey, edges, maxHops, direction), [direction, edges, fromKey, maxHops, toKey]);
  const filteredOptions = useMemo(() => { const needle = nodeQuery.trim().toLowerCase(); return nodes.filter((node) => !needle || [node.title, node.subtitle, node.kind].filter(Boolean).some((value) => String(value).toLowerCase().includes(needle))).slice(0, 400); }, [nodeQuery, nodes]);

  const createWorkspace = async () => {
    const name = newWorkspaceName.trim(); if (!name) return; setSaving(true); setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError("Your session expired. Sign in again."); setSaving(false); return; }
    const { data, error: insertError } = await supabase.from("library_graph_workspaces").insert({ user_id: authData.user.id, name }).select("id, name, description, created_at, updated_at").single();
    if (insertError || !data) setError(insertError?.message ?? "Unable to create workspace."); else { setWorkspaces((rows) => [data as Workspace, ...rows]); setWorkspaceId(data.id); setNewWorkspaceName(""); }
    setSaving(false);
  };
  const saveView = async () => {
    if (!fromKey || !toKey) return; setSaving(true); setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) { setError("Your session expired. Sign in again."); setSaving(false); return; }
    const name = compact(viewName.trim() || `${nodeMap.get(fromKey)?.title ?? "Start"} → ${nodeMap.get(toKey)?.title ?? "Target"}`, 120);
    const { data, error: insertError } = await supabase.from("library_graph_saved_views").insert({ user_id: authData.user.id, workspace_id: workspaceId || null, name, start_node_key: fromKey, target_node_key: toKey, max_hops: maxHops, direction_mode: direction }).select("id, workspace_id, name, start_node_key, target_node_key, max_hops, direction_mode, created_at, updated_at").single();
    if (insertError || !data) setError(insertError?.message ?? "Unable to save graph view."); else { setSavedViews((rows) => [data as SavedView, ...rows]); setViewName(""); }
    setSaving(false);
  };
  const deleteView = async (id: string) => { const { error: deleteError } = await supabase.from("library_graph_saved_views").delete().eq("id", id); if (deleteError) setError(deleteError.message); else setSavedViews((rows) => rows.filter((row) => row.id !== id)); };
  const deleteWorkspace = async (id: string) => { const { error: deleteError } = await supabase.from("library_graph_workspaces").delete().eq("id", id); if (deleteError) setError(deleteError.message); else { setWorkspaces((rows) => rows.filter((row) => row.id !== id)); setSavedViews((rows) => rows.map((row) => row.workspace_id === id ? { ...row, workspace_id: null } : row)); if (workspaceId === id) setWorkspaceId(""); } };
  const applyView = (view: SavedView) => { setFromKey(view.start_node_key); setToKey(view.target_node_key); setMaxHops(view.max_hops); setDirection(view.direction_mode); setWorkspaceId(view.workspace_id ?? ""); };

  if (loading) return <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6"><div className="grid min-h-40 place-items-center rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)]"><Loader2 className="size-5 animate-spin text-[var(--loombus-gold)]" /></div></section>;
  return <section className="bg-[var(--loombus-page-bg)] px-4 pb-24 text-[var(--loombus-text)] sm:px-6" aria-label="Knowledge Graph persistent member workspace"><div className="mx-auto max-w-7xl rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Persistent graph workspace · v6</p><h2 className="mt-1 text-2xl font-black">Investigations that follow you across devices</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Save path configurations into private named workspaces. The underlying nodes and relationships still come only from your existing provenance graph; saved views do not create or infer new facts.</p></div><div className="rounded-full bg-[var(--loombus-surface-strong)] px-3 py-1.5 text-xs text-[var(--loombus-text-subtle)]">Private · RLS-backed · cross-device</div></div>
    {error ? <div role="alert" className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-sm">{error}</div> : null}
    <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_auto]"><div className="flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-2.5"><FolderPlus className="size-4"/><input value={newWorkspaceName} onChange={(event)=>setNewWorkspaceName(event.target.value)} placeholder="New workspace name" className="min-w-0 flex-1 bg-transparent text-sm outline-none"/></div><button type="button" disabled={saving || !newWorkspaceName.trim()} onClick={()=>void createWorkspace()} className="rounded-xl bg-[var(--loombus-gold)] px-4 py-2.5 text-sm font-black text-black disabled:opacity-50">Create workspace</button></div>
    <div className="mt-4 flex flex-wrap gap-2">{workspaces.map((workspace)=><div key={workspace.id} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs"><button type="button" onClick={()=>setWorkspaceId(workspace.id)} className={workspaceId===workspace.id?"font-black text-[var(--loombus-gold)]":"font-black"}>{workspace.name}</button><button type="button" aria-label={`Delete ${workspace.name}`} onClick={()=>void deleteWorkspace(workspace.id)}><Trash2 className="size-3.5"/></button></div>)}</div>
    <div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-2.5"><Search className="size-4"/><input value={nodeQuery} onChange={(event)=>setNodeQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="Filter node choices…"/></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_150px_180px]"><select value={fromKey} onChange={(event)=>setFromKey(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="">Choose start node</option>{filteredOptions.map((node)=><option key={`from:${node.kind}:${node.id}`} value={nodeKey(node.kind,node.id)}>{pretty(node.kind)} · {compact(node.title,60)}</option>)}</select><select value={toKey} onChange={(event)=>setToKey(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="">Choose target node</option>{filteredOptions.map((node)=><option key={`to:${node.kind}:${node.id}`} value={nodeKey(node.kind,node.id)}>{pretty(node.kind)} · {compact(node.title,60)}</option>)}</select><select value={maxHops} onChange={(event)=>setMaxHops(Number(event.target.value))} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm">{[2,3,4,5].map((value)=><option key={value} value={value}>{value} hops</option>)}</select><select value={direction} onChange={(event)=>setDirection(event.target.value as "any"|"forward")} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="any">Either direction</option><option value="forward">Recorded direction only</option></select></div>
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_auto]"><input value={viewName} onChange={(event)=>setViewName(event.target.value)} placeholder="Name this investigation (optional)" className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm outline-none"/><select value={workspaceId} onChange={(event)=>setWorkspaceId(event.target.value)} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-2.5 text-sm"><option value="">Unfiled</option>{workspaces.map((workspace)=><option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><button type="button" disabled={saving || !fromKey || !toKey} onClick={()=>void saveView()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--loombus-gold)] px-4 py-2.5 text-sm font-black text-black disabled:opacity-50"><Save className="size-4"/>Save investigation</button></div>
    <div className="mt-6 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Shortest recorded path</p>{fromKey&&toKey ? path ? <div className="mt-3 space-y-3">{path.nodes.map((key,index)=>{const node=nodeMap.get(key);const edge=index<path.edges.length?path.edges[index]:null;const nextKey=path.nodes[index+1];const reversed=edge&&nextKey?edge.from!==key:null;return <div key={`${key}:${index}`}><div className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3"><div className="text-xs font-black text-[var(--loombus-gold)]">{node?pretty(node.kind):"Node"}</div><div className="mt-1 text-sm font-black">{node?.title??key}</div>{node?.href?<Link href={node.href} className="mt-2 inline-block text-xs font-black text-[var(--loombus-gold)]">Open source →</Link>:null}</div>{edge?<div className="px-3 py-2 text-xs text-[var(--loombus-text-muted)]">{reversed?"Reverse traversal of ":""}<strong>{pretty(edge.label)}</strong> · {pretty(edge.family)} <Link href={`/library/research/evidence/provenance?relation=${encodeURIComponent(edge.label)}`} className="ml-2 font-black text-[var(--loombus-gold)]"><GitBranch className="mr-1 inline size-3"/>Trace provenance</Link></div>:null}</div>})}</div>:<p className="mt-3 text-sm text-[var(--loombus-text-muted)]">No recorded path was found within the selected hop and direction constraints. This does not mean the underlying ideas are unrelated.</p>:<p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Choose a start and target node to explore the existing provenance graph.</p>}</div>
    <div className="mt-6"><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Saved graph investigations</p><div className="mt-3 grid gap-2 md:grid-cols-2">{savedViews.map((view)=><div key={view.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><button type="button" onClick={()=>applyView(view)} className="w-full text-left"><p className="text-sm font-black">{view.name}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{view.max_hops} hops · {view.direction_mode==="any"?"Either direction":"Recorded direction only"}{view.workspace_id?` · ${workspaces.find((row)=>row.id===view.workspace_id)?.name??"Workspace"}`:" · Unfiled"}</p></button><button type="button" onClick={()=>void deleteView(view.id)} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]"><Trash2 className="size-3.5"/>Delete</button></div>)}</div>{savedViews.length===0?<p className="mt-3 text-sm text-[var(--loombus-text-muted)]">No saved investigations yet.</p>:null}</div>
  </div></section>;
}

export function LibraryKnowledgeGraphV6Surface() {
  return <><LibraryKnowledgeGraphV4Surface/><PersistentSemanticExplorer/></>;
}
