"use client";

import { useEffect, useRef } from "react";

type PolicyAnalyticsSurface = "current" | "history" | "archive";

export function PolicyAnalyticsView({
  surface,
  documentId,
  version,
}: {
  surface: PolicyAnalyticsSurface;
  documentId: string;
  version: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    void fetch("/api/policy-content-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ surface, documentId, version }),
      cache: "no-store",
      keepalive: true,
      credentials: "omit",
    }).catch(() => undefined);
  }, [surface, documentId, version]);

  return null;
}
