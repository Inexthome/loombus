"use client";

import Link from "next/link";
import { ArrowUpRight, BadgeCheck, Building2, Pencil, RefreshCw } from "lucide-react";
import type { BusinessManageResponse, BusinessProfile } from "@/lib/business-directory";
import { statusLabel } from "@/components/business-manager-model";

type BusinessListingsPanelProps = { businesses: BusinessProfile[]; claims: BusinessManageResponse["claims"]; refresh: () => void; startEdit: (business: BusinessProfile) => void; };

export function BusinessListingsPanel({ businesses, claims, refresh, startEdit }: BusinessListingsPanelProps) {
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[color:var(--loombus-border)] pb-5">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-gold)]">Business records</p><h2 className="mt-1 text-2xl font-semibold">Directory workspace</h2><p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Publication, verification, services, location context, and ownership claims.</p></div>
        <button type="button" onClick={refresh} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[color:var(--loombus-gold)]"><RefreshCw size={14} /> Refresh</button>
      </div>

      {businesses.length ? (
        <div className="divide-y divide-[color:var(--loombus-border)]">
          {businesses.map((business) => (
            <article key={business.id} className="grid gap-4 py-5 md:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]"><span>{statusLabel(business.status)}</span>{business.verificationStatus === "verified" ? <span className="inline-flex items-center gap-1 text-[color:var(--loombus-gold)]"><BadgeCheck size={13} /> Verified</span> : null}</div>
                <h3 className="mt-2 text-xl font-semibold">{business.name}</h3>
                <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">{business.category} · {business.city || "Online"} · {business.services.length} service{business.services.length === 1 ? "" : "s"}</p>
                {business.moderationReason ? <p className="mt-3 border-l-2 border-amber-500 pl-3 text-sm text-amber-700 dark:text-amber-300">Review note: {business.moderationReason}</p> : null}
              </div>
              <div className="flex flex-wrap items-start gap-4 text-sm font-semibold">
                {business.status === "published" ? <Link href={`/businesses/${business.slug}`} className="inline-flex items-center gap-2 hover:text-[color:var(--loombus-gold)]">Open <ArrowUpRight size={14} /></Link> : null}
                <button type="button" onClick={() => startEdit(business)} className="inline-flex items-center gap-2 text-[color:var(--loombus-gold)] hover:underline"><Pencil size={14} /> Edit</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-b border-[color:var(--loombus-border)] py-10"><Building2 className="text-[color:var(--loombus-gold)]" size={30} /><h3 className="mt-4 text-xl font-semibold">No business records yet</h3><p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Create or claim a business to begin managing its attributable profile.</p></div>
      )}

      {claims.length ? <section className="mt-7 border-t border-[color:var(--loombus-border)] pt-6"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-subtle)]">Ownership</p><h3 className="mt-1 text-xl font-semibold">Your claims</h3></div><span className="text-sm font-semibold text-[color:var(--loombus-gold)]">{claims.length}</span></div><div className="mt-3 divide-y divide-[color:var(--loombus-border-muted)]">{claims.map((claim) => <article key={claim.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto]"><div><strong className="text-sm">{claim.businessName}</strong>{claim.decisionNote ? <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{claim.decisionNote}</p> : null}</div><span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-subtle)]">{claim.status}</span></article>)}</div></section> : null}
    </section>
  );
}
