"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
} from "@/lib/subscription-plans";

type AiEntitlement = {
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
  monthly_writing_limit: number;
  monthly_research_limit: number;
  monthly_discovery_limit: number;
};

type FeatureUsage = {
  featureKey: string;
  bucket: string;
  label: string;
  total: number;
  metered: number;
  generated: number;
  cached: number;
  failed: number;
  lastUsedAt: string | null;
};

type LimitBucketUsage = {
  bucket: string;
  label: string;
  limit: number | null;
  usage: number;
  remaining: number | null;
};

type RecentAiEvent = {
  id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean;
  success: boolean;
  created_at: string;
};

type AiUsageResponse = {
  ok: boolean;
  isAdmin: boolean;
  entitlement: AiEntitlement;
  currentMonth: {
    start: string;
    limit: number | null;
    meteredUsage: number;
    generatedUsage: number;
    cachedUsage: number;
    failedUsage: number;
    remaining: number | null;
    featureUsage: FeatureUsage[];
    limitBuckets: LimitBucketUsage[];
  };
  recentEvents: RecentAiEvent[];
};

const featureLabels: Record<string, string> = {
  thread_summary: "Thread summaries",
  key_takeaways: "Key takeaways",
  what_changed: "What changed",
  disagreement_map: "Disagreement maps",
  discussion_quality_check: "Quality checks",
  discussion_clarity_rewrite: "Clarity rewrites",
  research_summary: "Research summaries",
  writing_assist: "Writing assist",
  moderation_assist: "Moderation assist",
  discovery: "Discovery assist",
};

function formatFeatureKey(value: string) {
  return (
    featureLabels[value] ??
    value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString();
}

function formatMonth(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function getEventStatus(event: RecentAiEvent) {
  if (!event.success) {
    return "Failed";
  }

  if (event.cached) {
    return "Cached";
  }

  return "Generated";
}

function getEventStatusClass(event: RecentAiEvent) {
  if (!event.success) {
    return "border-red-900 text-red-300";
  }

  if (event.cached) {
    return "border-sky-900 text-sky-300";
  }

  return "border-emerald-900 text-emerald-300";
}

export default function AiUsagePage() {
  const [usage, setUsage] = useState<AiUsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    async function loadUsage() {
      setLoadError("");

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData.session;

        if (!session) {
          window.location.href = "/login";
          return;
        }

        const response = await fetch("/api/ai/usage", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result.error ?? "Unable to load AI usage.");
        }

        setUsage(result as AiUsageResponse);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load AI usage.";
        setLoadError(message);
      } finally {
        setLoading(false);
      }
    }

    loadUsage();
  }, []);

  const subscriptionDisplay = getSubscriptionDisplay(usage?.entitlement ?? null);
  const aiUsageLabel = getAiUsageLabel(usage?.entitlement ?? null);

  const usagePercent = useMemo(() => {
    if (!usage?.currentMonth.limit || usage.currentMonth.limit <= 0) {
      return null;
    }

    return Math.min(
      100,
      Math.round(
        (usage.currentMonth.meteredUsage / usage.currentMonth.limit) * 100
      )
    );
  }, [usage]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-400">Loading AI usage...</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-red-900 bg-red-950/20 p-5 text-red-200">
            {loadError}
          </div>
        </div>
      </main>
    );
  }

  if (!usage) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <p className="text-zinc-400">No AI usage data is available.</p>
        </div>
      </main>
    );
  }

  const month = usage.currentMonth;

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-12 lg:py-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.25em] text-zinc-500">
              AI-Assisted Layer
            </p>

            <h1 className="mb-4 text-3xl font-semibold tracking-tight sm:text-5xl">
              AI usage dashboard
            </h1>

            <p className="max-w-3xl leading-relaxed text-zinc-400">
              Review how Loombus AI is being used on your account this month:
              generated actions, cached results, failed attempts, and recent
              feature activity.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Dashboard
            </Link>

            <Link
              href="/premium"
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Premium
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl shadow-black/30 sm:p-7">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.22em] text-zinc-500 sm:text-sm">
                Current plan
              </p>

              <h2 className="text-xl font-medium sm:text-2xl">
                {subscriptionDisplay.label}
              </h2>
            </div>

            <span className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300">
              {subscriptionDisplay.badge}
            </span>
          </div>

          <p className="mb-3 text-sm leading-relaxed text-zinc-400 sm:text-base">
            {subscriptionDisplay.description}
          </p>

          <p className="text-sm text-zinc-500">
            Included AI usage: {aiUsageLabel}
          </p>
        </section>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">
              Metered this month
            </p>

            <p className="text-3xl font-semibold">
              {month.meteredUsage}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Generated and failed non-cached AI attempts.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">
              Generated
            </p>

            <p className="text-3xl font-semibold">
              {month.generatedUsage}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Successful non-cached AI outputs.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">
              Cached shown
            </p>

            <p className="text-3xl font-semibold">
              {month.cachedUsage}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Reused outputs that did not spend new generation.
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">
              Remaining
            </p>

            <p className="text-3xl font-semibold">
              {month.remaining === null ? "∞" : month.remaining}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              {month.limit === null
                ? "This account is not capped by the normal monthly meter."
                : `${month.limit} included actions for ${formatMonth(month.start)}.`}
            </p>
          </div>
        </section>

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
          <div className="mb-5">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              AI limit buckets
            </p>

            <h2 className="text-xl font-medium sm:text-2xl">
              Per-feature monthly limits
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
              Loombus separates AI usage into clearer buckets so thread
              understanding, writing assistance, research, and discovery can be
              controlled independently.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            {month.limitBuckets.map((bucket) => (
              <div
                key={bucket.bucket}
                className="rounded-2xl border border-zinc-900 bg-black p-5"
              >
                <p className="mb-2 text-sm text-zinc-500">
                  {bucket.label}
                </p>

                <p className="text-2xl font-semibold">
                  {bucket.usage}
                  <span className="text-sm font-normal text-zinc-600">
                    {" "}of {bucket.limit === null ? "∞" : bucket.limit}
                  </span>
                </p>

                <p className="mt-2 text-xs leading-relaxed text-zinc-600">
                  Remaining: {bucket.remaining === null ? "∞" : bucket.remaining}
                </p>
              </div>
            ))}
          </div>
        </section>

        {usagePercent !== null && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm text-zinc-400">
                Monthly usage progress
              </p>

              <p className="text-sm text-zinc-500">
                {usagePercent}%
              </p>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </section>
        )}

        <section className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
          <div className="mb-5">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Feature usage
            </p>

            <h2 className="text-xl font-medium sm:text-2xl">
              AI actions by feature
            </h2>
          </div>

          {month.featureUsage.length === 0 ? (
            <div className="rounded-2xl border border-zinc-900 bg-black p-5 text-sm leading-relaxed text-zinc-500">
              You have not used any AI-assisted features this month yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {month.featureUsage.map((feature) => (
                <div
                  key={feature.featureKey}
                  className="rounded-2xl border border-zinc-900 bg-black p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="mb-1 text-lg font-medium">
                        {feature.label || formatFeatureKey(feature.featureKey)}
                      </h3>

                      <p className="text-xs text-zinc-600">
                        {feature.bucket} bucket · Last used: {formatDateTime(feature.lastUsedAt)}
                      </p>
                    </div>

                    <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-400">
                      {feature.total} total
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                      <p className="text-lg font-semibold">{feature.metered}</p>
                      <p className="text-xs text-zinc-600">Metered</p>
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                      <p className="text-lg font-semibold">{feature.generated}</p>
                      <p className="text-xs text-zinc-600">Generated</p>
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                      <p className="text-lg font-semibold">{feature.cached}</p>
                      <p className="text-xs text-zinc-600">Cached</p>
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                      <p className="text-lg font-semibold">{feature.failed}</p>
                      <p className="text-xs text-zinc-600">Failed</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 sm:p-7">
          <div className="mb-5">
            <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
              Recent activity
            </p>

            <h2 className="text-xl font-medium sm:text-2xl">
              Latest AI-assisted actions
            </h2>
          </div>

          {usage.recentEvents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-900 bg-black p-5 text-sm leading-relaxed text-zinc-500">
              No AI-assisted activity has been recorded yet.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-zinc-900">
              <div className="divide-y divide-zinc-900">
                {usage.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 bg-black p-4 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-center"
                  >
                    <div>
                      <p className="font-medium">
                        {formatFeatureKey(event.feature_key)}
                      </p>

                      <p className="text-xs text-zinc-600">
                        {formatDateTime(event.created_at)}
                      </p>
                    </div>

                    <p className="text-sm text-zinc-500">
                      {event.provider ?? "No provider"}
                      {event.model_name ? ` · ${event.model_name}` : ""}
                    </p>

                    <p className="text-sm text-zinc-500">
                      {event.target_type ?? "No target"}
                    </p>

                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs ${getEventStatusClass(event)}`}
                    >
                      {getEventStatus(event)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="mt-5 text-xs leading-relaxed text-zinc-600">
            Normal members can see status, feature, provider, model, and timing.
            Raw provider error details stay out of the member dashboard.
          </p>
        </section>
      </div>
    </main>
  );
}
