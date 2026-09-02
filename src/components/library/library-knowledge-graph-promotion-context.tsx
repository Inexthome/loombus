"use client";

import Link from "next/link";
import { Brain, GitBranch, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Counts = {
  claims: number;
  evidence: number;
  knowledge: number;
  memberships: number;
  promotions: number;
};

export function LibraryKnowledgeGraphPromotionContext() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setLoading(false);
      return;
    }

    const [claims, evidence, knowledge, memberships, promotions] = await Promise.all([
      supabase.from("library_research_claims").select("id", { count: "exact", head: true }),
      supabase.from("library_research_claim_evidence").select("claim_id", { count: "exact", head: true }),
      supabase.from("library_knowledge_objects").select("id", { count: "exact", head: true }),
      supabase.from("library_knowledge_claims").select("knowledge_object_id", { count: "exact", head: true }),
      supabase.from("library_knowledge_discussion_promotions").select("discussion_id", { count: "exact", head: true }),
    ]);

    if ([claims, evidence, knowledge, memberships, promotions].some((result) => result.error)) {
      setCounts(null);
      setLoading(false);
      return;
    }

    setCounts({
      claims: claims.count ?? 0,
      evidence: evidence.count ?? 0,
      knowledge: knowledge.count ?? 0,
      memberships: memberships.count ?? 0,
      promotions: promotions.count ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="graph-editorial-provenance-band mx-auto max-w-7xl px-4 pt-5 text-[var(--loombus-text)] sm:px-6" aria-label="Knowledge Graph provenance model">
      <div className="graph-editorial-provenance-copy">
        <div className="flex min-w-0 items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--loombus-gold)]" />
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Relationship provenance</p>
            <h2 className="mt-1 text-lg font-black">Approved relationships only</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">The graph shows relationships already recorded by your actions. Loombus does not infer new claim, evidence, knowledge, or promotion links merely because two records appear related.</p>
          </div>
        </div>
        <Link href="/library/research/evidence" className="graph-editorial-context-link inline-flex min-h-10 items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><Brain className="size-4" /> Evidence & Knowledge</Link>
      </div>

      <div className="graph-editorial-counts mt-4 flex flex-wrap gap-x-5 gap-y-2 border-y border-[var(--loombus-border)] py-3">
        {loading ? (
          <span className="inline-flex items-center gap-2 text-xs text-[var(--loombus-text-muted)]"><Loader2 className="size-3.5 animate-spin" /> Loading provenance</span>
        ) : counts ? (
          <>
            <span><strong>{counts.claims}</strong> claims</span>
            <span><strong>{counts.evidence}</strong> evidence links</span>
            <span><strong>{counts.knowledge}</strong> knowledge objects</span>
            <span><strong>{counts.memberships}</strong> claim ↔ knowledge links</span>
            <span><strong>{counts.promotions}</strong> public promotions</span>
          </>
        ) : (
          <span className="text-xs text-[var(--loombus-text-muted)]">Provenance counts are temporarily unavailable; the graph remains owner-scoped.</span>
        )}
      </div>

      <p className="mt-3 inline-flex items-start gap-2 text-xs leading-5 text-[var(--loombus-text-subtle)]"><GitBranch className="mt-0.5 size-3.5 shrink-0 text-[var(--loombus-gold)]" /> Evidence links come from explicit passage-to-claim relations; knowledge links come from explicit claim roles; discussion edges come from recorded derivation or confirmed promotion records.</p>
    </section>
  );
}
