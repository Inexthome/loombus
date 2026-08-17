"use client";

import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";

const QUICK_RAIL_SELECTOR = ".loombus-persistent-quick-rail";
const QUICK_RAIL_GAP_PX = 12;

export function LibraryResearchShortcut() {
  const [raisedBottom, setRaisedBottom] = useState<number | null>(null);

  useEffect(() => {
    let railObserver: MutationObserver | null = null;
    let bodyObserver: MutationObserver | null = null;
    let frame = 0;
    let observedRail: HTMLElement | null = null;

    function syncPosition() {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const rail = document.querySelector<HTMLElement>(QUICK_RAIL_SELECTOR);

        if (!rail) {
          setRaisedBottom(null);
          return;
        }

        const railRect = rail.getBoundingClientRect();
        const nextBottom = Math.max(
          20,
          Math.ceil(window.innerHeight - railRect.top + QUICK_RAIL_GAP_PX)
        );
        setRaisedBottom(nextBottom);
      });
    }

    function observeRail() {
      const rail = document.querySelector<HTMLElement>(QUICK_RAIL_SELECTOR);
      if (rail === observedRail) {
        syncPosition();
        return;
      }

      railObserver?.disconnect();
      observedRail = rail;

      if (rail) {
        railObserver = new MutationObserver(syncPosition);
        railObserver.observe(rail, {
          attributes: true,
          attributeFilter: ["data-open"],
          childList: true,
          subtree: true,
        });
      }

      syncPosition();
    }

    bodyObserver = new MutationObserver(observeRail);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", syncPosition);
    observeRail();

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", syncPosition);
      railObserver?.disconnect();
      bodyObserver?.disconnect();
    };
  }, []);

  return (
    <Link
      href="/library/research"
      aria-label="Open Research"
      style={raisedBottom === null ? undefined : { bottom: `${raisedBottom}px` }}
      className="fixed bottom-5 right-4 z-[110] inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 text-sm font-black text-[var(--loombus-gold)] shadow-xl transition-[bottom,border-color,transform] duration-200 hover:border-[var(--loombus-gold)] sm:bottom-7 sm:right-6"
    >
      <FlaskConical className="size-4" />
      Research
    </Link>
  );
}
