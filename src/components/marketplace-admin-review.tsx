"use client";

import { AlertTriangle, BadgeCheck, Check, ShieldCheck } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import {
  formatMarketplaceDate,
  marketplacePriceLabel,
  marketplaceStatusLabel,
  type MarketplaceManageResponse,
  type MarketplaceReport,
} from "@/lib/marketplace";
import { marketplaceInputClass as inputClass } from "@/components/marketplace-manager-model";

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

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

export function MarketplaceAdminReview({
  data,
  working,
  moderationNotes,
  setModerationNotes,
  reportNotes,
  setReportNotes,
  moderate,
  reviewReport,
}: Props) {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
      <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="text-[color:var(--loombus-gold)]" size={20} />
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Marketplace moderation</p>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">Review listings and reports</h2>
        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          Approval controls publication. Suspension, removal, requested changes, and report decisions remain separate actions while seller ownership stays with the original member.
        </p>
      </div>

      <div className="grid gap-0 xl:grid-cols-2 xl:divide-x xl:divide-[color:var(--loombus-border-muted)]">
        <section className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Listing queue</h3>
            <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
              {data.moderation.pendingListings.length} pending
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.moderation.pendingListings.map((listing) => (
              <article key={listing.id} className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-subtle)]">
                      {marketplaceStatusLabel(listing.status)} · {listing.category}
                    </p>
                    <h4 className="mt-2 text-xl font-semibold tracking-[-0.025em]">{listing.title}</h4>
                    <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                      {listing.businessName || listing.sellerName} · {marketplacePriceLabel(listing)}
                    </p>
                  </div>
                  {listing.businessVerificationStatus === "verified" ? <BadgeCheck className="shrink-0 text-[color:var(--loombus-gold)]" size={20} aria-label="Verified business" /> : null}
                </div>
                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[color:var(--loombus-text-muted)]">{listing.description}</p>
                <textarea
                  value={moderationNotes[listing.id] ?? ""}
                  onChange={(event) => setModerationNotes((current) => ({ ...current, [listing.id]: event.target.value }))}
                  placeholder="Administrator note"
                  rows={3}
                  className={`${inputClass} mt-4`}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "approve")} className={primaryButton}><Check size={15} /> Approve</button>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "reject")} className={secondaryButton}>Request changes</button>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "suspend")} className="inline-flex min-h-10 items-center justify-center rounded-full border border-amber-500/30 px-3 text-sm font-semibold text-amber-700 disabled:opacity-50 dark:text-amber-300">Suspend</button>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "remove")} className="inline-flex min-h-10 items-center justify-center rounded-full border border-red-500/30 px-3 text-sm font-semibold text-red-700 disabled:opacity-50 dark:text-red-300">Remove</button>
                </div>
              </article>
            ))}
            {data.moderation.pendingListings.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">No listings require administrator review.</p>
            ) : null}
          </div>
        </section>

        <section className="border-t border-[color:var(--loombus-border-muted)] p-5 sm:p-6 xl:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold">Open reports</h3>
            <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
              {data.moderation.openReports.length} open
            </span>
          </div>
          <div className="mt-4 space-y-4">
            {data.moderation.openReports.map((report) => (
              <article key={report.id} className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold"><AlertTriangle className="text-amber-600 dark:text-amber-300" size={17} /> {report.listingTitle}</div>
                <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--loombus-text-muted)]">{report.details}</p>
                <p className="mt-2 text-xs text-[color:var(--loombus-text-subtle)]">Submitted {formatMarketplaceDate(report.createdAt)}</p>
                <textarea
                  value={reportNotes[report.id] ?? ""}
                  onChange={(event) => setReportNotes((current) => ({ ...current, [report.id]: event.target.value }))}
                  placeholder="Report decision note"
                  rows={3}
                  className={`${inputClass} mt-4`}
                />
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={working} onClick={() => void reviewReport(report, "resolve")} className={primaryButton}>Resolve</button>
                  <button type="button" disabled={working} onClick={() => void reviewReport(report, "dismiss")} className={secondaryButton}>Dismiss</button>
                </div>
              </article>
            ))}
            {data.moderation.openReports.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">No Marketplace reports are open.</p>
            ) : null}
          </div>
        </section>
      </div>
    </section>
  );
}
