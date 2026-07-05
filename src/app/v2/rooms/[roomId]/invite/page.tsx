"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Link2, Lock, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../../v2-shell-components";

type RoomRow = Record<string, unknown>;

type ActiveRoom = {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  ownerId: string;
  createdBy: string;
  joinCode: string;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "private", "locked", "invite_only"].includes(value.toLowerCase());
  return false;
}

function normalizeRoom(row: RoomRow): ActiveRoom {
  const visibility = asString(row.visibility).toLowerCase();
  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || "Private Loombus room.",
    isPrivate: asBoolean(row.is_private) || asBoolean(row.private) || visibility === "private",
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    joinCode: asString(row.join_code),
  };
}

export default function V2RoomInvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const inviteCode = searchParams.get("invite")?.trim() || "";
  const invitePath = useMemo(() => {
    const basePath = roomId ? `/rooms/${roomId}/invite` : "/rooms";
    return inviteCode ? `${basePath}?invite=${encodeURIComponent(inviteCode)}` : basePath;
  }, [inviteCode, roomId]);
  const encodedInvitePath = encodeURIComponent(invitePath);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isOwner = Boolean(room && userId && (room.ownerId === userId || room.createdBy === userId));
  const inviteUrl = room?.joinCode ? `${typeof window === "undefined" ? "" : window.location.origin}/rooms/${room.id}/invite?invite=${room.joinCode}` : "";

  async function loadInvitePage() {
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

      if (!nextUserId || !accessToken) {
        setRoom(null);
        return;
      }

      const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      setRoom(roomData ? normalizeRoom(roomData as RoomRow) : null);
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to open this invite page right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInvitePage();
  }, [roomId]);

  async function handleCreateCode() {
    if (!room || !isOwner) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("room_create_join_code", { target_room_id: room.id });
      if (error) throw error;
      setRoom({ ...room, joinCode: String(data ?? "") });
      setMessage("Invite link generated.");
    } catch {
      setMessage("Loombus could not generate this invite link yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokeCode() {
    if (!room || !isOwner || !room.joinCode) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.rpc("room_revoke_join_code", { target_room_id: room.id });
      if (error) throw error;
      setRoom({ ...room, joinCode: "" });
      setMessage("Invite link revoked. Older invite links will no longer work.");
    } catch {
      setMessage("Loombus could not revoke this invite link yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
    setMessage("Invite link copied.");
  }

  async function handleAcceptInvite() {
    if (!roomId || !inviteCode) return;
    setSaving(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("room_accept_join_code", { target_room_id: roomId, target_code: inviteCode });
      if (error) throw error;
      if (!data) {
        setMessage("This invite link is invalid or no longer active.");
        return;
      }
      setMessage("Invite accepted. Opening room access now.");
      window.location.href = `/rooms/${roomId}`;
    } catch {
      setMessage("Loombus could not accept this invite yet.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening invite" message="Loombus is checking this room invite." loading />;
  if (!payload?.authenticated) {
    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-16">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center">
          <Link href="/" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
            ← Back to home
          </Link>

          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-white text-black">
              <Lock className="size-7" />
            </div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-zinc-500">Private Room Invite</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Join Loombus to accept this room invite.</h1>
            <p className="mt-5 leading-7 text-zinc-400">
              This private room invite is ready. Create a Loombus account or sign in, then Loombus will bring you back here to accept the invite.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href={`/signup?next=${encodedInvitePath}`} className="rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-zinc-200">
                Create account
              </Link>
              <Link href={`/login?next=${encodedInvitePath}`} className="rounded-full border border-zinc-700 px-6 py-3 text-center text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white">
                Sign in
              </Link>
            </div>

            <p className="mt-5 rounded-2xl border border-zinc-900 bg-black p-4 text-xs leading-6 text-zinc-500">
              Private posts and members stay hidden until your account accepts the invite.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-4xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href={`/rooms/${roomId}`} className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" />
          Back to Room
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Room Invite</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room?.name || "Private room"}</h1>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-amber-50/90">Invite links require sign-in and only add room membership. They do not expose private posts until the invite is accepted.</p>
              </div>
              <div className="grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                <Lock className="size-8 text-amber-200" />
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                <UserPlus className="size-4 text-amber-700" />
                Accept invite
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">Use this if someone sent you a room invite link.</p>
              {inviteCode ? (
                <button type="button" onClick={handleAcceptInvite} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                  <CheckCircle2 className="size-4" />
                  Accept invite
                </button>
              ) : (
                <p className="mt-4 rounded-2xl bg-white p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">No invite code was found in this link.</p>
              )}
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-slate-500">
                <Link2 className="size-4 text-amber-700" />
                Owner invite link
              </h2>
              {isOwner ? (
                <>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Generate or refresh the room invite link. Regenerating replaces the previous link. Revoking disables the current link completely.</p>
                  {inviteUrl ? <p className="mt-4 break-all rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-700 ring-1 ring-slate-200">{inviteUrl}</p> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">No active invite link.</p>}
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button type="button" onClick={handleCreateCode} disabled={saving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      <RefreshCw className="size-4" />
                      {room?.joinCode ? "Regenerate" : "Generate"}
                    </button>
                    <button type="button" onClick={handleCopyInvite} disabled={!inviteUrl || saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <Copy className="size-4" />
                      Copy
                    </button>
                    <button type="button" onClick={handleRevokeCode} disabled={!room?.joinCode || saving} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white px-5 py-3 text-sm font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 className="size-4" />
                      Revoke
                    </button>
                  </div>
                </>
              ) : (
                <p className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm font-bold text-slate-600 ring-1 ring-slate-200">Only the room owner can create, copy, or revoke invite links.</p>
              )}
            </section>
          </div>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
