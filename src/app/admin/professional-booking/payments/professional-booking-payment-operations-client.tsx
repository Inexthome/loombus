"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Payment = {
  id: string;
  appointmentRequestId: string;
  serviceName: string;
  requesterName: string;
  requesterHandle: string | null;
  providerName: string;
  providerHandle: string | null;
  appointmentStatus: string;
  paymentStatus: string;
  grossAmountCents: number;
  currency: string;
  platformFeeCents: number;
  providerNetBeforeProcessingCents: number;
  authorizationExpiresAt: string | null;
  authorizedAt: string | null;
  capturedAt: string | null;
  canceledAt: string | null;
  refundedAt: string | null;
  updatedAt: string | null;
  latestErrorCode: string | null;
  latestAttemptStatus: string | null;
  livemode: boolean | null;
  expiringSoon: boolean;
  needsAttention: boolean;
};

type Dispute = {
  id: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  reason: string;
  status: string;
  evidenceDueAt: string | null;
  evidencePastDue: boolean | null;
  stripeCreatedAt: string | null;
  lastSyncedAt: string | null;
  resolvedAt: string | null;
};

type Diagnostics = {
  generatedAt: string;
  runtime: {
    paymentsEnabled: boolean;
    livePaymentsAllowed: boolean;
  };
  summary: {
    total: number;
    authorized: number;
    expiringSoon: number;
    attention: number;
    captured: number;
    refunded: number;
    authorizationExpired: number;
    openDisputes: number;
  };
  payments: Payment[];
  disputes: Dispute[];
};

function money(cents: number, currency = "usd") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents || 0) / 100);
}

function dateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function humanize(value: string | null | undefined) {
  if (!value) return "Unknown";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function expiryLabel(value: string | null) {
  if (!value) return "No deadline";
  const remaining = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(remaining)) return "No deadline";
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  if (hours < 1) return `${Math.max(1, Math.ceil(remaining / 60_000))}m remaining`;
  if (hours < 48) return `${hours}h remaining`;
  return `${Math.ceil(hours / 24)}d remaining`;
}

function badgeClass(status: string, attention = false) {
  if (attention) return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (["captured", "refunded", "won", "prevented"].includes(status)) {
    return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (["canceled", "cancelled", "authorization_expired", "lost"].includes(status)) {
    return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  }
  return "border-zinc-400/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300";
}

export default function ProfessionalBookingPaymentOperationsClient() {
  const [data, setData] = useState<Diagnostics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/professional-booking/payments", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        return;
      }
      if (!response.ok) {
        setAuthorized(true);
        setAuthChecked(true);
        setMessage(result.error ?? "Unable to load Professional Booking payment operations.");
        return;
      }

      setData(result as Diagnostics);
      setAuthorized(true);
      setAuthChecked(true);
    } catch {
      setAuthorized(true);
      setAuthChecked(true);
      setMessage("Unable to load Professional Booking payment operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredPayments = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (data?.payments ?? []).filter((payment) => {
      if (filter === "authorized" && payment.paymentStatus !== "authorized") return false;
      if (filter === "expiring" && !payment.expiringSoon) return false;
      if (filter === "attention" && !payment.needsAttention) return false;
      if (filter === "captured" && payment.paymentStatus !== "captured") return false;
      if (filter === "refunded" && payment.paymentStatus !== "refunded") return false;
      if (filter === "expired" && payment.paymentStatus !== "authorization_expired") return false;
      if (!normalized) return true;
      return [
        payment.id,
        payment.appointmentRequestId,
        payment.serviceName,
        payment.requesterName,
        payment.requesterHandle,
        payment.providerName,
        payment.providerHandle,
        payment.appointmentStatus,
        payment.paymentStatus,
        payment.latestErrorCode,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [data, filter, query]);

  if (loading || !authChecked) {
    return (
      <main className="mx-auto min-h-screen max-w-[1500px] px-4 py-10 sm:px-6">
        <p className="text-sm text-zinc-500">Loading Professional Booking payment operations…</p>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 sm:px-6">
        <div className="rounded-3xl border border-red-500/30 bg-red-500/5 p-8">
          <h1 className="text-2xl font-semibold">Admin access required</h1>
          <p className="mt-3 text-sm text-zinc-500">This Professional Booking payment view is restricted to Loombus administrators.</p>
          <Link href="/" className="mt-6 inline-flex font-semibold text-[#a78637]">Return to Loombus</Link>
        </div>
      </main>
    );
  }

  const summary = data?.summary;
  const cards = [
    ["Authorized", summary?.authorized ?? 0, Clock3, "Awaiting provider action"],
    ["Expiring ≤24h", summary?.expiringSoon ?? 0, AlertTriangle, "Authorization deadline"],
    ["Needs attention", summary?.attention ?? 0, RotateCcw, "Pending reconciliation or error"],
    ["Captured", summary?.captured ?? 0, CheckCircle2, "Successfully paid"],
    ["Refunded", summary?.refunded ?? 0, RefreshCw, "Full refund recorded"],
    ["Authorization expired", summary?.authorizationExpired ?? 0, Clock3, "Authorization no longer usable"],
    ["Open disputes", summary?.openDisputes ?? 0, ShieldCheck, "Read-only dispute queue"],
  ] as const;

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-zinc-500 hover:text-[#a78637]">
            <ArrowLeft size={16} /> Admin Operations
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a78637]">Professional Booking</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Payment Operations</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-500">
            Read-only operational visibility for authorization, capture, refund, reconciliation, and dispute state. No money-moving controls are exposed here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-2 rounded-full border border-[#CBAB5B]/50 px-5 py-3 text-sm font-semibold hover:bg-[#CBAB5B]/10 disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          {refreshing ? "Refreshing" : "Refresh view"}
        </button>
      </div>

      {message ? (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm text-red-700 dark:text-red-300">{message}</div>
      ) : null}

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
        {cards.map(([label, value, Icon, detail]) => (
          <div key={label} className="rounded-2xl border border-zinc-200/80 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</span>
              <Icon size={17} className="text-[#a78637]" />
            </div>
            <div className="mt-3 text-3xl font-semibold">{value}</div>
            <p className="mt-1 text-xs text-zinc-500">{detail}</p>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-3xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Runtime gates</h2>
            <p className="mt-1 text-sm text-zinc-500">Configuration state only. Environment values and secrets are never returned.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${data?.runtime.paymentsEnabled ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-zinc-400/30 bg-zinc-500/10 text-zinc-600"}`}>
              Payments {data?.runtime.paymentsEnabled ? "enabled" : "disabled"}
            </span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${data?.runtime.livePaymentsAllowed ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
              Live payments {data?.runtime.livePaymentsAllowed ? "allowed" : "blocked"}
            </span>
          </div>
        </div>
      </section>

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Payment lifecycle</h2>
            <p className="mt-1 text-sm text-zinc-500">{filteredPayments.length} of {data?.payments.length ?? 0} loaded payments</p>
          </div>
          <div className="flex flex-1 flex-wrap justify-end gap-2">
            <label className="relative min-w-[240px] max-w-sm flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search service, member, status…"
                className="w-full rounded-xl border border-zinc-300 bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#CBAB5B] dark:border-zinc-700"
              />
            </label>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="rounded-xl border border-zinc-300 bg-transparent px-3 py-2.5 text-sm dark:border-zinc-700"
            >
              <option value="all">All payments</option>
              <option value="authorized">Authorized</option>
              <option value="expiring">Expiring ≤24h</option>
              <option value="attention">Needs attention</option>
              <option value="captured">Captured</option>
              <option value="refunded">Refunded</option>
              <option value="expired">Authorization expired</option>
            </select>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {filteredPayments.map((payment) => (
            <article key={payment.id} className="rounded-2xl border border-zinc-200/80 bg-white/70 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/50">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{payment.serviceName}</h3>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(payment.paymentStatus, payment.needsAttention)}`}>
                      {humanize(payment.paymentStatus)}
                    </span>
                    <span className="rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-semibold text-zinc-500 dark:border-zinc-700">
                      {payment.livemode === true ? "Live" : payment.livemode === false ? "Test" : "Mode unknown"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-zinc-500">Appointment {humanize(payment.appointmentStatus)} · Updated {dateTime(payment.updatedAt)}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-semibold">{money(payment.grossAmountCents, payment.currency)}</div>
                  <div className="text-xs text-zinc-500">Gross booking amount</div>
                </div>
              </div>

              <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-xs uppercase tracking-wide text-zinc-500">Requester</div><div className="mt-1 font-medium">{payment.requesterName}</div><div className="text-xs text-zinc-500">{payment.requesterHandle ? `@${payment.requesterHandle}` : "No public handle"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-zinc-500">Provider</div><div className="mt-1 font-medium">{payment.providerName}</div><div className="text-xs text-zinc-500">{payment.providerHandle ? `@${payment.providerHandle}` : "No public handle"}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-zinc-500">Loombus fee</div><div className="mt-1 font-medium">{money(payment.platformFeeCents, payment.currency)}</div><div className="text-xs text-zinc-500">Provider before processing: {money(payment.providerNetBeforeProcessingCents, payment.currency)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-zinc-500">Authorization deadline</div><div className={`mt-1 font-medium ${payment.expiringSoon ? "text-amber-700 dark:text-amber-300" : ""}`}>{expiryLabel(payment.authorizationExpiresAt)}</div><div className="text-xs text-zinc-500">{dateTime(payment.authorizationExpiresAt)}</div></div>
              </div>

              <div className="mt-5 grid gap-3 rounded-xl bg-zinc-100/70 p-4 text-xs dark:bg-zinc-900/70 sm:grid-cols-2 lg:grid-cols-4">
                <div><span className="text-zinc-500">Authorized:</span> {dateTime(payment.authorizedAt)}</div>
                <div><span className="text-zinc-500">Captured:</span> {dateTime(payment.capturedAt)}</div>
                <div><span className="text-zinc-500">Cancelled:</span> {dateTime(payment.canceledAt)}</div>
                <div><span className="text-zinc-500">Refunded:</span> {dateTime(payment.refundedAt)}</div>
              </div>

              {payment.needsAttention ? (
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                  <span><strong>Operational attention</strong></span>
                  <span>Attempt: {humanize(payment.latestAttemptStatus)}</span>
                  <span>Error: {payment.latestErrorCode || "Pending lifecycle state"}</span>
                </div>
              ) : null}
            </article>
          ))}
          {filteredPayments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">No payments match this view.</div>
          ) : null}
        </div>
      </section>

      <section className="mt-10 pb-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold">Dispute queue</h2>
            <p className="mt-1 text-sm text-zinc-500">Read-only Stripe dispute synchronization state. Evidence submission is intentionally unavailable.</p>
          </div>
          <CreditCard size={20} className="text-[#a78637]" />
        </div>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-zinc-100/80 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900/80">
              <tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Evidence due</th><th className="px-4 py-3">Opened</th><th className="px-4 py-3">Last synced</th></tr>
            </thead>
            <tbody>
              {(data?.disputes ?? []).map((dispute) => (
                <tr key={dispute.id} className="border-t border-zinc-200/80 dark:border-zinc-800">
                  <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeClass(dispute.status, dispute.evidencePastDue === true)}`}>{humanize(dispute.status)}</span></td>
                  <td className="px-4 py-3">{humanize(dispute.reason)}</td>
                  <td className="px-4 py-3 font-medium">{money(dispute.amountCents, dispute.currency)}</td>
                  <td className="px-4 py-3">{dateTime(dispute.evidenceDueAt)}{dispute.evidencePastDue ? <div className="mt-1 text-xs font-semibold text-red-600">Past due</div> : null}</td>
                  <td className="px-4 py-3">{dateTime(dispute.stripeCreatedAt)}</td>
                  <td className="px-4 py-3">{dateTime(dispute.lastSyncedAt)}</td>
                </tr>
              ))}
              {(data?.disputes.length ?? 0) === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No Professional Booking disputes are recorded.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-zinc-500">Snapshot generated {dateTime(data?.generatedAt)}. This page does not expose Stripe credentials, card data, PaymentIntent IDs, Connect account IDs, or money-moving actions.</p>
      </section>
    </main>
  );
}
