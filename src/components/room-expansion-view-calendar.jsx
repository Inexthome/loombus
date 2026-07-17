"use client";

import { CalendarDays, Download, Plus } from "lucide-react";
import { useState } from "react";
import { Empty, formatDate } from "@/components/room-expansion-ui";

export function CalendarView({ data, manifest, working, action }) {
  const events = Array.isArray(data) ? data : [];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [recurrence, setRecurrence] = useState("none");
  const [recurrenceUntil, setRecurrenceUntil] = useState("");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [capacity, setCapacity] = useState("");
  const [registrationRequired, setRegistrationRequired] = useState(false);

  function downloadIcs(event) {
    const stamp = (value) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Loombus//Room Calendar//EN", "BEGIN:VEVENT", `UID:${event.id}@loombus.com`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(event.startsAt)}`, event.endsAt ? `DTEND:${stamp(event.endsAt)}` : "", `SUMMARY:${event.title.replaceAll("\n", " ")}`, event.location ? `LOCATION:${event.location.replaceAll("\n", " ")}` : "", event.description ? `DESCRIPTION:${event.description.replaceAll("\n", "\\n")}` : "", event.recurrenceRule ? `RRULE:${event.recurrenceRule}${event.recurrenceUntil ? `;UNTIL=${stamp(event.recurrenceUntil)}` : ""}` : "", "END:VEVENT", "END:VCALENDAR"].filter(Boolean).join("\r\n");
    const url = URL.createObjectURL(new Blob([lines], { type: "text/calendar" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${event.title.replace(/[^a-z0-9_-]+/gi, "-")}.ics`; anchor.click(); URL.revokeObjectURL(url);
  }

  return <div className="room-expansion-grid">{manifest.access?.canManage ? <form className="room-expansion-form" onSubmit={async (event) => { event.preventDefault(); const saved = await action({ action: "create_calendar_event", title, description, location, startsAt, endsAt: endsAt || null, recurrence, recurrenceUntil: recurrenceUntil || null, timezone, capacity: Number(capacity || 0), registrationRequired }, "Calendar event created."); if (saved) { setTitle(""); setDescription(""); setLocation(""); setStartsAt(""); setEndsAt(""); } }}><h3>Create a recurring Room event</h3><label><span>Event</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label><div className="room-expansion-form-grid"><label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} /></label><label><span>Starts</span><input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required /></label><label><span>Ends</span><input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /></label><label><span>Repeat</span><select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="none">No recurrence</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label><label><span>Repeat until</span><input type="datetime-local" value={recurrenceUntil} onChange={(event) => setRecurrenceUntil(event.target.value)} /></label><label><span>Timezone</span><input value={timezone} onChange={(event) => setTimezone(event.target.value)} /></label><label><span>Capacity</span><input type="number" min="0" value={capacity} onChange={(event) => setCapacity(event.target.value)} /></label></div><label className="room-expansion-checkbox"><input type="checkbox" checked={registrationRequired} onChange={(event) => setRegistrationRequired(event.target.checked)} /> Require RSVP</label><button type="submit" disabled={working || !title.trim() || !startsAt}><Plus aria-hidden="true" /> Add event</button></form> : null}<div className="room-expansion-list">{events.length ? events.map((event) => <article key={event.id} className="room-expansion-card"><header><div><span>{event.recurrenceRule ? "recurring" : "event"}</span><small>{formatDate(event.startsAt)}</small></div><button type="button" onClick={() => downloadIcs(event)}><Download aria-hidden="true" /> ICS</button></header><h3>{event.title}</h3>{event.description ? <p>{event.description}</p> : null}<div className="room-expansion-meta"><span>{event.location || "No location"}</span><span>{event.timezone}</span>{event.capacity ? <span>{event.rsvpCounts.going}/{event.capacity} going · {event.rsvpCounts.waitlist} waitlist</span> : <span>{event.rsvpCounts.going} going</span>}</div><div className="room-expansion-inline-actions">{["going", "maybe", "declined"].map((status) => <button key={status} type="button" aria-pressed={event.ownRsvp?.status === status} onClick={() => void action({ action: "rsvp_event", eventId: event.id, status }, `RSVP updated to ${status}.`)}>{status}</button>)}</div></article>) : <Empty Icon={CalendarDays} title="No expanded events" text="Add recurring events with time zones, RSVP capacity, waitlists, and ICS export." />}</div></div>;
}
