"use client";

import Link from "next/link";
import { CalendarClock, Clock3, MapPin, Send } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { AppointmentService } from "@/lib/events";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

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

  const selected = useMemo(
    () => services.find((service) => service.id === selectedId) ?? null,
    [selectedId, services],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !requestedStart || working) return;
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
              onClick={() => setSelectedId(service.id)}
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
              disabled={working || !requestedStart}
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
