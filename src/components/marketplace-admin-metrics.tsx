"use client";

import { BarChart3, Bookmark, Flag, MessageCircle, PackageCheck, Timer } from "lucide-react";
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
    <section className="bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-7xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
          Administrator operations
        </p>
        <h2 className="mt-2 text-2xl font-semibold">Marketplace trust metrics</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map(({ label, value, icon: Icon }) => (
            <article
              key={label}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--loombus-text-muted)]">{label}</span>
                <Icon size={18} />
              </div>
              <strong className="mt-3 block text-3xl">{value}</strong>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
