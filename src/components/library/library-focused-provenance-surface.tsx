"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, GitBranch, Loader2, MessageCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type FocusKind = "claim" | "knowledge";
type Trace = { id: string; label: string; title: string; detail?: string | null; href?: string | null };

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function clip(value: string, max = 300) {
  const text = value.trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function LibraryFocusedProvenanceSurface({ focusKind, focusId, relation }: { focusKind: FocusKind; focusId: string; relation: string }) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to trace private Library provenance.");
      setLoading(false);
      return;
    }

    const next: Trace[] = [];
    if (focusKind === "claim") {
      const [claimResult, discussionResult, replyResult, evidenceResult, membershipResult, promotionClaimResult] = await Promise.all([
        supabase.from("library_research_claims").select("id, statement, claim_type, status").eq("id", focusId).single(),
        supabase.from("library_discussion_claim_derivations").select("discussion_id, source_discussion_title, selected_text").eq("claim_id", focusId),
        supabase.from("library_reply_claim_derivations").select("discussion_id, reply_id, source_discussion_title, selected_text").eq("claim_id", focusId),
        supabase.from("library_research_claim_evidence").select("research_item_id, relation").eq("claim_id", focusId),
        supabase.from("library_knowledge_claims").select("knowledge_object_id, role").eq("claim_id", focusId),
        supabase.from("library_knowledge_discussion_claims").select("promotion_id, published_role").eq("claim_id", focusId),
      ]);
      if (claimResult.error || !claimResult.data) {
        setError("This private claim is unavailable.");
        setLoading(false);
        return;
      }
      setTitle(String(claimResult.data.statement));
      setSubtitle(`${pretty(String(claimResult.data.claim_type))} · ${pretty(String(claimResult.data.status))}`);

      if (relation === "derived from opening post") {
        for (const row of discussionResult.data ?? []) next.push({ id: `opening:${row.discussion_id}`, label: relation, title: String(row.source_discussion_title), detail: clip(String(row.selected_text)), href: `/discussions/${row.discussion_id}` });
      } else if (relation === "derived from reply") {
        for (const row of replyResult.data ?? []) next.push({ id: `reply:${row.reply_id}`, label: relation, title: String(row.source_discussion_title), detail: clip(String(row.selected_text)), href: `/discussions/${row.discussion_id}#reply-${row.reply_id}` });
      } else if (["supports", "challenges", "context"].includes(relation)) {
        const evidenceRows = (evidenceResult.data ?? []).filter((row) => row.relation === relation);
        const itemIds = evidenceRows.map((row) => row.research_item_id);
        if (itemIds.length) {
          const { data: items } = await supabase.from("library_research_items").select("id, publication_id, locator, selected_text").in("id", itemIds);
          const publicationIds = [...new Set((items ?? []).map((row) => row.publication_id))];
          const { data: publications } = publicationIds.length ? await supabase.from("library_publications").select("id, title").in("id", publicationIds) : { data: [] };
          const publicationById = new Map((publications ?? []).map((row) => [row.id, row.title]));
          for (const item of items ?? []) next.push({ id: `passage:${item.id}`, label: relation, title: String(publicationById.get(item.publication_id) ?? "Publication"), detail: clip(String(item.selected_text)), href: `/library/read/${item.publication_id}?locator=${encodeURIComponent(item.locator)}` });
        }
      } else if (["core", "supporting", "counterpoint"].includes(relation)) {
        const memberships = (membershipResult.data ?? []).filter((row) => row.role === relation);
        const ids = memberships.map((row) => row.knowledge_object_id);
        if (ids.length) {
          const { data: objects } = await supabase.from("library_knowledge_objects").select("id, title, summary").in("id", ids);
          for (const row of objects ?? []) next.push({ id: `knowledge:${row.id}`, label: relation, title: String(row.title), detail: row.summary ? clip(String(row.summary)) : null, href: "/library/research/evidence" });
        }
      } else if (relation === "promoted to discussion") {
        const promotionIds = (promotionClaimResult.data ?? []).map((row) => row.promotion_id);
        if (promotionIds.length) {
          const { data: promotions } = await supabase.from("library_knowledge_discussion_promotions").select("id, discussion_id, published_title").in("id", promotionIds);
          for (const row of promotions ?? []) next.push({ id: `promotion:${row.id}`, label: relation, title: String(row.published_title), href: `/discussions/${row.discussion_id}` });
        }
      }
    } else {
      const [knowledgeResult, discussionResult, replyResult, membershipResult, promotionResult] = await Promise.all([
        supabase.from("library_knowledge_objects").select("id, title, summary, knowledge_type, status").eq("id", focusId).single(),
        supabase.from("library_discussion_knowledge_derivations").select("discussion_id, source_discussion_title, selected_text").eq("knowledge_object_id", focusId),
        supabase.from("library_reply_knowledge_derivations").select("discussion_id, reply_id, source_discussion_title, selected_text").eq("knowledge_object_id", focusId),
        supabase.from("library_knowledge_claims").select("claim_id, role").eq("knowledge_object_id", focusId),
        supabase.from("library_knowledge_discussion_promotions").select("id, discussion_id, published_title").eq("knowledge_object_id", focusId),
      ]);
      if (knowledgeResult.error || !knowledgeResult.data) {
        setError("This private knowledge object is unavailable.");
        setLoading(false);
        return;
      }
      setTitle(String(knowledgeResult.data.title));
      setSubtitle(`${pretty(String(knowledgeResult.data.knowledge_type))} · ${pretty(String(knowledgeResult.data.status))}`);

      if (relation === "derived from opening post") {
        for (const row of discussionResult.data ?? []) next.push({ id: `opening:${row.discussion_id}`, label: relation, title: String(row.source_discussion_title), detail: clip(String(row.selected_text)), href: `/discussions/${row.discussion_id}` });
      } else if (relation === "derived from reply") {
        for (const row of replyResult.data ?? []) next.push({ id: `reply:${row.reply_id}`, label: relation, title: String(row.source_discussion_title), detail: clip(String(row.selected_text)), href: `/discussions/${row.discussion_id}#reply-${row.reply_id}` });
      } else if (["core", "supporting", "counterpoint"].includes(relation)) {
        const memberships = (membershipResult.data ?? []).filter((row) => row.role === relation);
        const ids = memberships.map((row) => row.claim_id);
        if (ids.length) {
          const { data: claims } = await supabase.from("library_research_claims").select("id, statement, claim_type, status").in("id", ids);
          for (const row of claims ?? []) next.push({ id: `claim:${row.id}`, label: relation, title: clip(String(row.statement), 180), detail: `${pretty(String(row.claim_type))} · ${pretty(String(row.status))}`, href: "/library/research/evidence" });
        }
      } else if (relation === "promoted to discussion") {
        for (const row of promotionResult.data ?? []) next.push({ id: `promotion:${row.id}`, label: relation, title: String(row.published_title), href: `/discussions/${row.discussion_id}` });
      }
    }

    setTraces(next);
    setLoading(false);
  }, [focusId, focusKind, relation]);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-4xl">
        <Link href="/library/research/evidence/graph" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Knowledge Graph</Link>
        <header className="mt-5 border-b border-[var(--loombus-border)] pb-6">
          <div className="flex items-start gap-3"><div className="grid size-11 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><GitBranch className="size-5" /></div><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--loombus-gold)]">Focused provenance trace</p><h1 className="mt-1 text-2xl font-black">{title || "Provenance"}</h1><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{subtitle}</p></div></div>
          <div className="mt-4 inline-flex rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1.5 text-xs font-black text-[var(--loombus-gold)]">Relationship: {pretty(relation)}</div>
        </header>
        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}
        <section className="mt-6 space-y-3">
          {traces.map((trace) => (
            <article key={trace.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{trace.label.includes("passage") || ["supports", "challenges", "context"].includes(trace.label) ? <BookOpen className="size-4" /> : <MessageCircle className="size-4" />}{pretty(trace.label)}</p>
              <h2 className="mt-2 text-lg font-black">{trace.title}</h2>
              {trace.detail ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{trace.detail}</p> : null}
              {trace.href ? <Link href={trace.href} className="mt-3 inline-block text-xs font-black text-[var(--loombus-gold)]">Open source →</Link> : null}
            </article>
          ))}
          {!error && traces.length === 0 ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm text-[var(--loombus-text-muted)]">No provenance record matching this exact relationship is available for the selected object.</div> : null}
        </section>
        <Link href="/library/research/evidence/provenance" className="mt-6 inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]"><GitBranch className="size-4" /> Open full provenance history</Link>
      </div>
    </main>
  );
}
