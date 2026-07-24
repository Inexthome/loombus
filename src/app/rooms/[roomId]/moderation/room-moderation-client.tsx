"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Flag, Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Profile = { id: string; username: string | null; full_name: string | null } | null;
type Reply = { id: string; body: string; authorId: string };
type Thread = { id: string; title: string; body: string; replies: Reply[] };
type DiscussionResponse = { room?: { name?: string }; posts?: Thread[]; error?: string };
type Staff = { userId: string; role: string; profile: Profile };
type ModerationItem = {
  id: string;
  status: string;
  category: string | null;
  priority: string;
  reason: string;
  target_type: string;
  target_id: string | null;
  reported_by: string | null;
  assigned_to: string | null;
  report_count: number;
  resolution_note: string | null;
  resolution_action: string | null;
  escalated_at: string | null;
  created_at: string;
  evidence_snapshot: Record<string, unknown>;
  reporter: Profile;
  assignee: Profile;
};
type ModerationResponse = {
  room?: { id: string; name: string };
  access?: { canModerate: boolean };
  staff?: Staff[];
  items?: ModerationItem[];
  error?: string;
};

const CATEGORIES = [
  ["harassment", "Harassment"],
  ["hate", "Hate or discrimination"],
  ["threat", "Threat or immediate danger"],
  ["spam", "Spam"],
  ["privacy", "Privacy violation"],
  ["misinformation", "Misinformation"],
  ["unsafe_content", "Unsafe content"],
  ["impersonation", "Impersonation"],
  ["other", "Other"],
] as const;

function profileName(profile: Profile) {
  return profile?.full_name || profile?.username || "Room member";
}

function evidenceText(item: ModerationItem) {
  const evidence = item.evidence_snapshot || {};
  return {
    title: typeof evidence.title === "string" ? evidence.title : "Room content",
    body: typeof evidence.body === "string" ? evidence.body : "No snapshot text available.",
  };
}

export default function RoomModerationClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [moderation, setModeration] = useState<ModerationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [target, setTarget] = useState("");
  const [category, setCategory] = useState("other");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before opening Room moderation.");
      const headers = { Authorization: `Bearer ${token}` };
      const [discussionResponse, moderationResponse] = await Promise.all([
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/discussions`, { headers, cache: "no-store" }),
        fetch(`/api/rooms/${encodeURIComponent(roomId)}/moderation`, { headers, cache: "no-store" }),
      ]);
      const discussions = (await discussionResponse.json().catch(() => ({}))) as DiscussionResponse;
      if (!discussionResponse.ok) throw new Error(discussions.error || "Room content could not be loaded.");
      setThreads(discussions.posts ?? []);
      if (moderationResponse.ok) {
        setModeration((await moderationResponse.json()) as ModerationResponse);
      } else if (moderationResponse.status === 403) {
        setModeration({ access: { canModerate: false }, room: { id: roomId, name: discussions.room?.name || "Room" } });
      } else {
        const result = (await moderationResponse.json().catch(() => ({}))) as ModerationResponse;
        throw new Error(result.error || "Room moderation could not be loaded.");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Room moderation could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submit(action: string, payload: Record<string, unknown>, key: string, success: string) {
    if (!roomId || working) return false;
    setWorking(key);
    setMessage("");
    setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again before continuing.");
      const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/moderation`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The moderation action failed.");
      setMessage(success);
      await load();
      return true;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The moderation action failed.");
      return false;
    } finally {
      setWorking("");
    }
  }

  const reportTargets = threads.flatMap((thread) => [
    { value: `room_post:${thread.id}`, label: `Discussion: ${thread.title}` },
    ...(thread.replies ?? []).map((reply) => ({
      value: `room_post_reply:${reply.id}`,
      label: `Reply in ${thread.title}: ${reply.body.slice(0, 90)}`,
    })),
  ]);

  async function report() {
    const [targetType, targetId] = target.split(":");
    const completed = await submit(
      "report",
      { targetType, targetId, category, reason },
      "report",
      "Your report was submitted to Room moderation."
    );
    if (completed) {
      setTarget("");
      setCategory("other");
      setReason("");
    }
  }

  if (loading) {
    return <div className="mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center gap-3 text-sm font-bold text-[var(--loombus-text-muted)]"><Loader2 className="size-5 animate-spin" />Loading Room moderation…</div>;
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-[#9a701c] dark:text-[#d6a84f]">Room safety</p>
            <h1 className="mt-2 text-2xl font-black text-[var(--loombus-text)]">Moderation center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">Report Room discussions and replies. Room staff can review captured evidence, assign cases, escalate urgent concerns, and record the resolution.</p>
          </div>
          <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-[var(--loombus-text)]">Back to Room</Link>
        </div>
      </header>

      {message ? <div className="rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div> : null}
      {error ? <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">{error}</div> : null}

      <section className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Flag className="mt-1 size-5 text-[#9a701c] dark:text-[#d6a84f]" />
          <div>
            <h2 className="text-lg font-black text-[var(--loombus-text)]">Report Room content</h2>
            <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">Only content you are authorized to view appears here. The report preserves a review snapshot even if the original content is later removed.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-sm font-black text-[var(--loombus-text)]">Content
            <select value={target} onChange={(event) => setTarget(event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 font-medium text-[var(--loombus-text)]">
              <option value="">Choose a discussion or reply</option>
              {reportTargets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[var(--loombus-text)]">Category
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-12 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 font-medium text-[var(--loombus-text)]">
              {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-black text-[var(--loombus-text)]">What should moderators review?
            <textarea value={reason} onChange={(event) => setReason(event.target.value.slice(0, 1000))} rows={4} maxLength={1000} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 font-medium leading-6 text-[var(--loombus-text)]" placeholder="Describe the concern and any immediate safety context." />
          </label>
          <button type="button" onClick={() => void report()} disabled={!target || reason.trim().length < 10 || working === "report"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#d6a84f] px-5 text-sm font-black text-black disabled:opacity-50">
            {working === "report" ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}Submit report
          </button>
        </div>
      </section>

      {moderation?.access?.canModerate ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3"><ShieldCheck className="size-6 text-[#9a701c] dark:text-[#d6a84f]" /><div><h2 className="text-xl font-black text-[var(--loombus-text)]">Staff moderation queue</h2><p className="text-sm text-[var(--loombus-text-muted)]">Open and reviewing cases appear first. Evidence is the snapshot captured when the report was submitted.</p></div></div>
          {(moderation.items ?? []).length ? (moderation.items ?? []).map((item) => {
            const evidence = evidenceText(item);
            const closed = item.status === "resolved" || item.status === "dismissed";
            return <article key={item.id} className="rounded-[1.75rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div><div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.08em]"><span className="rounded-full bg-amber-100 px-3 py-1 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">{item.status}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-[var(--loombus-text-muted)]">{item.priority}</span><span className="rounded-full border border-[var(--loombus-border)] px-3 py-1 text-[var(--loombus-text-muted)]">{item.category || "other"}</span></div><h3 className="mt-3 text-lg font-black text-[var(--loombus-text)]">{evidence.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text)]">{evidence.body}</p><p className="mt-3 text-sm font-bold text-[var(--loombus-text-muted)]">Report: {item.reason}</p><p className="mt-2 text-xs text-[var(--loombus-text-subtle)]">Reported by {profileName(item.reporter)} · {item.report_count || 1} submission{item.report_count === 1 ? "" : "s"}</p></div>
                <AlertTriangle className={item.priority === "urgent" ? "size-6 text-red-600" : "size-6 text-amber-500"} />
              </div>
              {!closed ? <div className="mt-5 grid gap-3 border-t border-[var(--loombus-border)] pt-5">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button type="button" onClick={() => void submit("claim", { itemId: item.id }, `claim:${item.id}`, "Moderation case claimed.")} disabled={Boolean(working)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black text-[var(--loombus-text)]"><UserCheck className="size-4" />Claim</button>
                  <select value={assignments[item.id] ?? item.assigned_to ?? ""} onChange={(event) => setAssignments((current) => ({ ...current, [item.id]: event.target.value }))} className="min-h-10 flex-1 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 text-sm text-[var(--loombus-text)]"><option value="">Assign moderator</option>{(moderation.staff ?? []).map((staff) => <option key={staff.userId} value={staff.userId}>{profileName(staff.profile)} · {staff.role}</option>)}</select>
                  <button type="button" onClick={() => void submit("assign", { itemId: item.id, assignedTo: assignments[item.id] ?? item.assigned_to }, `assign:${item.id}`, "Moderation case assigned.")} disabled={Boolean(working) || !(assignments[item.id] ?? item.assigned_to)} className="min-h-10 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black text-[var(--loombus-text)] disabled:opacity-50">Assign</button>
                  <button type="button" onClick={() => void submit("escalate", { itemId: item.id }, `escalate:${item.id}`, "Moderation case escalated.")} disabled={Boolean(working)} className="min-h-10 rounded-full border border-red-200 px-4 text-xs font-black text-red-700 dark:border-red-900/60 dark:text-red-300">Escalate</button>
                </div>
                <textarea value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value.slice(0, 1000) }))} rows={3} maxLength={1000} placeholder="Resolution note" className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] px-4 py-3 text-sm text-[var(--loombus-text)]" />
                <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void submit("resolve", { itemId: item.id, note: notes[item.id], resolutionAction: "none" }, `resolve:${item.id}`, "Moderation case resolved and reporter notified.")} disabled={Boolean(working)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[#d6a84f] px-4 text-xs font-black text-black"><CheckCircle2 className="size-4" />Resolve</button><button type="button" onClick={() => void submit("dismiss", { itemId: item.id, note: notes[item.id], resolutionAction: "none" }, `dismiss:${item.id}`, "Moderation case dismissed and reporter notified.")} disabled={Boolean(working)} className="min-h-10 rounded-full border border-[var(--loombus-border)] px-4 text-xs font-black text-[var(--loombus-text)]">Dismiss</button></div>
              </div> : <div className="mt-4 rounded-2xl bg-[var(--loombus-page-bg)] px-4 py-3 text-sm text-[var(--loombus-text-muted)]">{item.resolution_note || "Case closed without an additional note."}</div>}
            </article>;
          }) : <div className="rounded-[1.75rem] border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-10 text-center text-sm text-[var(--loombus-text-muted)]">No Room moderation cases have been submitted.</div>}
        </section>
      ) : null}
    </main>
  );
}
