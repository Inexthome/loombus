"use client";

import { useLayoutEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";

const INTERNAL_AUDIENCE_KEYS = [
  "__audience_type",
  "__audience_base",
  "__audience_include_ids",
  "__audience_exclude_ids",
] as const;

export function CreateDiscussionAudiencePublicFallbackGuard() {
  const capabilityReadyRef = useRef(false);

  useLayoutEffect(() => {
    let cancelled = false;

    void supabase
      .rpc("get_discussion_audience_capability")
      .then(({ data, error }) => {
        if (!cancelled) capabilityReadyRef.current = data === true && !error;
      });

    const originalFetch = window.fetch.bind(window);
    const guardedFetch: typeof window.fetch = async (input, init) => {
      const inputUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let pathname = inputUrl;

      try {
        pathname = new URL(inputUrl, window.location.origin).pathname;
      } catch {
        // Preserve the original value when URL parsing fails.
      }

      const method = String(
        init?.method ?? (input instanceof Request ? input.method : "GET")
      ).toUpperCase();

      if (
        !capabilityReadyRef.current &&
        pathname === "/api/discussions/create" &&
        method === "POST" &&
        typeof init?.body === "string"
      ) {
        try {
          const body = JSON.parse(init.body) as Record<string, unknown>;
          const metadata =
            body.discussionMetadata &&
            typeof body.discussionMetadata === "object" &&
            !Array.isArray(body.discussionMetadata)
              ? { ...(body.discussionMetadata as Record<string, unknown>) }
              : null;

          if (metadata) {
            for (const key of INTERNAL_AUDIENCE_KEYS) delete metadata[key];
            body.discussionMetadata = metadata;
            return originalFetch(input, { ...init, body: JSON.stringify(body) });
          }
        } catch {
          // The normal Create request remains authoritative.
        }
      }

      return originalFetch(input, init);
    };

    window.fetch = guardedFetch;
    return () => {
      cancelled = true;
      if (window.fetch === guardedFetch) window.fetch = originalFetch;
    };
  }, []);

  return null;
}
