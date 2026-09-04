"use client";

import { Check, PencilLine, SlidersHorizontal } from "lucide-react";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { type RefObject, useEffect, useRef, useState } from "react";
import CreateDiscussionComposer from "@/components/create-discussion-composer";
import { CreateAttachmentTriggerBridge } from "@/components/create-attachment-trigger-bridge";
import { CreateInfoTooltips } from "@/components/create-info-tooltips";
import { CreateInteractionHardening } from "@/components/create-interaction-hardening";
import { CreatePublishGuard } from "@/components/create-publish-guard";

const SEARCH_PLACEHOLDER = "Search discussions, topics, and contributors";
const FILTER_LABELS = ["All", "Following", "Research Questions", "Debates", "Problem Solving", "Saved"] as const;
type FilterLabel = (typeof FILTER_LABELS)[number];

function CreateTrigger({ onOpen, buttonRef }: { onOpen: () => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  return <button ref={buttonRef} type="button" onClick={onOpen} className="inline-flex size-11 items-center justify-center bg-transparent text-[color:var(--loombus-gold)] focus-visible:outline-none" aria-label="Start a discussion" aria-haspopup="dialog" title="Start a discussion"><PencilLine aria-hidden="true" className="size-5" strokeWidth={2.1} /></button>;
}

function FilterControl({ open, selected, onToggle, onSelect, controlRef }: { open: boolean; selected: FilterLabel; onToggle: () => void; onSelect: (label: FilterLabel) => void; controlRef: RefObject<HTMLDivElement | null> }) {
  return <div ref={controlRef} className="relative flex items-start"><button type="button" onClick={onToggle} className="inline-flex size-11 items-center justify-center bg-transparent text-[color:var(--loombus-text-muted)] focus-visible:outline-none" aria-label="Filter discussions" aria-haspopup="menu" aria-expanded={open} title="Filter discussions"><SlidersHorizontal aria-hidden="true" className="size-5" strokeWidth={2.1} /><span className="discussion-desktop-control-label">Filter</span></button><button type="button" className="discussion-filter-all-quick" data-selected={selected === "All" ? "true" : "false"} aria-pressed={selected === "All"} aria-label="All discussions" onClick={() => onSelect("All")}>All</button>{open ? <div role="menu" aria-label="Discussion filters" className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-2xl shadow-black/15" data-discussions-filter-menu>{FILTER_LABELS.map((label) => { const isSelected = selected === label; return <button key={label} type="button" role="menuitemradio" aria-checked={isSelected} onClick={() => onSelect(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${isSelected ? "bg-amber-50 text-[#8a6519] dark:bg-amber-400/10 dark:text-[#CBAB5B]" : "text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"}`}><span className="sr-only">Filter: </span><span className="min-w-0 flex-1">{label}</span>{isSelected ? <Check aria-hidden="true" className="h-4 w-4" /> : null}</button>; })}</div> : null}</div>;
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousComposerState = document.body.dataset.discussionsCreateOpen;
    document.body.style.overflow = "hidden";
    document.body.dataset.discussionsCreateOpen = "true";
    panelRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape" && !document.querySelector('button[aria-label="Close composer options"]')) onClose(); }
    window.addEventListener("keydown", handleKeyDown);
    return () => { window.removeEventListener("keydown", handleKeyDown); document.body.style.overflow = previousOverflow; if (previousComposerState === undefined) delete document.body.dataset.discussionsCreateOpen; else document.body.dataset.discussionsCreateOpen = previousComposerState; };
  }, [onClose]);
  return createPortal(<div className="discussions-create-modal-backdrop" data-discussions-create-modal><section ref={panelRef} className="discussions-create-modal-panel" role="dialog" aria-modal="true" aria-label="Start a discussion" tabIndex={-1}><div className="discussions-create-modal-shell"><CreatePublishGuard><CreateDiscussionComposer variant="modal" onClose={onClose} /><CreateAttachmentTriggerBridge /><CreateInfoTooltips /><CreateInteractionHardening /></CreatePublishGuard></div></section></div>, document.body);
}

export function DiscussionsCreateComposerBridge() {
  const pathname = usePathname();
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [filterSlot, setFilterSlot] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterLabel>("All");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const filterControlRef = useRef<HTMLDivElement | null>(null);
  const hiddenTabRowRef = useRef<HTMLElement | null>(null);
  const hiddenResetButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!filterOpen) return;
    function handlePointerDown(event: PointerEvent) { const target = event.target as Node | null; if (target && !filterControlRef.current?.contains(target)) setFilterOpen(false); }
    function handleKeyDown(event: KeyboardEvent) { if (event.key === "Escape") setFilterOpen(false); }
    document.addEventListener("pointerdown", handlePointerDown); window.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("pointerdown", handlePointerDown); window.removeEventListener("keydown", handleKeyDown); };
  }, [filterOpen]);

  useEffect(() => {
    if (pathname !== "/discussions") { setSlot(null); setFilterSlot(null); setOpen(false); setFilterOpen(false); setSelectedFilter("All"); hiddenTabRowRef.current = null; hiddenResetButtonRef.current = null; return; }
    let cancelled = false; let timer = 0; let searchLabel: HTMLLabelElement | null = null; let headingBlock: HTMLElement | null = null; let tabRow: HTMLElement | null = null; let resetButton: HTMLButtonElement | null = null; let composerMount: HTMLDivElement | null = null; let filterMount: HTMLDivElement | null = null;
    function locateSearchBar() {
      if (cancelled) return;
      const input = Array.from(document.querySelectorAll<HTMLInputElement>('input[type="search"]')).find((candidate) => candidate.placeholder === SEARCH_PLACEHOLDER);
      searchLabel = input?.closest("label") ?? null;
      if (!searchLabel?.parentElement) { timer = window.setTimeout(locateSearchBar, 120); return; }
      const controlsRow = searchLabel.parentElement; const feedRoot = searchLabel.closest("main"); const heading = Array.from(feedRoot?.querySelectorAll("h1") ?? []).find((candidate) => candidate.textContent?.trim() === "Discussions"); headingBlock = heading?.parentElement ?? null; resetButton = controlsRow.querySelector<HTMLButtonElement>('button[aria-label="Reset discussion filters"]'); const controlParent = controlsRow.parentElement;
      tabRow = controlParent ? (Array.from(controlParent.children).find((candidate) => { const labels = Array.from(candidate.querySelectorAll("button")).map((button) => button.textContent?.trim() ?? ""); return FILTER_LABELS.every((label) => labels.includes(label)); }) as HTMLElement | undefined) ?? null : null;
      if (!resetButton || !tabRow) { timer = window.setTimeout(locateSearchBar, 120); return; }
      searchLabel.hidden = true; searchLabel.setAttribute("aria-hidden", "true"); if (headingBlock) { headingBlock.hidden = true; headingBlock.setAttribute("aria-hidden", "true"); } tabRow.hidden = true; tabRow.setAttribute("aria-hidden", "true"); resetButton.hidden = true; resetButton.setAttribute("aria-hidden", "true"); hiddenTabRowRef.current = tabRow; hiddenResetButtonRef.current = resetButton;
      composerMount = document.createElement("div"); composerMount.dataset.discussionsCreateTriggerSlot = "true"; composerMount.className = "shrink-0"; searchLabel.insertAdjacentElement("afterend", composerMount); filterMount = document.createElement("div"); filterMount.dataset.discussionsFilterSlot = "true"; filterMount.className = "shrink-0"; controlsRow.append(filterMount); setSlot(composerMount); setFilterSlot(filterMount);
    }
    locateSearchBar();
    return () => { cancelled = true; window.clearTimeout(timer); setSlot(null); setFilterSlot(null); setOpen(false); setFilterOpen(false); setSelectedFilter("All"); hiddenTabRowRef.current = null; hiddenResetButtonRef.current = null; composerMount?.remove(); filterMount?.remove(); if (searchLabel) { searchLabel.hidden = false; searchLabel.removeAttribute("aria-hidden"); } if (headingBlock) { headingBlock.hidden = false; headingBlock.removeAttribute("aria-hidden"); } if (tabRow) { tabRow.hidden = false; tabRow.removeAttribute("aria-hidden"); } if (resetButton) { resetButton.hidden = false; resetButton.removeAttribute("aria-hidden"); } };
  }, [pathname]);

  function closeModal() { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0); }
  function selectFilter(label: FilterLabel) { if (label === "All") hiddenResetButtonRef.current?.click(); else Array.from(hiddenTabRowRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []).find((button) => button.textContent?.trim() === label)?.click(); setSelectedFilter(label); setFilterOpen(false); }
  return <>{slot ? createPortal(<CreateTrigger buttonRef={triggerRef} onOpen={() => setOpen(true)} />, slot) : null}{filterSlot ? createPortal(<FilterControl open={filterOpen} selected={selectedFilter} onToggle={() => setFilterOpen((current) => !current)} onSelect={selectFilter} controlRef={filterControlRef} />, filterSlot) : null}{open ? <CreateModal onClose={closeModal} /> : null}</>;
}
