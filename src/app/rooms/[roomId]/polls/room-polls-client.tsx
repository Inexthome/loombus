"use client";

import Link from "next/link";
import { ArrowLeft, BarChart3, CheckCircle2, Loader2, Plus, RefreshCw, Vote } from "lucide-react";
import { useParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type PollOption = { id: string; label: string; position: number; voteCount: number | null };
type Poll = {
  id: string; title: string; description: string | null; pollType: string; eligibility: string;
  anonymousVoting: boolean; showLiveResults: boolean; allowVoteChanges: boolean; maxChoices: number;
  opensAt: string; closesAt: string | null; status: string; options: PollOption[]; turnout: number | null;
  hasVoted: boolean; myChoiceIds: string[]; canVote: boolean; canManage: boolean; resultsVisible: boolean;
};
type Payload = {
  migrationRequired?: boolean; message?: string; room?: { id: string; name: string };
  access?: { role: string | null; canManage: boolean; canModerate: boolean }; polls?: Poll[]; error?: string;
};
type Draft = {
  title: string; description: string; pollType: string; eligibility: string; options: string;
  maxChoices: number; opensAt: string; closesAt: string; anonymousVoting: boolean;
  showLiveResults: boolean; allowVoteChanges: boolean; notifyMembers: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "", description: "", pollType: "single", eligibility: "members", options: "",
  maxChoices: 2, opensAt: "", closesAt: "", anonymousVoting: false,
  showLiveResults: true, allowVoteChanges: false, notifyMembers: true,
};

async function token() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

function dateTime(value: string | null) {
  if (!value) return "No deadline";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(parsed)
    : value;
}

export default function RoomPollsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState(false);

  const request = useCallback(async (init?: RequestInit) => {
    const accessToken = await token();
    if (!accessToken) throw new Error("Sign in again before continuing.");
    const response = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/polls`, {
      ...init,
      headers: { Authorization: `Bearer ${accessToken}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Room Polls could not complete this request.");
    return result as Payload;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true); setNotice(""); setError(false);
    try { setPayload(await request()); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Room Polls could not load."); setError(true); }
    finally { setLoading(false); }
  }, [request, roomId]);

  useEffect(() => { void load(); }, [load]);

  async function createPoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (working) return;
    setWorking("create"); setNotice(""); setError(false);
    try {
      const options = draft.options.split("\n").map((value) => value.trim()).filter(Boolean);
      await request({ method: "POST", body: JSON.stringify({ action: "create", ...draft, options, opensAt: draft.opensAt ? new Date(draft.opensAt).toISOString() : new Date().toISOString(), closesAt: draft.closesAt ? new Date(draft.closesAt).toISOString() : null }) });
      setDraft(EMPTY_DRAFT); setNotice("Poll created."); await load();
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Poll creation failed."); setError(true); }
    finally { setWorking(""); }
  }

  function toggleChoice(poll: Poll, optionId: string) {
    setSelections((current) => {
      const selected = current[poll.id] ?? poll.myChoiceIds;
      if (poll.maxChoices === 1) return { ...current, [poll.id]: [optionId] };
      const next = selected.includes(optionId) ? selected.filter((id) => id !== optionId) : [...selected, optionId].slice(0, poll.maxChoices);
      return { ...current, [poll.id]: next };
    });
  }

  async function action(body: Record<string, unknown>, success: string, key: string) {
    if (working) return;
    setWorking(key); setNotice(""); setError(false);
    try { await request({ method: "POST", body: JSON.stringify(body) }); setNotice(success); await load(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Poll update failed."); setError(true); }
    finally { setWorking(""); }
  }

  return (
    <main className="rooms-live-page min-h-screen px-4 py-6 sm:px-6">
      <div className="rooms-live-shell mx-auto max-w-6xl space-y-6">
        <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rooms-live-back-link !min-h-11"><ArrowLeft aria-hidden="true" /> Back to Room</Link>
        <header className="room-workspace-hero">
          <div><div className="room-workspace-badges"><span><Vote aria-hidden="true" /> Private Room voting</span></div><h1>{payload?.room?.name ? `${payload.room.name} polls` : "Room Polls"}</h1><p>Open structured votes, collect eligible member ballots, and publish trusted results.</p></div>
          <button type="button" onClick={() => void load()} disabled={loading} className="rooms-live-secondary-action !min-h-11"><RefreshCw aria-hidden="true" className={loading ? "is-spinning" : undefined} /> Refresh</button>
        </header>

        {notice ? <div role={error ? "alert" : "status"} className={`room-expansion-notice${error ? " is-error" : ""}`}>{notice}</div> : null}
        {payload?.migrationRequired ? <section className="room-resources-empty"><h2>Polls are not active yet</h2><p>{payload.message}</p></section> : null}

        {payload?.access?.canManage && !payload.migrationRequired ? (
          <form className="room-expansion-form" onSubmit={createPoll}>
            <div className="room-expansion-section-heading"><div><h2>Create a poll</h2><p>Configure eligibility, ballot rules, result visibility, and the voting window.</p></div><Plus aria-hidden="true" /></div>
            <div className="room-expansion-form-grid">
              <label><span>Poll title</span><input required minLength={3} maxLength={240} value={draft.title} onChange={(e) => setDraft((c) => ({ ...c, title: e.target.value }))} /></label>
              <label><span>Poll type</span><select value={draft.pollType} onChange={(e) => setDraft((c) => ({ ...c, pollType: e.target.value }))}><option value="single">Single choice</option><option value="multiple">Multiple choice</option><option value="yes_no">Yes / No</option><option value="approval">Approval voting</option></select></label>
              <label><span>Eligible voters</span><select value={draft.eligibility} onChange={(e) => setDraft((c) => ({ ...c, eligibility: e.target.value }))}><option value="members">All active members</option><option value="board">Board and moderators</option><option value="managers">Owners and administrators</option></select></label>
              <label><span>Maximum choices</span><input type="number" min={1} max={20} disabled={draft.pollType === "single" || draft.pollType === "yes_no"} value={draft.pollType === "single" || draft.pollType === "yes_no" ? 1 : draft.maxChoices} onChange={(e) => setDraft((c) => ({ ...c, maxChoices: Number(e.target.value) }))} /></label>
              <label><span>Opens</span><input type="datetime-local" value={draft.opensAt} onChange={(e) => setDraft((c) => ({ ...c, opensAt: e.target.value }))} /></label>
              <label><span>Closes</span><input type="datetime-local" value={draft.closesAt} onChange={(e) => setDraft((c) => ({ ...c, closesAt: e.target.value }))} /></label>
            </div>
            <label><span>Description</span><textarea rows={3} maxLength={8000} value={draft.description} onChange={(e) => setDraft((c) => ({ ...c, description: e.target.value }))} /></label>
            {draft.pollType !== "yes_no" ? <label><span>Options, one per line</span><textarea required rows={5} placeholder={'Option one\nOption two'} value={draft.options} onChange={(e) => setDraft((c) => ({ ...c, options: e.target.value }))} /></label> : null}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.anonymousVoting} onChange={(e) => setDraft((c) => ({ ...c, anonymousVoting: e.target.checked }))} /> Anonymous ballots</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.showLiveResults} onChange={(e) => setDraft((c) => ({ ...c, showLiveResults: e.target.checked }))} /> Show live results</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.allowVoteChanges} onChange={(e) => setDraft((c) => ({ ...c, allowVoteChanges: e.target.checked }))} /> Allow vote changes</label>
              <label className="inline-flex items-center gap-2"><input type="checkbox" checked={draft.notifyMembers} onChange={(e) => setDraft((c) => ({ ...c, notifyMembers: e.target.checked }))} /> Notify eligible members</label>
            </div>
            <button type="submit" className="rooms-live-primary-action !min-h-11" disabled={working === "create"}>{working === "create" ? <Loader2 className="is-spinning" aria-hidden="true" /> : <Vote aria-hidden="true" />} {working === "create" ? "Creating…" : "Open poll"}</button>
          </form>
        ) : null}

        {!payload?.migrationRequired ? <section className="space-y-4">
          {(payload?.polls ?? []).length === 0 && !loading ? <div className="room-resources-empty"><h2>No Room polls yet</h2><p>Room management can open the first vote when a decision needs member input.</p></div> : null}
          {(payload?.polls ?? []).map((poll) => {
            const selected = selections[poll.id] ?? poll.myChoiceIds;
            const totalVotes = poll.options.reduce((sum, option) => sum + (option.voteCount ?? 0), 0);
            return <article key={poll.id} className="room-expansion-form space-y-4">
              <div className="room-expansion-section-heading"><div><div className="room-workspace-badges"><span>{poll.status}</span><span>{poll.eligibility}</span>{poll.anonymousVoting ? <span>anonymous</span> : null}</div><h2>{poll.title}</h2>{poll.description ? <p>{poll.description}</p> : null}</div><BarChart3 aria-hidden="true" /></div>
              <p className="room-resources-item-meta">Opens {dateTime(poll.opensAt)} · Closes {dateTime(poll.closesAt)}{poll.turnout !== null ? ` · ${poll.turnout} ballot${poll.turnout === 1 ? "" : "s"}` : ""}</p>
              <div className="space-y-3">{poll.options.map((option) => {
                const checked = selected.includes(option.id);
                const percent = poll.resultsVisible && totalVotes > 0 ? Math.round(((option.voteCount ?? 0) / totalVotes) * 100) : 0;
                return <label key={option.id} className="block rounded-xl border p-4">
                  <div className="flex items-center gap-3"><input type={poll.maxChoices === 1 ? "radio" : "checkbox"} name={`poll-${poll.id}`} checked={checked} disabled={!poll.canVote} onChange={() => toggleChoice(poll, option.id)} /><span className="font-medium">{option.label}</span>{poll.resultsVisible ? <span className="ml-auto text-sm">{option.voteCount ?? 0} · {percent}%</span> : null}</div>
                  {poll.resultsVisible ? <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full bg-current opacity-40" style={{ width: `${percent}%` }} /></div> : null}
                </label>;
              })}</div>
              {!poll.resultsVisible ? <p className="room-resources-item-meta">Results are hidden until this poll closes.</p> : null}
              <div className="flex flex-wrap gap-2">
                {poll.canVote ? <button type="button" className="rooms-live-primary-action !min-h-11" disabled={!selected.length || working === `vote-${poll.id}`} onClick={() => void action({ action: "vote", pollId: poll.id, choiceIds: selected }, poll.hasVoted ? "Vote updated." : "Vote submitted.", `vote-${poll.id}`)}>{working === `vote-${poll.id}` ? <Loader2 className="is-spinning" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{poll.hasVoted ? "Update vote" : "Submit vote"}</button> : null}
                {poll.canManage && poll.status === "open" ? <button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void action({ action: "close", pollId: poll.id }, "Poll closed.", `close-${poll.id}`)}>Close poll</button> : null}
                {poll.canManage && poll.status !== "cancelled" && poll.status !== "closed" ? <button type="button" className="rooms-live-secondary-action !min-h-11" onClick={() => void action({ action: "cancel", pollId: poll.id }, "Poll cancelled.", `cancel-${poll.id}`)}>Cancel</button> : null}
              </div>
            </article>;
          })}
        </section> : null}
        {loading && !payload ? <div className="room-expansion-loading" role="status"><Loader2 className="is-spinning" aria-hidden="true" /> Loading Room polls…</div> : null}
      </div>
    </main>
  );
}
