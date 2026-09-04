"use client";

import { LEGAL_LINKS, LEGAL_ORIGIN } from "@/lib/legal-links";
import { useEffect } from "react";

const LEGAL_PATHS: Record<string, string> = {
  "/legal": LEGAL_LINKS.center,
  "/privacy": LEGAL_LINKS.privacy,
  "/terms": LEGAL_LINKS.terms,
  "/guidelines": LEGAL_LINKS.communityGuidelines,
  "/community-guidelines": LEGAL_LINKS.communityGuidelines,
  "/cookies": LEGAL_LINKS.cookies,
  "/refunds": LEGAL_LINKS.refunds,
  "/dmca": LEGAL_LINKS.dmca,
  "/accessibility": LEGAL_LINKS.accessibility,
};

function ensureExternalRel(anchor: HTMLAnchorElement) {
  const rel = new Set(
    anchor.rel
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean)
  );

  rel.add("noopener");
  rel.add("noreferrer");
  anchor.rel = Array.from(rel).join(" ");
}

function normalizeLegalAnchor(anchor: HTMLAnchorElement) {
  let url: URL;

  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return;
  }

  const canonicalPath = LEGAL_PATHS[url.pathname];
  const pointsToLegacyLegalRoute =
    url.origin === window.location.origin && Boolean(canonicalPath);
  const pointsToCanonicalLegalHost = url.origin === LEGAL_ORIGIN;

  if (!pointsToLegacyLegalRoute && !pointsToCanonicalLegalHost) return;

  if (pointsToLegacyLegalRoute && canonicalPath) {
    const destination = new URL(canonicalPath);
    destination.search = url.search;
    destination.hash = url.hash;
    anchor.href = destination.toString();
  }

  anchor.target = "_blank";
  ensureExternalRel(anchor);
}

function normalizeLegalLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach(normalizeLegalAnchor);
}

export function CanonicalLegalLinks() {
  useEffect(() => {
    // The Legal Center is already the destination. Its own navigation should
    // behave like a normal website instead of opening another tab per page.
    if (window.location.hostname === "legal.loombus.com") return;

    normalizeLegalLinks(document);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "attributes") {
          if (mutation.target instanceof HTMLAnchorElement) {
            normalizeLegalAnchor(mutation.target);
          }
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;

          if (node instanceof HTMLAnchorElement) {
            normalizeLegalAnchor(node);
          }
          normalizeLegalLinks(node);
        });
      }
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["href"],
    });

    return () => observer.disconnect();
  }, []);

  return null;
}
