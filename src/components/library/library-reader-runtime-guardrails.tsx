"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

type ReaderDisplayMode = "system" | "light" | "dark";

const DISPLAY_MODE_KEY = "loombus-library-reader-display-mode";

function readDisplayMode(): ReaderDisplayMode {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(DISPLAY_MODE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

function findAppearancePanel(): HTMLElement | null {
  const asides = Array.from(document.querySelectorAll<HTMLElement>("aside"));
  return asides.find((aside) => aside.querySelector("h2")?.textContent?.trim() === "Themes & Settings") ?? null;
}

function findSelectionToolbar(): HTMLElement | null {
  const highlightButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim() === "Highlight");
  if (!highlightButton) return null;
  let current: HTMLElement | null = highlightButton.parentElement;
  while (current && !current.querySelector("button")) current = current.parentElement;
  return current?.parentElement ?? current;
}

function addNativeTooltips(root: ParentNode) {
  root.querySelectorAll<HTMLElement>("button[aria-label], a[aria-label]").forEach((control) => {
    if (!control.getAttribute("title")) {
      const label = control.getAttribute("aria-label");
      if (label) control.setAttribute("title", label);
    }
  });
}

function protectReaderViewport() {
  const page = document.querySelector<HTMLElement>("[data-library-reader-page]");
  const reader = page?.closest<HTMLElement>("main");
  if (!reader) return;

  reader.dataset.libraryReaderRoot = "true";
  reader.style.position = "fixed";
  reader.style.inset = "0";
  reader.style.width = "100vw";
  reader.style.height = "100dvh";
  reader.style.zIndex = "80";

  addNativeTooltips(reader);

  reader.querySelectorAll<HTMLElement>("[data-library-reader-page]").forEach((text) => {
    text.style.maxHeight = "100%";
    text.style.overflowY = text.scrollHeight > text.clientHeight + 2 ? "auto" : "hidden";
    text.style.overscrollBehavior = "contain";
    text.style.scrollbarWidth = "none";
  });

  const mobileControls = reader.querySelector<HTMLElement>('[aria-label="Reader controls"]');
  if (mobileControls) {
    mobileControls.dataset.libraryReaderMobileTrigger = "true";
    mobileControls.style.position = "fixed";
    mobileControls.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 5.75rem)";
    mobileControls.style.right = "1.25rem";
  }

  const selectionToolbar = findSelectionToolbar();
  if (selectionToolbar && reader.contains(selectionToolbar)) {
    selectionToolbar.dataset.libraryReaderSelectionToolbar = "true";
    selectionToolbar.style.position = "fixed";
    selectionToolbar.style.left = "50%";
    selectionToolbar.style.right = "auto";
    selectionToolbar.style.top = "auto";
    selectionToolbar.style.transform = "translateX(-50%)";
    selectionToolbar.style.bottom = window.innerWidth < 768
      ? "calc(env(safe-area-inset-bottom, 0px) + 8.25rem)"
      : "1.25rem";
    selectionToolbar.style.width = window.innerWidth < 768 ? "calc(100vw - 1rem)" : "max-content";
    selectionToolbar.style.maxWidth = window.innerWidth < 768 ? "24rem" : "min(42rem, calc(100vw - 2rem))";
    selectionToolbar.style.maxHeight = window.innerWidth < 768 ? "calc(100dvh - 11rem)" : "calc(100dvh - 2.5rem)";
    selectionToolbar.style.overflowY = "auto";
    selectionToolbar.style.zIndex = "120";
  }

  const contentsButton = Array.from(reader.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim().startsWith("Contents ·"));
  const mobileSheet = contentsButton?.parentElement;
  if (mobileSheet) {
    mobileSheet.dataset.libraryReaderMobileSheet = "true";
    mobileSheet.style.position = "fixed";
    mobileSheet.style.left = "0.75rem";
    mobileSheet.style.right = "0.75rem";
    mobileSheet.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 7.5rem)";
    mobileSheet.style.maxHeight = "calc(100dvh - 9rem)";
    mobileSheet.style.overflowY = "auto";
  }
}

export function LibraryReaderRuntimeGuardrails() {
  const [displayMode, setDisplayMode] = useState<ReaderDisplayMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [appearancePanel, setAppearancePanel] = useState<HTMLElement | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setDisplayMode(readDisplayMode());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const resolvedDark = useMemo(() => displayMode === "dark" || (displayMode === "system" && systemDark), [displayMode, systemDark]);

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
    document.body.dataset.libraryReaderDisplay = displayMode;
    document.body.dataset.libraryReaderResolved = resolvedDark ? "dark" : "light";
  }, [displayMode, resolvedDark]);

  useEffect(() => {
    function onTouchStart(event: TouchEvent) {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-library-reader-root="true"]')) return;
      if (target.closest('aside,[data-library-reader-selection-toolbar="true"],[data-library-reader-mobile-sheet="true"],button,a,input,textarea')) {
        swipeStart.current = null;
        return;
      }
      const touch = event.touches[0];
      swipeStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    function onTouchEnd(event: TouchEvent) {
      const start = swipeStart.current;
      swipeStart.current = null;
      if (!start) return;
      const target = event.target as HTMLElement | null;
      const reader = target?.closest<HTMLElement>('[data-library-reader-root="true"]');
      if (!reader) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      if (Math.abs(dx) < 44 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const direction = dx < 0 ? "Next page" : "Previous page";
      const control = reader.querySelector<HTMLButtonElement>(`button[aria-label="${direction}"]`);
      if (control && !control.disabled) control.click();
    }

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchend", onTouchEnd, true);
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setAppearancePanel(findAppearancePanel());
        protectReaderViewport();
      });
    };

    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style"] });
    const resizeObserver = new ResizeObserver(sync);
    resizeObserver.observe(document.documentElement);
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    sync();

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      delete document.body.dataset.libraryReaderDisplay;
      delete document.body.dataset.libraryReaderResolved;
    };
  }, []);

  const displayControls = appearancePanel ? createPortal(
    <section className="mt-6 border-t border-black/10 pt-5" aria-label="Reader display mode">
      <div className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Display</div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {(["system", "light", "dark"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setDisplayMode(mode)}
            aria-pressed={displayMode === mode}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${displayMode === mode ? "border-[#b88a1e] bg-[#f3cf66]/20" : "border-black/10"}`}
          >
            {mode}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs opacity-50">System follows the device light/dark appearance.</p>
    </section>,
    appearancePanel,
  ) : null;

  return (
    <>
      {displayControls}
      <style jsx global>{`
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] {
          color-scheme: light;
          background: #fffdf8 !important;
          color: #231f19 !important;
        }
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] article {
          background: #ffffff !important;
          color: #231f19 !important;
          box-shadow: 0 14px 45px rgb(0 0 0 / 0.08) !important;
        }
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] [data-library-reader-page],
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] [data-library-reader-page] span,
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] [data-library-reader-page] mark {
          color: #231f19 !important;
        }
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] header,
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] header a,
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] header button {
          color: #231f19 !important;
        }
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] aside {
          background: rgb(255 255 255 / 0.97) !important;
          color: #211f1a !important;
          border-color: rgb(0 0 0 / 0.10) !important;
        }
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] aside input,
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] aside textarea,
        body[data-library-reader-resolved="light"] [data-library-reader-root="true"] aside button {
          color: #211f1a !important;
          border-color: rgb(0 0 0 / 0.10) !important;
        }

        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] {
          color-scheme: dark;
          background: #000000 !important;
          color: #f4f1ea !important;
        }
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] article {
          background: #090909 !important;
          color: #f4f1ea !important;
          box-shadow: 0 14px 45px rgb(0 0 0 / 0.38) !important;
        }
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] [data-library-reader-page],
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] [data-library-reader-page] span,
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] [data-library-reader-page] mark {
          color: #f4f1ea !important;
        }
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] header,
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] header a,
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] header button {
          color: #f4f1ea !important;
        }
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] aside {
          background: rgb(28 28 30 / 0.97) !important;
          color: #f4f1ea !important;
          border-color: rgb(255 255 255 / 0.12) !important;
        }
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] aside input,
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] aside textarea,
        body[data-library-reader-resolved="dark"] [data-library-reader-root="true"] aside button {
          color: #f4f1ea !important;
          border-color: rgb(255 255 255 / 0.14) !important;
        }

        [data-library-reader-selection-toolbar="true"] {
          background: rgb(36 36 36 / 0.98) !important;
          color: #ffffff !important;
          border-color: rgb(255 255 255 / 0.12) !important;
          margin: 0 !important;
          padding: 0.375rem !important;
          border-radius: 1rem !important;
          box-sizing: border-box !important;
        }
        [data-library-reader-selection-toolbar="true"] > div:first-child {
          display: grid !important;
          grid-template-columns: repeat(5, minmax(0, auto)) !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 0.125rem !important;
        }
        [data-library-reader-selection-toolbar="true"] > div:first-child > button {
          min-width: 0 !important;
          min-height: 2.5rem !important;
          padding-left: 0.7rem !important;
          padding-right: 0.7rem !important;
          white-space: nowrap !important;
        }
        [data-library-reader-selection-toolbar="true"] button,
        [data-library-reader-selection-toolbar="true"] input,
        [data-library-reader-selection-toolbar="true"] svg {
          color: #ffffff !important;
          stroke: currentColor !important;
        }
        [data-library-reader-selection-toolbar="true"] input {
          background: rgb(255 255 255 / 0.10) !important;
        }

        [data-library-reader-mobile-sheet="true"] > button,
        [data-library-reader-mobile-sheet="true"] > div > button,
        [data-library-reader-mobile-sheet="true"] > div > a {
          background: rgb(58 58 60 / 0.98) !important;
          color: #ffffff !important;
        }
        [data-library-reader-mobile-sheet="true"] button *,
        [data-library-reader-mobile-sheet="true"] a *,
        [data-library-reader-mobile-sheet="true"] svg,
        [data-library-reader-mobile-trigger="true"],
        [data-library-reader-mobile-trigger="true"] svg {
          color: #ffffff !important;
          stroke: currentColor !important;
        }
        [data-library-reader-mobile-trigger="true"] {
          background: rgb(36 36 36 / 0.98) !important;
          border-color: rgb(255 255 255 / 0.12) !important;
        }

        body[data-library-reader-resolved="dark"] [data-library-reader-mobile-sheet="true"] > button,
        body[data-library-reader-resolved="dark"] [data-library-reader-mobile-sheet="true"] > div > button,
        body[data-library-reader-resolved="dark"] [data-library-reader-mobile-sheet="true"] > div > a {
          background: rgb(44 44 46 / 0.98) !important;
        }

        [data-library-reader-page]::-webkit-scrollbar { display: none; }
        [data-library-reader-root="true"] { touch-action: pan-y pinch-zoom; overscroll-behavior-x: contain; }

        @media (max-width: 767px) {
          body.loombus-reader-paginated [data-library-reader-root="true"] {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          [data-library-reader-selection-toolbar="true"] > div:first-child {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 0.2rem !important;
          }
          [data-library-reader-selection-toolbar="true"] > div:first-child > button {
            min-height: 2.35rem !important;
            padding-left: 0.35rem !important;
            padding-right: 0.35rem !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </>
  );
}
