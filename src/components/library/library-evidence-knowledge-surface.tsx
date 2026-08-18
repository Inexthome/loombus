"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  FileText,
  FlaskConical,
  Link2,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ResearchItem = {
  id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
  created_at: string;
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

type Claim = {
  id: string;
  user_id: string;
  statement: string;
  claim_type: "claim" | "question" | "conclusion";
  status: "draft" | "working" | "supported" | "contested";
  rationale: string | null;
  created_at: string;
  updated_at: string;
};

type ClaimEvidence = {
  claim_id: string;
  research_item_id: string;
  relation: "supports" | "challenges" | "context";
  note: string | null;
  created_at: string;
};

type KnowledgeObject = {
  id: string;
  user_id: string;
  title: string;
  summary: string | null;
  knowledge_type: "synthesis" | "finding" | "open_question";
  status: "draft" | "working" | "synthesized";
  created_at: string;
  updated_at: string;
};

type KnowledgeClaim = {
  knowledge_object_id: string;
  claim_id: string;
  role: "core" | "supporting" | "counterpoint";
  created_at: string;
};

const CLAIM_TYPES: Claim["claim_type"][] = ["claim", "question", "conclusion"];
const CLAIM_STATUSES: Claim["status"][] = ["draft", "working", "supported", "contested"];
const EVIDENCE_RELATIONS: ClaimEvidence["relation"][] = ["supports", "challenges", "context"];
const KNOWLEDGE_TYPES: KnowledgeObject["knowledge_type"][] = ["synthesis", "finding", "open_question"];
const KNOWLEDGE_STATUSES: KnowledgeObject["status"][] = ["draft", "working", "synthesized"];
const KNOWLEDGE_ROLES: KnowledgeClaim["role"][] = ["core", "supporting", "counterpoint"];

function pretty(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function sectionLabel(section: Section | undefined) {
  return section?.title ?? (section ? `Section ${section.ordinal + 1}` : "Unavailable chapter");
}

export function LibraryEvidenceKnowledgeSurface() {
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<ResearchItem[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<ClaimEvidence[]>([]);
  const [knowledgeObjects, setKnowledgeObjects] = useState<KnowledgeObject[]>([]);
  const [knowledgeClaims, setKnowledgeClaims] = useState<KnowledgeClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"claims" | "knowledge">("claims");

  const [claimStatement, setClaimStatement] = useState("");
  const [claimType, setClaimType] = useState<Claim["claim_type"]>("claim");
  const [claimStatus, setClaimStatus] = useState<Claim["status"]>("draft");
  const [claimRationale, setClaimRationale] = useState("");
  const [editingClaimId, setEditingClaimId] = useState<string | null>(null);

  const [knowledgeTitle, setKnowledgeTitle] = useState("");
  const [knowledgeType, setKnowledgeType] = useState<KnowledgeObject["knowledge_type"]>("synthesis");
  const [knowledgeStatus, setKnowledgeStatus] = useState<KnowledgeObject["status"]>("draft");
  const [knowledgeSummary, setKnowledgeSummary] = useState("");
  const [editingKnowledgeId, setEditingKnowledgeId] = useState<string | null>(null);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Sign in to use the Evidence & Knowledge workspace.");
      setLoading(false);
      return;
    }
    setUserId(user.id);

    const [itemsResult, claimsResult, evidenceResult, knowledgeResult, knowledgeClaimsResult] = await Promise.all([
      supabase.from("library_research_items").select("id, publication_id, locator, selected_text, created_at").order("created_at", { ascending: false }),
      supabase.from("library_research_claims").select("id, user_id, statement, claim_type, status, rationale, created_at, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_research_claim_evidence").select("claim_id, research_item_id, relation, note, created_at"),
      supabase.from("library_knowledge_objects").select("id, user_id, title, summary, knowledge_type, status, created_at, updated_at").order("updated_at", { ascending: false }),
      supabase.from("library_knowledge_claims").select("knowledge_object_id, claim_id, role, created_at"),
    ]);

    if (itemsResult.error || claimsResult.error || evidenceResult.error || knowledgeResult.error || knowledgeClaimsResult.error) {
      setError("Unable to load the complete Evidence & Knowledge workspace.");
      setLoading(false);
      return;
    }

    const itemRows = (itemsResult.data ?? []) as ResearchItem[];
    setItems(itemRows);
    setClaims((claimsResult.data ?? []) as Claim[]);
    setEvidence((evidenceResult.data ?? []) as ClaimEvidence[]);
    setKnowledgeObjects((knowledgeResult.data ?? []) as KnowledgeObject[]);
    setKnowledgeClaims((knowledgeClaimsResult.data ?? []) as KnowledgeClaim[]);

    const publicationIds = Array.from(new Set(itemRows.map((row) => row.publication_id)));
    if (publicationIds.length) {
      const [publicationResult, sectionResult] = await Promise.all([
        supabase.from("library_publications").select("id, title, author_name").in("id", publicationIds),
        supabase.from("library_publication_sections").select("publication_id, section_key, ordinal, title").in("publication_id", publicationIds).order("ordinal", { ascending: true }),
      ]);
      if (publicationResult.error || sectionResult.error) {
        setError("The reasoning workspace loaded, but some publication details are unavailable.");
      }
      setPublications((publicationResult.data ?? []) as Publication[]);
      setSections((sectionResult.data ?? []) as Section[]);
    } else {
      setPublications([]);
      setSections([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const publicationById = useMemo(() => new Map(publications.map((row) => [row.id, row])), [publications]);
  const sectionByKey = useMemo(() => new Map(sections.map((row) => [`${row.publication_id}:${row.section_key}`, row])), [sections]);
  const itemById = useMemo(() => new Map(items.map((row) => [row.id, row])), [items]);
  const claimById = useMemo(() => new Map(claims.map((row) => [row.id, row])), [claims]);

  const filteredClaims = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return claims;
    return claims.filter((claim) => {
      const linkedEvidence = evidence.filter((row) => row.claim_id === claim.id);
      const evidenceText = linkedEvidence.flatMap((row) => {
        const item = itemById.get(row.research_item_id);
        const publication = item ? publicationById.get(item.publication_id) : undefined;
        return [row.note, item?.selected_text, publication?.title, publication?.author_name, row.relation];
      });
      return [claim.statement, claim.rationale, claim.claim_type, claim.status, ...evidenceText]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle));
    });
  }, [claims, evidence, itemById, publicationById, query]);

  const filteredKnowledge = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return knowledgeObjects;
    return knowledgeObjects.filter((knowledge) => {
      const linkedClaims = knowledgeClaims
        .filter((row) => row.knowledge_object_id === knowledge.id)
        .map((row) => claimById.get(row.claim_id)?.statement);
      return [knowledge.title, knowledge.summary, knowledge.knowledge_type, knowledge.status, ...linkedClaims]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(needle));
    });
  }, [claimById, knowledgeClaims, knowledgeObjects, query]);

  function resetClaimForm() {
    setEditingClaimId(null);
    setClaimStatement("");
    setClaimType("claim");
    setClaimStatus("draft");
    setClaimRationale("");
  }

  function beginEditClaim(claim: Claim) {
    setEditingClaimId(claim.id);
    setClaimStatement(claim.statement);
    setClaimType(claim.claim_type);
    setClaimStatus(claim.status);
    setClaimRationale(claim.rationale ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveClaim() {
    if (!userId) return;
    const statement = claimStatement.trim();
    if (!statement) return;
    setBusyKey("claim-form");
    setError(null);
    const payload = {
      user_id: userId,
      statement,
      claim_type: claimType,
      status: claimStatus,
      rationale: claimRationale.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const result = editingClaimId
      ? await supabase.from("library_research_claims").update(payload).eq("id", editingClaimId).eq("user_id", userId).select("id, user_id, statement, claim_type, status, rationale, created_at, updated_at").single()
      : await supabase.from("library_research_claims").insert(payload).select("id, user_id, statement, claim_type, status, rationale, created_at, updated_at").single();

    if (result.error) {
      setError(editingClaimId ? "Unable to update this claim." : "Unable to create this claim.");
    } else if (result.data) {
      const saved = result.data as Claim;
      setClaims((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
      resetClaimForm();
    }
    setBusyKey(null);
  }

  async function deleteClaim(claim: Claim) {
    if (!userId || !window.confirm("Delete this claim? Its evidence and knowledge links will also be removed.")) return;
    setBusyKey(`claim:${claim.id}`);
    setError(null);
    const { error: deleteError } = await supabase.from("library_research_claims").delete().eq("id", claim.id).eq("user_id", userId);
    if (deleteError) {
      setError("Unable to delete this claim.");
    } else {
      setClaims((rows) => rows.filter((row) => row.id !== claim.id));
      setEvidence((rows) => rows.filter((row) => row.claim_id !== claim.id));
      setKnowledgeClaims((rows) => rows.filter((row) => row.claim_id !== claim.id));
      if (editingClaimId === claim.id) resetClaimForm();
    }
    setBusyKey(null);
  }

  async function setEvidenceRelation(claimId: string, itemId: string, relation: ClaimEvidence["relation"] | "none") {
    const existing = evidence.find((row) => row.claim_id === claimId && row.research_item_id === itemId);
    setBusyKey(`evidence:${claimId}:${itemId}`);
    setError(null);

    if (relation === "none") {
      if (existing) {
        const { error: deleteError } = await supabase.from("library_research_claim_evidence").delete().eq("claim_id", claimId).eq("research_item_id", itemId);
        if (deleteError) setError("Unable to remove this evidence relation.");
        else setEvidence((rows) => rows.filter((row) => !(row.claim_id === claimId && row.research_item_id === itemId)));
      }
      setBusyKey(null);
      return;
    }

    if (existing) {
      const result = await supabase.from("library_research_claim_evidence").update({ relation }).eq("claim_id", claimId).eq("research_item_id", itemId).select("claim_id, research_item_id, relation, note, created_at").single();
      if (result.error) setError("Unable to update this evidence relation.");
      else if (result.data) setEvidence((rows) => [result.data as ClaimEvidence, ...rows.filter((row) => !(row.claim_id === claimId && row.research_item_id === itemId))]);
    } else {
      const result = await supabase.from("library_research_claim_evidence").insert({ claim_id: claimId, research_item_id: itemId, relation }).select("claim_id, research_item_id, relation, note, created_at").single();
      if (result.error) setError("Unable to attach this saved passage as evidence.");
      else if (result.data) setEvidence((rows) => [result.data as ClaimEvidence, ...rows]);
    }
    setBusyKey(null);
  }

  async function saveEvidenceNote(row: ClaimEvidence, note: string) {
    setBusyKey(`evidence-note:${row.claim_id}:${row.research_item_id}`);
    const result = await supabase.from("library_research_claim_evidence").update({ note: note.trim() || null }).eq("claim_id", row.claim_id).eq("research_item_id", row.research_item_id).select("claim_id, research_item_id, relation, note, created_at").single();
    if (result.error) setError("Unable to save this evidence note.");
    else if (result.data) setEvidence((rows) => [result.data as ClaimEvidence, ...rows.filter((existing) => !(existing.claim_id === row.claim_id && existing.research_item_id === row.research_item_id))]);
    setBusyKey(null);
  }

  function resetKnowledgeForm() {
    setEditingKnowledgeId(null);
    setKnowledgeTitle("");
    setKnowledgeType("synthesis");
    setKnowledgeStatus("draft");
    setKnowledgeSummary("");
  }

  function beginEditKnowledge(knowledge: KnowledgeObject) {
    setEditingKnowledgeId(knowledge.id);
    setKnowledgeTitle(knowledge.title);
    setKnowledgeType(knowledge.knowledge_type);
    setKnowledgeStatus(knowledge.status);
    setKnowledgeSummary(knowledge.summary ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveKnowledge() {
    if (!userId) return;
    const title = knowledgeTitle.trim();
    if (!title) return;
    setBusyKey("knowledge-form");
    setError(null);
    const payload = {
      user_id: userId,
      title,
      summary: knowledgeSummary.trim() || null,
      knowledge_type: knowledgeType,
      status: knowledgeStatus,
      updated_at: new Date().toISOString(),
    };

    const result = editingKnowledgeId
      ? await supabase.from("library_knowledge_objects").update(payload).eq("id", editingKnowledgeId).eq("user_id", userId).select("id, user_id, title, summary, knowledge_type, status, created_at, updated_at").single()
      : await supabase.from("library_knowledge_objects").insert(payload).select("id, user_id, title, summary, knowledge_type, status, created_at, updated_at").single();

    if (result.error) setError(editingKnowledgeId ? "Unable to update this knowledge object." : "Unable to create this knowledge object.");
    else if (result.data) {
      const saved = result.data as KnowledgeObject;
      setKnowledgeObjects((rows) => [saved, ...rows.filter((row) => row.id !== saved.id)]);
      resetKnowledgeForm();
    }
    setBusyKey(null);
  }

  async function deleteKnowledge(knowledge: KnowledgeObject) {
    if (!userId || !window.confirm("Delete this knowledge object? Claims will remain in Research.")) return;
    setBusyKey(`knowledge:${knowledge.id}`);
    const { error: deleteError } = await supabase.from("library_knowledge_objects").delete().eq("id", knowledge.id).eq("user_id", userId);
    if (deleteError) setError("Unable to delete this knowledge object.");
    else {
      setKnowledgeObjects((rows) => rows.filter((row) => row.id !== knowledge.id));
      setKnowledgeClaims((rows) => rows.filter((row) => row.knowledge_object_id !== knowledge.id));
      if (editingKnowledgeId === knowledge.id) resetKnowledgeForm();
    }
    setBusyKey(null);
  }

  async function setKnowledgeClaimRole(knowledgeId: string, claimId: string, role: KnowledgeClaim["role"] | "none") {
    const existing = knowledgeClaims.find((row) => row.knowledge_object_id === knowledgeId && row.claim_id === claimId);
    setBusyKey(`knowledge-claim:${knowledgeId}:${claimId}`);
    setError(null);

    if (role === "none") {
      if (existing) {
        const { error: deleteError } = await supabase.from("library_knowledge_claims").delete().eq("knowledge_object_id", knowledgeId).eq("claim_id", claimId);
        if (deleteError) setError("Unable to remove this claim from the knowledge object.");
        else setKnowledgeClaims((rows) => rows.filter((row) => !(row.knowledge_object_id === knowledgeId && row.claim_id === claimId)));
      }
      setBusyKey(null);
      return;
    }

    if (existing) {
      const result = await supabase.from("library_knowledge_claims").update({ role }).eq("knowledge_object_id", knowledgeId).eq("claim_id", claimId).select("knowledge_object_id, claim_id, role, created_at").single();
      if (result.error) setError("Unable to update this claim role.");
      else if (result.data) setKnowledgeClaims((rows) => [result.data as KnowledgeClaim, ...rows.filter((row) => !(row.knowledge_object_id === knowledgeId && row.claim_id === claimId))]);
    } else {
      const result = await supabase.from("library_knowledge_claims").insert({ knowledge_object_id: knowledgeId, claim_id: claimId, role }).select("knowledge_object_id, claim_id, role, created_at").single();
      if (result.error) setError("Unable to add this claim to the knowledge object.");
      else if (result.data) setKnowledgeClaims((rows) => [result.data as KnowledgeClaim, ...rows]);
    }
    setBusyKey(null);
  }

  async function openChapter(item: ResearchItem) {
    if (!userId) return;
    const publicationSections = sections.filter((section) => section.publication_id === item.publication_id);
    const index = publicationSections.findIndex((section) => section.section_key === item.locator);
    if (index < 0) return;
    setBusyKey(`open:${item.id}`);
    const now = new Date().toISOString();
    const { error: progressError } = await supabase.from("library_reading_progress").upsert({
      user_id: userId,
      publication_id: item.publication_id,
      locator: item.locator,
      progress_percent: Math.min(100, Math.max(1, Math.round(((index + 1) / publicationSections.length) * 100))),
      last_read_at: now,
      updated_at: now,
    }, { onConflict: "user_id,publication_id" });
    if (progressError) setError("Unable to open this evidence chapter.");
    else window.location.href = `/library/read/${item.publication_id}`;
    setBusyKey(null);
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[var(--loombus-text)] sm:px-6 md:pt-20">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[var(--loombus-border)] pb-6">
          <Link href="/library/research" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"><ArrowLeft className="size-4" /> Research</Link>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><Brain className="size-5" /></div>
            <div>
              <h1 className="text-3xl font-black tracking-tight">Evidence & Knowledge</h1>
              <p className="mt-1 max-w-2xl text-sm text-[var(--loombus-text-muted)]">Turn saved passages into structured claims, evidence relations, and private working knowledge.</p>
            </div>
          </div>
        </header>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm">{error}</div> : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <button onClick={() => setActiveTab("claims")} className={`rounded-full border px-4 py-2 text-sm font-black ${activeTab === "claims" ? "border-[var(--loombus-gold)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>Claims & Evidence</button>
          <button onClick={() => setActiveTab("knowledge")} className={`rounded-full border px-4 py-2 text-sm font-black ${activeTab === "knowledge" ? "border-[var(--loombus-gold)] text-[var(--loombus-gold)]" : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"}`}>Knowledge Objects</button>
        </div>

        <div className="mt-5 flex items-center rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4"><Search className="size-4 shrink-0 text-[var(--loombus-text-subtle)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={activeTab === "claims" ? "Search claims, rationale, passages, books…" : "Search knowledge and linked claims…"} className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm outline-none" /></div>

        {activeTab === "claims" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="h-fit rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 lg:sticky lg:top-20">
              <div className="flex items-center gap-2 text-sm font-black"><Plus className="size-4 text-[var(--loombus-gold)]" /> {editingClaimId ? "Edit claim" : "New claim"}</div>
              <textarea value={claimStatement} onChange={(event) => setClaimStatement(event.target.value)} maxLength={2000} placeholder="State the claim, question, or conclusion…" className="mt-4 min-h-28 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm outline-none" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select value={claimType} onChange={(event) => setClaimType(event.target.value as Claim["claim_type"])} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-sm">{CLAIM_TYPES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
                <select value={claimStatus} onChange={(event) => setClaimStatus(event.target.value as Claim["status"])} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-sm">{CLAIM_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
              </div>
              <textarea value={claimRationale} onChange={(event) => setClaimRationale(event.target.value)} maxLength={5000} placeholder="Private rationale or reasoning…" className="mt-3 min-h-24 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm outline-none" />
              <div className="mt-4 flex gap-2">
                <button disabled={!claimStatement.trim() || busyKey === "claim-form"} onClick={() => void saveClaim()} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black disabled:opacity-40"><Save className="size-4" /> Save</button>
                {editingClaimId ? <button onClick={resetClaimForm} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-bold"><X className="size-4" /> Cancel</button> : null}
              </div>
            </section>

            <div className="space-y-4">
              {filteredClaims.length ? filteredClaims.map((claim) => {
                const linkedEvidence = evidence.filter((row) => row.claim_id === claim.id);
                return (
                  <article key={claim.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em]"><span className="text-[var(--loombus-gold)]">{pretty(claim.claim_type)}</span><span className="text-[var(--loombus-text-subtle)]">{pretty(claim.status)}</span></div>
                        <h2 className="mt-2 text-lg font-black leading-7">{claim.statement}</h2>
                        {claim.rationale ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{claim.rationale}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => beginEditClaim(claim)} className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-bold">Edit</button>
                        <button aria-label="Delete claim" disabled={busyKey === `claim:${claim.id}`} onClick={() => void deleteClaim(claim)} className="grid size-8 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"><Trash2 className="size-4" /></button>
                      </div>
                    </div>

                    <details className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]/30 p-4">
                      <summary className="cursor-pointer list-none font-black"><span className="inline-flex items-center gap-2"><Link2 className="size-4 text-[var(--loombus-gold)]" /> Evidence ({linkedEvidence.length}) <ChevronDown className="size-4" /></span></summary>
                      <div className="mt-4 space-y-3">
                        {items.length ? items.map((item) => {
                          const row = linkedEvidence.find((entry) => entry.research_item_id === item.id);
                          const publication = publicationById.get(item.publication_id);
                          const section = sectionByKey.get(`${item.publication_id}:${item.locator}`);
                          return <EvidenceRow key={item.id} item={item} publication={publication} section={section} relation={row?.relation ?? "none"} note={row?.note ?? ""} busy={busyKey === `evidence:${claim.id}:${item.id}` || busyKey === `evidence-note:${claim.id}:${item.id}`} onRelation={(relation) => void setEvidenceRelation(claim.id, item.id, relation)} onSaveNote={row ? (note) => void saveEvidenceNote(row, note) : undefined} onOpen={() => void openChapter(item)} />;
                        }) : <p className="text-sm text-[var(--loombus-text-muted)]">Save passages to Research before attaching evidence.</p>}
                      </div>
                    </details>
                  </article>
                );
              }) : <EmptyState icon={<FileText className="size-6" />} title={claims.length ? "No claims match your search." : "No claims yet."} body="Create a claim, question, or conclusion, then attach saved passages as supporting, challenging, or contextual evidence." />}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
            <section className="h-fit rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 lg:sticky lg:top-20">
              <div className="flex items-center gap-2 text-sm font-black"><Plus className="size-4 text-[var(--loombus-gold)]" /> {editingKnowledgeId ? "Edit knowledge" : "New knowledge object"}</div>
              <input value={knowledgeTitle} onChange={(event) => setKnowledgeTitle(event.target.value)} maxLength={160} placeholder="Title…" className="mt-4 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm outline-none" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <select value={knowledgeType} onChange={(event) => setKnowledgeType(event.target.value as KnowledgeObject["knowledge_type"])} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-sm">{KNOWLEDGE_TYPES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
                <select value={knowledgeStatus} onChange={(event) => setKnowledgeStatus(event.target.value as KnowledgeObject["status"])} className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-sm">{KNOWLEDGE_STATUSES.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
              </div>
              <textarea value={knowledgeSummary} onChange={(event) => setKnowledgeSummary(event.target.value)} maxLength={10000} placeholder="Working synthesis, finding, or unresolved question…" className="mt-3 min-h-32 w-full rounded-xl border border-[var(--loombus-border)] bg-transparent p-3 text-sm outline-none" />
              <div className="mt-4 flex gap-2">
                <button disabled={!knowledgeTitle.trim() || busyKey === "knowledge-form"} onClick={() => void saveKnowledge()} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black disabled:opacity-40"><Save className="size-4" /> Save</button>
                {editingKnowledgeId ? <button onClick={resetKnowledgeForm} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-bold"><X className="size-4" /> Cancel</button> : null}
              </div>
            </section>

            <div className="space-y-4">
              {filteredKnowledge.length ? filteredKnowledge.map((knowledge) => {
                const linkedClaims = knowledgeClaims.filter((row) => row.knowledge_object_id === knowledge.id);
                return (
                  <article key={knowledge.id} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.14em]"><span className="text-[var(--loombus-gold)]">{pretty(knowledge.knowledge_type)}</span><span className="text-[var(--loombus-text-subtle)]">{pretty(knowledge.status)}</span></div>
                        <h2 className="mt-2 text-xl font-black">{knowledge.title}</h2>
                        {knowledge.summary ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">{knowledge.summary}</p> : null}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => beginEditKnowledge(knowledge)} className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-bold">Edit</button>
                        <button aria-label="Delete knowledge object" disabled={busyKey === `knowledge:${knowledge.id}`} onClick={() => void deleteKnowledge(knowledge)} className="grid size-8 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)]"><Trash2 className="size-4" /></button>
                      </div>
                    </div>

                    <details className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]/30 p-4">
                      <summary className="cursor-pointer list-none font-black"><span className="inline-flex items-center gap-2"><Brain className="size-4 text-[var(--loombus-gold)]" /> Claims ({linkedClaims.length}) <ChevronDown className="size-4" /></span></summary>
                      <div className="mt-4 space-y-3">
                        {claims.length ? claims.map((claim) => {
                          const link = linkedClaims.find((row) => row.claim_id === claim.id);
                          return (
                            <div key={claim.id} className="rounded-xl border border-[var(--loombus-border)] p-3">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 flex-1"><p className="text-sm font-bold">{claim.statement}</p><p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">{pretty(claim.claim_type)} · {pretty(claim.status)}</p></div>
                                <select disabled={busyKey === `knowledge-claim:${knowledge.id}:${claim.id}`} value={link?.role ?? "none"} onChange={(event) => void setKnowledgeClaimRole(knowledge.id, claim.id, event.target.value as KnowledgeClaim["role"] | "none")} className="rounded-lg border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-xs"><option value="none">Not linked</option>{KNOWLEDGE_ROLES.map((role) => <option key={role} value={role}>{pretty(role)}</option>)}</select>
                              </div>
                            </div>
                          );
                        }) : <p className="text-sm text-[var(--loombus-text-muted)]">Create claims before assembling knowledge.</p>}
                      </div>
                    </details>
                  </article>
                );
              }) : <EmptyState icon={<Brain className="size-6" />} title={knowledgeObjects.length ? "No knowledge objects match your search." : "No knowledge objects yet."} body="Create a private synthesis, finding, or open question, then connect claims as core, supporting, or counterpoint reasoning." />}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function EvidenceRow({ item, publication, section, relation, note, busy, onRelation, onSaveNote, onOpen }: {
  item: ResearchItem;
  publication: Publication | undefined;
  section: Section | undefined;
  relation: ClaimEvidence["relation"] | "none";
  note: string;
  busy: boolean;
  onRelation: (relation: ClaimEvidence["relation"] | "none") => void;
  onSaveNote?: (note: string) => void;
  onOpen: () => void;
}) {
  const [noteDraft, setNoteDraft] = useState(note);
  useEffect(() => setNoteDraft(note), [note]);
  return (
    <div className="rounded-xl border border-[var(--loombus-border)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--loombus-gold)]">{publication?.title ?? "Library publication"}</p>
          <p className="mt-1 text-[11px] text-[var(--loombus-text-subtle)]">{sectionLabel(section)}{publication?.author_name ? ` · ${publication.author_name}` : ""}</p>
          <blockquote className="mt-3 text-sm leading-6">“{item.selected_text}”</blockquote>
        </div>
        <select disabled={busy} value={relation} onChange={(event) => onRelation(event.target.value as ClaimEvidence["relation"] | "none")} className="rounded-lg border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-xs"><option value="none">Not evidence</option>{EVIDENCE_RELATIONS.map((value) => <option key={value} value={value}>{pretty(value)}</option>)}</select>
      </div>
      {relation !== "none" ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={2000} placeholder="Why does this passage matter?" className="min-w-0 flex-1 rounded-lg border border-[var(--loombus-border)] bg-transparent px-3 py-2 text-xs outline-none" />
          <button disabled={busy || !onSaveNote} onClick={() => onSaveNote?.(noteDraft)} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--loombus-border)] px-3 py-2 text-xs font-bold"><Check className="size-3.5" /> Save note</button>
          <button onClick={onOpen} className="inline-flex items-center justify-center gap-1 rounded-lg border border-[var(--loombus-border)] px-3 py-2 text-xs font-bold text-[var(--loombus-gold)]"><BookOpen className="size-3.5" /> Open</button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center"><div className="mx-auto grid size-10 place-items-center text-[var(--loombus-gold)]">{icon}</div><p className="mt-3 text-sm font-black">{title}</p><p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-[var(--loombus-text-muted)]">{body}</p></div>;
}
