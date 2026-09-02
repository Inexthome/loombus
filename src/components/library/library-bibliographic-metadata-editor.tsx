"use client";

import { Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Metadata = {
  series_title: string | null;
  series_position: number | null;
  edition_label: string | null;
  subjects: string[] | null;
  keywords: string[] | null;
  audience_label: string | null;
};

type Props =
  | { mode: "publication"; publicationId: string | null; versionId?: never; editable: boolean }
  | { mode: "revision"; versionId: string | null; publicationId?: never; editable: boolean };

function parseList(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => {
      if (!item) return false;
      const key = item.toLocaleLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function LibraryBibliographicMetadataEditor(props: Props) {
  const [seriesTitle, setSeriesTitle] = useState("");
  const [seriesPosition, setSeriesPosition] = useState("");
  const [editionLabel, setEditionLabel] = useState("");
  const [subjectsText, setSubjectsText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [audienceLabel, setAudienceLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetId = props.mode === "publication" ? props.publicationId : props.versionId;

  const load = useCallback(async () => {
    setMessage(null);
    setError(null);
    if (!targetId) {
      setSeriesTitle("");
      setSeriesPosition("");
      setEditionLabel("");
      setSubjectsText("");
      setKeywordsText("");
      setAudienceLabel("");
      return;
    }
    setLoading(true);
    const result = props.mode === "publication"
      ? await supabase.from("library_publications").select("series_title,series_position,edition_label,subjects,keywords,audience_label").eq("id", targetId).maybeSingle()
      : await supabase.from("library_publication_versions").select("series_title,series_position,edition_label,subjects,keywords,audience_label").eq("id", targetId).maybeSingle();
    if (result.error || !result.data) {
      setError("Unable to load publication metadata.");
      setLoading(false);
      return;
    }
    const data = result.data as Metadata;
    setSeriesTitle(data.series_title ?? "");
    setSeriesPosition(data.series_position == null ? "" : String(data.series_position));
    setEditionLabel(data.edition_label ?? "");
    setSubjectsText((data.subjects ?? []).join(", "));
    setKeywordsText((data.keywords ?? []).join(", "));
    setAudienceLabel(data.audience_label ?? "");
    setLoading(false);
  }, [props.mode, targetId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!targetId || !props.editable || saving) return;
    const parsedPosition = seriesPosition.trim() ? Number(seriesPosition) : null;
    if (parsedPosition !== null && (!Number.isFinite(parsedPosition) || parsedPosition <= 0)) {
      setError("Series position must be a positive number.");
      return;
    }
    const subjects = parseList(subjectsText);
    const keywords = parseList(keywordsText);
    if (subjects.length > 12) {
      setError("Use no more than 12 categories.");
      return;
    }
    if (keywords.length > 20) {
      setError("Use no more than 20 keywords.");
      return;
    }
    if (keywords.some((keyword) => keyword.length > 60)) {
      setError("Each keyword must be 60 characters or fewer.");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const bibliographicPayload = {
      p_series_title: seriesTitle.trim() || null,
      p_series_position: parsedPosition,
      p_edition_label: editionLabel.trim() || null,
      p_subjects: subjects,
      p_audience_label: audienceLabel.trim() || null,
    };
    const bibliographicResult = props.mode === "publication"
      ? await supabase.rpc("update_library_author_bibliographic_metadata", { p_publication_id: targetId, ...bibliographicPayload })
      : await supabase.rpc("update_library_author_revision_bibliographic_metadata", { p_version_id: targetId, ...bibliographicPayload });

    if (bibliographicResult.error) {
      setError("Unable to save publication metadata in this review state.");
      setSaving(false);
      return;
    }

    const keywordResult = props.mode === "publication"
      ? await supabase.rpc("update_library_author_keywords", { p_publication_id: targetId, p_keywords: keywords })
      : await supabase.rpc("update_library_author_revision_keywords", { p_version_id: targetId, p_keywords: keywords });

    if (keywordResult.error) {
      setError("Bibliographic details were saved, but keywords could not be saved.");
      setSaving(false);
      return;
    }

    setMessage("Publication metadata saved.");
    await load();
    setSaving(false);
  }

  return (
    <section className="mt-6 border-t border-[var(--loombus-border)] pt-5" aria-label="Bibliographic metadata">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Bibliographic details</p>
          <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">
            Optional series, edition, category, keyword, and audience metadata. Categories use the Library&apos;s canonical subject classification; keywords add search-oriented descriptors without changing your byline.
          </p>
        </div>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--loombus-gold)]" /> : null}
      </div>

      {targetId ? (
        <fieldset disabled={!props.editable || saving || loading} className="mt-4 grid gap-4 disabled:opacity-70">
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
              Series title
              <input value={seriesTitle} maxLength={200} onChange={(e) => setSeriesTitle(e.target.value)} className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
              Series position
              <input inputMode="decimal" value={seriesPosition} onChange={(e) => setSeriesPosition(e.target.value)} placeholder="1" className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
              Edition label
              <input value={editionLabel} maxLength={100} onChange={(e) => setEditionLabel(e.target.value)} placeholder="First edition" className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
            </label>
            <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
              Audience
              <input value={audienceLabel} maxLength={120} onChange={(e) => setAudienceLabel(e.target.value)} placeholder="General readers" className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
            </label>
          </div>

          <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
            Categories <span className="font-normal text-[var(--loombus-text-subtle)]">Comma-separated, up to 12</span>
            <input value={subjectsText} onChange={(e) => setSubjectsText(e.target.value)} placeholder="Artificial intelligence, Society, Technology" className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
          </label>

          <label className="grid gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">
            Keywords <span className="font-normal text-[var(--loombus-text-subtle)]">Comma-separated, up to 20</span>
            <input value={keywordsText} onChange={(e) => setKeywordsText(e.target.value)} placeholder="AI governance, automation, future of work" className="min-h-11 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-strong)] px-3 text-sm outline-none focus:border-[var(--loombus-gold)]" />
          </label>
        </fieldset>
      ) : (
        <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">Save the publication before adding categories, keywords, and other bibliographic details.</p>
      )}

      {error ? <div role="alert" className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">{error}</div> : null}
      {message ? <div role="status" className="mt-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-gold-surface)] p-3 text-xs">{message}</div> : null}
      {targetId && props.editable ? (
        <button type="button" disabled={saving || loading} onClick={() => void save()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-semibold hover:border-[var(--loombus-gold)] disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-[var(--loombus-gold)]" />}
          Save bibliographic details
        </button>
      ) : null}
    </section>
  );
}
