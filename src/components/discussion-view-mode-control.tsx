"use client";

import { LayoutList, Rows3, ChevronDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type DiscussionViewMode = "card" | "compact";

const STORAGE_KEY = "loombus:discussions:view-mode:v1";

export function DiscussionViewModeControl() {
  const pathname = usePathname();
  const [viewMode, setViewMode] = useState<DiscussionViewMode>("card");
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const route = document.querySelector<HTMLElement>(".discussion-feed-route");

    if (pathname !== "/discussions") {
      route?.removeAttribute("data-discussion-view");
      setHost(null);
      return;
    }

    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "compact" || saved === "card") {
        setViewMode(saved);
      }
    } catch {
      // Keep Card as the safe default when browser storage is unavailable.
    }

    const heading = Array.from(document.querySelectorAll<HTMLHeadingElement>("h1")).find(
      (candidate) => candidate.textContent?.trim() === "Discussions"
    );
    setHost(heading?.parentElement ?? null);
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/discussions") return;
    const route = document.querySelector<HTMLElement>(".discussion-feed-route");
    route?.setAttribute("data-discussion-view", viewMode);

    try {
      window.localStorage.setItem(STORAGE_KEY, viewMode);
    } catch {
      // View switching still works for the current visit without persistence.
    }
  }, [pathname, viewMode]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  if (pathname !== "/discussions" || !host) return null;

  return createPortal(
    <div className="discussion-view-control" ref={menuRef}>
      <button
        type="button"
        className="discussion-view-trigger"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((open) => !open)}
      >
        {viewMode === "card" ? <LayoutList aria-hidden="true" size={16} /> : <Rows3 aria-hidden="true" size={16} />}
        <span>View</span>
        <ChevronDown aria-hidden="true" size={14} />
      </button>

      {menuOpen ? (
        <div className="discussion-view-menu" role="menu" aria-label="Discussion view">
          <button
            type="button"
            role="menuitemradio"
            aria-checked={viewMode === "card"}
            className={viewMode === "card" ? "is-selected" : undefined}
            onClick={() => {
              setViewMode("card");
              setMenuOpen(false);
            }}
          >
            <LayoutList aria-hidden="true" size={17} />
            <span><strong>Card</strong><small>More context and media</small></span>
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={viewMode === "compact"}
            className={viewMode === "compact" ? "is-selected" : undefined}
            onClick={() => {
              setViewMode("compact");
              setMenuOpen(false);
            }}
          >
            <Rows3 aria-hidden="true" size={17} />
            <span><strong>Compact</strong><small>More discussions at once</small></span>
          </button>
        </div>
      ) : null}
    </div>,
    host
  );
}
