"use client";

import Link from "next/link";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flag,
  HandHeart,
  MapPin,
  ShieldCheck,
  Trash2,
  Users,
  Wrench,
  XCircle,
} from "lucide-react";
import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  AdminActionButton,
  AdminMetricCard,
  AdminQueueSection,
  AdminStatusBadge,
} from "@/app/admin/platform/admin-platform-foundation";
import {
  eventLocationLabel,
  eventPriceLabel,
  formatEventDateRange,
  type EventsManageResponse,
} from "@/lib/events";
import {
  formatProviderServiceDate,
  formatProviderServiceDuration,
  formatProviderServicePrice,
  providerServiceLocationLabel,
  type ProviderServicesManageResponse,
} from "@/lib/provider-services";
import {
  formatRequestBudget,
  formatRequestDate,
  requestLocationLabel,
  requestTypeLabel,
  requestUrgencyLabel,
  type ServiceRequestManageResponse,
} from "@/lib/service-requests";

type ActionRunner = (
  payload: Record<string, unknown>,
  successMessage: string,
) => void | Promise<void>;

type Notes = Record<string, string>;

const textareaClass =
  "mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const emptyClass =
  "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";
const recordClass =
  "rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6";
const detailPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)]";
const dangerButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300";

function QueueBadge({ count, noun = "waiting" }: { count: number; noun?: string }) {
  return (
    <AdminStatusBadge status={count ? "attention" : "ready"}>
      {count ? `${count} ${noun}` : "Queue clear"}
    </AdminStatusBadge>
  );
}

function NotesField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="mt-5 block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={2000}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={textareaClass}
      />
    </>
  );
}

function RecordHeader({
  eyebrow,
  title,
  href,
  children,
}: {
  eyebrow: ReactNode;
  title: string;
  href?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">{eyebrow}</div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.025em]">{title}</h3>
        {children}
      </div>
      {href ? (
        <Link href={href} className="shrink-0 text-sm font-semibold text-[var(--loombus-gold)]">
          Open public record
        </Link>
      ) : null}
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function ReportIntro({
  title,
  reason,
  details,
  createdAt,
}: {
  title: string;
  reason: string;
  details: string;
  createdAt: string;
}) {
  return (
    <>
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em] text-[var(--loombus-text-subtle)]">
        <Flag size={15} /> Member report
      </p>
      <h3 className="mt-2 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm font-semibold">{reason}</p>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">
        {details}
      </p>
      <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
        Submitted {createdAt}
      </p>
    </>
  );
}

export function EventModerationPanel({
  data,
  working,
  runAction,
}: {
  data: EventsManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] = useState<Notes>({});
  const pendingEvents = useMemo(
    () => data.events.filter((event) => event.status === "pending"),
    [data.events],
  );
  const publishedEvents = useMemo(
    () => data.events.filter((event) => event.status === "published"),
    [data.events],
  );
  const engagement = data.events.reduce(
    (total, event) => total + event.goingCount + event.interestedCount,
    0,
  );
  const noteFor = (key: string) => notes[key] ?? "";
  const updateNote = (key: string, value: string) =>
    setNotes((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Attention queue" value={pendingEvents.length + data.reports.length} description="Event submissions and reports awaiting an administrator outcome." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Pending events" value={pendingEvents.length} description="Future events requiring a publication decision." icon={<CalendarDays size={20} />} />
        <AdminMetricCard label="Published" value={publishedEvents.length} description="Current event records visible to eligible members." />
        <AdminMetricCard label="Member responses" value={engagement} description="Going and interested responses across loaded events." icon={<Users size={20} />} />
      </div>

      <AdminQueueSection eyebrow="Event publication" title="Event review queue" description="Review organizer attribution, schedule, format, location, capacity, pricing, and registration context before publishing or returning an event." action={<QueueBadge count={pendingEvents.length} />}>
        <div className="grid gap-4">
          {pendingEvents.map((event) => {
            const key = `event:${event.id}`;
            return (
              <article key={event.id} className={recordClass}>
                <RecordHeader eyebrow={<><AdminStatusBadge status="attention">Pending review</AdminStatusBadge><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{event.category}</span></>} title={event.title} href={`/events/${event.slug}`}>
                  <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Organized by {event.businessName || event.organizerName}</p>
                  <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{event.description}</p>
                </RecordHeader>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={detailPillClass}><Clock3 size={13} /> {formatEventDateRange(event.startsAt, event.endsAt, event.timezone)}</span>
                  <span className={detailPillClass}><MapPin size={13} /> {eventLocationLabel(event)}</span>
                  <span className={detailPillClass}>{event.format.replaceAll("_", " ")}</span>
                  <span className={detailPillClass}>{eventPriceLabel(event)}</span>
                  <span className={detailPillClass}>{event.capacity ? `Capacity ${event.capacity}` : "No capacity limit"}</span>
                  <span className={detailPillClass}>{event.goingCount} going · {event.interestedCount} interested</span>
                </div>
                <NotesField id={`event-note-${event.id}`} label="Administrator note" placeholder="Record the decision reason or requested correction." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "moderate", eventId: event.id, decision: "approve", note: noteFor(key) }, "The event was approved and published.")}><CheckCircle2 size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "moderate", eventId: event.id, decision: "reject", note: noteFor(key) }, "The event was returned for changes.")}><XCircle size={15} /> Request changes</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", eventId: event.id, decision: "remove", note: noteFor(key) }, "The event was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove</button>
                </div>
              </article>
            );
          })}
          {pendingEvents.length === 0 ? <p className={emptyClass}>No Events require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Event trust and safety" title="Open Event reports" description="Resolve or dismiss the report, or remove the underlying event while preserving the original report and organizer record." action={<QueueBadge count={data.reports.length} noun="open" />}>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.reports.map((report) => {
            const key = `event-report:${report.id}`;
            return (
              <article key={report.id} className={recordClass}>
                <ReportIntro title={report.eventTitle} reason={report.reason} details={report.details} createdAt={formatDateTime(report.createdAt)} />
                <NotesField id={`event-report-note-${report.id}`} label="Decision note" placeholder="Record the outcome or supporting context." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "resolve", note: noteFor(key) }, "The Event report was resolved.")}>Resolve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "dismiss", note: noteFor(key) }, "The Event report was dismissed.")}>Dismiss</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", eventId: report.eventId, decision: "remove", note: noteFor(key) || `Removed while reviewing report: ${report.reason}` }, "The reported event was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove event</button>
                </div>
              </article>
            );
          })}
          {data.reports.length === 0 ? <p className={emptyClass}>No Event reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}

export function RequestModerationPanel({
  data,
  working,
  runAction,
}: {
  data: ServiceRequestManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] = useState<Notes>({});
  const pendingRequests = useMemo(
    () => data.requests.filter((request) => request.status === "pending"),
    [data.requests],
  );
  const noteFor = (key: string) => notes[key] ?? "";
  const updateNote = (key: string, value: string) =>
    setNotes((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Attention queue" value={data.metrics.pending + data.metrics.openReports} description="Request submissions and reports awaiting review." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Pending Requests" value={data.metrics.pending} description="Member needs requiring a publication decision." icon={<HandHeart size={20} />} />
        <AdminMetricCard label="Public Requests" value={data.metrics.open} description="Published needs currently open for attributable responses." />
        <AdminMetricCard label="Active outcomes" value={data.metrics.reviewing + data.metrics.inProgress} description="Requests under review or actively in progress." />
      </div>

      <AdminQueueSection eyebrow="Request publication" title="Request review queue" description="Review requester attribution, need type, urgency, service mode, location, budget, timing, attachments, and response context before publication." action={<QueueBadge count={pendingRequests.length} />}>
        <div className="grid gap-4">
          {pendingRequests.map((request) => {
            const key = `request:${request.id}`;
            return (
              <article key={request.id} className={recordClass}>
                <RecordHeader eyebrow={<><AdminStatusBadge status="attention">Pending review</AdminStatusBadge><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{requestTypeLabel(request.requestType)}</span></>} title={request.title} href={`/requests/${request.slug}`}>
                  <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Requested by {request.businessName || request.requesterName}</p>
                  <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{request.description}</p>
                </RecordHeader>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={detailPillClass}>{request.category}</span>
                  <span className={detailPillClass}>{requestUrgencyLabel(request.urgency)}</span>
                  <span className={detailPillClass}><MapPin size={13} /> {requestLocationLabel(request)}</span>
                  <span className={detailPillClass}>{formatRequestBudget(request)}</span>
                  <span className={detailPillClass}>Deadline: {formatRequestDate(request.deadline)}</span>
                  <span className={detailPillClass}>{request.responseCount} responses · {request.savedCount} saved</span>
                  <span className={detailPillClass}>{request.attachmentUrls.length} attachments</span>
                </div>
                <NotesField id={`request-note-${request.id}`} label="Administrator note" placeholder="Record the decision reason or requested correction." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "moderate", requestId: request.id, decision: "approve", note: noteFor(key) }, "The Request was approved and published.")}><CheckCircle2 size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "moderate", requestId: request.id, decision: "reject", note: noteFor(key) }, "The Request was returned for changes.")}><XCircle size={15} /> Request changes</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", requestId: request.id, decision: "remove", note: noteFor(key) }, "The Request was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove</button>
                </div>
              </article>
            );
          })}
          {pendingRequests.length === 0 ? <p className={emptyClass}>No Requests require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Request trust and safety" title="Open Request reports" description="Resolve or dismiss the report, or suspend or remove the underlying Request while preserving its requester and response history." action={<QueueBadge count={data.reports.length} noun="open" />}>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.reports.map((report) => {
            const key = `request-report:${report.id}`;
            return (
              <article key={report.id} className={recordClass}>
                <ReportIntro title={report.requestTitle} reason={report.reason} details={report.details} createdAt={formatRequestDate(report.createdAt)} />
                <NotesField id={`request-report-note-${report.id}`} label="Decision note" placeholder="Record the outcome or supporting context." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "resolve", note: noteFor(key) }, "The Request report was resolved.")}>Resolve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "dismiss", note: noteFor(key) }, "The Request report was dismissed.")}>Dismiss</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", requestId: report.requestId, decision: "suspend", note: noteFor(key) || `Suspended while reviewing report: ${report.reason}` }, "The reported Request was suspended.")} className={dangerButtonClass}>Suspend Request</button>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", requestId: report.requestId, decision: "remove", note: noteFor(key) || `Removed while reviewing report: ${report.reason}` }, "The reported Request was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove Request</button>
                </div>
              </article>
            );
          })}
          {data.reports.length === 0 ? <p className={emptyClass}>No Request reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}

export function ServiceModerationPanel({
  data,
  working,
  runAction,
}: {
  data: ProviderServicesManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] = useState<Notes>({});
  const pendingServices = useMemo(
    () => data.services.filter((service) => service.status === "pending"),
    [data.services],
  );
  const noteFor = (key: string) => notes[key] ?? "";
  const updateNote = (key: string, value: string) =>
    setNotes((current) => ({ ...current, [key]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Attention queue" value={data.metrics.pending + data.metrics.openReports} description="Service listings and reports awaiting review." icon={<ShieldCheck size={20} />} featured />
        <AdminMetricCard label="Pending Services" value={data.metrics.pending} description="Provider offerings requiring a publication decision." icon={<Wrench size={20} />} />
        <AdminMetricCard label="Published" value={data.metrics.published} description="Service listings currently visible in public discovery." />
        <AdminMetricCard label="Inquiry outcomes" value={data.metrics.inquiries} description={`${data.metrics.accepted.toLocaleString()} accepted inquiries across loaded Services.`} icon={<Users size={20} />} />
      </div>

      <AdminQueueSection eyebrow="Service publication" title="Service review queue" description="Review provider attribution, specialties, service mode, location, pricing, duration, availability, attachments, and appointment connections before publication." action={<QueueBadge count={pendingServices.length} />}>
        <div className="grid gap-4">
          {pendingServices.map((service) => {
            const key = `service:${service.id}`;
            return (
              <article key={service.id} className={recordClass}>
                <RecordHeader eyebrow={<><AdminStatusBadge status="attention">Pending review</AdminStatusBadge><span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">{service.category}</span></>} title={service.title} href={`/services/${service.slug}`}>
                  <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">Provided by {service.businessName || service.providerName}</p>
                  <p className="mt-3 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">{service.description}</p>
                </RecordHeader>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className={detailPillClass}><MapPin size={13} /> {providerServiceLocationLabel(service)}</span>
                  <span className={detailPillClass}>{formatProviderServicePrice(service)}</span>
                  <span className={detailPillClass}>{formatProviderServiceDuration(service.typicalDurationMinutes)}</span>
                  <span className={detailPillClass}>{service.specialties.length ? service.specialties.join(" · ") : "No specialties listed"}</span>
                  <span className={detailPillClass}>Appointment: {service.appointmentServiceName || "Not connected"}</span>
                  <span className={detailPillClass}>{service.inquiryCount} inquiries · {service.savedCount} saved</span>
                  <span className={detailPillClass}>{service.attachmentUrls.length} attachments</span>
                </div>
                {service.availabilityText || service.responseExpectation ? <p className="mt-4 rounded-2xl bg-[var(--loombus-surface)] p-4 text-sm leading-6 text-[var(--loombus-text-muted)]">{service.availabilityText || "Availability not stated"}{service.responseExpectation ? ` · ${service.responseExpectation}` : ""}</p> : null}
                <NotesField id={`service-note-${service.id}`} label="Administrator note" placeholder="Record the decision reason or requested correction." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "moderate", serviceId: service.id, decision: "approve", note: noteFor(key) }, "The Service was approved and published.")}><CheckCircle2 size={15} /> Approve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "moderate", serviceId: service.id, decision: "reject", note: noteFor(key) }, "The Service was returned for changes.")}><XCircle size={15} /> Request changes</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", serviceId: service.id, decision: "remove", note: noteFor(key) }, "The Service was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove</button>
                </div>
              </article>
            );
          })}
          {pendingServices.length === 0 ? <p className={emptyClass}>No Services require administrator review.</p> : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection eyebrow="Service trust and safety" title="Open Service reports" description="Resolve or dismiss the report, or remove the underlying Service while preserving provider attribution and inquiry history." action={<QueueBadge count={data.reports.length} noun="open" />}>
        <div className="grid gap-4 xl:grid-cols-2">
          {data.reports.map((report) => {
            const key = `service-report:${report.id}`;
            return (
              <article key={report.id} className={recordClass}>
                <ReportIntro title={report.serviceTitle} reason={report.reason} details={report.details} createdAt={formatProviderServiceDate(report.createdAt)} />
                <NotesField id={`service-report-note-${report.id}`} label="Decision note" placeholder="Record the outcome or supporting context." value={noteFor(key)} onChange={(value) => updateNote(key, value)} />
                <div className="mt-4 flex flex-wrap gap-2">
                  <AdminActionButton type="button" primary disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "resolve", note: noteFor(key) }, "The Service report was resolved.")}>Resolve</AdminActionButton>
                  <AdminActionButton type="button" disabled={working} onClick={() => void runAction({ action: "review_report", reportId: report.id, decision: "dismiss", note: noteFor(key) }, "The Service report was dismissed.")}>Dismiss</AdminActionButton>
                  <button type="button" disabled={working} onClick={() => void runAction({ action: "moderate", serviceId: report.serviceId, decision: "remove", note: noteFor(key) || `Removed while reviewing report: ${report.reason}` }, "The reported Service was removed.")} className={dangerButtonClass}><Trash2 size={15} /> Remove Service</button>
                </div>
              </article>
            );
          })}
          {data.reports.length === 0 ? <p className={emptyClass}>No Service reports are open.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}
