"use client";

import Link from "next/link";
import { BookOpen, Brain, CheckCircle2, FlaskConical, MessageCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { libraryReaderHref } from "@/lib/library/passage-context";
import { supabase } from "@/lib/supabase/client";

type PassageLink = {
  discussion_id: string;
  publication_id: string;
  locator: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  text_sha256: string;
};

type PassageContext = PassageLink & {
  publicationTitle: string;
  authorName: string | null;
  sectionTitle: string | null;
  evidenceSaved: boolean;
};

export function DiscussionLibraryFeedbackLauncher() {
  const params = useParams<{ id: string }>();
  const discussionId = params?.id;
  const [passage, setPassage] = useState<PassageContext | null>(null);

  useEffect(() => {
    if (!discussionId) return;
    let cancelled = false;

    void (async () => {
      const linkResult = await supabase
        .from("library_passage_discussions")
        .select("discussion_id,publication_id,locator,selected_text,start_offset,end_offset,text_sha256")
        .eq("discussion_id", discussionId)
        .maybeSingle();

      if (cancelled || linkResult.error || !linkResult.data) {
        if (!cancelled) setPassage(null);
        return;
      }

      const link = linkResult.data as PassageLink;
      const [publicationResult, sectionResult, evidenceResult] = await Promise.all([
        supabase
          .from("library_publications")
          .select("title,author_name")
          .eq("id", link.publication_id)
          .eq("status", "published")
          .maybeSingle(),
        supabase
          .from("library_publication_sections")
          .select("title")
          .eq("publication_id", link.publication_id)
          .eq("section_key", link.locator)
          .maybeSingle(),
        supabase
          .from("library_research_items")
          .select("id")
          .eq("publication_id", link.publication_id)
          .eq("locator", link.locator)
          .eq("start_offset", link.start_offset)
          .eq("end_offset", link.end_offset)
          .eq("text_sha256", link.text_sha256)
          .maybeSingle(),
      ]);

      if (cancelled || publicationResult.error || !publicationResult.data) return;
      setPassage({
        ...link,
        publicationTitle: publicationResult.data.title,
        authorName: publicationResult.data.author_name,
        sectionTitle: sectionResult.error ? null : sectionResult.data?.title ?? null,
        evidenceSaved: Boolean(evidenceResult.data),
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [discussionId]);

  if (!discussionId) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 flex max-w-sm flex-col items-end gap-2 md:bottom-6 md:right-6">
      {passage ? (
        <section className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-[var(--loombus-text)] shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Library source</p>
              <p className="mt-1 line-clamp-1 text-sm font-black">{passage.publicationTitle}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-[var(--loombus-text-subtle)]">{passage.authorName ? `${passage.authorName} · ` : ""}{passage.sectionTitle ?? "Current chapter"}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--loombus-gold-surface)] px-2.5 py-1 text-[10px] font-black text-[var(--loombus-gold)]">
              {passage.evidenceSaved ? <CheckCircle2 className="size-3" /> : <FlaskConical className="size-3" />}
              {passage.evidenceSaved ? "Evidence saved" : "Needs evidence"}
            </span>
          </div>
          <blockquote className="mt-3 line-clamp-3 border-l-2 border-[var(--loombus-gold)] pl-3 text-xs leading-5 text-[var(--loombus-text-muted)]">“{passage.selected_text}”</blockquote>
          <p className="mt-2 text-[10px] text-[var(--loombus-text-subtle)]">Verified characters {passage.start_offset}–{passage.end_offset}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link href={libraryReaderHref(passage.publication_id, { locator: passage.locator, startOffset: passage.start_offset, endOffset: passage.end_offset, textSha256: passage.text_sha256 })} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 text-xs font-black hover:border-[var(--loombus-gold)]"><BookOpen className="size-3.5 text-[var(--loombus-gold)]" />Open exact source</Link>
            <Link href="/library/research" className="inline-flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 text-xs font-black hover:border-[var(--loombus-gold)]"><FlaskConical className="size-3.5 text-[var(--loombus-gold)]" />{passage.evidenceSaved ? "View evidence" : "Investigate"}</Link>
          </div>
        </section>
      ) : null}

      <Link
        href={`/library/research/from-reply?discussionId=${encodeURIComponent(discussionId)}`}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        aria-label="Build private Library knowledge from a reply in this discussion"
      >
        <MessageCircle className="size-4" />
        From Reply
      </Link>
      <Link
        href={`/library/research/from-discussion?discussionId=${encodeURIComponent(discussionId)}`}
        className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2.5 text-sm font-black text-[var(--loombus-gold)] shadow-lg"
        aria-label="Build private Library knowledge from this discussion opening post"
      >
        <Brain className="size-4" />
        Build Knowledge
      </Link>
    </div>
  );
}
