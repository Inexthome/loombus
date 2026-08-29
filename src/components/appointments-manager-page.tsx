"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  formatEventDateRange,
  type AppointmentRequest,
  type AppointmentService,
} from "@/lib/events";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";
import ProfessionalBookingAvailabilityCard from "@/components/professional-booking-availability-card";

type BusinessOption = { id: string; name: string; slug: string };
type ManagePayload = {
  businesses: BusinessOption[];
  services: AppointmentService[];
  receivedRequests: AppointmentRequest[];
  sentRequests: AppointmentRequest[];
};

type ServiceDraft = {
  serviceId: string;
  businessId: string;
  name: string;
  description: string;
  durationMinutes: string;
  locationMode: "in_person" | "online" | "phone" | "flexible";
  locationText: string;
  priceText: string;
  instructions: string;
};

type WorkspaceView = "received" | "services" | "sent";

const EMPTY_SERVICE: ServiceDraft = {
  serviceId: "",
  businessId: "",
  name: "",
  description: "",
  durationMinutes: "30",
  locationMode: "flexible",
  locationText: "",
  priceText: "",
  instructions: "",
};

const fieldClass =
  "w-full rounded-none border-0 border-b border-[color:var(--loombus-border)] bg-transparent px-0 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-0";

const secondaryActionClass =
  "inline-flex min-h-10 items-center gap-1.5 border-b border-[color:var(--loombus-border)] px-1 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:text-[color:var(--loombus-gold)] disabled:opacity-50";

function requestTime(request: AppointmentRequest) {
  const startsAt =
    request.status === "reschedule_proposed" && request.proposedStart
      ? request.proposedStart
      : request.requestedStart;
  const endsAt =
    request.status === "reschedule_proposed" && request.proposedEnd
      ? request.proposedEnd
      : request.requestedEnd;
  return formatEventDateRange(startsAt, endsAt, request.timezone);
}

function Status({ value }: { value: string }) {
  return (
    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function AppointmentsManagerPage() {
  const [data, setData] = useState<ManagePayload | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_SERVICE);
  const [view, setView] = useState<WorkspaceView>("received");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments?manage=1",
        { cache: "no-store" },
        "/appointments"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load Appointments.");
      setData(payload as ManagePayload);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load Appointments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingReceived = useMemo(
    () => (data?.receivedRequests ?? []).filter((request) => request.status === "pending"),
    [data]
  );

  const acceptedReceived = useMemo(
    () => (data?.receivedRequests ?? []).filter((request) => request.status === "accepted"),
    [data]
  );

  const activeServices = useMemo(
    () => (data?.services ?? []).filter((service) => service.status === "active"),
    [data]
  );

  function updateDraft<Key extends keyof ServiceDraft>(key: Key, value: ServiceDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking("service");
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            action: draft.serviceId ? "update_service" : "create_service",
          }),
        },
        "/appointments"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save the appointment service.");
      setDraft(EMPTY_SERVICE);
      setNotice("Appointment service saved.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the appointment service.");
    } finally {
      setWorking("");
    }
  }

  async function action(body: Record<string, unknown>, key: string, success: string) {
    if (working) return;
    setWorking(key);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/appointments",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "/appointments"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update the appointment.");
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the appointment.");
    } finally {
      setWorking("");
    }
  }

  function editService(service: AppointmentService) {
    setDraft({
      serviceId: service.id,
      businessId: service.businessId,
      name: service.name,
      description: service.description,
      durationMinutes: String(service.durationMinutes),
      locationMode: service.locationMode,
      locationText: service.locationText ?? "",
      priceText: service.priceText ?? "",
      instructions: service.instructions ?? "",
    });
    setView("services");
  }

  if (loading && !data) {
    return (
      <main
        data-appointments-editorial="manage"
        className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-[78rem] border-y border-[color:var(--loombus-border)] py-10 text-sm text-[color:var(--loombus-text-muted)]">
          Loading Appointments…
        </div>
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceView; label: string; count: number }> = [
    { key: "received", label: "Business requests", count: data?.receivedRequests.length ?? 0 },
    { key: "services", label: "Appointment services", count: data?.services.length ?? 0 },
    { key: "sent", label: "Requests you sent", count: data?.sentRequests.length ?? 0 },
  ];

  const signals = [
    ["Active services", activeServices.length],
    ["Awaiting you", pendingReceived.length],
    ["Accepted", acceptedReceived.length],
    ["Sent requests", data?.sentRequests.length ?? 0],
  ] as const;

  return (
    <main
      data-appointments-editorial="manage"
      className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8"
    >
      <div className="mx-auto max-w-[78rem]">
        <header className="flex flex-col gap-5 border-b border-[color:var(--loombus-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Scheduling workspace
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
              Appointments
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Manage business services, respond to appointment requests, and track the requests you send.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/calendar" className={secondaryActionClass}>
              <CalendarClock aria-hidden="true" className="h-4 w-4 text-[color:var(--loombus-gold)]" />
              Open calendar
            </Link>
            <button type="button" onClick={() => void load()} className={secondaryActionClass}>
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 text-[color:var(--loombus-gold)] ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="grid grid-cols-2 border-b border-[color:var(--loombus-border)] sm:grid-cols-4">
          {signals.map(([label, value], index) => (
            <div
              key={label}
              className={`py-5 ${index % 2 === 0 ? "pr-4" : "border-l border-[color:var(--loombus-border-muted)] pl-4"} sm:border-l sm:border-[color:var(--loombus-border-muted)] sm:px-5 sm:first:border-l-0 sm:first:pl-0`}
            >
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-text-muted)]">
                {label}
              </span>
              <strong className="mt-1 block text-2xl tracking-[-0.04em]">{value}</strong>
            </div>
          ))}
        </section>

        {notice ? (
          <div className="my-5 border-l-2 border-[color:var(--loombus-gold)] py-2 pl-4 text-sm" role="status">
            {notice}
          </div>
        ) : null}

        <nav
          aria-label="Appointment workspace"
          className="mb-8 flex gap-7 overflow-x-auto border-b border-[color:var(--loombus-border-muted)]"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`flex shrink-0 items-center gap-2 border-b-2 py-4 text-sm font-semibold transition ${
                view === tab.key
                  ? "border-[color:var(--loombus-gold)] text-[color:var(--loombus-gold)]"
                  : "border-transparent text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
              }`}
            >
              {tab.label}
              <span className="text-xs">{tab.count}</span>
            </button>
          ))}
        </nav>

        {view === "received" ? (
          <section aria-labelledby="received-heading">
            <div className="mb-2 pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Provider workspace
              </p>
              <h2 id="received-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                Requests sent to your businesses
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Review proposed times and explicitly accept, reschedule, decline, complete, or cancel each request.
              </p>
            </div>

            <div className="divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border)]">
              {(data?.receivedRequests.length ?? 0) === 0 ? (
                <div className="py-8 text-sm text-[color:var(--loombus-text-muted)]">
                  No appointment requests received.
                </div>
              ) : (
                data?.receivedRequests.map((request) => (
                  <article key={request.id} className="py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <Status value={request.status} />
                          {request.status === "pending" ? (
                            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--loombus-gold)]">
                              Needs response
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
                          {request.serviceName}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          Requested by {request.requesterName}
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          <Clock3 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                          <span>{requestTime(request)}</span>
                        </p>
                        {request.note ? (
                          <p className="mt-4 max-w-3xl border-l border-[color:var(--loombus-border)] pl-4 text-sm leading-6">
                            {request.note}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 lg:max-w-[22rem] lg:justify-end">
                        {request.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void action(
                                  { action: "provider_response", requestId: request.id, decision: "accept" },
                                  `accept:${request.id}`,
                                  "Appointment accepted."
                                )
                              }
                              className="inline-flex min-h-10 items-center gap-1.5 border-b-2 border-[color:var(--loombus-gold)] px-1 text-sm font-semibold text-[color:var(--loombus-gold)] disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} /> Accept
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() => {
                                const proposed = window.prompt(
                                  "Proposed date and time in local format, for example 2026-08-03T14:30"
                                );
                                if (proposed) {
                                  void action(
                                    {
                                      action: "provider_response",
                                      requestId: request.id,
                                      decision: "propose_reschedule",
                                      proposedStart: new Date(proposed).toISOString(),
                                    },
                                    `reschedule:${request.id}`,
                                    "New time proposed."
                                  );
                                }
                              }}
                              className={secondaryActionClass}
                            >
                              Suggest time
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void action(
                                  { action: "provider_response", requestId: request.id, decision: "decline" },
                                  `decline:${request.id}`,
                                  "Appointment declined."
                                )
                              }
                              className={secondaryActionClass}
                            >
                              <XCircle size={14} /> Decline
                            </button>
                          </>
                        ) : null}

                        {request.status === "accepted" &&
                        new Date(request.requestedStart).getTime() <= Date.now() ? (
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() =>
                              void action(
                                { action: "complete", requestId: request.id },
                                `complete:${request.id}`,
                                "Appointment completed."
                              )
                            }
                            className={secondaryActionClass}
                          >
                            Complete
                          </button>
                        ) : null}

                        {request.status === "accepted" ? (
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() => {
                              if (window.confirm("Cancel this accepted appointment?")) {
                                void action(
                                  { action: "provider_response", requestId: request.id, decision: "cancel" },
                                  `provider-cancel:${request.id}`,
                                  "Appointment cancelled."
                                );
                              }
                            }}
                            className="inline-flex min-h-10 items-center border-b border-red-500/60 px-1 text-sm font-semibold text-red-500 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        {view === "services" ? (
          (data?.businesses.length ?? 0) > 0 ? (
            <div className="space-y-10">
              <ProfessionalBookingAvailabilityCard />

              <form onSubmit={saveService} className="border-y border-[color:var(--loombus-border)] py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                      Business scheduling
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                      {draft.serviceId ? "Edit appointment service" : "Add appointment service"}
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      Define the service members can request from a published Loombus business.
                    </p>
                  </div>
                  {draft.serviceId ? (
                    <button type="button" onClick={() => setDraft(EMPTY_SERVICE)} className={secondaryActionClass}>
                      Clear edit
                    </button>
                  ) : null}
                </div>

                <div className="mt-7 grid gap-x-8 gap-y-6 sm:grid-cols-2">
                  <label className="sm:col-span-2">
                    <span className="block text-sm font-semibold">Business</span>
                    <select
                      required
                      value={draft.businessId}
                      onChange={(event) => updateDraft("businessId", event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">Choose business</option>
                      {data?.businesses.map((business) => (
                        <option key={business.id} value={business.id}>
                          {business.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="sm:col-span-2">
                    <span className="block text-sm font-semibold">Service name</span>
                    <input
                      required
                      maxLength={200}
                      value={draft.name}
                      onChange={(event) => updateDraft("name", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="block text-sm font-semibold">Description</span>
                    <textarea
                      required
                      rows={5}
                      maxLength={5000}
                      value={draft.description}
                      onChange={(event) => updateDraft("description", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className="block text-sm font-semibold">Duration in minutes</span>
                    <input
                      type="number"
                      min={15}
                      max={480}
                      required
                      value={draft.durationMinutes}
                      onChange={(event) => updateDraft("durationMinutes", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className="block text-sm font-semibold">Location type</span>
                    <select
                      value={draft.locationMode}
                      onChange={(event) =>
                        updateDraft("locationMode", event.target.value as ServiceDraft["locationMode"])
                      }
                      className={fieldClass}
                    >
                      <option value="flexible">Flexible</option>
                      <option value="in_person">In person</option>
                      <option value="online">Online</option>
                      <option value="phone">Phone</option>
                    </select>
                  </label>

                  <label>
                    <span className="block text-sm font-semibold">Location details</span>
                    <input
                      maxLength={300}
                      value={draft.locationText}
                      onChange={(event) => updateDraft("locationText", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label>
                    <span className="block text-sm font-semibold">Price details</span>
                    <input
                      maxLength={200}
                      value={draft.priceText}
                      onChange={(event) => updateDraft("priceText", event.target.value)}
                      className={fieldClass}
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="block text-sm font-semibold">Instructions</span>
                    <textarea
                      rows={3}
                      maxLength={3000}
                      value={draft.instructions}
                      onChange={(event) => updateDraft("instructions", event.target.value)}
                      className={fieldClass}
                    />
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={working === "service"}
                  className="mt-6 inline-flex min-h-11 items-center gap-2 border-b-2 border-[color:var(--loombus-gold)] px-1 text-sm font-semibold text-[color:var(--loombus-gold)] disabled:opacity-50"
                >
                  <Send size={16} /> Save service
                </button>
              </form>

              <section aria-labelledby="services-heading">
                <div className="flex items-center gap-2 pb-5">
                  <Building2 className="h-5 w-5 text-[color:var(--loombus-gold)]" aria-hidden="true" />
                  <h2 id="services-heading" className="text-xl font-semibold">Your appointment services</h2>
                </div>

                <div className="divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border)]">
                  {data?.services.length === 0 ? (
                    <div className="py-8 text-sm text-[color:var(--loombus-text-muted)]">
                      No appointment services yet.
                    </div>
                  ) : (
                    data?.services.map((service) => (
                      <article key={service.id} className="py-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <Status value={service.status} />
                            <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{service.name}</h3>
                            <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                              {service.businessName} · {service.durationMinutes} minutes
                            </p>
                            <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                              {service.description}
                            </p>
                          </div>
                          <button type="button" onClick={() => editService(service)} className={secondaryActionClass}>
                            Edit
                          </button>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 border-t border-[color:var(--loombus-border-muted)] pt-4">
                          {service.status === "active" ? (
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void action(
                                  { action: "set_service_status", serviceId: service.id, status: "paused" },
                                  `pause:${service.id}`,
                                  "Service paused."
                                )
                              }
                              className={secondaryActionClass}
                            >
                              <PauseCircle size={14} /> Pause
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={Boolean(working)}
                              onClick={() =>
                                void action(
                                  { action: "set_service_status", serviceId: service.id, status: "active" },
                                  `activate:${service.id}`,
                                  "Service activated."
                                )
                              }
                              className={secondaryActionClass}
                            >
                              <RotateCcw size={14} /> Activate
                            </button>
                          )}
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() =>
                              void action(
                                { action: "set_service_status", serviceId: service.id, status: "archived" },
                                `archive:${service.id}`,
                                "Service archived."
                              )
                            }
                            className={secondaryActionClass}
                          >
                            Archive
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : (
            <section className="border-y border-[color:var(--loombus-border)] py-8">
              <Building2 className="text-[color:var(--loombus-gold)]" size={34} aria-hidden="true" />
              <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-[-0.035em]">
                A published business profile is required to offer appointments.
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Create or publish a business profile before adding appointment services.
              </p>
              <Link href="/businesses/manage" className={`mt-4 ${secondaryActionClass}`}>
                Open business management
              </Link>
            </section>
          )
        ) : null}

        {view === "sent" ? (
          <section aria-labelledby="sent-heading">
            <div className="pb-5">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
                Member workspace
              </p>
              <h2 id="sent-heading" className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                Your appointment requests
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                Track provider decisions, accept proposed times, or cancel open requests.
              </p>
            </div>

            <div className="divide-y divide-[color:var(--loombus-border-muted)] border-y border-[color:var(--loombus-border)]">
              {(data?.sentRequests.length ?? 0) === 0 ? (
                <div className="py-8 text-sm text-[color:var(--loombus-text-muted)]">
                  No appointment requests sent.
                </div>
              ) : (
                data?.sentRequests.map((request) => (
                  <article key={request.id} className="py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <Status value={request.status} />
                        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{request.serviceName}</h3>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          {request.businessName}
                        </p>
                        <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          <Clock3 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[color:var(--loombus-gold)]" />
                          <span>{requestTime(request)}</span>
                        </p>
                        {request.providerNote ? (
                          <p className="mt-4 max-w-3xl border-l border-[color:var(--loombus-border)] pl-4 text-sm leading-6">
                            Provider note: {request.providerNote}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-4 lg:max-w-[20rem] lg:justify-end">
                        {request.status === "reschedule_proposed" ? (
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() =>
                              void action(
                                {
                                  action: "requester_action",
                                  requestId: request.id,
                                  requestAction: "accept_reschedule",
                                },
                                `accept-reschedule:${request.id}`,
                                "Proposed time accepted."
                              )
                            }
                            className="inline-flex min-h-10 items-center border-b-2 border-[color:var(--loombus-gold)] px-1 text-sm font-semibold text-[color:var(--loombus-gold)] disabled:opacity-50"
                          >
                            Accept new time
                          </button>
                        ) : null}
                        {!['declined', 'cancelled', 'completed'].includes(request.status) ? (
                          <button
                            type="button"
                            disabled={Boolean(working)}
                            onClick={() =>
                              void action(
                                {
                                  action: "requester_action",
                                  requestId: request.id,
                                  requestAction: "cancel",
                                },
                                `cancel:${request.id}`,
                                "Appointment cancelled."
                              )
                            }
                            className={secondaryActionClass}
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        ) : null}

        <section className="mt-12 grid gap-8 border-t border-[color:var(--loombus-border)] pt-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Connected tools
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Link href="/calendar" className="group flex items-center justify-between border-b border-[color:var(--loombus-border)] py-3 text-sm font-semibold">
                My Calendar
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[color:var(--loombus-gold)]" />
              </Link>
              <Link href="/businesses/manage" className="group flex items-center justify-between border-b border-[color:var(--loombus-border)] py-3 text-sm font-semibold">
                Business management
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[color:var(--loombus-gold)]" />
              </Link>
              <Link href="/businesses" className="group flex items-center justify-between border-b border-[color:var(--loombus-border)] py-3 text-sm font-semibold">
                Browse businesses
                <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[color:var(--loombus-gold)]" />
              </Link>
            </div>
          </div>

          <div className="space-y-5 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
            <div className="flex gap-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
              <p>
                <strong className="text-[color:var(--loombus-text)]">Explicit confirmation.</strong>{" "}
                A proposed appointment is not confirmed until the provider accepts it.
              </p>
            </div>
            <div className="flex gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
              <p>
                Loombus does not process appointment payments, verify professional credentials, or guarantee services. Businesses and members remain responsible for confirming details, qualifications, location, and payment terms.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
