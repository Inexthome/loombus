"use client";

import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Send, ShieldAlert, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryVersionNormalizedPreview } from "@/components/library/library-version-normalized-preview";
import { supabase } from "@/lib/supabase/client";

type Review = { version_id: string; publication_id: string; user_id: string; submission_status: "draft" | "submitted" | "changes_requested" | "approved" | "rejected"; submitted_at: string | null; reviewed_at: string | null; review_note: string | null; published_at: string | null };
type Version = { id: string; publication_id: string; version_number: number; title: string; subtitle: string | null; description: string | null; publication_type: string; author_name: string | null; publisher_name: string | null; language_code: string; isbn: string | null; version_status: string };
type Row = Review & { version: Version };
type Access = "checking" | "allowed" | "denied" | "error";

export default function AdminLibraryRevisionReviewPage() {
  const [access, setAccess] = useState<Access>("checking");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string,string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true); setMessage(null); setIsError(false);
    const auth = await supabase.auth.getUser();
    if (!auth.data.user) { window.location.replace("/login?next=/admin/library-review/revisions"); return; }
    const profile = await supabase.from("profiles").select("is_admin").eq("id", auth.data.user.id).maybeSingle();
    if (profile.error) { setAccess("error"); setMessage("Admin access could not be verified."); setIsError(true); setLoading(false); return; }
    if (!profile.data?.is_admin) { setAccess("denied"); setLoading(false); return; }
    setAccess("allowed");

    const reviewResult = await supabase.from("library_publication_revision_reviews").select("version_id,publication_id,user_id,submission_status,submitted_at,reviewed_at,review_note,published_at").in("submission_status", ["submitted","changes_requested","approved","rejected"]).order("submitted_at", { ascending: true, nullsFirst: false });
    if (reviewResult.error) { setRows([]); setMessage("Unable to load the revision review queue."); setIsError(true); setLoading(false); return; }
    const reviews = (reviewResult.data ?? []) as Review[];
    const versionIds = reviews.map((row) => row.version_id);
    if (!versionIds.length) { setRows([]); setLoading(false); return; }
    const versionResult = await supabase.from("library_publication_versions").select("id,publication_id,version_number,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,version_status").in("id", versionIds);
    if (versionResult.error) { setRows([]); setMessage("Unable to load staged revision metadata."); setIsError(true); setLoading(false); return; }
    const map = new Map(((versionResult.data ?? []) as Version[]).map((version) => [version.id, version]));
    setRows(reviews.map((review) => ({ ...review, version: map.get(review.version_id)! })).filter((row) => Boolean(row.version)));
    setNotes((current) => { const next = { ...current }; for (const row of reviews) if (!(row.version_id in next)) next[row.version_id] = row.review_note ?? ""; return next; });
    setLoading(false);
  }, []);

  useEffect(() => { void loadRows(); }, [loadRows]);

  async function review(versionId: string, action: "request_changes" | "approve" | "reject") {
    if (workingId) return;
    const note = notes[versionId]?.trim() ?? "";
    if ((action === "request_changes" || action === "reject") && !note) { setMessage("A review note is required when requesting changes or rejecting a revision."); setIsError(true); return; }
    setWorkingId(versionId); setMessage(null); setIsError(false);
    const result = await supabase.rpc("review_library_author_revision", { p_version_id: versionId, p_action: action, p_review_note: note || null });
    if (result.error) { setMessage("Unable to record the revision review decision."); setIsError(true); }
    else { setMessage(action === "approve" ? "Revision approved. The current live version remains active until you publish this revision." : action === "request_changes" ? "Changes requested. The author can edit and resubmit this staged version." : "Revision rejected. The live publication is unchanged."); await loadRows(); }
    setWorkingId(null);
  }

  async function publish(versionId: string) {
    if (workingId) return;
    const confirmed = window.confirm("Publish this approved revision? The current live version will become historical and this staged version will become the active Library version.");
    if (!confirmed) return;
    setWorkingId(versionId); setMessage(null); setIsError(false);
    const result = await supabase.rpc("publish_library_author_revision", { p_version_id: versionId });
    if (result.error) { setMessage("Unable to publish this revision. The active Library version was not intentionally changed."); setIsError(true); }
    else { setMessage("Revision published. The previous version is preserved as superseded history and the new version is now active."); await loadRows(); }
    setWorkingId(null);
  }

  const pendingCount = useMemo(() => rows.filter((row) => row.submission_status === "submitted").length, [rows]);

  if (access === "checking" || (loading && access !== "denied")) return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" /></main>;
  if (access === "denied") return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] px-6 text-center text-[var(--loombus-text)]"><div><ShieldAlert className="mx-auto h-8 w-8 text-[var(--loombus-text-subtle)]" /><p className="mt-3 text-sm font-semibold">Admin access is required to review Library revisions.</p></div></main>;

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-16 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link href="/admin/library-review" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold"><ArrowLeft className="h-4 w-4" />First-publication review</Link>
        <header className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Library editorial operations</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-semibold">Published revision review</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Review the staged version—not the currently live version. Approval remains separate from the explicit atomic publish action.</p></div><span className="rounded-full bg-[var(--loombus-gold-surface)] px-4 py-2 text-sm font-semibold text-[var(--loombus-gold)]">{pendingCount} pending</span></div></header>
        {message ? <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm ${isError ? "border-rose-500/30 bg-rose-500/10 text-rose-500" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)]"}`}>{message}</div> : null}
        {!rows.length ? <section className="mt-5 rounded-[2rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-sm text-[var(--loombus-text-muted)]">No published revisions are currently in the editorial workflow.</section> : <div className="mt-5 space-y-4">{rows.map((row) => { const busy = workingId===row.version_id; const submitted=row.submission_status==="submitted"; const approved=row.submission_status==="approved" && row.version.version_status==="draft"; return <article key={row.version_id} className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-bold capitalize text-[var(--loombus-gold)]">Version {row.version.version_number} · {row.submission_status.replace("_"," ")}</span><h2 className="mt-3 text-xl font-semibold">{row.version.title}</h2>{row.version.subtitle ? <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{row.version.subtitle}</p> : null}</div><div className="text-right text-xs leading-5 text-[var(--loombus-text-subtle)]"><p>{row.version.author_name ?? "Unnamed author"}</p><p>{row.version.publisher_name ?? "No publisher"}</p></div></div>{row.version.description ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text-muted)]">{row.version.description}</p> : null}<dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3"><div><dt className="font-bold text-[var(--loombus-text-subtle)]">Type</dt><dd className="mt-1 capitalize">{row.version.publication_type}</dd></div><div><dt className="font-bold text-[var(--loombus-text-subtle)]">Language</dt><dd className="mt-1">{row.version.language_code}</dd></div><div><dt className="font-bold text-[var(--loombus-text-subtle)]">ISBN</dt><dd className="mt-1">{row.version.isbn ?? "—"}</dd></div></dl><div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Staged normalized content</p><p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">This preview is scoped to revision version {row.version.version_number}.</p></div><LibraryVersionNormalizedPreview versionId={row.version_id} disabled={busy} /></div></div><label className="mt-5 block"><span className="mb-2 block text-xs font-bold text-[var(--loombus-text-muted)]">Review note</span><textarea value={notes[row.version_id] ?? ""} onChange={(e)=>setNotes((current)=>({...current,[row.version_id]:e.target.value}))} disabled={!submitted || busy} maxLength={2000} rows={3} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm disabled:opacity-70" /></label><div className="mt-4 flex flex-wrap justify-end gap-2">{submitted ? <><button type="button" disabled={busy} onClick={()=>void review(row.version_id,"request_changes")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold"><Send className="h-4 w-4" />Request changes</button><button type="button" disabled={busy} onClick={()=>void review(row.version_id,"reject")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-500/40 px-4 text-xs font-semibold text-rose-500"><XCircle className="h-4 w-4" />Reject</button><button type="button" disabled={busy} onClick={()=>void review(row.version_id,"approve")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-semibold text-black"><CheckCircle2 className="h-4 w-4" />Approve revision</button></> : null}{approved ? <button type="button" disabled={busy} onClick={()=>void publish(row.version_id)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-sm font-semibold text-black"><CheckCircle2 className="h-4 w-4" />Publish revision</button> : null}</div></article>; })}</div>}
      </div>
    </main>
  );
}
