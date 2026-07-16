"use client";

import { useEffect } from "react";

const APP_ROUTE_PREFIXES = [
  "/home",
  "/dashboard",
  "/discussions",
  "/create",
  "/rooms",
  "/topics",
  "/people",
  "/following",
  "/messages",
  "/saved",
  "/stickies",
  "/my-activity",
  "/my-discussions",
  "/my-replies",
  "/reading-history",
  "/labs",
  "/premium",
  "/ai-usage",
  "/settings",
  "/privacy-security",
  "/blocked-users",
  "/notifications",
  "/profile",
  "/u",
  "/admin",
  "/search",
  "/onboarding",
];

function isAppRoute(pathname: string) {
  return APP_ROUTE_PREFIXES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

function isHomeAnchor(anchor: HTMLAnchorElement) {
  const label = [anchor.textContent, anchor.getAttribute("aria-label")]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return label === "home" || label === "loombus home";
}

function normalizeHomeAnchors(root: ParentNode, destination: "/" | "/home") {
  const anchors: HTMLAnchorElement[] = [];

  if (root instanceof HTMLAnchorElement) {
    anchors.push(root);
  }

  anchors.push(...root.querySelectorAll<HTMLAnchorElement>('a[href="/"], a[href="/home"]'));

  for (const anchor of anchors) {
    if (!isHomeAnchor(anchor)) continue;
    if (anchor.getAttribute("href") !== destination) {
      anchor.setAttribute("href", destination);
    }
  }
}

function getClickedAnchor(event: MouseEvent) {
  const target = event.target;

  if (target instanceof Element) {
    return target.closest<HTMLAnchorElement>("a");
  }

  if (target instanceof Node) {
    return target.parentElement?.closest<HTMLAnchorElement>("a") ?? null;
  }

  return null;
}

export function CanonicalAppHomeLinks() {
  useEffect(() => {
    const destination = isAppRoute(window.location.pathname) ? "/home" : "/";

    normalizeHomeAnchors(document, destination);

    function handleHomeClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const anchor = getClickedAnchor(event);
      if (!anchor || !isHomeAnchor(anchor)) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname !== "/" && url.pathname !== "/home") return;
      if (url.pathname === destination) return;

      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination);
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLAnchorElement) {
          normalizeHomeAnchors(record.target, destination);
          continue;
        }

        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            normalizeHomeAnchors(node, destination);
          }
        }
      }
    });

    document.addEventListener("click", handleHomeClick, true);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["href"],
      childList: true,
      subtree: true,
    });

    return () => {
      document.removeEventListener("click", handleHomeClick, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
