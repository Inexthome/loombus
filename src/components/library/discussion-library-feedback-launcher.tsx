"use client";

import Link from "next/link";
import { BookOpen, Brain, CheckCircle2, ChevronDown, FlaskConical, MessageCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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

type MenuPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
};

const INLINE_HOST_ATTR = "data-discussion-library-feedback-inline";
const MORE_ACTION_SELECTOR = 'button[aria-label="Open Discussion actions"]';
const MENU_WIDTH_PX = 352;
const MENU_GUTTER_PX = 12;

export function DiscussionLibraryFeedbackLauncher() {
  const params = useParams<{ id: string }>();
  const discussionId = params?.id;
  const [passage, setPassage] = useState<PassageContext | null>(null);
  const [inlineHost, setInlineHost] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const updateMenuPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === "undefined") return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(MENU_WIDTH_PX, Math.max(0, window.innerWidth - MENU_GUTTER_PX * 2));
    const left = Math.min(
      Math.max(MENU_GUTTER_PX, rect.right - width),
      Math.max(MENU_GUTTER_PX, window.innerWidth - width - MENU_GUTTER_PX)
    );
    const top = Math.min(rect.bottom + 7, Math.max(MENU_GUTTER_PX, window.innerHeight - MENU_GUTTER_PX));
    const maxHeight = Math.max(160, window.innerHeight - top - MENU_GUTTER_PX);

    setMenuPosition({ left, top, width, maxHeight });
  }, []);

  useEffect(() => {
    if (!discussionId) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;

    const mountInlineHost = () => {
      if (cancelled) return { mounted: false, positionedAfterMore: false };

      const opening = document.querySelector<HTMLElement>(".discussion-v2-opening-card");
      if (!opening) return { mounted: false, positionedAfterMore: false };

      const openingActions = opening.querySelector<HTMLElement>(".discussion-v2-opening-actions");
      if (!openingActions) return { mounted: false, positionedAfterMore: false };

      let host = openingActions.querySelector<HTMLElement>(`:scope > [${INLINE_HOST_ATTR}='true']`);
      if (!host) {
        host = document.createElement("div");
        host.setAttribute(INLINE_HOST_ATTR, "true");
        host.style.position = "relative";
        host.style.flex = "0 0 auto";
        openingActions.append(host);
      }

      const moreAction = openingActions.querySelector<HTMLElement>(MORE_ACTION_SELECTOR);
      if (moreAction && moreAction.nextElementSibling !== host) {
        moreAction.insertAdjacentElement("afterend", host);
      }

      setInlineHost(host);
      return { mounted: true, positionedAfterMore: Boolean(moreAction) };
    };

    const initial = mountInlineHost();
    if (!initial.positionedAfterMore) {
      observer = new MutationObserver(() => {
        const state = mountInlineHost();
        if (state.positionedAfterMore || document.querySelector(".discussion-v2-not-found")) {
          observer?.disconnect();
          observer = null;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      setMenuOpen(false);
      document
        .querySelectorAll<HTMLElement>(`[${INLINE_HOST_ATTR}='true']`)
        .forEach((node) => node.remove());
    };
  }, [discussionId]);

  useEffect(() => {
    if (!menuOpen) return;

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;

    const reposition = () => updateMenuPosition();
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [menuOpen, updateMenuPosition]);

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

  const trigger = createPortal(
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="discussion-v2-button inline-flex items-center gap-1.5"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => {
          if (menuOpen) {
            setMenuOpen(false);
            return;
          }
          updateMenuPosition();
          setMenuOpen(true);
        }}
      >
        <Brain aria-hidden="true" size={15} />
        Knowledge
        <ChevronDown aria-hidden="true" size={14} />
      </button>
    </div>,
    inlineHost
  );

  const menu = menuOpen && menuPosition
    ? createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Library and knowledge actions"
          data-discussion-library-feedback-menu="true"
          className="fixed z-[100] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2 text-[var(--loombus-text)] shadow-xl"
          style={{
            left: menuPosition.left,
            top: menuPosition.top,
            width: menuPosition.width,
            maxHeight: menuPosition.maxHeight,
            overflowY: "auto",
          }}
        >
          <div className="grid">
            <Link
              href={`/library/research/from-reply?discussionId=${encodeURIComponent(discussionId)}`}
              role="menuitem"
              className="flex min-h-11 items-start gap-3 border-b border-[var(--loombus-border-muted)] px-2 py-2 text-left hover:bg-[var(--loombus-page-bg)]"
              onClick={() => setMenuOpen(false)}
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" />
              <span className="grid gap-0.5">
                <strong className="text-xs">From Reply</strong>
                <span className="text-[11px] leading-4 text-[var(--loombus-text-muted)]">Build private Library knowledge from a reply in this discussion.</span>
              </span>
            </Link>
            <Link
              href={`/library/research/from-discussion?discussionId=${encodeURIComponent(discussionId)}`}
              role="menuitem"
              className="flex min-h-11 items-start gap-3 px-2 py-2 text-left hover:bg-[var(--loombus-page-bg)]"
              onClick={() => setMenuOpen(false)}
            >
              <Brain className="mt-0.5 size-4 shrink-0 text-[var(--loombus-gold)]" />
              <span className="grid gap-0.5">
                <strong className="text-xs">Build Knowledge</strong>
                <span className="text-[11px] leading-4 text-[var(--loombus-text-muted)]">Build private Library knowledge from the opening post.</span>
              </span>
            </Link>
          </div>

          {passage ? (
            <section className="mt-2 border-t border-[var(--loombus-border)] px-2 pt-3" aria-label="Library source">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--loombus-gold)]">Library source</p>
                  <p className="mt-1 text-xs font-black">{passage.publicationTitle}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--loombus-text-subtle)]">
                    {passage.authorName ? `${passage.authorName} · ` : ""}
                    {passage.sectionTitle ?? "Current chapter"}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-black text-[var(--loombus-gold)]">
                  {passage.evidenceSaved ? <CheckCircle2 className="size-3" /> : <FlaskConical className="size-3" />}
                  {passage.evidenceSaved ? "Evidence saved" : "Needs evidence"}
                </span>
              </div>

              <blockquote className="mt-2 line-clamp-3 border-l-2 border-[var(--loombus-gold)] pl-2 text-[11px] leading-4 text-[var(--loombus-text-muted)]">
                “{passage.selected_text}”
              </blockquote>

              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--loombus-border-muted)] pt-2">
                <Link
                  href={libraryReaderHref(passage.publication_id, {
                    locator: passage.locator,
                    startOffset: passage.start_offset,
                    endOffset: passage.end_offset,
                    textSha256: passage.text_sha256,
                  })}
                  className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-black hover:text-[var(--loombus-gold)]"
                  onClick={() => setMenuOpen(false)}
                >
                  <BookOpen className="size-3.5 text-[var(--loombus-gold)]" />
                  Open exact source
                </Link>
                <Link
                  href="/library/research"
                  className="inline-flex min-h-9 items-center gap-1.5 text-[11px] font-black hover:text-[var(--loombus-gold)]"
                  onClick={() => setMenuOpen(false)}
                >
                  <FlaskConical className="size-3.5 text-[var(--loombus-gold)]" />
                  {passage.evidenceSaved ? "View evidence" : "Investigate"}
                </Link>
              </div>
            </section>
          ) : null}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {trigger}
      {menu}
    </>
  );
}
