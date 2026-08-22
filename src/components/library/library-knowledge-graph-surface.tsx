"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, CircleDot, GitBranch, Loader2, MessageSquare, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type NodeKind = "publication" | "claim" | "knowledge" | "discussion";
type GraphNode = { id: string; kind: NodeKind; title: string; subtitle?: string | null; href?: string | null };
type GraphEdge = { id: string; from: string; to: string; label: string };

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

function nodeKey(kind: NodeKind, id: string) {
  return `${kind}:${id}`;
}

function compact(value: string, max = 130) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function LibraryKnowledgeGraphSurface() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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
      publicationIds.length
        ? supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds)
        : Promise.resolve({ data: [], error: null }),
      discussionIds.length
        ? supabase.from("discussions").select("id, title, topic").in("id", discussionIds).is("deleted_at", null)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (publicationResult.error || discussionResult.error) {
      setError("The graph loaded, but some source labels are unavailable.");
    }

    const publications = (publicationResult.data ?? []) as Publication[];
    const discussions = (discussionResult.data ?? []) as Discussion[];
    const nextNodes: GraphNode[] = [
      ...publications.map((row) => ({ id: row.id, kind: "publication" as const, title: row.title, subtitle: row.author_name, href: `/library/read/${row.id}` })),
      ...claims.map((row) => ({ id: row.id, kind: "claim" as const, title: compact(row.statement), subtitle: `${row.claim_type} · ${row.status}`, href: "/library/research/evidence" })),
      ...knowledge.map((row) => ({ id: row.id, kind: "knowledge" as const, title: row.title, subtitle: `${row.knowledge_type} · ${row.status}`, href: "/library/research/evidence" })),
      ...discussions.map((row) => ({ id: row.id, kind: "discussion" as const, title: row.title, subtitle: row.topic, href: `/discussions/${row.id}` })),
    ];

    const itemById = new Map(items.map((item) => [item.id, item]));
    const nextEdges: GraphEdge[] = [];
    const push = (from: string, to: string, label: string) => {
      const id = `${from}|${to}|${label}`;
      if (!nextEdges.some((edge) => edge.id === id)) nextEdges.push({ id, from, to, label });
    };

    for (const row of evidence) {
      const item = itemById.get(row.research_item_id);
      if (item) push(nodeKey("publication", item.publication_id), nodeKey("claim", row.claim_id), row.relation);
    }
    for (const row of memberships) push(nodeKey("claim", row.claim_id), nodeKey("knowledge", row.knowledge_object_id), row.role);
    for (const row of discussionClaims) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from opening post");
    for (const row of discussionKnowledge) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from opening post");
    for (const row of replyClaims) if (row.claim_id) push(nodeKey("discussion", row.discussion_id), nodeKey("claim", row.claim_id), "derived from reply");
    for (const row of replyKnowledge) if (row.knowledge_object_id) push(nodeKey("discussion", row.discussion_id), nodeKey("knowledge", row.knowledge_object_id), "derived from reply");
    for (const row of promotions) if (row.knowledge_object_id) push(nodeKey("knowledge", row.knowledge_object_id), nodeKey("discussion", row.discussion_id), "promoted to discussion");

    setNodes(nextNodes);
    setEdges(nextEdges.filter((edge) => nextNodes.some((node) => nodeKey(node.kind, node.id) === edge.from) && nextNodes.some((node) => nodeKey(node.kind, node.id) === edge.to)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const nodeMap = useMemo(() => new Map(nodes.map((node) => [nodeKey(node.kind, node.id), node])), [nodes]);
  const selectedNode = selectedKey ? nodeMap.get(selectedKey) ?? null : null;
  const selectedEdges = useMemo(() => selectedKey ? edges.filter((edge) => edge.from === selectedKey || edge.to === selectedKey) : [], [edges, selectedKey]);
  const connectedKeys = useMemo(() => new Set(selectedEdges.flatMap((edge) => [edge.from, edge.to])), [selectedEdges]);
  const needle = query.trim().toLocaleLowerCase();

  const visibleByKind = useMemo(() => {
    const map = new Map<NodeKind, GraphNode[]>();
    for (const kind of kindOrder) {
      map.set(kind, nodes.filter((node) => node.kind === kind && (!needle || [node.title, node.subtitle].filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(needle)))));
    }
    return map;
  }, [needle, nodes]);

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-16">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href="/library/research/evidence" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Evidence & Knowledge</Link>
          <div className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Private relationship map</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight">Knowledge Graph</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Navigate the connections among publications, evidence-backed claims, synthesized knowledge, and public discussions. This graph is private and read-only.</p>
            </div>
            <Link href="/library/research/evidence/provenance" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)]"><GitBranch className="size-4" /> Provenance</Link>
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3">
          <Search className="size-4 text-[var(--loombus-text-subtle)]" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search nodes…" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          <span className="text-xs text-[var(--loombus-text-subtle)]">{nodes.length} nodes · {edges.length} relationships</span>
        </div>

        <section className="mt-6 overflow-x-auto pb-3" aria-label="Private Library knowledge graph">
          <div className="grid min-w-[1000px] grid-cols-4 gap-4">
            {kindOrder.map((kind) => (
              <div key={kind} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black">{kindLabel[kind]}</h2>
                  <span className="rounded-full bg-[var(--loombus-surface-strong)] px-2 py-1 text-[11px] font-black text-[var(--loombus-text-subtle)]">{visibleByKind.get(kind)?.length ?? 0}</span>
                </div>
                <div className="space-y-2">
                  {(visibleByKind.get(kind) ?? []).map((node) => {
                    const key = nodeKey(node.kind, node.id);
                    const active = selectedKey === key;
                    const connected = !selectedKey || connectedKeys.has(key);
                    return (
                      <button key={key} type="button" onClick={() => setSelectedKey(active ? null : key)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3 text-left transition disabled:opacity-40" style={{ opacity: connected ? 1 : 0.42 }} aria-pressed={active}>
                        <div className="flex items-start gap-2">
                          {kind === "publication" ? <BookOpen className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" /> : kind === "discussion" ? <MessageSquare className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" /> : <CircleDot className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" />}
                          <div className="min-w-0"><p className="text-sm font-black leading-5">{node.title}</p>{node.subtitle ? <p className="mt-1 text-[11px] leading-4 text-[var(--loombus-text-subtle)]">{node.subtitle}</p> : null}</div>
                        </div>
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
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Relationship inspector</p>
              <h2 className="mt-1 text-xl font-black">{selectedNode ? selectedNode.title : "Select a node"}</h2>
            </div>
            {selectedNode?.href ? <Link href={selectedNode.href} className="text-sm font-black text-[var(--loombus-gold)]">Open source →</Link> : null}
          </div>
          {!selectedNode ? <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">Select any publication, claim, knowledge object, or discussion to isolate its direct relationships.</p> : (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {selectedEdges.map((edge) => {
                const otherKey = edge.from === selectedKey ? edge.to : edge.from;
                const other = nodeMap.get(otherKey);
                if (!other) return null;
                return <button key={edge.id} type="button" onClick={() => setSelectedKey(otherKey)} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-left"><p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{edge.label}</p><p className="mt-1 text-sm font-black">{other.title}</p><p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">{kindLabel[other.kind]}</p></button>;
              })}
              {selectedEdges.length === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No direct relationships are recorded for this node yet.</p> : null}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
