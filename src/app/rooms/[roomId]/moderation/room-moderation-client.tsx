"use client";

import Link from "next/link";
import { AlertTriangle, ArrowUpCircle, CheckCircle2, Flag, RefreshCw, UserCheck, XCircle } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
};

type ModerationItem = {
  id: string;
  target_type: string;
  target_id?: string | null;
  category: string;
  priority: string;
  reason: string;
  reporter_note?: string | null;
  status: string;
  evidence_snapshot?: Record<string, unknown>;
  assigned_to?: string | null;
  reported_by?: string | null;
  affected_user_id?: string | null;
  resolution_note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  reporterProfile?: Profile | null;
  assigneeProfile?: Profile | null;
  affectedProfile?: Profile | null;
};

type StaffMember = {
  userId: string;
  role: string;
  status: string;
  profile?: Profile | null;
};

type Overview = {
  room: { id: string; name: string };
  access: { canModerate: boolean; canManage: boolean; isOwner?: boolean; role?: string | null };
  reports: ModerationItem[];
  staff?: StaffMember[];
};

function profileName(profile?: Profile | null) {
  return profile?.full_name || profile?.username || "Room member";
}

function dateLabel(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "";
}

export default function RoomModerationClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [overview, setOverview] = useState<Overview | null>(null);
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [targetType, setTargetType] = useState(searchParams.get("targetType") || "other");
  const [targetId, setTargetId] = useState(searchParams.get("targetId") || "");
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [reporterNote, setReporterNote] = useState("");
  const [assignment, setAssignment] = useState<Record<string, string>>({});
  const [resolution, setResolution] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    const sessionResult = await supabase.auth.getSession();
    const accessToken = sessionResult.data.session?.access_token ?? "";
    if (!accessToken) {
      setError("Sign in to access Room moderation.");
      setLoading(false);
      return;
    }
    setToken(accessToken);
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/moderation`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    const result = (await response.json().catch(() => ({}))) as Overview & { error?: string };
    if (!response.ok) {
      setError(result.error || "Room moderation could not be loaded.");
      setLoading(false);
      return;
    }
    setOverview(result);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, payload: Record<string, unknown>, key = action) {
    if (!token) return false;
    setBusy(key);
    setError("");
    setMessage("");
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/moderation`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy("");
    if (!response.ok) {
      setError(result.error || "The moderation action could not be completed.");
      return false;
    }
    await load();
    return true;
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    const ok = await act(
      "report",
      { targetType, targetId: targetType === "other" ? null : targetId, category, reason, reporterNote },
      "report"
    );
    if (ok) {
      setReason("");
      setReporterNote("");
      if (!searchParams.get("targetId")) setTargetId("");
      setMessage("Your Room report was submitted for review.");
    }
  }

  const openCount = overview?.reports.filter((item) => ["open", "in_review", "escalated"].includes(item.status)).length ?? 0;

  return (
    <main className="rooms-live-shell min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Room safety</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text)]">{overview?.room.name || "Room moderation"}</h1>
              <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
                Report Room content privately. Room staff can review evidence, assign cases, escalate urgent concerns, and record a resolution.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium" href={`/rooms/${encodeURIComponent(roomId)}`}>
                Back to Room
              </Link>
              <button type="button" onClick={() => void load()} className="rounded-full border border-[var(--border)] p-2" aria-label="Refresh moderation">
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>
            </div>
          </div>
          {overview?.access.canModerate ? (
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              <span className="rounded-full border border-[var(--border)] px-3 py-1">{openCount} open</span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1">Role: {overview.access.role}</span>
            </div>
          ) : null}
        </header>

        {error ? <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">{error}</div> : null}
        {message ? <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</div> : null}

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <form onSubmit={submitReport} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Flag className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Submit a Room report</h2>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">
                What are you reporting?
                <select value={targetType} onChange={(event) => setTargetType(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  <option value="room_post">Discussion</option>
                  <option value="room_post_reply">Reply</option>
                  <option value="room_file">File</option>
                  <option value="room_member">Member</option>
                  <option value="other">General Room concern</option>
                </select>
              </label>
              {targetType !== "other" ? (
                <label className="block text-sm font-medium">
                  Target ID
                  <input required value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="Paste the item or member ID" className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2" />
                </label>
              ) : null}
              <label className="block text-sm font-medium">
                Category
                <select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2">
                  <option value="harassment">Harassment</option>
                  <option value="spam">Spam</option>
                  <option value="privacy">Privacy</option>
                  <option value="safety">Safety</option>
                  <option value="misinformation">Misinformation</option>
                  <option value="conduct">Room conduct</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-sm font-medium">
                Reason
                <textarea required value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2" />
              </label>
              <label className="block text-sm font-medium">
                Additional context
                <textarea value={reporterNote} onChange={(event) => setReporterNote(event.target.value)} maxLength={4000} rows={4} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2" />
              </label>
              <p className="text-xs text-[var(--muted)]">The report captures a private evidence snapshot visible only to authorized Room staff.</p>
              <button disabled={busy === "report" || loading} className="w-full rounded-xl bg-[var(--text)] px-4 py-3 text-sm font-semibold text-[var(--background)] disabled:opacity-50">
                {busy === "report" ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>

          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{overview?.access.canModerate ? "Moderation queue" : "My reports"}</h2>
              <span className="text-sm text-[var(--muted)]">{overview?.reports.length ?? 0} total</span>
            </div>
            {loading ? <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">Loading Room moderation…</div> : null}
            {!loading && overview?.reports.length === 0 ? <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">No Room reports yet.</div> : null}
            {overview?.reports.map((item) => (
              <article key={item.id} className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-semibold uppercase">{item.status.replace("_", " ")}</span>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs">{item.priority}</span>
                      <span className="rounded-full border border-[var(--border)] px-2.5 py-1 text-xs">{item.category}</span>
                    </div>
                    <h3 className="mt-3 font-semibold">{item.reason}</h3>
                    <p className="mt-1 text-xs text-[var(--muted)]">{item.target_type.replaceAll("_", " ")} {item.target_id ? `• ${item.target_id}` : ""}</p>
                  </div>
                  <time className="text-xs text-[var(--muted)]">{dateLabel(item.created_at)}</time>
                </div>

                {item.reporter_note ? <p className="mt-4 rounded-2xl bg-[var(--background)] p-3 text-sm">{item.reporter_note}</p> : null}
                {overview.access.canModerate ? (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-3 text-sm sm:grid-cols-3">
                      <div><span className="text-[var(--muted)]">Reporter</span><p className="font-medium">{profileName(item.reporterProfile)}</p></div>
                      <div><span className="text-[var(--muted)]">Assigned</span><p className="font-medium">{item.assigned_to ? profileName(item.assigneeProfile) : "Unassigned"}</p></div>
                      <div><span className="text-[var(--muted)]">Affected member</span><p className="font-medium">{item.affected_user_id ? profileName(item.affectedProfile) : "None"}</p></div>
                    </div>
                    <details className="rounded-2xl border border-[var(--border)] p-3">
                      <summary className="cursor-pointer text-sm font-semibold">Evidence snapshot</summary>
                      <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words text-xs text-[var(--muted)]">{JSON.stringify(item.evidence_snapshot || {}, null, 2)}</pre>
                    </details>
                    {["open", "in_review", "escalated"].includes(item.status) ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-[var(--border)] p-3">
                          <label className="text-sm font-medium">Assign moderator</label>
                          <select value={assignment[item.id] || item.assigned_to || ""} onChange={(event) => setAssignment((current) => ({ ...current, [item.id]: event.target.value }))} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                            <option value="">Choose staff</option>
                            {(overview.staff || []).filter((staff) => staff.status === "active").map((staff) => <option key={staff.userId} value={staff.userId}>{profileName(staff.profile)} · {staff.role}</option>)}
                          </select>
                          <button type="button" disabled={!assignment[item.id] || busy === `assign-${item.id}`} onClick={() => void act("assign", { itemId: item.id, assigneeId: assignment[item.id] }, `assign-${item.id}`)} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">
                            <UserCheck className="h-4 w-4" /> Assign
                          </button>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] p-3">
                          <label className="text-sm font-medium">Escalate priority</label>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {(["high", "urgent"] as const).map((priority) => (
                              <button key={priority} type="button" disabled={busy === `escalate-${item.id}`} onClick={() => void act("escalate", { itemId: item.id, priority }, `escalate-${item.id}`)} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold capitalize disabled:opacity-50">
                                <ArrowUpCircle className="h-4 w-4" /> {priority}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[var(--border)] p-3 md:col-span-2">
                          <label className="text-sm font-medium">Resolution note</label>
                          <textarea value={resolution[item.id] || ""} onChange={(event) => setResolution((current) => ({ ...current, [item.id]: event.target.value }))} rows={3} maxLength={2000} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm" />
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            <button type="button" disabled={!resolution[item.id] || busy === `resolve-${item.id}`} onClick={() => void act("resolve", { itemId: item.id, status: "resolved", note: resolution[item.id] }, `resolve-${item.id}`)} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--text)] px-3 py-2 text-sm font-semibold text-[var(--background)] disabled:opacity-50">
                              <CheckCircle2 className="h-4 w-4" /> Resolve
                            </button>
                            <button type="button" disabled={!resolution[item.id] || busy === `dismiss-${item.id}`} onClick={() => void act("resolve", { itemId: item.id, status: "dismissed", note: resolution[item.id] }, `dismiss-${item.id}`)} className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">
                              <XCircle className="h-4 w-4" /> Dismiss
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : item.resolution_note ? (
                      <div className="rounded-2xl border border-[var(--border)] p-3 text-sm"><strong>Resolution:</strong> {item.resolution_note}</div>
                    ) : null}
                  </div>
                ) : item.resolution_note ? (
                  <p className="mt-4 rounded-2xl border border-[var(--border)] p-3 text-sm"><strong>Resolution:</strong> {item.resolution_note}</p>
                ) : null}
              </article>
            ))}
          </section>
        </section>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          <div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><p>Use emergency services for immediate danger. Room reports are reviewed by Room staff and are not an emergency response channel.</p></div>
        </div>
      </div>
    </main>
  );
}
