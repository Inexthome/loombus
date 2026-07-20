"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Pencil,
  RefreshCw,
} from "lucide-react";
import type {
  BusinessManageResponse,
  BusinessProfile,
} from "@/lib/business-directory";
import { statusLabel } from "@/components/business-manager-model";

type BusinessListingsPanelProps = {
  businesses: BusinessProfile[];
  claims: BusinessManageResponse["claims"];
  refresh: () => void;
  startEdit: (business: BusinessProfile) => void;
};

export function BusinessListingsPanel({
  businesses,
  claims,
  refresh,
  startEdit,
}: BusinessListingsPanelProps) {
  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Business records</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Your directory workspace</h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Review publication state, verification, Services, location context, and ownership claims.</p>
        </div>
        <button type="button" onClick={refresh} className="inline-flex h-11 items-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {businesses.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {businesses.map((business) => (
            <article key={business.id} className="flex min-h-[270px] flex-col rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5 transition hover:border-[color:var(--loombus-gold)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1">{statusLabel(business.status)}</span>
                  {business.verificationStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--loombus-cream)] px-2.5 py-1 text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"><BadgeCheck size={13} /> Verified</span>
                  ) : null}
                </div>
                <Building2 size={19} className="shrink-0 text-[color:var(--loombus-gold)]" />
              </div>

              <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em]">{business.name}</h3>
              <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                {business.category} · {business.city || "Online"}
              </p>
              <div className="mt-4 rounded-2xl bg-[color:var(--loombus-surface)] p-4 text-sm text-[color:var(--loombus-text-muted)]">
                {business.services.length} listed service{business.services.length === 1 ? "" : "s"}
              </div>
              {business.moderationReason ? (
                <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">Review note: {business.moderationReason}</p>
              ) : null}

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                {business.status === "published" ? (
                  <Link href={`/businesses/${business.slug}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]">Open <ArrowUpRight size={14} /></Link>
                ) : null}
                <button type="button" onClick={() => startEdit(business)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[color:var(--loombus-border)] px-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"><Pencil size={14} /> Edit</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-[1.4rem] border border-dashed border-[color:var(--loombus-border)] p-10 text-center">
          <Building2 className="mx-auto text-[color:var(--loombus-gold)]" size={38} />
          <h3 className="mt-4 text-xl font-semibold">No business records yet</h3>
          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Create or claim a business to begin managing its attributable profile.</p>
        </div>
      )}

      {claims.length ? (
        <section className="mt-6 border-t border-[color:var(--loombus-border-muted)] pt-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--loombus-text-subtle)]">Ownership</p><h3 className="mt-1 text-xl font-semibold">Your claims</h3></div>
            <span className="rounded-full bg-[color:var(--loombus-cream)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">{claims.length}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {claims.map((claim) => (
              <article key={claim.id} className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm">
                <div className="flex items-center justify-between gap-3"><strong>{claim.businessName}</strong><span className="rounded-full border border-[color:var(--loombus-border)] px-2.5 py-1 text-xs capitalize">{claim.status}</span></div>
                {claim.decisionNote ? <p className="mt-2 leading-6 text-[color:var(--loombus-text-muted)]">{claim.decisionNote}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}
