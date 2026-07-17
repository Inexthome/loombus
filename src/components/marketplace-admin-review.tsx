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
    <section className="mt-9 border-t border-[var(--loombus-border)] pt-8">
      <div className="flex items-center gap-2">
        <ShieldCheck size={21} />
        <h2 className="text-2xl font-semibold">Administrator Marketplace review</h2>
      </div>
      <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
        Approval controls publication. Administrators may suspend or remove listings, but seller ownership remains with the original member.
      </p>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Listing queue</h3>
          {data.moderation.pendingListings.map((listing) => (
            <article
              key={listing.id}
              className="rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                    {marketplaceStatusLabel(listing.status)} · {listing.category}
                  </p>
                  <h4 className="mt-1 text-xl font-semibold">{listing.title}</h4>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {listing.businessName || listing.sellerName} · {marketplacePriceLabel(listing)}
                  </p>
                </div>
                {listing.businessVerificationStatus === "verified" ? (
                  <BadgeCheck size={20} aria-label="Verified business" />
                ) : null}
              </div>
              <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                {listing.description}
              </p>
              <textarea
                value={moderationNotes[listing.id] ?? ""}
                onChange={(event) =>
                  setModerationNotes((current) => ({
                    ...current,
                    [listing.id]: event.target.value,
                  }))
                }
                placeholder="Administrator note"
                rows={3}
                className={`${inputClass} mt-4`}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void moderate(listing.id, "approve")}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-3 py-2 text-sm font-semibold text-[var(--loombus-page-bg)]"
                >
                  <Check size={15} /> Approve
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void moderate(listing.id, "reject")}
                  className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  Request changes
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void moderate(listing.id, "suspend")}
                  className="rounded-xl border border-amber-500/30 px-3 py-2 text-sm font-semibold"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void moderate(listing.id, "remove")}
                  className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
                >
                  Remove
                </button>
              </div>
            </article>
          ))}
          {data.moderation.pendingListings.length === 0 ? (
            <p className="rounded-xl bg-[var(--loombus-surface)] p-5 text-sm text-[var(--loombus-text-muted)]">
              No listings require administrator review.
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Open reports</h3>
          {data.moderation.openReports.map((report) => (
            <article
              key={report.id}
              className="rounded-[1.4rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5"
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle size={17} /> {report.listingTitle}
              </div>
              <p className="mt-2 text-sm font-semibold">{report.reason}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                {report.details}
              </p>
              <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">
                Submitted {formatMarketplaceDate(report.createdAt)}
              </p>
              <textarea
                value={reportNotes[report.id] ?? ""}
                onChange={(event) =>
                  setReportNotes((current) => ({
                    ...current,
                    [report.id]: event.target.value,
                  }))
                }
                placeholder="Report decision note"
                rows={3}
                className={`${inputClass} mt-4`}
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void reviewReport(report, "resolve")}
                  className="rounded-xl bg-[var(--loombus-text)] px-3 py-2 text-sm font-semibold text-[var(--loombus-page-bg)]"
                >
                  Resolve
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => void reviewReport(report, "dismiss")}
                  className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                >
                  Dismiss
                </button>
              </div>
            </article>
          ))}
          {data.moderation.openReports.length === 0 ? (
            <p className="rounded-xl bg-[var(--loombus-surface)] p-5 text-sm text-[var(--loombus-text-muted)]">
              No Marketplace reports are open.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
