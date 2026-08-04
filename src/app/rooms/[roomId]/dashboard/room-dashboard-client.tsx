"use client";

import Link from "next/link";
import { CalendarDays, ClipboardList, FileText, Loader2, RefreshCw, UserRoundCheck, Vote, WalletCards } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Payload = {
  room: { id: string; name: string };
  access: { role: string | null; canManage: boolean };
  cards: {
    reservationsToday: number;
    upcomingEvents: number;
    openMaintenance: number;
    activePolls: number;
    recentDocuments: Array<Record<string, unknown>>;
    guestsToday: number;
    outstandingCents: number | null;
  };
  error?: string;
};

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export default function RoomDashboardClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/dashboard`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Room dashboard could not load.");
      setPayload(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Room dashboard could not load."); }
    finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  const cards = payload ? [
    { label: "Reservations today", value: payload.cards.reservationsToday, href: "reservations", icon: <CalendarDays /> },
    { label: "Upcoming events", value: payload.cards.upcomingEvents, href: "calendar", icon: <CalendarDays /> },
    { label: "Open maintenance", value: payload.cards.openMaintenance, href: "maintenance", icon: <ClipboardList /> },
    { label: "Active polls", value: payload.cards.activePolls, href: "polls", icon: <Vote /> },
    { label: "Guest arrivals today", value: payload.cards.guestsToday, href: "guests", icon: <UserRoundCheck /> },
    ...(payload.cards.outstandingCents === null ? [] : [{ label: "Outstanding finance", value: money(payload.cards.outstandingCents), href: "finance", icon: <WalletCards /> }]),
  ] : [];

  return <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6"><div className="rooms-live-shell mx-auto max-w-7xl space-y-6">
    <header className="room-workspace-hero"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Room dashboard</p><h1>{payload?.room.name ?? "Room overview"}</h1><p>See what needs attention, what is happening today, and where to go next.</p></div><button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "is-spinning" : undefined} /> Refresh</button></header>
    {error ? <div className="room-expansion-notice is-error" role="alert">{error}</div> : null}
    {loading && !payload ? <div className="room-expansion-loading"><Loader2 className="is-spinning" /> Loading dashboard…</div> : null}
    {payload ? <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <Link key={card.label} href={`/rooms/${encodeURIComponent(roomId)}/${card.href}`} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:-translate-y-0.5"><div className="flex items-center gap-2 text-[var(--muted)]">{card.icon}<span className="text-sm font-semibold text-[var(--text)]">{card.label}</span></div><p className="mt-4 text-3xl font-semibold text-[var(--text)]">{card.value}</p></Link>)}</section>
      <section className="room-expansion-form"><div className="room-expansion-section-heading"><div><h2>Recent documents</h2><p>The latest files published to this Room.</p></div><FileText /></div>{payload.cards.recentDocuments.length ? <div className="space-y-3">{payload.cards.recentDocuments.map((document, index) => <Link key={String(document.id ?? index)} href={`/rooms/${encodeURIComponent(roomId)}/documents`} className="block rounded-2xl border border-[var(--border)] p-4"><strong>{String(document.title ?? document.file_name ?? "Room document")}</strong><p className="mt-1 text-sm text-[var(--muted)]">{String(document.category ?? "Document")}</p></Link>)}</div> : <p className="text-sm text-[var(--muted)]">No documents have been published yet.</p>}</section>
      <section className="room-expansion-form"><h2>Quick actions</h2><div className="mt-4 flex flex-wrap gap-2"><Link className="rooms-live-primary-action !min-h-11" href={`/rooms/${encodeURIComponent(roomId)}`}>Open discussions</Link><Link className="rooms-live-secondary-action !min-h-11" href={`/rooms/${encodeURIComponent(roomId)}/maintenance`}>Submit maintenance</Link><Link className="rooms-live-secondary-action !min-h-11" href={`/rooms/${encodeURIComponent(roomId)}/reservations`}>Make reservation</Link>{payload.access.canManage ? <Link className="rooms-live-secondary-action !min-h-11" href={`/rooms/${encodeURIComponent(roomId)}/analytics`}>View analytics</Link> : null}</div></section>
    </> : null}
  </div></main>;
}
