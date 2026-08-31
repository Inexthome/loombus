"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export function DiscussionsLaunchPricingBridge() {
  const pathname = usePathname();
  const [browseTopicsRail, setBrowseTopicsRail] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (pathname !== "/discussions") {
      setBrowseTopicsRail(null);
      return;
    }

    const heading = Array.from(document.querySelectorAll<HTMLElement>("aside p")).find(
      (element) => element.textContent?.trim().toLowerCase() === "browse topics"
    );

    setBrowseTopicsRail(heading?.closest("section") ?? null);
  }, [pathname]);

  if (pathname !== "/discussions" || !browseTopicsRail) return null;

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
    browseTopicsRail
  );
}
