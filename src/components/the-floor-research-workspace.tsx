"use client";

import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
import { companyPath } from "@/lib/floor-companies";
import {
  FLOOR_WORKSPACE_DRAFTS_KEY,
  FLOOR_WORKSPACE_REVISIONS_KEY,
  WorkspaceDraft,
  WorkspaceEvidenceType,
  WorkspaceRevision,
  calculateWorkspaceQuality,
  createWorkspaceDraft,
  createWorkspaceRevision,
  normalizeWorkspaceTicker,
} from "@/lib/floor-workspace";
import { supabase } from "@/lib/supabase/client";
import { ArrowLeft, BookOpen, CheckCircle2, Clock3, FilePlus2, Link2, Plus, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TEXT_FIELDS: Array<{ key: keyof WorkspaceDraft; label: string; placeholder: string; rows: number }> = [
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
  const [drafts, setDrafts] = useState<WorkspaceDraft[]>([]);
  const [revisions, setRevisions] = useState<WorkspaceRevision[]>([]);
  const [activeId, setActiveId] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [evidenceType, setEvidenceType] = useState<WorkspaceEvidenceType>("sec_filing");
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [evidenceNote, setEvidenceNote] = useState("");

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) { window.location.replace("/login?next=%2Fthe-floor%2Fworkspace"); return; }
      const storedDrafts = readLocal<WorkspaceDraft[]>(FLOOR_WORKSPACE_DRAFTS_KEY, []);
      const initial = storedDrafts.length ? storedDrafts : [createWorkspaceDraft()];
      setDrafts(initial);
      setRevisions(readLocal<WorkspaceRevision[]>(FLOOR_WORKSPACE_REVISIONS_KEY, []));
      setActiveId(initial[0].id);
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
    setSavedMessage("Draft and revision saved privately in this browser.");
    window.setTimeout(() => setSavedMessage(""), 2500);
  }

  function newDraft() {
    const next = createWorkspaceDraft();
    setDrafts((current) => [next, ...current]);
    setActiveId(next.id);
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
          <div className="mt-4 flex items-center justify-between"><h2 className="font-black">Private drafts</h2><button onClick={newDraft} className="rounded-full p-2 hover:bg-[var(--loombus-surface-muted)]" aria-label="New draft"><Plus className="size-4" /></button></div>
          <div className="mt-3 space-y-2">{drafts.map((draft) => <button key={draft.id} onClick={() => setActiveId(draft.id)} className={`w-full rounded-2xl border p-3 text-left ${draft.id === active.id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)]"}`}><p className="truncate text-sm font-black">{draft.title}</p><p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{draft.ticker || "No ticker"}</p></button>)}</div>
          <button onClick={() => deleteDraft(active.id)} className="mt-4 inline-flex items-center gap-1.5 text-xs font-black text-rose-400"><Trash2 className="size-3.5" /> Delete draft</button>
        </aside>

        <section className="space-y-5">
          <header className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><BookOpen className="size-6 text-[var(--loombus-gold)]" /><h1 className="text-2xl font-black">Research Workspace</h1></div><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Structured, private research with evidence and permanent local revisions.</p></div><button onClick={persist} className="inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-black text-black"><Save className="size-4" /> Save revision</button></div>
            {savedMessage ? <p className="mt-3 text-xs font-bold text-emerald-400">{savedMessage}</p> : null}
            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_150px]"><input value={active.title} onChange={(event) => update("title", event.target.value)} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-4 py-3 font-black" placeholder="Research title" /><input value={active.ticker} onChange={(event) => update("ticker", normalizeWorkspaceTicker(event.target.value))} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-4 py-3 font-black uppercase" placeholder="Ticker" /></div>
          </header>

          {TEXT_FIELDS.map((field) => <div key={String(field.key)} className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><label className="text-sm font-black">{field.label}</label><textarea rows={field.rows} value={String(active[field.key] ?? "")} onChange={(event) => update(field.key, event.target.value as never)} placeholder={field.placeholder} className="mt-3 w-full resize-y rounded-2xl border border-[var(--loombus-border)] bg-transparent p-4 text-sm leading-6" /></div>)}

          <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><label className="text-sm font-black">Confidence</label><span className="font-black text-[var(--loombus-gold)]">{active.confidence}%</span></div><input type="range" min="0" max="100" value={active.confidence} onChange={(event) => update("confidence", Number(event.target.value))} className="mt-4 w-full" /></div>

          <div className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Link2 className="size-4" /> Evidence Library</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value as WorkspaceEvidenceType)} className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2">{EVIDENCE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><input value={evidenceTitle} onChange={(event) => setEvidenceTitle(event.target.value)} placeholder="Evidence title" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2" /><input value={evidenceUrl} onChange={(event) => setEvidenceUrl(event.target.value)} placeholder="Source URL, optional" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent px-3 py-2 sm:col-span-2" /><textarea value={evidenceNote} onChange={(event) => setEvidenceNote(event.target.value)} placeholder="Why this evidence matters" className="rounded-2xl border border-[var(--loombus-border)] bg-transparent p-3 sm:col-span-2" /></div><button onClick={addEvidence} className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black"><FilePlus2 className="size-4" /> Add evidence</button><div className="mt-4 space-y-2">{active.evidence.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--loombus-border)] p-3"><div className="flex justify-between gap-3"><div><p className="text-sm font-black">{item.title}</p><p className="text-xs text-[var(--loombus-text-muted)]">{item.type.replaceAll("_", " ")}</p></div><button onClick={() => update("evidence", active.evidence.filter((entry) => entry.id !== item.id))} aria-label="Remove evidence"><Trash2 className="size-4 text-rose-400" /></button></div>{item.note ? <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{item.note}</p> : null}</div>)}</div></div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-black"><ShieldCheck className="size-4 text-[var(--loombus-gold)]" /> Research Quality</h2><span className="text-2xl font-black text-[var(--loombus-gold)]">{quality.score}</span></div><p className="mt-1 text-xs font-bold text-[var(--loombus-text-muted)]">{quality.label}</p><div className="mt-4 space-y-3">{quality.dimensions.map((dimension) => <div key={dimension.label}><div className="flex justify-between text-xs font-bold"><span>{dimension.label}</span><span>{dimension.score}%</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--loombus-surface-muted)]"><div className="h-full bg-[var(--loombus-gold)]" style={{ width: `${dimension.score}%` }} /></div></div>)}</div></div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><CheckCircle2 className="size-4" /> Publish readiness</h2><p className={`mt-2 text-sm font-black ${quality.ready ? "text-emerald-400" : "text-amber-400"}`}>{quality.ready ? "Ready for publication review" : "More work recommended"}</p><ul className="mt-3 space-y-2 text-xs text-[var(--loombus-text-muted)]">{quality.missing.map((item) => <li key={item}>• {item}</li>)}</ul><p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">This workspace does not publish automatically. Publication must remain a separate, explicit action.</p>{active.ticker ? <Link href={companyPath(active.ticker)} className="mt-4 inline-flex text-xs font-black text-[var(--loombus-gold)]">Open Company Intelligence</Link> : null}</div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Sparkles className="size-4" /> Copilot prompts</h2><div className="mt-3 space-y-2 text-xs text-[var(--loombus-text-muted)]"><p>• Which claims lack evidence?</p><p>• What is the strongest counterargument?</p><p>• Which assumption would invalidate the thesis?</p><p>• Are risks and exit conditions specific enough?</p></div><p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">These prompts guide analysis without replacing the author.</p></div>

          <div className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"><h2 className="flex items-center gap-2 font-black"><Clock3 className="size-4" /> Revision history</h2><div className="mt-3 space-y-3">{activeRevisions.length ? activeRevisions.slice(0, 10).map((revision) => <div key={revision.id} className="border-l-2 border-[var(--loombus-border)] pl-3"><p className="text-xs font-black">{revision.summary}</p><p className="mt-1 text-[11px] text-[var(--loombus-text-subtle)]">{new Date(revision.savedAt).toLocaleString()}</p><button onClick={() => restoreRevision(revision)} className="mt-1 text-[11px] font-black text-[var(--loombus-gold)]">Restore this version</button></div>) : <p className="text-xs text-[var(--loombus-text-muted)]">Save a revision to begin the permanent local timeline.</p>}</div></div>
        </aside>
      </div>
    </main>
  );
}
