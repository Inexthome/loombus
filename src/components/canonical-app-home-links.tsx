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

  for (const anchor of anchors) {
    if (!isHomeAnchor(anchor)) continue;
    anchor.setAttribute("href", signedIn ? "/home" : "/");
  }
}

export function CanonicalAppHomeLinks() {
  useEffect(() => {
    let signedIn = false;
    let active = true;

    function normalizeDocument() {
      normalizeHomeAnchors(document, signedIn);
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      signedIn = Boolean(data.session?.user);
      normalizeDocument();
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      signedIn = Boolean(session?.user);
      normalizeDocument();
    });

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node instanceof Element) {
            normalizeHomeAnchors(node, signedIn);
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      active = false;
      observer.disconnect();
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
