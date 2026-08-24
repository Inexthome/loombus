"use client";

import { Check, FlaskConical, MessageSquareText, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  type LibraryPassageContext,
  type LibraryPassageDestination,
  writeLibraryPassageContext,
} from "@/lib/library/passage-context";
import { supabase } from "@/lib/supabase/client";

const MIN_PASSAGE_CHARS = 20;
const MAX_PASSAGE_CHARS = 1200;

type ReaderSection = {
  section_key: string;
  title: string | null;
  content_text: string;
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
  const [selection, setSelection] = useState<LibraryPassageContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savingResearch, setSavingResearch] = useState(false);
  const [researchSaved, setResearchSaved] = useState(false);
  const [researchMessage, setResearchMessage] = useState<string | null>(null);

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
      setResearchSaved(false);
      setResearchMessage(null);

      try {
        const { data: authData } = await supabase.auth.getUser();
        if (!authData.user || cancelled) return;

        const [publicationResult, progressResult] = await Promise.all([
          supabase.from("library_publications").select("title, author_name").eq("id", publicationId).eq("status", "published").single(),
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
    setResearchSaved(false);
    setResearchMessage(null);
  }

  function openTool(destination: LibraryPassageDestination, href: string) {
    if (!selection) return;
    writeLibraryPassageContext(destination, selection);
    window.location.href = href;
  }

  async function researchEvidence() {
    if (!selection || savingResearch) return;
    setSavingResearch(true);
    setResearchMessage(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setResearchMessage("Sign in again to continue this passage into Research.");
        return;
      }

      const response = await fetch("/api/library/save-to-research", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ passage: selection }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResearchMessage(payload?.error ?? "Unable to continue this passage into Research.");
        return;
      }

      setResearchSaved(true);
      setResearchMessage(payload?.duplicate ? "Passage already exists in Research. Opening it now…" : "Passage saved with source context. Opening Research…");
      writeLibraryPassageContext("research", selection);
      window.setTimeout(() => {
        window.location.href = "/library/research?from=passage";
      }, 250);
    } catch {
      setResearchMessage("Research handoff is temporarily unavailable.");
    } finally {
      setSavingResearch(false);
    }
  }

  if (!selection && !error) return null;

  return (
    <div className="fixed inset-x-4 bottom-5 z-[120] mx-auto max-w-3xl rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-[var(--loombus-text)] shadow-2xl sm:bottom-7">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-black text-[var(--loombus-gold)]">Passage → Discussion → Evidence → Knowledge</p>
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
        <div className="mt-3">
          <div className="rounded-xl bg-[var(--loombus-surface-strong)] px-3 py-2 text-xs text-[var(--loombus-text-subtle)] ring-1 ring-[var(--loombus-border)]">
            <span className="font-black text-[var(--loombus-text-muted)]">Verified source</span>
            <span> · {selection.publicationTitle}</span>
            <span> · {selection.sectionTitle ?? "Current chapter"}</span>
            <span> · characters {selection.startOffset}–{selection.endOffset}</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button type="button" onClick={() => openTool("discuss", "/library/discuss-passage")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--loombus-gold)] px-4 text-sm font-black text-black">
              <MessageSquareText className="size-4" /> Discuss passage
            </button>
            <button type="button" onClick={() => void researchEvidence()} disabled={savingResearch} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-gold)] px-4 text-sm font-black text-[var(--loombus-gold)] disabled:opacity-70">
              {researchSaved ? <Check className="size-4" /> : <FlaskConical className="size-4" />}
              {savingResearch ? "Saving source…" : "Research evidence"}
            </button>
            <button type="button" onClick={() => openTool("ask", "/library/ask-loombus")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 text-sm font-black text-[var(--loombus-text)]">
              <Sparkles className="size-4 text-[var(--loombus-gold)]" /> Ask Loombus
            </button>
          </div>

          <p className="mt-3 text-xs leading-5 text-[var(--loombus-text-subtle)]">Your exact passage, section locator, character offsets, and source hash travel with the next step. You do not need to paste the passage again.</p>
          {researchMessage ? <p className="mt-2 text-xs font-medium text-[var(--loombus-text-muted)]">{researchMessage}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
