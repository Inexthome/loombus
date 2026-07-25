"use client";

import Link from "next/link";
import { ArrowLeft, CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarView } from "@/components/room-expansion-view-calendar";
import { supabase } from "@/lib/supabase/client";

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
    events?: unknown[];
    series?: unknown[];
    limits?: Record<string, unknown>;
    range?: { start: string; end: string };
  };
  error?: string;
};

const ACTION_MAP: Record<string, string> = {
  create_calendar_event: "create",
  update_calendar_event: "update",
  cancel_calendar_event: "cancel",
  rsvp_event: "rsvp",
};

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
  ) {
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
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
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
              {payload?.advanced ? <span>Advanced calendar</span> : <span>Core calendar</span>}
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
            <CalendarView
              data={payload.calendar}
              manifest={{
                access: payload.access,
                capabilities: { advancedCalendar: payload.advanced === true },
              }}
              working={working}
              action={action}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
