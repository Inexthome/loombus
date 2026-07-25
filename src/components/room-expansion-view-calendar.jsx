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
import { useMemo, useState } from "react";
import { Empty, formatDate } from "@/components/room-expansion-ui";

const EMPTY_FORM = {
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

function localInput(value, timezone, allDay) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: allDay ? undefined : "2-digit",
    minute: allDay ? undefined : "2-digit",
    hourCycle: "h23",
  });
  const parts = {};
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  return allDay ? day : `${day}T${parts.hour}:${parts.minute}`;
}

function eventForm(series) {
  const timezone = series.timezone || browserTimezone();
  return {
    eventId: series.id,
    title: series.title || "",
    description: series.description || "",
    location: series.location || "",
    onlineUrl: series.onlineUrl || "",
    startsAtLocal: localInput(series.startsAt, timezone, series.allDay),
    endsAtLocal: localInput(series.endsAt, timezone, series.allDay),
    recurrence: series.recurrence || "none",
    recurrenceUntilLocal: localInput(
      series.recurrenceUntil,
      timezone,
      series.allDay
    ),
    timezone,
    capacity: series.capacity ? String(series.capacity) : "",
    registrationRequired: series.registrationRequired === true,
    allDay: series.allDay === true,
  };
}

function icsEscape(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

function icsStamp(value) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function downloadIcs(event) {
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
    event.recurrenceRule
      ? `RRULE:${event.recurrenceRule}${
          event.recurrenceUntil
            ? `;UNTIL=${icsStamp(event.recurrenceUntil)}`
            : ""
        }`
      : "",
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
  anchor.download = `${event.title.replace(/[^a-z0-9_-]+/gi, "-") || "room-event"}.ics`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function EventForm({ form, setForm, working, onSubmit, onReset }) {
  const inputType = form.allDay ? "date" : "datetime-local";
  return (
    <form className="room-expansion-form" onSubmit={onSubmit}>
      <div className="room-expansion-section-heading">
        <div>
          <h3>{form.eventId ? "Edit recurring event series" : "Create a Room event"}</h3>
          <p>Times are saved against the selected IANA time zone.</p>
        </div>
        {form.eventId ? (
          <button type="button" onClick={onReset} disabled={working}>
            <RotateCcw aria-hidden="true" /> New event
          </button>
        ) : null}
      </div>

      <label>
        <span>Event title</span>
        <input
          value={form.title}
          maxLength={180}
          onChange={(event) =>
            setForm((current) => ({ ...current, title: event.target.value }))
          }
          required
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
            onChange={(event) =>
              setForm((current) => ({ ...current, location: event.target.value }))
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
              setForm((current) => ({ ...current, onlineUrl: event.target.value }))
            }
          />
        </label>
        <label>
          <span>Starts</span>
          <input
            type={inputType}
            value={form.startsAtLocal}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                startsAtLocal: event.target.value,
              }))
            }
            required
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
        <label>
          <span>Time zone</span>
          <input
            value={form.timezone}
            maxLength={100}
            onChange={(event) =>
              setForm((current) => ({ ...current, timezone: event.target.value }))
            }
            required
          />
        </label>
        <label>
          <span>Capacity</span>
          <input
            type="number"
            min="1"
            max="100000"
            value={form.capacity}
            onChange={(event) =>
              setForm((current) => ({ ...current, capacity: event.target.value }))
            }
          />
        </label>
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
      </div>
      <button
        type="submit"
        disabled={working || !form.title.trim() || !form.startsAtLocal}
      >
        {form.eventId ? <Edit3 aria-hidden="true" /> : <Plus aria-hidden="true" />}
        {form.eventId ? "Save series" : "Add event"}
      </button>
    </form>
  );
}

export function CalendarView({ data, manifest, working, action }) {
  const events = Array.isArray(data?.events)
    ? data.events
    : Array.isArray(data)
      ? data
      : [];
  const series = Array.isArray(data?.series) ? data.series : [];
  const [form, setForm] = useState({ ...EMPTY_FORM, timezone: browserTimezone() });
  const [filter, setFilter] = useState("upcoming");

  const visibleEvents = useMemo(() => {
    const now = Date.now();
    return events.filter((event) => {
      if (filter === "cancelled") return event.status === "cancelled";
      if (event.status === "cancelled") return false;
      const starts = new Date(event.startsAt).getTime();
      return filter === "past" ? starts < now : starts >= now;
    });
  }, [events, filter]);

  function resetForm() {
    setForm({ ...EMPTY_FORM, timezone: browserTimezone() });
  }

  async function submit(event) {
    event.preventDefault();
    const saved = await action(
      {
        action: form.eventId
          ? "update_calendar_event"
          : "create_calendar_event",
        ...form,
        capacity: Number(form.capacity || 0),
        recurrenceUntilLocal:
          form.recurrence === "none" ? null : form.recurrenceUntilLocal || null,
      },
      form.eventId ? "Calendar event updated." : "Calendar event created."
    );
    if (saved) resetForm();
  }

  function editSeries(seriesId) {
    const selected = series.find((item) => item.id === seriesId);
    if (!selected) return;
    setForm(eventForm(selected));
    document
      .querySelector(".room-expansion-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function cancelSeries(event) {
    const confirmed = window.confirm(
      `Cancel “${event.title}” and notify members who responded?`
    );
    if (!confirmed) return;
    await action(
      { action: "cancel_calendar_event", eventId: event.seriesId || event.id },
      "Calendar event cancelled."
    );
    if (form.eventId === (event.seriesId || event.id)) resetForm();
  }

  return (
    <div className="room-expansion-grid">
      {manifest.access?.canManage ? (
        <EventForm
          form={form}
          setForm={setForm}
          working={working}
          onSubmit={submit}
          onReset={resetForm}
        />
      ) : null}

      <div className="room-expansion-list">
        <div className="room-expansion-filter-row" role="group" aria-label="Calendar filter">
          {[
            ["upcoming", "Upcoming"],
            ["past", "Past"],
            ["cancelled", "Cancelled"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {data?.limits?.occurrencesTruncated ? (
          <p className="room-expansion-notice is-error" role="status">
            This view reached its 1,000-occurrence safety limit. Narrower, paginated
            calendar loading is scheduled for the scale-testing phase.
          </p>
        ) : null}

        {visibleEvents.length ? (
          visibleEvents.map((event) => {
            const future = new Date(event.startsAt).getTime() > Date.now();
            const canRespond = event.status === "scheduled" && future;
            return (
              <article key={event.occurrenceId || event.id} className="room-expansion-card">
                <header>
                  <div>
                    <span>
                      {event.status === "cancelled"
                        ? "cancelled"
                        : event.isRecurring
                          ? "recurring occurrence"
                          : "event"}
                    </span>
                    <small>{formatDate(event.startsAt)}</small>
                  </div>
                  <div className="room-expansion-inline-actions">
                    <button type="button" onClick={() => downloadIcs(event)}>
                      <Download aria-hidden="true" /> ICS
                    </button>
                    {manifest.access?.canManage && event.status !== "cancelled" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => editSeries(event.seriesId || event.id)}
                        >
                          <Edit3 aria-hidden="true" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void cancelSeries(event)}
                          disabled={working}
                        >
                          <XCircle aria-hidden="true" /> Cancel
                        </button>
                      </>
                    ) : null}
                  </div>
                </header>
                <h3>{event.title}</h3>
                {event.description ? <p>{event.description}</p> : null}
                <div className="room-expansion-meta">
                  <span>{event.location || "No physical location"}</span>
                  <span>{event.timezone}</span>
                  {event.allDay ? <span>All day</span> : null}
                  {event.capacity ? (
                    <span>
                      {event.rsvpCounts.going}/{event.capacity} going ·{" "}
                      {event.rsvpCounts.waitlist} waitlisted
                    </span>
                  ) : (
                    <span>{event.rsvpCounts.going} going</span>
                  )}
                </div>
                {event.onlineUrl ? (
                  <a
                    href={event.onlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="room-expansion-link"
                  >
                    <Link2 aria-hidden="true" /> Open meeting link
                  </a>
                ) : null}
                {canRespond && event.registrationRequired ? (
                  <div className="room-expansion-inline-actions" role="group" aria-label={`RSVP for ${event.title}`}>
                    {["going", "maybe", "declined"].map((status) => (
                      <button
                        key={status}
                        type="button"
                        aria-pressed={event.ownRsvp?.status === status}
                        disabled={working}
                        onClick={() =>
                          void action(
                            {
                              action: "rsvp_event",
                              eventId: event.seriesId || event.id,
                              occurrenceStart: event.occurrenceStart || event.startsAt,
                              status,
                            },
                            `RSVP updated to ${status}.`
                          )
                        }
                      >
                        {status}
                      </button>
                    ))}
                    {event.ownRsvp ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void action(
                            {
                              action: "rsvp_event",
                              eventId: event.seriesId || event.id,
                              occurrenceStart: event.occurrenceStart || event.startsAt,
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
          <Empty
            Icon={CalendarDays}
            title={`No ${filter} events`}
            text="Room managers can add time-zone-aware events, recurring schedules, RSVP capacity, and waitlists."
          />
        )}
      </div>
    </div>
  );
}
