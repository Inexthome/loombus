"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PersistedDetails } from "@/components/persisted-details";
import { SignalTrendPanel } from "@/components/signal-trend-panel";
import { supabase } from "@/lib/supabase/client";

type RangeKey = "7d" | "30d" | "90d" | "all";

type TrendPoint = {
  start: string;
  label: string;
  totalViews: number;
  knowledgeViews: number;
  regularViews: number;
};

type TrendPayload = {
  range: RangeKey;
  bucket: "day" | "week" | "month";
  points: TrendPoint[];
};

const emptyPayload: TrendPayload = { range: "30d", bucket: "day", points: [] };

function polyline(values: number[], max: number) {
  if (!values.length) return "";
  const width = 100;
  const height = 34;
  const divisor = Math.max(values.length - 1, 1);
  return values
    .map((value, index) => {
      const x = (index / divisor) * width;
      const y = height - (value / Math.max(max, 1)) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function bucketLabel(bucket: TrendPayload["bucket"]) {
  if (bucket === "week") return "Weekly";
  if (bucket === "month") return "Monthly";
  return "Daily";
}

export function ViewTrendPanel({ range }: { range: RangeKey }) {
  const [payload, setPayload] = useState<TrendPayload>(emptyPayload);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotice("");
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return;

        const response = await fetch(`/api/insights/view-trends?range=${encodeURIComponent(range)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load view trends");
        const next = (await response.json()) as TrendPayload;
        if (!cancelled) setPayload(next);
      } catch (error) {
        console.error("Unable to load view trends", error);
        if (!cancelled) setNotice("View trend data could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chart = useMemo(() => {
    const max = Math.max(
      1,
      ...payload.points.map((point) => Math.max(point.knowledgeViews, point.regularViews))
    );
    return {
      max,
      knowledge: polyline(payload.points.map((point) => point.knowledgeViews), max),
      regular: polyline(payload.points.map((point) => point.regularViews), max),
    };
  }, [payload.points]);

  const hasViews = payload.points.some((point) => point.totalViews > 0);
  const first = payload.points[0];
  const last = payload.points[payload.points.length - 1];

  return (
    <>
      <SignalTrendPanel range={range} />
      <PersistedDetails
        storageKey="loombus:insights:view-trend"
        className="group border-b border-[var(--loombus-border)]"
        aria-labelledby="view-trend-title"
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">View trend</p>
            <h2 id="view-trend-title" className="mt-2 text-xl font-black">Views over time by discussion origin.</h2>
            <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Knowledge-origin and regular discussion views are plotted separately. Views remain a reach metric and do not add Signal.</p>
          </div>
          <div className="flex shrink-0 items-center gap-3 pt-1 text-xs text-[var(--loombus-text-muted)]">
            <span>{bucketLabel(payload.bucket)} buckets</span>
            <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
          </div>
        </summary>

        <div className="pb-5">
          <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--loombus-border)] pt-3 text-xs text-[var(--loombus-text-muted)]">
            <span><b className="text-[var(--loombus-gold)]">—</b> Knowledge-origin</span>
            <span><b className="text-[var(--loombus-text-muted)]">—</b> Regular</span>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-[var(--loombus-text-muted)]">Loading view trend…</p>
          ) : notice ? (
            <p className="py-8 text-sm text-[var(--loombus-text-muted)]">{notice}</p>
          ) : hasViews ? (
            <div className="mt-4">
              <div className="relative h-56 border-y border-[var(--loombus-border)] py-4">
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--loombus-border)]" aria-hidden="true" />
                <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="relative h-full w-full overflow-visible" role="img" aria-label="Views over time for knowledge-origin and regular discussions">
                  <polyline points={chart.regular} fill="none" vectorEffect="non-scaling-stroke" className="stroke-[var(--loombus-text-muted)]" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  <polyline points={chart.knowledge} fill="none" vectorEffect="non-scaling-stroke" className="stroke-[var(--loombus-gold)]" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                </svg>
              </div>
              <div className="mt-2 flex justify-between text-xs text-[var(--loombus-text-subtle)]">
                <span>{first?.label}</span>
                <span>Peak bucket {chart.max.toLocaleString()} views</span>
                <span>{last?.label}</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 border-t border-[var(--loombus-border)] py-6 text-sm text-[var(--loombus-text-muted)]">No authenticated discussion views recorded in this period.</p>
          )}
        </div>
      </PersistedDetails>
    </>
  );
}
