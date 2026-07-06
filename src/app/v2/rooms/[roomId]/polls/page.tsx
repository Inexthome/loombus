"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, CheckCircle2, Plus, Trash2, Vote } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ShellMobileNav, V2ShellTopNav } from "../../../v2-shell-components";

type Row = Record<string, unknown>;
type LoadState = "checking" | "ready" | "signed_out" | "blocked" | "error";
type Room = { id: string; name: string; ownerId: string; createdBy: string };
type Member = { userId: string; role: string };
type Poll = { id: string; roomId: string; title: string; description: string; options: string[]; status: string; createdBy: string; createdAt: string | null };
type PollVote = { id: string; pollId: string; voterId: string; optionIndex: number };

const REQUEST_TIMEOUT_MS = 8000;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.parseInt(String(value ?? ""), 10) || 0;
}

function decodeOptions(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((option) => asString(option)).filter(Boolean).slice(0, 10);
}

function normalizeRoom(row: Row | null): Room | null {
  if (!row) return null;
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Private room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizeMember(row: Row): Member {
  return { userId: asString(row.user_id), role: asString(row.role) || "member" };
}

function normalizePoll(row: Row): Poll {
  return {
    id: asString(row.id),
    roomId: asString(row.room_id),
    title: asString(row.title) || "Untitled poll",
    description: asString(row.description),
    options: decodeOptions(row.options),
    status: asString(row.status) || "open",
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeVote(row: Row): PollVote {
  return {
    id: asString(row.id),
    pollId: asString(row.poll_id),
    voterId: asString(row.voter_id),
    optionIndex: asNumber(row.option_index),
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message?: unknown }).message ?? "");
  return "Unknown poll loading error";
}

function getDateLabel(value: string | null) {
  if (!value) return "Recently";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(date);
}

function getPercent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

async function withTimeout<T>(promise: PromiseLike<T>, label: string): Promise<T> {
  let timeoutId: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export default function V2RoomPollsPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] ?? "" : rawRoomId ?? ""), [rawRoomId]);

  const [loadState, setLoadState] = useState<LoadState>("checking");
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [votes, setVotes] = useState<PollVote[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Loading poll data...");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [optionFields, setOptionFields] = useState(["", ""]);

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const canManage = Boolean(isOwner || currentMember?.role === "owner" || currentMember?.role === "admin");
  const openPolls = polls.filter((poll) => poll.status === "open");
  const closedPolls = polls.filter((poll) => poll.status === "closed");

  async function loadPolls() {
    if (!roomId) {
      setLoadState("error");
      setMessage("Loombus could not find the room ID for this poll list.");
      return;
    }

    setLoadState("checking");
    setMessage("Loading poll data...");

    try {
      const { data: sessionData } = await withTimeout(supabase.auth.getSession(), "session check");
      const nextUserId = sessionData.session?.user.id ?? null;
      setUserId(nextUserId);

      if (!nextUserId) {
        setLoadState("signed_out");
        setMessage("Sign in first so Loombus can open this room decision center.");
        setRoom(null);
        setMembers([]);
        setPolls([]);
        setVotes([]);
        return;
      }

      const { data: roomData, error: roomError } = await withTimeout(supabase.from("rooms").select("*").eq("id", roomId).maybeSingle(), "room lookup");
      if (roomError) throw roomError;

      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      if (!nextRoom) {
        setLoadState("blocked");
        setMessage("Room Polls / Decisions are only available to approved room members.");
        return;
      }

      const { data: memberData, error: memberError } = await withTimeout(supabase.from("room_members").select("*").eq("room_id", roomId), "member lookup");
      if (memberError) throw memberError;

      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      const nextMember = nextMembers.find((member) => member.userId === nextUserId);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextCanAccess = Boolean(nextIsOwner || nextMember);

      setRoom(nextRoom);
      setMembers(nextMembers);

      if (!nextCanAccess) {
        setLoadState("blocked");
        setMessage("Room Polls / Decisions are only available to approved room members.");
        setPolls([]);
        setVotes([]);
        return;
      }

      const [{ data: pollData, error: pollError }, { data: voteData, error: voteError }] = await Promise.all([
        withTimeout(supabase.from("room_polls").select("*").eq("room_id", roomId).order("updated_at", { ascending: false }).limit(100), "poll lookup"),
        withTimeout(supabase.from("room_poll_votes").select("*").eq("room_id", roomId), "vote lookup"),
      ]);

      if (pollError) throw pollError;
      if (voteError) throw voteError;

      setPolls(((pollData ?? []) as Row[]).map(normalizePoll).filter((poll) => poll.id));
      setVotes(((voteData ?? []) as Row[]).map(normalizeVote).filter((vote) => vote.id));
      setLoadState("ready");
      setMessage("");
    } catch (error) {
      setRoom(null);
      setMembers([]);
      setPolls([]);
      setVotes([]);
      setLoadState("error");
      setMessage(`Loombus could not load room polls. Details: ${getErrorMessage(error)}`);
    }
  }

  useEffect(() => {
    void loadPolls();
  }, [roomId]);

  async function handleCreatePoll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canManage || !title.trim()) return;
    const options = optionFields.map((option) => option.trim()).filter(Boolean).slice(0, 10);
    if (options.length < 2) {
      setMessage("Add at least two poll options.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_polls").insert({
        room_id: room.id,
        title: title.trim(),
        description: description.trim(),
        options,
        status: "open",
        created_by: userId,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;
      setTitle("");
      setDescription("");
      setOptionFields(["", ""]);
      setMessage("Poll created.");
      await loadPolls();
    } catch (error) {
      setMessage(`Loombus could not create this poll yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleVote(poll: Poll, optionIndex: number) {
    if (!userId || poll.status !== "open") return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_poll_votes").upsert(
        {
          poll_id: poll.id,
          room_id: poll.roomId,
          voter_id: userId,
          option_index: optionIndex,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "poll_id,voter_id" },
      );

      if (error) throw error;
      await loadPolls();
    } catch (error) {
      setMessage(`Loombus could not save this vote yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(poll: Poll, nextStatus: "open" | "closed") {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_polls")
        .update({ status: nextStatus, closed_at: nextStatus === "closed" ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
        .eq("id", poll.id);
      if (error) throw error;
      await loadPolls();
    } catch (error) {
      setMessage(`Loombus could not update this poll yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeletePoll(poll: Poll) {
    if (!canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_polls").delete().eq("id", poll.id);
      if (error) throw error;
      setMessage("Poll removed.");
      await loadPolls();
    } catch (error) {
      setMessage(`Loombus could not remove this poll yet. Details: ${getErrorMessage(error)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to room
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Room Polls / Decisions</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room?.name ?? "Room decision center"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>Create polls, collect member votes, and record room decisions.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{openPolls.length} open</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{closedPolls.length} closed</span>
              <span className="rounded-full bg-white/15 px-3 py-1 text-white ring-1 ring-white/25" style={{ color: "#ffffff" }}>{votes.length} votes</span>
            </div>
          </div>

          {loadState !== "ready" && (
            <div className="p-6">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Vote className="mx-auto size-9 text-amber-700" />
                <h2 className="mt-3 text-lg font-black text-slate-950">{loadState === "checking" ? "Checking room decision access" : loadState === "signed_out" ? "Sign in required" : loadState === "blocked" ? "Polls are private" : "Polls could not load"}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
                <button type="button" onClick={() => loadPolls()} className="mt-5 inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800">Retry</button>
              </div>
            </div>
          )}

          {loadState === "ready" && (
            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-4">
                {polls.map((poll) => {
                  const pollVotes = votes.filter((voteItem) => voteItem.pollId === poll.id);
                  const totalVotes = pollVotes.length;
                  const myVote = pollVotes.find((voteItem) => voteItem.voterId === userId);

                  return (
                    <article key={poll.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1 ${poll.status === "open" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-slate-200"}`}>{poll.status}</span>
                          <h2 className="mt-3 text-xl font-black text-slate-950">{poll.title}</h2>
                          {poll.description && <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{poll.description}</p>}
                          <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{totalVotes} votes · Created {getDateLabel(poll.createdAt)}</p>
                        </div>
                        {canManage && (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" disabled={saving} onClick={() => handleStatus(poll, poll.status === "open" ? "closed" : "open")} className="rounded-2xl bg-slate-950 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50">{poll.status === "open" ? "Close" : "Reopen"}</button>
                            <button type="button" disabled={saving} onClick={() => handleDeletePoll(poll)} className="inline-flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 disabled:opacity-50"><Trash2 className="size-3" /> Remove</button>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 space-y-3">
                        {poll.options.map((option, index) => {
                          const count = pollVotes.filter((voteItem) => voteItem.optionIndex === index).length;
                          const percent = getPercent(count, totalVotes);
                          const selected = myVote?.optionIndex === index;

                          return (
                            <button key={`${poll.id}-${option}-${index}`} type="button" disabled={saving || poll.status !== "open"} onClick={() => handleVote(poll, index)} className={`w-full rounded-2xl border p-4 text-left transition disabled:cursor-not-allowed ${selected ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50 hover:border-amber-200 hover:bg-amber-50/60"}`}>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm font-black text-slate-950">{option}</span>
                                <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{count} · {percent}%</span>
                              </div>
                              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
                                <div className="h-full rounded-full bg-amber-500" style={{ width: `${percent}%` }} />
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}

                {polls.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <BarChart3 className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No polls yet</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">Owners and admins can create polls. Approved members can vote and view results.</p>
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                {canManage && (
                  <form onSubmit={handleCreatePoll} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Create poll</h2>
                      <Plus className="size-4 text-amber-700" />
                    </div>
                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="poll-title">Title</label>
                    <input id="poll-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Should we approve this decision?" />

                    <label className="mt-4 block text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="poll-description">Description</label>
                    <textarea id="poll-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={4000} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder="Add context for members" />

                    <div className="mt-4 space-y-3">
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Options</p>
                      {optionFields.map((option, index) => (
                        <input key={index} value={option} onChange={(event) => setOptionFields((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))} maxLength={120} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" placeholder={`Option ${index + 1}`} />
                      ))}
                      {optionFields.length < 10 && <button type="button" onClick={() => setOptionFields((current) => [...current, ""])} className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">+ Add option</button>}
                    </div>

                    <button type="submit" disabled={saving || !title.trim()} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> Create poll
                    </button>
                  </form>
                )}

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Decision summary</h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Open polls</dt><dd className="font-black text-slate-900">{openPolls.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Closed polls</dt><dd className="font-black text-slate-900">{closedPolls.length}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Total votes</dt><dd className="font-black text-slate-900">{votes.length}</dd></div>
                  </dl>
                </section>
              </aside>
            </div>
          )}
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
