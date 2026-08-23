"use client";

import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { LibraryCoverImage } from "@/components/library/library-cover-image";
import { supabase } from "@/lib/supabase/client";

const COVER_BUCKET = "library-publication-covers";
const MAX_COVER_BYTES = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type Props = { publicationId: string | null; editable: boolean; published: boolean };
type PreparedCover = { storage_bucket: string; storage_path: string };
type CoverMeta = { title: string; cover_url: string | null };

export function LibraryAuthorCoverUpload({ publicationId, editable, published }: Props) {
  const [meta, setMeta] = useState<CoverMeta | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    setError(null);
    if (!publicationId) { setMeta(null); return; }
    setLoading(true);
    const result = await supabase.from("library_publications").select("title, cover_url").eq("id", publicationId).maybeSingle();
    if (result.error) { setMeta(null); setError("Unable to load cover metadata."); }
    else setMeta((result.data ?? null) as CoverMeta | null);
    setLoading(false);
  }, [publicationId]);

  useEffect(() => { setFile(null); setError(null); setMessage(null); void loadMeta(); }, [loadMeta]);

  async function uploadCover() {
    if (!publicationId || !editable || !file || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      if (!ALLOWED_TYPES.has(file.type)) throw new Error("Choose a JPEG, PNG, or WebP cover image.");
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_COVER_BYTES) throw new Error("Cover images must be 8 MiB or smaller.");
      const prepare = await supabase.rpc("prepare_library_author_cover", { p_publication_id: publicationId, p_media_type: file.type, p_byte_size: file.size });
      if (prepare.error) throw prepare.error;
      const prepared = ((prepare.data ?? []) as PreparedCover[])[0];
      if (!prepared) throw new Error("Unable to prepare this cover upload.");
      const upload = await supabase.storage.from(prepared.storage_bucket).upload(prepared.storage_path, file, { upsert: true, cacheControl: "0", contentType: file.type });
      if (upload.error) throw upload.error;
      setFile(null); await loadMeta(); setMessage("Cover uploaded successfully.");
    } catch (uploadError) {
      console.error("Unable to upload Library cover.", uploadError);
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload this cover.");
    } finally { setBusy(false); }
  }

  async function removeCover() {
    if (!publicationId || !meta?.cover_url || !editable || busy) return;
    setBusy(true); setError(null); setMessage(null);
    try {
      const remove = await supabase.storage.from(COVER_BUCKET).remove([meta.cover_url]);
      if (remove.error) throw remove.error;
      const clear = await supabase.rpc("clear_library_author_cover", { p_publication_id: publicationId });
      if (clear.error) throw clear.error;
      await loadMeta(); setMessage("Cover removed.");
    } catch (removeError) {
      console.error("Unable to remove Library cover.", removeError); setError("Unable to remove this cover.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-6 border-t border-[var(--loombus-border)] pt-5" aria-labelledby="library-cover-heading">
      <div className="flex items-start justify-between gap-3"><div><p id="library-cover-heading" className="text-sm font-semibold">Book cover</p><p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">JPEG, PNG, or WebP · maximum 8 MiB. Draft covers remain private until the publication is published.</p></div>{loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--loombus-gold)]" aria-label="Loading cover" /> : null}</div>
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="grid aspect-[2/3] w-32 shrink-0 place-items-center overflow-hidden rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] text-[var(--loombus-gold)]"><LibraryCoverImage storagePath={meta?.cover_url ?? null} alt={`${meta?.title ?? "Publication"} cover`} fallbackClassName="h-7 w-7" /></div>
        <div className="min-w-0 flex-1">
          {!publicationId ? <p className="text-xs leading-5 text-[var(--loombus-text-subtle)]">Save the publication draft before uploading its cover.</p> : published ? <p className="text-xs leading-5 text-[var(--loombus-text-subtle)]">Published covers are locked from author-side replacement.</p> : editable ? <div className="space-y-3"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block min-h-11 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-3 py-2 text-xs file:mr-3 file:rounded-full file:border-0 file:bg-[var(--loombus-gold-surface)] file:px-3 file:py-1.5 file:font-semibold" /><div className="flex flex-wrap gap-2"><button type="button" disabled={!file || busy} onClick={() => void uploadCover()} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-semibold text-black disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : meta?.cover_url ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}{meta?.cover_url ? "Replace cover" : "Upload cover"}</button>{meta?.cover_url ? <button type="button" disabled={busy} onClick={() => void removeCover()} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold disabled:opacity-50"><Trash2 className="h-4 w-4" aria-hidden="true" />Remove cover</button> : null}</div></div> : <p className="text-xs leading-5 text-[var(--loombus-text-subtle)]">Cover replacement is locked while this publication is under review.</p>}
          {error ? <p role="alert" className="mt-3 text-xs text-rose-500">{error}</p> : null}{message ? <p role="status" className="mt-3 text-xs text-[var(--loombus-text-muted)]">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
