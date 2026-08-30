"use client";

import { DollarSign, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppointmentService } from "@/lib/events";
import type { ProfessionalBookingPricingResponse } from "@/lib/professional-booking-pricing";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import { requireSubscriptionEntitlement } from "@/lib/subscription-access-prompt";

type ManagePayload = {
  services?: AppointmentService[];
};

const fieldClass =
  "w-full border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";
const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b border-[color:var(--loombus-border)] px-1 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";
const primaryActionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 py-2 text-sm font-bold text-[color:var(--loombus-text)] transition hover:text-[color:var(--loombus-gold)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none";

function centsToInput(amountCents: number) {
  const dollars = Math.floor(amountCents / 100);
  const cents = amountCents % 100;
  return `${dollars}.${String(cents).padStart(2, "0")}`;
}

function inputToCents(value: string) {
  const normalized = value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ""] = normalized.split(".");
  const centsText = `${whole}${`${fraction}00`.slice(0, 2)}`;
  const amount = Number(centsText);
  if (!Number.isSafeInteger(amount) || amount <= 0) return null;
  return amount;
}

function displayUsd(amountCents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

export default function ProfessionalBookingPricingCard() {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [data, setData] = useState<ProfessionalBookingPricingResponse | null>(null);
  const [amountText, setAmountText] = useState("");
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const usableServices = useMemo(
    () => services.filter((service) => service.status !== "archived"),
    [services],
  );
  const selectedService = useMemo(
    () => services.find((service) => service.id === selectedServiceId) ?? null,
    [services, selectedServiceId],
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments?manage=1",
        { cache: "no-store" },
        "/appointments/professional-pricing",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load appointment services.");
      const nextServices = Array.isArray((payload as ManagePayload).services)
        ? ((payload as ManagePayload).services as AppointmentService[])
        : [];
      setServices(nextServices);
      setSelectedServiceId((current) => {
        if (current && nextServices.some((service) => service.id === current && service.status !== "archived")) return current;
        return nextServices.find((service) => service.status !== "archived")?.id ?? "";
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load appointment services.");
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const loadPricing = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setData(null);
      setAmountText("");
      return;
    }
    setLoadingPricing(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ serviceId });
      const response = await scheduleAuthorizedFetch(
        `/api/appointments/professional-pricing?${params.toString()}`,
        { cache: "no-store" },
        "/appointments/professional-pricing",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load structured pricing.");
      const next = payload as ProfessionalBookingPricingResponse;
      setData(next);
      setAmountText(next.pricing ? centsToInput(next.pricing.amountCents) : "");
    } catch (error) {
      setData(null);
      setAmountText("");
      setNotice(error instanceof Error ? error.message : "Unable to load structured pricing.");
    } finally {
      setLoadingPricing(false);
    }
  }, []);

  useEffect(() => { void loadServices(); }, [loadServices]);
  useEffect(() => { void loadPricing(selectedServiceId); }, [loadPricing, selectedServiceId]);

  const canEdit = data?.canUseProfessionalBooking === true;

  function requestAccess() {
    if (!data) return;
    if (!data.subscriptionResolutionAvailable) {
      setNotice("Loombus cannot verify Premium Pro access right now. Retry before changing structured pricing.");
      return;
    }
    requireSubscriptionEntitlement({
      plan: data.subscriptionPlan,
      entitlement: "professional_booking",
      featureLabel: "Professional Booking paid-service pricing",
    });
  }

  async function save() {
    if (!data || !selectedServiceId || saving) return;
    if (!canEdit) {
      requestAccess();
      return;
    }
    const amountCents = inputToCents(amountText);
    if (amountCents === null) {
      setNotice("Enter a valid USD service price greater than zero, with no more than two decimal places.");
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-pricing",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: selectedServiceId, amountCents }),
        },
        "/appointments/professional-pricing",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save structured pricing.");
      const updated = payload as ProfessionalBookingPricingResponse;
      setData(updated);
      setAmountText(updated.pricing ? centsToInput(updated.pricing.amountCents) : "");
      setNotice(updated.pricing ? `Structured price saved at ${displayUsd(updated.pricing.amountCents)}.` : "Structured price cleared.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save structured pricing.");
    } finally {
      setSaving(false);
    }
  }

  async function clearPricing() {
    if (!data || !selectedServiceId || saving || !data.hasSavedPricing) return;
    if (!canEdit) {
      requestAccess();
      return;
    }
    setSaving(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-pricing",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serviceId: selectedServiceId, clear: true }),
        },
        "/appointments/professional-pricing",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to clear structured pricing.");
      const updated = payload as ProfessionalBookingPricingResponse;
      setData(updated);
      setAmountText("");
      setNotice("Structured price cleared. Existing appointment service details were not changed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to clear structured pricing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section data-professional-booking-pricing-editorial="root">
      <header className="flex flex-col gap-5 border-b border-[color:var(--loombus-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Professional Booking</p>
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--loombus-text-muted)]">Premium Pro</span>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Paid-service pricing</h1>
          <p className="mt-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Store an exact fixed USD price for a Professional Booking service without converting the existing free-form appointment price label into a chargeable amount.
          </p>
        </div>
        <button type="button" onClick={() => void loadServices()} disabled={loadingServices || loadingPricing || saving} className={actionClass}>
          <RefreshCw size={15} className={loadingServices || loadingPricing ? "animate-spin motion-reduce:animate-none" : ""} /> Refresh
        </button>
      </header>

      <section className="grid gap-6 border-b border-[color:var(--loombus-border)] py-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Payment boundary</p>
        <div className="flex max-w-3xl gap-3 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
          <DollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" aria-hidden="true" />
          <p>This foundation does not show the structured price to requesters and does not create a Stripe product, checkout, charge, transfer, payout, platform fee, tax calculation, refund, or payment obligation. Free Appointments continues to work exactly as it does today.</p>
        </div>
      </section>

      {notice ? <div className="border-b border-[color:var(--loombus-border)] py-4 text-sm text-[color:var(--loombus-text-muted)]" role="status">{notice}</div> : null}

      {loadingServices ? (
        <div className="border-b border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">Loading appointment services…</div>
      ) : usableServices.length === 0 ? (
        <div className="border-b border-[color:var(--loombus-border)] py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">Create an appointment service first, then return here to configure structured Professional Booking pricing.</div>
      ) : (
        <div className="divide-y divide-[color:var(--loombus-border)]">
          <section className="grid gap-6 py-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Service</p>
            <label className="block max-w-3xl">
              <span className="block text-sm font-semibold">Appointment service</span>
              <select value={selectedServiceId} onChange={(event) => setSelectedServiceId(event.target.value)} className={fieldClass} disabled={loadingPricing || saving}>
                {usableServices.map((service) => <option key={service.id} value={service.id}>{service.businessName} · {service.name}</option>)}
              </select>
            </label>
          </section>

          {loadingPricing ? (
            <div className="py-10 text-center text-sm text-[color:var(--loombus-text-muted)]">Loading structured pricing…</div>
          ) : data ? (
            <>
              {!canEdit ? (
                <section className="grid gap-6 py-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Access</p>
                  <div className="max-w-3xl">
                    <p className="text-sm font-semibold">{data.hasSavedPricing ? "Saved structured pricing is preserved read-only." : "Premium Pro is required to configure paid-service pricing."}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">Downgrading does not delete saved pricing. It becomes editable again when Professional Booking access returns.</p>
                    <button type="button" onClick={requestAccess} className={`${actionClass} mt-3 text-[color:var(--loombus-gold)]`}>View Premium Pro</button>
                  </div>
                </section>
              ) : null}

              <section className="grid gap-6 py-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Price context</p>
                <dl className="grid max-w-3xl border-t border-[color:var(--loombus-border)] md:grid-cols-2">
                  <div className="border-b border-[color:var(--loombus-border)] py-5 md:border-b-0 md:border-r md:pr-6">
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Existing appointment price label</dt>
                    <dd className="mt-2 text-sm font-semibold">{selectedService?.priceText || "Not set"}</dd>
                    <dd className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">This remains the ordinary Free Appointments field and is not interpreted as money by this foundation.</dd>
                  </div>
                  <div className="py-5 md:pl-6">
                    <dt className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Saved structured price</dt>
                    <dd className="mt-2 text-sm font-semibold">{data.pricing ? displayUsd(data.pricing.amountCents) : "Not configured"}</dd>
                    <dd className="mt-2 text-xs leading-5 text-[color:var(--loombus-text-muted)]">Currency is fixed to USD in this initial foundation. No payment is collected.</dd>
                  </div>
                </dl>
              </section>

              <section className="grid gap-6 py-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-[color:var(--loombus-text-subtle)]">Fixed price</p>
                <label className="block max-w-3xl">
                  <span className="block text-sm font-semibold">Fixed service price in USD</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 font-semibold text-[color:var(--loombus-text-muted)]">$</span>
                    <input type="text" inputMode="decimal" value={amountText} onChange={(event) => setAmountText(event.target.value)} disabled={!canEdit || saving} className={`${fieldClass} pl-5`} placeholder="125.00" aria-label="Fixed service price in US dollars" />
                  </div>
                  <span className="mt-2 block text-xs leading-5 text-[color:var(--loombus-text-muted)]">Enter an exact positive amount with up to two decimal places. Loombus stores the amount as integer cents so later payment work never has to infer money from text.</span>
                </label>
              </section>

              <footer className="flex flex-wrap items-center gap-5 py-7">
                <button type="button" onClick={() => void save()} disabled={saving || !selectedServiceId} className={primaryActionClass}>
                  <Save size={16} /> {saving ? "Saving…" : "Save structured price"}
                </button>
                {data.hasSavedPricing ? (
                  <button type="button" onClick={() => void clearPricing()} disabled={saving || !canEdit} className={actionClass}>
                    <Trash2 size={16} /> Clear structured price
                  </button>
                ) : null}
              </footer>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
