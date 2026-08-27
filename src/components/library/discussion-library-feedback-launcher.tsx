"use client";

import Link from "next/link";
import { BookOpen, Brain, CheckCircle2, FlaskConical, MessageCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
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

const INLINE_HOST_ATTR = "data-discussion-library-feedback-inline";

export function DiscussionLibraryFeedbackLauncher() {
  const params = useParams<{ id: string }>();
  const discussionId = params?.id;
  const [passage, setPassage] = useState<PassageContext | null>(null);
  const [inlineHost, setInlineHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!discussionId) return;

    let cancelled = false;
    let frame = 0;

    const mountInlineHost = () => {
      if (cancelled) return;

      const opening = document.querySelector<HTMLElement>(".discussion-v2-opening-card");
      if (!opening) {
        frame = window.requestAnimationFrame(mountInlineHost);
        return;
      }

      let host = opening.querySelector<HTMLElement>(`:scope > [${INLINE_HOST_ATTR}='true']`);
      if (!host) {
        host = document.createElement("div");
        host.setAttribute(INLINE_HOST_ATTR, "true");
        const openingActions = opening.querySelector<HTMLElement>(".discussion-v2-opening-actions");
        if (openingActions) {
          openingActions.insertAdjacentElement("afterend", host);
        } else {
          opening.append(host);
        }
      }

      setInlineHost(host);
    };

    frame = window.requestAnimationFrame(mountInlineHost);

    return () => {
      cancelled = true;
      if (frame) window.cancelAnimationFrame(frame);
      setInlineHost(null);
      document
        .querySelectorAll<HTMLElement>(`[${INLINE_HOST_ATTR}='true']`)
        .forEach((node) => node.remove());
    };
  }, [discussionId]);

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

  if (!discussionId || !inlineHost) return null;

  return createPortal(
    <section className="mt-4 border-t border-[var(--loombus-border-muted)] pt-3 text-[var(--loombus-text)]" aria-label="Library and knowledge actions">
      {passage ? (
        <div className="border-b border-[var(--loombus-border-muted)] pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Library source</p>
              <p className="mt-1 text-sm font-black">{passage.publicationTitle}</p>
              <p className="mt-0.5 text-xs text-[var(--loombus-text-subtle)]">
                {passage.authorName ? `${passage.authorName} · ` : ""}
                {passage.sectionTitle ?? "Current chapter"}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 py-1 text-[10px] font-black text-[var(--loombus-gold)]">
              {passage.evidenceSaved ? <CheckCircle2 className="size-3" /> : <FlaskConical className="size-3" />}
              {passage.evidenceSaved ? "Evidence saved" : "Needs evidence"}
            </span>
          </div>

          <blockquote className="mt-3 border-l-2 border-[var(--loombus-gold)] pl-3 text-xs leading-5 text-[var(--loombus-text-muted)]">
            “{passage.selected_text}”
          </blockquote>
          <p className="mt-2 text-[10px] text-[var(--loombus-text-subtle)]">
            Verified characters {passage.start_offset}–{passage.end_offset}
          </p>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
            <Link
              href={libraryReaderHref(passage.publication_id, {
                locator: passage.locator,
                startOffset: passage.start_offset,
                endOffset: passage.end_offset,
                textSha256: passage.text_sha256,
              })}
              className="inline-flex min-h-9 items-center gap-2 border-b border-[var(--loombus-border)] py-1 text-xs font-black hover:border-[var(--loombus-gold)]"
            >
              <BookOpen className="size-3.5 text-[var(--loombus-gold)]" />
              Open exact source
            </Link>
            <Link
              href="/library/research"
              className="inline-flex min-h-9 items-center gap-2 border-b border-[var(--loombus-border)] py-1 text-xs font-black hover:border-[var(--loombus-gold)]"
            >
              <FlaskConical className="size-3.5 text-[var(--loombus-gold)]" />
              {passage.evidenceSaved ? "View evidence" : "Investigate"}
            </Link>
          </div>
        </div>
      ) : null}

      <div className={passage ? "pt-3" : undefined}>
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Library & knowledge</p>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
          <Link
            href={`/library/research/from-reply?discussionId=${encodeURIComponent(discussionId)}`}
            className="inline-flex min-h-9 items-center gap-2 border-b border-[var(--loombus-border)] py-1 text-xs font-black text-[var(--loombus-gold)] hover:border-[var(--loombus-gold)]"
            aria-label="Build private Library knowledge from a reply in this discussion"
          >
            <MessageCircle className="size-3.5" />
            From Reply
          </Link>
          <Link
            href={`/library/research/from-discussion?discussionId=${encodeURIComponent(discussionId)}`}
            className="inline-flex min-h-9 items-center gap-2 border-b border-[var(--loombus-border)] py-1 text-xs font-black text-[var(--loombus-gold)] hover:border-[var(--loombus-gold)]"
            aria-label="Build private Library knowledge from this discussion opening post"
          >
            <Brain className="size-3.5" />
            Build Knowledge
          </Link>
        </div>
      </div>
    </section>,
    inlineHost
  );
}
