"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Focus = { locator: string; startOffset: number; endOffset: number; textSha256: string };
type Section = { section_key: string; ordinal: number; title: string | null; content_text: string };

async function sha256Text(value: string) {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function LibraryReaderPassageReturnBoundary({ publicationId, focus, children }: { publicationId: string; focus: Focus | null; children: ReactNode }) {
  const [preparing, setPreparing] = useState(Boolean(focus));
  const [verifiedText, setVerifiedText] = useState<string | null>(null);
  const [sectionTitle, setSectionTitle] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [noticeVisible, setNoticeVisible] = useState(true);

  const focusKey = useMemo(() => focus ? `${focus.locator}:${focus.startOffset}:${focus.endOffset}:${focus.textSha256}` : "none", [focus]);

  useEffect(() => {
    if (!focus) { setPreparing(false); return; }
    let cancelled = false;
    void (async () => {
      setPreparing(true);
      setWarning(null);
      setNoticeVisible(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user || cancelled) return;
        const sectionResult = await supabase.from("library_publication_sections").select("section_key, ordinal, title, content_text").eq("publication_id", publicationId).eq("section_key", focus.locator).maybeSingle();
        const section = sectionResult.data as Section | null;
        if (sectionResult.error || !section) { if (!cancelled) setWarning("The source chapter could not be restored exactly. The Reader will open using your saved position."); return; }
        const hash = await sha256Text(section.content_text);
        const offsetsValid = focus.startOffset >= 0 && focus.endOffset > focus.startOffset && focus.endOffset <= section.content_text.length;
        if (!offsetsValid || hash !== focus.textSha256) { if (!cancelled) setWarning("The source text changed after this passage was captured, so Loombus did not claim an exact passage match."); return; }
        const countResult = await supabase.from("library_publication_sections").select("section_key", { count: "exact", head: true }).eq("publication_id", publicationId);
        const total = Math.max(1, countResult.count ?? section.ordinal + 1);
        const progressPercent = Math.min(100, Math.max(1, Math.round(((section.ordinal + 1) / total) * 100)));
        const now = new Date().toISOString();
        const progressResult = await supabase.from("library_reading_progress").upsert({ user_id: authData.user.id, publication_id: publicationId, locator: section.section_key, progress_percent: progressPercent, last_read_at: now, updated_at: now }, { onConflict: "user_id,publication_id" });
        if (progressResult.error) { if (!cancelled) setWarning("The exact passage was verified, but Loombus could not restore the chapter position automatically."); }
        else if (!cancelled) { setSectionTitle(section.title ?? `Section ${section.ordinal + 1}`); setVerifiedText(section.content_text.slice(focus.startOffset, focus.endOffset)); }
      } catch {
        if (!cancelled) setWarning("Loombus could not verify the requested passage before opening the Reader.");
      } finally {
        if (!cancelled) setPreparing(false);
      }
    })();
    return () => { cancelled = true; };
  }, [focusKey, publicationId, focus]);

  if (preparing) {
    return <main className="grid min-h-screen place-items-center bg-[var(--loombus-page-bg)] text-[var(--loombus-text)]"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"><Loader2 className="size-5 animate-spin text-[var(--loombus-gold)]" /> Restoring verified passage…</div></main>;
  }

  return (
    <>
      {noticeVisible && verifiedText && focus ? (
        <aside className="fixed left-1/2 top-20 z-[95] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--loombus-gold)]/40 bg-[color:color-mix(in_srgb,var(--loombus-surface)_96%,transparent)] p-4 text-[var(--loombus-text)] shadow-2xl backdrop-blur-xl" aria-label="Returned passage provenance">
          <button type="button" onClick={() => setNoticeVisible(false)} className="absolute right-3 top-3 grid size-8 place-items-center rounded-full" aria-label="Dismiss passage return notice"><X className="size-4" /></button>
          <div className="flex items-center gap-2 pr-10 text-sm font-black text-[var(--loombus-gold)]"><CheckCircle2 className="size-4" /> Returned to verified passage</div>
          <p className="mt-1 pr-8 text-xs text-[var(--loombus-text-muted)]">{sectionTitle ?? "Source chapter"} · characters {focus.startOffset}–{focus.endOffset} · SHA-256 verified</p>
          <blockquote className="mt-3 line-clamp-3 border-l-2 border-[var(--loombus-gold)] pl-3 text-sm leading-6 text-[var(--loombus-text-muted)]">“{verifiedText}”</blockquote>
        </aside>
      ) : noticeVisible && warning ? (
        <aside className="fixed left-1/2 top-20 z-[95] w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm text-[var(--loombus-text-muted)] shadow-xl" role="status"><button type="button" onClick={() => setNoticeVisible(false)} className="absolute right-3 top-3"><X className="size-4" /></button>{warning}</aside>
      ) : null}
      {children}
    </>
  );
}
