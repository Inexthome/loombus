"use client";

import Link from "next/link";
import { BadgeCheck, Check, Flag, MapPin, ShieldCheck, UserCheck, X } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import {
  businessServiceAreaLabel,
  type BusinessManageResponse,
} from "@/lib/business-directory";
import {
  AdminActionButton,
  AdminMetricCard,
  AdminQueueSection,
  AdminStatusBadge,
} from "@/app/admin/platform/admin-platform-foundation";

type Props = {
  moderation: BusinessManageResponse["moderation"];
  moderate: (payload: Record<string, unknown>, successMessage: string) => void | Promise<void>;
};

const textareaClass = "mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const emptyClass = "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";

export function BusinessModerationPanel({ moderation, moderate }: Props) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const total = moderation.pendingBusinesses.length + moderation.pendingClaims.length + moderation.openReports.length;
  const noteFor = (key: string) => notes[key] ?? "";
  const updateNote = (key: string, value: string) => setNotes((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Attention queue" value={total} description="Listings, ownership claims, and reports awaiting review." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Listing decisions" value={moderation.pendingBusinesses.length} description="Business profiles needing a publication decision." />
        <AdminMetricCard label="Ownership claims" value={moderation.pendingClaims.length} description="Member claims requiring evidence review." icon={<UserCheck size={20} />} />
        <AdminMetricCard label="Open reports" value={moderation.openReports.length} description="Directory reports still awaiting an outcome." icon={<Flag size={20} />} />
      </div>

      <AdminQueueSection eyebrow="Directory review" title="Business listing decisions" description="Review identity, category, service area, services, and administrator notes before publishing, verifying, returning, or suspending a listing." action={<AdminStatusBadge status={moderation.pendingBusinesses.length ? "attention" : "ready"}>{moderation.pendingBusinesses.length ? `${moderation.pendingBusinesses.length} waiting` : "Queue clear"}</AdminStatusBadge>}>
        <div className="grid gap-4">
          {moderation.pendingBusinesses.map((business) => {
            const key = `business:${business.id}`;
            return (
              <article key={business.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2"><AdminStatusBadge status="attention">{business.status}</AdminStatusBadge><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{business.category}</span>{business.verificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--loombus-gold)]"><BadgeCheck size={14} /> Verified</span> : null}</div>
                    <h3 className="mt-3 text-xl font-semibold">{business.name}</h3>
                    <p className="mt-3 max-w-4xl text-sm leading-7 text-[var(--loombus-text-muted)]">{business.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--loombus-text-muted)]"><span className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-1.5"><MapPin size={13} /> {businessServiceAreaLabel(business)}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">{business.services.length} services</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1.5">Verification: {business.verificationStatus}</span></div>
                  </div>
                  <Link href={`/businesses/${business.slug}`} className="text-sm font-semibold text-[var(--loombus-gold)]">Open public record</Link>
                </div>
                <label className="mt-5 block text-sm font-semibold" htmlFor={`business-note-${business.id}`}>Administrator note</label>
                <textarea id={`business-note-${business.id}`} rows={3} value={noteFor(key)} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateNote(key, event.target.value)} placeholder="Record the decision reason or requested correction." className={textareaClass} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary onClick={() => void moderate({ action: "moderate", businessId: business.id, decision: "approve", note: noteFor(key) }, `${business.name} was published.`)}><Check size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" onClick={() => void moderate({ action: "moderate", businessId: business.id, decision: "verify", note: noteFor(key) }, `${business.name} was verified and published.`)}><BadgeCheck size={15} /> Verify</AdminActionButton>
                  <AdminActionButton type="button" onClick={() => void moderate({ action: "moderate", businessId: business.id, decision: "reject", note: noteFor(key) }, `${business.name} was returned for changes.`)}>Request changes</AdminActionButton>
                  <button type="button" onClick={() => void moderate({ action: "moderate", businessId: business.id, decision: "suspend", note: noteFor(key) }, `${business.name} was suspended.`)} className="min-h-11 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 dark:text-red-300">Suspend</button>
                </div>
              </article>
            );
          })}
          {moderation.pendingBusinesses.length === 0 ? <p className={emptyClass}>No business listings require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Ownership" title="Pending business claims" description="Review the claimant identity, business contact address, and supplied evidence before transferring control." action={<AdminStatusBadge status={moderation.pendingClaims.length ? "attention" : "ready"}>{moderation.pendingClaims.length ? `${moderation.pendingClaims.length} waiting` : "Queue clear"}</AdminStatusBadge>}>
        <div className="grid gap-4 xl:grid-cols-2">
          {moderation.pendingClaims.map((claim) => {
            const key = `claim:${claim.id}`;
            return <article key={claim.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-soft)] text-[var(--loombus-gold)]"><UserCheck size={18} /></span><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">Ownership claim</p><h3 className="mt-1 text-lg font-semibold">{claim.businessName}</h3><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{claim.claimantName} · {claim.contactEmail}</p></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{claim.evidence}</p><label className="mt-5 block text-sm font-semibold" htmlFor={`claim-note-${claim.id}`}>Decision note</label><textarea id={`claim-note-${claim.id}`} rows={3} value={noteFor(key)} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateNote(key, event.target.value)} placeholder="Record how the evidence supports the outcome." className={textareaClass} /><div className="mt-4 flex gap-2"><AdminActionButton type="button" primary onClick={() => void moderate({ action: "review_claim", claimId: claim.id, decision: "approve", note: noteFor(key) }, `Ownership of ${claim.businessName} was approved.`)}><Check size={15} /> Approve claim</AdminActionButton><AdminActionButton type="button" onClick={() => void moderate({ action: "review_claim", claimId: claim.id, decision: "reject", note: noteFor(key) }, `The claim for ${claim.businessName} was rejected.`)}><X size={15} /> Reject</AdminActionButton></div></article>;
          })}
          {moderation.pendingClaims.length === 0 ? <p className={emptyClass}>No ownership claims require review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Trust and safety" title="Open directory reports" description="Resolve, dismiss, or suspend the underlying listing while preserving the original report and ownership records." action={<AdminStatusBadge status={moderation.openReports.length ? "attention" : "ready"}>{moderation.openReports.length ? `${moderation.openReports.length} open` : "Queue clear"}</AdminStatusBadge>}>
        <div className="grid gap-4 xl:grid-cols-2">
          {moderation.openReports.map((report) => {
            const key = `report:${report.id}`;
            return <article key={report.id} className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]"><Flag size={15} /> Directory report</p><h3 className="mt-2 text-lg font-semibold">{report.businessName}</h3><p className="mt-2 text-sm font-semibold">{report.reason}</p><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{report.details}</p><label className="mt-5 block text-sm font-semibold" htmlFor={`business-report-note-${report.id}`}>Decision note</label><textarea id={`business-report-note-${report.id}`} rows={3} value={noteFor(key)} onChange={(event: ChangeEvent<HTMLTextAreaElement>) => updateNote(key, event.target.value)} placeholder="Record the outcome or supporting context." className={textareaClass} /><div className="mt-4 flex flex-wrap gap-2"><AdminActionButton type="button" primary onClick={() => void moderate({ action: "review_report", reportId: report.id, decision: "resolve", note: noteFor(key) }, `The report for ${report.businessName} was resolved.`)}>Resolve</AdminActionButton><AdminActionButton type="button" onClick={() => void moderate({ action: "review_report", reportId: report.id, decision: "dismiss", note: noteFor(key) }, `The report for ${report.businessName} was dismissed.`)}>Dismiss</AdminActionButton><button type="button" onClick={() => void moderate({ action: "moderate", businessId: report.businessId, decision: "suspend", note: noteFor(key) }, `${report.businessName} was suspended pending review.`)} className="min-h-11 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 dark:text-red-300">Suspend listing</button></div></article>;
          })}
          {moderation.openReports.length === 0 ? <p className={emptyClass}>No business reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}
