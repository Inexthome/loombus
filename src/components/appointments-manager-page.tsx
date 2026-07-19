"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
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
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[#b45309] focus:ring-4 focus:ring-orange-500/10";

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
    <span className="rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold capitalize text-[color:var(--loombus-text-muted)]">
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
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[78rem] rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center text-[color:var(--loombus-text-muted)] shadow-xl shadow-black/10">
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

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[78rem]">
        <header className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-[-0.055em] text-[color:var(--loombus-text)] sm:text-5xl">
              Appointments
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[color:var(--loombus-text-muted)]">
              Manage business services, respond to appointment requests, and track the requests you send.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/calendar"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[#b45309]"
            >
              <CalendarClock aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
              Open calendar
            </Link>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold shadow-sm transition hover:border-[#b45309]"
            >
              <RefreshCw
                aria-hidden="true"
                className={`h-4 w-4 text-[#b45309] ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              Active services
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em] text-[color:var(--loombus-text)]">
              {activeServices.length}
            </strong>
          </article>
          <article className="rounded-[1.4rem] border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-400/30 dark:bg-orange-400/10">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b45309]">
              Awaiting you
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em] text-[color:var(--loombus-text)]">
              {pendingReceived.length}
            </strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
              Sent requests
            </span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em] text-[color:var(--loombus-text)]">
              {data?.sentRequests.length ?? 0}
            </strong>
          </article>
        </section>

        {notice ? (
          <div
            className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm"
            role="status"
          >
            {notice}
          </div>
        ) : null}

        <nav
          aria-label="Appointment workspace"
          className="mb-6 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-sm"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                view === tab.key
                  ? "bg-orange-50 text-[#b45309] dark:bg-orange-400/10"
                  : "text-[color:var(--loombus-text)] hover:bg-[color:var(--loombus-surface-muted)]"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  view === tab.key
                    ? "bg-[color:var(--loombus-surface)] text-[#b45309]"
                    : "bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text-muted)]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {view === "received" ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b45309]">
                    Provider workspace
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    Requests sent to your businesses
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Review proposed times and explicitly accept, reschedule, decline, complete, or cancel each request.
                  </p>
                </div>

                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {(data?.receivedRequests.length ?? 0) === 0 ? (
                    <div className="p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
                      No appointment requests received.
                    </div>
                  ) : (
                    data?.receivedRequests.map((request) => (
                      <article key={request.id} className="p-5 sm:p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Status value={request.status} />
                              {request.status === "pending" ? (
                                <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-[#b45309] dark:bg-orange-400/10">
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
                              <Clock3 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#b45309]" />
                              <span>{requestTime(request)}</span>
                            </p>
                            {request.note ? (
                              <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6">
                                {request.note}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
                            {request.status === "pending" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={Boolean(working)}
                                  onClick={() =>
                                    void action(
                                      {
                                        action: "provider_response",
                                        requestId: request.id,
                                        decision: "accept",
                                      },
                                      `accept:${request.id}`,
                                      "Appointment accepted."
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-full bg-[#b45309] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:opacity-50"
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
                                    if (proposed)
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
                                  }}
                                  className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309] disabled:opacity-50"
                                >
                                  Suggest time
                                </button>
                                <button
                                  type="button"
                                  disabled={Boolean(working)}
                                  onClick={() =>
                                    void action(
                                      {
                                        action: "provider_response",
                                        requestId: request.id,
                                        decision: "decline",
                                      },
                                      `decline:${request.id}`,
                                      "Appointment declined."
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309] disabled:opacity-50"
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
                                className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309] disabled:opacity-50"
                              >
                                Complete
                              </button>
                            ) : null}

                            {request.status === "accepted" ? (
                              <button
                                type="button"
                                disabled={Boolean(working)}
                                onClick={() => {
                                  if (window.confirm("Cancel this accepted appointment?"))
                                    void action(
                                      {
                                        action: "provider_response",
                                        requestId: request.id,
                                        decision: "cancel",
                                      },
                                      `provider-cancel:${request.id}`,
                                      "Appointment cancelled."
                                    );
                                }}
                                className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-500 disabled:opacity-50"
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
                <div className="space-y-6">
                  <form
                    onSubmit={saveService}
                    className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b45309]">
                          Business scheduling
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                          {draft.serviceId ? "Edit appointment service" : "Add appointment service"}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                          Define the service members can request from a published Loombus business.
                        </p>
                      </div>
                      {draft.serviceId ? (
                        <button
                          type="button"
                          onClick={() => setDraft(EMPTY_SERVICE)}
                          className="shrink-0 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309]"
                        >
                          Clear edit
                        </button>
                      ) : null}
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-2 block text-sm font-semibold">Business</span>
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
                        <span className="mb-2 block text-sm font-semibold">Service name</span>
                        <input
                          required
                          maxLength={200}
                          value={draft.name}
                          onChange={(event) => updateDraft("name", event.target.value)}
                          className={fieldClass}
                        />
                      </label>

                      <label className="sm:col-span-2">
                        <span className="mb-2 block text-sm font-semibold">Description</span>
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
                        <span className="mb-2 block text-sm font-semibold">Duration in minutes</span>
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
                        <span className="mb-2 block text-sm font-semibold">Location type</span>
                        <select
                          value={draft.locationMode}
                          onChange={(event) =>
                            updateDraft(
                              "locationMode",
                              event.target.value as ServiceDraft["locationMode"]
                            )
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
                        <span className="mb-2 block text-sm font-semibold">Location details</span>
                        <input
                          maxLength={300}
                          value={draft.locationText}
                          onChange={(event) => updateDraft("locationText", event.target.value)}
                          className={fieldClass}
                        />
                      </label>

                      <label>
                        <span className="mb-2 block text-sm font-semibold">Price details</span>
                        <input
                          maxLength={200}
                          value={draft.priceText}
                          onChange={(event) => updateDraft("priceText", event.target.value)}
                          className={fieldClass}
                        />
                      </label>

                      <label className="sm:col-span-2">
                        <span className="mb-2 block text-sm font-semibold">Instructions</span>
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
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#b45309] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:opacity-50"
                    >
                      <Send size={16} /> Save service
                    </button>
                  </form>

                  <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                    <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-[#b45309]" />
                        <h2 className="text-xl font-semibold">Your appointment services</h2>
                      </div>
                    </div>

                    <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                      {data?.services.length === 0 ? (
                        <div className="p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
                          No appointment services yet.
                        </div>
                      ) : (
                        data?.services.map((service) => (
                          <article key={service.id} className="p-5 sm:p-6">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <Status value={service.status} />
                                <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
                                  {service.name}
                                </h3>
                                <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                                  {service.businessName} · {service.durationMinutes} minutes
                                </p>
                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                                  {service.description}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => editService(service)}
                                className="shrink-0 rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309]"
                              >
                                Edit
                              </button>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--loombus-border-muted)] pt-4">
                              {service.status === "active" ? (
                                <button
                                  type="button"
                                  disabled={Boolean(working)}
                                  onClick={() =>
                                    void action(
                                      {
                                        action: "set_service_status",
                                        serviceId: service.id,
                                        status: "paused",
                                      },
                                      `pause:${service.id}`,
                                      "Service paused."
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--loombus-border)] px-3 py-2 text-xs font-semibold transition hover:border-[#b45309] disabled:opacity-50"
                                >
                                  <PauseCircle size={14} /> Pause
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={Boolean(working)}
                                  onClick={() =>
                                    void action(
                                      {
                                        action: "set_service_status",
                                        serviceId: service.id,
                                        status: "active",
                                      },
                                      `activate:${service.id}`,
                                      "Service activated."
                                    )
                                  }
                                  className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--loombus-border)] px-3 py-2 text-xs font-semibold transition hover:border-[#b45309] disabled:opacity-50"
                                >
                                  <RotateCcw size={14} /> Activate
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={Boolean(working)}
                                onClick={() =>
                                  void action(
                                    {
                                      action: "set_service_status",
                                      serviceId: service.id,
                                      status: "archived",
                                    },
                                    `archive:${service.id}`,
                                    "Service archived."
                                  )
                                }
                                className="rounded-full border border-[color:var(--loombus-border)] px-3 py-2 text-xs font-semibold transition hover:border-[#b45309] disabled:opacity-50"
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
                <section className="rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center shadow-xl shadow-black/10">
                  <Building2 className="mx-auto text-[#b45309]" size={38} />
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.035em]">
                    A published business profile is required to offer appointments.
                  </h2>
                  <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Create or publish a business profile before adding appointment services.
                  </p>
                  <Link
                    href="/businesses/manage"
                    className="mt-5 inline-flex rounded-full border border-[color:var(--loombus-border)] px-5 py-3 text-sm font-semibold transition hover:border-[#b45309]"
                  >
                    Open business management
                  </Link>
                </section>
              )
            ) : null}

            {view === "sent" ? (
              <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[#b45309]">
                    Member workspace
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">
                    Your appointment requests
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Track provider decisions, accept proposed times, or cancel open requests.
                  </p>
                </div>

                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {(data?.sentRequests.length ?? 0) === 0 ? (
                    <div className="p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
                      No appointment requests sent.
                    </div>
                  ) : (
                    data?.sentRequests.map((request) => (
                      <article key={request.id} className="p-5 sm:p-6">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0">
                            <Status value={request.status} />
                            <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
                              {request.serviceName}
                            </h3>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                              {request.businessName}
                            </p>
                            <p className="mt-1 flex items-start gap-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                              <Clock3 aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#b45309]" />
                              <span>{requestTime(request)}</span>
                            </p>
                            {request.providerNote ? (
                              <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6">
                                Provider note: {request.providerNote}
                              </p>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[18rem] lg:justify-end">
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
                                className="rounded-full bg-[#b45309] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#92400e] disabled:opacity-50"
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
                                className="rounded-full border border-[color:var(--loombus-border)] px-4 py-2 text-sm font-semibold transition hover:border-[#b45309] disabled:opacity-50"
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
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="mb-5 flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-text)]">
                  Appointment status
                </p>
                <BriefcaseBusiness aria-hidden="true" className="h-5 w-5 text-[#b45309]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                    Pending
                  </span>
                  <strong className="mt-1 block text-2xl">{pendingReceived.length}</strong>
                </article>
                <article className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                  <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">
                    Accepted
                  </span>
                  <strong className="mt-1 block text-2xl">{acceptedReceived.length}</strong>
                </article>
              </div>

              <button
                type="button"
                onClick={() => setView("received")}
                className="mt-3 flex w-full items-center justify-between rounded-2xl bg-orange-50 px-4 py-3 text-left text-sm font-semibold text-[#b45309] transition hover:bg-orange-100 dark:bg-orange-400/10 dark:hover:bg-orange-400/15"
              >
                Review business requests
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-[color:var(--loombus-text)]">
                Appointment tools
              </p>
              <div className="mt-4 space-y-2">
                <Link
                  href="/calendar"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  My Calendar
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <button
                  type="button"
                  onClick={() => setView("services")}
                  className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Manage services
                  <ChevronRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </button>
                <Link
                  href="/businesses/manage"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Business management
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
                <Link
                  href="/businesses"
                  className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]"
                >
                  Browse businesses
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-[#b45309]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#b45309] dark:bg-orange-400/10">
                  <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">Explicit confirmation</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    A proposed appointment is not confirmed until the provider accepts it.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-page-bg)] text-[#b45309]">
                  <ShieldCheck aria-hidden="true" className="h-5 w-5" />
                </span>
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                  Loombus does not process appointment payments, verify professional credentials, or guarantee services. Businesses and members remain responsible for confirming details, qualifications, location, and payment terms.
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
