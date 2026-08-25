"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";

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
    mobileControls.style.position = "fixed";
    mobileControls.style.bottom = "calc(env(safe-area-inset-bottom, 0px) + 5.75rem)";
    mobileControls.style.right = "1.25rem";
  }

  const selectionToolbar = findSelectionToolbar();
  if (selectionToolbar && reader.contains(selectionToolbar)) {
    selectionToolbar.style.position = "fixed";
    selectionToolbar.style.left = "50%";
    selectionToolbar.style.transform = "translateX(-50%)";
    selectionToolbar.style.bottom = window.innerWidth < 768
      ? "calc(env(safe-area-inset-bottom, 0px) + 7.25rem)"
      : "1.5rem";
    selectionToolbar.style.maxHeight = window.innerWidth < 768 ? "calc(100dvh - 10rem)" : "calc(100dvh - 3rem)";
    selectionToolbar.style.overflowY = "auto";
    selectionToolbar.style.zIndex = "120";
  }

  const contentsButton = Array.from(reader.querySelectorAll<HTMLButtonElement>("button")).find((button) => button.textContent?.trim().startsWith("Contents ·"));
  const mobileSheet = contentsButton?.parentElement;
  if (mobileSheet) {
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
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) {
          background: #000 !important;
          color: #f4f1ea !important;
        }
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) article {
          background: #090909 !important;
          color: #f4f1ea !important;
          box-shadow: 0 14px 45px rgb(0 0 0 / 0.38) !important;
        }
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) header,
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) header a,
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) header button {
          color: #f4f1ea !important;
        }
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) aside {
          background: rgb(28 28 30 / 0.97) !important;
          color: #f4f1ea !important;
          border-color: rgb(255 255 255 / 0.12) !important;
        }
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) aside input,
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) aside textarea,
        body[data-library-reader-resolved="dark"] main:has([data-library-reader-page]) aside button {
          border-color: rgb(255 255 255 / 0.14) !important;
        }
        body[data-library-reader-resolved="light"] main:has([data-library-reader-page]) {
          color-scheme: light;
        }
        [data-library-reader-page]::-webkit-scrollbar { display: none; }
        @media (max-width: 767px) {
          body.loombus-reader-paginated main:has([data-library-reader-page]) {
            padding-bottom: env(safe-area-inset-bottom, 0px);
          }
        }
      `}</style>
    </>
  );
}
