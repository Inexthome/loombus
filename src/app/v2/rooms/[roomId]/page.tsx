"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Link2,
  Lock,
  MapPin,
  Megaphone,
  MessageCircle,
  Save,
  Send,
  Settings,
  ShoppingBag,
  UserPlus,
  Users,
  X,
} from "lucide-react";
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
type MemberRow = Record<string, unknown>;
type ApplicationRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;

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
  subscriptionPlan: string;
  subscriptionStatus: string;
  memberLimitLabel: string;
};

type RoomPost = { id: string; title: string; body: string; authorId: string; createdAt: string | null };
type RoomMember = { id: string; userId: string; role: string; createdAt: string | null };
type RoomApplication = { id: string; applicantId: string; state: string; note: string; createdAt: string | null };
type RoomEvent = { id: string; title: string; description: string; location: string; startsAt: string; endsAt: string | null; createdBy: string; createdAt: string | null };

const ROOM_HUB_AREAS = [
  { id: "overview", label: "Overview", description: "Room summary, plan status, recent activity, and next steps.", icon: Building2 },
  { id: "discussions", label: "Discussions", description: "Private room posts and member conversations.", icon: MessageCircle },
  { id: "calendar", label: "Calendar", description: "Events, meetings, maintenance windows, and room dates.", icon: CalendarDays },
  { id: "announcements", label: "Announcements", description: "Pinned owner updates and important notices.", icon: Megaphone },
  { id: "members", label: "Members", description: "Roles, invites, access approvals, and member controls.", icon: Users },
  { id: "requests", label: "Requests", description: "Maintenance, help, support, and general room requests.", icon: ClipboardList },
  { id: "resources", label: "Resources", description: "Documents, links, rules, forms, and guides.", icon: FileText },
  { id: "services", label: "Services / Store", description: "Room-specific listings, booking, services, and offers.", icon: ShoppingBag },
  { id: "settings", label: "Settings", description: "Privacy, room details, permissions, and setup controls.", icon: Settings },
  { id: "billing", label: "Billing", description: "Plan, checkout state, limits, upgrades, and billing actions.", icon: CreditCard },
];

const PLACEHOLDER_ANNOUNCEMENTS = [
  { title: "Pinned room announcement", body: "Important owner/admin updates will live here so they do not get buried inside the discussion feed." },
  { title: "Urgent notices", body: "Rooms can use this space for deadlines, closures, maintenance, policy updates, or schedule changes." },
];

const PLACEHOLDER_REQUESTS = [
  { title: "Maintenance / service request", status: "Planned", body: "Members will be able to submit structured requests with open, in progress, and resolved states." },
  { title: "General help request", status: "Planned", body: "Owners and admins can triage member questions without mixing them into normal discussions." },
];

const PLACEHOLDER_RESOURCES = [
  { title: "Documents", body: "Rules, guides, forms, PDFs, meeting notes, and shared files." },
  { title: "Useful links", body: "Official websites, portals, payment links, help docs, or external resources." },
  { title: "Room knowledge base", body: "Repeated questions can become structured help articles for the room." },
];

const PLACEHOLDER_SERVICES = [
  { title: "Service listing", body: "A dentist, HOA vendor, tutor, local business, or support team can publish services to room members." },
  { title: "Booking / storefront", body: "Future versions can support booking, subscriptions, paid offers, and room-specific commerce." },
];

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
    subscriptionPlan: asString(row.subscription_plan) || "free",
    subscriptionStatus: asString(row.subscription_status) || "active",
    memberLimitLabel: asString(row.member_limit_label),
  };
}

function normalizePost(row: PostRow, index: number): RoomPost {
  return { id: asString(row.id) || `post-${index}`, title: asString(row.title), body: asString(row.body) || asString(row.content) || "Room update", authorId: asString(row.author_id) || asString(row.user_id), createdAt: asString(row.created_at) || asString(row.updated_at) || null };
}

function normalizeMember(row: MemberRow, index: number): RoomMember {
  return { id: asString(row.id) || `${asString(row.room_id)}-${asString(row.user_id)}` || `member-${index}`, userId: asString(row.user_id), role: asString(row.role) || "member", createdAt: asString(row.created_at) || asString(row.updated_at) || null };
}

function normalizeApplication(row: ApplicationRow, index: number): RoomApplication {
  return { id: asString(row.id) || `application-${index}`, applicantId: asString(row.applicant_id), state: asString(row.state) || "pending", note: asString(row.note), createdAt: asString(row.created_at) || asString(row.updated_at) || null };
}

function normalizeEvent(row: EventRow, index: number): RoomEvent {
  return {
    id: asString(row.id) || `event-${index}`,
    title: asString(row.title) || "Untitled event",
    description: asString(row.description),
    location: asString(row.location),
    startsAt: asString(row.starts_at),
    endsAt: asString(row.ends_at) || null,
    createdBy: asString(row.created_by),
    createdAt: asString(row.created_at) || null,
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

function formatEventDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

function formatEventRange(event: RoomEvent) {
  if (!event.endsAt) return formatEventDate(event.startsAt);
  return `${formatEventDate(event.startsAt)} – ${formatEventDate(event.endsAt)}`;
}

function getShortId(value: string) {
  if (!value) return "Unknown member";
  return value.length > 12 ? `${value.slice(0, 8)}...${value.slice(-4)}` : value;
}

function getPlanName(planKey: string) {
  const plans: Record<string, string> = { free: "Free Room", starter: "Room Starter", pro: "Room Pro", organization: "Organization", organization_plus: "Organization Plus", organization_enterprise: "Organization Enterprise" };
  return plans[planKey] ?? planKey.replace(/_/g, " ");
}

function getPlanLimit(planKey: string, fallback: string) {
  if (fallback) return fallback;
  const limits: Record<string, string> = { free: "10 members", starter: "50 members", pro: "250 members", organization: "Up to 3 rooms, 500 members", organization_plus: "Up to 10 rooms, 2,000 members", organization_enterprise: "Unlimited/custom rooms, large membership" };
  return limits[planKey] ?? "Plan limits depend on setup";
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
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [applications, setApplications] = useState<RoomApplication[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [postBody, setPostBody] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [newMemberId, setNewMemberId] = useState("");
  const [applicationNote, setApplicationNote] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDescription, setEventDescription] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventStartsAt, setEventStartsAt] = useState("");
  const [eventEndsAt, setEventEndsAt] = useState("");

  const canPost = Boolean(room && userId && (isJoined || isOwner));
  const currentUserApplication = applications.find((application) => application.applicantId === userId);
  const pendingApplications = applications.filter((application) => application.state === "pending");
  const recentPosts = posts.slice(0, 3);
  const upcomingEvents = events.filter((event) => new Date(event.startsAt).getTime() >= Date.now() - 3600000).slice(0, 3);

  async function loadExistingApplication(nextUserId: string) {
    const { data: applicationData } = await supabase.from("room_applications").select("*").eq("room_id", roomId).eq("applicant_id", nextUserId).order("created_at", { ascending: false });
    setApplications(((applicationData ?? []) as ApplicationRow[]).map(normalizeApplication));
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

      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (!nextUserId || !accessToken || !nextPayload.configured || !nextPayload.flags.v2_shell || nextPayload.version !== "v2") {
        setRoom(null); setPosts([]); setEvents([]); setMembers([]); setApplications([]); setIsJoined(false); setIsOwner(false); return;
      }

      const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      if (roomError || !roomData) {
        await loadExistingApplication(nextUserId);
        setMessage(inviteCode ? "This private room invite is ready to verify. Private content stays hidden until the invite is accepted." : "This room is private or unavailable. You can request access without seeing private room content.");
        setRoom(null); setPosts([]); setEvents([]); setMembers([]); setIsJoined(false); setIsOwner(false); return;
      }

      const nextRoom = normalizeRoom(roomData as RoomRow);
      const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
      setRoom(nextRoom);
      setEditName(nextRoom.name);
      setEditDescription(nextRoom.description);
      setIsOwner(nextIsOwner);

      const { data: membershipData } = await supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true });
      const nextMembers = ((membershipData ?? []) as MemberRow[]).map(normalizeMember).filter((member) => member.userId);
      setMembers(nextMembers);
      const nextIsJoined = nextMembers.some((member) => member.userId === nextUserId) || nextIsOwner;
      setIsJoined(nextIsJoined);

      const { data: applicationData } = await supabase.from("room_applications").select("*").eq("room_id", roomId).order("created_at", { ascending: false });
      setApplications(((applicationData ?? []) as ApplicationRow[]).map(normalizeApplication));

      if (nextRoom.isPrivate && !nextIsJoined) {
        setPosts([]); setEvents([]);
        setMessage(inviteCode ? "This private room invite is ready to accept. Private content stays hidden until membership is created." : "This private room is invite-only. You can request access from the room owner.");
        return;
      }

      const { data: postData } = await supabase.from("room_posts").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(50);
      setPosts(((postData ?? []) as PostRow[]).map(normalizePost));

      const { data: eventData, error: eventError } = await supabase.from("room_events").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(50);
      setEvents(eventError ? [] : ((eventData ?? []) as EventRow[]).map(normalizeEvent));
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to activate this room right now. Current Loombus remains available.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => { loadRoom(); });
    return () => { data.subscription.unsubscribe(); };
  }, [roomId, inviteCode]);

  async function handleAcceptInvite() {
    if (!roomId || !inviteCode || isJoined || isOwner) return;
    setSaving(true); setMessage("");
    try {
      const { data, error } = await supabase.rpc("room_accept_join_code", { target_room_id: roomId, target_code: inviteCode });
      if (error) throw error;
      if (!data) { setMessage("This invite link is invalid or no longer active."); return; }
      setIsJoined(true); setMessage("Invite accepted. Room access is now active."); await loadRoom();
    } catch { setMessage("Loombus could not accept this invite yet."); } finally { setSaving(false); }
  }

  async function handleJoinRoom() {
    if (!room || !userId || room.isPrivate) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_members").insert({ room_id: room.id, user_id: userId, role: "member" });
      if (error && error.code !== "23505") throw error;
      setIsJoined(true); await loadRoom();
    } catch { setMessage("Loombus could not join this room yet. Try again after the room policies finish deploying."); } finally { setSaving(false); }
  }

  async function handleLeaveRoom() {
    if (!room || !userId || isOwner) return;
    setSaving(true); setMessage("");
    try { const { error } = await supabase.from("room_members").delete().eq("room_id", room.id).eq("user_id", userId); if (error) throw error; setIsJoined(false); await loadRoom(); }
    catch { setMessage("Loombus could not leave this room yet."); } finally { setSaving(false); }
  }

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !isOwner || !newMemberId.trim()) return;
    const targetUserId = newMemberId.trim();
    if (targetUserId === userId) { setMessage("You are already the owner of this room."); return; }
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_members").insert({ room_id: room.id, user_id: targetUserId, role: "member" });
      if (error && error.code !== "23505") throw error;
      setNewMemberId(""); setMessage("Member access added."); await loadRoom();
    } catch { setMessage("Loombus could not add this member yet. Confirm the user ID is valid and owner member policies are active."); } finally { setSaving(false); }
  }

  async function handleRemoveMember(member: RoomMember) {
    if (!room || !isOwner || member.userId === userId || member.role === "owner") return;
    setSaving(true); setMessage("");
    try { const { error } = await supabase.from("room_members").delete().eq("room_id", room.id).eq("user_id", member.userId); if (error) throw error; setMessage("Member access removed."); await loadRoom(); }
    catch { setMessage("Loombus could not remove this member yet. Confirm owner member policies are active."); } finally { setSaving(false); }
  }

  async function handleCreateApplication(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetRoomId = room?.id || roomId;
    if (!targetRoomId || !userId || isJoined || isOwner) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_applications").insert({ room_id: targetRoomId, applicant_id: userId, note: applicationNote.trim() || null, state: "pending" });
      if (error && error.code !== "23505") throw error;
      setApplicationNote(""); setMessage("Access request sent to the room owner."); await loadRoom();
    } catch { setMessage("Loombus could not send this access request yet. Confirm the room link is valid."); } finally { setSaving(false); }
  }

  async function handleReviewApplication(application: RoomApplication, nextState: "approved" | "declined") {
    if (!room || !isOwner) return;
    setSaving(true); setMessage("");
    try {
      const { error: updateError } = await supabase.from("room_applications").update({ state: nextState, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", application.id);
      if (updateError) throw updateError;
      if (nextState === "approved") {
        const { error: memberError } = await supabase.from("room_members").insert({ room_id: room.id, user_id: application.applicantId, role: "member" });
        if (memberError && memberError.code !== "23505") throw memberError;
      }
      setMessage(nextState === "approved" ? "Access approved." : "Access request declined."); await loadRoom();
    } catch { setMessage("Loombus could not update this access request yet."); } finally { setSaving(false); }
  }

  async function handleCreatePost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !postBody.trim() || !canPost) return;
    setSaving(true); setMessage("");
    try {
      const { error } = await supabase.from("room_posts").insert({ room_id: room.id, author_id: userId, title: postTitle.trim() || null, body: postBody.trim() });
      if (error) throw error;
      setPostTitle(""); setPostBody(""); await loadRoom();
    } catch { setMessage("Loombus could not post to this room yet. Confirm room post policies are active in Supabase."); } finally { setSaving(false); }
  }

  async function handleCreateEvent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !userId || !isOwner || !eventTitle.trim() || !eventStartsAt) return;
    setSaving(true); setMessage("");
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
      setEventTitle(""); setEventDescription(""); setEventLocation(""); setEventStartsAt(""); setEventEndsAt("");
      setMessage("Room event added."); await loadRoom();
    } catch { setMessage("Loombus could not add this event yet. Confirm the room_events migration and RLS policies are active."); } finally { setSaving(false); }
  }

  async function handleUpdateRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!room || !isOwner || !editName.trim()) return;
    setSaving(true); setMessage("");
    try { const { error } = await supabase.from("rooms").update({ name: editName.trim(), description: editDescription.trim() }).eq("id", room.id); if (error) throw error; setMessage("Room details updated."); await loadRoom(); }
    catch { setMessage("Loombus could not update this room yet. Confirm room owner update policies are active in Supabase."); } finally { setSaving(false); }
  }

  const inviteAcceptCard = inviteCode && !isJoined && !isOwner ? (
    <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.18em] text-amber-800"><Link2 className="size-4" />Room invite found</h2>
      <p className="mt-2 text-sm leading-6 text-amber-900">Accepting this invite adds your account as a room member. Private content stays hidden until that succeeds.</p>
      <button type="button" onClick={handleAcceptInvite} disabled={saving} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-4" />Accept invite</button>
    </section>
  ) : null;

  if (loading) return <V2ShellGateCard title="Opening room" message="Loombus is activating this room." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="Sign in first so Loombus can open this room." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-24 pt-7 sm:px-6 lg:px-8">
        <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:text-amber-700"><ArrowLeft className="size-4" />Back to Rooms</Link>
        {message && <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">{message}</p>}

        {!room ? (
          <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="mx-auto max-w-xl text-center">
              <Lock className="mx-auto size-10 text-amber-700" />
              <h1 className="mt-4 text-2xl font-black text-slate-950">{inviteCode ? "Accept room invite" : "Request room access"}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600">This room is private or unavailable to your account. Loombus will not show private posts, members, or room details until access is approved.</p>
              <div className="mt-5 text-left">{inviteAcceptCard}</div>
              {!inviteCode && (currentUserApplication ? <p className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-700 ring-1 ring-slate-200">Current request: {currentUserApplication.state}</p> : <form onSubmit={handleCreateApplication} className="mt-5 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-slate-200"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="room-access-note">Optional note</label><textarea id="room-access-note" value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Tell the owner why you need access" rows={4} className="mt-2 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><button type="submit" disabled={saving} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-4" />Send access request</button></form>)}
            </div>
          </section>
        ) : (
          <section className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className={`${styles.detailHero} bg-gradient-to-br from-slate-950 via-slate-900 to-amber-700 p-6 text-white sm:p-8`}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className={`${styles.detailEyebrow} text-xs font-black uppercase tracking-[0.24em] text-amber-200`}>Private Room Hub</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{room.name}</h1><p className={`${styles.detailMuted} mt-4 max-w-3xl text-sm leading-6 text-amber-50/90 sm:text-base`}>{room.description}</p></div>
                <div className="grid size-16 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/20">{room.isPrivate ? <Lock className={`${styles.detailEyebrow} size-8 text-amber-200`} /> : <Building2 className={`${styles.detailEyebrow} size-8 text-amber-200`} />}</div>
              </div>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.12em]"><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.type}</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.isPrivate ? "Private" : "Public"}</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{getPlanName(room.subscriptionPlan)}</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{room.subscriptionStatus}</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{Math.max(room.memberCount, members.length)} members</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{events.length} events</span><span className={`${styles.detailPill} rounded-full bg-white/10 px-3 py-1 text-amber-50 ring-1 ring-white/15`}>{posts.length || room.activityCount} updates</span></div>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-6">
                <section id="overview" className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Room overview</h2><p className="mt-2 text-sm leading-6 text-slate-600">A private operating space for discussions, updates, events, resources, members, services, and billing.</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600 ring-1 ring-slate-200">{isOwner ? "Owner view" : "Member view"}</span></div>
                  <div className="mt-5 grid gap-3 md:grid-cols-5"><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Members</p><p className="mt-2 text-2xl font-black text-slate-950">{Math.max(room.memberCount, members.length)}</p></div><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Posts</p><p className="mt-2 text-2xl font-black text-slate-950">{posts.length}</p></div><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Events</p><p className="mt-2 text-2xl font-black text-slate-950">{events.length}</p></div><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Requests</p><p className="mt-2 text-2xl font-black text-slate-950">{pendingApplications.length}</p></div><div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">Updated</p><p className="mt-2 text-base font-black text-slate-950">{formatRelativeTime(room.updatedAt)}</p></div></div>
                  <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-slate-200"><h3 className="text-sm font-black text-slate-950">Upcoming events</h3>{upcomingEvents.length > 0 ? <div className="mt-3 grid gap-3 md:grid-cols-3">{upcomingEvents.map((roomEvent) => <a key={roomEvent.id} href="#calendar" className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">{formatEventDate(roomEvent.startsAt)}</p><p className="mt-2 text-sm font-black text-slate-950">{roomEvent.title}</p></a>)}</div> : <p className="mt-2 text-sm text-slate-500">No upcoming events yet.</p>}</div>
                </section>

                <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{ROOM_HUB_AREAS.map((area) => { const Icon = area.icon; return <a key={area.id} href={`#${area.id}`} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md"><Icon className="size-5 text-amber-700" /><h3 className="mt-3 text-sm font-black text-slate-950">{area.label}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{area.description}</p></a>; })}</section>
                {inviteAcceptCard}

                <section id="discussions" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><MessageCircle className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Private discussions</h2><p className="mt-1 text-sm text-slate-600">These room posts do not appear on the public Loombus discussion page.</p></div></div>
                  {canPost ? <form onSubmit={handleCreatePost} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Optional title" className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><textarea value={postBody} onChange={(event) => setPostBody(event.target.value)} placeholder="Share an update, question, or announcement..." rows={5} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><div className="mt-3 flex justify-end"><button type="submit" disabled={saving || !postBody.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="size-4" />Post update</button></div></form> : room.isPrivate ? <form onSubmit={handleCreateApplication} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Request room access</h3><p className="mt-2 text-sm leading-6 text-slate-600">Ask the room owner to approve access before you can post or read private updates.</p>{currentUserApplication ? <p className="mt-3 rounded-2xl bg-white p-3 text-sm font-black text-slate-700 ring-1 ring-slate-200">Current request: {currentUserApplication.state}</p> : <><textarea value={applicationNote} onChange={(event) => setApplicationNote(event.target.value)} placeholder="Optional note to the owner" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><button type="submit" disabled={saving} className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-4" />Send access request</button></>}</form> : <section className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-5"><h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Room access required</h3><p className="mt-2 text-sm leading-6 text-slate-600">Only room owners and approved members can post inside this room.</p></section>}
                  <div className="mt-5 space-y-4">{posts.map((post) => <article key={post.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-50 font-black text-amber-700">{room.name.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1">{post.title && <h3 className="text-base font-black text-slate-950">{post.title}</h3>}<p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body}</p><p className="mt-2 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}</p></div></div></article>)}{posts.length === 0 && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-6 text-center"><MessageCircle className="mx-auto size-8 text-amber-700" /><h3 className="mt-3 text-lg font-black text-slate-950">No room activity yet</h3><p className="mt-2 text-sm text-slate-600">Start this room with the first update, question, or announcement.</p></div>}</div>
                </section>

                <section id="calendar" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-3"><CalendarDays className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Calendar</h2><p className="mt-1 text-sm text-slate-600">Owner-managed room events, updates, meetings, classes, and maintenance windows.</p></div></div>
                  {isOwner && <form onSubmit={handleCreateEvent} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><h3 className="text-sm font-black text-slate-950">Add event</h3><div className="mt-3 grid gap-3 md:grid-cols-2"><input value={eventTitle} onChange={(event) => setEventTitle(event.target.value)} placeholder="Event title" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><input value={eventLocation} onChange={(event) => setEventLocation(event.target.value)} placeholder="Location or link" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><input value={eventStartsAt} onChange={(event) => setEventStartsAt(event.target.value)} type="datetime-local" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><input value={eventEndsAt} onChange={(event) => setEventEndsAt(event.target.value)} type="datetime-local" className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /></div><textarea value={eventDescription} onChange={(event) => setEventDescription(event.target.value)} placeholder="Event details" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><div className="mt-3 flex justify-end"><button type="submit" disabled={saving || !eventTitle.trim() || !eventStartsAt} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><CalendarDays className="size-4" />Add event</button></div></form>}
                  <div className="mt-5 space-y-3">{events.map((roomEvent) => <article key={roomEvent.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">{formatEventRange(roomEvent)}</p><h3 className="mt-2 text-base font-black text-slate-950">{roomEvent.title}</h3>{roomEvent.description && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{roomEvent.description}</p>}{roomEvent.location && <p className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-slate-500"><MapPin className="size-4 text-amber-700" />{roomEvent.location}</p>}</div></div></article>)}{events.length === 0 && <div className="rounded-[1.5rem] border border-dashed border-slate-300 bg-white p-6 text-center"><CalendarDays className="mx-auto size-8 text-amber-700" /><h3 className="mt-3 text-lg font-black text-slate-950">No room events yet</h3><p className="mt-2 text-sm text-slate-600">Owners can add events, meetings, maintenance dates, classes, or support sessions.</p></div>}</div>
                </section>

                <section id="announcements" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Megaphone className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Announcements</h2><p className="mt-1 text-sm text-slate-600">Pinned notices give rooms a place for updates that should not get buried.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{PLACEHOLDER_ANNOUNCEMENTS.map((announcement) => <article key={announcement.title} className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><h3 className="text-sm font-black text-amber-950">{announcement.title}</h3><p className="mt-2 text-sm leading-6 text-amber-900">{announcement.body}</p></article>)}</div></section>
                <section id="requests" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ClipboardList className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Requests</h2><p className="mt-1 text-sm text-slate-600">Access requests are live now. Maintenance/help requests can use this structured area later.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{PLACEHOLDER_REQUESTS.map((request) => <div key={request.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">{request.status}</span><h3 className="mt-3 text-sm font-black text-slate-950">{request.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{request.body}</p></div>)}</div></section>
                <section id="resources" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><FileText className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Resources</h2><p className="mt-1 text-sm text-slate-600">Documents, rules, links, forms, and help articles for this room.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-3">{PLACEHOLDER_RESOURCES.map((resource) => <div key={resource.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><h3 className="text-sm font-black text-slate-950">{resource.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{resource.body}</p></div>)}</div></section>
                <section id="services" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ShoppingBag className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Services / Store</h2><p className="mt-1 text-sm text-slate-600">A future space for room-specific services, offers, booking, and storefronts.</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{PLACEHOLDER_SERVICES.map((service) => <div key={service.title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200"><h3 className="text-sm font-black text-slate-950">{service.title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{service.body}</p></div>)}</div></section>
                <section id="settings" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><Settings className="size-5 text-amber-700" /><div><h2 className="text-sm font-black uppercase tracking-[0.18em] text-slate-500">Settings</h2><p className="mt-1 text-sm text-slate-600">Room identity, privacy, permissions, and invite tools.</p></div></div>{isOwner ? <form onSubmit={handleUpdateRoom} className="mt-5 rounded-[1.25rem] border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-black text-slate-950">Owner settings</h3><p className="mt-1 text-sm leading-6 text-slate-600">Edit the room name and description shown to members.</p></div><Link href={`/rooms/${room.id}/invite`} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50"><Link2 className="size-4" />Invite link</Link></div><input value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Room name" className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Room description" rows={3} className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><div className="mt-3 flex justify-end"><button type="submit" disabled={saving || !editName.trim()} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><Save className="size-4" />Save room details</button></div></form> : <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">Only room owners can edit settings.</p>}</section>
              </div>

              <aside className="space-y-4">
                <section id="members" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Membership</h2><Users className="size-4 text-amber-700" /></div><p className="mt-3 text-sm leading-6 text-slate-600">{isOwner ? "You own this room." : room.isPrivate ? "Private room membership is controlled by owner approval." : "Join this room to keep it in Your Rooms."}</p><div className="mt-4">{isOwner ? <span className="inline-flex rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700">Owner</span> : room.isPrivate ? <span className="inline-flex rounded-2xl bg-slate-100 px-4 py-2 text-sm font-black text-slate-600">Invite only</span> : isJoined ? <button type="button" onClick={handleLeaveRoom} disabled={saving} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Leave room</button> : <button type="button" onClick={handleJoinRoom} disabled={saving} className="w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50">Join room</button>}</div></section>
                {isOwner && pendingApplications.length > 0 && <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-amber-800">Access requests</h2><div className="mt-4 space-y-2">{pendingApplications.map((application) => <div key={application.id} className="rounded-2xl bg-white p-3 text-xs font-semibold text-slate-600 ring-1 ring-amber-100"><p className="font-black text-slate-800">{getShortId(application.applicantId)}</p>{application.note && <p className="mt-1 text-slate-500">{application.note}</p>}<p className="mt-1 text-slate-400">Requested {formatRelativeTime(application.createdAt)}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => handleReviewApplication(application, "approved")} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white disabled:opacity-50"><CheckCircle2 className="size-3" />Approve</button><button type="button" onClick={() => handleReviewApplication(application, "declined")} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-white px-3 py-2 text-xs font-black text-red-700 ring-1 ring-red-100 disabled:opacity-50"><X className="size-3" />Decline</button></div></div>)}</div></section>}
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Members</h2><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-600">{members.length}</span></div>{isOwner && <form onSubmit={handleAddMember} className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><label className="text-xs font-black uppercase tracking-[0.14em] text-slate-500" htmlFor="room-member-id">Add member by user ID</label><input id="room-member-id" value={newMemberId} onChange={(event) => setNewMemberId(event.target.value)} placeholder="Paste Loombus user ID" className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none transition focus:border-amber-200 focus:ring-4 focus:ring-amber-100" /><button type="submit" disabled={saving || !newMemberId.trim()} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="size-4" />Add access</button></form>}<div className="mt-4 space-y-2">{members.map((member) => { const removable = isOwner && member.userId !== userId && member.role !== "owner"; return <div key={member.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600"><div className="flex items-center justify-between gap-2"><span className="truncate font-black text-slate-800">{member.userId === userId ? "You" : getShortId(member.userId)}</span><span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 ring-1 ring-slate-200">{member.role}</span></div><div className="mt-1 flex items-center justify-between gap-2"><p className="text-slate-400">Joined {formatRelativeTime(member.createdAt)}</p>{removable && <button type="button" onClick={() => handleRemoveMember(member)} disabled={saving} className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-50 disabled:opacity-50"><X className="size-3" />Remove</button>}</div></div>; })}{members.length === 0 && <p className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold text-slate-500">No member records found yet.</p>}</div></section>
                <section id="billing" className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Billing</h2><CreditCard className="size-4 text-amber-700" /></div><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Plan</dt><dd className="font-black text-slate-900">{getPlanName(room.subscriptionPlan)}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-black text-slate-900">{room.subscriptionStatus}</dd></div><div className="gap-3"><dt className="text-slate-500">Limit</dt><dd className="mt-1 font-black text-slate-900">{getPlanLimit(room.subscriptionPlan, room.memberLimitLabel)}</dd></div></dl>{room.subscriptionStatus !== "active" && <p className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900 ring-1 ring-amber-100">Checkout is not completed yet. The room exists, but billing lock rules will be added in a later PR.</p>}</section>
                <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Room status</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-500">Visibility</dt><dd className="font-black text-slate-900">{room.visibility}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Type</dt><dd className="font-black text-slate-900">{room.type}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-500">Updated</dt><dd className="font-black text-slate-900">{formatRelativeTime(room.updatedAt)}</dd></div></dl></section>
                {recentPosts.length > 0 && <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Latest posts</h2><div className="mt-4 space-y-3">{recentPosts.map((post) => <a key={post.id} href="#discussions" className="block rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200"><p className="line-clamp-1 text-sm font-black text-slate-800">{post.title || post.body}</p><p className="mt-1 text-xs font-semibold text-slate-400">{formatRelativeTime(post.createdAt)}</p></a>)}</div></section>}
              </aside>
            </div>
          </section>
        )}
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
