"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderOpen,
  HelpCircle,
  Lock,
  Megaphone,
  MessageCircle,
  Settings,
  ShoppingBag,
  SquareCheckBig,
  Users,
  Vote,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type RoomRow = Record<string, unknown>;
type PostRow = Record<string, unknown>;
type MemberRow = Record<string, unknown>;
type EventRow = Record<string, unknown>;
type AnnouncementRow = Record<string, unknown>;

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
};

type RoomPost = { id: string; title: string; body: string; createdAt: string | null };
type RoomMember = { id: string; userId: string; role: string; createdAt: string | null };
type RoomEvent = { id: string; title: string; location: string; startsAt: string; createdAt: string | null };
type RoomAnnouncement = { id: string; title: string; body: string; isPinned: boolean; createdAt: string | null };

type ModuleSummary = {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
};

const ROOM_HUB_AREAS = [
  { id: "overview", label: "Overview", description: "Room summary, plan status, recent activity, and next steps.", icon: Building2 },
  { id: "discussions", label: "Discussions", description: "Private room posts and member conversations.", icon: MessageCircle },
  { id: "calendar", label: "Calendar", description: "Events, meetings, maintenance windows, and room dates.", icon: CalendarDays },
  { id: "announcements", label: "Announcements", description: "Pinned owner updates and important notices.", icon: Megaphone },
  { id: "requests", label: "Requests", description: "Maintenance, support, and general room requests.", icon: ClipboardList },
  { id: "resources", label: "Resources", description: "Documents, links, rules, forms, and guides.", icon: FileText },
  { id: "services", label: "Services / Store", description: "Room-specific listings, booking, services, and offers.", icon: ShoppingBag },
  { id: "members", label: "Members / Roles", description: "Roles, invites, access approvals, and member controls.", icon: Users },
  { id: "tasks", label: "Tasks", description: "Action items, owner follow-ups, and room work tracking.", icon: SquareCheckBig },
  { id: "polls", label: "Polls / Decisions", description: "Member votes, decisions, and consensus tracking.", icon: Vote },
  { id: "faq", label: "FAQ", description: "Reusable room knowledge base articles.", icon: HelpCircle },
  { id: "files", label: "Files", description: "Shared documents and file hub access.", icon: FolderOpen },
  { id: "settings", label: "Settings", description: "Privacy, room details, permissions, and setup controls.", icon: Settings },
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
  const visibility = asString(row.visibility).toLowerCase() || "private";
  const isPrivate =
    asBoolean(row.is_private) ||
    asBoolean(row.private) ||
    asBoolean(row.invite_only) ||
    visibility === "private";

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
  };
}

function normalizePost(row: PostRow, index: number): RoomPost {
  return {
    id: asString(row.id) || `post-${index}`,
    title: asString(row.title) || "Room discussion",
    body: asString(row.body) || asString(row.content) || "Room update",
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function normalizeMember(row: MemberRow, index: number): RoomMember {
  return {
    id: asString(row.id) || `${asString(row.room_id)}-${asString(row.user_id)}` || `member-${index}`,
    userId: asString(row.user_id),
    role: asString(row.role) || "member",
    createdAt: asString(row.created_at) || asString(row.updated_at) || null,
  };
}

function normalizeEvent(row: EventRow, index: number): RoomEvent {
  return {
    id: asString(row.id) || `event-${index}`,
    title: asString(row.title) || "Untitled event",
    location: asString(row.location),
    startsAt: asString(row.starts_at),
    createdAt: asString(row.created_at) || null,
  };
}

function normalizeAnnouncement(row: AnnouncementRow, index: number): RoomAnnouncement {
  return {
    id: asString(row.id) || `announcement-${index}`,
    title: asString(row.title) || "Untitled announcement",
    body: asString(row.body) || "Announcement",
    isPinned: asBoolean(row.is_pinned),
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

function formatDateTime(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getPlanName(planKey: string) {
  const plans: Record<string, string> = {
    free: "Free Room",
    starter: "Room Starter",
    pro: "Room Pro",
    organization: "Organization",
    organization_plus: "Organization Plus",
    organization_enterprise: "Organization Enterprise",
  };
  return plans[planKey] ?? planKey.replace(/_/g, " ");
}

async function readCount(table: string, roomId: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);

  return error ? 0 : count ?? 0;
}

function SummaryCard({ item }: { item: ModuleSummary }) {
  const Icon = item.icon;

  return (
    <a href={`#${item.id}`} className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5 transition hover:-translate-y-0.5 hover:border-[var(--loombus-text-subtle)]">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[var(--loombus-surface-muted)] text-[var(--loombus-text)] ring-1 ring-[var(--loombus-border)]">
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full bg-[var(--loombus-primary-bg)] px-2.5 py-1 text-xs font-black text-[var(--loombus-primary-text)]">
          {item.value}
        </span>
      </div>
      <h3 className="mt-4 text-base font-black text-[var(--loombus-text)]">{item.label}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{item.description}</p>
    </a>
  );
}

export default function RoomHubPage() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(() => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""), [rawRoomId]);
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [room, setRoom] = useState<ActiveRoom | null>(null);
  const [posts, setPosts] = useState<RoomPost[]>([]);
  const [events, setEvents] = useState<RoomEvent[]>([]);
  const [announcements, setAnnouncements] = useState<RoomAnnouncement[]>([]);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [isJoined, setIsJoined] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const recentPosts = posts.slice(0, 3);
  const pinnedAnnouncements = announcements.filter((announcement) => announcement.isPinned).slice(0, 3);
  const upcomingEvents = events
    .filter((event) => new Date(event.startsAt).getTime() >= Date.now() - 3600000)
    .slice(0, 3);

  const moduleSummaries: ModuleSummary[] = [
    { id: "discussions", label: "Discussions", description: "Private room posts and member conversations.", icon: MessageCircle, value: String(posts.length) },
    { id: "calendar", label: "Calendar", description: "Events, meetings, maintenance windows, and room dates.", icon: CalendarDays, value: String(events.length) },
    { id: "announcements", label: "Announcements", description: "Pinned owner updates and important notices.", icon: Megaphone, value: String(announcements.length) },
    { id: "requests", label: "Requests", description: "Maintenance, help, support, and general room requests.", icon: ClipboardList, value: String(counts.requests ?? 0) },
    { id: "resources", label: "Resources", description: "Documents, links, rules, forms, and guides.", icon: FileText, value: String(counts.resources ?? 0) },
    { id: "services", label: "Services / Store", description: "Room-specific listings, booking, services, and offers.", icon: ShoppingBag, value: String(counts.services ?? 0) },
    { id: "members", label: "Members / Roles", description: "Roles, invites, access approvals, and member controls.", icon: Users, value: String(members.length) },
    { id: "tasks", label: "Tasks", description: "Action items, owner follow-ups, and room work tracking.", icon: SquareCheckBig, value: String(counts.tasks ?? 0) },
    { id: "polls", label: "Polls / Decisions", description: "Member votes, decisions, and consensus tracking.", icon: Vote, value: String(counts.polls ?? 0) },
    { id: "faq", label: "FAQ", description: "Reusable room knowledge base articles.", icon: HelpCircle, value: String(counts.faq ?? 0) },
    { id: "files", label: "Files", description: "Shared documents and file hub access.", icon: FolderOpen, value: String(counts.files ?? 0) },
    { id: "settings", label: "Settings", description: "Privacy, room details, permissions, and setup controls.", icon: Settings, value: isOwner ? "Owner" : "View" },
  ];

  useEffect(() => {
    let isMounted = true;

    async function loadRoom() {
      if (!roomId) return;
      setLoading(true);
      setMessage("");

      try {
        const { data } = await supabase.auth.getSession();
        const nextUserId = data.session?.user.id ?? null;

        if (!isMounted) return;

        setUserId(nextUserId);
        setAuthChecked(true);

        if (!nextUserId) {
          setRoom(null);
          return;
        }

        const { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();

        if (roomError || !roomData) {
          if (!isMounted) return;
          setRoom(null);
          setPosts([]);
          setEvents([]);
          setAnnouncements([]);
          setMembers([]);
          setIsJoined(false);
          setIsOwner(false);
          setMessage("This room is private or unavailable. You may need an invite or approved membership.");
          return;
        }

        const nextRoom = normalizeRoom(roomData as RoomRow);
        const nextIsOwner = nextRoom.ownerId === nextUserId || nextRoom.createdBy === nextUserId;
        const [{ data: membershipData }, { data: postData }, { data: eventData }, { data: announcementData }] = await Promise.all([
          supabase.from("room_members").select("*").eq("room_id", roomId).order("created_at", { ascending: true }),
          supabase.from("room_posts").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20),
          supabase.from("room_events").select("*").eq("room_id", roomId).order("starts_at", { ascending: true }).limit(20),
          supabase.from("room_announcements").select("*").eq("room_id", roomId).order("created_at", { ascending: false }).limit(20),
        ]);

        const nextMembers = ((membershipData ?? []) as MemberRow[]).map(normalizeMember);
        const nextIsJoined = nextMembers.some((member) => member.userId === nextUserId);
        const [requests, resources, services, tasks, polls, faq, files] = await Promise.all([
          readCount("room_requests", roomId),
          readCount("room_resources", roomId),
          readCount("room_services", roomId),
          readCount("room_tasks", roomId),
          readCount("room_polls", roomId),
          readCount("room_faq_articles", roomId),
          readCount("room_files", roomId),
        ]);

        if (!isMounted) return;

        setRoom(nextRoom);
        setMembers(nextMembers);
        setPosts(((postData ?? []) as PostRow[]).map(normalizePost));
        setEvents(((eventData ?? []) as EventRow[]).map(normalizeEvent));
        setAnnouncements(((announcementData ?? []) as AnnouncementRow[]).map(normalizeAnnouncement));
        setCounts({ requests, resources, services, tasks, polls, faq, files });
        setIsJoined(nextIsJoined);
        setIsOwner(nextIsOwner);
      } catch {
        if (isMounted) setMessage("Unable to load this room right now.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadRoom();
    const { data } = supabase.auth.onAuthStateChange(() => loadRoom());

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, [roomId]);

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5">
          <p className="text-sm text-[var(--loombus-text-muted)]">Loading room hub...</p>
        </div>
      </main>
    );
  }

  if (!userId) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Private room</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Log in to open this room.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">Room content is private to approved room members.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/login" className="rounded-full bg-[var(--loombus-primary-bg)] px-5 py-3 text-sm font-black text-[var(--loombus-primary-text)]">Log in</Link>
            <Link href="/rooms" className="rounded-full border border-[var(--loombus-border)] px-5 py-3 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">Back to Rooms</Link>
          </div>
        </section>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <Link href="/rooms" className="inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
            <ArrowLeft className="h-4 w-4" /> Back to Rooms
          </Link>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.24em] text-[var(--loombus-text-subtle)]">Room unavailable</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Private room access required.</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--loombus-text-muted)]">{message || "This room is private or unavailable."}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-6 text-[var(--loombus-text)] sm:px-6 lg:px-8">
      <section className="mx-auto max-w-7xl">
        <Link href="/rooms" className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-2 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
          <ArrowLeft className="h-4 w-4" /> Back to Rooms
        </Link>

        <section id="overview" className="mb-6 overflow-hidden rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] shadow-xl shadow-black/5">
          <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black text-[var(--loombus-text-muted)]">{room.type}</span>
                {room.isPrivate && <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-3 py-1 text-xs font-black text-[var(--loombus-text-muted)]">Private</span>}
                {isOwner && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600">Owner</span>}
                {!isOwner && isJoined && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-600">Member</span>}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight sm:text-5xl">{room.name}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--loombus-text-muted)] sm:text-base">{room.description}</p>
            </div>
            <aside className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Room status</h2>
              <dl className="mt-4 grid gap-3 text-sm">
                <div className="flex justify-between gap-3"><dt className="text-[var(--loombus-text-muted)]">Plan</dt><dd className="font-black">{getPlanName(room.subscriptionPlan)}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--loombus-text-muted)]">Status</dt><dd className="font-black capitalize">{room.subscriptionStatus.replace(/_/g, " ")}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--loombus-text-muted)]">Members</dt><dd className="font-black">{members.length || room.memberCount}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-[var(--loombus-text-muted)]">Updated</dt><dd className="font-black">{formatRelativeTime(room.updatedAt)}</dd></div>
              </dl>
            </aside>
          </div>
        </section>

        {message && (
          <p className="mb-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm font-bold text-amber-700">
            {message}
          </p>
        )}

        <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {moduleSummaries.map((item) => (
            <SummaryCard key={item.id} item={item} />
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section id="discussions" className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-xl font-black">Discussions</h2>
              <div className="mt-4 grid gap-3">
                {recentPosts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
                    <h3 className="font-black">{post.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{post.body}</p>
                    <p className="mt-2 text-xs font-semibold text-[var(--loombus-text-subtle)]">{formatRelativeTime(post.createdAt)}</p>
                  </article>
                ))}
                {recentPosts.length === 0 && <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">No room discussions yet.</p>}
              </div>
            </section>

            <section id="calendar" className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-xl font-black">Calendar</h2>
              <div className="mt-4 grid gap-3">
                {upcomingEvents.map((event) => (
                  <article key={event.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
                    <h3 className="font-black">{event.title}</h3>
                    <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">{formatDateTime(event.startsAt)}</p>
                    {event.location && <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">{event.location}</p>}
                  </article>
                ))}
                {upcomingEvents.length === 0 && <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">No upcoming room events yet.</p>}
              </div>
            </section>

            <section id="announcements" className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-xl font-black">Announcements</h2>
              <div className="mt-4 grid gap-3">
                {pinnedAnnouncements.map((announcement) => (
                  <article key={announcement.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] p-4">
                    <h3 className="font-black">{announcement.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">{announcement.body}</p>
                  </article>
                ))}
                {pinnedAnnouncements.length === 0 && <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-4 text-sm text-[var(--loombus-text-muted)]">No pinned announcements yet.</p>}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Room menu</h2>
              <div className="mt-4 grid gap-2">
                {ROOM_HUB_AREAS.map((area) => (
                  <a key={area.id} href={`#${area.id}`} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface-muted)] px-4 py-3 text-sm font-black text-[var(--loombus-text-muted)] transition hover:text-[var(--loombus-text)]">
                    {area.label}
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Members</h2>
              <div className="mt-4 grid gap-2">
                {members.slice(0, 5).map((member) => (
                  <p key={member.id} className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3 text-sm text-[var(--loombus-text-muted)]">
                    <span className="font-black capitalize text-[var(--loombus-text)]">{member.role}</span> · {member.userId.slice(0, 8)}...
                  </p>
                ))}
                {members.length === 0 && <p className="rounded-2xl bg-[var(--loombus-surface-muted)] p-3 text-sm text-[var(--loombus-text-muted)]">No members loaded.</p>}
              </div>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}
