"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  Check,
  Loader2,
  Pause,
  Plus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/supabase/client";

type Resource = {
  id: string;
  name: string;
  description: string | null;
  locationText: string | null;
  capacity: number | null;
  durationMinutes: number;
  bufferMinutes: number;
  minimumNoticeMinutes: number;
  maximumAdvanceDays: number;
  approvalRequired: boolean;
  rules: string | null;
  status: string;
};

type Reservation = {
  id: string;
  resourceId: string;
  requesterId: string;
  requestedStart: string;
  requestedEnd: string;
  timezone: string;
  attendeeCount: number | null;
  note: string | null;
  managerNote: string | null;
  status: string;
  resource?: { id?: string; name?: string; location_text?: string | null } | null;
  requester?: { id?: string; username?: string | null; full_name?: string | null } | null;
};

type Payload = {
  room?: { id: string; name: string; roomType: string };
  access?: { role: string | null; canManage: boolean; isOwner: boolean };
  resources?: Resource[];
  reservations?: Reservation[];
  error?: string;
};

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  if (status === "accepted") return "Confirmed";
  if (status === "declined") return "Declined";
  if (status === "cancelled") return "Cancelled";
  if (status === "completed") return "Completed";
  if (status === "reschedule_proposed") return "New time proposed";
  return "Pending approval";
}

export default function RoomReservationsClient() {
  const params = useParams<{ roomId: string }>();
  const roomId = Array.isArray(params.roomId) ? params.roomId[0] : params.roomId;
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [resourceOpen, setResourceOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const activeResources = useMemo(
    () => (payload?.resources ?? []).filter((resource) => resource.status === "active"),
    [payload?.resources]
  );

  const token = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      window.location.href = `/login?next=${encodeURIComponent(`/rooms/${roomId}/reservations`)}`;
      return null;
    }
    return accessToken;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const accessToken = await token();
      if (!accessToken) return;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/reservations`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) throw new Error(result.error || "Room reservations could not be loaded.");
      setPayload(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Room reservations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function action(input: Record<string, unknown>, success: string) {
    if (working) return false;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      if (!accessToken) return false;
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/reservations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Reservation action failed.");
      setNotice(success);
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Reservation action failed.");
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const saved = await action(
      {
        action: "create_resource",
        name: form.get("name"),
        description: form.get("description"),
        locationText: form.get("locationText"),
        capacity: form.get("capacity"),
        durationMinutes: form.get("durationMinutes"),
        bufferMinutes: form.get("bufferMinutes"),
        minimumNoticeMinutes: form.get("minimumNoticeMinutes"),
        maximumAdvanceDays: form.get("maximumAdvanceDays"),
        approvalRequired: form.get("approvalRequired") === "on",
        rules: form.get("rules"),
      },
      "Resource created."
    );
    if (saved) {
      setResourceOpen(false);
      event.currentTarget.reset();
    }
  }

  async function requestReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResource) return;
    const form = new FormData(event.currentTarget);
    const localStart = String(form.get("requestedStart") ?? "");
    const date = new Date(localStart);
    const saved = await action(
      {
        action: "request",
        resourceId: selectedResource.id,
        requestedStart: date.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        attendeeCount: form.get("attendeeCount"),
        note: form.get("note"),
      },
      selectedResource.approvalRequired
        ? "Reservation request submitted."
        : "Reservation confirmed."
    );
    if (saved) {
      setSelectedResource(null);
      event.currentTarget.reset();
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-[color:var(--loombus-page-bg)] text-[color:var(--loombus-text)]">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><Loader2 className="animate-spin text-[color:var(--loombus-gold)]" size={18} /> Loading reservations</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]">
          <ArrowLeft size={16} /> Back to Room
        </Link>

        <header className="mt-5 flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">Private Room scheduling</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">{payload?.room?.name || "Room"} reservations</h1>
            <p className="mt-2 max-w-2xl text-[color:var(--loombus-text-muted)]">Reserve facilities and shared resources managed by this Room.</p>
          </div>
          {payload?.access?.canManage ? (
            <button type="button" className={primaryButton} onClick={() => setResourceOpen((value) => !value)}>
              <Plus size={16} /> Add resource
            </button>
          ) : null}
        </header>

        {error ? <p role="alert" className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</p> : null}
        {notice ? <p role="status" className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm">{notice}</p> : null}

        {resourceOpen && payload?.access?.canManage ? (
          <form onSubmit={createResource} className="mt-6 rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
            <h2 className="text-2xl font-semibold">Create a reservable resource</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input name="name" required minLength={2} maxLength={160} placeholder="Clubhouse, tennis court, conference room" className={inputClass} />
              <input name="locationText" placeholder="Location or access instructions" className={inputClass} />
              <input name="capacity" type="number" min={1} placeholder="Capacity, optional" className={inputClass} />
              <input name="durationMinutes" type="number" min={15} max={1440} defaultValue={60} className={inputClass} aria-label="Duration in minutes" />
              <input name="bufferMinutes" type="number" min={0} max={1440} defaultValue={0} className={inputClass} aria-label="Cleanup buffer in minutes" />
              <input name="minimumNoticeMinutes" type="number" min={0} defaultValue={60} className={inputClass} aria-label="Minimum notice in minutes" />
              <input name="maximumAdvanceDays" type="number" min={1} max={730} defaultValue={90} className={inputClass} aria-label="Maximum advance days" />
              <label className="flex min-h-12 items-center gap-3 rounded-2xl border border-[color:var(--loombus-border)] px-4 text-sm font-semibold">
                <input name="approvalRequired" type="checkbox" defaultChecked /> Management approval required
              </label>
              <textarea name="description" rows={3} placeholder="Description" className={`${inputClass} sm:col-span-2`} />
              <textarea name="rules" rows={4} placeholder="Reservation rules" className={`${inputClass} sm:col-span-2`} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={working} className={primaryButton}>{working ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Save resource</button>
              <button type="button" onClick={() => setResourceOpen(false)} className={secondaryButton}>Cancel</button>
            </div>
          </form>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">Available resources</p>
              <h2 className="mt-1 text-2xl font-semibold">Choose what to reserve</h2>
            </div>
            <span className="text-sm text-[color:var(--loombus-text-muted)]">{activeResources.length} active</span>
          </div>
          {activeResources.length === 0 ? (
            <div className="mt-4 rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center">
              <Building2 className="mx-auto text-[color:var(--loombus-gold)]" size={36} />
              <h3 className="mt-3 text-xl font-semibold">No reservable resources yet</h3>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Room management can add a clubhouse, court, meeting room, pavilion, or another shared resource.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeResources.map((resource) => (
                <article key={resource.id} className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-gold-soft)] text-[color:var(--loombus-gold)]"><Building2 size={20} /></span>
                    {payload?.access?.canManage ? (
                      <button type="button" disabled={working} onClick={() => void action({ action: "set_resource_status", resourceId: resource.id, status: "paused" }, "Resource paused.")} className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-3 text-xs font-semibold"><Pause size={14} /> Pause</button>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{resource.name}</h3>
                  {resource.description ? <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">{resource.description}</p> : null}
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                    <p className="flex items-center gap-2"><CalendarClock size={15} /> {resource.durationMinutes} minutes</p>
                    {resource.capacity ? <p className="flex items-center gap-2"><Users size={15} /> Up to {resource.capacity} people</p> : null}
                    {resource.locationText ? <p>{resource.locationText}</p> : null}
                  </div>
                  <button type="button" onClick={() => setSelectedResource(resource)} className={`${primaryButton} mt-5 w-full`}><CalendarClock size={16} /> Reserve</button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedResource ? (
          <form onSubmit={requestReservation} className="mt-8 rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">Reserve resource</p>
            <h2 className="mt-1 text-2xl font-semibold">{selectedResource.name}</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">Reservation length: {selectedResource.durationMinutes} minutes. {selectedResource.approvalRequired ? "Room management must approve this request." : "This resource confirms automatically when the time is available."}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <input name="requestedStart" type="datetime-local" required className={inputClass} />
              <input name="attendeeCount" type="number" min={1} max={selectedResource.capacity ?? 100000} placeholder="Number of attendees" className={inputClass} />
              <textarea name="note" rows={4} placeholder="Purpose or notes for management" className={`${inputClass} sm:col-span-2`} />
            </div>
            {selectedResource.rules ? <p className="mt-4 rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6"><strong>Rules:</strong> {selectedResource.rules}</p> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={working} className={primaryButton}>{working ? <Loader2 className="animate-spin" size={16} /> : <CalendarClock size={16} />} Submit reservation</button>
              <button type="button" onClick={() => setSelectedResource(null)} className={secondaryButton}>Cancel</button>
            </div>
          </form>
        ) : null}

        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">{payload?.access?.canManage ? "Reservation queue" : "My reservations"}</p>
          <h2 className="mt-1 text-2xl font-semibold">Upcoming and recent requests</h2>
          {(payload?.reservations ?? []).length === 0 ? (
            <p className="mt-4 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">No reservations yet.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {(payload?.reservations ?? []).map((reservation) => (
                <article key={reservation.id} className="rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{reservation.resource?.name || "Room resource"}</h3>
                        <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-3 py-1 text-xs font-semibold">{statusLabel(reservation.status)}</span>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">{formatDate(reservation.requestedStart)} to {formatDate(reservation.requestedEnd)}</p>
                      {payload?.access?.canManage && reservation.requester ? <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">Requested by {reservation.requester.full_name || reservation.requester.username || "Room member"}</p> : null}
                      {reservation.note ? <p className="mt-2 text-sm">{reservation.note}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {payload?.access?.canManage && reservation.status === "pending" ? (
                        <>
                          <button type="button" disabled={working} onClick={() => void action({ action: "manager_action", reservationId: reservation.id, decision: "accept" }, "Reservation accepted.")} className={primaryButton}><Check size={15} /> Accept</button>
                          <button type="button" disabled={working} onClick={() => void action({ action: "manager_action", reservationId: reservation.id, decision: "decline" }, "Reservation declined.")} className={secondaryButton}><X size={15} /> Decline</button>
                        </>
                      ) : null}
                      {!payload?.access?.canManage && ["pending", "accepted"].includes(reservation.status) ? (
                        <button type="button" disabled={working} onClick={() => void action({ action: "cancel_own", reservationId: reservation.id }, "Reservation cancelled.")} className={secondaryButton}><X size={15} /> Cancel</button>
                      ) : null}
                      {payload?.access?.canManage && reservation.status === "accepted" ? (
                        <button type="button" disabled={working} onClick={() => void action({ action: "manager_action", reservationId: reservation.id, decision: "complete" }, "Reservation completed.")} className={secondaryButton}><Check size={15} /> Complete</button>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
