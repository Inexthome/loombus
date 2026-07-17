"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Flag,
  Plus,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  eventLocationLabel,
  formatEventDateRange,
  type EventsManageResponse,
  type PublicEvent,
} from "@/lib/events";
import { scheduleAuthorizedFetch } from "@/lib/schedule-client";

type Draft = {
  eventId: string;
  title: string;
  description: string;
  category: string;
  format: "in_person" | "online" | "hybrid";
  businessId: string;
  venueName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
  onlineUrl: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  capacity: string;
  isFree: boolean;
  priceText: string;
  registrationUrl: string;
};

const EMPTY_DRAFT: Draft = {
  eventId: "",
  title: "",
  description: "",
  category: "Community",
  format: "in_person",
  businessId: "",
  venueName: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  countryCode: "US",
  onlineUrl: "",
  startsAt: "",
  endsAt: "",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  capacity: "",
  isFree: true,
  priceText: "",
  registrationUrl: "",
};

const CATEGORIES = [
  "Community",
  "Education",
  "Business",
  "Technology",
  "Arts and culture",
  "Health and wellness",
  "Government and civic",
  "Family",
  "Sports and recreation",
  "Other",
];

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function draftFromEvent(event: PublicEvent): Draft {
  return {
    eventId: event.id,
    title: event.title,
    description: event.description,
    category: event.category,
    format: event.format,
    businessId: event.businessId ?? "",
    venueName: event.venueName ?? "",
    addressLine1: event.addressLine1 ?? "",
    addressLine2: event.addressLine2 ?? "",
    city: event.city ?? "",
    region: event.region ?? "",
    postalCode: event.postalCode ?? "",
    countryCode: event.countryCode,
    onlineUrl: event.onlineUrl ?? "",
    startsAt: toLocalInput(event.startsAt),
    endsAt: toLocalInput(event.endsAt),
    timezone: event.timezone,
    capacity: event.capacity ? String(event.capacity) : "",
    isFree: event.isFree,
    priceText: event.priceText ?? "",
    registrationUrl: event.registrationUrl ?? "",
  };
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-semibold capitalize">
      {status.replaceAll("_", " ")}
    </span>
  );
}

export default function EventsManagerPage() {
  const [data, setData] = useState<EventsManageResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/events?manage=1",
        { cache: "no-store" },
        "/events/manage"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to load event management.");
      setData(payload as EventsManageResponse);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to load event management.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingEvents = useMemo(
    () => (data?.events ?? []).filter((event) => event.status === "pending"),
    [data]
  );

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking("save");
    setNotice("");
    try {
      const response = await scheduleAuthorizedFetch(
        "/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...draft,
            action: draft.eventId ? "update" : "create",
            startsAt: draft.startsAt ? new Date(draft.startsAt).toISOString() : "",
            endsAt: draft.endsAt ? new Date(draft.endsAt).toISOString() : "",
          }),
        },
        "/events/manage"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save the event.");
      setDraft(EMPTY_DRAFT);
      setNotice("Event saved and sent to administrator review.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save the event.");
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
        "/api/events",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        "/events/manage"
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to update the event.");
      setNotice(success);
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to update the event.");
    } finally {
      setWorking("");
    }
  }

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-10 text-[var(--loombus-text)]">
        <div className="mx-auto max-w-6xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-10 text-center">
          Loading event management…
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
                Events workspace
              </p>
              <h1 className="mt-2 text-4xl font-semibold">Create, review, and close the loop.</h1>
              <p className="mt-3 max-w-2xl text-[var(--loombus-text-muted)]">
                Public events remain attributable, chronological, and subject to administrator review.
              </p>
            </div>
            <div className="flex gap-3">
              <Link href="/events" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold">
                Browse Events
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-semibold"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4 text-sm" role="status">
            {notice}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <form onSubmit={submit} className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                  {draft.eventId ? "Edit event" : "New event"}
                </p>
                <h2 className="mt-1 text-2xl font-semibold">
                  {draft.eventId ? "Update and resubmit" : "Publish a date with context"}
                </h2>
              </div>
              {draft.eventId ? (
                <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">
                  Clear edit
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Event title</span>
                <input required maxLength={200} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Description</span>
                <textarea required rows={6} maxLength={16000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" placeholder="Explain what happens, who it is for, and what attendees should know" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Category</span>
                <select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">
                  {CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Format</span>
                <select value={draft.format} onChange={(event) => updateDraft("format", event.target.value as Draft["format"])} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">
                  <option value="in_person">In person</option>
                  <option value="online">Online</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Organizer attribution</span>
                <select value={draft.businessId} onChange={(event) => updateDraft("businessId", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">
                  <option value="">Personal profile</option>
                  {(data?.businesses ?? []).map((business) => (
                    <option key={business.id} value={business.id}>{business.name}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Starts</span>
                <input type="datetime-local" required value={draft.startsAt} onChange={(event) => updateDraft("startsAt", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Ends</span>
                <input type="datetime-local" value={draft.endsAt} onChange={(event) => updateDraft("endsAt", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Time zone</span>
                <input required value={draft.timezone} onChange={(event) => updateDraft("timezone", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Capacity</span>
                <input type="number" min={1} max={1000000} value={draft.capacity} onChange={(event) => updateDraft("capacity", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" placeholder="Optional" />
              </label>

              {(draft.format === "in_person" || draft.format === "hybrid") ? (
                <>
                  <label>
                    <span className="mb-2 block text-sm font-semibold">Venue</span>
                    <input maxLength={200} value={draft.venueName} onChange={(event) => updateDraft("venueName", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-semibold">Address</span>
                    <input maxLength={200} value={draft.addressLine1} onChange={(event) => updateDraft("addressLine1", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-semibold">City</span>
                    <input maxLength={100} value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
                  </label>
                  <label>
                    <span className="mb-2 block text-sm font-semibold">State or region</span>
                    <input maxLength={100} value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" />
                  </label>
                </>
              ) : null}

              {(draft.format === "online" || draft.format === "hybrid") ? (
                <label className="sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">Online event URL</span>
                  <input type="url" value={draft.onlineUrl} onChange={(event) => updateDraft("onlineUrl", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" placeholder="https://" />
                </label>
              ) : null}

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3">
                <input type="checkbox" checked={draft.isFree} onChange={(event) => updateDraft("isFree", event.target.checked)} />
                <span className="text-sm font-semibold">This event is free</span>
              </label>
              {!draft.isFree ? (
                <label>
                  <span className="mb-2 block text-sm font-semibold">Price details</span>
                  <input maxLength={200} value={draft.priceText} onChange={(event) => updateDraft("priceText", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" placeholder="$25, donation, or external details" />
                </label>
              ) : null}
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-semibold">Registration URL</span>
                <input type="url" value={draft.registrationUrl} onChange={(event) => updateDraft("registrationUrl", event.target.value)} className="w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3" placeholder="Optional HTTPS link" />
              </label>
            </div>

            <button type="submit" disabled={working === "save"} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-primary-bg)] px-6 py-3 text-sm font-semibold text-[var(--loombus-primary-text)] disabled:opacity-50">
              <Plus size={17} /> {draft.eventId ? "Update and resubmit" : "Create event"}
            </button>
          </form>

          <aside className="space-y-5">
            <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Workspace status</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">All</span><strong className="mt-1 block text-2xl">{data?.events.length ?? 0}</strong></article>
                <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"><span className="text-xs text-[var(--loombus-text-muted)]">Pending</span><strong className="mt-1 block text-2xl">{pendingEvents.length}</strong></article>
              </div>
            </section>

            {data?.isAdmin ? (
              <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
                <div className="flex items-center gap-2"><ShieldCheck size={18} /><h2 className="font-semibold">Administrator queue</h2></div>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{pendingEvents.length} event{pendingEvents.length === 1 ? "" : "s"} awaiting review.</p>
              </section>
            ) : null}
          </aside>
        </section>

        <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">Event records</p><h2 className="mt-1 text-2xl font-semibold">Current lifecycle</h2></div><CalendarDays size={24} className="text-[var(--loombus-text-subtle)]" /></div>
          <div className="mt-5 grid gap-4">
            {(data?.events ?? []).length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-6 text-center text-[var(--loombus-text-muted)]">No event records yet.</p>
            ) : (
              (data?.events ?? []).map((event) => (
                <article key={event.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><StatusBadge status={event.status} /><span className="text-xs text-[var(--loombus-text-muted)]">{event.category}</span></div><h3 className="mt-3 text-xl font-semibold">{event.title}</h3><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{formatEventDateRange(event.startsAt, event.endsAt, event.timezone)} · {eventLocationLabel(event)}</p>{event.moderationReason ? <p className="mt-2 text-sm">Review note: {event.moderationReason}</p> : null}</div>
                    <div className="flex flex-wrap gap-2">
                      {event.status === "published" ? <Link href={`/events/${event.slug}`} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Open <ExternalLink size={14} /></Link> : null}
                      {!data?.isAdmin && !["removed", "completed"].includes(event.status) ? <button type="button" onClick={() => { setDraft(draftFromEvent(event)); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Edit</button> : null}
                      {!data?.isAdmin && event.status === "published" ? <button type="button" onClick={() => void action({ action: "cancel", eventId: event.id }, `cancel:${event.id}`, "Event cancelled.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Cancel</button> : null}
                      {!data?.isAdmin && event.status === "cancelled" ? <button type="button" onClick={() => void action({ action: "reopen", eventId: event.id }, `reopen:${event.id}`, "Event returned to review.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Reopen</button> : null}
                      {!data?.isAdmin && event.status === "published" && new Date(event.startsAt).getTime() <= Date.now() ? <button type="button" onClick={() => void action({ action: "complete", eventId: event.id }, `complete:${event.id}`, "Event marked complete.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Complete</button> : null}
                      {data?.isAdmin && event.status === "pending" ? <><button type="button" onClick={() => void action({ action: "moderate", eventId: event.id, decision: "approve" }, `approve:${event.id}`, "Event approved.")} className="inline-flex items-center gap-1 rounded-full bg-[var(--loombus-primary-bg)] px-4 py-2 text-sm font-semibold text-[var(--loombus-primary-text)]"><CheckCircle2 size={14} /> Approve</button><button type="button" onClick={() => { const note = window.prompt("Change request note", ""); if (note !== null) void action({ action: "moderate", eventId: event.id, decision: "reject", note }, `reject:${event.id}`, "Change request sent."); }} className="inline-flex items-center gap-1 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"><XCircle size={14} /> Request changes</button></> : null}
                      {data?.isAdmin && event.status !== "removed" ? <button type="button" onClick={() => { if (window.confirm("Remove this event from Loombus?")) void action({ action: "moderate", eventId: event.id, decision: "remove" }, `remove:${event.id}`, "Event removed."); }} className="rounded-full border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-500">Remove</button> : null}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {data?.isAdmin ? (
          <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
            <div className="flex items-center gap-2"><Flag size={18} /><h2 className="text-xl font-semibold">Open event reports</h2></div>
            <div className="mt-4 grid gap-3">
              {data.reports.length === 0 ? <p className="text-sm text-[var(--loombus-text-muted)]">No open event reports.</p> : data.reports.map((report) => (
                <article key={report.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-4"><div><strong>{report.eventTitle}</strong><p className="mt-1 text-sm">{report.reason}</p><p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{report.details}</p></div><div className="flex gap-2"><button type="button" onClick={() => void action({ action: "review_report", reportId: report.id, decision: "resolve" }, `report-resolve:${report.id}`, "Report resolved.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Resolve</button><button type="button" onClick={() => void action({ action: "review_report", reportId: report.id, decision: "dismiss" }, `report-dismiss:${report.id}`, "Report dismissed.")} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold">Dismiss</button></div></div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex items-start gap-3 rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 text-sm text-[var(--loombus-text-muted)]">
          <Clock3 className="mt-0.5 shrink-0" size={18} />
          <p>Loombus does not process event payments or guarantee attendance, admission, venues, or organizer performance. External registration remains between the organizer and attendee.</p>
        </section>
      </div>
    </main>
  );
}
