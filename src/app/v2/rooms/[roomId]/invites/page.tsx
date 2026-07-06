"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, CheckCircle2, MailPlus, ShieldCheck, UserCheck, UserPlus, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type Row = Record<string, unknown>;

type Room = {
  id: string;
  name: string;
  ownerId: string;
  createdBy: string;
};

type Member = {
  userId: string;
  role: string;
};

type JoinRequest = {
  id: string;
  requesterUserId: string;
  requesterContact: string;
  requesterNote: string;
  status: string;
  createdAt: string | null;
};

type RoomInvite = {
  id: string;
  invitedEmail: string;
  invitedUserId: string;
  inviteNote: string;
  status: string;
  createdAt: string | null;
};

type Preferences = {
  joinRule: string;
  roomStatus: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeJoinRequest(row: Row): JoinRequest {
  return {
    id: asString(row.id),
    requesterUserId: asString(row.requester_user_id),
    requesterContact: asString(row.requester_contact),
    requesterNote: asString(row.requester_note),
    status: asString(row.status) || "pending",
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeInvite(row: Row): RoomInvite {
  return {
    id: asString(row.id),
    invitedEmail: asString(row.invited_email),
    invitedUserId: asString(row.invited_user_id),
    inviteNote: asString(row.invite_note),
    status: asString(row.status) || "pending",
    createdAt: asString(row.created_at) || null,
  };
}

function normalizePreferences(row: Row | null): Preferences {
  return {
    joinRule: asString(row?.join_rule) || "owner_add_only",
    roomStatus: asString(row?.room_status) || "active",
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function StatusPill({ status }: { status: string }) {
  const tone = status === "pending" ? "bg-amber-50 text-amber-700 ring-amber-100" : status === "approved" || status === "accepted" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ring-1 ${tone}`}>{status}</span>;
}

export default function V2RoomInvitesPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({ joinRule: "owner_add_only", roomStatus: "active" });
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [invites, setInvites] = useState<RoomInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [requestContact, setRequestContact] = useState("");
  const [requestNote, setRequestNote] = useState("");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canManage = Boolean(isOwner || isAdmin);
  const isMember = Boolean(isOwner || currentMember);
  const canRequestJoin = !isMember && preferences.joinRule === "request_to_join" && preferences.roomStatus === "active";
  const myPendingInvite = invites.find((invite) => invite.status === "pending");
  const pendingRequests = joinRequests.filter((request) => request.status === "pending");
  const pendingInvites = invites.filter((invite) => invite.status === "pending");

  async function loadEntry() {
    if (!roomId) return;
    setLoading(true);
    setMessage("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.authenticated || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setLoading(false);
        return;
      }

      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      const nextRoom = normalizeRoom((roomData as Row | null) ?? null);
      setRoom(nextRoom);

      const { data: preferenceData } = await supabase.from("room_preferences").select("join_rule,room_status").eq("room_id", roomId).maybeSingle();
      setPreferences(normalizePreferences((preferenceData as Row | null) ?? null));

      const { data: memberData } = await supabase.from("room_members").select("user_id,role").eq("room_id", roomId).order("created_at", { ascending: true });
      setMembers(((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId));

      const { data: requestData } = await supabase.from("room_join_requests").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
      setJoinRequests(((requestData ?? []) as Row[]).map(normalizeJoinRequest).filter((request) => request.id));

      const { data: inviteData } = await supabase.from("room_invites").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
      setInvites(((inviteData ?? []) as Row[]).map(normalizeInvite).filter((invite) => invite.id));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Loombus could not load room entry controls right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEntry();
    const { data } = supabase.auth.onAuthStateChange(() => loadEntry());
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !userId || !canManage || (!inviteEmail.trim() && !inviteUserId.trim())) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_invites").insert({
        room_id: roomId,
        invited_email: inviteEmail.trim().toLowerCase(),
        invited_user_id: inviteUserId.trim() || null,
        invite_note: inviteNote.trim(),
        invited_by: userId,
        status: "pending",
      });
      if (error) throw error;
      setInviteEmail("");
      setInviteUserId("");
      setInviteNote("");
      setMessage("Invite created.");
      await loadEntry();
    } catch {
      setMessage("Loombus could not create this invite yet. Confirm the user ID or email and room entry policies.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_join_requests").insert({
        room_id: roomId,
        requester_user_id: userId,
        requester_contact: requestContact.trim(),
        requester_note: requestNote.trim(),
        status: "pending",
      });
      if (error) throw error;
      setRequestContact("");
      setRequestNote("");
      setMessage("Join request submitted.");
      await loadEntry();
    } catch {
      setMessage("Loombus could not submit this join request. The room may not allow requests right now or you may already have a pending request.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReviewRequest(request: JoinRequest, status: "approved" | "rejected") {
    if (!roomId || !userId || !canManage) return;
    setSaving(true);
    setMessage("");

    try {
      if (status === "approved") {
        const { error: memberError } = await supabase.from("room_members").insert({
          room_id: roomId,
          user_id: request.requesterUserId,
          role: "member",
        });
        if (memberError) throw memberError;
      }

      const { error } = await supabase
        .from("room_join_requests")
        .update({ status, reviewed_by: userId, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;
      setMessage(status === "approved" ? "Join request approved and member added." : "Join request rejected.");
      await loadEntry();
    } catch {
      setMessage("Loombus could not update this join request yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelInvite(invite: RoomInvite) {
    if (!userId || !canManage) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_invites").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", invite.id);
      if (error) throw error;
      setMessage("Invite cancelled.");
      await loadEntry();
    } catch {
      setMessage("Loombus could not cancel this invite yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcceptInvite(invite: RoomInvite) {
    if (!roomId || !userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error: memberError } = await supabase.from("room_members").insert({
        room_id: roomId,
        user_id: userId,
        role: "member",
      });
      if (memberError) throw memberError;

      const { error } = await supabase.from("room_invites").update({ status: "accepted", responded_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", invite.id);
      if (error) throw error;
      setMessage("Invite accepted. You are now a room member.");
      await loadEntry();
    } catch {
      setMessage("Loombus could not accept this invite yet. The invite may be expired or you may already be a member.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening room entry" message="Loombus is loading invites and join requests." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room entry page." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Invites / Join Requests</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name ?? "Private room entry"}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Invite approved members, review join requests, and manage how people enter this private operating hub.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{preferences.joinRule.replace(/_/g, " ")}</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{pendingRequests.length} pending requests</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{pendingInvites.length} pending invites</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Owner/admin tools" : isMember ? "Member view" : "Entry view"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-5">
              {canManage && (
                <form onSubmit={handleCreateInvite} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3"><MailPlus className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Create invite</h2><p className="mt-1 text-sm text-slate-600">Invite by email, user ID, or both. User ID invites can be accepted directly by that account.</p></div></div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Email address" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <input value={inviteUserId} onChange={(event) => setInviteUserId(event.target.value)} placeholder="User ID" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  </div>
                  <textarea value={inviteNote} onChange={(event) => setInviteNote(event.target.value)} placeholder="Optional invite note" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <div className="mt-4 flex justify-end"><button type="submit" disabled={saving || (!inviteEmail.trim() && !inviteUserId.trim())} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-4" /> Create invite</button></div>
                </form>
              )}

              {!isMember && (
                <form onSubmit={handleRequestJoin} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><UserCheck className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Request to join</h2><p className="mt-1 text-sm text-slate-600">{canRequestJoin ? "This room currently allows join requests." : "This room is not accepting join requests right now."}</p></div></div>
                  <input value={requestContact} onChange={(event) => setRequestContact(event.target.value)} disabled={!canRequestJoin} placeholder="Contact or context" className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60" />
                  <textarea value={requestNote} onChange={(event) => setRequestNote(event.target.value)} disabled={!canRequestJoin} placeholder="Why should you be added to this room?" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-60" />
                  <div className="mt-4 flex justify-end"><button type="submit" disabled={saving || !canRequestJoin} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><ShieldCheck className="size-4" /> Submit request</button></div>
                </form>
              )}

              <section className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Join requests</h2>
                {joinRequests.map((request) => (
                  <article key={request.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0"><StatusPill status={request.status} /><h3 className="mt-3 break-all text-lg font-black text-slate-950">{request.requesterUserId}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{request.requesterNote || "No request note provided."}</p><p className="mt-2 text-xs font-bold text-slate-400">{request.requesterContact || "No contact context"} · {formatRelativeTime(request.createdAt)}</p></div>
                      {canManage && request.status === "pending" && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => handleReviewRequest(request, "approved")} disabled={saving} className="inline-flex items-center gap-1 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 ring-1 ring-emerald-100 disabled:opacity-50"><CheckCircle2 className="size-3" /> Approve</button><button type="button" onClick={() => handleReviewRequest(request, "rejected")} disabled={saving} className="inline-flex items-center gap-1 rounded-2xl bg-rose-50 px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 disabled:opacity-50"><XCircle className="size-3" /> Reject</button></div>}
                    </div>
                  </article>
                ))}
                {joinRequests.length === 0 && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><UserCheck className="mx-auto size-9 text-amber-700" /><h2 className="mt-3 text-lg font-black text-slate-950">No join requests yet</h2><p className="mt-2 text-sm text-slate-600">Requests will appear here when someone asks to enter this room.</p></div>}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Entry summary</h2>
                <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Join rule</dt><dd className="font-black text-slate-900">{preferences.joinRule.replace(/_/g, " ")}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Room status</dt><dd className="font-black text-slate-900">{preferences.roomStatus}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Pending requests</dt><dd className="font-black text-slate-900">{pendingRequests.length}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Pending invites</dt><dd className="font-black text-slate-900">{pendingInvites.length}</dd></div></dl>
              </section>

              {myPendingInvite && !isMember && <section className="rounded-[1.5rem] border border-amber-100 bg-amber-50 p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-amber-700">You have an invite</h2><p className="mt-3 text-sm font-semibold leading-6 text-amber-900">Accept this invite to join the room as a member.</p><button type="button" onClick={() => handleAcceptInvite(myPendingInvite)} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"><CheckCircle2 className="size-4" /> Accept invite</button></section>}

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Invites</h2>
                <div className="mt-4 space-y-3">
                  {invites.map((invite) => (
                    <article key={invite.id} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <div className="flex items-start justify-between gap-2"><StatusPill status={invite.status} />{canManage && invite.status === "pending" && <button type="button" onClick={() => handleCancelInvite(invite)} disabled={saving} className="text-xs font-black text-rose-700 disabled:opacity-50">Cancel</button>}</div>
                      <p className="mt-2 break-all text-sm font-black text-slate-950">{invite.invitedEmail || invite.invitedUserId || "Invite"}</p>
                      {invite.invitedUserId && <p className="mt-1 break-all text-xs font-semibold text-slate-500">{invite.invitedUserId}</p>}
                      {invite.inviteNote && <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{invite.inviteNote}</p>}
                      <p className="mt-2 text-xs font-bold text-slate-400">Created {formatRelativeTime(invite.createdAt)}</p>
                    </article>
                  ))}
                  {invites.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600 ring-1 ring-slate-200">No invites yet.</p>}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
