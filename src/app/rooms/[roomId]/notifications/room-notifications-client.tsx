"use client";

import Link from "next/link";
import { Bell, CheckCircle2, Loader2, Mail, RefreshCw } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Preferences = {
  inAppEnabled: boolean;
  newDiscussionsEnabled: boolean;
  announcementsEnabled: boolean;
  eventsEnabled: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: "daily" | "weekly";
  emailDigestLastSentAt?: string | null;
};

type ResponsePayload = {
  room?: { id: string; name: string; roomType: string };
  preferences?: Preferences;
  error?: string;
};

const DEFAULTS: Preferences = {
  inAppEnabled: true,
  newDiscussionsEnabled: false,
  announcementsEnabled: true,
  eventsEnabled: true,
  emailDigestEnabled: false,
  emailDigestFrequency: "weekly",
  emailDigestLastSentAt: null,
};

function dateLabel(value?: string | null) {
  if (!value) return "Not sent yet";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not sent yet";
}

function PreferenceToggle({
  checked,
  disabled,
  label,
  description,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
      <span>
        <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--muted)]">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-current disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

export default function RoomNotificationsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [room, setRoom] = useState<ResponsePayload["room"]>(undefined);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const accessToken = useCallback(async () => {
    const result = await supabase.auth.getSession();
    const token = result.data.session?.access_token ?? "";
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/rooms/${roomId}/notifications`
      )}`;
      return null;
    }
    return token;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/notifications`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const payload = (await response.json().catch(() => ({}))) as ResponsePayload;
      if (!response.ok || !payload.preferences) {
        throw new Error(payload.error || "Room notification preferences could not be loaded.");
      }
      setRoom(payload.room);
      setPreferences(payload.preferences);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Room notification preferences could not be loaded."
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/notifications`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(preferences),
        }
      );
      const payload = (await response.json().catch(() => ({}))) as ResponsePayload;
      if (!response.ok || !payload.preferences) {
        throw new Error(payload.error || "Room notification preferences could not be saved.");
      }
      setRoom(payload.room);
      setPreferences(payload.preferences);
      setMessage("Room notification preferences saved.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Room notification preferences could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  const supportRoom = ["customer_support", "customer-support"].includes(
    room?.roomType?.trim().toLowerCase().replaceAll(" ", "_") ?? ""
  );

  return (
    <main className="rooms-live-shell min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                Room delivery
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">
                {room?.name ? `${room.name} notifications` : "Room notifications"}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                Choose which Room-wide activity appears in your Signal Inbox and whether this Room
                sends you a private email digest.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/rooms/${encodeURIComponent(roomId)}`}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium"
              >
                Back to Room
              </Link>
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-full border border-[var(--border)] p-2"
                aria-label="Refresh Room notification preferences"
              >
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {message ? (
          <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> {message}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading Room delivery settings…
          </div>
        ) : (
          <>
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-[var(--text)]">Signal Inbox</h2>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">
                These controls cover Room-wide activity. Replies, support cases, and moderation
                decisions keep their existing participant and safety delivery rules.
              </p>
              <div className="mt-5 space-y-3">
                <PreferenceToggle
                  checked={preferences.inAppEnabled}
                  label="Room-wide notifications"
                  description="Allow selected Room activity to appear in your Loombus Signal Inbox."
                  onChange={(inAppEnabled) =>
                    setPreferences((current) => ({ ...current, inAppEnabled }))
                  }
                />
                <PreferenceToggle
                  checked={preferences.newDiscussionsEnabled}
                  disabled={!preferences.inAppEnabled}
                  label="New discussions"
                  description="Notify me when a member starts a Room-wide discussion. This is off by default to prevent noisy fan-out."
                  onChange={(newDiscussionsEnabled) =>
                    setPreferences((current) => ({
                      ...current,
                      newDiscussionsEnabled,
                    }))
                  }
                />
                <PreferenceToggle
                  checked={preferences.announcementsEnabled}
                  disabled={!preferences.inAppEnabled}
                  label="Announcements"
                  description="Notify me when Room management publishes a new announcement."
                  onChange={(announcementsEnabled) =>
                    setPreferences((current) => ({
                      ...current,
                      announcementsEnabled,
                    }))
                  }
                />
                <PreferenceToggle
                  checked={preferences.eventsEnabled}
                  disabled={!preferences.inAppEnabled}
                  label="Events"
                  description="Notify me when Room management creates a new event."
                  onChange={(eventsEnabled) =>
                    setPreferences((current) => ({ ...current, eventsEnabled }))
                  }
                />
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                <h2 className="text-lg font-semibold text-[var(--text)]">Room email digest</h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Digests include notification summaries and direct Room links. They never include
                discussion bodies, reply text, moderation evidence, or internal case notes.
              </p>
              {supportRoom ? (
                <p className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Customer Support digest entries are additionally sanitized so case titles and
                  participant details are not sent by email.
                </p>
              ) : null}
              <div className="mt-5 space-y-4">
                <PreferenceToggle
                  checked={preferences.emailDigestEnabled}
                  label="Send a Room digest"
                  description="Email me a private summary only when this Room has new notification activity."
                  onChange={(emailDigestEnabled) =>
                    setPreferences((current) => ({
                      ...current,
                      emailDigestEnabled,
                    }))
                  }
                />
                <fieldset disabled={!preferences.emailDigestEnabled}>
                  <legend className="text-sm font-semibold text-[var(--text)]">Frequency</legend>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {(["daily", "weekly"] as const).map((frequency) => (
                      <label
                        key={frequency}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm capitalize"
                      >
                        <input
                          type="radio"
                          name="room-digest-frequency"
                          value={frequency}
                          checked={preferences.emailDigestFrequency === frequency}
                          onChange={() =>
                            setPreferences((current) => ({
                              ...current,
                              emailDigestFrequency: frequency,
                            }))
                          }
                          className="h-4 w-4 accent-current"
                        />
                        {frequency}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <p className="text-xs text-[var(--muted)]">
                  Last successful Room digest: {dateLabel(preferences.emailDigestLastSentAt)}
                </p>
              </div>
            </section>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="min-w-40 rounded-xl bg-[var(--text)] px-5 py-3 text-sm font-semibold text-[var(--background)] disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save preferences"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
