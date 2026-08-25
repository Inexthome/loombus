"use client";

import Link from "next/link";
import { Brain, GitBranch, Loader2, MessageSquareShare, Network, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type KnowledgeObject = {
  id: string;
  title: string;
  summary: string | null;
  knowledge_type: "synthesis" | "finding" | "open_question";
  status: "draft" | "working" | "synthesized";
  updated_at: string;
};

type KnowledgeClaim = {
  knowledge_object_id: string;
  claim_id: string;
  role: "core" | "supporting" | "counterpoint";
};

type Claim = {
  id: string;
  statement: string;
  status: "draft" | "working" | "supported" | "contested";
};

type ClaimEvidence = {
  claim_id: string;
  relation: "supports" | "challenges" | "context";
};

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function LibraryKnowledgePromotionBridge() {
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  const [memberships, setMemberships] = useState<KnowledgeClaim[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setLoading(false);
      return;
    }

    const [knowledgeResult, membershipResult, claimResult, evidenceResult] = await Promise.all([
      supabase.from("library_knowledge_objects").select("id, title, summary, knowledge_type, status, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_knowledge_claims").select("knowledge_object_id, claim_id, role"),
      supabase.from("library_research_claims").select("id, statement, status"),
      supabase.from("library_research_claim_evidence").select("claim_id, relation"),
    ]);

    if (knowledgeResult.error || membershipResult.error || claimResult.error || evidenceResult.error) {
      setError("Unable to evaluate knowledge promotion readiness.");
      setLoading(false);
      return;
    }

    setKnowledge((knowledgeResult.data ?? []) as KnowledgeObject[]);
    setMemberships((membershipResult.data ?? []) as KnowledgeClaim[]);
    setClaims((claimResult.data ?? []) as Claim[]);
    setEvidence((evidenceResult.data ?? []) as ClaimEvidence[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const claimById = useMemo(() => new Map(claims.map((claim) => [claim.id, claim])), [claims]);
  const recent = useMemo(() => knowledge.slice(0, 6), [knowledge]);

  if (loading) {
    return (
      <section className="mx-auto mt-5 max-w-6xl px-4 sm:px-6" aria-label="Knowledge promotion readiness">
        <div className="grid min-h-24 place-items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)]">
          <Loader2 className="size-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading knowledge readiness" />
        </div>
      </section>
    );
  }

  if (error) {
    return <section className="mx-auto mt-5 max-w-6xl px-4 text-sm text-[var(--loombus-text-muted)] sm:px-6">{error}</section>;
  }

  if (!recent.length) return null;

  return (
    <section className="mx-auto mt-5 max-w-6xl px-4 text-[var(--loombus-text)] sm:px-6" aria-label="Knowledge promotion readiness">
      <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><ShieldCheck className="size-5" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Knowledge promotion</p>
              <h2 className="mt-1 text-lg font-black">Evidence-backed, deliberate, and user approved</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Loombus does not invent graph relationships here. The Knowledge Graph reflects only relationships you explicitly created between saved evidence, claims, knowledge objects, and promoted discussions.</p>
            </div>
          </div>
          <Link href="/library/research/evidence/graph" className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black text-[var(--loombus-gold)] hover:border-[var(--loombus-gold)]"><Network className="size-4" /> Open Knowledge Graph</Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {recent.map((item) => {
            const linked = memberships.filter((row) => row.knowledge_object_id === item.id);
            const linkedClaims = linked.map((row) => claimById.get(row.claim_id)).filter((claim): claim is Claim => Boolean(claim));
            const linkedClaimIds = new Set(linkedClaims.map((claim) => claim.id));
            const evidenceRows = evidence.filter((row) => linkedClaimIds.has(row.claim_id));
            const evidenceBackedClaims = new Set(evidenceRows.map((row) => row.claim_id)).size;
            const supportCount = evidenceRows.filter((row) => row.relation === "supports").length;
            const challengeCount = evidenceRows.filter((row) => row.relation === "challenges").length;
            const ready = item.status === "synthesized" && Boolean(item.summary?.trim()) && linkedClaims.length > 0 && evidenceBackedClaims > 0;

            return (
              <article key={item.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]/30 p-4">
                <div className="flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.12em]">
                  <span className={ready ? "text-[var(--loombus-gold)]" : "text-[var(--loombus-text-subtle)]"}>{ready ? "Ready for review" : "Working knowledge"}</span>
                  <span className="text-[var(--loombus-text-subtle)]">{pretty(item.knowledge_type)} · {pretty(item.status)}</span>
                </div>
                <h3 className="mt-2 line-clamp-2 font-black">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-[var(--loombus-text-muted)]">{linkedClaims.length} linked claim{linkedClaims.length === 1 ? "" : "s"} · {evidenceBackedClaims} evidence-backed · {supportCount} supporting · {challengeCount} challenging</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/library/research/evidence/graph" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black text-[var(--loombus-text-muted)] hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-gold)]"><GitBranch className="size-3.5" /> Investigate graph</Link>
                  <Link href="/library/research/evidence/promote" className="inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-black text-[var(--loombus-text-muted)] hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-gold)]"><MessageSquareShare className="size-3.5" /> Review promotion</Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--loombus-gold-surface)] px-3 py-3 text-xs leading-5 text-[var(--loombus-text-muted)]">
          <Brain className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" />
          <p><span className="font-black text-[var(--loombus-text)]">Promotion is never automatic.</span> “Ready for review” means the object is synthesized, has a summary, includes at least one linked claim, and has at least one claim with explicit evidence. Public discussion promotion still requires a separate confirmation step.</p>
        </div>
      </div>
    </section>
  );
}
