"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Lock, MessageCircle, Send, Users } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";
import styles from "../room-detail-contrast.module.css";

type RoomRow = Record<string, unknown>;
type PostRow = Record<string, unknown>;

type ActiveRoom = {
  id: string;
  name: string;
  description: string;
  type: string;
  isPrivate: boolean;
  visibility: string;
  memberCount: number;
  activityCount: number;
  updatedAt: string | null;
  ownerId: string;
  createdBy: string;
};

type RoomPost = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string | null;
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

function normalizeRoom(row: RoomRow): ActiveRoom {
  const visibility = asString(row.visibility).toLowerCase() || "public";
  const isPrivate = asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private";

  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || asString(row.display_name) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || asString(row.about) || "Live Loombus room.",
    type: asString(row.type) || asString(row.room_type) || asString(row.category) || visibility || "Room",
    isPrivate,
    visibility,
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
    activityCount: asNumber(row.activity_count) || asNumber(row.post_count),
    updatedAt: asString(row.last_activity_at) || asString(row.updated_at) || asString(row.created_at) || null,
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
  };
}

function normalizePost(row: PostRow, index: number): RoomPost {
  return {
    id: asString(row.id) || `post-${index}`,
    title: asString(row.title),
    body: asString(row.body) || asString(row.content) || "Room update",
    authorId: asString(row.author_id) || asString(row.user_id),
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function formatRelativeTime(value: string | null) {
  if (!value) return "No recent activity";
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

export default function V2RoomDetailPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");

  const canPost = Boolean(room && userId && (isJoined || isOwner));

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
        setPosts([]);
        setIsJoined(false);
        setIsOwner(false);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setMessage("This room could not be loaded. It may not exist yet or your account may not have access.");
        setRoom(null);
        setPosts([]);
        setIsJoined(false);
        setIsOwner(false);
        return;
      }

      const nextRoom = normalizeRoom(roomData as RoomRow);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      setRoom(nextRoom);
      setIsOwner(nextIsOwner);

      const { data: membershipData } = await supabase
        .from("room_members")
        .select("room_id,user_id")
        .eq("room_id", roomId)
        .eq("user_id", nextUserId)
        .maybeSingle();
      const nextIsJoined = Boolean(membershipData) || nextIsOwner;
      setIsJoined(nextIsJoined);

      if (nextRoom.isPrivate && !nextIsJoined) {
        setPosts([]);
        setMessage("This private room is invite-only. Ask the room owner or admin for access.");
        return;
      }

      const { data: postData } = await supabase
        .from("room_posts")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false })
        .limit(50);
      setPosts(((postData ?? []) as PostRow[]).map(normalizePost));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to activate this room right now. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadRoom();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [roomId]);

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

  async function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !postBody.trim() || !canPost) return;
    setSaving(true);
    setMessage("");
    try {
      const { error } = await supabase.from("room_posts").insert({
        room_id: room.id,
        author_id: userId,
        title: postTitle.trim() || null,
        body: postBody.trim(),
      });
      if (error) throw error;
      setPostTitle("");
      setPostBody("");
      await loadRoom();
    } catch {
      setMessage("Loombus could not post to this room yet. Confirm room post policies are active in Supabase.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <V2ShellGateCard title="Opening room" message="Loombus is activating this room." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-6xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" />
          Back to Rooms
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        {!room ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-black text-slate-950">Room unavailable</h1>
            <p className="mt-2 text-sm text-slate-600">This room is not available for this account yet.</p>
          </section>
        ) : (
          <>
            <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className={`${styles.detailHero} bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className={`${styles.detailEyebrow} text-xs font-black uppercase tracking-[0.24em] text-amber-200`}>Active Room</p>
                    <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room.name}</h1>
                    <p className={`${styles.detailMuted} mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base`}>{room.description}</p>
                  </div>
                  <div className="grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">
                    {room.isPrivate ? <Lock className={`${styles.detailEyebrow} size-8 text-amber-200`} /> : <Building2 className={`${styles.detailEyebrow} size-8 text-amber-200`} />}
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
                  <span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.type}</span>
                  <span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.isPrivate ? "Private" : "Public"}</span>
                  <span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.memberCount} members</span>
                  <span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{posts.length || room.activityCount} updates</span>
                </div>
              </div>

              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div>
                  {canPost ? (
                    <form onSubmit={handleCreatePost} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Post to this room</h2>
                      <input
                        value={postTitle}
                        onChange={(event) => setPostTitle(event.target.value)}
                        placeholder="Optional title"
                        className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100"
                      />
                      <textarea
                        value={postBody}
                        onChange={(event) => setPostBody(event.target.value)}
                        placeholder="Share an update, question, or announcement..."
                        rows={5}
                        className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100"
                      />
                      <div className="mt-3 flex justify-end">
                        <button type="submit" disabled={saving || !postBody.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                          <Send className="size-4" />
                          Post update
                        </button>
                      </div>
                    </form>
                  ) : (
                    <section className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Room access required</h2>
                      <p className="mt-2 text-sm leading-6 text-slate-600">Only room owners and approved members can post inside this room.</p>
                    </section>
                  )}

                  <section className="mt-5 space-y-4">
                    {posts.map((post) => (
                      <article key={post.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 font-black text-amber-700">{room.name.slice(0, 1).toUpperCase()}</span>
                          <div className="min-w-0 flex-1">
                            {post.title && <h3 className="text-base font-black text-slate-950">{post.title}</h3>}
                            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body}</p>
                            <p className="mt-2 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}</p>
                          </div>
                        </div>
                      </article>
                    ))}
                    {posts.length === 0 && (
                      <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-6 text-center">
                        <MessageCircle className="mx-auto size-8 text-amber-700" />
                        <h2 className="mt-3 text-lg font-black text-slate-950">No room activity yet</h2>
                        <p className="mt-2 text-sm text-slate-600">Start this room with the first update, question, or announcement.</p>
                      </div>
                    )}
                  </section>
                </div>

                <aside className="space-y-4">
                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Membership</h2>
                      <Users className="size-4 text-amber-700" />
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      {isOwner ? "You own this room." : room.isPrivate ? "Private room membership is controlled by owner/admin invite." : "Join this room to keep it in Your Rooms."}
                    </p>
                    <div className="mt-4">
                      {isOwner ? (
                        <span className="inline-flex rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">Owner</span>
                      ) : room.isPrivate ? (
                        <span className="inline-flex rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">Invite only</span>
                      ) : isJoined ? (
                        <button type="button" onClick={handleLeaveRoom} disabled={saving} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                          Leave room
                        </button>
                      ) : (
                        <button type="button" onClick={handleJoinRoom} disabled={saving} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50">
                          Join room
                        </button>
                      )}
                    </div>
                  </section>

                  <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Room status</h2>
                    <dl className="mt-4 space-y-3 text-sm">
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Visibility</dt><dd className="font-black text-slate-900">{room.visibility}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="font-black text-slate-900">{room.type}</dd></div>
                      <div className="flex justify-between gap-3"><dt className="text-slate-500">Updated</dt><dd className="font-black text-slate-900">{formatRelativeTime(room.updatedAt)}</dd></div>
                    </dl>
                  </section>
                </aside>
              </div>
            </section>
          </>
        )}
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
