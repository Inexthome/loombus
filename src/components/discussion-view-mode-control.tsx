"use client";

import { ChevronDown, LayoutList, Rows3 } from "lucide-react";
import { usePathname } from "next/navigation";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DiscussionViewMode = "card" | "compact";

const STORAGE_KEY = "loombus:discussions:view-mode:v1";

export function DiscussionViewModeControl() {
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState<DiscussionViewMode>("card");
  const [preferenceReady, setPreferenceReady] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cardOptionRef = useRef<HTMLButtonElement>(null);
  const compactOptionRef = useRef<HTMLButtonElement>(null);
  const viewLabel = viewMode === "card" ? "Card" : "Compact";

  useEffect(() => {
    const route = document.querySelector<HTMLElement>(".discussion-feed-route");

    if (pathname !== "/discussions") {
      route?.removeAttribute("data-discussion-view");
      setHost(null);
      setPreferenceReady(false);
      return;
    }

    setPreferenceReady(false);

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "compact" || saved === "card") {
        setViewMode(saved);
      }
    } catch {
      // Keep Card as the safe default when browser storage is unavailable.
    } finally {
      setPreferenceReady(true);
    }

    let cancelled = false;
    let timer = 0;
    let mount: HTMLDivElement | null = null;

    function locateFeed() {
      if (cancelled) return;

      const feed = document.querySelector<HTMLElement>(
        '.discussion-feed-route main section.min-w-0 > .space-y-5'
      );

      if (!feed?.parentElement) {
        timer = window.setTimeout(locateFeed, 120);
        return;
      }

      mount = document.createElement("div");
      mount.dataset.discussionViewControlSlot = "true";
      feed.parentElement.insertBefore(mount, feed);
      setHost(mount);
    }

    locateFeed();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setHost(null);
      mount?.remove();
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/discussions") return;
    const route = document.querySelector<HTMLElement>(".discussion-feed-route");
    route?.setAttribute("data-discussion-view", viewMode);

    if (!preferenceReady) return;

    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // View switching still works for the current visit without persistence.
    }
  }, [pathname, preferenceReady, viewMode]);

  useEffect(() => {
    if (!menuOpen) return;

    const selectedOption = viewMode === "card" ? cardOptionRef.current : compactOptionRef.current;
    window.requestAnimationFrame(() => selectedOption?.focus());

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, viewMode]);

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;

    event.preventDefault();
    const options = [cardOptionRef.current, compactOptionRef.current].filter(
      (option): option is HTMLButtonElement => Boolean(option)
    );
    if (options.length === 0) return;

    if (event.key === "Home") {
      options[0]?.focus();
      return;
    }

    if (event.key === "End") {
      options[options.length - 1]?.focus();
      return;
    }

    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex === -1
      ? 0
      : (currentIndex + direction + options.length) % options.length;
    options[nextIndex]?.focus();
  }

  function selectView(nextView: DiscussionViewMode) {
    setViewMode(nextView);
    setMenuOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  if (pathname !== "/discussions" || !host) return null;

  return createPortal(
    <div className="discussion-view-control" ref={menuRef}>
      <button
        ref={triggerRef}
        type="button"
        className="discussion-view-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? "discussion-view-menu" : undefined}
        aria-label={`Discussion view: ${viewLabel}`}
        onClick={() => setMenuOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setMenuOpen(true);
          }
        }}
      >
        <span>{viewLabel}</span>
        <ChevronDown aria-hidden="true" size={13} />
      </button>

      {menuOpen ? (
        <div
          id="discussion-view-menu"
          className="discussion-view-menu"
          role="menu"
          aria-label="Discussion view"
          onKeyDown={handleMenuKeyDown}
        >
          <button
            ref={cardOptionRef}
            type="button"
            role="menuitemradio"
            aria-checked={viewMode === "card"}
            className={viewMode === "card" ? "is-selected" : undefined}
            onClick={() => selectView("card")}
          >
            <LayoutList aria-hidden="true" size={16} />
            <span><strong>Card</strong><small>More context and media</small></span>
          </button>
          <button
            ref={compactOptionRef}
            type="button"
            role="menuitemradio"
            aria-checked={viewMode === "compact"}
            className={viewMode === "compact" ? "is-selected" : undefined}
            onClick={() => selectView("compact")}
          >
            <Rows3 aria-hidden="true" size={16} />
            <span><strong>Compact</strong><small>More discussions at once</small></span>
          </button>
        </div>
      ) : null}
    </div>,
    host
  );
}
