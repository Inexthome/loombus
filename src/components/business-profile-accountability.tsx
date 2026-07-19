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

const controlClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";

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
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
          <ShieldCheck size={19} />
        </span>
        <div>
          <h2 className="font-semibold">Listing accountability</h2>
          <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Ownership claims and verification are separate reviews. Neither guarantees service quality or future performance.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-2">
        {!business.ownerId ? (
          <button
            type="button"
            onClick={() => onPanelChange(panel === "claim" ? null : "claim")}
            className={`rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
              panel === "claim"
                ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                : "border border-[color:var(--loombus-border)] hover:border-[color:var(--loombus-gold)]"
            }`}
          >
            Claim this business
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onPanelChange(panel === "report" ? null : "report")}
          className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${
            panel === "report"
              ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
              : "border border-[color:var(--loombus-border)] hover:border-[color:var(--loombus-gold)]"
          }`}
        >
          <Flag size={15} /> Report listing
        </button>
      </div>

      {panel === "claim" ? (
        <form onSubmit={onSubmitClaim} className="mt-5 grid gap-3 border-t border-[color:var(--loombus-border-muted)] pt-5">
          <h3 className="font-semibold">Ownership claim</h3>
          <input
            type="email"
            value={claimEmail}
            onChange={(event) => onClaimEmailChange(event.target.value)}
            placeholder="Business email address"
            className={controlClass}
            required
          />
          <textarea
            value={claimEvidence}
            onChange={(event) => onClaimEvidenceChange(event.target.value)}
            placeholder="Explain your role and what an administrator can use to confirm it."
            rows={5}
            className={controlClass}
            required
          />
          <button
            type="submit"
            disabled={working}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] disabled:opacity-50"
          >
            {working ? <Loader2 className="animate-spin" size={15} /> : null}
            Submit claim
          </button>
        </form>
      ) : null}

      {panel === "report" ? (
        <form onSubmit={onSubmitReport} className="mt-5 grid gap-3 border-t border-[color:var(--loombus-border-muted)] pt-5">
          <h3 className="font-semibold">Report listing</h3>
          <select
            value={reportReason}
            onChange={(event) => onReportReasonChange(event.target.value)}
            className={controlClass}
            required
          >
            <option value="">Choose a reason</option>
            <option value="Incorrect information">Incorrect information</option>
            <option value="Business is closed">Business is closed</option>
            <option value="Impersonation or false ownership">Impersonation or false ownership</option>
            <option value="Spam or misleading listing">Spam or misleading listing</option>
            <option value="Safety concern">Safety concern</option>
            <option value="Other">Other</option>
          </select>
          <textarea
            value={reportDetails}
            onChange={(event) => onReportDetailsChange(event.target.value)}
            placeholder="Describe what should be reviewed."
            rows={5}
            className={controlClass}
            required
          />
          <button
            type="submit"
            disabled={working}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] disabled:opacity-50"
          >
            {working ? <Loader2 className="animate-spin" size={15} /> : null}
            Submit report
          </button>
        </form>
      ) : null}
    </section>
  );
}
