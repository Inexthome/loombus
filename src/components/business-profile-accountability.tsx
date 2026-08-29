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

const controlClass = "w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-sm text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

export function BusinessProfileAccountability({ business, panel, working, claimEmail, claimEvidence, reportReason, reportDetails, onPanelChange, onClaimEmailChange, onClaimEvidenceChange, onReportReasonChange, onReportDetailsChange, onSubmitClaim, onSubmitReport }: Props) {
  return (
    <section>
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
        <div><h2 className="font-semibold">Listing accountability</h2><p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Ownership claims and verification are separate reviews. Neither guarantees service quality or future performance.</p></div>
      </div>

      <div className="mt-5 divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border-muted)]">
        {!business.ownerId ? <button type="button" onClick={() => onPanelChange(panel === "claim" ? null : "claim")} className={`block w-full py-3 text-left text-sm font-semibold ${panel === "claim" ? "text-[color:var(--loombus-gold)]" : "hover:text-[color:var(--loombus-gold)]"}`}>Claim this business</button> : null}
        <button type="button" onClick={() => onPanelChange(panel === "report" ? null : "report")} className={`flex w-full items-center gap-2 py-3 text-left text-sm font-semibold ${panel === "report" ? "text-[color:var(--loombus-gold)]" : "hover:text-[color:var(--loombus-gold)]"}`}><Flag size={14} /> Report listing</button>
      </div>

      {panel === "claim" ? <form onSubmit={onSubmitClaim} className="mt-5 grid gap-3 border-t border-[color:var(--loombus-border-muted)] pt-5"><h3 className="font-semibold">Ownership claim</h3><input type="email" value={claimEmail} onChange={(event) => onClaimEmailChange(event.target.value)} placeholder="Business email address" className={controlClass} required /><textarea value={claimEvidence} onChange={(event) => onClaimEvidenceChange(event.target.value)} placeholder="Explain your role and what an administrator can use to confirm it." rows={5} className={controlClass} required /><button type="submit" disabled={working} className="inline-flex items-center gap-2 justify-self-start border-b-2 border-[color:var(--loombus-gold)] py-2 text-sm font-semibold disabled:opacity-50">{working ? <Loader2 className="animate-spin" size={14} /> : null}Submit claim</button></form> : null}

      {panel === "report" ? <form onSubmit={onSubmitReport} className="mt-5 grid gap-3 border-t border-[color:var(--loombus-border-muted)] pt-5"><h3 className="font-semibold">Report listing</h3><select value={reportReason} onChange={(event) => onReportReasonChange(event.target.value)} className={controlClass} required><option value="">Choose a reason</option><option value="Incorrect information">Incorrect information</option><option value="Business is closed">Business is closed</option><option value="Impersonation or false ownership">Impersonation or false ownership</option><option value="Spam or misleading listing">Spam or misleading listing</option><option value="Safety concern">Safety concern</option><option value="Other">Other</option></select><textarea value={reportDetails} onChange={(event) => onReportDetailsChange(event.target.value)} placeholder="Describe what should be reviewed." rows={5} className={controlClass} required /><button type="submit" disabled={working} className="inline-flex items-center gap-2 justify-self-start border-b-2 border-[color:var(--loombus-gold)] py-2 text-sm font-semibold disabled:opacity-50">{working ? <Loader2 className="animate-spin" size={14} /> : null}Submit report</button></form> : null}
    </section>
  );
}
