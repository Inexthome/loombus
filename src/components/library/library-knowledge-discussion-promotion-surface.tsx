"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, MessageSquareShare, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DISCUSSION_TOPICS } from "@/lib/discussion-topics";
import { supabase } from "@/lib/supabase/client";

type KnowledgeObject = {
  id: string;
  title: string;
  summary: string | null;
  knowledge_type: "synthesis" | "finding" | "open_question";
  status: "draft" | "working" | "synthesized";
  updated_at: string;
};

type Claim = {
  id: string;
  statement: string;
  claim_type: "claim" | "question" | "conclusion";
  status: "draft" | "working" | "supported" | "contested";
};

type KnowledgeClaim = {
  knowledge_object_id: string;
  claim_id: string;
  role: "core" | "supporting" | "counterpoint";
};

type SelectedClaimSnapshot = {
  id: string;
  statement: string;
  claimType: Claim["claim_type"];
  status: Claim["status"];
  role: KnowledgeClaim["role"];
};

const PROMOTION_TOPICS = DISCUSSION_TOPICS.filter((topic) => topic !== "Other");

function label(value: string) {
  return value.replaceAll("_", " ");
}

export function LibraryKnowledgeDiscussionPromotionSurface() {
  const [knowledgeObjects, setKnowledgeObjects] = useState<KnowledgeObject[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [memberships, setMemberships] = useState<KnowledgeClaim[]>([]);
  const [selectedKnowledgeId, setSelectedKnowledgeId] = useState<string>("");
  const [selectedClaimIds, setSelectedClaimIds] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState<string>("");
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to promote Library knowledge to a discussion.");
      setLoading(false);
      return;
    }

    const [knowledgeResult, membershipResult, claimResult] = await Promise.all([
      supabase
        .from("library_knowledge_objects")
        .select("id, title, summary, knowledge_type, status, updated_at")
        .order("updated_at", { ascending: false }),
      supabase
        .from("library_knowledge_claims")
        .select("knowledge_object_id, claim_id, role"),
      supabase
        .from("library_research_claims")
        .select("id, statement, claim_type, status")
        .order("updated_at", { ascending: false }),
    ]);

    if (knowledgeResult.error || membershipResult.error || claimResult.error) {
      setError("Unable to load your private knowledge promotion review.");
      setLoading(false);
      return;
    }

    setKnowledgeObjects((knowledgeResult.data ?? []) as KnowledgeObject[]);
    setMemberships((membershipResult.data ?? []) as KnowledgeClaim[]);
    setClaims((claimResult.data ?? []) as Claim[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedKnowledge = useMemo(
    () => knowledgeObjects.find((row) => row.id === selectedKnowledgeId) ?? null,
    [knowledgeObjects, selectedKnowledgeId]
  );

  const claimById = useMemo(() => new Map(claims.map((claim) => [claim.id, claim])), [claims]);

  const availableClaims = useMemo(() => {
    if (!selectedKnowledgeId) return [];
    return memberships
      .filter((membership) => membership.knowledge_object_id === selectedKnowledgeId)
      .map((membership) => {
        const claim = claimById.get(membership.claim_id);
        return claim ? { claim, role: membership.role } : null;
      })
      .filter((row): row is { claim: Claim; role: KnowledgeClaim["role"] } => Boolean(row));
  }, [claimById, memberships, selectedKnowledgeId]);

  const selectedClaims = useMemo<SelectedClaimSnapshot[]>(
    () =>
      availableClaims
        .filter(({ claim }) => selectedClaimIds.has(claim.id))
        .map(({ claim, role }) => ({
          id: claim.id,
          statement: claim.statement,
          claimType: claim.claim_type,
          status: claim.status,
          role,
        })),
    [availableClaims, selectedClaimIds]
  );

  function chooseKnowledge(id: string) {
    setSelectedKnowledgeId(id);
    setSelectedClaimIds(new Set());
    setConfirmed(false);
    setError(null);
  }

  function toggleClaim(id: string) {
    setSelectedClaimIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmed(false);
  }

  async function publish() {
    if (!selectedKnowledge || !topic || !confirmed) return;
    if (!selectedKnowledge.summary?.trim() && selectedClaims.length === 0) {
      setError("This knowledge object needs a summary or at least one explicitly selected claim.");
      return;
    }

    setPublishing(true);
    setError(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError("Your session expired. Sign in again before publishing.");
      setPublishing(false);
      return;
    }

    const response = await fetch("/api/library/knowledge-discussion/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        knowledgeObjectId: selectedKnowledge.id,
        sourceUpdatedAt: selectedKnowledge.updated_at,
        topic,
        selectedClaims,
      }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(result.error ?? "Unable to promote this knowledge object.");
      setPublishing(false);
      return;
    }

    const discussionId = result.discussion?.id as string | undefined;
    if (!discussionId) {
      setError("The discussion was created, but Loombus could not open it.");
      setPublishing(false);
      return;
    }

    window.location.href = `/discussions/${discussionId}`;
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link
            href="/library/research/evidence"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"
          >
            <ArrowLeft className="size-4" /> Evidence & Knowledge
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
              <MessageSquareShare className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Promote to Discussion</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--loombus-text-muted)]">
                Review exactly what will become public. Nothing from private Research is included unless it appears in the approved knowledge summary or a claim you explicitly select below.
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">
            {error}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">1. Choose knowledge</p>
              <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">Private until final confirmation</p>
            </div>
            {knowledgeObjects.length ? (
              knowledgeObjects.map((knowledge) => (
                <button
                  key={knowledge.id}
                  type="button"
                  onClick={() => chooseKnowledge(knowledge.id)}
                  data-active={selectedKnowledgeId === knowledge.id ? "true" : "false"}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-left data-[active=true]:border-[var(--loombus-gold)] data-[active=true]:bg-[var(--loombus-gold-surface)]"
                >
                  <p className="font-black">{knowledge.title}</p>
                  <p className="mt-1 text-xs capitalize text-[var(--loombus-text-muted)]">
                    {label(knowledge.knowledge_type)} · {knowledge.status}
                  </p>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm text-[var(--loombus-text-muted)]">
                No knowledge objects yet. Build one in Evidence & Knowledge first.
              </div>
            )}
          </aside>

          <section className="min-w-0 space-y-5">
            {!selectedKnowledge ? (
              <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center text-sm text-[var(--loombus-text-muted)]">
                Choose a knowledge object to begin the publication review.
              </div>
            ) : (
              <>
                <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Public preview</p>
                  <h2 className="mt-3 text-2xl font-black">{selectedKnowledge.title}</h2>
                  {selectedKnowledge.summary ? (
                    <p className="mt-4 whitespace-pre-wrap text-sm leading-7">{selectedKnowledge.summary}</p>
                  ) : (
                    <p className="mt-4 text-sm italic text-[var(--loombus-text-muted)]">No knowledge summary. Select at least one claim below.</p>
                  )}
                </div>

                <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">2. Select public claims</p>
                  <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                    Claims start unselected. Selecting a claim publishes its statement only. Its private evidence, evidence note, saved passage, Research note, and tags stay private.
                  </p>
                  <div className="mt-4 space-y-3">
                    {availableClaims.length ? availableClaims.map(({ claim, role }) => {
                      const checked = selectedClaimIds.has(claim.id);
                      return (
                        <label key={claim.id} className="flex cursor-pointer gap-3 rounded-2xl border border-[var(--loombus-border)] p-4">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleClaim(claim.id)}
                            className="mt-1 size-4 accent-[var(--loombus-gold)]"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-6">{claim.statement}</span>
                            <span className="mt-1 block text-xs capitalize text-[var(--loombus-text-muted)]">
                              {role} · {claim.claim_type} · {claim.status}
                            </span>
                          </span>
                        </label>
                      );
                    }) : (
                      <p className="text-sm text-[var(--loombus-text-muted)]">No claims are linked to this knowledge object.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <label className="block">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">3. Discussion topic</span>
                    <select
                      value={topic}
                      onChange={(event) => { setTopic(event.target.value); setConfirmed(false); }}
                      className="mt-3 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 py-3 text-sm outline-none"
                    >
                      <option value="">Choose a topic</option>
                      {PROMOTION_TOPICS.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </label>
                </div>

                <div className="rounded-[1.5rem] border border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)] p-5">
                  <div className="flex gap-3">
                    <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--loombus-gold)]" />
                    <div>
                      <p className="font-black">Final public-boundary confirmation</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
                        The knowledge title, knowledge summary, and only the checked claim statements will become part of a public Loombus discussion. Private evidence and Research data remain private.
                      </p>
                      <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={confirmed}
                          onChange={(event) => setConfirmed(event.target.checked)}
                          className="mt-0.5 size-4 accent-[var(--loombus-gold)]"
                        />
                        <span>I reviewed this exact public payload and want to create the discussion.</span>
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={
                    publishing ||
                    !confirmed ||
                    !topic ||
                    (!selectedKnowledge.summary?.trim() && selectedClaims.length === 0)
                  }
                  onClick={() => void publish()}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-black text-black disabled:opacity-40"
                >
                  {publishing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                  Create public discussion
                </button>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
