"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardList, Clock, LifeBuoy, Send } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type RoomSummary = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdBy: string;
  isPrivate: boolean;
};

type RoomMember = {
  userId: string;
  role: string;
};

type RoomRequest = {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  createdBy: string;
  createdAt: string | null;
  updatedAt: string | null;
};

const REQUEST_STATUSES = ["open", "in_progress", "resolved", "closed"] as const;
const REQUEST_CATEGORIES = ["general", "maintenance", "help", "service", "other"] as const;

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function normalizeRoom(row: Row): RoomSummary {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || "Private room requests.",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private",
  };
}

function normalizeMember(row: Row): RoomMember {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeRequest(row: Row, index: number): RoomRequest {
  return {
    id: asString(row.id) || `request-${index}`,
    title: asString(row.title) || "Untitled request",
    body: asString(row.body) || "Request details",
    category: asString(row.category) || "general",
    status: asString(row.status) || "open",
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
    updatedAt: asString(row.updated_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function getStatusClass(status: string) {
  if (status === "resolved") return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  if (status === "in_progress") return "bg-amber-50 text-amber-700 ring-amber-100";
  if (status === "closed") return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-blue-50 text-blue-700 ring-blue-100";
}

export default function V2RoomRequestsPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomSummary | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [requests, setRequests] = useState<RoomRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [requestTitle, setRequestTitle] = useState("");
  const [requestBody, setRequestBody] = useState("");
  const [requestCategory, setRequestCategory] = useState("general");

  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const currentMember = members.find((member) => member.userId === userId);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";
  const canManage = isOwner || isAdmin;
  const canCreate = Boolean(room && userId && (isOwner || currentMember));
  const openCount = requests.filter((request) => request.status === "open").length;
  const activeCount = requests.filter((request) => request.status === "open" || request.status === "in_progress").length;

  async function loadRequests() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        setRequests([]);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setRequests([]);
        setMessage("This room is private or unavailable to your account.");
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId);
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) {
        setRequests([]);
        setMessage("This private room requires membership before requests are visible.");
        return;
      }

      const { data: requestData, error: requestError } = await supabase
        .from("room_requests")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(100);
      setRequests(requestError ? [] : ((requestData ?? []) as Row[]).map(normalizeRequest));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load room requests right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRequests();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  async function handleCreateRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canCreate || !requestTitle.trim() || !requestBody.trim()) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("room_requests").insert({
        room_id: room.id,
        title: requestTitle.trim(),
        body: requestBody.trim(),
        category: requestCategory,
        status: "open",
        created_by: userId,
        updated_by: userId,
      });
      if (error) throw error;
      setRequestTitle("");
      setRequestBody("");
      setRequestCategory("general");
      setMessage("Room request submitted.");
      await loadRequests();
    } catch {
      setMessage("Loombus could not submit this request yet. Confirm the room_requests migration and RLS policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusUpdate(request: RoomRequest, status: string) {
    if (!userId || !canManage) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase
        .from("room_requests")
        .update({ status, updated_by: userId, updated_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;
      setMessage("Room request updated.");
      await loadRequests();
    } catch {
      setMessage("Loombus could not update this request yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening requests" message="Loombus is loading this room request center." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" />
          Back to room
        </Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Request Center</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name ?? "Room requests"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Submit and track room needs without burying them inside discussions.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{requests.length} total</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{openCount} open</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{activeCount} active</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Owner/admin tools" : "Member view"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-5">
              {canCreate ? (
                <form onSubmit={handleCreateRequest} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <LifeBuoy className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Submit request</h2>
                      <p className="mt-1 text-sm text-slate-600">Use this for maintenance, help, service needs, or general room follow-up.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                    <input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="Request title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <select value={requestCategory} onChange={(event) => setRequestCategory(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {REQUEST_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <textarea value={requestBody} onChange={(event) => setRequestBody(event.target.value)} placeholder="Describe what is needed" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" disabled={saving || !requestTitle.trim() || !requestBody.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <Send className="size-4" />
                      Submit request
                    </button>
                  </div>
                </form>
              ) : (
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Membership required</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">Only approved room members can submit requests.</p>
                </section>
              )}

              <section className="space-y-3">
                {requests.map((request) => (
                  <article key={request.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${getStatusClass(request.status)}`}>{request.status.replace(/_/g, " ")}</span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{request.category}</span>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-slate-950">{request.title}</h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{request.body}</p>
                        <p className="mt-3 text-xs font-semibold text-slate-400">Submitted {formatRelativeTime(request.createdAt)}</p>
                      </div>
                    </div>
                    {canManage && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {REQUEST_STATUSES.map((status) => (
                          <button key={status} type="button" onClick={() => handleStatusUpdate(request, status)} disabled={saving || request.status === status} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
                            <CheckCircle2 className="size-3" />
                            {status.replace(/_/g, " ")}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {requests.length === 0 && (
                  <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center">
                    <ClipboardList className="mx-auto size-9 text-amber-700" />
                    <h2 className="mt-3 text-lg font-black text-slate-950">No room requests yet</h2>
                    <p className="mt-2 text-sm text-slate-600">Create the first request so the owner or admin can track it.</p>
                  </div>
                )}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Status</h2><Clock className="size-4 text-amber-700" /></div>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Open</dt><dd className="font-black text-slate-900">{openCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Active</dt><dd className="font-black text-slate-900">{activeCount}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Total</dt><dd className="font-black text-slate-900">{requests.length}</dd></div>
                </dl>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">How to use</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Requests are for tracked action items. Use discussions for conversation, announcements for broad updates, and requests for things that need a status.</p>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
