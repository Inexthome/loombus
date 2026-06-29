"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AtSign,
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Mail,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type NotificationKind = "Replies" | "Mentions" | "Messages" | "Rooms" | "Labs" | "System";
type NotificationTone = "blue" | "violet" | "green" | "amber" | "orange";
type NotificationGroup = "Today" | "Yesterday" | "Earlier";

type LiveNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  target: string;
  preview: string;
  chip: string;
  time: string;
  group: NotificationGroup;
  icon: LucideIcon;
  tone: NotificationTone;
  unread: boolean;
  avatarSeed?: string;
  href: string;
};

type LivePreference = {
  label: string;
  value: string;
  icon: LucideIcon;
};

type MutedSource = {
  id: string;
  title: string;
  meta: string;
  icon: LucideIcon;
  tone: NotificationTone;
};

type NotificationFetchResult = {
  rows: Record<string, unknown>[];
  ownerColumn: string | null;
};

const FILTER_LABELS: Array<"All" | NotificationKind> = ["All", "Replies", "Mentions", "Messages", "Rooms", "Labs", "System"];

function asString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  return false;
}

function getFirstString(row: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = asString(row[key]);
    if (value) return value;
  }
  return fallback;
}

function formatRelativeTime(value: unknown) {
  const dateValue = asString(value);
  if (!dateValue) return "Recently";
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - timestamp) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(timestamp));
}

function getGroup(value: unknown): NotificationGroup {
  const dateValue = asString(value);
  const timestamp = new Date(dateValue).getTime();
  if (!Number.isFinite(timestamp)) return "Earlier";
  const diffDays = Math.floor((Date.now() - timestamp) / 86400000);
  if (diffDays < 1) return "Today";
  if (diffDays < 2) return "Yesterday";
  return "Earlier";
}

function getKind(row: Record<string, unknown>): NotificationKind {
  const raw = getFirstString(row, ["kind", "type", "category", "event_type", "notification_type"]).toLowerCase();
  if (raw.includes("reply") || raw.includes("comment")) return "Replies";
  if (raw.includes("mention")) return "Mentions";
  if (raw.includes("message") || raw.includes("dm")) return "Messages";
  if (raw.includes("room")) return "Rooms";
  if (raw.includes("lab")) return "Labs";
  return "System";
}

function getIcon(kind: NotificationKind) {
  if (kind === "Replies") return MessageCircle;
  if (kind === "Mentions") return AtSign;
  if (kind === "Messages") return Mail;
  if (kind === "Rooms") return Users;
  if (kind === "Labs") return FlaskConical;
  return Bell;
}

function getTone(kind: NotificationKind): NotificationTone {
  if (kind === "Mentions" || kind === "Labs") return "violet";
  if (kind === "Rooms") return "green";
  if (kind === "System") return "orange";
  return "blue";
}

function getHref(row: Record<string, unknown>, kind: NotificationKind) {
  const discussionId = getFirstString(row, ["discussion_id", "target_discussion_id"]);
  const messageId = getFirstString(row, ["message_id", "thread_id", "conversation_id"]);
  const roomId = getFirstString(row, ["room_id"]);
  const labId = getFirstString(row, ["lab_id", "request_id"]);

  if (discussionId) return `/v2/discussions/${discussionId}`;
  if (kind === "Messages") return messageId ? `/v2/messages?thread=${encodeURIComponent(messageId)}` : "/v2/messages";
  if (kind === "Rooms") return roomId ? `/v2/rooms/${roomId}` : "/v2/rooms";
  if (kind === "Labs") return labId ? `/v2/labs?request=${encodeURIComponent(labId)}` : "/v2/labs";
  if (kind === "Replies" || kind === "Mentions") return "/v2/discussions";
  return "/v2/notifications";
}

function getToneClass(tone: NotificationTone) {
  if (tone === "violet") return "bg-violet-600 text-white";
  if (tone === "green") return "bg-emerald-600 text-white";
  if (tone === "amber") return "bg-amber-500 text-white";
  if (tone === "orange") return "bg-orange-500 text-white";
  return "bg-blue-600 text-white";
}

function getMutedToneClass(tone: NotificationTone) {
  if (tone === "violet") return "bg-violet-50 text-violet-700";
  if (tone === "green") return "bg-emerald-50 text-emerald-700";
  if (tone === "orange") return "bg-orange-50 text-orange-700";
  return "bg-blue-50 text-blue-700";
}

function getAvatarSeed(row: Record<string, unknown>) {
  const label = getFirstString(row, ["actor_name", "sender_name", "profile_name", "title"]);
  if (!label) return undefined;
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function normalizeNotification(row: Record<string, unknown>): LiveNotification {
  const kind = getKind(row);
  const createdAt = row.created_at ?? row.inserted_at ?? row.updated_at;
  const title = getFirstString(row, ["title", "headline", "subject"], kind === "System" ? "Loombus notification" : `${kind} update`);
  const target = getFirstString(row, ["target", "target_title", "discussion_title", "room_title", "lab_title"], "Loombus");
  const preview = getFirstString(row, ["preview", "body", "message", "content", "description"], "Open this notification for more context.");
  const readAt = row.read_at ?? row.seen_at;
  const unread = readAt ? false : !asBoolean(row.is_read);

  return {
    id: getFirstString(row, ["id"], `${kind}-${title}-${String(createdAt ?? "recent")}`),
    kind,
    title,
    target,
    preview,
    chip: kind === "System" ? "System" : kind.slice(0, -1) || kind,
    time: formatRelativeTime(createdAt),
    group: getGroup(createdAt),
    icon: getIcon(kind),
    tone: getTone(kind),
    unread,
    avatarSeed: getAvatarSeed(row),
    href: getHref(row, kind),
  };
}

async function fetchNotificationsForUser(userId: string): Promise<NotificationFetchResult> {
  const ownerColumns = ["user_id", "recipient_id", "target_user_id", "profile_id"];

  for (const ownerColumn of ownerColumns) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq(ownerColumn, userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error) {
      return { rows: (data ?? []) as Record<string, unknown>[], ownerColumn };
    }
  }

  return { rows: [], ownerColumn: null };
}

async function fetchMutedSourcesForUser(userId: string): Promise<MutedSource[]> {
  const attempts = [
    { table: "notification_mutes", ownerColumn: "user_id" },
    { table: "muted_sources", ownerColumn: "user_id" },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select("*")
      .eq(attempt.ownerColumn, userId)
      .limit(10);

    if (!error) {
      return ((data ?? []) as Record<string, unknown>[]).map((row, index) => {
        const kind = getKind(row);
        return {
          id: getFirstString(row, ["id"], `mute-${index}`),
          title: getFirstString(row, ["title", "source_title", "name"], "Muted source"),
          meta: getFirstString(row, ["kind", "type", "source_type"], kind),
          icon: getIcon(kind),
          tone: getTone(kind),
        };
      });
    }
  }

  return [];
}

async function fetchPreferencesForUser(userId: string): Promise<LivePreference[]> {
  const attempts = [
    { table: "notification_preferences", ownerColumn: "user_id" },
    { table: "user_notification_preferences", ownerColumn: "user_id" },
  ];

  for (const attempt of attempts) {
    const { data, error } = await supabase
      .from(attempt.table)
      .select("*")
      .eq(attempt.ownerColumn, userId)
      .maybeSingle();

    if (!error && data) {
      const row = data as Record<string, unknown>;
      return [
        { label: "Email Notifications", value: asBoolean(row.email_enabled ?? row.email_notifications) ? "On" : "Off", icon: Mail },
        { label: "Push Notifications", value: asBoolean(row.push_enabled ?? row.push_notifications) ? "On" : "Off", icon: Bell },
        { label: "In-App Notifications", value: asBoolean(row.in_app_enabled ?? row.in_app_notifications) ? "On" : "Off", icon: Bell },
        { label: "Digest Summary", value: getFirstString(row, ["digest_frequency", "digest", "summary_frequency"], "Not set"), icon: Mail },
      ];
    }
  }

  return [{ label: "Notification Preferences", value: "Manage in Settings", icon: Settings }];
}

function NotificationAvatar({ item }: { item: LiveNotification }) {
  const Icon = item.icon;
  return (
    <div className="flex items-center gap-3">
      <span className={`grid size-11 shrink-0 place-items-center rounded-full ${getToneClass(item.tone)}`}><Icon className="size-5" /></span>
      {item.avatarSeed && <span className="hidden size-11 shrink-0 place-items-center rounded-full bg-slate-900 text-sm font-black text-white sm:grid">{item.avatarSeed}</span>}
    </div>
  );
}

function NotificationRow({ item }: { item: LiveNotification }) {
  return (
    <Link href={item.href} className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 transition last:border-b-0 hover:bg-blue-50/50 sm:flex-row sm:items-start">
      <NotificationAvatar item={item} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-slate-950">{item.title}</h3>
          <span className="rounded-full bg-violet-50 px-2 py-1 text-xs font-black text-violet-700">{item.chip}</span>
        </div>
        <p className="mt-1 text-sm font-black text-blue-900">{item.target}</p>
        <p className="mt-1 max-w-3xl truncate text-sm leading-6 text-slate-600">{item.preview}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-4 sm:w-24 sm:justify-end">
        <span className="text-xs font-semibold text-blue-900">{item.time}</span>
        {item.unread && <span className="size-2.5 rounded-full bg-blue-600" />}
      </div>
    </Link>
  );
}

export default function V2NotificationsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"All" | NotificationKind>("All");
  const [notifications, setNotifications] = useState<LiveNotification[]>([]);
  const [preferences, setPreferences] = useState<LivePreference[]>([]);
  const [mutedSources, setMutedSources] = useState<MutedSource[]>([]);
  const [ownerColumn, setOwnerColumn] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  const unreadCount = notifications.filter((item) => item.unread).length;

  const filters: Array<{ label: "All" | NotificationKind; count: number }> = useMemo(
    () => FILTER_LABELS.map((label) => ({ label, count: label === "All" ? notifications.length : notifications.filter((item) => item.kind === label).length })),
    [notifications]
  );

  const filteredNotifications = useMemo(() => {
    if (activeFilter === "All") return notifications;
    return notifications.filter((item) => item.kind === activeFilter);
  }, [activeFilter, notifications]);

  const today = filteredNotifications.filter((item) => item.group === "Today");
  const yesterday = filteredNotifications.filter((item) => item.group === "Yesterday");
  const earlier = filteredNotifications.filter((item) => item.group === "Earlier");

  const attentionItems = useMemo(() => [
    { label: "Unread Notifications", value: unreadCount },
    { label: "Unresolved Mentions", value: notifications.filter((item) => item.kind === "Mentions" && item.unread).length },
    { label: "Unread Messages", value: notifications.filter((item) => item.kind === "Messages" && item.unread).length },
  ], [notifications, unreadCount]);

  async function loadNotifications(userId: string) {
    setNotificationLoading(true);
    setStatusMessage("");

    try {
      const [notificationResult, nextPreferences, nextMutedSources] = await Promise.all([
        fetchNotificationsForUser(userId),
        fetchPreferencesForUser(userId),
        fetchMutedSourcesForUser(userId),
      ]);

      setNotifications(notificationResult.rows.map(normalizeNotification));
      setOwnerColumn(notificationResult.ownerColumn);
      setPreferences(nextPreferences);
      setMutedSources(nextMutedSources);
      if (!notificationResult.ownerColumn) setStatusMessage("No live notification table data is available yet for this account.");
    } catch {
      setNotifications([]);
      setPreferences([{ label: "Notification Preferences", value: "Manage in Settings", icon: Settings }]);
      setMutedSources([]);
      setOwnerColumn(null);
      setStatusMessage("Unable to load live notifications safely.");
    } finally {
      setNotificationLoading(false);
    }
  }

  async function markAllAsRead() {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId || !ownerColumn) {
      setStatusMessage("Live notification read-state is not available yet.");
      return;
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq(ownerColumn, userId)
      .is("read_at", null);

    if (error) {
      setStatusMessage("Unable to mark notifications as read with the current live schema.");
      return;
    }

    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
    setStatusMessage("All available notifications were marked as read.");
  }

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);

      if (data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadNotifications(data.session.user.id);
      }
    } catch {
      setPayload(getDefaultShellPayload());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <V2ShellGateCard title="Checking V2 Notifications access" message="Loombus is verifying access before loading the V2 Notifications shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Notifications shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Notifications is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Notifications</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">See what needs your attention across discussions, messages, rooms, and labs.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={markAllAsRead} disabled={unreadCount === 0 || notificationLoading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-default disabled:opacity-60"><Check className="size-4" />Mark all as read</button>
            <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><SlidersHorizontal className="size-4" />Filter</button>
            <Link href="/v2/settings" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><Settings className="size-4" />Notification Settings</Link>
          </div>
        </header>

        {statusMessage && <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">{statusMessage}</div>}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {filters.map((filter) => <button key={filter.label} type="button" onClick={() => setActiveFilter(filter.label)} className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${activeFilter === filter.label ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>{filter.label}<span className={`${activeFilter === filter.label ? "bg-white/20 text-white" : "bg-blue-50 text-blue-700"} grid size-6 place-items-center rounded-full text-xs`}>{filter.count}</span></button>)}
            </div>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {notificationLoading && <div className="p-6 text-sm font-semibold text-slate-500">Loading live notifications...</div>}
              {!notificationLoading && today.length > 0 && <h2 className="px-4 pt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Today</h2>}
              {!notificationLoading && today.map((item) => <NotificationRow key={item.id} item={item} />)}
              {!notificationLoading && yesterday.length > 0 && <h2 className="border-t border-slate-100 px-4 pt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Yesterday</h2>}
              {!notificationLoading && yesterday.map((item) => <NotificationRow key={item.id} item={item} />)}
              {!notificationLoading && earlier.length > 0 && <h2 className="border-t border-slate-100 px-4 pt-5 text-xs font-black uppercase tracking-[0.16em] text-slate-600">Earlier</h2>}
              {!notificationLoading && earlier.map((item) => <NotificationRow key={item.id} item={item} />)}
              {!notificationLoading && filteredNotifications.length === 0 && <div className="p-6 text-sm font-semibold text-slate-500">No live notifications match this filter.</div>}
            </section>
            {notifications.length > 0 && <button type="button" className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-blue-700 transition hover:bg-blue-50">Load more notifications <ChevronDown className="size-4" /></button>}
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Notification Preferences</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Live notification preference state when available.</p>
              <div className="mt-4 space-y-4">
                {preferences.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.label} className="flex items-center justify-between gap-3 text-sm"><span className="inline-flex items-center gap-3 font-semibold text-slate-700"><Icon className="size-4 text-blue-700" />{item.label}</span><span className="font-black text-blue-700">{item.value}</span></div>;
                })}
              </div>
              <Link href="/v2/settings" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">Manage Preferences <ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Muted Sources</h2><Link href="/v2/settings" className="text-sm font-black text-blue-700">Manage</Link></div>
              <div className="mt-4 space-y-3">
                {mutedSources.map((item) => {
                  const Icon = item.icon;
                  return <div key={item.id} className="flex items-center justify-between gap-3"><span className="flex min-w-0 items-center gap-3"><span className={`grid size-10 place-items-center rounded-xl ${getMutedToneClass(item.tone)}`}><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{item.title}</span><span className="block text-xs font-semibold text-slate-500">{item.meta}</span></span></span></div>;
                })}
                {mutedSources.length === 0 && <p className="text-sm font-semibold text-slate-500">No muted sources found for this account.</p>}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Needs Attention</h2>
              <div className="mt-4 space-y-3">
                {attentionItems.map((item) => <div key={item.label} className="flex items-center justify-between text-sm"><span className="font-semibold text-slate-700">{item.label}</span><span className="font-black text-blue-700">{item.value}</span></div>)}
              </div>
              <Link href="/v2/notifications" className="mt-5 flex items-center justify-between text-sm font-black text-blue-700">View All <ChevronRight className="size-4" /></Link>
            </section>
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );
}
