"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function DiscussionsLaunchPricingBanner() {
  const [rail, setRail] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const browseTopicsRail = document.querySelector<HTMLElement>(
      "main > div > aside:first-child > section"
    );

    setRail(browseTopicsRail);
  }, []);

  if (!rail) return null;

  return createPortal(
    <div className="mt-5 border-t border-[color:var(--loombus-border-muted)] pt-5">
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-[#CBAB5B]">
        Launch-year pricing
      </p>
      <p className="mt-2 text-sm font-semibold leading-5 text-[color:var(--loombus-text)]">
        Premium $7/mo <span className="text-[color:var(--loombus-text-subtle)]">•</span> Pro $12/mo
      </p>
      <p className="mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]">
        Ends June 14, 2027
      </p>
      <Link
        href="/premium"
        className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#CBAB5B] transition hover:text-[color:var(--loombus-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#CBAB5B] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--loombus-surface)]"
      >
        View plans
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Link>
    </div>,
    rail
  );
}
