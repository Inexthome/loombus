"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lock,
  Megaphone,
  MessageCircle,
  Save,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../../v2-shell-components";

type AnyRow = Record<string, unknown>;

type ActiveRoom = {
  id: string;
  name: string;
  description: string;
  type: string;
  isPrivate: boolean;
  ownerId: string;
  createdBy: string;
  memberCount: number;
  updatedAt: string | null;
};

type RoomMember = {
  id: string;
  userId: string;
  role: string;
  createdAt: string | null;
};

type RoomPost = {
  id: string;
  title: string;
  body: string;
  authorId: string;
  createdAt: string | null;
};

type RoomEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  startsAt: string | null;
  endsAt: string | null;
  createdBy: string;
  createdAt: string | null;
};

type RoomAnnouncement = {
  id: string;
  title: string;
  body: string;
  priority: string;
  isPinned: boolean;
  createdAt: string | null;
};

type RoomApplication = {
  id: string;
  applicantId: string;
  state: string;
  note: string;
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

function normalizeRoom(row: AnyRow): ActiveRoom {
  const visibility = asString(row.visibility).toLowerCase();
  const isPrivate = asBoolean(row.is_private) || asBoolean(row.private) || asBoolean(row.invite_only) || visibility === "private";

  return {
    id: asString(row.id) || asString(row.room_id),
    name: asString(row.name) || asString(row.title) || asString(row.display_name) || "Untitled room",
    description: asString(row.description) || asString(row.summary) || asString(row.about) || "Private Loombus room.",
    type: asString(row.type) || asString(row.room_type) || asString(row.category) || visibility || "Room",
    isPrivate,
    ownerId: asString(row.owner_id),
    createdBy: asString(row.created_by),
    memberCount: asNumber(row.member_count) || asNumber(row.members_count),
    updatedAt: asString(row.last_activity_at) || asString(row.updated_at) || asString(row.created_at) || null,
  };
}

function normalizeMember(row: AnyRow, index: number): RoomMember {
  return {
    id: asString(row.id) || `${asString(row.room_id)}-${asString(row.user_id)}` || `member-${index}`,
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function normalizePost(row: AnyRow, index: number): RoomPost {
  return {
    id: asString(row.id) || `post-${index}`,
    title: asString(row.title),
    body: asString(row.body) || asString(row.content) || "Room update",
    authorId: asString(row.author_id) || asString(row.user_id),
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function normalizeEvent(row: AnyRow, index: number): RoomEvent {
  return {
    id: asString(row.id) || `event-${index}`,
    title: asString(row.title) || asString(row.name) || "Room event",
    description: asString(row.description),
    location: asString(row.location),
    startsAt: asString(row.starts_at) || asString(row.start_at) || asString(row.event_time) || null,
    endsAt: asString(row.ends_at) || asString(row.end_at) || null,
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeAnnouncement(row: AnyRow, index: number): RoomAnnouncement {
  return {
    id: asString(row.id) || `announcement-${index}`,
    title: asString(row.title) || "Untitled announcement",
    body: asString(row.body) || "Announcement",
    priority: asString(row.priority) || "normal",
    isPinned: asBoolean(row.is_pinned),
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeApplication(row: AnyRow, index: number): RoomApplication {
  return {
    id: asString(row.id) || `application-${index}`,
    applicantId: asString(row.applicant_id),
    state: asString(row.state) || "pending",
    note: asString(row.note),
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function getTimestamp(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.POSITIVE_INFINITY;
}

function formatDateTime(value: string | null) {
  const timestamp = getTimestamp(value);
  if (!Number.isFinite(timestamp)) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatRelativeTime(value: string | null) {
  const timestamp = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return "No recent activity";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

export default function RoomDetailClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const inviteCode = searchParams.get("invite")?.trim() || "";

  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [announcements, setAnnouncements] = useState<RoomAnnouncement[]>([]);
  const [applications, setApplications] = useState<RoomApplication[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [eventReadError, setEventReadError] = useState("");

  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementBody, setAnnouncementBody] = useState("");
  const [applicationNote, setApplicationNote] = useState("");

  const canPost = Boolean(room && userId && (isJoined || isOwner));
  const upcomingEvents = useMemo(
    () => events.filter((event) => getTimestamp(event.startsAt) >= Date.now() - 60 * 60 * 1000).sort((a, b) => getTimestamp(a.startsAt) - getTimestamp(b.startsAt)),
    [events],
  );
  const currentUserApplication = applications.find((application) => application.applicantId === userId);

  async function loadRoom() {
    if (!roomId) return;

    setLoading(true);
    setMessage("");
    setEventReadError("");

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const nextUserId = data.session?.user.id ?? null;
      setUserId(nextUserId);

      const shellResponse = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await shellResponse.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null);
        setMembers([]);
        setPosts([]);
        setEvents([]);
        setAnnouncements([]);
        setApplications([]);
        setIsJoined(false);
        setIsOwner(false);
        return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        setRoom(null);
        setMembers([]);
        setPosts([]);
        setEvents([]);
        setAnnouncements([]);
        setIsJoined(false);
        setIsOwner(false);
        setMessage(inviteCode ? "This private room invite is ready to verify. Private content stays hidden until access is accepted." : "This room is private or unavailable. You can request access without seeing private content.");
        const { data: applicationData } = await supabase.from("room_applications").select("*").eq("room_id", roomId).eq("applicant_id", nextUserId).order("created_at", { ascending: false });
        setApplications(((applicationData ?? []) as AnyRow[]).map(normalizeApplication));
        return;
      }

      const nextRoom = normalizeRoom(roomData as AnyRow);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      setRoom(nextRoom);
      setIsOwner(nextIsOwner);

      const { data: membershipData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((membershipData ?? []) as AnyRow[]).map(normalizeMember).filter((member) => member.userId);
      const nextIsJoined = nextMembers.some((member) => member.userId === nextUserId) || nextIsOwner;
      setMembers(nextMembers);
      setIsJoined(nextIsJoined);

      const { data: applicationData } = await supabase.from("room_applications").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
      setApplications(((applicationData ?? []) as AnyRow[]).map(normalizeApplication));

      if (nextRoom.isPrivate && !nextIsJoined) {
        setPosts([]);
        setEvents([]);
        setAnnouncements([]);
        setMessage(inviteCode ? "Accept this private room invite before private content is shown." : "This private room is invite-only. You can request access from the owner.");
        return;
      }

      const { data: postData } = await supabase.from("room_posts").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50);
      setPosts(((postData ?? []) as AnyRow[]).map(normalizePost));

      const { data: eventData, error: nextEventError } = await supabase.from("room_events").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(100);
      if (nextEventError) {
        setEvents([]);
        setEventReadError(nextEventError.message || "Loombus could not read room events.");
      } else {
        setEvents(((eventData ?? []) as AnyRow[]).map(normalizeEvent).sort((a, b) => getTimestamp(a.startsAt) - getTimestamp(b.startsAt)));
      }

      const { data: announcementData } = await supabase.from("room_announcements").select("*").eq("room_id", roomId).order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(50);
      setAnnouncements(((announcementData ?? []) as AnyRow[]).map(normalizeAnnouncement));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to activate this room right now. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => loadRoom());
    return () => data.subscription.unsubscribe();
  }, [roomId, inviteCode]);

  async function handleCreatePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !canPost || !postBody.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_posts").insert({ room_id: room.id, author_id: userId, title: postTitle.trim() || null, body: postBody.trim() });
      if (error) throw error;
      setPostTitle("");
      setPostBody("");
      setMessage("Room update posted.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not post to this room yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !isOwner || !eventTitle.trim() || !eventStartsAt) return;
    setSaving(true);
    setMessage("");
    setEventReadError("");

    try {
      const { error } = await supabase.from("room_events").insert({
        room_id: room.id,
        title: eventTitle.trim(),
        description: eventDescription.trim() || null,
        location: eventLocation.trim() || null,
        starts_at: new Date(eventStartsAt).toISOString(),
        ends_at: eventEndsAt ? new Date(eventEndsAt).toISOString() : null,
        created_by: userId,
      });
      if (error) throw error;
      setEventTitle("");
      setEventDescription("");
      setEventLocation("");
      setEventStartsAt("");
      setEventEndsAt("");
      setMessage("Room event added.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not add this event yet. Confirm room event policies are active.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !isOwner || !announcementTitle.trim() || !announcementBody.trim()) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_announcements").insert({ room_id: room.id, title: announcementTitle.trim(), body: announcementBody.trim(), priority: "normal", is_pinned: true, created_by: userId });
      if (error) throw error;
      setAnnouncementTitle("");
      setAnnouncementBody("");
      setMessage("Room announcement posted.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not post this announcement yet.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roomId || !userId || isJoined || isOwner) return;
    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase.from("room_applications").insert({ room_id: roomId, applicant_id: userId, note: applicationNote.trim() || null, state: "pending" });
      if (error && error.code !== "23505") throw error;
      setApplicationNote("");
      setMessage("Access request sent to the room owner.");
      await loadRoom();
    } catch {
      setMessage("Loombus could not send this access request yet.");
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
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700">
          <ArrowLeft className="size-4" />
          Back to Rooms
        </Link>

        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        {!room ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
            <Lock className="mx-auto size-10 text-amber-700" />
            <h1 className="mt-4 text-2xl font-black text-slate-950">{inviteCode ? "Accept room invite" : "Request room access"}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">This room is private or unavailable to your account. Private content stays hidden until access is approved.</p>
            {!inviteCode && (currentUserApplication ? (
              <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700 ring-1 ring-slate-200">Current request: {currentUserApplication.state}</p>
            ) : (
              <form onSubmit={handleCreateApplication} className="mx-auto mt-5 max-w-xl rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200">
                <label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="room-access-note">Optional note</label>
                <textarea id="room-access-note" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Tell the owner why you need access" rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                <button type="submit" disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-4" />Send access request</button>
              </form>
            ))}
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-amber-200">Private Room Hub</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room.name}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base">{room.description}</p>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]">
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{room.type}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{room.isPrivate ? "Private" : "Public"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{isOwner ? "Owner view" : "Member view"}</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{Math.max(room.memberCount, members.length)} members</span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15">{events.length} events</span>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section id="overview" className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Room overview</h2>
                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <StatCard label="Members" value={Math.max(room.memberCount, members.length)} />
                    <StatCard label="Posts" value={posts.length} />
                    <StatCard label="Events" value={events.length} />
                    <StatCard label="Updated" value={formatRelativeTime(room.updatedAt)} />
                  </div>
                  <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                    <h3 className="text-sm font-black text-slate-950">Upcoming events</h3>
                    {upcomingEvents.length > 0 ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        {upcomingEvents.slice(0, 3).map((roomEvent) => <EventCard key={roomEvent.id} event={roomEvent} compact />)}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">No upcoming events yet.</p>
                    )}
                  </div>
                </section>

                <section id="calendar" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Calendar</h2>
                      <p className="mt-1 text-sm text-slate-600">Owner-managed room events, meetings, classes, and maintenance windows.</p>
                    </div>
                  </div>

                  {eventReadError && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Room events read failed: {eventReadError}</p>}

                  {isOwner && (
                    <form onSubmit={handleCreateEvent} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <h3 className="text-sm font-black text-slate-950">Add event</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                        <input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Location" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                        <input type="datetime-local" value={eventStartsAt} onChange={(event) => setEventStartsAt(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                        <input type="datetime-local" value={eventEndsAt} onChange={(event) => setEventEndsAt(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      </div>
                      <textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Description" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      <div className="mt-3 flex justify-end">
                        <button type="submit" disabled={saving || !eventTitle.trim() || !eventStartsAt} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" />Add event</button>
                      </div>
                    </form>
                  )}

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {events.map((roomEvent) => <EventCard key={roomEvent.id} event={roomEvent} />)}
                    {events.length === 0 && !eventReadError && <p className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500 md:col-span-2">No room events found yet.</p>}
                  </div>
                </section>

                <section id="discussions" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="size-5 text-amber-700" />
                    <div>
                      <h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Private discussions</h2>
                      <p className="mt-1 text-sm text-slate-600">Room posts stay separate from public Loombus discussions.</p>
                    </div>
                  </div>

                  {canPost && (
                    <form onSubmit={handleCreatePost} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Optional title" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      <textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="Share an update, question, or announcement..." rows={5} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      <div className="mt-3 flex justify-end"><button type="submit" disabled={saving || !postBody.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" />Post update</button></div>
                    </form>
                  )}

                  <div className="mt-5 space-y-4">
                    {posts.map((post) => (
                      <article key={post.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                        {post.title && <h3 className="text-base font-black text-slate-950">{post.title}</h3>}
                        <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body}</p>
                        <p className="mt-2 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}</p>
                      </article>
                    ))}
                    {posts.length === 0 && <p className="rounded-[1.25rem] border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">No room posts yet.</p>}
                  </div>
                </section>

                <section id="announcements" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><Megaphone className="size-5 text-amber-700" /><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Announcements</h2></div>
                  {isOwner && (
                    <form onSubmit={handleCreateAnnouncement} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                      <input value={announcementTitle} onChange={(event) => setAnnouncementTitle(event.target.value)} placeholder="Announcement title" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} placeholder="Announcement body" rows={4} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" />
                      <div className="mt-3 flex justify-end"><button type="submit" disabled={saving || !announcementTitle.trim() || !announcementBody.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" />Post announcement</button></div>
                    </form>
                  )}
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {announcements.map((announcement) => (
                      <article key={announcement.id} className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">{announcement.priority}</p>
                        <h3 className="mt-2 text-sm font-black text-slate-950">{announcement.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{announcement.body}</p>
                      </article>
                    ))}
                    {announcements.length === 0 && <p className="text-sm font-semibold text-slate-500">No announcements yet.</p>}
                  </div>
                </section>
              </div>

              <aside className="space-y-4">
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><Users className="size-5 text-amber-700" /><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Members</h2></div>
                  <div className="mt-4 space-y-2">
                    {members.slice(0, 8).map((member) => <p key={member.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{member.role}: {member.userId.slice(0, 8)}…</p>)}
                    {members.length === 0 && <p className="text-sm font-semibold text-slate-500">No member rows found yet.</p>}
                  </div>
                </section>

                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><FileText className="size-5 text-amber-700" /><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Resources</h2></div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">Room documents, forms, links, services, billing, and settings remain part of the room hub roadmap.</p>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function EventCard({ event, compact = false }: { event: RoomEvent; compact?: boolean }) {
  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4 ring-1 ring-slate-100">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">{formatDateTime(event.startsAt)}</p>
      <h3 className="mt-2 text-sm font-black text-slate-950">{event.title}</h3>
      {event.location && <p className="mt-1 text-xs font-bold text-slate-500">{event.location}</p>}
      {!compact && event.description && <p className="mt-2 text-sm leading-6 text-slate-600">{event.description}</p>}
      {!compact && event.endsAt && <p className="mt-2 text-xs font-semibold text-slate-500">Ends {formatDateTime(event.endsAt)}</p>}
    </article>
  );
}
