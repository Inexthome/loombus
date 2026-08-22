"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  GitBranch,
  Link2,
  Loader2,
  MessageCircle,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Claim = {
  id: string;
  statement: string;
  claim_type: string;
  status: string;
  updated_at: string;
};

type KnowledgeObject = {
  id: string;
  title: string;
  summary: string | null;
  knowledge_type: string;
  status: string;
  updated_at: string;
};

type ResearchItem = {
  id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
};

type Publication = {
  id: string;
  title: string;
  author_name: string | null;
};

type Section = {
  publication_id: string;
  section_key: string;
  ordinal: number;
  title: string | null;
};

type ClaimEvidence = {
  claim_id: string;
  research_item_id: string;
  relation: string;
};

type KnowledgeClaim = {
  knowledge_object_id: string;
  claim_id: string;
  role: string;
};

type DiscussionClaimDerivation = {
  claim_id: string | null;
  discussion_id: string;
  source_discussion_title: string;
  source_discussion_topic: string;
  selected_text: string;
  created_at: string;
};

type DiscussionKnowledgeDerivation = {
  knowledge_object_id: string | null;
  discussion_id: string;
  source_discussion_title: string;
  source_discussion_topic: string;
  selected_text: string;
  created_at: string;
};

type ReplyClaimDerivation = {
  claim_id: string | null;
  discussion_id: string;
  reply_id: string;
  source_discussion_title: string;
  source_discussion_topic: string;
  selected_text: string;
  created_at: string;
};

type ReplyKnowledgeDerivation = {
  knowledge_object_id: string | null;
  discussion_id: string;
  reply_id: string;
  source_discussion_title: string;
  source_discussion_topic: string;
  selected_text: string;
  created_at: string;
};

type Promotion = {
  id: string;
  knowledge_object_id: string | null;
  discussion_id: string;
  published_title: string;
  created_at: string;
};

type PromotionClaim = {
  promotion_id: string;
  claim_id: string | null;
  published_statement: string;
  published_role: string;
};

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clip(value: string, limit = 240) {
  const text = value.trim();
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

export function LibraryKnowledgeProvenanceSurface() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [knowledgeClaims, setKnowledgeClaims] = useState<KnowledgeClaim[]>([]);
  const [discussionClaimOrigins, setDiscussionClaimOrigins] = useState<DiscussionClaimDerivation[]>([]);
  const [discussionKnowledgeOrigins, setDiscussionKnowledgeOrigins] = useState<DiscussionKnowledgeDerivation[]>([]);
  const [replyClaimOrigins, setReplyClaimOrigins] = useState<ReplyClaimDerivation[]>([]);
  const [replyKnowledgeOrigins, setReplyKnowledgeOrigins] = useState<ReplyKnowledgeDerivation[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promotionClaims, setPromotionClaims] = useState<PromotionClaim[]>([]);
  const [activeTab, setActiveTab] = useState<"claims" | "knowledge">("claims");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) {
      setError("Sign in to view private Library provenance.");
      setLoading(false);
      return;
    }

    const [
      claimsResult,
      knowledgeResult,
      itemsResult,
      evidenceResult,
      knowledgeClaimsResult,
      discussionClaimResult,
      discussionKnowledgeResult,
      replyClaimResult,
      replyKnowledgeResult,
      promotionResult,
      promotionClaimsResult,
    ] = await Promise.all([
      supabase.from("library_research_claims").select("id, statement, claim_type, status, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_knowledge_objects").select("id, title, summary, knowledge_type, status, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_research_items").select("id, publication_id, locator, selected_text"),
      supabase.from("library_research_claim_evidence").select("claim_id, research_item_id, relation"),
      supabase.from("library_knowledge_claims").select("knowledge_object_id, claim_id, role"),
      supabase.from("library_discussion_claim_derivations").select("claim_id, discussion_id, source_discussion_title, source_discussion_topic, selected_text, created_at"),
      supabase.from("library_discussion_knowledge_derivations").select("knowledge_object_id, discussion_id, source_discussion_title, source_discussion_topic, selected_text, created_at"),
      supabase.from("library_reply_claim_derivations").select("claim_id, discussion_id, reply_id, source_discussion_title, source_discussion_topic, selected_text, created_at"),
      supabase.from("library_reply_knowledge_derivations").select("knowledge_object_id, discussion_id, reply_id, source_discussion_title, source_discussion_topic, selected_text, created_at"),
      supabase.from("library_knowledge_discussion_promotions").select("id, knowledge_object_id, discussion_id, published_title, created_at"),
      supabase.from("library_knowledge_discussion_claims").select("promotion_id, claim_id, published_statement, published_role"),
    ]);

    const results = [
      claimsResult,
      knowledgeResult,
      itemsResult,
      evidenceResult,
      knowledgeClaimsResult,
      discussionClaimResult,
      discussionKnowledgeResult,
      replyClaimResult,
      replyKnowledgeResult,
      promotionResult,
      promotionClaimsResult,
    ];
    if (results.some((result) => result.error)) {
      setError("Unable to load the complete private provenance history.");
      setLoading(false);
      return;
    }

    const itemRows = (itemsResult.data ?? []) as ResearchItem[];
    setClaims((claimsResult.data ?? []) as Claim[]);
    setKnowledge((knowledgeResult.data ?? []) as KnowledgeObject[]);
    setItems(itemRows);
    setEvidence((evidenceResult.data ?? []) as ClaimEvidence[]);
    setKnowledgeClaims((knowledgeClaimsResult.data ?? []) as KnowledgeClaim[]);
    setDiscussionClaimOrigins((discussionClaimResult.data ?? []) as DiscussionClaimDerivation[]);
    setDiscussionKnowledgeOrigins((discussionKnowledgeResult.data ?? []) as DiscussionKnowledgeDerivation[]);
    setReplyClaimOrigins((replyClaimResult.data ?? []) as ReplyClaimDerivation[]);
    setReplyKnowledgeOrigins((replyKnowledgeResult.data ?? []) as ReplyKnowledgeDerivation[]);
    setPromotions((promotionResult.data ?? []) as Promotion[]);
    setPromotionClaims((promotionClaimsResult.data ?? []) as PromotionClaim[]);

    const publicationIds = [...new Set(itemRows.map((row) => row.publication_id))];
    if (publicationIds.length > 0) {
      const [publicationResult, sectionResult] = await Promise.all([
        supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds),
        supabase.from("library_publication_sections").select("publication_id, section_key, ordinal, title").in("publication_id", publicationIds),
      ]);
      if (!publicationResult.error) setPublications((publicationResult.data ?? []) as Publication[]);
      if (!sectionResult.error) setSections((sectionResult.data ?? []) as Section[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const publicationById = useMemo(() => new Map(publications.map((row) => [row.id, row])), [publications]);
  const sectionByKey = useMemo(() => new Map(sections.map((row) => [`${row.publication_id}:${row.section_key}`, row])), [sections]);
  const claimById = useMemo(() => new Map(claims.map((row) => [row.id, row])), [claims]);

  const visibleClaims = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return claims;
    return claims.filter((claim) => [claim.statement, claim.claim_type, claim.status].some((value) => value.toLowerCase().includes(needle)));
  }, [claims, query]);

  const visibleKnowledge = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return knowledge;
    return knowledge.filter((row) => [row.title, row.summary ?? "", row.knowledge_type, row.status].some((value) => value.toLowerCase().includes(needle)));
  }, [knowledge, query]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href="/library/research/evidence" className="inline-flex items-center gap-2 text-sm font-black text-[var(--loombus-gold)]">
            <ArrowLeft className="size-4" /> Evidence & Knowledge
          </Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid size-11 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]">
              <GitBranch className="size-5" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Knowledge Provenance</h1>
              <p className="mt-1 max-w-3xl text-sm text-[var(--loombus-text-muted)]">
                Audit where private claims and knowledge came from, which saved passages support them, and which public discussions they later informed. Provenance stays private.
              </p>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-[var(--loombus-surface-strong)] p-1.5">
            <button type="button" data-active={activeTab === "claims"} onClick={() => setActiveTab("claims")} className="rounded-xl px-4 py-2 text-sm font-black data-[active=true]:bg-[var(--loombus-gold)] data-[active=true]:text-black">Claims</button>
            <button type="button" data-active={activeTab === "knowledge"} onClick={() => setActiveTab("knowledge")} className="rounded-xl px-4 py-2 text-sm font-black data-[active=true]:bg-[var(--loombus-gold)] data-[active=true]:text-black">Knowledge</button>
          </div>
          <label className="flex min-w-0 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 sm:w-80">
            <Search className="size-4 text-[var(--loombus-text-subtle)]" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search provenance" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
        </div>

        {activeTab === "claims" ? (
          <section className="mt-6 space-y-4">
            {visibleClaims.map((claim) => {
              const passageLinks = evidence.filter((row) => row.claim_id === claim.id);
              const discussionOrigins = discussionClaimOrigins.filter((row) => row.claim_id === claim.id);
              const replyOrigins = replyClaimOrigins.filter((row) => row.claim_id === claim.id);
              const promotedSnapshots = promotionClaims.filter((row) => row.claim_id === claim.id);
              return (
                <article key={claim.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                    <span>{pretty(claim.claim_type)}</span><span>•</span><span>{pretty(claim.status)}</span>
                  </div>
                  <h2 className="mt-2 text-lg font-black leading-7">{claim.statement}</h2>

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {discussionOrigins.map((origin, index) => (
                      <div key={`discussion:${origin.discussion_id}:${index}`} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4">
                        <p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><MessageCircle className="size-4" /> Derived from opening post</p>
                        <p className="mt-2 text-sm font-bold">{origin.source_discussion_title}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--loombus-text-muted)]">“{clip(origin.selected_text)}”</p>
                        <Link href={`/discussions/${origin.discussion_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]">Open discussion <ExternalLink className="size-3" /></Link>
                      </div>
                    ))}
                    {replyOrigins.map((origin, index) => (
                      <div key={`reply:${origin.reply_id}:${index}`} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4">
                        <p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><MessageCircle className="size-4" /> Derived from reply</p>
                        <p className="mt-2 text-sm font-bold">{origin.source_discussion_title}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--loombus-text-muted)]">“{clip(origin.selected_text)}”</p>
                        <Link href={`/discussions/${origin.discussion_id}#reply-${origin.reply_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]">Open reply <ExternalLink className="size-3" /></Link>
                      </div>
                    ))}
                    {passageLinks.map((link) => {
                      const item = itemById.get(link.research_item_id);
                      if (!item) return null;
                      const publication = publicationById.get(item.publication_id);
                      const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
                      return (
                        <div key={`passage:${link.research_item_id}`} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4">
                          <p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><BookOpen className="size-4" /> Saved passage · {pretty(link.relation)}</p>
                          <p className="mt-2 text-sm font-bold">{publication?.title ?? "Publication"}{section ? ` · ${section.title ?? `Section ${section.ordinal + 1}`}` : ""}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--loombus-text-muted)]">“{clip(item.selected_text)}”</p>
                          <Link href={`/library/read/${item.publication_id}?locator=${encodeURIComponent(item.locator)}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]">Open source <ExternalLink className="size-3" /></Link>
                        </div>
                      );
                    })}
                  </div>

                  {promotedSnapshots.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-4">
                      <p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><Link2 className="size-4" /> Later published through knowledge</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {promotedSnapshots.map((snapshot, index) => {
                          const promotion = promotions.find((row) => row.id === snapshot.promotion_id);
                          return promotion ? <Link key={`${snapshot.promotion_id}:${index}`} href={`/discussions/${promotion.discussion_id}`} className="rounded-full bg-[var(--loombus-surface-strong)] px-3 py-1.5 text-xs font-black text-[var(--loombus-gold)]">{promotion.published_title} · {pretty(snapshot.published_role)}</Link> : null;
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
            {visibleClaims.length === 0 ? <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm text-[var(--loombus-text-muted)]">No matching claims.</p> : null}
          </section>
        ) : (
          <section className="mt-6 space-y-4">
            {visibleKnowledge.map((row) => {
              const discussionOrigins = discussionKnowledgeOrigins.filter((origin) => origin.knowledge_object_id === row.id);
              const replyOrigins = replyKnowledgeOrigins.filter((origin) => origin.knowledge_object_id === row.id);
              const linkedClaims = knowledgeClaims.filter((membership) => membership.knowledge_object_id === row.id);
              const outgoingPromotions = promotions.filter((promotion) => promotion.knowledge_object_id === row.id);
              return (
                <article key={row.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]"><span>{pretty(row.knowledge_type)}</span><span>•</span><span>{pretty(row.status)}</span></div>
                  <h2 className="mt-2 text-xl font-black">{row.title}</h2>
                  {row.summary ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{clip(row.summary, 500)}</p> : null}

                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {discussionOrigins.map((origin, index) => <div key={`d:${origin.discussion_id}:${index}`} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4"><p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><MessageCircle className="size-4" /> Derived from opening post</p><p className="mt-2 text-sm font-bold">{origin.source_discussion_title}</p><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">“{clip(origin.selected_text)}”</p><Link href={`/discussions/${origin.discussion_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]">Open discussion <ExternalLink className="size-3" /></Link></div>)}
                    {replyOrigins.map((origin, index) => <div key={`r:${origin.reply_id}:${index}`} className="rounded-2xl bg-[var(--loombus-surface-strong)] p-4"><p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><MessageCircle className="size-4" /> Derived from reply</p><p className="mt-2 text-sm font-bold">{origin.source_discussion_title}</p><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">“{clip(origin.selected_text)}”</p><Link href={`/discussions/${origin.discussion_id}#reply-${origin.reply_id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-[var(--loombus-gold)]">Open reply <ExternalLink className="size-3" /></Link></div>)}
                  </div>

                  {linkedClaims.length > 0 ? <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-4"><p className="text-xs font-black text-[var(--loombus-gold)]">Linked private claims</p><div className="mt-2 space-y-2">{linkedClaims.map((membership) => { const claim = claimById.get(membership.claim_id); return claim ? <div key={`${membership.claim_id}:${membership.role}`} className="rounded-xl bg-[var(--loombus-surface-strong)] p-3 text-sm"><span className="mr-2 text-xs font-black uppercase text-[var(--loombus-text-subtle)]">{pretty(membership.role)}</span>{claim.statement}</div> : null; })}</div></div> : null}

                  {outgoingPromotions.length > 0 ? <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-4"><p className="flex items-center gap-2 text-xs font-black text-[var(--loombus-gold)]"><Link2 className="size-4" /> Promoted to public discussion</p><div className="mt-2 flex flex-wrap gap-2">{outgoingPromotions.map((promotion) => <Link key={promotion.id} href={`/discussions/${promotion.discussion_id}`} className="rounded-full bg-[var(--loombus-surface-strong)] px-3 py-1.5 text-xs font-black text-[var(--loombus-gold)]">{promotion.published_title}</Link>)}</div></div> : null}
                </article>
              );
            })}
            {visibleKnowledge.length === 0 ? <p className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 text-sm text-[var(--loombus-text-muted)]">No matching knowledge objects.</p> : null}
          </section>
        )}
      </div>
    </main>
  );
}
