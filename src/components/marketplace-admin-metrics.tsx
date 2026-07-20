"use client";

import { Bookmark, Flag, MessageCircle, PackageCheck, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import {
  AdminMetricCard,
  AdminQueueSection,
  AdminStatusBadge,
} from "@/app/admin/platform/admin-platform-foundation";
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

  const unavailable = state === "unavailable";
  const value = (key: keyof Metrics) => (metrics ? metrics[key] : unavailable ? "Unavailable" : "Loading");
  const closed = metrics ? metrics.sold + metrics.expired + metrics.removed : unavailable ? "Unavailable" : "Loading";

  return (
    <AdminQueueSection
      eyebrow="Marketplace diagnostics"
      title="Trust and lifecycle snapshot"
      description="Read-only platform diagnostics for listing state and member engagement. These counts do not change public ranking."
      action={
        <AdminStatusBadge status={state === "ready" ? "ready" : state === "loading" ? "foundation" : "unavailable"}>
          {state === "ready" ? "Current" : state === "loading" ? "Loading" : "Unavailable"}
        </AdminStatusBadge>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminMetricCard label="Pending review" value={value("pending")} description="Listings waiting for an administrator decision." icon={<Timer size={19} />} featured />
        <AdminMetricCard label="Published listings" value={value("active")} description="Listings currently visible in Marketplace." icon={<PackageCheck size={19} />} />
        <AdminMetricCard label="Open reports" value={value("openReports")} description="Member reports that still need an outcome." icon={<Flag size={19} />} />
        <AdminMetricCard label="Saved relationships" value={value("savedRelationships")} description="Member-to-listing save records." icon={<Bookmark size={19} />} />
        <AdminMetricCard label="Seller contacts" value={value("contactThreads")} description="Marketplace contact threads." icon={<MessageCircle size={19} />} />
        <AdminMetricCard label="Closed lifecycle" value={closed} description="Sold, expired, or removed listings." />
      </div>
    </AdminQueueSection>
  );
}
