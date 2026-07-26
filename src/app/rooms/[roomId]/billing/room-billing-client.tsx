"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Plan = {
  id: string;
  label: string;
  priceLabel: string;
  memberLimit: number | null;
  roomLimit: number | null;
  storageBytes: number;
  features: string[];
  selfServe: boolean;
  contactSales: boolean;
};

type BillingOverview = {
  room: {
    id: string;
    name: string;
    planKey: string;
    subscribedPlanKey: string;
    subscriptionStatus: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    canceledAt: string | null;
  };
  currentPlan: Plan;
  availablePlans: Plan[];
  usage: {
    memberCount: number;
    memberLimit: number | null;
    usedStorageBytes: number | null;
    storageLimitBytes: number;
    overMemberLimit: boolean;
    overStorageLimit: boolean;
  };
  billingConfigured: boolean;
  hasStripeSubscription: boolean;
  invoices: Array<{
    id: string;
    number: string | null;
    status: string | null;
    amountPaid: number;
    currency: string;
    createdAt: string;
    hostedInvoiceUrl: string | null;
    invoicePdf: string | null;
  }>;
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatBytes(value: number | null) {
  if (value === null) return "Usage unavailable";
  if (value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function usagePercent(used: number, limit: number | null) {
  if (limit === null || limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function planCapacityLabel(plan: Plan) {
  if (plan.roomLimit === null || plan.memberLimit === null) {
    return "Custom Room and member capacity";
  }
  if (plan.roomLimit === 1) {
    return `1 Room · Up to ${plan.memberLimit.toLocaleString("en-US")} members`;
  }
  return `Up to ${plan.roomLimit.toLocaleString("en-US")} Rooms · ${plan.memberLimit.toLocaleString("en-US")} members per Room`;
}

export default function RoomBillingClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/billing`)}`;
        return;
      }
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/billing`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as BillingOverview;
      if (response.status === 401) {
        window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/billing`)}`;
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Room billing could not be loaded.");
      setOverview(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room billing could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(action: string, payload: Record<string, unknown> = {}) {
    if (!roomId || working) return;
    setWorking(action);
    setMessage("");
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to manage Room billing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/billing`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        url?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Room billing could not be updated.");
      if (result.url) {
        window.location.href = result.url;
        return;
      }
      setMessage(
        action === "schedule_cancel"
          ? "Cancellation is scheduled for the end of the current billing period."
          : action === "resume"
            ? "The Room subscription will continue."
            : "Room billing was updated."
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room billing could not be updated.");
    } finally {
      setWorking("");
    }
  }

  if (loading) {
    return (
      <main className="rooms-live-page">
        <section className="rooms-live-state-card">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <h1>Loading Room billing…</h1>
          <p>Only the verified Room owner can open subscription details.</p>
        </section>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="rooms-live-page">
        <div className="rooms-live-shell">
          <Link href={`/rooms/${roomId}`} className="rooms-live-back-link">
            <ArrowLeft aria-hidden="true" /> Back to Room
          </Link>
          <section className="rooms-live-state-card">
            <XCircle aria-hidden="true" />
            <h1>Room billing is unavailable.</h1>
            <p>{error || "The billing record could not be loaded."}</p>
          </section>
        </div>
      </main>
    );
  }

  const memberPercent = usagePercent(
    overview.usage.memberCount,
    overview.usage.memberLimit
  );
  const storagePercent = usagePercent(
    overview.usage.usedStorageBytes ?? 0,
    overview.usage.storageLimitBytes || null
  );

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell">
        <Link href={`/rooms/${roomId}`} className="rooms-live-back-link">
          <ArrowLeft aria-hidden="true" /> Back to Room
        </Link>

        <header className="room-workspace-hero">
          <div>
            <div className="room-workspace-badges">
              <span><ShieldCheck aria-hidden="true" /> Owner billing</span>
              <span>{overview.currentPlan.label}</span>
              <span>{overview.room.subscriptionStatus.replaceAll("_", " ")}</span>
            </div>
            <h1>{overview.room.name} billing</h1>
            <p>Manage the Room plan, payment method, invoices, cancellation, and current usage.</p>
          </div>
          <div className="room-workspace-hero-actions">
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() => void load()}
              disabled={loading || Boolean(working)}
            >
              <RefreshCw aria-hidden="true" /> Refresh
            </button>
            {overview.hasStripeSubscription ? (
              <button
                type="button"
                className="rooms-live-primary-action"
                onClick={() => void runAction("portal")}
                disabled={Boolean(working)}
              >
                {working === "portal" ? <Loader2 className="is-spinning" /> : <CreditCard />}
                Payment method and invoices
              </button>
            ) : null}
          </div>
        </header>

        {message ? <div className="rooms-live-notice">{message}</div> : null}
        {error ? <div className="rooms-live-notice is-error">{error}</div> : null}

        <section className="room-workspace-metrics">
          <article>
            <span>Current plan</span>
            <strong>{overview.currentPlan.label}</strong>
          </article>
          <article>
            <span>Monthly price</span>
            <strong>{overview.currentPlan.priceLabel}</strong>
          </article>
          <article>
            <span>Members</span>
            <strong>
              {overview.usage.memberCount}
              {overview.usage.memberLimit === null ? "" : ` / ${overview.usage.memberLimit}`}
            </strong>
          </article>
          <article>
            <span>Billing period ends</span>
            <strong>{formatDate(overview.room.currentPeriodEnd)}</strong>
          </article>
        </section>

        {overview.usage.overMemberLimit || overview.usage.overStorageLimit ? (
          <div className="rooms-live-notice is-error">
            This Room is above the active plan capacity. New paid-only activity may remain limited until membership or storage is reduced, or the Room is upgraded.
          </div>
        ) : null}

        {overview.room.cancelAtPeriodEnd ? (
          <div className="rooms-live-notice is-error">
            This subscription is scheduled to cancel on {formatDate(overview.room.currentPeriodEnd)}.
            Room paid features remain active until then.
          </div>
        ) : null}

        <div className="room-workspace-overview-grid">
          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Usage</p>
                <h2>Plan capacity</h2>
              </div>
            </div>
            <div className="room-tier-record-grid">
              <article className="room-tier-record-card">
                <div className="room-tier-record-topline">
                  <div><Users aria-hidden="true" /><span>Members</span></div>
                  <strong>{memberPercent}%</strong>
                </div>
                <h3>{overview.usage.memberCount} active members</h3>
                <p>
                  {overview.usage.memberLimit === null
                    ? "This plan has a custom membership limit."
                    : `${Math.max(0, overview.usage.memberLimit - overview.usage.memberCount)} spaces remain.`}
                </p>
                <progress value={memberPercent} max={100}>{memberPercent}%</progress>
              </article>
              <article className="room-tier-record-card">
                <div className="room-tier-record-topline">
                  <div><FileText aria-hidden="true" /><span>Storage</span></div>
                  <strong>{storagePercent}%</strong>
                </div>
                <h3>{formatBytes(overview.usage.usedStorageBytes)} used</h3>
                <p>{formatBytes(overview.usage.storageLimitBytes)} included with this plan.</p>
                <progress value={storagePercent} max={100}>{storagePercent}%</progress>
              </article>
            </div>
          </section>

          <section className="room-workspace-panel">
            <div className="room-workspace-section-heading">
              <div>
                <p className="rooms-live-eyebrow">Subscription</p>
                <h2>Cancellation controls</h2>
              </div>
            </div>
            <p>
              Cancellation takes effect at the end of the current paid period. Loombus does not remove Room content immediately.
            </p>
            {overview.hasStripeSubscription ? (
              overview.room.cancelAtPeriodEnd ? (
                <button
                  type="button"
                  className="rooms-live-primary-action"
                  disabled={Boolean(working)}
                  onClick={() => void runAction("resume")}
                >
                  {working === "resume" ? <Loader2 className="is-spinning" /> : <CheckCircle2 />}
                  Keep subscription active
                </button>
              ) : (
                <button
                  type="button"
                  className="rooms-live-secondary-action"
                  disabled={Boolean(working)}
                  onClick={() => {
                    if (window.confirm("Schedule this Room subscription to cancel at the end of the current billing period?")) {
                      void runAction("schedule_cancel");
                    }
                  }}
                >
                  {working === "schedule_cancel" ? <Loader2 className="is-spinning" /> : <XCircle />}
                  Cancel at period end
                </button>
              )
            ) : (
              <p>This Free Room has no paid subscription to cancel.</p>
            )}
          </section>
        </div>

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Plans</p>
              <h2>Upgrade or change plan</h2>
            </div>
          </div>
          <div className="room-tier-record-grid">
            {overview.availablePlans.map((plan) => {
              const current = plan.id === overview.room.planKey;
              const isFree = plan.id === "free";
              const targetTooSmall =
                plan.memberLimit !== null && overview.usage.memberCount > plan.memberLimit;
              return (
                <article key={plan.id} className="room-tier-record-card">
                  <div className="room-tier-record-topline">
                    <span className="room-tier-record-chip">{plan.priceLabel}</span>
                    {current ? <span className="room-tier-record-chip">Current</span> : null}
                  </div>
                  <h3>{plan.label}</h3>
                  <p>{planCapacityLabel(plan)}</p>
                  <ul>
                    {plan.features.slice(0, 5).map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                  {targetTooSmall ? (
                    <div className="rooms-live-notice is-error">
                      Reduce active membership to {plan.memberLimit} before selecting this plan.
                    </div>
                  ) : null}
                  {!current && plan.contactSales ? (
          <Link
            href={`/rooms/enterprise?roomId=${encodeURIComponent(roomId)}&currentPlan=${encodeURIComponent(overview.currentPlan.label)}`}
            className="rooms-live-primary-action"
          >
            <ShieldCheck aria-hidden="true" /> Contact Enterprise sales
          </Link>
        ) : null}
        {!current && !isFree && plan.selfServe ? (
          <button
            type="button"
            className="rooms-live-primary-action"
            disabled={Boolean(working) || targetTooSmall || !overview.billingConfigured}
            onClick={() => {
              const action = overview.hasStripeSubscription ? "change_plan" : "upgrade";
              const verb = overview.hasStripeSubscription ? "change" : "upgrade";
              if (window.confirm(`Confirm ${verb} to ${plan.label}? Stripe may apply prorated charges or credits.`)) {
                void runAction(action, { planKey: plan.id });
              }
            }}
          >
            {working === "change_plan" || working === "upgrade" ? (
              <Loader2 className="is-spinning" />
            ) : (
              <CheckCircle2 />
            )}
            {overview.hasStripeSubscription ? "Change to this plan" : "Upgrade to this plan"}
          </button>
        ) : null}
                  {!current && isFree ? (
                    <p>To return to Free, schedule cancellation. Paid features remain available through the current billing period.</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="room-workspace-panel">
          <div className="room-workspace-section-heading">
            <div>
              <p className="rooms-live-eyebrow">Billing history</p>
              <h2>Recent invoices</h2>
            </div>
          </div>
          {overview.invoices.length === 0 ? (
            <p>No paid Room invoices are available yet.</p>
          ) : (
            <div className="room-tier-record-grid">
              {overview.invoices.map((invoice) => (
                <article key={invoice.id} className="room-tier-record-card">
                  <div className="room-tier-record-topline">
                    <span className="room-tier-record-chip">{invoice.status ?? "Invoice"}</span>
                    <small>{formatDate(invoice.createdAt)}</small>
                  </div>
                  <h3>{invoice.number ?? "Stripe invoice"}</h3>
                  <p>{formatMoney(invoice.amountPaid, invoice.currency)}</p>
                  <div className="room-tier-inline-actions">
                    {invoice.hostedInvoiceUrl ? (
                      <a className="rooms-live-secondary-action" href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink aria-hidden="true" /> View invoice
                      </a>
                    ) : null}
                    {invoice.invoicePdf ? (
                      <a className="rooms-live-secondary-action" href={invoice.invoicePdf} target="_blank" rel="noopener noreferrer">
                        <FileText aria-hidden="true" /> PDF
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
