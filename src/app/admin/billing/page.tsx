"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DiagnosticsResponse = {
  config: Record<string, boolean>;
  entitlementSummary: {
    totalEntitlements: number;
    planCounts: Record<string, number>;
    stripeLinked: number;
    subscriptionLinked: number;
    priceLinked: number;
    subscriptionStatuses: Record<string, number>;
  };
  extraCreditStats: {
    totalPacks: number;
    purchasedCredits: number;
    remainingCredits: number;
    byStatus: Record<string, number>;
  };
  ledgerStats: {
    totalLedgerEntries: number;
    netCreditsDelta: number;
    byReason: Record<string, number>;
  };
  recentEntitlements: Array<{
    user_id: string;
    tier: string | null;
    ai_assisted_enabled: boolean | null;
    monthly_summary_limit: number | null;
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
    stripe_price_id: string | null;
    stripe_subscription_status: string | null;
    stripe_current_period_end: string | null;
    updated_at: string | null;
  }>;
  recentPacks: Array<{
    id: string;
    user_id: string;
    purchased_credits: number | null;
    remaining_credits: number | null;
    status: string | null;
    source: string | null;
    stripe_checkout_session_id: string | null;
    stripe_customer_id: string | null;
    created_at: string | null;
  }>;
  recentLedger: Array<{
    id: string;
    user_id: string;
    credits_delta: number | null;
    reason: string | null;
    stripe_checkout_session_id: string | null;
    created_at: string | null;
  }>;
};

const CONFIG_LABELS: Record<string, string> = {
  stripeSecretKey: "Stripe secret key",
  stripeWebhookSecret: "Stripe webhook secret",
  premiumMonthlyPrice: "Premium monthly price",
  premiumAnnualPrice: "Premium annual price",
  premiumPlusMonthlyPrice: "Premium Plus monthly price",
  premiumPlusAnnualPrice: "Premium Plus annual price",
  extraAiPackPrice: "Extra AI Pack price",
  siteUrl: "Site URL",
  supabaseServiceRole: "Supabase service role",
};

function maskId(value: string | null | undefined) {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default function AdminBillingPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBillingDiagnostics() {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      try {
        const response = await fetch("/api/admin/billing/diagnostics", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          setMessage(result.error ?? "Unable to load billing diagnostics.");
          setLoading(false);
          return;
        }

        setDiagnostics(result as DiagnosticsResponse);
      } catch {
        setMessage("Unable to load billing diagnostics.");
      } finally {
        setLoading(false);
      }
    }

    loadBillingDiagnostics();
  }, []);

  const missingConfig = useMemo(() => {
    if (!diagnostics) return [];

    return Object.entries(diagnostics.config)
      .filter(([, present]) => !present)
      .map(([key]) => key);
  }, [diagnostics]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-500">
          Loading billing diagnostics...
        </div>
      </main>
    );
  }

  if (!diagnostics) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <Link href="/admin" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
            ← Back to admin
          </Link>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Billing diagnostics
            </p>

            <h1 className="mb-4 text-4xl font-semibold tracking-tight">
              Unable to load billing diagnostics.
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
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Administration
          </p>

          <h1 className="mb-5 text-5xl font-semibold tracking-tight">
            Billing diagnostics.
          </h1>

          <p className="max-w-3xl leading-relaxed text-zinc-400">
            Read-only billing visibility for Stripe configuration presence,
            subscription identity sync, and Extra AI Pack fulfillment. Secret
            values are never displayed.
          </p>
        </div>

        {message && (
          <p className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </p>
        )}

        <section className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Metric label="Entitlements" value={diagnostics.entitlementSummary.totalEntitlements} />
          <Metric label="Stripe customers" value={diagnostics.entitlementSummary.stripeLinked} />
          <Metric label="Subscriptions" value={diagnostics.entitlementSummary.subscriptionLinked} />
          <Metric label="Extra credit packs" value={diagnostics.extraCreditStats.totalPacks} />
          <Metric label="Credits purchased" value={diagnostics.extraCreditStats.purchasedCredits} />
          <Metric label="Credits remaining" value={diagnostics.extraCreditStats.remainingCredits} />
          <Metric label="Ledger entries" value={diagnostics.ledgerStats.totalLedgerEntries} />
          <Metric label="Net ledger credits" value={diagnostics.ledgerStats.netCreditsDelta} />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wide text-zinc-600">
                Configuration
              </p>
              <h2 className="text-2xl font-medium">Safe Stripe/Vercel config presence</h2>
            </div>

            <p className="text-sm text-zinc-500">
              Missing: {missingConfig.length}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(diagnostics.config).map(([key, present]) => (
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

        <section className="mb-8 grid gap-6 lg:grid-cols-3">
          <SummaryCard
            title="Plan counts"
            items={diagnostics.entitlementSummary.planCounts}
          />
          <SummaryCard
            title="Subscription statuses"
            items={diagnostics.entitlementSummary.subscriptionStatuses}
          />
          <SummaryCard
            title="Extra credit pack statuses"
            items={diagnostics.extraCreditStats.byStatus}
          />
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-5 text-2xl font-medium">Recent billing entitlements</h2>

          <div className="space-y-3">
            {diagnostics.recentEntitlements.length === 0 ? (
              <p className="text-sm text-zinc-500">No entitlement records found.</p>
            ) : (
              diagnostics.recentEntitlements.map((entitlement) => (
                <div key={entitlement.user_id} className="rounded-2xl border border-zinc-900 bg-black p-4">
                  <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                    <Info label="User" value={maskId(entitlement.user_id)} />
                    <Info label="Tier" value={entitlement.tier ?? "—"} />
                    <Info label="AI enabled" value={entitlement.ai_assisted_enabled ? "Yes" : "No"} />
                    <Info label="Status" value={entitlement.stripe_subscription_status ?? "—"} />
                    <Info label="Customer" value={maskId(entitlement.stripe_customer_id)} />
                    <Info label="Subscription" value={maskId(entitlement.stripe_subscription_id)} />
                    <Info label="Price" value={maskId(entitlement.stripe_price_id)} />
                    <Info label="Period end" value={formatDate(entitlement.stripe_current_period_end)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-5 text-2xl font-medium">Recent Extra AI Packs</h2>

            <div className="space-y-3">
              {diagnostics.recentPacks.length === 0 ? (
                <p className="text-sm text-zinc-500">No Extra AI Pack records found.</p>
              ) : (
                diagnostics.recentPacks.slice(0, 12).map((pack) => (
                  <div key={pack.id} className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Info label="Pack" value={maskId(pack.id)} />
                      <Info label="User" value={maskId(pack.user_id)} />
                      <Info label="Status" value={pack.status ?? "—"} />
                      <Info label="Source" value={pack.source ?? "—"} />
                      <Info label="Purchased" value={`${pack.purchased_credits ?? 0}`} />
                      <Info label="Remaining" value={`${pack.remaining_credits ?? 0}`} />
                      <Info label="Checkout" value={maskId(pack.stripe_checkout_session_id)} />
                      <Info label="Created" value={formatDate(pack.created_at)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-5 text-2xl font-medium">Recent credit ledger</h2>

            <div className="space-y-3">
              {diagnostics.recentLedger.length === 0 ? (
                <p className="text-sm text-zinc-500">No Extra AI Pack ledger entries found.</p>
              ) : (
                diagnostics.recentLedger.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm">
                    <div className="grid gap-3 md:grid-cols-2">
                      <Info label="Entry" value={maskId(entry.id)} />
                      <Info label="User" value={maskId(entry.user_id)} />
                      <Info label="Delta" value={`${entry.credits_delta ?? 0}`} />
                      <Info label="Reason" value={entry.reason ?? "—"} />
                      <Info label="Checkout" value={maskId(entry.stripe_checkout_session_id)} />
                      <Info label="Created" value={formatDate(entry.created_at)} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value.toLocaleString()}</p>
    </div>
  );
}

function SummaryCard({
  title,
  items,
}: {
  title: string;
  items: Record<string, number>;
}) {
  const entries = Object.entries(items).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
      <h2 className="mb-5 text-2xl font-medium">{title}</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">No records.</p>
      ) : (
        <div className="space-y-3">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-900 bg-black px-4 py-3">
              <span className="text-sm text-zinc-400">{key.replaceAll("_", " ")}</span>
              <span className="text-sm text-white">{value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-zinc-700">{label}</p>
      <p className="mt-1 break-words text-zinc-300">{value}</p>
    </div>
  );
}
