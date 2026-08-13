"use client";

import {
  CalendarRange,
  Clock3,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  PROFESSIONAL_BOOKING_DAY_LABELS,
  PROFESSIONAL_BOOKING_DEFAULT_SETTINGS,
  type ProfessionalBookingAvailabilityResponse,
  type ProfessionalBookingAvailabilityWindow,
  type ProfessionalBookingSettings,
} from "@/lib/professional-booking";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import {
  requireSubscriptionEntitlement,
} from "@/lib/subscription-access-prompt";

const fieldClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-3 py-2.5 text-sm text-[color:var(--loombus-text)] outline-none transition focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)] disabled:cursor-not-allowed disabled:opacity-60";

function cloneDefaults(): ProfessionalBookingSettings {
  return {
    ...PROFESSIONAL_BOOKING_DEFAULT_SETTINGS,
    weeklyAvailability: [],
  };
}

function minuteToTime(value: number) {
  const safe = Math.max(
    0,
    Math.min(Number.isFinite(value) ? value : 0, 1439),
  );
  const hours = Math.floor(safe / 60);
  const minutes = safe % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes,
  ).padStart(2, "0")}`;
}

function timeToMinute(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

export default function ProfessionalBookingAvailabilityCard() {
  const [data, setData] =
    useState<ProfessionalBookingAvailabilityResponse | null>(
      null,
    );
  const [draft, setDraft] =
    useState<ProfessionalBookingSettings>(
      cloneDefaults(),
    );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-availability",
        { cache: "no-store" },
        "/appointments",
      );
      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Unable to load Professional Booking.",
        );
      }

      const availability =
        payload as ProfessionalBookingAvailabilityResponse;

      const nextSettings: ProfessionalBookingSettings = {
        ...availability.settings,
        weeklyAvailability: [
          ...availability.settings.weeklyAvailability,
        ],
      };

      if (
        !availability.hasSavedSettings &&
        availability.canUseProfessionalBooking &&
        nextSettings.timezone === "UTC"
      ) {
        const browserTimezone =
          Intl.DateTimeFormat().resolvedOptions().timeZone;

        if (browserTimezone) {
          nextSettings.timezone = browserTimezone;
        }
      }

      setData(availability);
      setDraft(nextSettings);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to load Professional Booking.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit =
    data?.canUseProfessionalBooking === true;

  function requestAccess() {
    if (!data) return;

    if (!data.subscriptionResolutionAvailable) {
      setNotice(
        "Loombus cannot verify Premium Pro access right now. Retry the access check before changing Professional Booking settings.",
      );
      return;
    }

    requireSubscriptionEntitlement({
      plan: data.subscriptionPlan,
      entitlement: "professional_booking",
      featureLabel:
        "professional booking availability",
    });
  }

  function updateWindow(
    index: number,
    patch: Partial<ProfessionalBookingAvailabilityWindow>,
  ) {
    setDraft((current) => ({
      ...current,
      weeklyAvailability:
        current.weeklyAvailability.map(
          (window, windowIndex) =>
            windowIndex === index
              ? { ...window, ...patch }
              : window,
        ),
    }));
  }

  function addWindow(dayOfWeek: number) {
    if (!canEdit) {
      requestAccess();
      return;
    }

    const sameDay = draft.weeklyAvailability
      .filter(
        (window) =>
          window.dayOfWeek === dayOfWeek,
      )
      .sort(
        (left, right) =>
          left.startMinute - right.startMinute,
      );

    if (sameDay.length >= 4) {
      setNotice(
        "Professional Booking supports up to four recurring windows per day.",
      );
      return;
    }

    const last = sameDay.at(-1);
    const startMinute = last
      ? last.endMinute
      : 9 * 60;

    if (startMinute >= 1440) {
      setNotice(
        "There is no additional time remaining on that day.",
      );
      return;
    }

    const endMinute = Math.min(
      startMinute + (last ? 60 : 8 * 60),
      1440,
    );

    setDraft((current) => ({
      ...current,
      weeklyAvailability: [
        ...current.weeklyAvailability,
        {
          dayOfWeek,
          startMinute,
          endMinute,
        },
      ],
    }));

    setNotice("");
  }

  function removeWindow(index: number) {
    if (!canEdit) {
      requestAccess();
      return;
    }

    setDraft((current) => ({
      ...current,
      weeklyAvailability:
        current.weeklyAvailability.filter(
          (_, windowIndex) =>
            windowIndex !== index,
        ),
    }));
  }

  async function save() {
    if (!data) return;

    if (!canEdit) {
      requestAccess();
      return;
    }

    if (saving) return;

    setSaving(true);
    setNotice("");

    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments/professional-availability",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(draft),
        },
        "/appointments",
      );

      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.error ??
            "Unable to save Professional Booking availability.",
        );
      }

      const updated =
        payload as ProfessionalBookingAvailabilityResponse;

      setData(updated);
      setDraft({
        ...updated.settings,
        weeklyAvailability: [
          ...updated.settings.weeklyAvailability,
        ],
      });
      setNotice(
        "Professional Booking availability saved.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to save Professional Booking availability.",
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

          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            Recurring availability
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Set recurring availability and booking-window
            preferences for Professional Booking. Your
            existing Appointments workflow remains available
            independently.
          </p>
        </div>

        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50"
          >
            <RefreshCw
              size={15}
              className={
                loading ? "animate-spin" : ""
              }
            />
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
        <div className="flex gap-3">
          <CalendarRange
            className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]"
            aria-hidden="true"
          />
          <p>
            This foundation stores your professional
            scheduling preferences. It does not yet restrict
            or automatically reject ordinary appointment
            requests based on these windows.
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

      {loading && !data ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-center text-sm text-[color:var(--loombus-text-muted)]">
          Loading Professional Booking availability…
        </div>
      ) : null}

      {!loading &&
      data &&
      !canEdit &&
      !data.hasSavedSettings ? (
        <div className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-5">
          <h3 className="font-semibold">
            Add structured professional availability
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            Premium Pro adds recurring weekly availability,
            minimum booking notice, and maximum advance
            booking preferences without removing your Free
            Appointments tools.
          </p>

          {data.subscriptionResolutionAvailable ? (
            <button
              type="button"
              onClick={requestAccess}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-2.5 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90"
            >
              <CalendarRange size={16} />
              Configure with Premium Pro
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
            >
              <RefreshCw size={16} />
              Retry access check
            </button>
          )}
        </div>
      ) : null}

      {data &&
      (canEdit || data.hasSavedSettings) ? (
        <div className="mt-6 space-y-6">
          {!canEdit && data.hasSavedSettings ? (
            <div className="rounded-2xl border border-[color:var(--loombus-gold)]/30 bg-[color:var(--loombus-gold-soft)] p-4 text-sm leading-6">
              Your saved Professional Booking settings remain
              visible. Premium Pro is required to change or
              add professional availability.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-3">
              <span className="mb-2 block text-sm font-semibold">
                Booking timezone
              </span>
              <input
                value={draft.timezone}
                disabled={!canEdit}
                maxLength={100}
                placeholder="America/New_York"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
                className={fieldClass}
              />
              <span className="mt-1.5 block text-xs text-[color:var(--loombus-text-muted)]">
                Use an IANA timezone such as
                America/New_York.
              </span>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold">
                Minimum notice
              </span>
              <div className="relative">
                <Clock3
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[color:var(--loombus-text-muted)]"
                />
                <input
                  type="number"
                  min={0}
                  max={43200}
                  step={1}
                  disabled={!canEdit}
                  value={draft.minimumNoticeMinutes}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      minimumNoticeMinutes:
                        Number(event.target.value),
                    }))
                  }
                  className={`${fieldClass} pl-9`}
                />
              </div>
              <span className="mt-1.5 block text-xs text-[color:var(--loombus-text-muted)]">
                Minutes before a professional booking.
              </span>
            </label>

            <label>
              <span className="mb-2 block text-sm font-semibold">
                Maximum advance
              </span>
              <input
                type="number"
                min={1}
                max={365}
                step={1}
                disabled={!canEdit}
                value={draft.maximumAdvanceDays}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maximumAdvanceDays:
                      Number(event.target.value),
                  }))
                }
                className={fieldClass}
              />
              <span className="mt-1.5 block text-xs text-[color:var(--loombus-text-muted)]">
                Days into the future.
              </span>
            </label>

            <div className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4">
              <span className="text-sm font-semibold">
                Recurring windows
              </span>
              <strong className="mt-1 block text-2xl">
                {draft.weeklyAvailability.length}
              </strong>
              <span className="text-xs text-[color:var(--loombus-text-muted)]">
                Up to four per day.
              </span>
            </div>
          </div>

          <div>
            <div className="mb-3">
              <h3 className="font-semibold">
                Weekly availability
              </h3>
              <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Add one or more recurring windows for each
                day you normally accept professional
                bookings.
              </p>
            </div>

            <div className="space-y-3">
              {PROFESSIONAL_BOOKING_DAY_LABELS.map(
                (dayLabel, dayOfWeek) => {
                  const dayWindows =
                    draft.weeklyAvailability
                      .map((window, index) => ({
                        window,
                        index,
                      }))
                      .filter(
                        ({ window }) =>
                          window.dayOfWeek ===
                          dayOfWeek,
                      );

                  return (
                    <section
                      key={dayLabel}
                      className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h4 className="font-semibold">
                            {dayLabel}
                          </h4>
                          <p className="text-xs text-[color:var(--loombus-text-muted)]">
                            {dayWindows.length
                              ? `${dayWindows.length} recurring window${dayWindows.length === 1 ? "" : "s"}`
                              : "Unavailable by default"}
                          </p>
                        </div>

                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              addWindow(dayOfWeek)
                            }
                            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--loombus-border)] px-3 py-2 text-xs font-semibold transition hover:border-[color:var(--loombus-gold)]"
                          >
                            <Plus size={14} />
                            Add time
                          </button>
                        ) : null}
                      </div>

                      {dayWindows.length ? (
                        <div className="mt-3 space-y-2">
                          {dayWindows.map(
                            ({ window, index }) => (
                              <div
                                key={`${dayOfWeek}:${index}`}
                                className="grid gap-2 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-center"
                              >
                                <input
                                  aria-label={`${dayLabel} start time`}
                                  type="time"
                                  disabled={!canEdit}
                                  value={minuteToTime(
                                    window.startMinute,
                                  )}
                                  onChange={(event) => {
                                    const minute =
                                      timeToMinute(
                                        event.target.value,
                                      );
                                    if (minute !== null) {
                                      updateWindow(
                                        index,
                                        {
                                          startMinute:
                                            minute,
                                        },
                                      );
                                    }
                                  }}
                                  className={fieldClass}
                                />

                                <span className="text-center text-xs text-[color:var(--loombus-text-muted)]">
                                  to
                                </span>

                                <input
                                  aria-label={`${dayLabel} end time`}
                                  type="time"
                                  disabled={!canEdit}
                                  value={minuteToTime(
                                    window.endMinute,
                                  )}
                                  onChange={(event) => {
                                    const minute =
                                      timeToMinute(
                                        event.target.value,
                                      );
                                    if (minute !== null) {
                                      updateWindow(
                                        index,
                                        {
                                          endMinute:
                                            minute,
                                        },
                                      );
                                    }
                                  }}
                                  className={fieldClass}
                                />

                                {canEdit ? (
                                  <button
                                    type="button"
                                    aria-label={`Remove ${dayLabel} availability window`}
                                    onClick={() =>
                                      removeWindow(index)
                                    }
                                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--loombus-border)] text-[color:var(--loombus-text-muted)] transition hover:border-red-500/50 hover:text-red-500"
                                  >
                                    <Trash2
                                      size={15}
                                    />
                                  </button>
                                ) : null}
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}
                    </section>
                  );
                },
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 border-t border-[color:var(--loombus-border-muted)] pt-5">
            {canEdit ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50"
              >
                <Save size={16} />
                {saving
                  ? "Saving…"
                  : "Save Professional Booking"}
              </button>
            ) : data.subscriptionResolutionAvailable ? (
              <button
                type="button"
                onClick={requestAccess}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[color:var(--loombus-gold)] transition hover:bg-[color:var(--loombus-gold-soft)]"
              >
                <CalendarRange size={16} />
                Premium Pro required to edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)]"
              >
                <RefreshCw size={16} />
                Retry access check
              </button>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
