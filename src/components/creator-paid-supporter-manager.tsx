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
    approvedFeeBps: number;
    minimumPriceCents: number;
    maximumPriceCents: number;
    platformFeeApproved: boolean;
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
    setPrices(Object.fromEntries((next.tiers ?? []).map((tier) => [tier.id, tier.price_cents ? (tier.price_cents / 100).toFixed(2) : ""])));
    setModes(Object.fromEntries((next.tiers ?? []).map((tier) => [tier.id, tier.access_mode ?? "free"])));
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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
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
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
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
      setMessage(mode === "paid" ? `${tier.name} is configured as a paid monthly tier.` : `${tier.name} remains a free tier.`);
    }
  }

  const liveSubscriptions = useMemo(
    () => (payload?.subscriptions ?? []).filter((subscription) => ["incomplete", "trialing", "active", "past_due", "unpaid"].includes(subscription.status)),
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

  const payoutReady = Boolean(payload.payout?.details_submitted && payload.payout?.payouts_enabled);
  const approvedFeePercent = payload.configuration.approvedFeeBps / 100;
  const minimumMonthlyPrice = payload.configuration.minimumPriceCents / 100;
  const maximumMonthlyPrice = payload.configuration.maximumPriceCents / 100;

  return (
    <section className="creator-paid-supporter-manager">
      <header>
        <div>
          <p>Paid supporters</p>
          <h3>Build recurring support around your work.</h3>
          <span>
            Set up monthly supporter tiers, creator payouts, and subscription management. Loombus retains the approved 15% platform fee on paid supporter subscriptions.
          </span>
        </div>
        <div className={payload.configuration.ready ? "is-ready" : ""}>
          <ShieldCheck aria-hidden="true" />
          {payload.configuration.ready ? "Available" : "Not yet enabled"}
        </div>
      </header>

      {native ? (
        <div className="creator-paid-supporter-notice is-warning">
          <WalletCards aria-hidden="true" />
          <div>
            <strong>Use Loombus on the web for billing setup</strong>
            <p>Paid tier setup and external checkout are not presented inside the iOS or Android app in this release. Existing supporters can still use their access in the app.</p>
          </div>
        </div>
      ) : null}

      {!payload.configuration.ready ? (
        <div className="creator-paid-supporter-readiness">
          <strong>Paid supporter checkout is being prepared.</strong>
          <span data-ready={payload.configuration.betaEnabled}>Checkout access</span>
          <span data-ready={payload.configuration.stripeReady}>Payments</span>
          <span data-ready={payload.configuration.serviceReady}>Account services</span>
          <span data-ready={payload.configuration.automaticTaxEnabled}>Tax handling</span>
          <span data-ready={payload.configuration.platformFeeApproved}>Platform fee</span>
        </div>
      ) : null}

      <div className="creator-paid-supporter-summary">
        <article>
          <BadgeDollarSign aria-hidden="true" />
          <strong>{approvedFeePercent}%</strong>
          <span>Platform fee</span>
        </article>
        <article>
          <Banknote aria-hidden="true" />
          <strong>{liveSubscriptions.length}</strong>
          <span>Active paid supporters</span>
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
            <strong>Payout account</strong>
            <span>Connect the account that receives supporter revenue. Stripe collects identity, tax, and bank information; Loombus does not store bank credentials.</span>
          </div>
          <span className={payoutReady ? "is-ready" : ""}>{payoutReady ? "Payouts ready" : "Setup required"}</span>
        </div>
        <div className="creator-paid-supporter-actions">
          <button type="button" disabled={native || Boolean(working) || !payload.configuration.ready} onClick={() => void startOnboarding()}>
            {working === "start_onboarding" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <WalletCards aria-hidden="true" />}
            {payoutReady ? "Review payout setup" : "Set up payouts"}
          </button>
          {payload.payout?.details_submitted ? (
            <button type="button" className="is-secondary" disabled={native || Boolean(working)} onClick={() => void openDashboard()}>
              <ExternalLink aria-hidden="true" /> Open Stripe Express
            </button>
          ) : null}
        </div>
      </section>

      <section className="creator-paid-supporter-card">
        <div className="creator-paid-supporter-card-heading">
          <div>
            <strong>Support tiers</strong>
            <span>Configure free or paid monthly access. Paid tiers support USD monthly prices from $5 to $1,000.</span>
          </div>
        </div>
        <div className="creator-paid-supporter-tier-list">
          {payload.tiers.map((tier) => (
            <article key={tier.id}>
              <div>
                <strong>{tier.name}</strong>
                <small>{tier.access_mode === "paid" ? `${money(tier.price_cents)}/month` : "Free access"}</small>
              </div>
              <label>
                <span>Access</span>
                <select value={modes[tier.id] ?? tier.access_mode} disabled={native || Boolean(working)} onChange={(event) => setModes((current) => ({ ...current, [tier.id]: event.target.value === "paid" ? "paid" : "free" }))}>
                  <option value="free">Free</option>
                  <option value="paid">Paid monthly</option>
                </select>
              </label>
              <label>
                <span>Monthly price</span>
                <div className="creator-paid-supporter-price-input">
                  <span>$</span>
                  <input type="number" min={minimumMonthlyPrice} max={maximumMonthlyPrice} step="0.01" value={prices[tier.id] ?? ""} disabled={native || Boolean(working) || (modes[tier.id] ?? "free") !== "paid"} onChange={(event) => setPrices((current) => ({ ...current, [tier.id]: event.target.value }))} />
                  <span>/month</span>
                </div>
              </label>
              <button type="button" disabled={native || Boolean(working) || !payoutReady || !payload.configuration.ready} onClick={() => void savePricing(tier)}>
                {working === "save_pricing" ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Save pricing
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="creator-paid-supporter-card">
        <div className="creator-paid-supporter-card-heading">
          <div>
            <strong>Subscriptions</strong>
            <span>Review active supporters, renewals, cancellations, payment status, and refund activity.</span>
          </div>
        </div>
        {payload.subscriptions.length ? (
          <div className="creator-paid-supporter-subscriptions">
            {payload.subscriptions.map((subscription) => (
              <article key={subscription.id}>
                <div>
                  <strong>{subscription.profile?.full_name || subscription.profile?.username || "Loombus supporter"}</strong>
                  <small>{money(subscription.amount_cents)}/month · {subscription.status}{subscription.cancel_at_period_end ? " · ends after current period" : ""}</small>
                </div>
                <span className={subscription.billing_hold ? "is-hold" : ""}>{subscription.billing_hold ? "Billing hold" : "Synchronized"}</span>
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
              <strong>Refund reviews</strong>
              <span>Requests remain subject to manual provider review. No refund is issued automatically from this screen.</span>
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
