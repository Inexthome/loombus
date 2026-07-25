"use client";

import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Edit3,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CalendarView } from "@/components/room-expansion-view-calendar";
import { supabase } from "@/lib/supabase/client";

type RoomCalendarEvent = {
  id: string;
  seriesId?: string;
  occurrenceId?: string;
  title: string;
  description: string | null;
  location: string | null;
  onlineUrl?: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  allDay?: boolean;
  status?: string;
};

type CalendarPayload = {
  room?: {
    id: string;
    name: string;
    roomType: string;
    plan: string;
  };
  access?: {
    role: string | null;
    canManage: boolean;
    canModerate: boolean;
    isOwner: boolean;
  };
  advanced?: boolean;
  calendar?: {
    events?: RoomCalendarEvent[];
    series?: RoomCalendarEvent[];
    limits?: Record<string, unknown>;
    range?: { start: string; end: string };
  };
  error?: string;
};

type CoreForm = {
  eventId: string;
  title: string;
  description: string;
  location: string;
  onlineUrl: string;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  allDay: boolean;
};

const ACTION_MAP: Record<string, string> = {
  create_calendar_event: "create",
  update_calendar_event: "update",
  cancel_calendar_event: "cancel",
  rsvp_event: "rsvp",
};

function browserTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function emptyCoreForm(): CoreForm {
  return {
    eventId: "",
    title: "",
    description: "",
    location: "",
    onlineUrl: "",
    startsAtLocal: "",
    endsAtLocal: "",
    timezone: browserTimezone(),
    allDay: false,
  };
}

function localInput(value: string | null, timeZone: string, allDay: boolean) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
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

function eventDateLabel(event: RoomCalendarEvent) {
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

function CoreCalendar({
  calendar,
  canManage,
  working,
  action,
}: {
  calendar: NonNullable<CalendarPayload["calendar"]>;
  canManage: boolean;
  working: boolean;
  action: (
    input: Record<string, unknown>,
    successMessage: string
  ) => Promise<Record<string, unknown> | null>;
}) {
  const events = Array.isArray(calendar.events) ? calendar.events : [];
  const series = Array.isArray(calendar.series) ? calendar.series : [];
  const [form, setForm] = useState<CoreForm>(emptyCoreForm);
  const upcoming = events.filter(
    (event) =>
      event.status !== "cancelled" &&
      new Date(event.startsAt).getTime() >= Date.now() - 3600000
  );

  function reset() {
    setForm(emptyCoreForm());
  }

  function edit(eventId: string) {
    const event = series.find((candidate) => candidate.id === eventId);
    if (!event) return;
    const timezone = event.timezone || browserTimezone();
    setForm({
      eventId: event.id,
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      onlineUrl: event.onlineUrl || "",
      startsAtLocal: localInput(event.startsAt, timezone, event.allDay === true),
      endsAtLocal: localInput(event.endsAt, timezone, event.allDay === true),
      timezone,
      allDay: event.allDay === true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await action(
      {
        action: form.eventId
          ? "update_calendar_event"
          : "create_calendar_event",
        ...form,
      },
      form.eventId ? "Room event updated." : "Room event created."
    );
    if (result) reset();
  }

  async function cancel(event: RoomCalendarEvent) {
    if (!window.confirm(`Cancel “${event.title}”?`)) return;
    await action(
      {
        action: "cancel_calendar_event",
        eventId: event.seriesId || event.id,
      },
      "Room event cancelled."
    );
    if (form.eventId === (event.seriesId || event.id)) reset();
  }

  return (
    <div className="room-expansion-grid">
      {canManage ? (
        <form className="room-expansion-form" onSubmit={submit}>
          <div className="room-expansion-section-heading">
            <div>
              <h2>{form.eventId ? "Edit Room event" : "Add a Room event"}</h2>
              <p>Core calendar events are private to verified Room members.</p>
            </div>
            {form.eventId ? (
              <button type="button" onClick={reset} disabled={working}>
                <RotateCcw aria-hidden="true" /> New event
              </button>
            ) : null}
          </div>
          <label>
            <span>Event title</span>
            <input
              value={form.title}
              maxLength={160}
              required
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
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
                type={form.allDay ? "date" : "datetime-local"}
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
                type={form.allDay ? "date" : "datetime-local"}
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
              <span>Time zone</span>
              <input
                value={form.timezone}
                maxLength={100}
                required
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timezone: event.target.value,
                  }))
                }
              />
            </label>
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
                  }))
                }
              />
              All-day event
            </label>
          </div>
          <button
            type="submit"
            disabled={working || !form.title.trim() || !form.startsAtLocal}
          >
            {form.eventId ? <Edit3 aria-hidden="true" /> : <Plus aria-hidden="true" />}
            {form.eventId ? "Save event" : "Add event"}
          </button>
        </form>
      ) : null}

      <div className="room-expansion-list">
        {upcoming.length ? (
          upcoming.map((event) => (
            <article key={event.occurrenceId || event.id} className="room-expansion-card">
              <header>
                <div>
                  <span>{event.allDay ? "all day" : "event"}</span>
                  <small>{eventDateLabel(event)}</small>
                </div>
                {canManage ? (
                  <div className="room-expansion-inline-actions">
                    <button
                      type="button"
                      onClick={() => edit(event.seriesId || event.id)}
                    >
                      <Edit3 aria-hidden="true" /> Edit
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void cancel(event)}
                    >
                      <XCircle aria-hidden="true" /> Cancel
                    </button>
                  </div>
                ) : null}
              </header>
              <h3>{event.title}</h3>
              {event.description ? <p>{event.description}</p> : null}
              <div className="room-expansion-meta">
                <span>{event.location || "No physical location"}</span>
                <span>{event.timezone || "UTC"}</span>
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
            </article>
          ))
        ) : (
          <div className="room-expansion-empty">
            <CalendarDays aria-hidden="true" />
            <h3>No upcoming Room events</h3>
            <p>Room managers can add meetings, deadlines, classes, and shared dates.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomCalendarClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const accessToken = useCallback(async () => {
    const result = await supabase.auth.getSession();
    const token = result.data.session?.access_token ?? "";
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/rooms/${roomId}/calendar`
      )}`;
      return null;
    }
    return token;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setNotice("");
    setNoticeError(false);
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/calendar`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as CalendarPayload;
      if (!response.ok || !result.calendar || !result.access) {
        throw new Error(result.error || "Room calendar could not be loaded.");
      }
      setPayload(result);
    } catch (error) {
      setPayload(null);
      setNotice(
        error instanceof Error ? error.message : "Room calendar could not be loaded."
      );
      setNoticeError(true);
    } finally {
      setLoading(false);
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(
    input: Record<string, unknown>,
    successMessage: string
  ): Promise<Record<string, unknown> | null> {
    if (working) return null;
    setWorking(true);
    setNotice("");
    setNoticeError(false);
    try {
      const token = await accessToken();
      if (!token) return null;
      const sourceAction = typeof input.action === "string" ? input.action : "";
      const mappedAction = ACTION_MAP[sourceAction];
      if (!mappedAction) throw new Error("Unsupported Room calendar action.");
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/calendar`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...input, action: mappedAction }),
        }
      );
      const result = (await response.json().catch(() => ({}))) as Record<
        string,
        unknown
      > & { error?: string };
      if (!response.ok) {
        throw new Error(result.error || "Room calendar action failed.");
      }
      setNotice(successMessage);
      await load();
      window.dispatchEvent(new Event("loombus:room-activity-changed"));
      return result;
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Room calendar action failed."
      );
      setNoticeError(true);
      return null;
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6">
      <div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
        <Link
          href={`/rooms/${encodeURIComponent(roomId)}`}
          className="rooms-live-back-link"
        >
          <ArrowLeft aria-hidden="true" /> Back to Room
        </Link>

        <header className="room-workspace-hero">
          <div>
            <div className="room-workspace-badges">
              <span>
                <CalendarDays aria-hidden="true" /> Private calendar
              </span>
              {payload?.room?.plan ? <span>{payload.room.plan}</span> : null}
              {payload?.advanced ? (
                <span>Advanced calendar</span>
              ) : (
                <span>Core calendar</span>
              )}
            </div>
            <h1>
              {payload?.room?.name
                ? `${payload.room.name} calendar`
                : "Room calendar"}
            </h1>
            <p>
              Shared dates stay inside this Room. Room Pro and higher add recurring
              occurrences, RSVP capacity, and automatic waitlists.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rooms-live-secondary-action"
          >
            <RefreshCw
              aria-hidden="true"
              className={loading ? "is-spinning" : undefined}
            />
            Refresh
          </button>
        </header>

        {notice ? (
          <div
            role={noticeError ? "alert" : "status"}
            className={`room-expansion-notice${noticeError ? " is-error" : ""}`}
          >
            {notice}
          </div>
        ) : null}

        {loading ? (
          <section className="room-expansion-loading" aria-live="polite">
            <Loader2 className="is-spinning" aria-hidden="true" /> Loading Room
            calendar…
          </section>
        ) : payload?.calendar && payload.access ? (
          <section className="room-expansion">
            {payload.advanced ? (
              <CalendarView
                data={payload.calendar}
                manifest={{
                  access: payload.access,
                  capabilities: { advancedCalendar: true },
                }}
                working={working}
                action={action}
              />
            ) : (
              <CoreCalendar
                calendar={payload.calendar}
                canManage={payload.access.canManage}
                working={working}
                action={action}
              />
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}
