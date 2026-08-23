"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpen, Loader2, Send, Sparkles } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type SubmissionStatus = "draft" | "submitted" | "changes_requested" | "approved" | "rejected";

type AuthorPublicationRow = {
  publication_id: string;
  submission_status: SubmissionStatus;
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  updated_at: string;
};

type PublicationRow = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  status: string;
};

type AuthorPublication = AuthorPublicationRow & { publication: PublicationRow };

type DraftForm = {
  title: string;
  subtitle: string;
  description: string;
  publicationType: string;
  authorName: string;
  publisherName: string;
  languageCode: string;
  isbn: string;
};

const emptyForm: DraftForm = {
  title: "",
  subtitle: "",
  description: "",
  publicationType: "book",
  authorName: "",
  publisherName: "",
  languageCode: "en",
  isbn: "",
};

const publicationTypes = ["book", "essay", "research", "report", "guide", "article", "other"];

function formFromPublication(publication: PublicationRow): DraftForm {
  return {
    title: publication.title,
    subtitle: publication.subtitle ?? "",
    description: publication.description ?? "",
    publicationType: publication.publication_type,
    authorName: publication.author_name ?? "",
    publisherName: publication.publisher_name ?? "",
    languageCode: publication.language_code,
    isbn: publication.isbn ?? "",
  };
}

function rpcPayload(form: DraftForm) {
  return {
    p_title: form.title,
    p_author_name: form.authorName || null,
    p_publication_type: form.publicationType,
    p_subtitle: form.subtitle || null,
    p_description: form.description || null,
    p_publisher_name: form.publisherName || null,
    p_language_code: form.languageCode || "en",
    p_isbn: form.isbn || null,
  };
}

function statusLabel(status: SubmissionStatus) {
  return status.replace("_", " ");
}

function authorStatusLabel(row: AuthorPublication) {
  return row.publication.status === "published" ? "published" : statusLabel(row.submission_status);
}

export default function LibraryPublishPage() {
  const [rows, setRows] = useState<AuthorPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<DraftForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => rows.find((row) => row.publication_id === selectedId) ?? null,
    [rows, selectedId]
  );

  const editable = !selected || selected.submission_status === "draft" || selected.submission_status === "changes_requested";

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);

    const { data: userResult, error: userError } = await supabase.auth.getUser();
    if (userError || !userResult.user) {
      setRows([]);
      setLoading(false);
      setError("Sign in to manage Library publications.");
      return;
    }

    const ownershipResult = await supabase
      .from("library_author_publications")
      .select("publication_id, submission_status, submitted_at, reviewed_at, review_note, updated_at")
      .order("updated_at", { ascending: false });

    if (ownershipResult.error) {
      setLoading(false);
      setError("Unable to load your publishing workspace.");
      return;
    }

    const ownershipRows = (ownershipResult.data ?? []) as AuthorPublicationRow[];
    if (!ownershipRows.length) {
      setRows([]);
      setSelectedId(null);
      setForm(emptyForm);
      setLoading(false);
      return;
    }

    const ids = ownershipRows.map((row) => row.publication_id);
    const publicationsResult = await supabase
      .from("library_publications")
      .select("id, title, subtitle, description, publication_type, author_name, publisher_name, language_code, isbn, status")
      .in("id", ids);

    if (publicationsResult.error) {
      setLoading(false);
      setError("Unable to load your draft metadata.");
      return;
    }

    const publicationMap = new Map(
      ((publicationsResult.data ?? []) as PublicationRow[]).map((publication) => [publication.id, publication])
    );
    const combined = ownershipRows
      .map((ownership) => {
        const publication = publicationMap.get(ownership.publication_id);
        return publication ? { ...ownership, publication } : null;
      })
      .filter((row): row is AuthorPublication => Boolean(row));

    setRows(combined);
    setSelectedId((current) => {
      const nextId = current && combined.some((row) => row.publication_id === current)
        ? current
        : combined[0]?.publication_id ?? null;
      const next = combined.find((row) => row.publication_id === nextId);
      setForm(next ? formFromPublication(next.publication) : emptyForm);
      return nextId;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  function choosePublication(row: AuthorPublication) {
    setSelectedId(row.publication_id);
    setForm(formFromPublication(row.publication));
    setMessage(null);
    setError(null);
  }

  function startNewDraft() {
    setSelectedId(null);
    setForm(emptyForm);
    setMessage(null);
    setError(null);
  }

  function updateField<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveDraft() {
    if (!form.title.trim()) {
      setError("Add a title before saving.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    if (!selectedId) {
      const result = await supabase.rpc("create_library_author_draft", rpcPayload(form));
      if (result.error || !result.data) {
        setError("Unable to create this draft.");
        setSaving(false);
        return;
      }
      setSelectedId(result.data as string);
      setMessage("Draft created. It is private until Loombus approves and publishes it.");
    } else {
      const result = await supabase.rpc("update_library_author_draft", {
        p_publication_id: selectedId,
        ...rpcPayload(form),
      });
      if (result.error) {
        setError("Unable to save this draft in its current review state.");
        setSaving(false);
        return;
      }
      setMessage("Draft saved.");
    }

    await loadWorkspace();
    setSaving(false);
  }

  async function submitForReview() {
    if (!selected || !editable) return;

    setSaving(true);
    setMessage(null);
    setError(null);

    const saveResult = await supabase.rpc("update_library_author_draft", {
      p_publication_id: selected.publication_id,
      ...rpcPayload(form),
    });
    if (saveResult.error) {
      setError("Save the draft successfully before submitting it.");
      setSaving(false);
      return;
    }

    const submitResult = await supabase.rpc("submit_library_author_publication", {
      p_publication_id: selected.publication_id,
    });
    if (submitResult.error) {
      setError("Unable to submit this publication for review.");
      setSaving(false);
      return;
    }

    setMessage("Submitted for Loombus review. Submission does not publish the work automatically.");
    await loadWorkspace();
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-28 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link href="/library" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold text-[var(--loombus-text-muted)] transition hover:border-[var(--loombus-gold)] hover:text-[var(--loombus-text)]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />Library
          </Link>
          <button type="button" onClick={startNewDraft} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black transition hover:opacity-90">
            <Sparkles className="h-4 w-4" aria-hidden="true" />New publication
          </button>
        </div>

        <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--loombus-gold)]">Author Publishing</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Prepare work for the Loombus Library.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)] sm:text-base">
            Create and refine publication metadata, then submit it for review. Drafts remain private; authors cannot directly publish or approve their own work.
          </p>
        </section>

        {error ? <div role="alert" className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4 text-sm text-[var(--loombus-text-muted)]">{error}</div> : null}
        {message ? <div role="status" className="mt-5 rounded-2xl border border-[color:color-mix(in_srgb,var(--loombus-gold)_45%,var(--loombus-border))] bg-[var(--loombus-gold-surface)] p-4 text-sm text-[var(--loombus-text)]">{message}</div> : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <aside className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Your work</p><h2 className="mt-2 text-lg font-semibold">Publications</h2></div>
              {loading ? <Loader2 className="h-5 w-5 animate-spin text-[var(--loombus-gold)]" aria-label="Loading publications" /> : null}
            </div>
            {!loading && !rows.length ? <p className="mt-5 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm leading-6 text-[var(--loombus-text-muted)]">No author publications yet. Create your first private draft.</p> : null}
            <div className="mt-4 space-y-3">
              {rows.map((row) => (
                <button key={row.publication_id} type="button" onClick={() => choosePublication(row)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === row.publication_id ? "border-[var(--loombus-gold)] bg-[var(--loombus-gold-surface)]" : "border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] hover:border-[var(--loombus-gold)]"}`}>
                  <p className="font-semibold">{row.publication.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--loombus-text-muted)]">
                    <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 capitalize">{authorStatusLabel(row)}</span>
                    <span className="capitalize">{row.publication.publication_type}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">{selected ? authorStatusLabel(selected) : "New draft"}</p><h2 className="mt-2 text-xl font-semibold">Publication details</h2></div>
              {selected?.publication.status === "published" ? (
                <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Published to Library</span>
              ) : selected?.submission_status === "approved" ? (
                <span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs font-semibold text-[var(--loombus-text-muted)]">Approved for controlled publishing</span>
              ) : null}
            </div>

            {selected?.review_note ? <div className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Review note</p><p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{selected.review_note}</p></div> : null}

            <fieldset disabled={!editable || saving} className="mt-6 grid gap-4 disabled:opacity-70">
              <label className="grid gap-2 text-sm font-medium">Title<input value={form.title} onChange={(event) => updateField("title", event.target.value)} maxLength={200} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
              <label className="grid gap-2 text-sm font-medium">Subtitle<input value={form.subtitle} onChange={(event) => updateField("subtitle", event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
              <label className="grid gap-2 text-sm font-medium">Description<textarea value={form.description} onChange={(event) => updateField("description", event.target.value)} rows={5} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 py-3 outline-none focus:border-[var(--loombus-gold)]" /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">Type<select value={form.publicationType} onChange={(event) => updateField("publicationType", event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]">{publicationTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label>
                <label className="grid gap-2 text-sm font-medium">Language<input value={form.languageCode} onChange={(event) => updateField("languageCode", event.target.value)} maxLength={12} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium">Author name<input value={form.authorName} onChange={(event) => updateField("authorName", event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
                <label className="grid gap-2 text-sm font-medium">Publisher<input value={form.publisherName} onChange={(event) => updateField("publisherName", event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
              </div>
              <label className="grid gap-2 text-sm font-medium">ISBN<input value={form.isbn} onChange={(event) => updateField("isbn", event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-4 outline-none focus:border-[var(--loombus-gold)]" /></label>
            </fieldset>

            <div className="mt-6 flex flex-wrap gap-3">
              {editable ? <button type="button" disabled={saving} onClick={() => void saveDraft()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)] disabled:cursor-wait disabled:opacity-60">{saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BookOpen className="h-4 w-4 text-[var(--loombus-gold)]" aria-hidden="true" />}Save draft</button> : null}
              {selected && editable ? <button type="button" disabled={saving} onClick={() => void submitForReview()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60"><Send className="h-4 w-4" aria-hidden="true" />Submit for review</button> : null}
            </div>

            {selected && !editable ? (
              <p className="mt-5 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {selected.publication.status === "published"
                  ? "This publication is published in the Loombus Library and is locked from author-side draft editing."
                  : "This publication is locked while it is in its current review state. Loombus review controls approval and publishing."}
              </p>
            ) : null}
            <p className="mt-6 border-t border-[var(--loombus-border)] pt-5 text-xs leading-5 text-[var(--loombus-text-subtle)]">EPUB upload is intentionally not enabled in this slice. Original publication files remain behind the existing private ingestion boundary until the member upload path can be implemented without a service role.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
