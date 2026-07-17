"use client";

import Link from "next/link";
import {
  BadgeCheck,
  ExternalLink,
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
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            Your directory
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Business listings</h2>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
        >
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      {businesses.length ? (
        <div className="mt-5 grid gap-3">
          {businesses.map((business) => (
            <article
              key={business.id}
              className="flex flex-col gap-4 rounded-[1.3rem] bg-[var(--loombus-page-bg)] p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[var(--loombus-border)] px-2.5 py-1 text-xs">
                    {statusLabel(business.status)}
                  </span>
                  {business.verificationStatus === "verified" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-surface-muted)] px-2.5 py-1 text-xs font-semibold">
                      <BadgeCheck size={13} /> Verified
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{business.name}</h3>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  {business.category} · {business.city || "Online"} ·{" "}
                  {business.services.length} service
                  {business.services.length === 1 ? "" : "s"}
                </p>
                {business.moderationReason ? (
                  <p className="mt-2 text-sm text-red-500">
                    Review note: {business.moderationReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {business.status === "published" ? (
                  <Link
                    href={`/businesses/${business.slug}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
                  >
                    Open <ExternalLink size={14} />
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() => startEdit(business)}
                  className="rounded-xl border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
                >
                  Edit
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl bg-[var(--loombus-page-bg)] p-5 text-sm text-[var(--loombus-text-muted)]">
          You do not control a business listing yet.
        </p>
      )}

      {claims.length ? (
        <div className="mt-6">
          <h3 className="font-semibold">Your ownership claims</h3>
          <div className="mt-3 grid gap-2">
            {claims.map((claim) => (
              <div
                key={claim.id}
                className="rounded-xl border border-[var(--loombus-border)] px-4 py-3 text-sm"
              >
                <strong>{claim.businessName}</strong>
                <span className="ml-2 text-[var(--loombus-text-muted)]">
                  {claim.status}
                </span>
                {claim.decisionNote ? (
                  <p className="mt-1 text-[var(--loombus-text-muted)]">
                    {claim.decisionNote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
