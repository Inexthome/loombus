"use client";

import {
  BadgeCheck,
  Check,
  Flag,
  ShieldCheck,
  X,
} from "lucide-react";
import type { BusinessManageResponse } from "@/lib/business-directory";

type BusinessModerationPanelProps = {
  moderation: BusinessManageResponse["moderation"];
  moderate: (
    payload: Record<string, unknown>,
    successMessage: string
  ) => void | Promise<void>;
};

export function BusinessModerationPanel({
  moderation,
  moderate,
}: BusinessModerationPanelProps) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <ShieldCheck size={22} />
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
            Administrator
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Directory review queue</h2>
        </div>
      </div>

      <div className="mt-6 grid gap-6">
        <div>
          <h3 className="font-semibold">
            Listing review ({moderation.pendingBusinesses.length})
          </h3>
          <div className="mt-3 grid gap-3">
            {moderation.pendingBusinesses.map((business) => (
              <article
                key={business.id}
                className="rounded-[1.2rem] bg-[var(--loombus-page-bg)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">
                      {business.status} · {business.category}
                    </p>
                    <h4 className="mt-1 text-lg font-semibold">{business.name}</h4>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {business.description}
                    </p>
                    <p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">
                      {business.city || "Online"} · {business.services.length} services
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        void moderate(
                          {
                            action: "moderate",
                            businessId: business.id,
                            decision: "approve",
                          },
                          `${business.name} was published.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--loombus-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void moderate(
                          {
                            action: "moderate",
                            businessId: business.id,
                            decision: "verify",
                          },
                          `${business.name} was verified and published.`
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      <BadgeCheck size={14} /> Verify
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        void moderate(
                          {
                            action: "moderate",
                            businessId: business.id,
                            decision: "reject",
                            note: "The listing needs corrected or additional information before publication.",
                          },
                          `${business.name} was returned for changes.`
                        )
                      }
                      className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      Request changes
                    </button>
                    {business.status === "published" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void moderate(
                            {
                              action: "moderate",
                              businessId: business.id,
                              decision: "suspend",
                              note: "The listing is suspended pending administrator review.",
                            },
                            `${business.name} was suspended.`
                          )
                        }
                        className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-500"
                      >
                        Suspend
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
            {moderation.pendingBusinesses.length === 0 ? (
              <p className="rounded-xl bg-[var(--loombus-page-bg)] p-4 text-sm text-[var(--loombus-text-muted)]">
                No listings are waiting for review.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">
            Ownership claims ({moderation.pendingClaims.length})
          </h3>
          <div className="mt-3 grid gap-3">
            {moderation.pendingClaims.map((claim) => (
              <article
                key={claim.id}
                className="rounded-[1.2rem] bg-[var(--loombus-page-bg)] p-5"
              >
                <p className="font-semibold">
                  {claim.businessName} · {claim.claimantName}
                </p>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  {claim.contactEmail}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                  {claim.evidence}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void moderate(
                        {
                          action: "review_claim",
                          claimId: claim.id,
                          decision: "approve",
                        },
                        `Ownership of ${claim.businessName} was approved.`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--loombus-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"
                  >
                    <Check size={14} /> Approve claim
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void moderate(
                        {
                          action: "review_claim",
                          claimId: claim.id,
                          decision: "reject",
                          note: "The supplied evidence did not establish control of the business.",
                        },
                        `The claim for ${claim.businessName} was rejected.`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                  >
                    <X size={14} /> Reject
                  </button>
                </div>
              </article>
            ))}
            {moderation.pendingClaims.length === 0 ? (
              <p className="rounded-xl bg-[var(--loombus-page-bg)] p-4 text-sm text-[var(--loombus-text-muted)]">
                No ownership claims are waiting for review.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <h3 className="font-semibold">
            Open listing reports ({moderation.openReports.length})
          </h3>
          <div className="mt-3 grid gap-3">
            {moderation.openReports.map((report) => (
              <article
                key={report.id}
                className="rounded-[1.2rem] bg-[var(--loombus-page-bg)] p-5"
              >
                <p className="flex items-center gap-2 font-semibold">
                  <Flag size={16} /> {report.businessName}
                </p>
                <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {report.details}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void moderate(
                        {
                          action: "review_report",
                          reportId: report.id,
                          decision: "resolve",
                        },
                        `The report for ${report.businessName} was resolved.`
                      )
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--loombus-primary-bg)] px-3 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"
                  >
                    <Check size={14} /> Resolve
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void moderate(
                        {
                          action: "moderate",
                          businessId: report.businessId,
                          decision: "suspend",
                          note: `Suspended while reviewing report: ${report.reason}`,
                        },
                        `${report.businessName} was suspended pending review.`
                      )
                    }
                    className="rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-500"
                  >
                    Suspend listing
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void moderate(
                        {
                          action: "review_report",
                          reportId: report.id,
                          decision: "dismiss",
                        },
                        `The report for ${report.businessName} was dismissed.`
                      )
                    }
                    className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                  >
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
            {moderation.openReports.length === 0 ? (
              <p className="rounded-xl bg-[var(--loombus-page-bg)] p-4 text-sm text-[var(--loombus-text-muted)]">
                No listing reports are waiting for review.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
