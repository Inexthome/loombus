"use client";

import Link from "next/link";
import {
  CalendarClock,
  ClipboardList,
  Clock3,
  MapPin,
  Send,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AppointmentService } from "@/lib/events";
import {
  PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH,
  type ProfessionalBookingIntakeQuestion,
} from "@/lib/professional-booking-intake";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type SlotGuidance = {
  serviceId: string;
  active: boolean;
  providerTimezone: string | null;
  suggestedStarts: string[];
};

type IntakeForm = {
  serviceId: string;
  active: boolean;
  questions: ProfessionalBookingIntakeQuestion[];
};

function isoToLocalDateTimeInput(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function suggestedTimeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Suggested time";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function isIntakeQuestion(value: unknown): value is ProfessionalBookingIntakeQuestion {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.label === "string" &&
    typeof row.required === "boolean"
  );
}

export default function BusinessSchedulingSection({
  businessSlug,
  preselectServiceId = "",
}: {
  businessSlug: string;
  preselectServiceId?: string;
}) {
  const [services, setServices] = useState<AppointmentService[]>([]);
  const [businessName, setBusinessName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [slotGuidance, setSlotGuidance] = useState<SlotGuidance | null>(null);
  const [intakeForm, setIntakeForm] = useState<IntakeForm | null>(null);
  const [intakeAnswers, setIntakeAnswers] = useState<Record<string, string>>({});
  const [requestedStart, setRequestedStart] = useState("");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/appointments?businessSlug=${encodeURIComponent(businessSlug)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        const nextServices = Array.isArray(payload.services)
          ? (payload.services as AppointmentService[])
          : [];
        setServices(nextServices);
        setBusinessName(String(payload.business?.name ?? ""));
        if (preselectServiceId && nextServices.some((service) => service.id === preselectServiceId)) {
          setSelectedId(preselectServiceId);
        }
      })
      .catch(() => null)
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [businessSlug, preselectServiceId]);

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    const params = new URLSearchParams({
      businessSlug,
      slotGuidanceServiceId: selectedId,
    });

    void fetch(`/api/appointments?${params.toString()}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setSlotGuidance({
          serviceId: selectedId,
          active: payload.active === true,
          providerTimezone:
            typeof payload.providerTimezone === "string"
              ? payload.providerTimezone
              : null,
          suggestedStarts: Array.isArray(payload.suggestedStarts)
            ? payload.suggestedStarts.filter(
                (value: unknown): value is string => typeof value === "string",
              )
            : [],
        });
      })
      .catch(() => null);

    return () => {
      active = false;
    };
  }, [businessSlug, selectedId]);

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    const params = new URLSearchParams({
      businessSlug,
      intakeServiceId: selectedId,
    });

    void fetch(`/api/appointments?${params.toString()}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((payload) => {
        if (!active) return;
        setIntakeForm({
          serviceId: selectedId,
          active: payload.active === true,
          questions: Array.isArray(payload.questions)
            ? payload.questions.filter(isIntakeQuestion)
            : [],
        });
      })
      .catch(() => {
        if (!active) return;
        setIntakeForm({
          serviceId: selectedId,
          active: false,
          questions: [],
        });
      });

    return () => {
      active = false;
    };
  }, [businessSlug, selectedId]);

  const selected = useMemo(
    () => services.find((service) => service.id === selectedId) ?? null,
    [selectedId, services],
  );

  const selectedGuidance =
    slotGuidance?.serviceId === selectedId ? slotGuidance : null;
  const selectedIntake =
    intakeForm?.serviceId === selectedId ? intakeForm : null;
  const intakeReady = !selected || intakeForm?.serviceId === selected.id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !requestedStart || !intakeReady || working) return;
    setWorking(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "request",
            serviceId: selected.id,
            requestedStart: new Date(requestedStart).toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            note,
            intakeAnswers:
              selectedIntake?.active && selectedIntake.questions.length
                ? selectedIntake.questions.map((question) => ({
                    id: question.id,
                    answer: intakeAnswers[question.id] ?? "",
                  }))
                : [],
          }),
        },
        `/businesses/${businessSlug}`,
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to request the appointment.");
      }
      setRequestedStart("");
      setNote("");
      setIntakeAnswers({});
      setNotice("Appointment request sent. Track it from Appointments.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to request the appointment.",
      );
    } finally {
      setWorking(false);
    }
  }

  if (!loaded || services.length === 0) return null;

  return (
    <section
      id="appointments"
      className="scroll-mt-28 bg-[var(--loombus-page-bg)] px-4 pb-10 text-[var(--loombus-text)] sm:px-6"
    >
      <div className="mx-auto max-w-6xl rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Appointments
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Request time with {businessName || "this business"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--loombus-text-muted)]">
              Choose a service and propose a time. The business must accept or
              suggest another time before it becomes confirmed.
            </p>
          </div>
          <Link
            href="/appointments"
            className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
          >
            Track requests
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {services.map((service) => (
            <button
              key={service.id}
              type="button"
              onClick={() => {
                setSelectedId(service.id);
                setIntakeForm(null);
                setIntakeAnswers({});
              }}
              className={`rounded-2xl border p-4 text-left transition ${
                selectedId === service.id
                  ? "border-[var(--loombus-text)] bg-[var(--loombus-surface-muted)]"
                  : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]"
              }`}
            >
              <strong className="block text-lg">{service.name}</strong>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 space-y-2 text-xs text-[var(--loombus-text-muted)]">
                <span className="flex items-center gap-2">
                  <Clock3 size={14} /> {service.durationMinutes} minutes
                </span>
                <span className="flex items-center gap-2">
                  <MapPin size={14} />{" "}
                  {service.locationText || service.locationMode.replaceAll("_", " ")}
                </span>
                {service.priceText ? <span>{service.priceText}</span> : null}
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <form
            onSubmit={submit}
            className="mt-5 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
          >
            <div className="flex items-center gap-2">
              <CalendarClock size={19} />
              <h3 className="font-semibold">Request {selected.name}</h3>
            </div>

            {selectedGuidance?.active ? (
              <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <strong className="text-sm">Suggested Professional Booking times</strong>
                <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
                  Suggestions are shown in your local time and still require the
                  business to accept your request.
                  {selectedGuidance.providerTimezone
                    ? ` Provider availability uses ${selectedGuidance.providerTimezone}.`
                    : ""}
                </p>

                {selectedGuidance.suggestedStarts.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedGuidance.suggestedStarts.map((start) => {
                      const inputValue = isoToLocalDateTimeInput(start);
                      const selectedSuggestion =
                        inputValue && requestedStart === inputValue;

                      return (
                        <button
                          key={start}
                          type="button"
                          onClick={() => {
                            if (inputValue) setRequestedStart(inputValue);
                          }}
                          className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                            selectedSuggestion
                              ? "border-[var(--loombus-text)] bg-[var(--loombus-surface-muted)]"
                              : "border-[var(--loombus-border)] hover:border-[var(--loombus-text-muted)]"
                          }`}
                        >
                          {suggestedTimeLabel(start)}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
                    No suggested Professional Booking times are currently
                    available within this provider&apos;s booking window.
                  </p>
                )}
              </div>
            ) : null}

            {selectedIntake?.active && selectedIntake.questions.length ? (
              <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                <div className="flex items-center gap-2">
                  <ClipboardList size={17} />
                  <strong className="text-sm">Client intake</strong>
                </div>
                <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
                  Answer the provider&apos;s booking questions. Your answers are
                  attached to this appointment request.
                </p>
                <div className="mt-4 space-y-4">
                  {selectedIntake.questions.map((question) => (
                    <label key={question.id} className="block">
                      <span className="mb-2 block text-sm font-semibold">
                        {question.label}
                        {question.required ? (
                          <span className="ml-1 text-[var(--loombus-text-muted)]">
                            (required)
                          </span>
                        ) : null}
                      </span>
                      <textarea
                        rows={3}
                        required={question.required}
                        maxLength={PROFESSIONAL_BOOKING_INTAKE_ANSWER_MAX_LENGTH}
                        value={intakeAnswers[question.id] ?? ""}
                        onChange={(event) =>
                          setIntakeAnswers((current) => ({
                            ...current,
                            [question.id]: event.target.value,
                          }))
                        }
                        className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">
                  Proposed start
                </span>
                <input
                  type="datetime-local"
                  required
                  value={requestedStart}
                  onChange={(event) => setRequestedStart(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Note</span>
                <input
                  maxLength={3000}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3"
                  placeholder="What should the business know?"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={working || !requestedStart || !intakeReady}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"
            >
              <Send size={16} /> Send appointment request
            </button>
          </form>
        ) : null}

        {notice ? (
          <p className="mt-4 text-sm" role="status">
            {notice}
          </p>
        ) : null}
      </div>
    </section>
  );
}
