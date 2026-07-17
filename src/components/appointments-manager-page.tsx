"use client";

import Link from "next/link";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  PauseCircle,
  RefreshCw,
  RotateCcw,
  Send,
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

function requestTime(request: AppointmentRequest) {
  const startsAt = request.status === "reschedule_proposed" && request.proposedStart
    ? request.proposedStart
    : request.requestedStart;
  const endsAt = request.status === "reschedule_proposed" && request.proposedEnd
    ? request.proposedEnd
    : request.requestedEnd;
  return formatEventDateRange(startsAt, endsAt, request.timezone);
}

function Status({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold capitalize">
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default function AppointmentsManagerPage() {
  const [data, setData] = useState<ManagePayload | null>(null);
  const [draft, setDraft] = useState<ServiceDraft>(EMPTY_SERVICE);
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

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
          Loading Appointments…
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Appointments
              </p>
              <h1 className="mt-2 text-4xl font-semibold">Requests with explicit confirmation.</h1>
              <p className="mt-3 max-w-2xl text-[var(--loombus-text-muted)]">
                Businesses define services. Members propose times. Nothing is confirmed until the provider accepts.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/calendar" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">
                Open calendar
              </Link>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Services</span><strong className="mt-1 block text-2xl">{data?.services.length ?? 0}</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Awaiting you</span><strong className="mt-1 block text-2xl">{pendingReceived.length}</strong></article>
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Sent requests</span><strong className="mt-1 block text-2xl">{data?.sentRequests.length ?? 0}</strong></article>
          </div>
        </header>

        {notice ? <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">{notice}</div> : null}

        {(data?.businesses.length ?? 0) > 0 ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <form onSubmit={saveService} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Business scheduling</p><h2 className="mt-1 text-2xl font-semibold">{draft.serviceId ? "Edit service" : "Add appointment service"}</h2></div>
                {draft.serviceId ? <button type="button" onClick={() => setDraft(EMPTY_SERVICE)} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Clear edit</button> : null}
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Business</span><select required value={draft.businessId} onChange={(event) => updateDraft("businessId", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="">Choose business</option>{data?.businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Service name</span><input required maxLength={200} value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Description</span><textarea required rows={5} maxLength={5000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Duration in minutes</span><input type="number" min={15} max={480} required value={draft.durationMinutes} onChange={(event) => updateDraft("durationMinutes", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Location type</span><select value={draft.locationMode} onChange={(event) => updateDraft("locationMode", event.target.value as ServiceDraft["locationMode"])} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3"><option value="flexible">Flexible</option><option value="in_person">In person</option><option value="online">Online</option><option value="phone">Phone</option></select></label>
                <label><span className="mb-2 block text-sm font-semibold">Location details</span><input maxLength={300} value={draft.locationText} onChange={(event) => updateDraft("locationText", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
                <label><span className="mb-2 block text-sm font-semibold">Price details</span><input maxLength={200} value={draft.priceText} onChange={(event) => updateDraft("priceText", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
                <label className="sm:col-span-2"><span className="mb-2 block text-sm font-semibold">Instructions</span><textarea rows={3} maxLength={3000} value={draft.instructions} onChange={(event) => updateDraft("instructions", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" /></label>
              </div>
              <button type="submit" disabled={working === "service"} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50"><Send size={16} /> Save service</button>
            </form>

            <aside className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <div className="flex items-center gap-2"><Building2 size={18} /><h2 className="font-semibold">Your services</h2></div>
              <div className="mt-4 grid gap-3">
                {data?.services.length === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No appointment services yet.</p> : data?.services.map((service) => (
                  <article key={service.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                    <div className="flex items-start justify-between gap-3"><div><Status value={service.status} /><strong className="mt-2 block">{service.name}</strong><span className="mt-1 block text-xs text-[var(--loombus-text-muted)]">{service.businessName} · {service.durationMinutes} minutes</span></div><button type="button" onClick={() => setDraft({ serviceId: service.id, businessId: service.businessId, name: service.name, description: service.description, durationMinutes: String(service.durationMinutes), locationMode: service.locationMode, locationText: service.locationText ?? "", priceText: service.priceText ?? "", instructions: service.instructions ?? "" })} className="text-sm font-semibold">Edit</button></div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {service.status === "active" ? <button type="button" onClick={() => void action({ action: "set_service_status", serviceId: service.id, status: "paused" }, `pause:${service.id}`, "Service paused.")} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-semibold"><PauseCircle size={14} /> Pause</button> : <button type="button" onClick={() => void action({ action: "set_service_status", serviceId: service.id, status: "active" }, `activate:${service.id}`, "Service activated.")} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-semibold"><RotateCcw size={14} /> Activate</button>}
                      <button type="button" onClick={() => void action({ action: "set_service_status", serviceId: service.id, status: "archived" }, `archive:${service.id}`, "Service archived.")} className="rounded-full border border-[var(--loombus-border)] px-3 py-2 text-xs font-semibold">Archive</button>
                    </div>
                  </article>
                ))}
              </div>
            </aside>
          </section>
        ) : (
          <section className="rounded-[1.6rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-8 text-center">
            <Building2 className="mx-auto text-[var(--loombus-text-subtle)]" size={38} /><h2 className="mt-3 text-2xl font-semibold">A published business profile is required to offer appointments.</h2><Link href="/businesses/manage" className="mt-5 inline-flex rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">Open business management</Link>
          </section>
        )}

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2"><CalendarClock size={20} /><h2 className="text-xl font-semibold">Requests sent to your businesses</h2></div>
          <div className="mt-4 grid gap-3">
            {(data?.receivedRequests.length ?? 0) === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No appointment requests received.</p> : data?.receivedRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><Status value={request.status} /><strong className="mt-2 block">{request.serviceName}</strong><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Requested by {request.requesterName} · {requestTime(request)}</p>{request.note ? <p className="mt-2 text-sm">{request.note}</p> : null}</div><div className="flex flex-wrap gap-2">{request.status === "pending" ? <><button type="button" onClick={() => void action({ action: "provider_response", requestId: request.id, decision: "accept" }, `accept:${request.id}`, "Appointment accepted.")} className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"><CheckCircle2 size={14} /> Accept</button><button type="button" onClick={() => { const proposed = window.prompt("Proposed date and time in local format, for example 2026-08-03T14:30"); if (proposed) void action({ action: "provider_response", requestId: request.id, decision: "propose_reschedule", proposedStart: new Date(proposed).toISOString() }, `reschedule:${request.id}`, "New time proposed."); }} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Suggest time</button><button type="button" onClick={() => void action({ action: "provider_response", requestId: request.id, decision: "decline" }, `decline:${request.id}`, "Appointment declined.")} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"><XCircle size={14} /> Decline</button></> : null}{request.status === "accepted" && new Date(request.requestedStart).getTime() <= Date.now() ? <button type="button" onClick={() => void action({ action: "complete", requestId: request.id }, `complete:${request.id}`, "Appointment completed.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Complete</button> : null}{request.status === "accepted" ? <button type="button" onClick={() => { if (window.confirm("Cancel this accepted appointment?")) void action({ action: "provider_response", requestId: request.id, decision: "cancel" }, `provider-cancel:${request.id}`, "Appointment cancelled."); }} className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-500">Cancel</button> : null}</div></div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-2"><Clock3 size={20} /><h2 className="text-xl font-semibold">Your appointment requests</h2></div>
          <div className="mt-4 grid gap-3">
            {(data?.sentRequests.length ?? 0) === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No appointment requests sent.</p> : data?.sentRequests.map((request) => (
              <article key={request.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><Status value={request.status} /><strong className="mt-2 block">{request.serviceName}</strong><p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{request.businessName} · {requestTime(request)}</p>{request.providerNote ? <p className="mt-2 text-sm">Provider note: {request.providerNote}</p> : null}</div><div className="flex flex-wrap gap-2">{request.status === "reschedule_proposed" ? <button type="button" onClick={() => void action({ action: "requester_action", requestId: request.id, requestAction: "accept_reschedule" }, `accept-reschedule:${request.id}`, "Proposed time accepted.")} className="rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]">Accept new time</button> : null}{!["declined", "cancelled", "completed"].includes(request.status) ? <button type="button" onClick={() => void action({ action: "requester_action", requestId: request.id, requestAction: "cancel" }, `cancel:${request.id}`, "Appointment cancelled.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Cancel</button> : null}</div></div>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm text-[var(--loombus-text-muted)]">
          Loombus does not process appointment payments, verify professional credentials, or guarantee services. Businesses and members remain responsible for confirming details, qualifications, location, and payment terms.
        </section>
      </div>
    </main>
  );
}
