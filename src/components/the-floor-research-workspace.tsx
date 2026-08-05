"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { mergeFloorLocalWithCloud, replaceFloorCloudItems } from "@/lib/floor-cloud-data";
import { companyPath } from "@/lib/floor-companies";
import {
  FLOOR_WORKSPACE_DRAFTS_KEY,
  FLOOR_WORKSPACE_REVISIONS_KEY,
  FLOOR_WORKSPACE_THESIS_HANDOFF_KEY,
  WorkspaceDraft,
  WorkspaceEvidenceType,
  WorkspaceRevision,
  calculateWorkspaceQuality,
  createWorkspaceDraft,
  createWorkspaceRevision,
  createWorkspaceThesisHandoff,
  normalizeWorkspaceTicker,
} from "@/lib/floor-workspace";
import { FLOOR_STANCE_OPTIONS, type FloorStance } from "@/lib/floor-shared";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, FilePlus2, Link2, Plus, Save, Send, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TEXT_FIELDS: Array<{ key: keyof WorkspaceDraft; label: string; placeholder: string; rows: number }> = [
  { key: "researchGoal", label: "Research goal", placeholder: "What decision or understanding should this research support?", rows: 2 },
  { key: "researchQuestion", label: "Research question", placeholder: "State the specific question this workspace should answer.", rows: 2 },
  { key: "thesis", label: "Investment thesis", placeholder: "State the central claim and what must become true.", rows: 5 },
  { key: "businessOverview", label: "Business overview", placeholder: "Explain how the company makes money and what drives the economics.", rows: 4 },
  { key: "valuation", label: "Valuation", placeholder: "Document the valuation framework, assumptions, and limitations.", rows: 4 },
  { key: "catalysts", label: "Catalysts", placeholder: "List observable developments that could advance the thesis.", rows: 4 },
  { key: "risks", label: "Risks", placeholder: "Describe the strongest risks, including what you may be underestimating.", rows: 4 },
  { key: "counterarguments", label: "Counterarguments", placeholder: "Steelman the strongest opposing case.", rows: 4 },
  { key: "entryConditions", label: "Entry conditions", placeholder: "Record the conditions required before acting.", rows: 3 },
  { key: "exitConditions", label: "Exit and invalidation conditions", placeholder: "Define what would invalidate the thesis or justify closing it.", rows: 3 },
  { key: "timeHorizon", label: "Time horizon", placeholder: "Example: 18 to 36 months", rows: 2 },
];

const EVIDENCE_TYPES: Array<{ value: WorkspaceEvidenceType; label: string }> = [
  ["sec_filing", "SEC filing"], ["earnings_report", "Earnings report"], ["investor_presentation", "Investor presentation"],
  ["conference_call", "Conference call"], ["external_article", "External article"], ["financial_model", "Financial model"],
  ["chart", "Chart"], ["personal_observation", "Personal observation"],
].map(([value, label]) => ({ value: value as WorkspaceEvidenceType, label }));

function readLocal<T>(key: string, fallback: T): T {
  try { const raw = window.localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}

export default function TheFloorResearchWorkspace() {
  const [loading, setLoading] = useState(true);
  const [ownerId, setOwnerId] = useState("");
  const [cloudSynced, setCloudSynced] = useState(false);
  const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
  const [revisions, setRevisions] = useState<WorkspaceRevision[]>([]);
  const [activeId, setActiveId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [evidenceType, setEvidenceType] = useState<WorkspaceEvidenceType>("sec_filing");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideTicker, setGuideTicker] = useState("");
  const [guideCompany, setGuideCompany] = useState("");
  const [guideGoal, setGuideGoal] = useState("Understand the business and test an investment thesis");
  const [guideQuestion, setGuideQuestion] = useState("");
  const [guideHorizon, setGuideHorizon] = useState("12 to 24 months");
  const [guideStance, setGuideStance] = useState<FloorStance>("neutral");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.replace("/login?next=%2Fthe-floor%2Fworkspace"); return; }
      setOwnerId(data.user.id);
      const storedDrafts = readLocal<WorkspaceDraft[]>(FLOOR_WORKSPACE_DRAFTS_KEY, []);
      const storedRevisions = readLocal<WorkspaceRevision[]>(FLOOR_WORKSPACE_REVISIONS_KEY, []);
      const localDrafts = storedDrafts.length ? storedDrafts : [createWorkspaceDraft()];
      try {
        const [cloudDrafts, cloudRevisions] = await Promise.all([
          mergeFloorLocalWithCloud(data.user.id, "workspace_draft", localDrafts),
          mergeFloorLocalWithCloud(data.user.id, "workspace_revision", storedRevisions),
        ]);
        setDrafts(cloudDrafts);
        setRevisions(cloudRevisions);
        setActiveId(cloudDrafts[0].id);
        window.localStorage.setItem(FLOOR_WORKSPACE_DRAFTS_KEY, JSON.stringify(cloudDrafts));
        window.localStorage.setItem(FLOOR_WORKSPACE_REVISIONS_KEY, JSON.stringify(cloudRevisions));
        setCloudSynced(true);
      } catch {
        setDrafts(localDrafts);
        setRevisions(storedRevisions);
        setActiveId(localDrafts[0].id);
      }
      setLoading(false);
    })();
  }, []);

  const active = drafts.find((draft) => draft.id === activeId) ?? drafts[0];
  const quality = useMemo(() => active ? calculateWorkspaceQuality(active) : null, [active]);
  const activeRevisions = revisions.filter((revision) => revision.draftId === active?.id).sort((a, b) => b.savedAt.localeCompare(a.savedAt));

  function update<K extends keyof WorkspaceDraft>(key: K, value: WorkspaceDraft[K]) {
    setDrafts((current) => current.map((draft) => draft.id === active.id ? { ...draft, [key]: value, updatedAt: new Date().toISOString() } : draft));
  }

  function persist() {
    const previous = activeRevisions[0]?.snapshot;
    const nextRevision = createWorkspaceRevision(active, previous);
    const nextRevisions = [nextRevision, ...revisions].slice(0, 200);
    window.localStorage.setItem(FLOOR_WORKSPACE_DRAFTS_KEY, JSON.stringify(drafts));
    window.localStorage.setItem(FLOOR_WORKSPACE_REVISIONS_KEY, JSON.stringify(nextRevisions));
    setRevisions(nextRevisions);
    if (ownerId) {
      void Promise.all([
        replaceFloorCloudItems(ownerId, "workspace_draft", drafts),
        replaceFloorCloudItems(ownerId, "workspace_revision", nextRevisions),
      ]).then(() => setCloudSynced(true)).catch(() => setCloudSynced(false));
    }
    setSavedMessage("Draft and revision saved privately.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  }

  function newDraft() {
    const next = createWorkspaceDraft();
    setDrafts((current) => [next, ...current]);
    setActiveId(next.id);
  }

  function createGuidedWorkspace() {
    const ticker = normalizeWorkspaceTicker(guideTicker);
    if (!ticker) return;
    const next = {
      ...createWorkspaceDraft(),
      title: guideCompany.trim() ? `${guideCompany.trim()} research` : `${ticker} research`,
      ticker,
      stance: guideStance,
      researchGoal: guideGoal.trim(),
      researchQuestion: guideQuestion.trim(),
      timeHorizon: guideHorizon.trim(),
    };
    const nextDrafts = [next, ...drafts];
    setDrafts(nextDrafts);
    setActiveId(next.id);
    setGuideOpen(false);
    window.localStorage.setItem(FLOOR_WORKSPACE_DRAFTS_KEY, JSON.stringify(nextDrafts));
    if (ownerId) {
      void replaceFloorCloudItems(ownerId, "workspace_draft", nextDrafts)
        .then(() => setCloudSynced(true))
        .catch(() => setCloudSynced(false));
    }
    setSavedMessage("Guided workspace created and saved. Begin with the business overview and evidence library.");
  }

  function prepareThesis() {
    const handoff = createWorkspaceThesisHandoff(active);
    window.localStorage.setItem(FLOOR_WORKSPACE_THESIS_HANDOFF_KEY, JSON.stringify(handoff));
    persist();
    window.location.assign(`/the-floor/overview?compose=1&fromWorkspace=${encodeURIComponent(active.id)}`);
  }

  function deleteDraft(id: string) {
    if (!window.confirm("Delete this private draft and its local revision history?")) return;
    const next = drafts.filter((draft) => draft.id !== id);
    const replacement = next.length ? next : [createWorkspaceDraft()];
    const nextRevisions = revisions.filter((revision) => revision.draftId !== id);
    setDrafts(replacement); setActiveId(replacement[0].id); setRevisions(nextRevisions);
    window.localStorage.setItem(FLOOR_WORKSPACE_DRAFTS_KEY, JSON.stringify(replacement));
    window.localStorage.setItem(FLOOR_WORKSPACE_REVISIONS_KEY, JSON.stringify(nextRevisions));
  }

  function addEvidence() {
    if (!evidenceTitle.trim()) return;
    update("evidence", [...active.evidence, { id: crypto.randomUUID(), type: evidenceType, title: evidenceTitle.trim(), url: evidenceUrl.trim(), note: evidenceNote.trim(), createdAt: new Date().toISOString() }]);
    setEvidenceTitle(""); setEvidenceUrl(""); setEvidenceNote("");
  }

  function restoreRevision(revision: WorkspaceRevision) {
    const restored = { ...revision.snapshot, updatedAt: new Date().toISOString() };
    setDrafts((current) => current.map((draft) => draft.id === restored.id ? restored : draft));
  }

  if (loading || !active || !quality) return <LoombusLoadingScreen title="Opening Research Workspace..." message="Loading your private drafts." />;

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
        <aside className="h-fit rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
          <Link href="/the-floor" className="inline-flex items-center gap-1.5 text-xs font-black text-[var(--loombus-text-muted)]"><ArrowLeft className="size-3.5" /> Back to The Floor</Link>
          <div className="mt-4 flex items-center justify-between"><h2 className="font-black">Private drafts</h2><button onClick={newDraft} className="rounded-full p-2 hover:bg-[var(--loombus-surface-muted)]" aria-label="New blank draft"><Plus className="size-4" /></button></div>
          <button onClick={() => setGuideOpen(true)} className="mt-3 inline-flex w-full min-h-10 items-center justify-center gap-2 rounded-full bg-[var(--loombus-gold)] px-3 text-xs font-black text-black"><Sparkles className="size-3.5" /> Guided workspace</button>
          <div className="mt-3 space-y-2">{drafts.map((draft) => <button key={draft.id} onClick={() => setActiveId(draft.id)} className={`w-full rounded-2xl border p-3 text-left ${draft.id === active.id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><p className="truncate text-sm font-black">{draft.title}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{draft.ticker || "No ticker"}</p></button>)}</div>
          <button onClick={() => deleteDraft(active.id)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-rose-400"><Trash2 className="size-3.5" /> Delete draft</button>
        </aside>

        <section className="space-y-5">
          <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BookOpen className="size-6 text-[var(--loombus-gold)]" /><h1 className="text-2xl font-black">Research Workspace</h1></div><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Structured, private research with evidence and permanent revisions.</p><p className={`mt-2 text-[10px] font-black uppercase ${cloudSynced ? "text-emerald-400" : "text-[var(--loombus-text-subtle)]"}`}>{cloudSynced ? "Cloud synced" : "Local fallback"}</p></div><div className="flex flex-wrap gap-2"><button onClick={persist} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black"><Save className="size-4" /> Save revision</button><button onClick={prepareThesis} disabled={!active.ticker.trim() || !active.thesis.trim() || !active.exitConditions.trim()} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-40"><Send className="size-4" /> Prepare thesis</button></div></div>
            {savedMessage ? <p className="mt-3 text-xs font-bold text-emerald-400">{savedMessage}</p> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_150px_150px]"><input value={active.title} onChange={(event) => update("title", event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-4 py-3 font-black" placeholder="Research title" /><input value={active.ticker} onChange={(event) => update("ticker", normalizeWorkspaceTicker(event.target.value))} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-4 py-3 font-black uppercase" placeholder="Ticker" /><select value={active.stance ?? "neutral"} onChange={(event) => update("stance", event.target.value as FloorStance)} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-3 text-sm font-black">{FLOOR_STANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
          </header>

          {TEXT_FIELDS.map((field) => <div key={String(field.key)} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><label className="text-sm font-black">{field.label}</label><textarea rows={field.rows} value={String(active[field.key] ?? "")} onChange={(event) => update(field.key, event.target.value as never)} placeholder={field.placeholder} className="mt-3 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-transparent p-4 text-sm leading-6" /></div>)}

          <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><label className="text-sm font-black">Confidence</label><span className="font-black text-[var(--loombus-gold)]">{active.confidence}%</span></div><input type="range" min="0" max="100" value={active.confidence} onChange={(event) => update("confidence", Number(event.target.value))} className="mt-4 w-full" /></div>

          <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Link2 className="size-4" /> Evidence Library</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as WorkspaceEvidenceType)} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2">{EVIDENCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="Evidence title" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2" /><input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Source URL, optional" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 sm:col-span-2" /><textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Why this evidence matters" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 sm:col-span-2" /></div><button onClick={addEvidence} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black"><FilePlus2 className="size-4" /> Add evidence</button><div className="mt-4 space-y-2">{active.evidence.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--loombus-border)] p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{item.title}</p><p className="text-xs text-[var(--loombus-text-muted)]">{item.type.replaceAll("_", " ")}</p></div><button onClick={() => update("evidence", active.evidence.filter((entry) => entry.id !== item.id))} aria-label="Remove evidence"><Trash2 className="size-4 text-rose-400" /></button></div>{item.note ? <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{item.note}</p> : null}</div>)}</div></div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="size-4 text-[var(--loombus-gold)]" /> Research Quality</h2><span className="text-2xl font-black text-[var(--loombus-gold)]">{quality.score}</span></div><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{quality.label}</p><div className="mt-4 space-y-3">{quality.dimensions.map((dimension) => <div key={dimension.label}><div className="flex justify-between text-xs font-bold"><span>{dimension.label}</span><span>{dimension.score}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)]" style={{ width: `${dimension.score}%` }} /></div></div>)}</div></div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><CheckCircle2 className="size-4" /> Publish readiness</h2><p className={`mt-2 text-sm font-black ${quality.ready ? "text-emerald-400" : "text-amber-400"}`}>{quality.ready ? "Ready for publication review" : "More work recommended"}</p><ul className="mt-3 space-y-2 text-xs text-[var(--loombus-text-muted)]">{quality.missing.map((item) => <li key={item}>• {item}</li>)}</ul><p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">Prepare thesis transfers your draft into the thesis composer. It never publishes automatically, and you must review and submit it separately.</p>{active.ticker ? <Link href={companyPath(active.ticker)} className="mt-4 inline-flex text-xs font-black text-[var(--loombus-gold)]">Open Company Intelligence</Link> : null}</div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Sparkles className="size-4" /> Copilot prompts</h2><div className="mt-3 space-y-2 text-xs text-[var(--loombus-text-muted)]"><p>• Which claims lack evidence?</p><p>• What is the strongest counterargument?</p><p>• Which assumption would invalidate the thesis?</p><p>• Are risks and exit conditions specific enough?</p></div><p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">These prompts guide analysis without replacing the author.</p></div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Clock3 className="size-4" /> Revision history</h2><div className="mt-3 space-y-3">{activeRevisions.length ? activeRevisions.slice(0, 10).map((revision) => <div key={revision.id} className="border-l-2 border-[var(--loombus-border)] pl-3"><p className="text-xs font-black">{revision.summary}</p><p className="mt-1 text-[11px] text-[var(--loombus-text-subtle)]">{new Date(revision.savedAt).toLocaleString()}</p><button onClick={() => restoreRevision(revision)} className="mt-1 text-[11px] font-black text-[var(--loombus-gold)]">Restore this version</button></div>) : <p className="text-xs text-[var(--loombus-text-muted)]">Save a revision to begin the permanent local timeline.</p>}</div></div>
        </aside>
      </div>

      {guideOpen ? (
        <div className="fixed inset-0 z-[280] grid place-items-center overflow-y-auto bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="guided-workspace-title" onClick={() => setGuideOpen(false)}>
          <div className="w-full max-w-xl rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[.14em] text-[var(--loombus-gold)]">Guided setup</p><h2 id="guided-workspace-title" className="mt-1 text-2xl font-black">Create a research workspace</h2><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">Set the research direction now. The evidence and conclusions remain yours to develop.</p></div><button type="button" onClick={() => setGuideOpen(false)} aria-label="Close guided setup" className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)]"><X className="size-4" /></button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-black">Ticker<input required value={guideTicker} onChange={(event) => setGuideTicker(normalizeWorkspaceTicker(event.target.value))} placeholder="NVDA" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3 uppercase" /></label>
              <label className="text-xs font-black">Company name (optional)<input value={guideCompany} onChange={(event) => setGuideCompany(event.target.value)} placeholder="NVIDIA" className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label>
              <label className="text-xs font-black sm:col-span-2">Research goal<input value={guideGoal} onChange={(event) => setGuideGoal(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label>
              <label className="text-xs font-black sm:col-span-2">Question to answer<textarea value={guideQuestion} onChange={(event) => setGuideQuestion(event.target.value)} rows={3} placeholder="Can the company convert its current growth into durable free cash flow?" className="mt-2 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-3" /></label>
              <label className="text-xs font-black">Time horizon<input value={guideHorizon} onChange={(event) => setGuideHorizon(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3" /></label>
              <label className="text-xs font-black">Starting stance<select value={guideStance} onChange={(event) => setGuideStance(event.target.value as FloorStance)} className="mt-2 min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-3">{FLOOR_STANCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <div className="mt-5 flex justify-end"><button type="button" disabled={!guideTicker.trim()} onClick={createGuidedWorkspace} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-black text-black disabled:opacity-40"><Sparkles className="size-4" /> Create workspace</button></div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
