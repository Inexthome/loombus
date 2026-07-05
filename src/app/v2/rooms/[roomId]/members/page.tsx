"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Crown, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react";
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
  isPrivate: boolean;
};

type RoomMember = {
  id: string;
  userId: string;
  role: string;
  createdAt: string | null;
};

const ROLE_OPTIONS = ["owner", "admin", "moderator", "contributor", "member", "viewer"] as const;

type RoleOption = (typeof ROLE_OPTIONS)[number];

const ROLE_COPY: Record<RoleOption, { label: string; description: string; permissions: string[] }> = {
  owner: {
    label: "Owner",
    description: "Full room control and final authority.",
    permissions: ["Manage members", "Manage all room tools", "Control room settings", "Owner-level access"],
  },
  admin: {
    label: "Admin",
    description: "Trusted operator for day-to-day room management.",
    permissions: ["Manage members", "Manage announcements", "Manage requests", "Manage resources and services"],
  },
  moderator: {
    label: "Moderator",
    description: "Keeps the room organized and safe.",
    permissions: ["Moderate discussions", "Track requests", "Support member activity", "Escalate issues"],
  },
  contributor: {
    label: "Contributor",
    description: "Can actively contribute to room operations.",
    permissions: ["Create posts", "Contribute resources", "Submit requests", "Participate actively"],
  },
  member: {
    label: "Member",
    description: "Standard approved room participant.",
    permissions: ["View private room", "Post where allowed", "Submit requests", "Use services"],
  },
  viewer: {
    label: "Viewer",
    description: "Read-focused access for observers or limited members.",
    permissions: ["View room content", "View resources", "View listings", "Limited participation"],
  },
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function normalizeRoom(row: Row): Room {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private",
  };
}

function normalizeMember(row: Row, index: number): RoomMember {
  return {
    id: asString(row.id) || `${asString(row.user_id) || "member"}-${index}`,
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeRole(value: string): RoleOption {
  return ROLE_OPTIONS.includes(value as RoleOption) ? (value as RoleOption) : "member";
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
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

export default function V2RoomMembersPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => {
    if (Array.isArray(rawRoomId)) return rawRoomId[0] ?? "";
    return rawRoomId ?? "";
  }, [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<RoleOption>("member");

  const currentMember = members.find((member) => member.userId === userId);
  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";
  const canAccess = Boolean(room && userId && (isOwner || currentMember));
  const canManage = Boolean(room && userId && (isOwner || isAdmin));
  const activeOwnerIds = new Set([room?.ownerId, room?.createdBy].filter(Boolean));

  const roleCounts = ROLE_OPTIONS.reduce<Record<string, number>>((counts, role) => {
    counts[role] = members.filter((member) => normalizeRole(member.role) === role).length;
    return counts;
  }, {});

  async function loadMembers() {
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
        setRoom(null);
        setMembers([]);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setMessage("This room is private or unavailable to your account.");
        return;
      }

      const nextRoom = normalizeRoom(roomData as Row);
      setRoom(nextRoom);

      const { data: memberData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((memberData ?? []) as Row[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);

      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      const nextIsMember = nextMembers.some((member) => member.userId === nextUserId);
      if (nextRoom.isPrivate && !nextIsOwner && !nextIsMember) {
        setMembers([]);
        setMessage("Members are private to approved room members.");
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to load room members right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadMembers();
    });
    return () => data.subscription.unsubscribe();
  }, [roomId]);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !canManage || !newUserId.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_members").insert({
        room_id: room.id,
        user_id: newUserId.trim(),
        role: newRole,
      });

      if (error) throw error;
      setNewUserId("");
      setNewRole("member");
      setMessage("Member added.");
      await loadMembers();
    } catch {
      setMessage("Loombus could not add this member yet. Confirm the user ID is valid and member policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(member: RoomMember, role: string) {
    if (!room || !canManage || !member.userId || activeOwnerIds.has(member.userId)) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_members")
        .update({ role })
        .eq("room_id", room.id)
        .eq("user_id", member.userId);

      if (error) throw error;
      setMessage("Member role updated.");
      await loadMembers();
    } catch {
      setMessage("Loombus could not update this member role yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveMember(member: RoomMember) {
    if (!room || !canManage || !member.userId || activeOwnerIds.has(member.userId) || member.userId === userId) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", room.id)
        .eq("user_id", member.userId);

      if (error) throw error;
      setMessage("Member removed.");
      await loadMembers();
    } catch {
      setMessage("Loombus could not remove this member yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening members" message="Loombus is loading this room member center." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;
  if (!room || !canAccess) return <V2ShellGateCard title="Members are private" message={message || "Members are only visible to approved room members."} payload={payload} />;

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
            <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Members / Roles</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">Manage approved members, operating roles, and room access responsibilities.</p>
            <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{members.length} members</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{roleCounts.admin ?? 0} admins</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{roleCounts.moderator ?? 0} moderators</span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{canManage ? "Management tools" : "Member view"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              {canManage && (
                <form onSubmit={handleAddMember} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center gap-3">
                    <UserPlus className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Add member</h2>
                      <p className="mt-1 text-sm text-slate-600">Add an approved room participant by user ID, then assign an operating role.</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px]">
                    <input value={newUserId} onChange={(event) => setNewUserId(event.target.value)} placeholder="User ID" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                    <select value={newRole} onChange={(event) => setNewRole(normalizeRole(event.target.value))} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100">
                      {ROLE_OPTIONS.filter((role) => role !== "owner").map((role) => <option key={role} value={role}>{ROLE_COPY[role].label}</option>)}
                    </select>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button type="submit" disabled={saving || !newUserId.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <UserPlus className="size-4" /> Add member
                    </button>
                  </div>
                </form>
              )}

              <section className="space-y-3">
                <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Approved members</h2>
                {members.map((member) => {
                  const role = normalizeRole(member.role);
                  const isProtected = activeOwnerIds.has(member.userId);
                  return (
                    <article key={`${member.userId}-${member.id}`} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            {isProtected && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700 ring-1 ring-amber-100">Room owner</span>}
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{ROLE_COPY[role].label}</span>
                          </div>
                          <h3 className="mt-3 break-all text-lg font-black text-slate-950">{member.userId}</h3>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{ROLE_COPY[role].description}</p>
                          <p className="mt-3 text-xs font-semibold text-slate-400">Added {formatRelativeTime(member.createdAt)}</p>
                        </div>
                        {canManage && (
                          <div className="flex flex-wrap items-center gap-2">
                            <select value={role} onChange={(event) => handleRoleChange(member, event.target.value)} disabled={saving || isProtected} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100 disabled:opacity-50">
                              {ROLE_OPTIONS.filter((option) => option !== "owner").map((option) => <option key={option} value={option}>{ROLE_COPY[option].label}</option>)}
                            </select>
                            <button type="button" onClick={() => handleRemoveMember(member)} disabled={saving || isProtected || member.userId === userId} className="inline-flex items-center gap-1 rounded-2xl bg-white px-3 py-2 text-xs font-black text-rose-700 ring-1 ring-rose-100 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40">
                              <UserMinus className="size-3" /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
                {members.length === 0 && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-8 text-center"><Users className="mx-auto size-9 text-amber-700" /><h2 className="mt-3 text-lg font-black text-slate-950">No room members yet</h2><p className="mt-2 text-sm text-slate-600">Add approved members so this room can operate privately.</p></div>}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Role counts</h2><Crown className="size-4 text-amber-700" /></div>
                <dl className="mt-4 space-y-3 text-sm">
                  {ROLE_OPTIONS.map((role) => <div key={role} className="flex justify-between gap-3"><dt className="text-slate-500">{ROLE_COPY[role].label}</dt><dd className="font-black text-slate-900">{roleCounts[role] ?? 0}</dd></div>)}
                </dl>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Permission model</h2><ShieldCheck className="size-4 text-amber-700" /></div>
                <div className="mt-4 space-y-3">
                  {ROLE_OPTIONS.map((role) => (
                    <article key={role} className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                      <h3 className="text-sm font-black text-slate-950">{ROLE_COPY[role].label}</h3>
                      <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{ROLE_COPY[role].permissions.join(" · ")}</p>
                    </article>
                  ))}
                </div>
              </section>
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">How to use</h2>
                <p className="mt-3 text-sm leading-6 text-slate-600">Use Admin for trusted operators, Moderator for safety and organization, Contributor for active helpers, Member for standard access, and Viewer for read-focused access.</p>
              </section>
            </aside>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
