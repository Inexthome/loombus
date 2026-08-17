"use client";

import { MessageSquareText, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const DISCUSS_PASSAGE_STORAGE_KEY = "loombus:library:discuss-passage:v1";
const ASK_LOOMBUS_STORAGE_KEY = "loombus:library:ask-loombus:v1";
const MIN_PASSAGE_CHARS = 20;
const MAX_PASSAGE_CHARS = 1200;

type ReaderSection = {
  section_key: string;
  title: string | null;
  content_text: string;
};

type PassageSelection = {
  publicationId: string;
  publicationTitle: string;
  authorName: string | null;
  locator: string;
  sectionTitle: string | null;
  selectedText: string;
  startOffset: number;
  endOffset: number;
  textSha256: string;
  capturedAt: string;
};

async function sha256Text(value: string): Promise<string> {
  const digest = await window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function textOffsetWithin(container: HTMLElement, node: Node, offset: number): number {
  const range = document.createRange();
  range.selectNodeContents(container);
  range.setEnd(node, offset);
  return range.toString().length;
}

function findExactTextContainer(start: Node, end: Node, expectedText: string): HTMLElement | null {
  let current = start.nodeType === Node.ELEMENT_NODE ? (start as HTMLElement) : start.parentElement;
  while (current) {
    if (current.contains(end) && current.textContent === expectedText) return current;
    current = current.parentElement;
  }
  return null;
}

export function LibraryDiscussPassageLauncher({ publicationId }: { publicationId: string }) {
  const captureInFlight = useRef(false);
  const [selection, setSelection] = useState<PassageSelection | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function capture() {
      if (captureInFlight.current) return;
      const browserSelection = window.getSelection();
      if (!browserSelection || browserSelection.rangeCount !== 1 || browserSelection.isCollapsed) return;

      const range = browserSelection.getRangeAt(0);
      const raw = range.toString();
      const trimmed = raw.trim();
      if (!trimmed) return;

      captureInFlight.current = true;
      setError(null);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user || cancelled) return;

        const [publicationResult, progressResult] = await Promise.all([
          supabase.from("library_publications").select("title, author_name").eq("id", publicationId).single(),
          supabase.from("library_reading_progress").select("locator").eq("publication_id", publicationId).maybeSingle(),
        ]);

        const locator = progressResult.data?.locator as string | null | undefined;
        if (publicationResult.error || !publicationResult.data || !locator || cancelled) return;

        const sectionResult = await supabase
          .from("library_publication_sections")
          .select("section_key, title, content_text")
          .eq("publication_id", publicationId)
          .eq("section_key", locator)
          .single();

        if (sectionResult.error || !sectionResult.data || cancelled) return;
        const section = sectionResult.data as ReaderSection;
        const container = findExactTextContainer(range.startContainer, range.endContainer, section.content_text);
        if (!container) return;

        const leadingWhitespace = raw.length - raw.trimStart().length;
        const startOffset = textOffsetWithin(container, range.startContainer, range.startOffset) + leadingWhitespace;
        const endOffset = startOffset + trimmed.length;

        if (section.content_text.slice(startOffset, endOffset) !== trimmed) return;
        if (trimmed.length < MIN_PASSAGE_CHARS) {
          setSelection(null);
          setError(`Select at least ${MIN_PASSAGE_CHARS} characters to use passage tools.`);
          return;
        }
        if (trimmed.length > MAX_PASSAGE_CHARS) {
          setSelection(null);
          setError(`Passage tools are limited to ${MAX_PASSAGE_CHARS} selected characters.`);
          return;
        }

        const textSha256 = await sha256Text(section.content_text);
        if (cancelled) return;

        setSelection({
          publicationId,
          publicationTitle: publicationResult.data.title,
          authorName: publicationResult.data.author_name,
          locator: section.section_key,
          sectionTitle: section.title,
          selectedText: trimmed,
          startOffset,
          endOffset,
          textSha256,
          capturedAt: new Date().toISOString(),
        });
      } finally {
        captureInFlight.current = false;
      }
    }

    function handleSelectionEnd() {
      window.setTimeout(() => void capture(), 0);
    }

    document.addEventListener("mouseup", handleSelectionEnd);
    document.addEventListener("touchend", handleSelectionEnd);
    return () => {
      cancelled = true;
      document.removeEventListener("mouseup", handleSelectionEnd);
      document.removeEventListener("touchend", handleSelectionEnd);
    };
  }, [publicationId]);

  function dismiss() {
    setSelection(null);
    setError(null);
  }

  function openTool(storageKey: string, href: string) {
    if (!selection) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(selection));
    window.location.href = href;
  }

  if (!selection && !error) return null;

  return (
    <div className="fixed inset-x-4 bottom-5 z-[120] mx-auto max-w-2xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-[var(--loombus-text)] shadow-2xl sm:bottom-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--loombus-gold)]">Passage tools</p>
          {selection ? (
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">“{selection.selectedText}”</p>
          ) : (
            <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{error}</p>
          )}
        </div>
        <button type="button" onClick={dismiss} aria-label="Dismiss passage tools" className="grid size-9 shrink-0 place-items-center rounded-full border border-[var(--loombus-border)] text-[var(--loombus-text-muted)]">
          <X className="size-4" />
        </button>
      </div>
      {selection ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[var(--loombus-text-subtle)]">{selection.sectionTitle ?? "Current chapter"} · {selection.selectedText.length} characters</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openTool(ASK_LOOMBUS_STORAGE_KEY, "/library/ask-loombus")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[var(--loombus-gold)] px-4 text-sm font-black text-[var(--loombus-gold)]">
              <Sparkles className="size-4" /> Ask Loombus
            </button>
            <button type="button" onClick={() => openTool(DISCUSS_PASSAGE_STORAGE_KEY, "/library/discuss-passage")} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-4 text-sm font-black text-black">
              <MessageSquareText className="size-4" /> Discuss passage
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
