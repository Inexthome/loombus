"use client";

import { CheckCircle2, EyeOff, Loader2, Send, ShieldAlert, Undo2, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Publication = {
  id: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  publication_type: string;
  author_name: string | null;
  publisher_name: string | null;
  language_code: string;
  isbn: string | null;
  status: "draft" | "published" | "archived";
  publication_date: string | null;
};

type ReviewRow = {
  publication_id: string;
  user_id: string;
  submission_status: "draft" | "submitted" | "changes_requested" | "approved" | "rejected";
  submitted_at: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  reviewed_by: string | null;
  published_at: string | null;
  published_by: string | null;
  library_publications: Publication | Publication[] | null;
};

type AccessState = "checking" | "allowed" | "denied" | "error";

function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function statusLabel(status: ReviewRow["submission_status"]) {
  return status.replace("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default function AdminLibraryReviewClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setMessage("");

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      window.location.replace("/login?next=/admin/library-review");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profileError) {
      setAccessState("error");
      setMessage("Admin access could not be verified.");
      setMessageIsError(true);
      setLoading(false);
      return;
    }

    if (!profile?.is_admin) {
      setAccessState("denied");
      setLoading(false);
      return;
    }

    setAccessState("allowed");

    const { data, error } = await supabase
      .from("library_author_publications")
      .select(
        "publication_id,user_id,submission_status,submitted_at,reviewed_at,review_note,reviewed_by,published_at,published_by,library_publications!inner(id,title,subtitle,description,publication_type,author_name,publisher_name,language_code,isbn,status,publication_date)"
      )
      .in("submission_status", ["submitted", "changes_requested", "approved", "rejected"])
      .order("submitted_at", { ascending: true, nullsFirst: false });

    if (error) {
      setMessage("Unable to load Library review queue.");
      setMessageIsError(true);
      setRows([]);
      setLoading(false);
      return;
    }

    setRows((data ?? []) as unknown as ReviewRow[]);
    setNoteDrafts((current) => {
      const next = { ...current };
      for (const row of (data ?? []) as unknown as ReviewRow[]) {
        if (!(row.publication_id in next)) next[row.publication_id] = row.review_note ?? "";
      }
      return next;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function review(
    publicationId: string,
    action: "request_changes" | "approve" | "reject"
  ) {
    if (workingId) return;
    const note = noteDrafts[publicationId]?.trim() ?? "";
    if ((action === "request_changes" || action === "reject") && !note) {
      setMessage("A review note is required when requesting changes or rejecting a publication.");
      setMessageIsError(true);
      return;
    }

    setWorkingId(publicationId);
    setMessage("");
    setMessageIsError(false);
    try {
      const { error } = await supabase.rpc("review_library_author_publication", {
        p_publication_id: publicationId,
        p_action: action,
        p_review_note: note || null,
      });
      if (error) throw error;
      setMessage(
        action === "approve"
          ? "Publication approved. It remains private until an admin publishes it."
          : action === "request_changes"
            ? "Changes requested. The author can edit and resubmit the publication."
            : "Publication rejected."
      );
      await loadRows();
    } catch (error) {
      console.error("Unable to review Library publication.", error);
      setMessage("Unable to record the Library review decision.");
      setMessageIsError(true);
    } finally {
      setWorkingId(null);
    }
  }

  async function publish(publicationId: string, republishing: boolean) {
    if (workingId) return;
    setWorkingId(publicationId);
    setMessage("");
    setMessageIsError(false);
    try {
      const { error } = await supabase.rpc("publish_library_author_publication", {
        p_publication_id: publicationId,
      });
      if (error) throw error;
      setMessage(republishing ? "Publication republished to the Loombus Library." : "Approved publication published to the Loombus Library.");
      await loadRows();
    } catch (error) {
      console.error("Unable to publish Library publication.", error);
      setMessage("Unable to publish the approved Library publication.");
      setMessageIsError(true);
    } finally {
      setWorkingId(null);
    }
  }

  async function unpublish(publicationId: string, title: string) {
    if (workingId) return;
    const confirmed = window.confirm(
      `Unpublish “${title}” from the Loombus Library? The public listing and Reader access will be removed, but publication history, content, annotations, and provenance will be preserved for possible republishing.`
    );
    if (!confirmed) return;

    setWorkingId(publicationId);
    setMessage("");
    setMessageIsError(false);
    try {
      const { error } = await supabase.rpc("unpublish_library_author_publication", {
        p_publication_id: publicationId,
      });
      if (error) throw error;
      setMessage("Publication unpublished. Its history and Library data remain preserved.");
      await loadRows();
    } catch (error) {
      console.error("Unable to unpublish Library publication.", error);
      setMessage("Unable to unpublish this Library publication.");
      setMessageIsError(true);
    } finally {
      setWorkingId(null);
    }
  }

  const pendingCount = useMemo(
    () => rows.filter((row) => row.submission_status === "submitted").length,
    [rows]
  );

  if (accessState === "checking" || (loading && accessState !== "denied")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]">
        <Loader2 className="size-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Library review queue" />
      </main>
    );
  }

  if (accessState === "denied") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[var(--loombus-page-bg)] px-6 text-center text-[var(--loombus-text)]">
        <ShieldAlert className="size-8 text-[var(--loombus-text-subtle)]" aria-hidden="true" />
        <p className="text-sm font-semibold text-[var(--loombus-text-muted)]">
          Admin access is required to review Library publications.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 md:pt-24 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-sm sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Library editorial operations</p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Author publication review</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Review submitted publication metadata, request changes, approve or reject work, publish approved work, and unpublish while preserving history.
              </p>
            </div>
            <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] px-4 py-2 text-sm font-semibold text-[var(--loombus-gold)]">
              {pendingCount} pending
            </span>
          </div>
        </header>

        {message ? (
          <div role="status" className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${messageIsError ? "border-rose-500/30 bg-rose-500/10 text-rose-500" : "border-[var(--loombus-border)] bg-[var(--loombus-surface)] text-[var(--loombus-text-muted)]"}`}>
            {message}
          </div>
        ) : null}

        {rows.length === 0 ? (
          <section className="rounded-[2rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center text-sm text-[var(--loombus-text-muted)]">
            No author publications are currently in the review workflow.
          </section>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((row) => {
              const publication = single(row.library_publications);
              if (!publication) return null;
              const busy = workingId === row.publication_id;
              const isSubmitted = row.submission_status === "submitted";
              const canPublish = row.submission_status === "approved" && (publication.status === "draft" || publication.status === "archived");
              const canUnpublish = row.submission_status === "approved" && publication.status === "published" && Boolean(row.published_at);
              const republishing = publication.status === "archived" && Boolean(row.published_at);

              return (
                <article key={row.publication_id} className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[var(--loombus-gold-surface)] px-3 py-1 text-xs font-bold text-[var(--loombus-gold)]">
                          {statusLabel(row.submission_status)}
                        </span>
                        <span className="text-xs text-[var(--loombus-text-subtle)]">{publication.publication_type}</span>
                        {publication.status === "published" ? <span className="text-xs font-semibold text-[var(--loombus-text-muted)]">Published</span> : null}
                        {publication.status === "archived" ? <span className="text-xs font-semibold text-[var(--loombus-text-muted)]">Unpublished</span> : null}
                      </div>
                      <h2 className="mt-3 text-xl font-semibold">{publication.title}</h2>
                      {publication.subtitle ? <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{publication.subtitle}</p> : null}
                    </div>
                    <div className="text-right text-xs leading-5 text-[var(--loombus-text-subtle)]">
                      <p>{publication.author_name ?? "Unnamed author"}</p>
                      <p>{publication.publisher_name ?? "No publisher"}</p>
                    </div>
                  </div>

                  {publication.description ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-[var(--loombus-text-muted)]">{publication.description}</p> : null}

                  <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-3">
                    <div><dt className="font-bold text-[var(--loombus-text-subtle)]">Language</dt><dd className="mt-1">{publication.language_code}</dd></div>
                    <div><dt className="font-bold text-[var(--loombus-text-subtle)]">ISBN</dt><dd className="mt-1">{publication.isbn ?? "—"}</dd></div>
                    <div><dt className="font-bold text-[var(--loombus-text-subtle)]">Submitted</dt><dd className="mt-1">{row.submitted_at ? new Date(row.submitted_at).toLocaleString() : "—"}</dd></div>
                  </dl>

                  <label className="mt-5 block">
                    <span className="mb-2 block text-xs font-bold text-[var(--loombus-text-muted)]">Review note</span>
                    <textarea
                      value={noteDrafts[row.publication_id] ?? ""}
                      onChange={(event) => setNoteDrafts((current) => ({ ...current, [row.publication_id]: event.target.value }))}
                      disabled={!isSubmitted || busy}
                      maxLength={2000}
                      rows={3}
                      placeholder={isSubmitted ? "Required for changes requested or rejection." : "Review decision recorded."}
                      className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm outline-none focus:border-[var(--loombus-gold)] disabled:opacity-70"
                    />
                  </label>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {isSubmitted ? (
                      <>
                        <button type="button" disabled={busy} onClick={() => void review(row.publication_id, "request_changes")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold hover:border-[var(--loombus-gold)] disabled:opacity-50">
                          <Undo2 className="size-4" aria-hidden="true" />Request changes
                        </button>
                        <button type="button" disabled={busy} onClick={() => void review(row.publication_id, "reject")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold hover:border-rose-400 disabled:opacity-50">
                          <XCircle className="size-4" aria-hidden="true" />Reject
                        </button>
                        <button type="button" disabled={busy} onClick={() => void review(row.publication_id, "approve")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-xs font-semibold text-black disabled:opacity-50">
                          <CheckCircle2 className="size-4" aria-hidden="true" />Approve
                        </button>
                      </>
                    ) : null}
                    {canUnpublish ? (
                      <button type="button" disabled={busy} onClick={() => void unpublish(row.publication_id, publication.title)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 text-xs font-semibold hover:border-[var(--loombus-gold)] disabled:opacity-50">
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}
                        Unpublish from Library
                      </button>
                    ) : null}
                    {canPublish ? (
                      <button type="button" disabled={busy} onClick={() => void publish(row.publication_id, republishing)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 text-xs font-semibold text-black disabled:opacity-50">
                        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
                        {republishing ? "Republish to Library" : "Publish to Library"}
                      </button>
                    ) : null}
                  </div>

                  {row.reviewed_at ? <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">Reviewed {new Date(row.reviewed_at).toLocaleString()}{row.published_at ? ` · First published ${new Date(row.published_at).toLocaleString()}` : ""}</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
