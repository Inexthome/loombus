"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function normalizeAuthorMeta(root: ParentNode) {
  const authorLinks = root.querySelectorAll<HTMLAnchorElement>(
    'article a.mt-5[href^="/discussions/"]'
  );

  for (const link of authorLinks) {
    const copy = link.querySelector<HTMLElement>(".min-w-0");
    if (!copy) continue;

    const lines = copy.querySelectorAll<HTMLParagraphElement>("p");
    if (lines.length < 2) continue;

    const meta = lines[1];
    const current = meta.textContent?.trim() ?? "";
    const normalized = current.replace(/^@[A-Za-z0-9_]+\s*·\s*/, "");

    if (normalized && normalized !== current) {
      meta.textContent = normalized;
    }
  }
}

export function DiscussionsAuthorIdentityNormalizer() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/discussions") return;

    normalizeAuthorMeta(document);

    const observer = new MutationObserver(() => normalizeAuthorMeta(document));
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
