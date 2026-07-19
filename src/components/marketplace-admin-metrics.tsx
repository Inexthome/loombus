"use client";

import {
  BarChart3,
  Bookmark,
  Flag,
  MessageCircle,
  PackageCheck,
  Timer,
} from "lucide-react";
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

export default function MarketplaceAdminMetrics() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    let active = true;
    void marketplaceAuthorizedFetch("/api/marketplace/admin-metrics", {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as { metrics?: Metrics };
      })
      .then((payload) => {
        if (active && payload?.metrics) setMetrics(payload.metrics);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  if (!metrics) return null;

  const cards = [
    { label: "Pending review", value: metrics.pending, icon: Timer },
    { label: "Active listings", value: metrics.active, icon: PackageCheck },
    { label: "Open reports", value: metrics.openReports, icon: Flag },
    { label: "Saved relationships", value: metrics.savedRelationships, icon: Bookmark },
    { label: "Seller contacts", value: metrics.contactThreads, icon: MessageCircle },
    {
      label: "Closed lifecycle",
      value: metrics.sold + metrics.expired + metrics.removed,
      icon: BarChart3,
    },
  ];

  return (
    <section className="bg-[color:var(--loombus-page-bg)] px-4 pb-24 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem] rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Administrator diagnostics</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Marketplace trust metrics</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          Platform-level Marketplace relationships and lifecycle counts. These metrics do not change public ranking.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, value, icon: Icon }, index) => (
            <article
              key={label}
              className={`rounded-[1.35rem] border p-4 ${
                index === 0
                  ? "border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]"
                  : "border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)]"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[color:var(--loombus-text-muted)]">{label}</span>
                <Icon className="text-[color:var(--loombus-gold)]" size={18} />
              </div>
              <strong className="mt-3 block text-3xl tracking-[-0.04em]">{value}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
