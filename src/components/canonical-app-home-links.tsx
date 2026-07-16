"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

function isHomeAnchor(anchor: HTMLAnchorElement) {
  const label = [anchor.textContent, anchor.getAttribute("aria-label")]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  return label === "home" || label === "loombus home";
}

function normalizeHomeAnchors(root: ParentNode, signedIn: boolean) {
  const anchors: HTMLAnchorElement[] = [];

  if (root instanceof HTMLAnchorElement) {
    anchors.push(root);
  }

  anchors.push(...root.querySelectorAll<HTMLAnchorElement>('a[href="/"], a[href="/home"]'));

  const destination = signedIn ? "/home" : "/";

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
    let signedIn = false;
    let active = true;

    function normalizeDocument() {
      normalizeHomeAnchors(document, signedIn);
    }

    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      signedIn = Boolean(data.user);
      normalizeDocument();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      signedIn = Boolean(session?.user);
      normalizeDocument();
    });

    async function handleHomeClick(event: MouseEvent) {
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
      if (url.origin !== window.location.origin || url.pathname !== "/") return;

      event.preventDefault();
      event.stopPropagation();

      const { data } = await supabase.auth.getUser();
      const destination = data.user || signedIn ? "/home" : "/";
      window.location.assign(destination);
    }

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "attributes" && record.target instanceof HTMLAnchorElement) {
          normalizeHomeAnchors(record.target, signedIn);
          continue;
        }

        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            normalizeHomeAnchors(node, signedIn);
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
      active = false;
      document.removeEventListener("click", handleHomeClick, true);
      observer.disconnect();
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
