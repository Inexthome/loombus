"use client";

import Link from "next/link";
import {
  CalendarDays,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getRoomModelProfile } from "@/lib/room-model-profiles";
import { supabase } from "@/lib/supabase/client";

type OverviewPayload = {
  room?: {
    id: string;
    name: string;
    description: string;
    roomType: string;
    plan: { id: string; label: string };
  };
  access?: {
    role: string | null;
    canManage: boolean;
  };
  metrics?: {
    members: number;
    discussions: number;
    upcomingEvents: number;
    announcements: number;
    pendingApplications: number;
  };
  nextEvent?: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string | null;
    location: string | null;
  } | null;
  pinnedAnnouncement?: {
    id: string;
    title: string;
    priority: string;
    createdAt: string | null;
  } | null;
  error?: string;
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not recorded";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function RoomOverviewClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (refresh = false) => {
      if (!roomId) return;
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        if (!token) throw new Error("Sign in again before opening the Room overview.");
        const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/shell`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const result = (await response.json().catch(() => ({}))) as OverviewPayload;
        if (!response.ok) {
          throw new Error(result.error ?? "The Room overview could not be loaded.");
        }
        setPayload(result);
      } catch (cause) {
        setPayload(null);
        setError(
          cause instanceof Error ? cause.message : "The Room overview could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [roomId]
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  if (loading) {
    return (
      <main className="rooms-live-page">
        <div className="rooms-live-shell">
          <section className="rooms-live-state-card">
            <Loader2 aria-hidden="true" className="is-spinning" />
            <h1>Preparing the Room overview…</h1>
            <p>Room status and private activity are being loaded.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!payload?.room || !payload.metrics) {
    return (
      <main className="rooms-live-page">
        <div className="rooms-live-shell">
          <section className="rooms-live-state-card">
            <LayoutDashboard aria-hidden="true" />
            <h1>Room overview unavailable</h1>
            <p>{error || "The Room did not return a usable overview."}</p>
            <button
              type="button"
              className="rooms-live-primary-action"
              onClick={() => void load(false)}
            >
              <RefreshCw aria-hidden="true" />
              Try again
            </button>
          </section>
        </div>
      </main>
    );
  }

  const profile = getRoomModelProfile(payload.room.roomType);
  const roomBase = `/rooms/${encodeURIComponent(roomId)}`;
  const metrics = [
    {
      label: "Discussions",
      value: payload.metrics.discussions,
      Icon: MessageSquareText,
      href: roomBase,
    },
    {
      label: "Members",
      value: payload.metrics.members,
      Icon: Users,
      href: `${roomBase}/members`,
    },
    {
      label: "Upcoming",
      value: payload.metrics.upcomingEvents,
      Icon: CalendarDays,
      href: `${roomBase}/calendar`,
    },
    {
      label: "Updates",
      value: payload.metrics.announcements,
      Icon: Megaphone,
      href: `${roomBase}/announcements`,
    },
  ];

  return (
    <main className="rooms-live-page">
      <div className="rooms-live-shell space-y-5">
        <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="rooms-live-eyebrow">{profile.title}</p>
              <h2 className="mt-2 text-2xl font-black text-[var(--loombus-text)]">
                Room overview
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                {profile.workflowSummary}
              </p>
            </div>
            <button
              type="button"
              className="rooms-live-secondary-action"
              onClick={() => void load(true)}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden="true"
                className={refreshing ? "is-spinning" : undefined}
              />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(({ label, value, Icon, href }) => (
              <Link
                key={label}
                href={href}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4 text-[var(--loombus-text)] no-underline transition hover:border-[#cbab5b]"
              >
                <Icon className="size-5 text-[var(--rooms-shell-gold)]" aria-hidden="true" />
                <strong className="mt-3 block text-2xl font-black">{value}</strong>
                <span className="mt-1 block text-xs font-bold text-[var(--loombus-text-muted)]">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2 text-[var(--loombus-text)]">
              <CalendarDays className="size-5" aria-hidden="true" />
              <h3 className="font-black">Next Room date</h3>
            </div>
            {payload.nextEvent ? (
              <div className="mt-4">
                <strong className="text-[var(--loombus-text)]">
                  {payload.nextEvent.title}
                </strong>
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                  {formatDate(payload.nextEvent.startsAt)}
                </p>
                {payload.nextEvent.location ? (
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {payload.nextEvent.location}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">
                No upcoming Room dates are scheduled.
              </p>
            )}
            <Link
              href={`${roomBase}/calendar`}
              className="mt-4 inline-flex text-sm font-black text-[var(--rooms-shell-gold)] underline underline-offset-4"
            >
              Open {profile.moduleOverrides.calendar?.label ?? "Calendar"}
            </Link>
          </section>

          <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5">
            <div className="flex items-center gap-2 text-[var(--loombus-text)]">
              <Megaphone className="size-5" aria-hidden="true" />
              <h3 className="font-black">Pinned update</h3>
            </div>
            {payload.pinnedAnnouncement ? (
              <div className="mt-4">
                <strong className="text-[var(--loombus-text)]">
                  {payload.pinnedAnnouncement.title}
                </strong>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-muted)]">
                  {payload.pinnedAnnouncement.priority}
                </p>
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--loombus-text-muted)]">
                No announcement is currently pinned.
              </p>
            )}
            <Link
              href={`${roomBase}/announcements`}
              className="mt-4 inline-flex text-sm font-black text-[var(--rooms-shell-gold)] underline underline-offset-4"
            >
              Open {profile.moduleOverrides.announcements?.label ?? "Announcements"}
            </Link>
          </section>
        </div>

        <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-xs font-bold text-[var(--loombus-text-muted)]">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span>{payload.room.plan.label}</span>
          <span>·</span>
          <span>{profile.defaultAccessSummary}</span>
          {payload.access?.canManage && payload.metrics.pendingApplications > 0 ? (
            <>
              <span>·</span>
              <span>{payload.metrics.pendingApplications} access request(s) pending</span>
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
