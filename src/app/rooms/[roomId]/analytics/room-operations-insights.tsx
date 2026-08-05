"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BarChart3, CalendarClock, FileText, Loader2, RefreshCw, ShieldCheck, UsersRound, Vote, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type ModuleMetric = { available: boolean; recent: number } & Record<string, number | boolean>;
type Payload = { generatedAt: string; modules: { reservations: ModuleMetric; maintenance: ModuleMetric; documents: ModuleMetric; polls: ModuleMetric; guests: ModuleMetric; finance: ModuleMetric }; error?: string };

const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

function Card({ icon, title, primary, detail, available }: { icon: React.ReactNode; title: string; primary: string; detail: string; available: boolean }) {
  return <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
    <div className="flex items-center gap-2 text-[var(--muted)]">{icon}<h3 className="text-sm font-semibold text-[var(--text)]">{title}</h3></div>
    <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text)]">{available ? primary : "Not active"}</p>
    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{available ? detail : "This Room module is not available yet."}</p>
  </article>;
}

export default function RoomOperationsInsights() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? "", [rawRoomId]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before loading operational insights.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/analytics/operations`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json().catch(() => ({})) as Payload;
      if (!response.ok) throw new Error(result.error || "Operational insights could not be loaded.");
      setPayload(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operational insights could not be loaded."); }
    finally { setLoading(false); }
  }, [roomId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !payload) return <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6"><div className="flex items-center gap-2 text-sm text-[var(--muted)]"><Loader2 className="h-4 w-4 animate-spin" /> Loading operational insights…</div></section>;
  if (error && !payload) return <section className="rounded-3xl border border-red-500/35 bg-red-500/10 p-6"><h2 className="font-semibold">Operational insights unavailable</h2><p className="mt-2 text-sm">{error}</p></section>;
  if (!payload) return null;
  const { reservations, maintenance, documents, polls, guests, finance } = payload.modules;

  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Operational modules</p><h2 className="mt-2 text-2xl font-semibold text-[var(--text)]">Room operations insights</h2><p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">A private management view of reservations, maintenance, documents, voting, visitors, and financial activity.</p></div>
      <button type="button" onClick={() => void load()} className="rounded-full border border-[var(--border)] p-2" aria-label="Refresh operational insights"><RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /></button>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card icon={<CalendarClock className="h-5 w-5" />} title="Reservations" primary={String(reservations.upcoming ?? 0)} detail={`${reservations.total ?? 0} total · ${reservations.recent ?? 0} created in 30 days`} available={reservations.available} />
      <Card icon={<Wrench className="h-5 w-5" />} title="Maintenance" primary={String(maintenance.open ?? 0)} detail={`${maintenance.completed ?? 0} completed · ${maintenance.recent ?? 0} new in 30 days`} available={maintenance.available} />
      <Card icon={<FileText className="h-5 w-5" />} title="Documents" primary={String(documents.total ?? 0)} detail={`${documents.pinned ?? 0} pinned · ${documents.downloads ?? 0} downloads`} available={documents.available} />
      <Card icon={<Vote className="h-5 w-5" />} title="Polls & voting" primary={String(polls.open ?? 0)} detail={`${polls.total ?? 0} total · ${polls.ballots ?? 0} ballots recorded`} available={polls.available} />
      <Card icon={<UsersRound className="h-5 w-5" />} title="Guests" primary={String(guests.active ?? 0)} detail={`${guests.pending ?? 0} pending · ${guests.recent ?? 0} registered in 30 days`} available={guests.available} />
      <Card icon={<BarChart3 className="h-5 w-5" />} title="Finance" primary={money(Number(finance.outstandingCents ?? 0))} detail={`${money(Number(finance.paidCents ?? 0))} collected · ${finance.collectionRate ?? 0}% collection rate`} available={finance.available} />
    </div>
    <div className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" /><p>These are aggregate management metrics. Member financial records, guest details, ballots, and maintenance descriptions are not exposed in this summary.</p></div>
  </section>;
}
