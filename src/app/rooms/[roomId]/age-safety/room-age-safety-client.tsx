"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Payload = {
  room: { id: string; name: string; roomType: string };
  access: { isOwner: boolean; canManage: boolean };
  settings: {
    roomId: string;
    allowsMinors: boolean;
    minorAdmissionMode: "blocked" | "approval_required";
    teenStaffAllowed: false;
    updatedAt: string | null;
  };
  summary: {
    activeTeenMembers: number;
    pendingTeenApplications: number;
  };
  managerAgeBand: string;
};

export default function RoomAgeSafetyClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [payload, setPayload] = useState<Payload | null>(null);
  const [allowsMinors, setAllowsMinors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.replace(
        `/login?next=${encodeURIComponent(`/rooms/${roomId}/age-safety`)}`
      );
      return;
    }

    const response = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/age-safety`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to load Room minor-safety settings.");
      setLoading(false);
      return;
    }

    const next = result as Payload;
    setPayload(next);
    setAllowsMinors(next.settings.allowsMinors);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || working || !payload?.access.isOwner) return;

    setWorking(true);
    setMessage("");
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      window.location.replace(
        `/login?next=${encodeURIComponent(`/rooms/${roomId}/age-safety`)}`
      );
      return;
    }

    const response = await fetch(
      `/api/rooms/${encodeURIComponent(roomId)}/age-safety`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ allowsMinors }),
      }
    );
    const result = await response.json().catch(() => ({}));
    setWorking(false);

    if (!response.ok) {
      setMessage(result.error ?? "Unable to save Room minor-safety settings.");
      return;
    }

    setMessage("Room minor-safety settings saved.");
    await load();
  }

  return (
    <main className="min-h-screen bg-[color:var(--loombus-page-bg)] px-4 py-8 text-[color:var(--loombus-text)] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 sm:p-8">
          <Link
            href={roomId ? `/rooms/${encodeURIComponent(roomId)}` : "/rooms"}
            className="text-sm text-[color:var(--loombus-text-muted)] hover:text-[color:var(--loombus-text)]"
          >
            ← Back to Room
          </Link>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--loombus-trust-accent,#9A7418)]">
            Room minor safety
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Protected admission for teen members.
          </h1>
          <p className="mt-4 max-w-3xl leading-7 text-[color:var(--loombus-text-muted)]">
            Teen members may enter only Rooms that explicitly allow minors. Every teen admission requires owner or administrator approval, and teen members cannot hold owner, administrator, or moderator roles.
          </p>
        </header>

        {message ? (
          <div
            role="status"
            className="rounded-2xl border border-[#CBAB5B]/45 bg-[#CBAB5B]/10 px-4 py-3 text-sm"
          >
            {message}
          </div>
        ) : null}

        {loading ? (
          <section className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6">
            Loading Room minor-safety settings...
          </section>
        ) : payload ? (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                  Room
                </p>
                <h2 className="mt-3 text-xl font-semibold">{payload.room.name}</h2>
                <p className="mt-2 text-sm capitalize text-[color:var(--loombus-text-muted)]">
                  {payload.room.roomType.replaceAll("_", " ")}
                </p>
              </article>
              <article className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                  Active teen members
                </p>
                <strong className="mt-3 block text-3xl">
                  {payload.summary.activeTeenMembers.toLocaleString()}
                </strong>
              </article>
              <article className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6">
                <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--loombus-text-muted)]">
                  Pending teen requests
                </p>
                <strong className="mt-3 block text-3xl">
                  {payload.summary.pendingTeenApplications.toLocaleString()}
                </strong>
              </article>
            </section>

            <form
              onSubmit={save}
              className="rounded-3xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface)] p-6 sm:p-8"
            >
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="max-w-2xl">
                  <h2 className="text-2xl font-semibold">Allow teen admission</h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    When enabled, ages 13–17 may submit or redeem an invitation only through a pending join request. Approval remains manual. Sharing a Room does not grant either person permission to start a private message.
                  </p>
                </div>
                <label className="flex items-center gap-3 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allowsMinors}
                    onChange={(event) => setAllowsMinors(event.target.checked)}
                    disabled={!payload.access.isOwner || working}
                    className="h-5 w-5 accent-[#CBAB5B]"
                  />
                  <span className="text-sm font-semibold">
                    {allowsMinors ? "Teen admission allowed" : "Teen admission blocked"}
                  </span>
                </label>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <article className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-4">
                  <strong className="text-sm">Approval required</strong>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Teen invitation redemption never creates immediate membership.
                  </p>
                </article>
                <article className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-4">
                  <strong className="text-sm">Member role only</strong>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Teen accounts cannot become Room staff or owners.
                  </p>
                </article>
                <article className="rounded-2xl border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-4">
                  <strong className="text-sm">No automatic public exposure</strong>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--loombus-text-muted)]">
                    Teen account privacy and discoverability defaults remain active.
                  </p>
                </article>
              </div>

              {payload.access.isOwner ? (
                <button
                  type="submit"
                  disabled={working || allowsMinors === payload.settings.allowsMinors}
                  className="mt-6 rounded-full bg-[#CBAB5B] px-5 py-3 font-semibold text-[#15120c] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {working ? "Saving..." : "Save minor-safety settings"}
                </button>
              ) : (
                <p className="mt-6 text-sm text-[color:var(--loombus-text-muted)]">
                  Administrators may review this page. Only the Room owner can change minor-admission settings.
                </p>
              )}
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}
