"use client";

import { FileText, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppointmentService } from "@/lib/events";
import {
  PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_OPTIONS,
  PROFESSIONAL_BOOKING_POLICY_TEXT_MAX,
  type ProfessionalBookingPolicyResponse,
} from "@/lib/professional-booking-policy";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import { requireSubscriptionEntitlement } from "@/lib/subscription-access-prompt";

type ManagePayload = {
  services?: AppointmentService[];
};

const fieldClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)] disabled:cursor-not-allowed disabled:opacity-60";

function noticeLabel(hours: number) {
  if (hours === 0) return "No notice preference";
  if (hours === 1) return "1 hour";
  if (hours === 24) return "24 hours";
  if (hours === 48) return "48 hours";
  if (hours === 72) return "72 hours";
  if (hours === 168) return "7 days";
  return `${hours} hours`;
}

export default function ProfessionalBookingPolicyCard() {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [data, setData] = useState<ProfessionalBookingPolicyResponse | null>(null);
  const [policyText, setPolicyText] = useState("");
  const [cancellationNoticeHours, setCancellationNoticeHours] = useState(0);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingPolicy, setLoadingPolicy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const usableServices = useMemo(
    () => services.filter((service) => service.status !== "archived"),
    [services],
  );

  const loadServices = useCallback(async () => {
    setLoadingServices(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments?manage=1",
        { cache: "no-store" },
        "/appointments/professional-policy",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load appointment services.");
      }

      const nextServices = Array.isArray((payload as ManagePayload).services)
        ? ((payload as ManagePayload).services as AppointmentService[])
        : [];
      setServices(nextServices);
      setSelectedServiceId((current) => {
        if (
          current &&
          nextServices.some(
            (service) => service.id === current && service.status !== "archived",
          )
        ) {
          return current;
        }
        return nextServices.find((service) => service.status !== "archived")?.id ?? "";
      });
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load appointment services.",
      );
    } finally {
      setLoadingServices(false);
    }
  }, []);

  const loadPolicy = useCallback(async (serviceId: string) => {
    if (!serviceId) {
      setData(null);
      setPolicyText("");
      setCancellationNoticeHours(0);
      return;
    }

    setLoadingPolicy(true);
    setNotice("");

    try {
      const params = new URLSearchParams({ serviceId });
      const response = await scheduleAuthorizedFetch(
        `/api/appointments/professional-policy?${params.toString()}`,
        { cache: "no-store" },
        "/appointments/professional-policy",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load the booking policy.");
      }

      const next = payload as ProfessionalBookingPolicyResponse;
      setData(next);
      setPolicyText(next.policy.policyText);
      setCancellationNoticeHours(next.policy.cancellationNoticeHours);
    } catch (error) {
      setData(null);
      setPolicyText("");
      setCancellationNoticeHours(0);
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load the booking policy.",
      );
    } finally {
      setLoadingPolicy(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  useEffect(() => {
    void loadPolicy(selectedServiceId);
  }, [loadPolicy, selectedServiceId]);

  const canEdit = data?.canUseProfessionalBooking === true;

  function requestAccess() {
    if (!data) return;

    if (!data.subscriptionResolutionAvailable) {
      setNotice(
        "Loombus cannot verify Premium Pro access right now. Retry before changing booking policies.",
      );
      return;
    }

    requireSubscriptionEntitlement({
      plan: data.subscriptionPlan,
      entitlement: "professional_booking",
      featureLabel: "Professional Booking policies",
    });
  }

  async function save() {
    if (!data || !selectedServiceId) return;

    if (!canEdit) {
      requestAccess();
      return;
    }

    if (saving) return;

    const normalizedPolicyText = policyText.trim();
    if (normalizedPolicyText.length > PROFESSIONAL_BOOKING_POLICY_TEXT_MAX) {
      setNotice(
        `Booking policy text cannot exceed ${PROFESSIONAL_BOOKING_POLICY_TEXT_MAX} characters.`,
      );
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-policy",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            serviceId: selectedServiceId,
            policyText: normalizedPolicyText,
            cancellationNoticeHours,
          }),
        },
        "/appointments/professional-policy",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save the booking policy.");
      }

      const updated = payload as ProfessionalBookingPolicyResponse;
      setData(updated);
      setPolicyText(updated.policy.policyText);
      setCancellationNoticeHours(updated.policy.cancellationNoticeHours);
      setNotice(
        updated.hasSavedPolicy
          ? "Booking policy saved."
          : "Booking policy cleared.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save the booking policy.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Professional Booking
            </p>
            <span className="rounded-full border border-[color:var(--loombus-gold)]/40 bg-[color:var(--loombus-gold-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--loombus-gold)]">
              Premium Pro
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.045em]">
            Booking policies
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Configure service-specific policy text and a preferred cancellation-notice window. This foundation stores policy settings only.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadServices()}
          disabled={loadingServices || loadingPolicy || saving}
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
        >
          <RefreshCw
            size={15}
            className={loadingServices || loadingPolicy ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        <div className="flex gap-3">
          <FileText
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]"
            aria-hidden="true"
          />
          <p>
            This slice does not show policy text to requesters, require acknowledgment, block cancellation, classify a cancellation as late, or charge a fee. Ordinary Appointments cancellation remains unchanged.
          </p>
        </div>
      </div>

      {notice ? (
        <div
          className="mt-4 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4 text-sm"
          role="status"
        >
          {notice}
        </div>
      ) : null}

      {loadingServices ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Loading appointment services…
        </div>
      ) : usableServices.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Create an appointment service first, then return here to configure a Professional Booking policy.
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold">Appointment service</span>
            <select
              value={selectedServiceId}
              onChange={(event) => setSelectedServiceId(event.target.value)}
              className={fieldClass}
              disabled={loadingPolicy || saving}
            >
              {usableServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.businessName} · {service.name}
                </option>
              ))}
            </select>
          </label>

          {loadingPolicy ? (
            <div className="rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
              Loading booking policy…
            </div>
          ) : data ? (
            <>
              {!canEdit ? (
                <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
                  <p className="text-sm font-semibold">
                    {data.hasSavedPolicy
                      ? "Saved booking policy is preserved read-only."
                      : "Premium Pro is required to configure booking policies."}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Downgrading does not delete saved configuration. It becomes editable again when Professional Booking access returns.
                  </p>
                  <button
                    type="button"
                    onClick={requestAccess}
                    className="mt-3 rounded-full border border-[color:var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[color:var(--loombus-gold)]"
                  >
                    View Premium Pro
                  </button>
                </div>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Booking and cancellation policy</span>
                <textarea
                  value={policyText}
                  onChange={(event) => setPolicyText(event.target.value)}
                  maxLength={PROFESSIONAL_BOOKING_POLICY_TEXT_MAX}
                  rows={7}
                  disabled={!canEdit || saving}
                  className={fieldClass}
                  placeholder="Example: Please arrive five minutes early. If your plans change, cancel as soon as possible so the time can be offered to someone else."
                />
                <span className="mt-2 block text-xs text-[color:var(--loombus-text-muted)]">
                  {policyText.length}/{PROFESSIONAL_BOOKING_POLICY_TEXT_MAX} characters
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold">Preferred cancellation notice</span>
                <select
                  value={cancellationNoticeHours}
                  onChange={(event) => setCancellationNoticeHours(Number(event.target.value))}
                  disabled={!canEdit || saving}
                  className={fieldClass}
                >
                  {PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_OPTIONS.map((hours) => (
                    <option key={hours} value={hours}>
                      {noticeLabel(hours)}
                    </option>
                  ))}
                </select>
                <span className="mt-2 block text-xs leading-5 text-[color:var(--loombus-text-muted)]">
                  This is a provider policy preference. It does not remove a requester&apos;s ability to cancel.
                </span>
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving || !selectedServiceId}
                  className="inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "Saving…" : "Save policy"}
                </button>
                <span className="text-xs text-[color:var(--loombus-text-muted)]">
                  Clear the text and choose “No notice preference” to remove the saved policy.
                </span>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
