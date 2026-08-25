"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

type ReaderDisplayMode = "system" | "light" | "dark";
type GestureStart = { x: number; y: number; pointerId?: number };

const DISPLAY_MODE_KEY = "loombus-library-reader-display-mode";
const SWIPE_THRESHOLD = 42;
const SWIPE_COOLDOWN_MS = 360;

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
  const highlightButton = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (button) => button.textContent?.trim() === "Highlight",
  );
  if (!highlightButton) return null;

  const required = ["Highlight", "Note", "Discuss", "Research", "Ask"];
  let current: HTMLElement | null = highlightButton.parentElement;
  while (current && current !== document.body) {
    const labels = Array.from(current.querySelectorAll<HTMLButtonElement>("button")).map((button) => button.textContent?.trim() ?? "");
    if (required.every((label) => labels.includes(label))) return current;
    current = current.parentElement;
  }
  return null;
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
  reader.style.touchAction = "pan-y pinch-zoom";

  addNativeTooltips(reader);

  reader.querySelectorAll<HTMLElement>("[data-library-reader-page]").forEach((text) => {
    text.style.maxHeight = "100%";
    text.style.overflowY = text.scrollHeight > text.clientHeight + 2 ? "auto" : "hidden";
    text.style.overscrollBehavior = "contain";
    text.style.scrollbarWidth = "none";
    text.style.touchAction = "pan-y pinch-zoom";
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
    selectionToolbar.style.left = window.innerWidth < 768 ? "50vw" : "50%";
    selectionToolbar.style.right = "auto";
    selectionToolbar.style.top = "auto";
    selectionToolbar.style.transform = "translateX(-50%)";
    selectionToolbar.style.bottom = window.innerWidth < 768
      ? "calc(env(safe-area-inset-bottom, 0px) + 7.25rem)"
      : "1.25rem";
    selectionToolbar.style.width = window.innerWidth < 768 ? "calc(100vw - 1.25rem)" : "max-content";
    selectionToolbar.style.maxWidth = window.innerWidth < 768 ? "22rem" : "min(42rem, calc(100vw - 2rem))";
    selectionToolbar.style.maxHeight = window.innerWidth < 768 ? "calc(100dvh - 10rem)" : "calc(100dvh - 2.5rem)";
    selectionToolbar.style.overflowY = "auto";
    selectionToolbar.style.overflowX = "hidden";
    selectionToolbar.style.zIndex = "120";
  }

  const contentsButton = Array.from(reader.querySelectorAll<HTMLButtonElement>("button")).find((button) =>
    button.textContent?.trim().startsWith("Contents ·"),
  );
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

function gestureBlocked(target: HTMLElement | null) {
  return Boolean(target?.closest('aside,[data-library-reader-selection-toolbar="true"],[data-library-reader-mobile-sheet="true"],button,a,input,textarea'));
}

function readerForTarget(target: EventTarget | null) {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-library-reader-root="true"]') : null;
}

function triggerPageTurn(reader: HTMLElement, direction: "next" | "previous") {
  const label = direction === "next" ? "Next page" : "Previous page";
  const control = reader.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  if (!control || control.disabled) return false;
  control.click();
  return true;
}

export function LibraryReaderRuntimeGuardrails() {
  const [displayMode, setDisplayMode] = useState<ReaderDisplayMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [appearancePanel, setAppearancePanel] = useState<HTMLElement | null>(null);
  const touchStart = useRef<GestureStart | null>(null);
  const pointerStart = useRef<GestureStart | null>(null);
  const lastSwipeAt = useRef(0);

  useEffect(() => {
    setDisplayMode(readDisplayMode());
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const resolvedDark = useMemo(
    () => displayMode === "dark" || (displayMode === "system" && systemDark),
    [displayMode, systemDark],
  );

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_MODE_KEY, displayMode);
    document.body.dataset.libraryReaderDisplay = displayMode;
    document.body.dataset.libraryReaderResolved = resolvedDark ? "dark" : "light";
  }, [displayMode, resolvedDark]);

  useEffect(() => {
    function canTurn(dx: number, dy: number) {
      return Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.15;
    }

    function performSwipe(target: EventTarget | null, dx: number, dy: number) {
      if (!canTurn(dx, dy)) return false;
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) return false;
      const reader = readerForTarget(target);
      if (!reader) return false;
      const now = Date.now();
      if (now - lastSwipeAt.current < SWIPE_COOLDOWN_MS) return false;
      const turned = triggerPageTurn(reader, dx < 0 ? "next" : "previous");
      if (turned) lastSwipeAt.current = now;
      return turned;
    }

    function onTouchStart(event: TouchEvent) {
      const target = event.target as HTMLElement | null;
      if (!readerForTarget(target) || gestureBlocked(target)) {
        touchStart.current = null;
        return;
      }
      const touch = event.touches[0];
      touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }

    function onTouchEnd(event: TouchEvent) {
      const start = touchStart.current;
      touchStart.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch) return;
      if (performSwipe(event.target, touch.clientX - start.x, touch.clientY - start.y)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!event.isPrimary || !readerForTarget(target) || gestureBlocked(target)) {
        pointerStart.current = null;
        return;
      }
      if (event.pointerType === "mouse" && window.innerWidth >= 768) {
        pointerStart.current = null;
        return;
      }
      pointerStart.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    }

    function onPointerUp(event: PointerEvent) {
      const start = pointerStart.current;
      pointerStart.current = null;
      if (!start || (start.pointerId !== undefined && start.pointerId !== event.pointerId)) return;
      if (performSwipe(event.target, event.clientX - start.x, event.clientY - start.y)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    function onWheel(event: WheelEvent) {
      const target = event.target as HTMLElement | null;
      if (!readerForTarget(target) || gestureBlocked(target)) return;
      if (Math.abs(event.deltaX) < SWIPE_THRESHOLD || Math.abs(event.deltaX) <= Math.abs(event.deltaY) * 1.1) return;
      if (performSwipe(event.target, -event.deltaX, 0)) event.preventDefault();
    }

    document.addEventListener("touchstart", onTouchStart, { capture: true, passive: true });
    document.addEventListener("touchend", onTouchEnd, { capture: true, passive: false });
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });

    return () => {
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("touchend", onTouchEnd, true);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("wheel", onWheel, true);
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

  const displayControls = appearancePanel
    ? createPortal(
        <section className="mt-6 border-t border-black/10 pt-5" aria-label="Reader display mode">
          <div className="text-xs font-bold uppercase tracking-[0.12em] opacity-55">Display</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDisplayMode(mode)}
                aria-pressed={displayMode === mode}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold capitalize ${
                  displayMode === mode ? "border-[#b88a1e] bg-[#f3cf66]/20" : "border-black/10"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs opacity-50">System follows the device light/dark appearance.</p>
        </section>,
        appearancePanel,
      )
    : null;

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
        [data-library-reader-root="true"],
        [data-library-reader-page] {
          touch-action: pan-y pinch-zoom;
          overscroll-behavior-x: contain;
        }

        @media (max-width: 767px) {
          body.loombus-reader-paginated [data-library-reader-root="true"] {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
          [data-library-reader-selection-toolbar="true"] {
            left: 50vw !important;
            right: auto !important;
            width: calc(100vw - 1.25rem) !important;
            max-width: 22rem !important;
            transform: translateX(-50%) !important;
          }
          [data-library-reader-selection-toolbar="true"] > div:first-child {
            width: 100% !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            justify-content: stretch !important;
            gap: 0.2rem !important;
          }
          [data-library-reader-selection-toolbar="true"] > div:first-child > button {
            width: 100% !important;
            min-height: 2.25rem !important;
            padding: 0.35rem 0.2rem !important;
            font-size: 0.78rem !important;
            gap: 0.25rem !important;
          }
          [data-library-reader-selection-toolbar="true"] > div:first-child > button svg {
            width: 0.9rem !important;
            height: 0.9rem !important;
          }
        }
      `}</style>
    </>
  );
}
