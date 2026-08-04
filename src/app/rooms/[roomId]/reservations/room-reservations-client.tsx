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
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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
  requester?: {
    id?: string;
    username?: string | null;
    full_name?: string | null;
  } | null;
};

type Payload = {
  room?: { id: string; name: string; roomType: string };
  access?: { role: string | null; canManage: boolean; isOwner: boolean };
  resources?: Resource[];
  reservations?: Reservation[];
  error?: string;
};

type FacilityPreset = {
  label: string;
  capacity: number | "";
  durationMinutes: number;
  bufferMinutes: number;
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  approvalRequired: boolean;
};

const FACILITY_PRESETS: Record<string, FacilityPreset> = {
  clubhouse: {
    label: "Clubhouse",
    capacity: 50,
    durationMinutes: 120,
    bufferMinutes: 30,
    minimumNoticeHours: 24,
    maximumAdvanceDays: 90,
    approvalRequired: true,
  },
  tennis_court: {
    label: "Tennis court",
    capacity: 4,
    durationMinutes: 60,
    bufferMinutes: 10,
    minimumNoticeHours: 2,
    maximumAdvanceDays: 30,
    approvalRequired: false,
  },
  pool: {
    label: "Pool",
    capacity: 25,
    durationMinutes: 120,
    bufferMinutes: 15,
    minimumNoticeHours: 12,
    maximumAdvanceDays: 30,
    approvalRequired: true,
  },
  pavilion: {
    label: "Pavilion",
    capacity: 40,
    durationMinutes: 180,
    bufferMinutes: 30,
    minimumNoticeHours: 24,
    maximumAdvanceDays: 90,
    approvalRequired: true,
  },
  conference_room: {
    label: "Conference room",
    capacity: 12,
    durationMinutes: 60,
    bufferMinutes: 10,
    minimumNoticeHours: 1,
    maximumAdvanceDays: 60,
    approvalRequired: false,
  },
  study_room: {
    label: "Study room",
    capacity: 6,
    durationMinutes: 60,
    bufferMinutes: 0,
    minimumNoticeHours: 1,
    maximumAdvanceDays: 30,
    approvalRequired: false,
  },
  custom: {
    label: "",
    capacity: "",
    durationMinutes: 60,
    bufferMinutes: 0,
    minimumNoticeHours: 1,
    maximumAdvanceDays: 90,
    approvalRequired: true,
  },
};

const inputClass =
  "w-full rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] px-4 py-3 text-[color:var(--loombus-text)] outline-none focus:border-[color:var(--loombus-gold)] focus:ring-4 focus:ring-[color:var(--loombus-gold-soft)]";
const secondaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 text-sm font-semibold transition hover:border-[color:var(--loombus-gold)] disabled:opacity-50";
const primaryButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[color:var(--loombus-gold)] px-4 text-sm font-semibold text-[color:var(--loombus-gold-contrast)] transition hover:opacity-90 disabled:opacity-50";
const sectionClass =
  "rounded-2xl border border-[color:var(--loombus-border-muted)] bg-[color:var(--loombus-page-bg)] p-4 sm:p-5";
const labelClass = "block text-sm font-semibold text-[color:var(--loombus-text)]";
const helperClass = "mt-1 text-xs leading-5 text-[color:var(--loombus-text-muted)]";

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

function NumberField({
  name,
  label,
  unit,
  helper,
  value,
  min,
  max,
  onChange,
}: {
  name: string;
  label: string;
  unit: string;
  helper: string;
  value: number | "";
  min: number;
  max?: number;
  onChange: (value: number | "") => void;
}) {
  return (
    <label>
      <span className={labelClass}>{label}</span>
      <span className="mt-2 flex overflow-hidden rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-page-bg)] focus-within:border-[color:var(--loombus-gold)] focus-within:ring-4 focus-within:ring-[color:var(--loombus-gold-soft)]">
        <input
          name={name}
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) =>
            onChange(event.target.value === "" ? "" : Number(event.target.value))
          }
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[color:var(--loombus-text)] outline-none"
        />
        <span className="flex min-w-24 items-center justify-center border-l border-[color:var(--loombus-border)] px-3 text-sm font-semibold text-[color:var(--loombus-text-muted)]">
          {unit}
        </span>
      </span>
      <span className={helperClass}>{helper}</span>
    </label>
  );
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
  const [presetKey, setPresetKey] = useState("custom");
  const [facilityName, setFacilityName] = useState("");
  const [capacity, setCapacity] = useState<number | "">("");
  const [durationMinutes, setDurationMinutes] = useState<number | "">(60);
  const [bufferMinutes, setBufferMinutes] = useState<number | "">(0);
  const [minimumNoticeHours, setMinimumNoticeHours] = useState<number | "">(1);
  const [maximumAdvanceDays, setMaximumAdvanceDays] = useState<number | "">(90);
  const [approvalRequired, setApprovalRequired] = useState(true);

  const activeResources = useMemo(
    () => (payload?.resources ?? []).filter((resource) => resource.status === "active"),
    [payload?.resources]
  );

  const token = useCallback(async () => {
    const session = await supabase.auth.getSession();
    const accessToken = session.data.session?.access_token;
    if (!accessToken) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/rooms/${roomId}/reservations`
      )}`;
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
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/reservations`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as Payload;
      if (!response.ok) {
        throw new Error(result.error || "Room reservations could not be loaded.");
      }
      setPayload(result);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Room reservations could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyPreset(nextKey: string) {
    const preset = FACILITY_PRESETS[nextKey] ?? FACILITY_PRESETS.custom;
    setPresetKey(nextKey);
    setFacilityName(preset.label);
    setCapacity(preset.capacity);
    setDurationMinutes(preset.durationMinutes);
    setBufferMinutes(preset.bufferMinutes);
    setMinimumNoticeHours(preset.minimumNoticeHours);
    setMaximumAdvanceDays(preset.maximumAdvanceDays);
    setApprovalRequired(preset.approvalRequired);
  }

  function resetFacilityForm() {
    applyPreset("custom");
  }

  async function action(input: Record<string, unknown>, success: string) {
    if (working) return false;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      const accessToken = await token();
      if (!accessToken) return false;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/reservations`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(result.error || "Reservation action failed.");
      }
      setNotice(success);
      await load();
      return true;
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Reservation action failed."
      );
      return false;
    } finally {
      setWorking(false);
    }
  }

  async function createResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const noticeHours = Number(minimumNoticeHours || 0);
    const saved = await action(
      {
        action: "create_resource",
        name: facilityName,
        description: form.get("description"),
        locationText: form.get("locationText"),
        capacity,
        durationMinutes,
        bufferMinutes,
        minimumNoticeMinutes: noticeHours * 60,
        maximumAdvanceDays,
        approvalRequired,
        rules: form.get("rules"),
      },
      "Facility created."
    );
    if (saved) {
      setResourceOpen(false);
      event.currentTarget.reset();
      resetFacilityForm();
    }
  }

  async function requestReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedResource) return;
    const form = new FormData(event.currentTarget);
    const date = new Date(String(form.get("requestedStart") ?? ""));
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
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          <Loader2
            className="animate-spin text-[color:var(--loombus-gold)]"
            size={18}
          />
          Loading reservations
        </span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[color:var(--loombus-text)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link
          href={`/rooms/${roomId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-gold)]"
        >
          <ArrowLeft size={16} /> Back to Room
        </Link>

        <header className="mt-5 flex flex-col gap-4 border-b border-[color:var(--loombus-border-muted)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-[color:var(--loombus-gold)]">
              Private Room scheduling
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em]">
              {payload?.room?.name || "Room"} reservations
            </h1>
            <p className="mt-2 max-w-2xl text-[color:var(--loombus-text-muted)]">
              Reserve facilities and shared spaces managed by this Room.
            </p>
          </div>
          {payload?.access?.canManage ? (
            <button
              type="button"
              className={primaryButton}
              onClick={() => setResourceOpen((value) => !value)}
            >
              <Plus size={16} /> Add facility
            </button>
          ) : null}
        </header>

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}
        {notice ? (
          <p
            role="status"
            className="mt-5 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-4 text-sm"
          >
            {notice}
          </p>
        ) : null}

        {resourceOpen && payload?.access?.canManage ? (
          <form
            onSubmit={createResource}
            className="mt-6 rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-5 shadow-xl shadow-black/10 sm:p-6"
          >
            <h2 className="text-2xl font-semibold">Add facility</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Configure a facility or shared space that Room members can reserve.
            </p>

            <div className="mt-6 space-y-5">
              <section className={sectionClass}>
                <h3 className="text-base font-semibold">Facility information</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label>
                    <span className={labelClass}>Facility type</span>
                    <select
                      value={presetKey}
                      onChange={(event) => applyPreset(event.target.value)}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="custom">Custom</option>
                      <option value="clubhouse">Clubhouse</option>
                      <option value="tennis_court">Tennis court</option>
                      <option value="pool">Pool</option>
                      <option value="pavilion">Pavilion</option>
                      <option value="conference_room">Conference room</option>
                      <option value="study_room">Study room</option>
                    </select>
                    <span className={helperClass}>
                      A preset fills in sensible timing and capacity defaults.
                    </span>
                  </label>
                  <label>
                    <span className={labelClass}>Facility name</span>
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={160}
                      value={facilityName}
                      onChange={(event) => setFacilityName(event.target.value)}
                      placeholder="Community clubhouse"
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Location or access instructions</span>
                    <input
                      name="locationText"
                      placeholder="North clubhouse, use the side entrance"
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                  <label>
                    <span className={labelClass}>Description</span>
                    <textarea
                      name="description"
                      rows={3}
                      placeholder="Describe the space and what it is intended for."
                      className={`${inputClass} mt-2`}
                    />
                  </label>
                </div>
              </section>

              <section className={sectionClass}>
                <h3 className="text-base font-semibold">Capacity and timing</h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <NumberField
                    name="capacity"
                    label="Maximum occupancy"
                    unit="people"
                    helper="Leave blank when capacity does not apply."
                    value={capacity}
                    min={1}
                    max={100000}
                    onChange={setCapacity}
                  />
                  <NumberField
                    name="durationMinutes"
                    label="Reservation duration"
                    unit="minutes"
                    helper="Default length of each reservation."
                    value={durationMinutes}
                    min={15}
                    max={1440}
                    onChange={setDurationMinutes}
                  />
                  <NumberField
                    name="bufferMinutes"
                    label="Cleanup buffer"
                    unit="minutes"
                    helper="Time blocked after each reservation before another can begin."
                    value={bufferMinutes}
                    min={0}
                    max={1440}
                    onChange={setBufferMinutes}
                  />
                </div>
              </section>

              <section className={sectionClass}>
                <h3 className="text-base font-semibold">Booking rules</h3>
                <div className="mt-4 grid gap-5 sm:grid-cols-2">
                  <NumberField
                    name="minimumNoticeHours"
                    label="Minimum notice"
                    unit="hours"
                    helper="Members must reserve at least this far in advance."
                    value={minimumNoticeHours}
                    min={0}
                    max={8760}
                    onChange={setMinimumNoticeHours}
                  />
                  <NumberField
                    name="maximumAdvanceDays"
                    label="Advance booking window"
                    unit="days"
                    helper="Furthest date into the future that members can reserve."
                    value={maximumAdvanceDays}
                    min={1}
                    max={730}
                    onChange={setMaximumAdvanceDays}
                  />
                  <label className="flex min-h-14 items-start gap-3 rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] px-4 py-3 sm:col-span-2">
                    <input
                      name="approvalRequired"
                      type="checkbox"
                      checked={approvalRequired}
                      onChange={(event) => setApprovalRequired(event.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <strong className="block text-sm">
                        Require management approval
                      </strong>
                      <span className={helperClass}>
                        Requests remain pending until a Room owner or administrator approves them.
                      </span>
                    </span>
                  </label>
                </div>
              </section>

              <section className={sectionClass}>
                <label>
                  <span className={labelClass}>Facility rules</span>
                  <textarea
                    name="rules"
                    rows={5}
                    placeholder={
                      "Maximum 2 hours per reservation\nClean the facility after use\nNo amplified music after 9 PM"
                    }
                    className={`${inputClass} mt-2`}
                  />
                  <span className={helperClass}>
                    These rules are shown to members before they submit a reservation.
                  </span>
                </label>
              </section>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" disabled={working} className={primaryButton}>
                {working ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <Plus size={16} />
                )}
                Save facility
              </button>
              <button
                type="button"
                onClick={() => {
                  setResourceOpen(false);
                  resetFacilityForm();
                }}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
                Available facilities
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Choose what to reserve</h2>
            </div>
            <span className="text-sm text-[color:var(--loombus-text-muted)]">
              {activeResources.length} active
            </span>
          </div>
          {activeResources.length === 0 ? (
            <div className="mt-4 rounded-[1.75rem] border border-dashed border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-10 text-center">
              <Building2
                className="mx-auto text-[color:var(--loombus-gold)]"
                size={36}
              />
              <h3 className="mt-3 text-xl font-semibold">No facilities yet</h3>
              <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                Room management can add a clubhouse, court, meeting room, pavilion,
                or another shared space.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {activeResources.map((resource) => (
                <article
                  key={resource.id}
                  className="rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5 shadow-lg shadow-black/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--loombus-gold-soft)] text-[color:var(--loombus-gold)]">
                      <Building2 size={20} />
                    </span>
                    {payload?.access?.canManage ? (
                      <button
                        type="button"
                        disabled={working}
                        onClick={() =>
                          void action(
                            {
                              action: "set_resource_status",
                              resourceId: resource.id,
                              status: "paused",
                            },
                            "Facility paused."
                          )
                        }
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[color:var(--loombus-border)] px-3 text-xs font-semibold"
                      >
                        <Pause size={14} /> Pause
                      </button>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-xl font-semibold">{resource.name}</h3>
                  {resource.description ? (
                    <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                      {resource.description}
                    </p>
                  ) : null}
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--loombus-text-muted)]">
                    <p className="flex items-center gap-2">
                      <CalendarClock size={15} /> {resource.durationMinutes} minutes
                    </p>
                    {resource.capacity ? (
                      <p className="flex items-center gap-2">
                        <Users size={15} /> Up to {resource.capacity} people
                      </p>
                    ) : null}
                    {resource.locationText ? <p>{resource.locationText}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedResource(resource)}
                    className={`${primaryButton} mt-5 w-full`}
                  >
                    <CalendarClock size={16} /> Reserve
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        {selectedResource ? (
          <form
            onSubmit={requestReservation}
            className="mt-8 rounded-[1.75rem] border border-[color:var(--loombus-gold)] bg-[color:var(--loombus-surface)] p-6 shadow-xl shadow-black/10"
          >
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
              Reserve facility
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{selectedResource.name}</h2>
            <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
              Reservation length: {selectedResource.durationMinutes} minutes. {" "}
              {selectedResource.approvalRequired
                ? "Room management must approve this request."
                : "This facility confirms automatically when the time is available."}
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Start date and time</span>
                <input
                  name="requestedStart"
                  type="datetime-local"
                  required
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label>
                <span className={labelClass}>Number of attendees</span>
                <input
                  name="attendeeCount"
                  type="number"
                  min={1}
                  max={selectedResource.capacity ?? 100000}
                  placeholder="1"
                  className={`${inputClass} mt-2`}
                />
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Purpose or notes</span>
                <textarea
                  name="note"
                  rows={4}
                  placeholder="Share any details management should know."
                  className={`${inputClass} mt-2`}
                />
              </label>
            </div>
            {selectedResource.rules ? (
              <p className="mt-4 whitespace-pre-line rounded-2xl bg-[color:var(--loombus-page-bg)] p-4 text-sm leading-6">
                <strong>Facility rules:</strong> {selectedResource.rules}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="submit" disabled={working} className={primaryButton}>
                {working ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <CalendarClock size={16} />
                )}
                Submit reservation
              </button>
              <button
                type="button"
                onClick={() => setSelectedResource(null)}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        <section className="mt-10">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[color:var(--loombus-gold)]">
            {payload?.access?.canManage ? "Reservation queue" : "My reservations"}
          </p>
          <h2 className="mt-1 text-2xl font-semibold">Upcoming and recent requests</h2>
          {(payload?.reservations ?? []).length === 0 ? (
            <p className="mt-4 rounded-[1.75rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-8 text-center text-sm text-[color:var(--loombus-text-muted)]">
              No reservations yet.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {(payload?.reservations ?? []).map((reservation) => (
                <article
                  key={reservation.id}
                  className="rounded-[1.5rem] border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-5"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          {reservation.resource?.name || "Room facility"}
                        </h3>
                        <span className="rounded-full bg-[color:var(--loombus-page-bg)] px-3 py-1 text-xs font-semibold">
                          {statusLabel(reservation.status)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--loombus-text-muted)]">
                        {formatDate(reservation.requestedStart)} to {" "}
                        {formatDate(reservation.requestedEnd)}
                      </p>
                      {payload?.access?.canManage && reservation.requester ? (
                        <p className="mt-1 text-sm text-[color:var(--loombus-text-muted)]">
                          Requested by {" "}
                          {reservation.requester.full_name ||
                            reservation.requester.username ||
                            "Room member"}
                        </p>
                      ) : null}
                      {reservation.note ? (
                        <p className="mt-2 text-sm">{reservation.note}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {payload?.access?.canManage &&
                      reservation.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void action(
                                {
                                  action: "manager_action",
                                  reservationId: reservation.id,
                                  decision: "accept",
                                },
                                "Reservation accepted."
                              )
                            }
                            className={primaryButton}
                          >
                            <Check size={15} /> Accept
                          </button>
                          <button
                            type="button"
                            disabled={working}
                            onClick={() =>
                              void action(
                                {
                                  action: "manager_action",
                                  reservationId: reservation.id,
                                  decision: "decline",
                                },
                                "Reservation declined."
                              )
                            }
                            className={secondaryButton}
                          >
                            <X size={15} /> Decline
                          </button>
                        </>
                      ) : null}
                      {!payload?.access?.canManage &&
                      ["pending", "accepted"].includes(reservation.status) ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            void action(
                              {
                                action: "cancel_own",
                                reservationId: reservation.id,
                              },
                              "Reservation cancelled."
                            )
                          }
                          className={secondaryButton}
                        >
                          <X size={15} /> Cancel
                        </button>
                      ) : null}
                      {payload?.access?.canManage &&
                      reservation.status === "accepted" ? (
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            void action(
                              {
                                action: "manager_action",
                                reservationId: reservation.id,
                                decision: "complete",
                              },
                              "Reservation completed."
                            )
                          }
                          className={secondaryButton}
                        >
                          <Check size={15} /> Complete
                        </button>
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
