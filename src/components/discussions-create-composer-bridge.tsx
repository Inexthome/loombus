"use client";

import { PencilLine, Plus, Sparkles } from "lucide-react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { type RefObject, useEffect, useRef, useState } from "react";
import CreateDiscussionComposer from "@/components/create-discussion-composer";
import { CreatePublishGuard } from "@/components/create-publish-guard";

const SEARCH_PLACEHOLDER = "Search discussions, topics, and contributors";

function CreateTrigger({
  onOpen,
  buttonRef,
}: {
  onOpen: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className="group flex h-14 w-full items-center gap-3 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-3 text-left shadow-sm transition hover:border-amber-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-200/60"
      aria-haspopup="dialog"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 text-[#9a701c] transition group-hover:bg-amber-100 dark:bg-amber-400/10 dark:text-[#d6a84f]">
        <PencilLine aria-hidden="true" className="size-5" strokeWidth={2.1} />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold text-[color:var(--loombus-text)] sm:text-base">
          Start a discussion, ask a question, or share an idea…
        </strong>
        <span className="hidden truncate text-xs font-medium text-[color:var(--loombus-text-muted)] sm:block">
          Choose a topic and discussion mode when the composer opens.
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        <span className="grid size-9 place-items-center rounded-full border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)]">
          <Sparkles aria-hidden="true" className="size-4" />
        </span>
        <span className="grid size-9 place-items-center rounded-full bg-[color:var(--loombus-primary-bg)] text-[color:var(--loombus-primary-text)]">
          <Plus aria-hidden="true" className="size-4" />
        </span>
      </span>
    </button>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        !document.querySelector('button[aria-label="Close composer options"]')
      ) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div className="discussions-create-modal-backdrop" data-discussions-create-modal>
      <section
        ref={panelRef}
        className="discussions-create-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Start a discussion"
        tabIndex={-1}
      >
        <div className="discussions-create-modal-shell">
          <CreatePublishGuard>
            <CreateDiscussionComposer variant="modal" onClose={onClose} />
          </CreatePublishGuard>
        </div>
      </section>
    </div>,
    document.body
  );
}

export function DiscussionsCreateComposerBridge() {
  const pathname = usePathname();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (pathname !== "/discussions") {
      setSlot(null);
      setOpen(false);
      return;
    }

    let cancelled = false;
    let timer = 0;
    let searchLabel: HTMLLabelElement | null = null;
    let mount: HTMLDivElement | null = null;

    function locateSearchBar() {
      if (cancelled) return;
      const input = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="search"]')
      ).find((candidate) => candidate.placeholder === SEARCH_PLACEHOLDER);
      searchLabel = input?.closest("label") ?? null;

      if (!searchLabel?.parentElement) {
        timer = window.setTimeout(locateSearchBar, 120);
        return;
      }

      searchLabel.hidden = true;
      searchLabel.setAttribute("aria-hidden", "true");
      mount = document.createElement("div");
      mount.dataset.discussionsCreateTriggerSlot = "true";
      mount.className = "min-w-0 flex-1";
      searchLabel.insertAdjacentElement("afterend", mount);
      setSlot(mount);
    }

    locateSearchBar();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setSlot(null);
      setOpen(false);
      mount?.remove();
      if (searchLabel) {
        searchLabel.hidden = false;
        searchLabel.removeAttribute("aria-hidden");
      }
    };
  }, [pathname]);

  function closeModal() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  return (
    <>
      {slot
        ? createPortal(
            <CreateTrigger buttonRef={triggerRef} onOpen={() => setOpen(true)} />,
            slot
          )
        : null}
      {open ? <CreateModal onClose={closeModal} /> : null}
    </>
  );
}
