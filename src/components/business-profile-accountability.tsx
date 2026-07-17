"use client";

import { Flag, Loader2, ShieldCheck } from "lucide-react";
import type { FormEvent } from "react";
import type { BusinessProfile } from "@/lib/business-directory";

export type BusinessProfilePanel = "claim" | "report" | null;

type Props = {
  business: BusinessProfile;
  panel: BusinessProfilePanel;
  working: boolean;
  claimEmail: string;
  claimEvidence: string;
  reportReason: string;
  reportDetails: string;
  onPanelChange: (panel: BusinessProfilePanel) => void;
  onClaimEmailChange: (value: string) => void;
  onClaimEvidenceChange: (value: string) => void;
  onReportReasonChange: (value: string) => void;
  onReportDetailsChange: (value: string) => void;
  onSubmitClaim: (event: FormEvent) => void;
  onSubmitReport: (event: FormEvent) => void;
};

export function BusinessProfileAccountability({
  business,
  panel,
  working,
  claimEmail,
  claimEvidence,
  reportReason,
  reportDetails,
  onPanelChange,
  onClaimEmailChange,
  onClaimEvidenceChange,
  onReportReasonChange,
  onReportDetailsChange,
  onSubmitClaim,
  onSubmitReport,
}: Props) {
  return (
    <section className="mt-5 rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5" size={20} />
          <div>
            <h2 className="font-semibold">Listing accountability</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Claiming proves control of a listing. Verification is a separate
              administrator review and does not guarantee service quality.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!business.ownerId ? (
            <button
              type="button"
              onClick={() =>
                onPanelChange(panel === "claim" ? null : "claim")
              }
              className="rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
            >
              Claim this business
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              onPanelChange(panel === "report" ? null : "report")
            }
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
          >
            <Flag size={15} /> Report listing
          </button>
        </div>
      </div>

      {panel === "claim" ? (
        <form
          onSubmit={onSubmitClaim}
          className="mt-5 grid gap-3 rounded-2xl bg-[var(--loombus-page-bg)] p-5"
        >
          <h3 className="font-semibold">Submit an ownership claim</h3>
          <input
            type="email"
            value={claimEmail}
            onChange={(event) => onClaimEmailChange(event.target.value)}
            placeholder="Business email address"
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
            required
          />
          <textarea
            value={claimEvidence}
            onChange={(event) => onClaimEvidenceChange(event.target.value)}
            placeholder="Explain your role and what evidence an administrator can use to confirm it."
            rows={4}
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
            required
          />
          <button
            type="submit"
            disabled={working}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
          >
            {working ? (
              <Loader2 className="animate-spin" size={15} />
            ) : null}
            Submit claim
          </button>
        </form>
      ) : null}

      {panel === "report" ? (
        <form
          onSubmit={onSubmitReport}
          className="mt-5 grid gap-3 rounded-2xl bg-[var(--loombus-page-bg)] p-5"
        >
          <h3 className="font-semibold">
            Report inaccurate or unsafe information
          </h3>
          <select
            value={reportReason}
            onChange={(event) => onReportReasonChange(event.target.value)}
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
            required
          >
            <option value="">Choose a reason</option>
            <option value="Incorrect information">
              Incorrect information
            </option>
            <option value="Business is closed">Business is closed</option>
            <option value="Impersonation or false ownership">
              Impersonation or false ownership
            </option>
            <option value="Spam or misleading listing">
              Spam or misleading listing
            </option>
            <option value="Safety concern">Safety concern</option>
            <option value="Other">Other</option>
          </select>
          <textarea
            value={reportDetails}
            onChange={(event) => onReportDetailsChange(event.target.value)}
            placeholder="Describe what should be reviewed."
            rows={4}
            className="rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 outline-none"
            required
          />
          <button
            type="submit"
            disabled={working}
            className="inline-flex w-fit items-center gap-2 rounded-xl bg-[var(--loombus-primary-bg)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
          >
            {working ? (
              <Loader2 className="animate-spin" size={15} />
            ) : null}
            Submit report
          </button>
        </form>
      ) : null}
    </section>
  );
}
