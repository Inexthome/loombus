"use client";

import Link from "next/link";
import { ArrowLeft, CalendarClock, Check, LogIn, LogOut, RefreshCw, Search, ShieldCheck, UserRoundPlus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type GuestPass = {
  id: string;
  guest_name: string;
  visit_type: string;
  starts_at: string;
  ends_at: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  license_plate: string | null;
  notes: string | null;
  status: string;
  review_note: string | null;
};
type Payload = {
  room?: { id: string; name: string };
  access?: { role: string | null; canManage: boolean };
  settings?: Record<string, unknown>;
  passes?: GuestPass[];
  error?: string;
};

type GuestDraft = {
  guestName: string;
  visitType: string;
  startsAt: string;
  endsAt: string;
  vehicleMake: string;
  vehicleModel: string;
  licensePlate: string;
  notes: string;
};

async function accessToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)
    : value;
}
function localInput(timestamp: number) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}
function initialGuestDraft(): GuestDraft {
  const timestamp = Date.now();
  return {
    guestName: "",
    visitType: "guest",
    startsAt: localInput(timestamp + 3_600_000),
    endsAt: localInput(timestamp + 7_200_000),
    vehicleMake: "",
    vehicleModel: "",
    licensePlate: "",
    notes: "",
  };
}

export default function RoomGuestsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [filterTimestamp] = useState(() => Date.now());
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [isError, setIsError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [draft, setDraft] = useState<GuestDraft>(initialGuestDraft);

  const request = useCallback(async (init?: RequestInit) => {
    const token = await accessToken();
    if (!token) throw new Error("Sign in again before continuing.");
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/guests`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Room Guests could not complete this request.");
    return result;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setNotice("");
    setIsError(false);
    try { setPayload(await request()); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Room Guests could not load."); setIsError(true); }
    finally { setLoading(false); }
  }, [request, roomId]);

  useEffect(() => { void load(); }, [load]);

  const passes = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (payload?.passes ?? []).filter((pass) => {
      if (filter === "pending" && pass.status !== "pending") return false;
      if (filter === "active" && !["active", "checked_in"].includes(pass.status)) return false;
      if (filter === "upcoming" && (new Date(pass.ends_at).getTime() < filterTimestamp || ["cancelled", "denied", "checked_out", "expired"].includes(pass.status))) return false;
      if (filter === "history" && !(["cancelled", "denied", "checked_out", "expired"].includes(pass.status) || new Date(pass.ends_at).getTime() < filterTimestamp)) return false;
      if (!term) return true;
      return [pass.guest_name, pass.license_plate, pass.vehicle_make, pass.vehicle_model, pass.visit_type].filter(Boolean).some((value) => String(value).toLowerCase().includes(term));
    });
  }, [filter, filterTimestamp, payload?.passes, query]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking("create"); setNotice(""); setIsError(false);
    try {
      await request({ method: "POST", body: JSON.stringify({ action: "create", ...draft }) });
      setDraft((current) => ({ ...current, guestName: "", vehicleMake: "", vehicleModel: "", licensePlate: "", notes: "" }));
      setNotice("Guest registration submitted.");
      await load();
    } catch (error) { setNotice(error instanceof Error ? error.message : "Guest registration failed."); setIsError(true); }
    finally { setWorking(""); }
  }

  async function act(passId: string, action: string, success: string) {
    if (working) return;
    setWorking(passId + action); setNotice(""); setIsError(false);
    try { await request({ method: "POST", body: JSON.stringify({ action, passId }) }); setNotice(success); await load(); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Guest pass update failed."); setIsError(true); }
    finally { setWorking(""); }
  }

  return (
    <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6">
      <div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
        <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-live-back-link !min-h-11"><ArrowLeft aria-hidden="true" /> Back to Room</Link>
        <header className="room-workspace-hero">
          <div><div className="room-workspace-badges"><span><ShieldCheck aria-hidden="true" /> Private visitor management</span></div><h1>{payload?.room?.name ? `${payload.room.name} guests` : "Room Guests"}</h1><p>Register visitors, review approvals, and track arrivals and departures.</p></div>
          <button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void load()} disabled={loading}><RefreshCw aria-hidden="true" className={loading ? "is-spinning" : undefined} /> Refresh</button>
        </header>

        {notice ? <div role={isError ? "alert" : "status"} className={`room-expansion-notice${isError ? " is-error" : ""}`}>{notice}</div> : null}

        {!isError || payload ? (
          <form className="room-expansion-form" onSubmit={submit}>
            <div className="room-expansion-section-heading"><div><h2>Register a guest</h2><p>Create a time-limited visitor pass for a guest, contractor, delivery, or service provider.</p></div><UserRoundPlus aria-hidden="true" /></div>
            <div className="room-expansion-form-grid">
              <label><span>Guest name</span><input required minLength={2} value={draft.guestName} onChange={(event) => setDraft((current) => ({ ...current, guestName: event.target.value }))} /></label>
              <label><span>Visit type</span><select value={draft.visitType} onChange={(event) => setDraft((current) => ({ ...current, visitType: event.target.value }))}><option value="guest">Personal guest</option><option value="contractor">Contractor</option><option value="delivery">Delivery</option><option value="service">Service provider</option><option value="realtor">Realtor</option><option value="other">Other</option></select></label>
              <label><span>Arrival</span><input type="datetime-local" required value={draft.startsAt} onChange={(event) => setDraft((current) => ({ ...current, startsAt: event.target.value }))} /></label>
              <label><span>Departure</span><input type="datetime-local" required value={draft.endsAt} onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} /></label>
              <label><span>Vehicle make</span><input value={draft.vehicleMake} onChange={(event) => setDraft((current) => ({ ...current, vehicleMake: event.target.value }))} /></label>
              <label><span>Vehicle model</span><input value={draft.vehicleModel} onChange={(event) => setDraft((current) => ({ ...current, vehicleModel: event.target.value }))} /></label>
              <label><span>License plate</span><input value={draft.licensePlate} onChange={(event) => setDraft((current) => ({ ...current, licensePlate: event.target.value.toUpperCase() }))} /></label>
            </div>
            <label><span>Notes</span><textarea rows={3} maxLength={2000} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
            <button type="submit" className="rooms-live-primary-action !min-h-11" disabled={working === "create"}><UserRoundPlus aria-hidden="true" /> {working === "create" ? "Registering…" : "Register guest"}</button>
          </form>
        ) : null}

        <section className="room-expansion space-y-4">
          <div className="room-expansion-form-grid">
            <label><span>Search guests</span><div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" /><input className="!pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Guest, vehicle, or license plate" /></div></label>
            <label><span>View</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="upcoming">Upcoming</option><option value="pending">Pending approval</option><option value="active">Active now</option><option value="history">History</option><option value="all">All passes</option></select></label>
          </div>
          {loading && !payload ? <div className="room-expansion-loading">Loading guest passes…</div> : passes.length === 0 ? <div className="room-resources-empty"><h3>No matching guest passes</h3><p>Guest registrations available to your Room role will appear here.</p></div> : (
            <div className="room-resources-grid">
              {passes.map((pass) => (
                <article key={pass.id} className="room-resources-item space-y-3">
                  <div className="room-resources-item-topline"><div className="room-resources-item-name"><CalendarClock aria-hidden="true" /> {pass.guest_name}</div><span className="rounded-full border px-2 py-1 text-xs capitalize">{pass.status.replaceAll("_", " ")}</span></div>
                  <div className="room-resources-item-meta">{formatDate(pass.starts_at)} to {formatDate(pass.ends_at)}</div>
                  <div className="room-resources-item-meta capitalize">{pass.visit_type}{pass.license_plate ? ` · ${pass.license_plate}` : ""}{pass.vehicle_make ? ` · ${pass.vehicle_make} ${pass.vehicle_model ?? ""}` : ""}</div>
                  {pass.notes ? <p>{pass.notes}</p> : null}
                  {pass.review_note ? <p><strong>Management note:</strong> {pass.review_note}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {payload?.access?.canManage && pass.status === "pending" ? <><button type="button" className="room-resources-button" onClick={() => void act(pass.id, "approve", "Guest pass approved.")}><Check aria-hidden="true" /> Approve</button><button type="button" className="room-resources-button is-quiet" onClick={() => void act(pass.id, "deny", "Guest pass denied.")}><X aria-hidden="true" /> Deny</button></> : null}
                    {payload?.access?.canManage && ["approved", "active"].includes(pass.status) ? <button type="button" className="room-resources-button" onClick={() => void act(pass.id, "check_in", "Guest checked in.")}><LogIn aria-hidden="true" /> Check in</button> : null}
                    {payload?.access?.canManage && pass.status === "checked_in" ? <button type="button" className="room-resources-button" onClick={() => void act(pass.id, "check_out", "Guest checked out.")}><LogOut aria-hidden="true" /> Check out</button> : null}
                    {!["cancelled", "denied", "checked_out", "expired"].includes(pass.status) ? <button type="button" className="room-resources-button is-quiet" onClick={() => void act(pass.id, "cancel", "Guest pass cancelled.")}><X aria-hidden="true" /> Cancel</button> : null}
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
