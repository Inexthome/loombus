"use client";

import Link from "next/link";
import { AlertTriangle, BadgeCheck, Check, MapPin, ShieldCheck, Truck } from "lucide-react";
import type { Dispatch, SetStateAction, ChangeEvent } from "react";
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
  AdminMetricCard,
  AdminQueueSection,
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

const textareaClass = "mt-4 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const emptyClass = "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";

export function MarketplaceAdminReview(props: Props) {
  const { data, working, moderationNotes, setModerationNotes, reportNotes, setReportNotes, moderate, reviewReport } = props;
  const pending = data.moderation.pendingListings;
  const reports = data.moderation.openReports;

  return (
    <div className="mt-5 space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <AdminMetricCard label="Attention queue" value={pending.length + reports.length} description="Listing decisions plus open reports." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Listing decisions" value={pending.length} description="Pending, rejected, or suspended listings." />
        <AdminMetricCard label="Open reports" value={reports.length} description="Member concerns awaiting review." />
      </div>

      <AdminQueueSection
        eyebrow="Marketplace review"
        title="Listing decisions"
        description="Review seller attribution, item details, location, fulfillment, and administrator notes before changing publication state."
        action={<AdminStatusBadge status={pending.length ? "attention" : "ready"}>{pending.length ? `${pending.length} waiting` : "Queue clear"}</AdminStatusBadge>}
      >
        <div className="grid gap-4">
          {pending.map((listing) => {
            const fulfillment = marketplaceFulfillmentLabels(listing);
            return (
              <article key={listing.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge status="attention">{marketplaceStatusLabel(listing.status)}</AdminStatusBadge>
                      <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{listing.category}</span>
                      {listing.businessVerificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--loombus-gold)]"><BadgeCheck size={14} /> Verified business</span> : null}
                    </div>
                    <h3 className="mt-3 text-xl font-semibold">{listing.title}</h3>
                    <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{listing.businessName || listing.sellerName} · {marketplacePriceLabel(listing)} · {marketplaceConditionLabel(listing.condition)}</p>
                  </div>
                  <Link href={`/marketplace/${listing.slug}`} className="text-sm font-semibold text-[var(--loombus-gold)]">Open public record</Link>
                </div>
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{listing.description}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--loombus-text-muted)]">
                  <span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1.5"><MapPin size={13} /> {marketplaceLocationLabel(listing)}</span>
                  {fulfillment.map((item) => <span key={item} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1.5"><Truck size={13} /> {item}</span>)}
                </div>
                <label className="mt-5 block text-sm font-semibold" htmlFor={`marketplace-note-${listing.id}`}>Administrator note</label>
                <textarea id={`marketplace-note-${listing.id}`} rows={3} value={moderationNotes[listing.id] ?? ""} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setModerationNotes((current: Record<string, string>) => ({ ...current, [listing.id]: event.target.value }))} placeholder="Record the reason or requested correction." className={textareaClass} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void moderate(listing.id, "approve")}><Check size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void moderate(listing.id, "reject")}>Request changes</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "suspend")} className="min-h-11 rounded-full border border-amber-500/30 px-4 text-sm font-semibold text-amber-700 disabled:opacity-50 dark:text-amber-300">Suspend</button>
                  <button type="button" disabled={working} onClick={() => void moderate(listing.id, "remove")} className="min-h-11 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 dark:text-red-300">Remove</button>
                </div>
              </article>
            );
          })}
          {pending.length === 0 ? <p className={emptyClass}>No Marketplace listings require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Trust and safety"
        title="Open listing reports"
        description="Resolve a report after the concern has been handled, or dismiss it when no action is required."
        action={<AdminStatusBadge status={reports.length ? "attention" : "ready"}>{reports.length ? `${reports.length} open` : "Queue clear"}</AdminStatusBadge>}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {reports.map((report) => (
            <article key={report.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6">
              <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><AlertTriangle size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">Marketplace report</p><h3 className="mt-1 text-lg font-semibold">{report.listingTitle}</h3><p className="mt-2 text-sm font-semibold">{report.reason}</p></div></div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{report.details}</p>
              <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">Submitted {formatMarketplaceDate(report.createdAt) || "date unavailable"}</p>
              <label className="mt-5 block text-sm font-semibold" htmlFor={`marketplace-report-note-${report.id}`}>Decision note</label>
              <textarea id={`marketplace-report-note-${report.id}`} rows={3} value={reportNotes[report.id] ?? ""} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReportNotes((current: Record<string, string>) => ({ ...current, [report.id]: event.target.value }))} placeholder="Record the outcome or supporting context." className={textareaClass} />
              <div className="mt-4 flex flex-wrap gap-2"><AdminActionButton type="button" primary disabled={working} onClick={() => void reviewReport(report, "resolve")}>Resolve report</AdminActionButton><AdminActionButton type="button" disabled={working} onClick={() => void reviewReport(report, "dismiss")}>Dismiss</AdminActionButton></div>
            </article>
          ))}
          {reports.length === 0 ? <p className={emptyClass}>No Marketplace reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}
