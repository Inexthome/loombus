"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, CheckCircle2, Link2, Lock, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";

type Row = Record<string, unknown>;

type ActiveRoom = {
  id: string;
  name: string;
  description: string;
  type: string;
  isPrivate: boolean;
  ownerId: string;
  createdBy: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  memberCount: number;
};

type RoomMember = {
  userId: string;
  role: string;
};

type RoomApplication = {
  id: string;
  applicantId: string;
  state: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function normalizeRoom(row: Row): ActiveRoom {
  const visibility = asString(row.visibility).toLowerCase() || "public";
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || asString(row.display_name) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || asString(row.about) || "Private Loombus room.",
    type: asString(row.type) || asString(row.room_type) || asString(row.category) || visibility || "Room",
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    subscriptionPlan: asString(row.subscription_plan) || "free",
    subscriptionStatus: asString(row.subscription_status) || "active",
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
  };
}

function normalizeMember(row: Row): RoomMember {
  return {
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
  };
}

function normalizeApplication(row: Row): RoomApplication {
  return {
    id: asString(row.id),
    applicantId: asString(row.applicant_id),
    state: asString(row.state) || "pending",
  };
}

function getPlanName(planKey: string) {
  const plans: Record<string, string> = {
    free: "Free Room",
    starter: "Room Starter",
    room_starter: "Room Starter",
    pro: "Room Pro",
    room_pro: "Room Pro",
    organization: "Organization",
    organization_plus: "Organization Plus",
    organization_enterprise: "Organization Enterprise",
  };
  return plans[planKey] ?? planKey.replace(/_/g, " ");
}

function isAdminRole(role: string) {
  return ["owner", "admin", "moderator"].includes(role.toLowerCase());
}

export default function V2RoomDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const inviteCode = searchParams.get("invite")?.trim() || "";

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [applications, setApplications] = useState<RoomApplication[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [applicationNote, setApplicationNote] = useState("");

  const currentUserMember = members.find((member) => member.userId === userId);
  const canManage = Boolean(isOwner || (currentUserMember && isAdminRole(currentUserMember.role)));
  const currentUserApplication = applications.find((application) => application.applicantId === userId);

  async function loadApplications(nextUserId: string) {
    const { data } = await supabase
      .from("room_applications")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false });
    const nextApplications = ((data ?? []) as Row[]).map(normalizeApplication);
    setApplications(nextApplications);
    return nextApplications.find((application) => application.applicantId === nextUserId) ?? null;
  }

  async function loadRoom() {
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
        setApplications([]);
        setIsJoined(false);
        setIsOwner(false);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        await loadApplications(nextUserId);
        setRoom(null);
        setMembers([]);
        setIsJoined(false);
        setIsOwner(false);
        setMessage(
          inviteCode
            ? "This private room invite is ready to verify. Private content stays hidden until the invite is accepted."
            : "This room is private or unavailable. You can request access without seeing private room content.",
        );
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      setRoom(nextRoom);
      setIsOwner(nextIsOwner);

      const { data: membershipData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((membershipData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);
      await loadApplications(nextUserId);

      const nextIsJoined = nextMembers.some((member) => member.userId === nextUserId) || nextIsOwner;
      setIsJoined(nextIsJoined);

      if (nextRoom.isPrivate && !nextIsJoined) {
        setMessage(inviteCode ? "This private room invite is ready to accept. Private content stays hidden until membership is created." : "This private room is invite-only. You can request access from the room owner.");
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to open this room right now. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRoom();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId, inviteCode]);

  async function handleAcceptInvite() {
    if (!roomId || !inviteCode || isJoined || isOwner) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("room_accept_join_code", { target_room_id: roomId, target_code: inviteCode });
      if (error) throw error;
      if (!data) {
        setMessage("This invite link is invalid or no longer active.");
        return;
      }
      setIsJoined(true);
      setMessage("Invite accepted. Room access is now active.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not accept this invite yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleJoinRoom() {
    if (!room || !userId || room.isPrivate) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("room_members").insert({ room_id: room.id, user_id: userId, role: "member" });
      if (error && error.code !== "23505") throw error;
      setIsJoined(true);
      await loadRoom();
    } catch {
      setMessage("Loombus could not join this room yet. Try again after the room policies finish deploying.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLeaveRoom() {
    if (!room || !userId || isOwner) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("room_members").delete().eq("room_id", room.id).eq("user_id", userId);
      if (error) throw error;
      setIsJoined(false);
      await loadRoom();
    } catch {
      setMessage("Loombus could not leave this room yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetRoomId = room?.id || roomId;
    if (!targetRoomId || !userId || isJoined || isOwner) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("room_applications").insert({
        room_id: targetRoomId,
        applicant_id: userId,
        note: applicationNote.trim() || null,
        state: "pending",
      });
      if (error && error.code !== "23505") throw error;
      setApplicationNote("");
      setMessage("Access request sent to the room owner.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not send this access request yet. Confirm the room link is valid.");
    } finally {
      setSaving(false);
    }
  }

  const canOpenRoom = Boolean(room && (isJoined || isOwner || !room.isPrivate));
  const visibleMemberCount = room ? Math.max(room.memberCount, members.length) : 0;

  if (loading) return <V2ShellGateCard title="Opening room" message="Loombus is activating this room." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-5xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" /> Back to Rooms
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        {!room ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto max-w-xl text-center">
              <Lock className="mx-auto size-10 text-amber-700" />
              <h1 className="mt-4 text-2xl font-black text-slate-950">{inviteCode ? "Accept room invite" : "Request room access"}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">This room is private or unavailable to your account. Loombus will not show private room content until access is approved.</p>
              {inviteCode ? (
                <section className="mt-5 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 text-left shadow-sm">
                  <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-amber-800"><Link2 className="size-4" />Room invite found</h2>
                  <p className="mt-2 text-sm leading-6 text-amber-900">Accepting this invite adds your account as a room member.</p>
                  <button type="button" onClick={handleAcceptInvite} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <CheckCircle2 className="size-4" /> Accept invite
                  </button>
                </section>
              ) : currentUserApplication ? (
                <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700 ring-1 ring-slate-200">Current request: {currentUserApplication.state}</p>
              ) : (
                <form onSubmit={handleCreateApplication} className="mt-5 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200">
                  <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="room-access-note">Optional note</label>
                  <textarea id="room-access-note" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Tell the owner why you need access" rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                  <button type="submit" disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                    <UserPlus className="size-4" /> Send access request
                  </button>
                </form>
              )}
            </div>
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200" style={{ color: "#fde68a" }}>Private Room Hub</p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl" style={{ color: "#ffffff" }}>{room.name}</h1>
                  <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50 sm:text-base" style={{ color: "#fff7ed" }}>{room.description}</p>
                </div>
                <div className="grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                  {room.isPrivate ? <Lock className="size-8 text-amber-200" /> : <Building2 className="size-8 text-amber-200" />}
                </div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{room.type}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{room.isPrivate ? "Private" : "Public"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{getPlanName(room.subscriptionPlan)}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{room.subscriptionStatus}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{visibleMemberCount} members</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15" style={{ color: "#fff7ed" }}>{canManage ? "Owner/Admin" : isJoined ? "Member" : "Visitor"}</span>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Clean room landing</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Use the Room Menu to open room tools.</h2>
                <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">Calendar, announcements, members, invites, requests, resources, settings, and other workflows now live on their own pages instead of crowding this landing page.</p>
              </section>

              <aside className="space-y-4">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Access</p>
                  <h2 className="mt-2 text-lg font-black text-slate-950">{canOpenRoom ? "Room access active" : room.isPrivate ? "Private room" : "Public room"}</h2>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{canOpenRoom ? "You can open room tools from the Room Menu." : "Request access or use an invite link to join this room."}</p>
                  {inviteCode && !isJoined && !isOwner && (
                    <button type="button" onClick={handleAcceptInvite} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <CheckCircle2 className="size-4" /> Accept invite
                    </button>
                  )}
                  {!room.isPrivate && !isJoined && !isOwner && (
                    <button type="button" onClick={handleJoinRoom} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <UserPlus className="size-4" /> Join room
                    </button>
                  )}
                  {isJoined && !isOwner && (
                    <button type="button" onClick={handleLeaveRoom} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                      Leave room
                    </button>
                  )}
                </section>
              </aside>
            </div>
          </section>
        )}
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
