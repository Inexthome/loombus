"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  Loader2,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import RoomCalendarPageView, {
  type CalendarViewName,
  type RoomCalendarAccess,
  type RoomCalendarData,
} from "@/components/room-calendar-page-view";
import { supabase } from "@/lib/supabase/client";

type CalendarPayload = {
  room?: {
    id: string;
    name: string;
    roomType: string;
    plan: string;
  };
  access?: RoomCalendarAccess;
  advanced?: boolean;
  calendar?: RoomCalendarData;
  error?: string;
};

type ReservationResource = {
  id?: string;
  name?: string;
  location_text?: string | null;
};

type CalendarReservation = {
  id: string;
  requestedStart: string;
  requestedEnd: string;
  timezone: string;
  attendeeCount: number | null;
  note: string | null;
  status: string;
  resource?: ReservationResource | null;
};

type ReservationsPayload = {
  reservations?: CalendarReservation[];
  error?: string;
};

const ACTION_MAP: Record<string, string> = {
  create_calendar_event: "create",
  update_calendar_event: "update",
  cancel_calendar_event: "cancel",
  rsvp_event: "rsvp",
};

function reservationDateLabel(reservation: CalendarReservation) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    timeZone: reservation.timezone || "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  const start = formatter.format(new Date(reservation.requestedStart));
  const end = formatter.format(new Date(reservation.requestedEnd));
  return `${start} to ${end}`;
}

export default function RoomCalendarClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<CalendarPayload | null>(null);
  const [reservations, setReservations] = useState<CalendarReservation[]>([]);
  const [view, setView] = useState<CalendarViewName>("upcoming");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);
  const requestSequence = useRef(0);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);

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

  const load = useCallback(
    async (
      nextView: CalendarViewName,
      nextPage: number,
      focusResults = false
    ) => {
      if (!roomId) return false;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;
      setLoading(true);
      setNotice("");
      setNoticeError(false);
      try {
        const token = await accessToken();
        if (!token) return false;
        const query = new URLSearchParams({
          view: nextView,
          page: String(Math.max(0, nextPage)),
          limit: "24",
        });
        const [calendarResponse, reservationsResponse] = await Promise.all([
          fetch(
            `/api/rooms/${encodeURIComponent(roomId)}/calendar?${query.toString()}`,
            {
              headers: { Authorization: `Bearer ${token}` },
              cache: "no-store",
            }
          ),
          fetch(`/api/rooms/${encodeURIComponent(roomId)}/reservations`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }),
        ]);
        const result = (await calendarResponse.json().catch(() => ({}))) as CalendarPayload;
        if (!calendarResponse.ok || !result.calendar || !result.access) {
          throw new Error(result.error || "Room calendar could not be loaded.");
        }
        const reservationResult = (await reservationsResponse
          .json()
          .catch(() => ({}))) as ReservationsPayload;
        if (requestSequence.current !== sequence) return false;
        setPayload(result);
        setReservations(
          reservationsResponse.ok && Array.isArray(reservationResult.reservations)
            ? reservationResult.reservations.filter(
                (reservation) =>
                  reservation.status === "accepted" &&
                  new Date(reservation.requestedEnd).getTime() >= Date.now()
              )
            : []
        );
        const resolvedView =
          result.calendar.view === "past" ||
          result.calendar.view === "cancelled" ||
          result.calendar.view === "upcoming"
            ? result.calendar.view
            : nextView;
        const resolvedPage = result.calendar.pageInfo?.page ?? nextPage;
        setView(resolvedView);
        setPage(resolvedPage);
        if (focusResults) {
          window.requestAnimationFrame(() => {
            resultsHeadingRef.current?.focus();
          });
        }
        return true;
      } catch (error) {
        if (requestSequence.current !== sequence) return false;
        setNotice(
          error instanceof Error
            ? error.message
            : "Room calendar could not be loaded."
        );
        setNoticeError(true);
        return false;
      } finally {
        if (requestSequence.current === sequence) setLoading(false);
      }
    },
    [accessToken, roomId]
  );

  useEffect(() => {
    void load("upcoming", 0);
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
      const refreshed = await load(view, page);
      if (refreshed) setNotice(successMessage);
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

  function changeView(nextView: CalendarViewName) {
    if (nextView === view && page === 0) return;
    void load(nextView, 0, true);
  }

  function changePage(nextPage: number) {
    const normalized = Math.max(0, nextPage);
    if (normalized === page) return;
    void load(view, normalized, true);
  }

  const initialLoading = loading && !payload;

  return (
    <main
      className="rooms-live-page min-h-screen px-4 py-6 sm:px-6"
      aria-busy={loading || working}
    >
      <div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
        <Link
          href={`/rooms/${encodeURIComponent(roomId)}`}
          className="rooms-live-back-link !min-h-11"
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
              Room events and confirmed facility reservations are shown together
              for active members.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load(view, page)}
            disabled={loading}
            className="rooms-live-secondary-action !min-h-11"
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
            aria-live={noticeError ? "assertive" : "polite"}
            className={`room-expansion-notice${noticeError ? " is-error" : ""}`}
          >
            {notice}
          </div>
        ) : null}

        {initialLoading ? (
          <section
            className="room-expansion-loading"
            role="status"
            aria-live="polite"
          >
            <Loader2 className="is-spinning" aria-hidden="true" />
            Loading Room calendar…
          </section>
        ) : payload?.calendar && payload.access ? (
          <>
            <section className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
                    Facility schedule
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold">
                    Confirmed reservations
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                    Only accepted, upcoming reservations appear on the shared calendar.
                  </p>
                </div>
                <Link
                  href={`/rooms/${encodeURIComponent(roomId)}/reservations`}
                  className="rooms-live-secondary-action !min-h-11"
                >
                  <Building2 aria-hidden="true" /> Manage reservations
                </Link>
              </div>
              {reservations.length === 0 ? (
                <p className="mt-5 rounded-2xl border border-dashed border-[color:var(--loombus-border)] p-6 text-sm text-[color:var(--loombus-text-muted)]">
                  No confirmed facility reservations are currently scheduled.
                </p>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {reservations.map((reservation) => (
                    <article
                      key={reservation.id}
                      className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--loombus-gold-soft)] text-[color:var(--loombus-gold)]">
                          <CalendarClock size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="font-semibold">
                            {reservation.resource?.name || "Room facility"}
                          </h3>
                          <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                            {reservationDateLabel(reservation)}
                          </p>
                          {reservation.resource?.location_text ? (
                            <p className="mt-2 flex items-center gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                              <MapPin size={14} aria-hidden="true" />
                              {reservation.resource.location_text}
                            </p>
                          ) : null}
                          {reservation.attendeeCount ? (
                            <p className="mt-2 flex items-center gap-2 text-sm text-[color:var(--loombus-text-muted)]">
                              <Users size={14} aria-hidden="true" />
                              {reservation.attendeeCount} attendees
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="room-expansion" aria-busy={loading || working}>
              <RoomCalendarPageView
                calendar={payload.calendar}
                access={payload.access}
                advanced={payload.advanced === true}
                working={working}
                loading={loading}
                view={view}
                onViewChange={changeView}
                onPageChange={changePage}
                action={action}
                resultsHeadingRef={resultsHeadingRef}
              />
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
