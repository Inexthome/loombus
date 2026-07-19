"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flag,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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

type WorkspaceView = "events" | "editor" | "reports";

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

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none transition placeholder:text-[color:var(--loombus-text-subtle)] focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] hover:bg-[color:var(--loombus-surface-muted)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

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

function statusClass(status: string) {
  if (status === "published") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "pending") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "cancelled" || status === "removed") return "bg-red-500/10 text-red-700 dark:text-red-300";
  return "bg-[color:var(--loombus-surface-muted)] text-[color:var(--loombus-text-muted)]";
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass(status)}`}>
      {status.replaceAll("_", " ")}
    </span>
  );
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

export default function EventsManagerPage() {
  const [data, setData] = useState<EventsManageResponse | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [view, setView] = useState<WorkspaceView>("events");
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
        "/events/manage",
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

  const statusCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of data?.events ?? []) {
      counts.set(event.status, (counts.get(event.status) ?? 0) + 1);
    }
    return counts;
  }, [data?.events]);

  const pendingEvents = statusCounts.get("pending") ?? 0;
  const publishedEvents = statusCounts.get("published") ?? 0;
  const completedEvents = statusCounts.get("completed") ?? 0;
  const attendeeSignals = useMemo(
    () => (data?.events ?? []).reduce((total, event) => total + event.goingCount + event.interestedCount, 0),
    [data?.events],
  );

  function updateDraft<Key extends keyof Draft>(key: Key, value: Draft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function beginCreate() {
    setDraft(EMPTY_DRAFT);
    setView("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function beginEdit(event: PublicEvent) {
    setDraft(draftFromEvent(event));
    setView("editor");
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        "/events/manage",
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Unable to save the event.");
      setDraft(EMPTY_DRAFT);
      setView("events");
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
        "/events/manage",
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
      <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto grid min-h-64 max-w-[82rem] place-items-center rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
            <Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading Event management
          </span>
        </div>
      </main>
    );
  }

  const tabs: Array<{ key: WorkspaceView; label: string; count: number }> = [
    { key: "events", label: data?.isAdmin ? "Event records" : "My Events", count: data?.events.length ?? 0 },
    { key: "editor", label: draft.eventId ? "Edit Event" : "Create Event", count: 0 },
    ...(data?.isAdmin ? [{ key: "reports" as const, label: "Open reports", count: data.reports.length }] : []),
  ];

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-5 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[82rem]">
        <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl">{data?.isAdmin ? "Event operations" : "Manage Events"}</h1>
            <p className="mt-3 text-base leading-7 text-[color:var(--loombus-text-muted)]">
              {data?.isAdmin
                ? "Review Event records, moderation states, organizer attribution, and reports from one operational workspace."
                : "Create attributable public Events, manage their lifecycle, and keep dates connected to the calendar members already use."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/events" className={secondaryButton}>Browse Events <ArrowUpRight size={15} /></Link>
            <button type="button" onClick={() => void load()} className={secondaryButton} disabled={loading}>
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <button type="button" onClick={beginCreate} className={primaryButton}><Plus size={16} /> New Event</button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-cream)] p-4 text-[color:var(--loombus-cream-contrast)] shadow-sm dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-text)]">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-gold)]">Published</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{publishedEvents}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Pending review</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{pendingEvents}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Completed</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{completedEvents}</strong>
          </article>
          <article className="rounded-[1.4rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 shadow-sm">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">Attendance signals</span>
            <strong className="mt-2 block text-3xl tracking-[-0.04em]">{attendeeSignals}</strong>
          </article>
        </section>

        {notice ? (
          <div className="mb-6 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm shadow-sm" role="status">{notice}</div>
        ) : null}

        <nav className="mb-6 flex gap-2 overflow-x-auto rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-2 shadow-sm" aria-label="Event management workspace">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setView(tab.key)}
              className={`flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                view === tab.key
                  ? "bg-[color:var(--loombus-cream)] text-[color:var(--loombus-cream-contrast)] dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]"
                  : "hover:bg-[color:var(--loombus-surface-muted)]"
              }`}
            >
              {tab.label}
              {tab.count > 0 ? <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-2 py-0.5 text-xs">{tab.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <section className="min-w-0">
            {view === "events" ? (
              <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Event records</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Current lifecycle</h2>
                  </div>
                  <button type="button" onClick={beginCreate} className={primaryButton}><Plus size={15} /> Create Event</button>
                </div>
                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {(data?.events ?? []).map((event) => (
                    <article key={event.id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={event.status} />
                            <span className="rounded-full border border-[color:var(--loombus-border)] px-3 py-1 text-xs font-semibold text-[color:var(--loombus-text-muted)]">{event.category}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{event.title}</h3>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                            {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)} · {eventLocationLabel(event)}
                          </p>
                          <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">{event.businessName || event.organizerName}</p>
                          {event.moderationReason ? <p className="mt-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm">Review note: {event.moderationReason}</p> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2 lg:max-w-[20rem] lg:justify-end">
                          {event.status === "published" ? <Link href={`/events/${event.slug}`} className={secondaryButton}>Open <ExternalLink size={14} /></Link> : null}
                          {!data?.isAdmin && !["removed", "completed"].includes(event.status) ? <button type="button" onClick={() => beginEdit(event)} className={secondaryButton}>Edit</button> : null}
                          {!data?.isAdmin && event.status === "published" ? <button type="button" onClick={() => void action({ action: "cancel", eventId: event.id }, `cancel:${event.id}`, "Event cancelled.")} className={secondaryButton}>Cancel</button> : null}
                          {!data?.isAdmin && event.status === "cancelled" ? <button type="button" onClick={() => void action({ action: "reopen", eventId: event.id }, `reopen:${event.id}`, "Event returned to review.")} className={secondaryButton}>Reopen</button> : null}
                          {!data?.isAdmin && event.status === "published" && new Date(event.startsAt).getTime() <= Date.now() ? <button type="button" onClick={() => void action({ action: "complete", eventId: event.id }, `complete:${event.id}`, "Event marked complete.")} className={secondaryButton}>Complete</button> : null}
                          {data?.isAdmin && event.status === "pending" ? (
                            <>
                              <button type="button" onClick={() => void action({ action: "moderate", eventId: event.id, decision: "approve" }, `approve:${event.id}`, "Event approved.")} className={primaryButton}><CheckCircle2 size={14} /> Approve</button>
                              <button type="button" onClick={() => { const note = window.prompt("Change request note", ""); if (note !== null) void action({ action: "moderate", eventId: event.id, decision: "reject", note }, `reject:${event.id}`, "Change request sent."); }} className={secondaryButton}><XCircle size={14} /> Changes</button>
                            </>
                          ) : null}
                          {data?.isAdmin && event.status !== "removed" ? <button type="button" onClick={() => { if (window.confirm("Remove this event from Loombus?")) void action({ action: "moderate", eventId: event.id, decision: "remove" }, `remove:${event.id}`, "Event removed."); }} className="inline-flex min-h-11 items-center justify-center rounded-full border border-red-500/40 px-4 text-sm font-semibold text-red-500">Remove</button> : null}
                        </div>
                      </div>
                    </article>
                  ))}
                  {(data?.events.length ?? 0) === 0 ? <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No Event records yet.</div> : null}
                </div>
              </section>
            ) : null}

            {view === "editor" ? (
              <form onSubmit={submit} className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">{draft.eventId ? "Edit Event" : "New Event"}</p>
                    <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">{draft.eventId ? "Update and resubmit" : "Publish a date with context"}</h2>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">State what happens, who it is for, when it occurs, where attendees should go, and whether registration is external.</p>
                  </div>
                  {draft.eventId ? <button type="button" onClick={() => setDraft(EMPTY_DRAFT)} className={secondaryButton}>Clear edit</button> : null}
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <Field label="Event title" wide><input required maxLength={200} value={draft.title} onChange={(event) => updateDraft("title", event.target.value)} className={inputClass} /></Field>
                  <Field label="Description" wide><textarea required rows={6} maxLength={16000} value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} className={inputClass} placeholder="Explain what happens, who it is for, and what attendees should know" /></Field>
                  <Field label="Category"><select value={draft.category} onChange={(event) => updateDraft("category", event.target.value)} className={inputClass}>{CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
                  <Field label="Format"><select value={draft.format} onChange={(event) => updateDraft("format", event.target.value as Draft["format"])} className={inputClass}><option value="in_person">In person</option><option value="online">Online</option><option value="hybrid">Hybrid</option></select></Field>
                  <Field label="Organizer attribution" wide><select value={draft.businessId} onChange={(event) => updateDraft("businessId", event.target.value)} className={inputClass}><option value="">Personal profile</option>{(data?.businesses ?? []).map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></Field>
                  <Field label="Starts"><input type="datetime-local" required value={draft.startsAt} onChange={(event) => updateDraft("startsAt", event.target.value)} className={inputClass} /></Field>
                  <Field label="Ends"><input type="datetime-local" value={draft.endsAt} onChange={(event) => updateDraft("endsAt", event.target.value)} className={inputClass} /></Field>
                  <Field label="Time zone"><input required value={draft.timezone} onChange={(event) => updateDraft("timezone", event.target.value)} className={inputClass} /></Field>
                  <Field label="Capacity"><input type="number" min={1} max={1000000} value={draft.capacity} onChange={(event) => updateDraft("capacity", event.target.value)} className={inputClass} placeholder="Optional" /></Field>

                  {draft.format === "in_person" || draft.format === "hybrid" ? (
                    <>
                      <Field label="Venue"><input maxLength={200} value={draft.venueName} onChange={(event) => updateDraft("venueName", event.target.value)} className={inputClass} /></Field>
                      <Field label="Address"><input maxLength={200} value={draft.addressLine1} onChange={(event) => updateDraft("addressLine1", event.target.value)} className={inputClass} /></Field>
                      <Field label="City"><input maxLength={100} value={draft.city} onChange={(event) => updateDraft("city", event.target.value)} className={inputClass} /></Field>
                      <Field label="State or region"><input maxLength={100} value={draft.region} onChange={(event) => updateDraft("region", event.target.value)} className={inputClass} /></Field>
                    </>
                  ) : null}

                  {draft.format === "online" || draft.format === "hybrid" ? <Field label="Online Event URL" wide><input type="url" value={draft.onlineUrl} onChange={(event) => updateDraft("onlineUrl", event.target.value)} className={inputClass} placeholder="https://" /></Field> : null}

                  <label className="flex items-center justify-between gap-3 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm font-semibold">
                    <span>This Event is free</span>
                    <input type="checkbox" checked={draft.isFree} onChange={(event) => updateDraft("isFree", event.target.checked)} className="h-5 w-5 accent-[color:var(--loombus-gold)]" />
                  </label>
                  {!draft.isFree ? <Field label="Price details"><input maxLength={200} value={draft.priceText} onChange={(event) => updateDraft("priceText", event.target.value)} className={inputClass} placeholder="$25, donation, or external details" /></Field> : <div />}
                  <Field label="Registration URL" wide><input type="url" value={draft.registrationUrl} onChange={(event) => updateDraft("registrationUrl", event.target.value)} className={inputClass} placeholder="Optional HTTPS link" /></Field>
                </div>

                <button type="submit" disabled={working === "save"} className={`${primaryButton} mt-6 px-5 py-3`}>
                  {working === "save" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  {draft.eventId ? "Update and resubmit" : "Create Event"}
                </button>
              </form>
            ) : null}

            {view === "reports" && data?.isAdmin ? (
              <section className="overflow-hidden rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] shadow-xl shadow-black/10">
                <div className="border-b border-[color:var(--loombus-border-muted)] px-5 py-5 sm:px-6">
                  <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Moderation</p>
                  <h2 className="mt-1 text-2xl font-semibold tracking-[-0.035em]">Open Event reports</h2>
                </div>
                <div className="divide-y divide-[color:var(--loombus-border-muted)]">
                  {data.reports.map((report) => (
                    <article key={report.id} className="p-5 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <strong className="text-lg">{report.eventTitle}</strong>
                          <p className="mt-2 text-sm font-semibold">{report.reason}</p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{report.details}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <button type="button" onClick={() => void action({ action: "review_report", reportId: report.id, decision: "resolve" }, `report-resolve:${report.id}`, "Report resolved.")} className={primaryButton}>Resolve</button>
                          <button type="button" onClick={() => void action({ action: "review_report", reportId: report.id, decision: "dismiss" }, `report-dismiss:${report.id}`, "Report dismissed.")} className={secondaryButton}>Dismiss</button>
                        </div>
                      </div>
                    </article>
                  ))}
                  {data.reports.length === 0 ? <div className="p-10 text-center text-sm text-[color:var(--loombus-text-muted)]">No open Event reports.</div> : null}
                </div>
              </section>
            ) : null}
          </section>

          <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.3em]">Workspace status</p>
                <CalendarDays className="h-5 w-5 text-[color:var(--loombus-gold)]" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ["All", data?.events.length ?? 0],
                  ["Pending", pendingEvents],
                  ["Published", publishedEvents],
                  ["Reports", data?.reports.length ?? 0],
                ].map(([label, value]) => (
                  <article key={String(label)} className="rounded-2xl bg-[color:var(--loombus-page-bg)] p-4">
                    <span className="text-xs font-semibold text-[color:var(--loombus-text-muted)]">{label}</span>
                    <strong className="mt-1 block text-2xl">{value}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <p className="text-xs font-bold uppercase tracking-[0.3em]">Event actions</p>
              <div className="mt-4 space-y-2">
                <button type="button" onClick={beginCreate} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-cream)] px-4 py-3 text-left text-sm font-semibold text-[color:var(--loombus-cream-contrast)] transition hover:opacity-90 dark:bg-[color:var(--loombus-gold-soft)] dark:text-[color:var(--loombus-gold)]">
                  Create Event <Plus className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setView("events")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  Event records <ChevronRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </button>
                {data?.isAdmin ? <button type="button" onClick={() => setView("reports")} className="flex w-full items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-left text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">Open reports <Flag className="h-4 w-4 text-[color:var(--loombus-gold)]" /></button> : null}
                <Link href="/calendar" className="flex items-center justify-between rounded-2xl bg-[color:var(--loombus-page-bg)] px-4 py-3 text-sm font-semibold transition hover:bg-[color:var(--loombus-surface-muted)]">
                  My calendar <ArrowUpRight className="h-4 w-4 text-[color:var(--loombus-gold)]" />
                </Link>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--loombus-cream)] text-[color:var(--loombus-gold)] dark:bg-[color:var(--loombus-gold-soft)]">
                  {data?.isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                </span>
                <div>
                  <h3 className="font-semibold">{data?.isAdmin ? "Moderation remains explicit" : "Dates remain accountable"}</h3>
                  <p className="mt-1 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    {data?.isAdmin
                      ? "Approval, requested changes, removal, cancellation, completion, and report resolution remain separate actions with visible status."
                      : "Organizer attribution, date, format, location, registration, and price context remain attached to each public Event."}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-2xl shadow-black/10">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--loombus-gold)]" />
                <p className="text-sm leading-6 text-[color:var(--loombus-text-muted)]">Loombus does not process Event payments or guarantee attendance, admission, venues, or organizer performance. External registration remains between organizer and attendee.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
