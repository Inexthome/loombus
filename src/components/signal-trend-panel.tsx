"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RangeKey = "7d" | "30d" | "90d" | "all";

type TrendPoint = {
  start: string;
  label: string;
  signalActions: number;
  replies: number;
  saves: number;
  knowledgeSignal: number;
  regularSignal: number;
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

export function SignalTrendPanel({ range }: { range: RangeKey }) {
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

        const response = await fetch(`/api/insights/signal-trends?range=${encodeURIComponent(range)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load Signal trends");
        const next = (await response.json()) as TrendPayload;
        if (!cancelled) setPayload(next);
      } catch (error) {
        console.error("Unable to load Signal trends", error);
        if (!cancelled) setNotice("Signal trend data could not be loaded.");
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
      ...payload.points.map((point) => Math.max(point.knowledgeSignal, point.regularSignal))
    );
    return {
      max,
      knowledge: polyline(payload.points.map((point) => point.knowledgeSignal), max),
      regular: polyline(payload.points.map((point) => point.regularSignal), max),
    };
  }, [payload.points]);

  const totals = useMemo(
    () =>
      payload.points.reduce(
        (acc, point) => ({
          signal: acc.signal + point.signalActions,
          replies: acc.replies + point.replies,
          saves: acc.saves + point.saves,
        }),
        { signal: 0, replies: 0, saves: 0 }
      ),
    [payload.points]
  );

  const hasSignal = totals.signal > 0;
  const first = payload.points[0];
  const last = payload.points[payload.points.length - 1];

  return (
    <details open className="group border-b border-[var(--loombus-border)]" aria-labelledby="signal-trend-title">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--loombus-gold)]">Signal trend</p>
          <h2 id="signal-trend-title" className="mt-2 text-xl font-black">Meaningful actions over time by discussion origin.</h2>
          <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Replies received and saves earned are combined as Signal actions, then split by knowledge-origin and regular discussions.</p>
        </div>
        <div className="flex shrink-0 items-center gap-3 pt-1 text-xs text-[var(--loombus-text-muted)]">
          <span>{bucketLabel(payload.bucket)} buckets</span>
          <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="pb-5">
        <div className="grid grid-cols-3 border-t border-[var(--loombus-border)] text-xs text-[var(--loombus-text-muted)]">
          <div className="py-3"><span className="block">Signal actions</span><strong className="mt-1 block text-base text-[var(--loombus-text)]">{totals.signal.toLocaleString()}</strong></div>
          <div className="border-l border-[var(--loombus-border)] py-3 pl-4"><span className="block">Replies</span><strong className="mt-1 block text-base text-[var(--loombus-text)]">{totals.replies.toLocaleString()}</strong></div>
          <div className="border-l border-[var(--loombus-border)] py-3 pl-4"><span className="block">Saves</span><strong className="mt-1 block text-base text-[var(--loombus-text)]">{totals.saves.toLocaleString()}</strong></div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--loombus-border)] pt-3 text-xs text-[var(--loombus-text-muted)]">
          <span><b className="text-[var(--loombus-gold)]">—</b> Knowledge-origin Signal</span>
          <span><b className="text-[var(--loombus-text-muted)]">—</b> Regular Signal</span>
        </div>

        {loading ? (
          <p className="py-8 text-sm text-[var(--loombus-text-muted)]">Loading Signal trend…</p>
        ) : notice ? (
          <p className="py-8 text-sm text-[var(--loombus-text-muted)]">{notice}</p>
        ) : hasSignal ? (
          <div className="mt-4">
            <div className="relative h-56 border-y border-[var(--loombus-border)] py-4">
              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--loombus-border)]" aria-hidden="true" />
              <svg viewBox="0 0 100 34" preserveAspectRatio="none" className="relative h-full w-full overflow-visible" role="img" aria-label="Signal actions over time for knowledge-origin and regular discussions">
                <polyline points={chart.regular} fill="none" vectorEffect="non-scaling-stroke" className="stroke-[var(--loombus-text-muted)]" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={chart.knowledge} fill="none" vectorEffect="non-scaling-stroke" className="stroke-[var(--loombus-gold)]" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </div>
            <div className="mt-2 flex justify-between text-xs text-[var(--loombus-text-subtle)]">
              <span>{first?.label}</span>
              <span>Peak bucket {chart.max.toLocaleString()} Signal actions</span>
              <span>{last?.label}</span>
            </div>
          </div>
        ) : (
          <p className="mt-4 border-t border-[var(--loombus-border)] py-6 text-sm text-[var(--loombus-text-muted)]">No replies received or saves earned in this period.</p>
        )}
      </div>
    </details>
  );
}
