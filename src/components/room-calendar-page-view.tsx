"use client";

import {
  CalendarDays,
  Download,
  Edit3,
  Link2,
  Plus,
  RotateCcw,
  XCircle,
} from "lucide-react";
import {
  type FormEvent,
  type RefObject,
  useMemo,
  useRef,
  useState,
} from "react";

export type CalendarViewName = "upcoming" | "past" | "cancelled";

export type RoomCalendarEvent = {
  id: string;
  seriesId?: string;
  occurrenceId?: string;
  occurrenceStart?: string;
  title: string;
  description: string | null;
  location: string | null;
  onlineUrl?: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  recurrence?: string;
  recurrenceRule?: string | null;
  recurrenceUntil?: string | null;
  capacity?: number | null;
  registrationRequired?: boolean;
  allDay?: boolean;
  status?: string;
  cancelledAt?: string | null;
  isRecurring?: boolean;
  rsvpCounts?: {
    going: number;
    maybe: number;
    declined: number;
    waitlist: number;
  };
  ownRsvp?: {
    status: string;
    note?: string;
    updatedAt?: string | null;
  } | null;
};

export type RoomCalendarPageInfo = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
  from: number;
  to: number;
};

export type RoomCalendarData = {
  events?: RoomCalendarEvent[];
  series?: RoomCalendarEvent[];
  limits?: Record<string, unknown>;
  range?: { start: string; end: string };
  view?: CalendarViewName | "all";
  pageInfo?: RoomCalendarPageInfo | null;
};

export type RoomCalendarAccess = {
  role: string | null;
  canManage: boolean;
  canModerate: boolean;
  isOwner: boolean;
};

type CalendarAction = (
  input: Record<string, unknown>,
  successMessage: string
) => Promise<Record<string, unknown> | null>;

type CalendarForm = {
  eventId: string;
  title: string;
  description: string;
  location: string;
  onlineUrl: string;
  startsAtLocal: string;
  endsAtLocal: string;
  recurrence: string;
  recurrenceUntilLocal: string;
  timezone: string;
  capacity: string;
  registrationRequired: boolean;
  allDay: boolean;
};

type Props = {
  calendar: RoomCalendarData;
  access: RoomCalendarAccess;
  advanced: boolean;
  working: boolean;
  loading: boolean;
  view: CalendarViewName;
  onViewChange: (view: CalendarViewName) => void;
  onPageChange: (page: number) => void;
  action: CalendarAction;
  resultsHeadingRef: RefObject<HTMLHeadingElement | null>;
};

const EMPTY_FORM: CalendarForm = {
  eventId: "",
  title: "",
  description: "",
  location: "",
  onlineUrl: "",
  startsAtLocal: "",
  endsAtLocal: "",
  recurrence: "none",
  recurrenceUntilLocal: "",
  timezone: "",
  capacity: "",
  registrationRequired: false,
  allDay: false,
};

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function localInput(
  value: string | null | undefined,
  timeZone: string,
  allDay: boolean
) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: allDay ? undefined : "2-digit",
    minute: allDay ? undefined : "2-digit",
    hourCycle: "h23",
  });
  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return allDay ? day : `${day}T${parts.hour}:${parts.minute}`;
}

function emptyForm(): CalendarForm {
  return { ...EMPTY_FORM, timezone: browserTimezone() };
}

function eventForm(event: RoomCalendarEvent): CalendarForm {
  const timezone = event.timezone || browserTimezone();
  return {
    eventId: event.id,
    title: event.title || "",
    description: event.description || "",
    location: event.location || "",
    onlineUrl: event.onlineUrl || "",
    startsAtLocal: localInput(
      event.startsAt,
      timezone,
      event.allDay === true
    ),
    endsAtLocal: localInput(event.endsAt, timezone, event.allDay === true),
    recurrence: event.recurrence || "none",
    recurrenceUntilLocal: localInput(
      event.recurrenceUntil,
      timezone,
      event.allDay === true
    ),
    timezone,
    capacity: event.capacity ? String(event.capacity) : "",
    registrationRequired: event.registrationRequired === true,
    allDay: event.allDay === true,
  };
}

function dateLabel(event: RoomCalendarEvent) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: event.timezone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(event.allDay ? {} : { hour: "numeric", minute: "2-digit" }),
  };
  const formatter = new Intl.DateTimeFormat(undefined, options);
  const start = formatter.format(new Date(event.startsAt));
  if (!event.endsAt) return start;
  return `${start} to ${formatter.format(new Date(event.endsAt))}`;
}

function icsEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function icsStamp(value: string | Date) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function downloadIcs(event: RoomCalendarEvent) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Loombus//Room Calendar//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.seriesId || event.id}@loombus.com`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(event.startsAt)}`,
    event.endsAt ? `DTEND:${icsStamp(event.endsAt)}` : "",
    `SUMMARY:${icsEscape(event.title)}`,
    event.location ? `LOCATION:${icsEscape(event.location)}` : "",
    event.description ? `DESCRIPTION:${icsEscape(event.description)}` : "",
    event.onlineUrl ? `URL:${icsEscape(event.onlineUrl)}` : "",
    event.recurrenceRule ? `RRULE:${event.recurrenceRule}` : "",
    event.status === "cancelled" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([lines], { type: "text/calendar;charset=utf-8" })
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${
    event.title.replace(/[^a-z0-9_-]+/gi, "-") || "room-event"
  }.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function viewLabel(view: CalendarViewName) {
  if (view === "past") return "past";
  if (view === "cancelled") return "cancelled";
  return "upcoming";
}

export default function RoomCalendarPageView({
  calendar,
  access,
  advanced,
  working,
  loading,
  view,
  onViewChange,
  onPageChange,
  action,
  resultsHeadingRef,
}: Props) {
  const events = Array.isArray(calendar.events) ? calendar.events : [];
  const series = Array.isArray(calendar.series) ? calendar.series : [];
  const pageInfo = calendar.pageInfo ?? null;
  const busy = working || loading;
  const [form, setForm] = useState<CalendarForm>(emptyForm);
  const formRef = useRef<HTMLFormElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const seriesById = useMemo(
    () => new Map(series.map((event) => [event.id, event])),
    [series]
  );

  function resetForm() {
    setForm(emptyForm());
  }

  function editSeries(seriesId: string) {
    const selected = seriesById.get(seriesId);
    if (!selected) return;
    setForm(eventForm(selected));
    window.requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start",
      });
      titleInputRef.current?.focus({ preventScroll: true });
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const saved = await action(
      {
        action: form.eventId
          ? "update_calendar_event"
          : "create_calendar_event",
        ...form,
        capacity: advanced ? Number(form.capacity || 0) : 0,
        recurrence: advanced ? form.recurrence : "none",
        recurrenceUntilLocal:
          advanced && form.recurrence !== "none"
            ? form.recurrenceUntilLocal || null
            : null,
        registrationRequired: advanced && form.registrationRequired,
      },
      form.eventId ? "Room event updated." : "Room event created."
    );
    if (saved) resetForm();
  }

  async function cancelEvent(event: RoomCalendarEvent) {
    const confirmed = window.confirm(
      advanced
        ? `Cancel “${event.title}” and notify members who responded?`
        : `Cancel “${event.title}”?`
    );
    if (!confirmed) return;
    const saved = await action(
      {
        action: "cancel_calendar_event",
        eventId: event.seriesId || event.id,
      },
      "Room event cancelled."
    );
    if (saved && form.eventId === (event.seriesId || event.id)) resetForm();
  }

  const inputType = form.allDay ? "date" : "datetime-local";
  const resultSummary = pageInfo
    ? pageInfo.totalItems
      ? `Showing ${pageInfo.from}–${pageInfo.to} of ${
          pageInfo.totalItems
        } ${viewLabel(view)} events`
      : `No ${viewLabel(view)} events`
    : `${events.length} ${viewLabel(view)} events`;

  return (
    <div className="room-expansion-grid">
      {access.canManage ? (
        <form
          ref={formRef}
          className="room-expansion-form scroll-mt-24"
          onSubmit={submit}
          aria-busy={busy}
        >
          <div className="room-expansion-section-heading">
            <div>
              <h2>
                {form.eventId
                  ? advanced
                    ? "Edit recurring event series"
                    : "Edit Room event"
                  : "Add a Room event"}
              </h2>
              <p>
                Times are saved in the selected IANA time zone and remain
                private to active Room members.
              </p>
            </div>
            {form.eventId ? (
              <button type="button" onClick={resetForm} disabled={busy}>
                <RotateCcw aria-hidden="true" /> New event
              </button>
            ) : null}
          </div>

          <label>
            <span>Event title</span>
            <input
              ref={titleInputRef}
              value={form.title}
              maxLength={160}
              required
              autoComplete="off"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Description</span>
            <textarea
              rows={3}
              maxLength={3000}
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>

          <div className="room-expansion-form-grid">
            <label>
              <span>Location</span>
              <input
                value={form.location}
                maxLength={300}
                autoComplete="off"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Online meeting link</span>
              <input
                type="url"
                inputMode="url"
                placeholder="https://"
                value={form.onlineUrl}
                maxLength={1000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    onlineUrl: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Starts</span>
              <input
                type={inputType}
                value={form.startsAtLocal}
                required
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    startsAtLocal: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              <span>Ends</span>
              <input
                type={inputType}
                value={form.endsAtLocal}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    endsAtLocal: event.target.value,
                  }))
                }
              />
            </label>
            {advanced ? (
              <>
                <label>
                  <span>Repeat</span>
                  <select
                    value={form.recurrence}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrence: event.target.value,
                      }))
                    }
                  >
                    <option value="none">No recurrence</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </label>
                <label>
                  <span>Repeat until</span>
                  <input
                    type={inputType}
                    disabled={form.recurrence === "none"}
                    value={form.recurrenceUntilLocal}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        recurrenceUntilLocal: event.target.value,
                      }))
                    }
                  />
                </label>
              </>
            ) : null}
            <label>
              <span>Time zone</span>
              <input
                value={form.timezone}
                maxLength={100}
                required
                autoComplete="off"
                aria-describedby="room-calendar-timezone-help"
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
              />
              <small id="room-calendar-timezone-help">
                Use a name such as America/New_York.
              </small>
            </label>
            {advanced ? (
              <label>
                <span>Capacity</span>
                <input
                  type="number"
                  min="1"
                  max="100000"
                  inputMode="numeric"
                  value={form.capacity}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      capacity: event.target.value,
                    }))
                  }
                />
              </label>
            ) : null}
          </div>

          <div className="room-expansion-checkbox-grid">
            <label className="room-expansion-checkbox">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allDay: event.target.checked,
                    startsAtLocal: "",
                    endsAtLocal: "",
                    recurrenceUntilLocal: "",
                  }))
                }
              />
              All-day event
            </label>
            {advanced ? (
              <label className="room-expansion-checkbox">
                <input
                  type="checkbox"
                  checked={form.registrationRequired}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      registrationRequired: event.target.checked,
                    }))
                  }
                />
                Track RSVPs and waitlists
              </label>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy || !form.title.trim() || !form.startsAtLocal}
            className="min-h-11"
          >
            {form.eventId ? (
              <Edit3 aria-hidden="true" />
            ) : (
              <Plus aria-hidden="true" />
            )}
            {form.eventId ? "Save event" : "Add event"}
          </button>
        </form>
      ) : null}

      <section
        className="room-expansion-list min-w-0"
        aria-busy={loading}
        aria-labelledby="room-calendar-results-heading"
      >
        {loading ? (
          <p className="sr-only" role="status" aria-live="polite">
            Updating calendar results…
          </p>
        ) : null}
        <div
          className="flex flex-wrap items-center gap-2"
          role="group"
          aria-label="Calendar event view"
          aria-controls="room-calendar-event-list"
        >
          {(
            [
              ["upcoming", "Upcoming"],
              ["past", "Past"],
              ["cancelled", "Cancelled"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              disabled={loading}
              onClick={() => onViewChange(value)}
              className="min-h-11"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="room-calendar-results-heading"
              ref={resultsHeadingRef}
              tabIndex={-1}
              className="scroll-mt-24 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-current"
            >
              {view === "upcoming"
                ? "Upcoming events"
                : view === "past"
                  ? "Past events"
                  : "Cancelled events"}
            </h2>
            <p aria-live="polite" className="text-sm opacity-75">
              {resultSummary}
            </p>
          </div>
          {calendar.range ? (
            <p className="text-xs opacity-70">
              Window:{" "}
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(calendar.range.start))}{" "}
              to{" "}
              {new Intl.DateTimeFormat(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(new Date(calendar.range.end))}
            </p>
          ) : null}
        </div>

        {calendar.limits?.occurrencesTruncated ? (
          <p className="room-expansion-notice is-error" role="status">
            This date window reached the 1,000-occurrence safety limit. Use a
            narrower date window before relying on the complete count.
          </p>
        ) : null}

        <div id="room-calendar-event-list" className="room-expansion-list">
          {events.length ? (
            events.map((event, index) => {
              const future =
                new Date(event.startsAt).getTime() > Date.now();
              const canRespond =
                advanced &&
                event.status === "scheduled" &&
                future &&
                event.registrationRequired;
              const counts = event.rsvpCounts ?? {
                going: 0,
                maybe: 0,
                declined: 0,
                waitlist: 0,
              };
              const titleId = `room-calendar-event-title-${index}`;
              return (
                <article
                  key={event.occurrenceId || event.id}
                  className="room-expansion-card min-w-0 overflow-hidden"
                  aria-labelledby={titleId}
                >
                  <header>
                    <div className="min-w-0">
                      <span>
                        {event.status === "cancelled"
                          ? "cancelled"
                          : event.isRecurring
                            ? "recurring occurrence"
                            : event.allDay
                              ? "all-day event"
                              : "event"}
                      </span>
                      <small>{dateLabel(event)}</small>
                    </div>
                    <div className="room-expansion-inline-actions">
                      {advanced ? (
                        <button
                          type="button"
                          onClick={() => downloadIcs(event)}
                          className="min-h-11"
                          aria-label={`Download ${event.title} as an ICS calendar file`}
                        >
                          <Download aria-hidden="true" /> ICS
                        </button>
                      ) : null}
                      {access.canManage && event.status !== "cancelled" ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              editSeries(event.seriesId || event.id)
                            }
                            className="min-h-11"
                          >
                            <Edit3 aria-hidden="true" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void cancelEvent(event)}
                            disabled={busy}
                            className="min-h-11"
                          >
                            <XCircle aria-hidden="true" /> Cancel
                          </button>
                        </>
                      ) : null}
                    </div>
                  </header>

                  <h3 id={titleId} className="break-words">
                    {event.title}
                  </h3>
                  {event.description ? (
                    <p className="break-words">{event.description}</p>
                  ) : null}
                  <div className="room-expansion-meta">
                    <span>{event.location || "No physical location"}</span>
                    <span>{event.timezone || "UTC"}</span>
                    {event.capacity ? (
                      <span>
                        {counts.going}/{event.capacity} going ·{" "}
                        {counts.waitlist} waitlisted
                      </span>
                    ) : advanced ? (
                      <span>{counts.going} going</span>
                    ) : null}
                  </div>

                  {event.onlineUrl ? (
                    <a
                      href={event.onlineUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="room-expansion-link min-h-11 break-all"
                    >
                      <Link2 aria-hidden="true" /> Open meeting link in new tab
                    </a>
                  ) : null}

                  {canRespond ? (
                    <div
                      className="room-expansion-inline-actions"
                      role="group"
                      aria-label={`RSVP for ${event.title}`}
                    >
                      {(["going", "maybe", "declined"] as const).map(
                        (status) => (
                          <button
                            key={status}
                            type="button"
                            aria-pressed={event.ownRsvp?.status === status}
                            disabled={busy}
                            className="min-h-11 capitalize"
                            onClick={() =>
                              void action(
                                {
                                  action: "rsvp_event",
                                  eventId: event.seriesId || event.id,
                                  occurrenceStart:
                                    event.occurrenceStart || event.startsAt,
                                  status,
                                },
                                `RSVP updated to ${status}.`
                              )
                            }
                          >
                            {status}
                          </button>
                        )
                      )}
                      {event.ownRsvp ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="min-h-11"
                          onClick={() =>
                            void action(
                              {
                                action: "rsvp_event",
                                eventId: event.seriesId || event.id,
                                occurrenceStart:
                                  event.occurrenceStart || event.startsAt,
                                status: "none",
                              },
                              "RSVP removed."
                            )
                          }
                        >
                          Clear
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="room-expansion-empty" role="status">
              <CalendarDays aria-hidden="true" />
              <h3>No {viewLabel(view)} Room events</h3>
              <p>
                Room managers can add meetings, deadlines, classes, and shared
                dates.
              </p>
            </div>
          )}
        </div>

        {pageInfo && pageInfo.totalPages > 1 ? (
          <nav
            className="flex flex-wrap items-center justify-between gap-3"
            aria-label="Calendar result pages"
          >
            <button
              type="button"
              disabled={loading || !pageInfo.hasPrevious}
              onClick={() => onPageChange(pageInfo.page - 1)}
              className="min-h-11"
            >
              Previous page
            </button>
            <span className="text-sm" aria-current="page">
              Page {pageInfo.page + 1} of {pageInfo.totalPages}
            </span>
            <button
              type="button"
              disabled={loading || !pageInfo.hasNext}
              onClick={() => onPageChange(pageInfo.page + 1)}
              className="min-h-11"
            >
              Next page
            </button>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
