"use client";

import { Capacitor } from "@capacitor/core";
import {
  BadgeDollarSign,
  Banknote,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import "./creator-paid-supporter-manager.css";

type BillingTier = {
  id: string;
  name: string;
  access_mode: "free" | "paid";
  price_cents: number | null;
  currency: string | null;
  billing_interval: string | null;
};

type BillingPayload = {
  configuration: {
    betaEnabled: boolean;
    automaticTaxEnabled: boolean;
    stripeReady: boolean;
    serviceReady: boolean;
    feeBps: number | null;
    ready: boolean;
  };
  payout: {
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    requirements_due: string[] | null;
    country: string | null;
    default_currency: string | null;
  } | null;
  tiers: BillingTier[];
  subscriptions: Array<{
    id: string;
    supporter_id: string;
    tier_id: string;
    status: string;
    billing_hold: boolean;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
    amount_cents: number;
    currency: string;
    profile: {
      full_name: string | null;
      username: string | null;
    } | null;
  }>;
  refundRequests: Array<{
    id: string;
    supporter_id: string;
    reason: string;
    requested_amount_cents: number | null;
    status: string;
    created_at: string;
  }>;
  error?: string;
};

function money(cents: number | null | undefined) {
  if (!cents) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function CreatorPaidSupporterManager() {
  const [payload, setPayload] = useState<BillingPayload | null>(null);
  const [native, setNative] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [modes, setModes] = useState<Record<string, "free" | "paid">>({});

  async function token() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  function applyPayload(next: BillingPayload) {
    setPayload(next);
    setPrices(
      Object.fromEntries(
        (next.tiers ?? []).map((tier) => [
          tier.id,
          tier.price_cents ? (tier.price_cents / 100).toFixed(2) : "",
        ])
      )
    );
    setModes(
      Object.fromEntries(
        (next.tiers ?? []).map((tier) => [tier.id, tier.access_mode ?? "free"])
      )
    );
  }

  async function load(refreshPayout = false) {
    const accessToken = await token();
    if (!accessToken) {
      window.location.href = "/login?next=/profile?section=creator";
      return;
    }
    if (refreshPayout) {
      await fetch("/api/creator/supporter-billing/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "refresh_payout" }),
      });
    }
    const response = await fetch("/api/creator/supporter-billing/settings", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as BillingPayload;
    if (!response.ok) {
      setMessage(result.error ?? "Unable to load paid supporter settings.");
      setLoading(false);
      return;
    }
    applyPayload(result);
    setLoading(false);
  }

  useEffect(() => {
    setNative(Capacitor.isNativePlatform());
    const payoutReturn = new URLSearchParams(window.location.search).has("payout");
    void load(payoutReturn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function action(actionName: string, extras: Record<string, unknown> = {}) {
    if (working) return null;
    setWorking(actionName);
    setMessage("");
    const accessToken = await token();
    if (!accessToken) return null;
    const response = await fetch("/api/creator/supporter-billing/settings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: actionName, ...extras }),
    });
    const result = await response.json().catch(() => ({}));
    setWorking("");
    if (!response.ok) {
      setMessage(result.error ?? "Unable to update paid supporter settings.");
      return null;
    }
    return result;
  }

  async function startOnboarding() {
    const result = await action("start_onboarding");
    if (result?.url) window.location.href = result.url;
  }

  async function openDashboard() {
    const result = await action("open_dashboard");
    if (result?.url) window.location.href = result.url;
  }

  async function savePricing(tier: BillingTier) {
    const mode = modes[tier.id] ?? "free";
    const dollars = Number(prices[tier.id]);
    const result = (await action("save_pricing", {
      tierId: tier.id,
      accessMode: mode,
      priceCents: mode === "paid" ? Math.round(dollars * 100) : null,
    })) as BillingPayload | null;
    if (result?.configuration) {
      applyPayload(result);
      setMessage(
        mode === "paid"
          ? `${tier.name} is configured as a paid monthly tier.`
          : `${tier.name} remains a free tier.`
      );
    }
  }

  const liveSubscriptions = useMemo(
    () =>
      (payload?.subscriptions ?? []).filter((subscription) =>
        ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(
          subscription.status
        )
      ),
    [payload?.subscriptions]
  );

  if (loading) {
    return (
      <section className="creator-paid-supporter-manager is-loading" aria-busy="true">
        <Loader2 className="animate-spin" aria-hidden="true" />
        Loading paid supporter subscriptions…
      </section>
    );
  }
  if (!payload) return null;

  const payoutReady = Boolean(
    payload.payout?.details_submitted && payload.payout?.payouts_enabled
  );
  const feePercent =
    payload.configuration.feeBps === null
      ? null
      : payload.configuration.feeBps / 100;

  return (
    <section className="creator-paid-supporter-manager">
      <header>
        <div>
          <p>Creator Supporters · Phase 2B</p>
          <h3>Paid monthly supporter subscriptions</h3>
          <span>
            Web checkout uses Stripe Connect. Loombus retains the configured platform fee and transfers the remaining subscription revenue to the creator payout account.
          </span>
        </div>
        <div className={payload.configuration.ready ? "is-ready" : ""}>
          <ShieldCheck aria-hidden="true" />
          {payload.configuration.ready ? "Paid beta configured" : "Paid beta gated"}
        </div>
      </header>

      {native ? (
        <div className="creator-paid-supporter-notice is-warning">
          <WalletCards aria-hidden="true" />
          <div>
            <strong>Use Loombus on the web for creator billing setup</strong>
            <p>
              Paid tier setup and external checkout are not presented inside the iOS or Android app in this release. Existing supporters can still use their access in the app.
            </p>
          </div>
        </div>
      ) : null}

      {!payload.configuration.ready ? (
        <div className="creator-paid-supporter-readiness">
          <strong>Production controls required before paid checkout opens</strong>
          <span data-ready={payload.configuration.betaEnabled}>Paid beta feature flag</span>
          <span data-ready={payload.configuration.stripeReady}>Stripe key and webhook</span>
          <span data-ready={payload.configuration.serviceReady}>Supabase service role</span>
          <span data-ready={payload.configuration.automaticTaxEnabled}>Stripe automatic tax decision</span>
          <span data-ready={payload.configuration.feeBps !== null}>Loombus platform fee</span>
        </div>
      ) : null}

      <div className="creator-paid-supporter-summary">
        <article>
          <BadgeDollarSign aria-hidden="true" />
          <strong>{feePercent === null ? "Not set" : `${feePercent}%`}</strong>
          <span>Loombus platform fee</span>
        </article>
        <article>
          <Banknote aria-hidden="true" />
          <strong>{liveSubscriptions.length}</strong>
          <span>Live paid subscriptions</span>
        </article>
        <article>
          <RefreshCw aria-hidden="true" />
          <strong>{payload.refundRequests.length}</strong>
          <span>Refund reviews</span>
        </article>
      </div>

      <section className="creator-paid-supporter-card">
        <div className="creator-paid-supporter-card-heading">
          <div>
            <strong>Creator payout account</strong>
            <span>
              Stripe collects creator identity, tax, and bank information. Loombus does not store bank credentials.
            </span>
          </div>
          <span className={payoutReady ? "is-ready" : ""}>
            {payoutReady ? "Payouts ready" : "Setup required"}
          </span>
        </div>
        <div className="creator-paid-supporter-actions">
          <button
            type="button"
            disabled={native || Boolean(working) || !payload.configuration.ready}
            onClick={() => void startOnboarding()}
          >
            {working === "start_onboarding" ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <WalletCards aria-hidden="true" />
            )}
            {payoutReady ? "Review payout setup" : "Start payout setup"}
          </button>
          {payload.payout?.details_submitted ? (
            <button
              type="button"
              className="is-secondary"
              disabled={native || Boolean(working)}
              onClick={() => void openDashboard()}
            >
              <ExternalLink aria-hidden="true" /> Open Stripe Express
            </button>
          ) : null}
        </div>
      </section>

      <section className="creator-paid-supporter-card">
        <div className="creator-paid-supporter-card-heading">
          <div>
            <strong>Tier pricing</strong>
            <span>
              The controlled beta supports USD monthly prices from $1 to $1,000. Existing paid subscriptions must be cancelled before changing their billing contract.
            </span>
          </div>
        </div>
        <div className="creator-paid-supporter-tier-list">
          {payload.tiers.map((tier) => (
            <article key={tier.id}>
              <div>
                <strong>{tier.name}</strong>
                <small>
                  {tier.access_mode === "paid"
                    ? `${money(tier.price_cents)}/month`
                    : "Free access"}
                </small>
              </div>
              <label>
                <span>Access</span>
                <select
                  value={modes[tier.id] ?? tier.access_mode}
                  disabled={native || Boolean(working)}
                  onChange={(event) =>
                    setModes((current) => ({
                      ...current,
                      [tier.id]: event.target.value === "paid" ? "paid" : "free",
                    }))
                  }
                >
                  <option value="free">Free</option>
                  <option value="paid">Paid monthly</option>
                </select>
              </label>
              <label>
                <span>Monthly price</span>
                <div className="creator-paid-supporter-price-input">
                  <span>$</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.01"
                    value={prices[tier.id] ?? ""}
                    disabled={
                      native || Boolean(working) || (modes[tier.id] ?? "free") !== "paid"
                    }
                    onChange={(event) =>
                      setPrices((current) => ({
                        ...current,
                        [tier.id]: event.target.value,
                      }))
                    }
                  />
                  <span>/month</span>
                </div>
              </label>
              <button
                type="button"
                disabled={
                  native ||
                  Boolean(working) ||
                  !payoutReady ||
                  !payload.configuration.ready
                }
                onClick={() => void savePricing(tier)}
              >
                {working === "save_pricing" ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                Save pricing
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="creator-paid-supporter-card">
        <div className="creator-paid-supporter-card-heading">
          <div>
            <strong>Paid subscription operations</strong>
            <span>
              Renewals, failed payments, cancellations, and disputes synchronize from Stripe. Refund requests remain manual review in this beta.
            </span>
          </div>
        </div>
        {payload.subscriptions.length ? (
          <div className="creator-paid-supporter-subscriptions">
            {payload.subscriptions.map((subscription) => (
              <article key={subscription.id}>
                <div>
                  <strong>
                    {subscription.profile?.full_name ||
                      subscription.profile?.username ||
                      "Loombus supporter"}
                  </strong>
                  <small>
                    {money(subscription.amount_cents)}/month · {subscription.status}
                    {subscription.cancel_at_period_end ? " · ends after current period" : ""}
                  </small>
                </div>
                <span className={subscription.billing_hold ? "is-hold" : ""}>
                  {subscription.billing_hold ? "Billing hold" : "Synchronized"}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className="creator-paid-supporter-empty">No paid supporter subscriptions yet.</p>
        )}
      </section>

      {payload.refundRequests.length ? (
        <section className="creator-paid-supporter-card">
          <div className="creator-paid-supporter-card-heading">
            <div>
              <strong>Refund review queue</strong>
              <span>
                These requests require manual provider review. No refund is issued automatically by this screen.
              </span>
            </div>
          </div>
          <div className="creator-paid-supporter-refunds">
            {payload.refundRequests.map((request) => (
              <article key={request.id}>
                <div>
                  <strong>{money(request.requested_amount_cents)} requested</strong>
                  <p>{request.reason}</p>
                </div>
                <span>{request.status.replaceAll("_", " ")}</span>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {message ? <p className="creator-paid-supporter-message" role="status">{message}</p> : null}
    </section>
  );
}
