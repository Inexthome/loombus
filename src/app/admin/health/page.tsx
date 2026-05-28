"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CountResult = {
  key: string;
  label: string;
  count: number | null;
  ok: boolean;
  error: string | null;
};

type Warning = {
  key: string;
  severity: "notice" | "attention" | "warning" | string;
  message: string;
  detail: string | null;
};

type HealthResponse = {
  generatedAt: string;
  status: "healthy" | "attention" | "degraded" | string;
  config: Record<string, boolean>;
  missingConfig: string[];
  databaseCounts: CountResult[];
  operationalSignals: CountResult[];
  warnings: Warning[];
};

const CONFIG_LABELS: Record<string, string> = {
  supabaseUrl: "Supabase URL",
  supabaseAnonKey: "Supabase anon key",
  supabaseServiceRole: "Supabase service role",
  siteUrl: "Site URL",

  openAiApiKey: "OpenAI API key",
  openAiSummaryModel: "OpenAI summary model",
  openAiTakeawaysModel: "OpenAI takeaways model",
  openAiWhatChangedModel: "OpenAI what-changed model",
  openAiDisagreementModel: "OpenAI disagreement model",
  openAiQualityCheckModel: "OpenAI quality-check model",
  openAiRewriteModel: "OpenAI rewrite model",
  openAiReplySuggestionsModel: "OpenAI reply-suggestions model",

  stripeSecretKey: "Stripe secret key",
  stripeWebhookSecret: "Stripe webhook secret",
  premiumMonthlyPrice: "Premium monthly price",
  premiumMonthlyFallbackPrice: "Premium fallback price",
  premiumAnnualPrice: "Premium annual price",
  premiumPlusMonthlyPrice: "Premium Plus monthly price",
  premiumPlusAnnualPrice: "Premium Plus annual price",
  extraAiPackPrice: "Extra AI Pack price",

  resendApiKey: "Resend API key",
  digestFromEmail: "Digest from email",
  digestCronSecret: "Digest cron secret",
};

function statusClass(status: string) {
  if (status === "healthy") return "border-emerald-900 text-emerald-300";
  if (status === "attention") return "border-amber-900 text-amber-300";
  return "border-red-900 text-red-300";
}

function warningClass(severity: string) {
  if (severity === "warning") return "border-red-900 text-red-300";
  if (severity === "attention") return "border-amber-900 text-amber-300";
  return "border-zinc-800 text-zinc-400";
}

export default function AdminHealthPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/health", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load platform health.");
        setLoading(false);
        return;
      }

      setHealth(result as HealthResponse);
    } catch {
      setMessage("Unable to load platform health.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  const configuredCount = useMemo(() => {
    if (!health) return 0;
    return Object.values(health.config).filter(Boolean).length;
  }, [health]);

  const configTotal = health ? Object.keys(health.config).length : 0;

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading platform health...
        </div>
      </main>
    );
  }

  if (!health) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
            ← Back to admin
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Platform health
            </p>

            <h1 className="mb-4 text-4xl font-semibold tracking-tight">
              Unable to load health checks.
            </h1>

            <p className="leading-relaxed text-zinc-400">
              {message || "Admin access may be required."}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
          ← Back to admin
        </Link>

        <div className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
                Administration
              </p>

              <h1 className="mb-5 text-5xl font-semibold tracking-tight">
                Platform health.
              </h1>

              <p className="max-w-3xl leading-relaxed text-zinc-400">
                Read-only operational health checks for environment config,
                database visibility, AI failures, reports, notifications, billing,
                and admin-critical tables.
              </p>
            </div>

            <span className={`w-fit rounded-full border px-4 py-2 text-sm ${statusClass(health.status)}`}>
              {health.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={loadHealth}
              className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-600 hover:text-white"
            >
              Refresh health
            </button>

            <span className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-500">
              Generated {new Date(health.generatedAt).toLocaleString()}
            </span>
          </div>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Health status" value={health.status} />
          <Metric label="Configured env" value={`${configuredCount}/${configTotal}`} />
          <Metric label="Missing env" value={`${health.missingConfig.length}`} />
          <Metric label="Warnings" value={`${health.warnings.length}`} />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wide text-zinc-600">
                Configuration
              </p>
              <h2 className="text-2xl font-medium">Safe environment presence</h2>
            </div>

            <p className="text-sm text-zinc-500">
              Missing: {health.missingConfig.length}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(health.config).map(([key, present]) => (
              <div key={key} className="rounded-2xl border border-zinc-900 bg-black p-4">
                <p className="text-sm text-zinc-400">
                  {CONFIG_LABELS[key] ?? key}
                </p>
                <p className={present ? "mt-2 text-sm text-emerald-300" : "mt-2 text-sm text-red-300"}>
                  {present ? "Configured" : "Missing"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <CountPanel title="Database visibility" counts={health.databaseCounts} />
          <CountPanel title="Operational signals" counts={health.operationalSignals} />
        </section>

        <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-5 text-2xl font-medium">Warnings and attention items</h2>

          {health.warnings.length === 0 ? (
            <div className="rounded-2xl border border-emerald-950 bg-black p-5">
              <p className="text-emerald-300">No platform health warnings detected.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {health.warnings.map((warning) => (
                <article
                  key={warning.key}
                  className={`rounded-2xl border bg-black p-5 ${warningClass(warning.severity)}`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-current px-3 py-1 text-xs">
                      {warning.severity}
                    </span>
                    <h3 className="text-base font-medium text-white">
                      {warning.message}
                    </h3>
                  </div>

                  {warning.detail && (
                    <p className="text-sm text-zinc-500">{warning.detail}</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

function CountPanel({
  title,
  counts,
}: {
  title: string;
  counts: CountResult[];
}) {
  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="mb-5 text-2xl font-medium">{title}</h2>

      <div className="space-y-3">
        {counts.map((item) => (
          <div key={item.key} className="rounded-2xl border border-zinc-900 bg-black px-4 py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-400">{item.label}</span>
              <span className={item.ok ? "text-sm text-white" : "text-sm text-red-300"}>
                {item.ok ? (item.count ?? 0).toLocaleString() : "Error"}
              </span>
            </div>

            {item.error && (
              <p className="mt-2 text-xs text-red-300">{item.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
