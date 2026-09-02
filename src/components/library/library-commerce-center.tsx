"use client";

import Link from "next/link";
import { AlertTriangle, BookOpen, CircleDollarSign, ExternalLink, Loader2, ReceiptText, WalletCards } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";

type LedgerRow = {
  id: string;
  publication_id: string;
  status: string;
  amount_cents: number;
  currency: string;
  platform_fee_cents: number;
  author_share_cents?: number;
  purchased_at: string | null;
  created_at: string;
  publication: {
    id: string;
    title: string;
    author_name: string | null;
    status: string;
    is_free: boolean;
    price_cents: number | null;
    currency: string | null;
  } | null;
};

type Payload = {
  purchases: LedgerRow[];
  sales: LedgerRow[];
  summary: {
    sale_count: number;
    gross_cents: number;
    platform_fee_cents: number;
    author_share_cents: number;
    disputed_sale_count: number;
    disputed_gross_cents: number;
  };
  payout: {
    details_submitted: boolean;
    charges_enabled: boolean;
    payouts_enabled: boolean;
    requirements_due: string[];
  } | null;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function dateLabel(value: string | null) {
  if (!value) return "Pending";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function purchaseStatusCopy(status: string) {
  if (status === "paid") return "Access active on your Loombus account.";
  if (status === "disputed") return "Payment disputed. Library access remains active while the dispute is reviewed.";
  if (status === "refunded") return "Refunded. Paid full-text access is no longer active.";
  if (status === "chargeback") return "Chargeback completed. Paid full-text access is no longer active.";
  return "This transaction has not reached an active paid-entitlement state.";
}

function canOpenReceipt(status: string) {
  return ["paid", "disputed", "refunded", "chargeback"].includes(status);
}

export function LibraryCommerceCenter() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receiptBusyId, setReceiptBusyId] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: sessionResult } = await supabase.auth.getSession();
    const token = sessionResult.session?.access_token;
    if (!token) {
      setError("Sign in to view Library purchases and sales.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/library/commerce", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(body.error ?? "Unable to load Library commerce activity.");
      setLoading(false);
      return;
    }
    setPayload(body as Payload);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const payoutLabel = useMemo(() => {
    if (!payload?.payout) return "Payout setup required";
    if (payload.payout.payouts_enabled && payload.payout.details_submitted) return "Payouts enabled";
    return payload.payout.requirements_due.length ? "Payout setup needs attention" : "Payout verification pending";
  }, [payload]);

  const openReceipt = useCallback(async (purchaseId: string) => {
    if (receiptBusyId) return;
    setReceiptBusyId(purchaseId);
    setReceiptError(null);

    const { data: sessionResult } = await supabase.auth.getSession();
    const token = sessionResult.session?.access_token;
    if (!token) {
      setReceiptError("Sign in again to retrieve this receipt.");
      setReceiptBusyId(null);
      return;
    }

    try {
      const response = await fetch("/api/library/commerce/receipt", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ purchaseId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || typeof body.receiptUrl !== "string") {
        setReceiptError(body.error ?? "Unable to retrieve this receipt.");
        return;
      }

      const popup = window.open(body.receiptUrl, "_blank", "noopener,noreferrer");
      if (!popup) window.location.assign(body.receiptUrl);
    } catch {
      setReceiptError("Unable to retrieve this receipt right now.");
    } finally {
      setReceiptBusyId(null);
    }
  }, [receiptBusyId]);

  if (loading) {
    return <main className="grid min-h-[70vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[var(--loombus-gold)]" aria-label="Loading Library commerce" /></main>;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-24 sm:px-6">
      <header className="border-b border-[var(--loombus-border)] pb-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">Library Commerce</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Purchases &amp; Sales</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">Your Library purchase and author-sales ledger. Settled author share is the sale price minus the Loombus platform fee; payment-processing effects are accounted for by Stripe separately.</p>
          </div>
          <Link href="/library/publish" className="rounded-full border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold transition hover:border-[var(--loombus-gold)]">Manage publications</Link>
        </div>
      </header>

      {error ? <div role="alert" className="mt-6 rounded-2xl border border-red-500/30 p-4 text-sm">{error}</div> : null}
      {receiptError ? (
        <div role="alert" className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
          <span>{receiptError}</span>
          <Link href="/support" className="font-semibold text-[var(--loombus-gold)]">Contact Loombus Support</Link>
        </div>
      ) : null}

      {payload ? (
        <>
          <section className="grid gap-3 border-b border-[var(--loombus-border)] py-7 sm:grid-cols-2 lg:grid-cols-4" aria-label="Author commerce summary">
            <Metric icon={<ReceiptText className="h-4 w-4" />} label="Settled sales" value={String(payload.summary.sale_count)} />
            <Metric icon={<CircleDollarSign className="h-4 w-4" />} label="Settled gross sales" value={money(payload.summary.gross_cents)} />
            <Metric icon={<WalletCards className="h-4 w-4" />} label="Loombus platform fees" value={money(payload.summary.platform_fee_cents)} />
            <Metric icon={<BookOpen className="h-4 w-4" />} label="Settled author share" value={money(payload.summary.author_share_cents)} />
          </section>

          {payload.summary.disputed_sale_count > 0 ? (
            <aside className="my-6 flex gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
              <p><strong>{payload.summary.disputed_sale_count} disputed {payload.summary.disputed_sale_count === 1 ? "sale" : "sales"}</strong> totaling {money(payload.summary.disputed_gross_cents)} are excluded from settled earnings while Stripe resolves the dispute. Reader entitlement remains active during the dispute.</p>
            </aside>
          ) : null}

          <section className="border-b border-[var(--loombus-border)] py-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-gold)]">Payout status</p><h2 className="mt-1 text-xl font-semibold">{payoutLabel}</h2></div>
              <Link href="/settings" className="text-sm font-semibold text-[var(--loombus-gold)]">Open account settings</Link>
            </div>
          </section>

          <Ledger
            title="Your purchases"
            empty="You have not purchased a Library publication yet."
            rows={payload.purchases}
            mode="purchase"
            receiptBusyId={receiptBusyId}
            onViewReceipt={openReceipt}
          />
          <Ledger title="Your book sales" empty="No paid Library sales yet." rows={payload.sales} mode="sale" />

          <section className="py-7 text-sm text-[var(--loombus-text-muted)]">
            <p>Need help with a purchase, refund, dispute, or receipt? <Link href="/support" className="font-semibold text-[var(--loombus-gold)]">Contact Loombus Support</Link>.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4"><div className="flex items-center gap-2 text-xs font-semibold text-[var(--loombus-text-muted)]">{icon}{label}</div><p className="mt-3 text-2xl font-semibold">{value}</p></div>;
}

function Ledger({
  title,
  empty,
  rows,
  mode,
  receiptBusyId = null,
  onViewReceipt,
}: {
  title: string;
  empty: string;
  rows: LedgerRow[];
  mode: "purchase" | "sale";
  receiptBusyId?: string | null;
  onViewReceipt?: (purchaseId: string) => void | Promise<void>;
}) {
  return (
    <section className="border-b border-[var(--loombus-border)] py-8 last:border-b-0">
      <h2 className="text-xl font-semibold">{title}</h2>
      {!rows.length ? <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">{empty}</p> : (
        <div className="mt-4 divide-y divide-[var(--loombus-border)] border-y border-[var(--loombus-border)]">
          {rows.map((row) => {
            const saleAmount = row.status === "paid" ? (row.author_share_cents ?? 0) : row.amount_cents;
            const receiptAvailable = mode === "purchase" && canOpenReceipt(row.status) && Boolean(onViewReceipt);
            return (
              <div key={row.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <Link href={`/library/publication/${encodeURIComponent(row.publication_id)}`} className="font-semibold hover:text-[var(--loombus-gold)]">{row.publication?.title ?? "Library publication"}</Link>
                  <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{dateLabel(row.purchased_at ?? row.created_at)} · <span className="capitalize">{row.status}</span></p>
                  {mode === "purchase" ? <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-subtle)]">{purchaseStatusCopy(row.status)}</p> : null}
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-semibold">{money(mode === "sale" ? saleAmount : row.amount_cents, row.currency)}</p>
                  {mode === "sale" ? <p className="mt-1 text-xs text-[var(--loombus-text-muted)]">{row.status === "paid" ? `Author share · Gross ${money(row.amount_cents, row.currency)} · Loombus fee ${money(row.platform_fee_cents, row.currency)}` : `Gross transaction amount · ${row.status}`}</p> : null}
                  {receiptAvailable ? (
                    <button
                      type="button"
                      disabled={Boolean(receiptBusyId)}
                      onClick={() => void onViewReceipt?.(row.id)}
                      className="mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 text-xs font-semibold transition hover:border-[var(--loombus-gold)] disabled:opacity-50"
                    >
                      {receiptBusyId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                      {receiptBusyId === row.id ? "Opening receipt…" : "View Stripe receipt"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
