"use client";

import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, MapPin, ShieldCheck, Truck } from "lucide-react";
import type { ChangeEvent, Dispatch, SetStateAction } from "react";
import {
  formatMarketplaceDate,
  marketplaceConditionLabel,
  marketplaceFulfillmentLabels,
  marketplaceLocationLabel,
  marketplacePriceLabel,
  marketplaceStatusLabel,
  type MarketplaceManageResponse,
  type MarketplaceReport,
} from "@/lib/marketplace";
import {
  AdminActionButton,
  AdminStatusBadge,
} from "@/app/admin/platform/admin-platform-foundation";

type Props = {
  data: MarketplaceManageResponse;
  working: boolean;
  moderationNotes: Record<string, string>;
  setModerationNotes: Dispatch<SetStateAction<Record<string, string>>>;
  reportNotes: Record<string, string>;
  setReportNotes: Dispatch<SetStateAction<Record<string, string>>>;
  moderate: (listingId: string, decision: string) => void | Promise<void>;
  reviewReport: (report: MarketplaceReport, decision: string) => void | Promise<void>;
};

const textareaClass =
  "mt-2 w-full resize-y border-0 border-b border-[var(--loombus-border)] bg-transparent px-0 py-3 text-sm leading-6 text-[var(--loombus-text)] outline-none transition placeholder:text-[var(--loombus-text-subtle)] focus:border-[var(--loombus-gold)] focus:ring-0 motion-reduce:transition-none";

export function MarketplaceAdminReview(props: Props) {
  const {
    data,
    working,
    moderationNotes,
    setModerationNotes,
    reportNotes,
    setReportNotes,
    moderate,
    reviewReport,
  } = props;
  const pending = data.moderation.pendingListings;
  const reports = data.moderation.openReports;
  const attentionCount = pending.length + reports.length;

  return (
    <div data-marketplace-moderation-editorial className="mt-5">
      <section className="border-y border-[var(--loombus-border-muted)] py-5" aria-label="Marketplace moderation summary">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">
          <ShieldCheck size={15} aria-hidden="true" /> Moderation overview
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Attention queue</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{attentionCount}</dd>
            <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">Listing decisions plus open reports.</p>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Listing decisions</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{pending.length}</dd>
            <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">Pending, rejected, or suspended listings.</p>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">Open reports</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{reports.length}</dd>
            <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">Member concerns awaiting review.</p>
          </div>
        </dl>
      </section>

      <section className="border-b border-[var(--loombus-border-muted)] py-7" aria-labelledby="marketplace-listing-decisions-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Marketplace review</p>
            <h2 id="marketplace-listing-decisions-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Listing decisions</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
              Review seller attribution, item details, location, fulfillment, and administrator notes before changing publication state.
            </p>
          </div>
          <AdminStatusBadge status={pending.length ? "attention" : "ready"}>
            {pending.length ? `${pending.length} waiting` : "Queue clear"}
          </AdminStatusBadge>
        </div>

        <div className="mt-6 divide-y divide-[var(--loombus-border-muted)] border-t border-[var(--loombus-border-muted)]">
          {pending.map((listing) => {
            const fulfillment = marketplaceFulfillmentLabels(listing);
            return (
              <article key={listing.id} className="py-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      <AdminStatusBadge status="attention">{marketplaceStatusLabel(listing.status)}</AdminStatusBadge>
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{listing.category}</span>
                      {listing.businessVerificationStatus === "verified" ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--loombus-gold)]">
                          <BadgeCheck size={14} aria-hidden="true" /> Verified business
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{listing.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {listing.businessName || listing.sellerName} · {marketplacePriceLabel(listing)} · {marketplaceConditionLabel(listing.condition)}
                    </p>
                  </div>
                  <Link
                    href={`/marketplace/${listing.slug}`}
                    className="inline-flex min-h-11 shrink-0 items-center border-b border-transparent text-sm font-semibold text-[var(--loombus-gold)] transition hover:border-[var(--loombus-gold)] motion-reduce:transition-none"
                  >
                    Open public record
                  </Link>
                </div>

                <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{listing.description}</p>

                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--loombus-text-muted)]">
                  <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[var(--loombus-gold)]" aria-hidden="true" /> {marketplaceLocationLabel(listing)}</span>
                  {fulfillment.map((item) => (
                    <span key={item} className="inline-flex items-center gap-1.5"><Truck size={13} className="text-[var(--loombus-gold)]" aria-hidden="true" /> {item}</span>
                  ))}
                </div>

                <label className="mt-5 block text-sm font-semibold" htmlFor={`marketplace-note-${listing.id}`}>Administrator note</label>
                <textarea
                  id={`marketplace-note-${listing.id}`}
                  rows={3}
                  value={moderationNotes[listing.id] ?? ""}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                    setModerationNotes((current: Record<string, string>) => ({ ...current, [listing.id]: event.target.value }))
                  }
                  placeholder="Record the reason or requested correction."
                  className={textareaClass}
                />

                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void moderate(listing.id, "approve")}><Check size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void moderate(listing.id, "reject")}>Request changes</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "suspend")} className="min-h-11 border-b border-amber-500/50 px-1 text-sm font-semibold text-amber-700 transition hover:border-amber-600 disabled:opacity-50 dark:text-amber-300 motion-reduce:transition-none">Suspend</button>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "remove")} className="min-h-11 border-b border-red-500/50 px-1 text-sm font-semibold text-red-700 transition hover:border-red-600 disabled:opacity-50 dark:text-red-300 motion-reduce:transition-none">Remove</button>
                </div>
              </article>
            );
          })}
          {pending.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--loombus-text-muted)]">No Marketplace listings require administrator review.</p>
          ) : null}
        </div>
      </section>

      <section className="border-b border-[var(--loombus-border-muted)] py-7" aria-labelledby="marketplace-open-reports-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-gold)]">Trust and safety</p>
            <h2 id="marketplace-open-reports-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Open listing reports</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
              Resolve a report after the concern has been handled, or dismiss it when no action is required.
            </p>
          </div>
          <AdminStatusBadge status={reports.length ? "attention" : "ready"}>
            {reports.length ? `${reports.length} open` : "Queue clear"}
          </AdminStatusBadge>
        </div>

        <div className="mt-6 divide-y divide-[var(--loombus-border-muted)] border-t border-[var(--loombus-border-muted)]">
          {reports.map((report) => (
            <article key={report.id} className="py-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" size={18} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">Marketplace report</p>
                  <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em]">{report.listingTitle}</h3>
                  <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                </div>
              </div>
              <p className="mt-4 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{report.details}</p>
              <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">Submitted {formatMarketplaceDate(report.createdAt) || "date unavailable"}</p>

              <label className="mt-5 block text-sm font-semibold" htmlFor={`marketplace-report-note-${report.id}`}>Decision note</label>
              <textarea
                id={`marketplace-report-note-${report.id}`}
                rows={3}
                value={reportNotes[report.id] ?? ""}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setReportNotes((current: Record<string, string>) => ({ ...current, [report.id]: event.target.value }))
                }
                placeholder="Record the outcome or supporting context."
                className={textareaClass}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <AdminActionButton type="button" primary disabled={working} onClick={() => void reviewReport(report, "resolve")}>Resolve report</AdminActionButton>
                <AdminActionButton type="button" disabled={working} onClick={() => void reviewReport(report, "dismiss")}>Dismiss</AdminActionButton>
              </div>
            </article>
          ))}
          {reports.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--loombus-text-muted)]">No Marketplace reports are open.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
