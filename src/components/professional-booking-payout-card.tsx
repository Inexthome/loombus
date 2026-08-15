"use client";

import { ExternalLink, RefreshCw, ShieldCheck, WalletCards } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import { requireSubscriptionEntitlement } from "@/lib/subscription-access-prompt";
import type { SubscriptionPlanId } from "@/lib/subscription-entitlements";

type PayoutState = {
  subscriptionPlan: SubscriptionPlanId;
  subscriptionResolutionAvailable: boolean;
  canUseProfessionalBooking: boolean;
  hasProviderService: boolean;
  ageSafetyAvailable: boolean;
  adultProviderEligible: boolean;
  paymentEligibilityReviewAvailable: boolean;
  paymentEligible: boolean;
  payoutOnboardingEnabled: boolean;
  hasPayoutIdentity: boolean;
  payout: null | {
    detailsSubmitted: boolean;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    requirementsDue: string[];
    country: string | null;
    defaultCurrency: string | null;
    updatedAt: string;
  };
  paymentTermsStorageAvailable: boolean;
  paymentTermsVersion: string;
  paymentTermsAccepted: boolean;
  paymentTermsAcceptedAt: string | null;
  paymentPlatformFeeBps: number;
};

function acceptedAtLabel(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function ProfessionalBookingPayoutCard() {
  const [data, setData] = useState<PayoutState | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-payout",
        { cache: "no-store" },
        "/appointments/professional-payout"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load payout setup.");
      setData(payload as PayoutState);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load payout setup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function requestAccess() {
    if (!data) return;
    if (!data.subscriptionResolutionAvailable) {
      setNotice("Loombus cannot verify Premium Pro access right now. Retry before changing payout setup.");
      return;
    }
    requireSubscriptionEntitlement({
      plan: data.subscriptionPlan,
      entitlement: "professional_booking",
      featureLabel: "Professional Booking payout setup",
    });
  }

  async function action(
    name:
      | "accept_payment_terms"
      | "start_onboarding"
      | "refresh"
      | "open_dashboard",
  ) {
    if (!data || working) return;
    if (!data.canUseProfessionalBooking) {
      requestAccess();
      return;
    }
    if (name === "start_onboarding" && !data.payoutOnboardingEnabled) {
      setNotice(
        "Professional Booking Stripe payout onboarding is not enabled in this deployment.",
      );
      return;
    }
    if (
      name === "start_onboarding" &&
      !data.paymentEligibilityReviewAvailable
    ) {
      setNotice(
        "Loombus cannot verify your Professional Booking payment eligibility right now. Retry before connecting Stripe.",
      );
      return;
    }
    if (name === "start_onboarding" && !data.paymentEligible) {
      setNotice(
        "Your current Professional Booking payment eligibility must be approved before Stripe payout onboarding.",
      );
      return;
    }
    if (name === "accept_payment_terms" && !termsChecked) {
      setNotice("Review the payment terms and check the acceptance box first.");
      return;
    }
    setWorking(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-payout",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: name,
            paymentTermsAccepted:
              name === "accept_payment_terms" ? termsChecked : undefined,
          }),
        },
        "/appointments/professional-payout"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update payout setup.");

      if ((name === "start_onboarding" || name === "open_dashboard") && payload.url) {
        window.location.assign(String(payload.url));
        return;
      }

      setData(payload as PayoutState);
      if (name === "accept_payment_terms") {
        setTermsChecked(false);
        setNotice("Professional Booking payment terms accepted.");
      } else {
        setNotice("Payout status refreshed.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update payout setup.");
    } finally {
      setWorking(false);
    }
  }

  const canManage =
    data?.canUseProfessionalBooking === true &&
    data.hasProviderService &&
    data.ageSafetyAvailable &&
    data.adultProviderEligible;
  const feePercent = data ? data.paymentPlatformFeeBps / 100 : 8;

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Professional Booking</p>
            <span className="rounded-full border border-[color:var(--loombus-gold)]/40 bg-[color:var(--loombus-gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--loombus-gold)]">Premium Pro</span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">Stripe payout setup</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Connect one shared Stripe Express payout identity for Loombus professional services. Connecting Stripe alone does not activate paid appointments. Professional Booking payment terms must also be accepted, payout setup must be complete, and Loombus must enable the controlled payment flow.
          </p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading || working} className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        <div className="flex gap-3">
          <WalletCards className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
          <p>The same Stripe Express identity can support multiple eligible Loombus products, but each product keeps its own economics and terms. Creator Supporter terms and its 15% fee do not apply to Professional Booking.</p>
        </div>
      </div>

      {notice ? <div className="mt-4 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm" role="status">{notice}</div> : null}

      {loading ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">Loading payout setup…</div>
      ) : data ? (
        <div className="mt-5 space-y-4">
          {!data.canUseProfessionalBooking ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
              <p className="text-sm font-semibold">{data.hasPayoutIdentity ? "Your shared payout identity is preserved read-only." : "Premium Pro is required for Professional Booking payout setup."}</p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Downgrading does not delete or disconnect a shared Stripe identity or erase prior payment-term acceptance.</p>
              <button type="button" onClick={requestAccess} className="mt-3 rounded-full border border-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold)]">View Premium Pro</button>
            </div>
          ) : !data.hasProviderService ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm">Create an active or paused appointment service before connecting Stripe for Professional Booking.</div>
          ) : !data.ageSafetyAvailable || !data.adultProviderEligible ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm">Professional Booking payout setup is available only after Loombus can verify adult-provider eligibility.</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Stripe identity</p><p className="mt-2 font-semibold">{data.hasPayoutIdentity ? "Connected" : "Not connected"}</p></div>
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Details submitted</p><p className="mt-2 font-semibold">{data.payout?.detailsSubmitted ? "Yes" : "No"}</p></div>
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"><p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Payouts enabled</p><p className="mt-2 font-semibold">{data.payout?.payoutsEnabled ? "Yes" : "No"}</p></div>
          </div>

          {canManage ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                <div>
                  <p className="font-semibold">Professional Booking payment terms</p>
                  <p className="mt-1 text-xs text-[color:var(--loombus-text-muted)]">Version {data.paymentTermsVersion}</p>
                </div>
              </div>

              {data.paymentTermsAccepted ? (
                <div className="mt-4 rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm">
                  <strong>Accepted</strong>
                  {data.paymentTermsAcceptedAt ? (
                    <span className="ml-2 text-[color:var(--loombus-text-muted)]">{acceptedAtLabel(data.paymentTermsAcceptedAt)}</span>
                  ) : null}
                </div>
              ) : !data.paymentTermsStorageAvailable ? (
                <p className="mt-4 text-sm text-[color:var(--loombus-text-muted)]">Payment terms storage is not available in this deployment yet.</p>
              ) : (
                <>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    <li>For paid Professional Booking, Loombus applies the current Premium Pro service transaction fee of {feePercent}% to the requester&apos;s exact accepted service price.</li>
                    <li>The requester authorizes payment when submitting the paid booking. Loombus captures it only when the appointment is accepted.</li>
                    <li>If an authorization expires before acceptance, the requester must authorize again. Loombus does not silently charge an expired authorization.</li>
                    <li>If a captured appointment is later cancelled, the requester receives a full payment refund. Loombus does not impose a cancellation fee or penalty in this flow.</li>
                    <li>The provider amount shown by Loombus is the service price less the Loombus fee before Stripe processing, taxes, disputes, refunds, or other settlement adjustments.</li>
                    <li>The shared Stripe payout identity may be reused, but these terms are separate from Creator Supporter or other Loombus product terms.</li>
                  </ul>
                  <label className="mt-4 flex items-start gap-3 rounded-xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm leading-6">
                    <input type="checkbox" checked={termsChecked} onChange={(event) => setTermsChecked(event.target.checked)} className="mt-1" />
                    <span>I have reviewed and accept these Professional Booking payment terms.</span>
                  </label>
                  <button type="button" onClick={() => void action("accept_payment_terms")} disabled={working || !termsChecked} className="mt-3 rounded-full bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Accept payment terms</button>
                </>
              )}
            </div>
          ) : null}

          {canManage &&
          data.payoutOnboardingEnabled &&
          (!data.hasPayoutIdentity || !data.payout?.detailsSubmitted) &&
          (!data.paymentEligibilityReviewAvailable || !data.paymentEligible) ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
              <p className="text-sm font-semibold">
                {data.paymentEligibilityReviewAvailable
                  ? "Payment eligibility review required"
                  : "Payment eligibility review unavailable"}
              </p>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                {data.paymentEligibilityReviewAvailable
                  ? "Loombus must approve your current Professional Booking payment scope before Stripe payout onboarding can begin."
                  : "Loombus cannot verify your current Professional Booking payment eligibility right now. Retry before connecting Stripe."}
              </p>
            </div>
          ) : null}

          {canManage &&
          (!data.hasPayoutIdentity || !data.payout?.detailsSubmitted) &&
          !data.payoutOnboardingEnabled ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm text-[color:var(--loombus-text-muted)]">
              Professional Booking Stripe payout onboarding is not enabled in this deployment.
            </div>
          ) : null}

          {data.payout?.requirementsDue?.length ? (
            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
              <p className="text-sm font-semibold">Stripe requirements still due</p>
              <p className="mt-1 break-words text-sm text-[color:var(--loombus-text-muted)]">{data.payout.requirementsDue.join(", ")}</p>
            </div>
          ) : null}

          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {!data.hasPayoutIdentity || !data.payout?.detailsSubmitted ? (
                <button
                  type="button"
                  onClick={() => void action("start_onboarding")}
                  disabled={
                    working ||
                    !data.payoutOnboardingEnabled ||
                    !data.paymentEligibilityReviewAvailable ||
                    !data.paymentEligible
                  }
                  className="rounded-full bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
                >
                  {!data.payoutOnboardingEnabled
                    ? "Stripe setup unavailable"
                    : !data.paymentEligibilityReviewAvailable
                      ? "Review status unavailable"
                      : !data.paymentEligible
                        ? "Payment review required"
                        : data.hasPayoutIdentity
                          ? "Continue Stripe setup"
                          : "Connect Stripe"}
                </button>
              ) : (
                <button type="button" onClick={() => void action("open_dashboard")} disabled={working} className="inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 py-2 text-sm font-bold text-black disabled:opacity-50">Open Stripe dashboard <ExternalLink size={14} /></button>
              )}
              {data.hasPayoutIdentity ? <button type="button" onClick={() => void action("refresh")} disabled={working} className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Refresh status</button> : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
