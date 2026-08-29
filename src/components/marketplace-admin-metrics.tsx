"use client";

import { Bookmark, Flag, MessageCircle, PackageCheck, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { marketplaceAuthorizedFetch } from "@/lib/marketplace-auth-client";

type Metrics = {
  pending: number;
  active: number;
  sold: number;
  expired: number;
  removed: number;
  openReports: number;
  savedRelationships: number;
  contactThreads: number;
};

type MetricRow = {
  label: string;
  value: number;
  description: string;
  icon?: ReactNode;
};

export default function MarketplaceAdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    let active = true;
    void marketplaceAuthorizedFetch("/api/marketplace/admin-metrics", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { metrics?: Metrics };
      })
      .then((payload) => {
        if (!active) return;
        if (!payload?.metrics) {
          setState("unavailable");
          return;
        }
        setMetrics(payload.metrics);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("unavailable");
      });
    return () => {
      active = false;
    };
  }, []);

  // The endpoint is intentionally administrator-only. Do not leave a large
  // "Unavailable" diagnostics dashboard beneath a normal seller workspace.
  if (state === "unavailable") return null;

  const closed = metrics ? metrics.sold + metrics.expired + metrics.removed : 0;
  const rows: MetricRow[] = [
    { label: "Pending review", value: metrics?.pending ?? 0, description: "Awaiting an administrator decision", icon: <Timer size={17} /> },
    { label: "Published", value: metrics?.active ?? 0, description: "Currently visible in Marketplace", icon: <PackageCheck size={17} /> },
    { label: "Open reports", value: metrics?.openReports ?? 0, description: "Still awaiting an outcome", icon: <Flag size={17} /> },
    { label: "Saved", value: metrics?.savedRelationships ?? 0, description: "Member-to-listing save records", icon: <Bookmark size={17} /> },
    { label: "Seller contacts", value: metrics?.contactThreads ?? 0, description: "Marketplace contact threads", icon: <MessageCircle size={17} /> },
    { label: "Closed lifecycle", value: closed, description: "Sold, expired, or removed listings" },
  ];

  return (
    <section className="bg-[color:var(--loombus-page-bg)] px-4 pb-20 text-[color:var(--loombus-text)] sm:px-6 lg:px-8" aria-labelledby="marketplace-diagnostics-heading">
      <div className="mx-auto max-w-[82rem] border-t border-[color:var(--loombus-border-muted)] pt-8">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Marketplace diagnostics</p>
            <h2 id="marketplace-diagnostics-heading" className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Trust and lifecycle snapshot</h2>
          </div>
          <p className="text-sm text-[color:var(--loombus-text-muted)]">{state === "loading" ? "Loading current counts…" : "Current · read only"}</p>
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          Read-only platform diagnostics for listing state and member engagement. These counts do not change public ranking.
        </p>

        <dl className="mt-6 grid border-y border-[color:var(--loombus-border-muted)] sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="border-b border-[color:var(--loombus-border-muted)] py-5 sm:px-5 xl:[&:nth-child(3n+1)]:pl-0 xl:[&:nth-child(3n)]:pr-0">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-subtle)]">
                {row.icon ? <span className="text-[color:var(--loombus-gold)]">{row.icon}</span> : null}
                {row.label}
              </dt>
              <dd className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{state === "loading" ? "—" : row.value}</dd>
              <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">{row.description}</p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
