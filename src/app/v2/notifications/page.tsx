"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Check,
  ChevronRight,
  Mail,
  MessageCircle,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile-avatar";
import {
  filterBlockedActorNotifications,
  getBlockedRelationshipUserIds,
} from "@/lib/notification-block-filter";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "../v2-shell-components";

type Notification = {
  id: string;
  actor_id: string | null;
  type: string;
  target_type: string;
  target_id: string | null;
  message: string;
  read_at: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type NotificationFilter = "all" | "unread" | "read";
type NotificationTypeFilter = "all" | "reply" | "mention" | "follow" | "followed_discussion" | "followed_reply" | "messages";
type NotificationSortMode = "newest" | "oldest";

type AiEntitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
} | null;

function hasAdvancedNotificationAccess(entitlement: AiEntitlement, isAdmin: boolean) {
  if (isAdmin) return true;
  return entitlement?.ai_assisted_enabled === true && ["premium", "premium_plus", "admin"].includes(entitlement.tier ?? "");
}

function getProfileName(profile: Profile | undefined) {
  return profile?.full_name || profile?.username || "Someone";
}

function getNotificationMessage(notification: Notification, profiles: Record<string, Profile>) {
  const actorProfile = notification.actor_id ? profiles[notification.actor_id] : undefined;
  if (notification.type === "follow") return `${getProfileName(actorProfile)} followed you.`;
  return notification.message;
}

function getNotificationHref(notification: Notification, profiles: Record<string, Profile>) {
  if (notification.target_type === "discussion" && notification.target_id) return `/v2/discussions/${notification.target_id}`;
  if (notification.target_type === "conversation" && notification.target_id) return `/v2/messages?conversation=${encodeURIComponent(notification.target_id)}`;
  if (notification.target_type === "identity_verification") return "/v2/profile";
  if (notification.target_type === "profile") {
    const actorProfile = notification.actor_id ? profiles[notification.actor_id] : undefined;
    if (actorProfile?.username) return `/u/${actorProfile.username}`;
    return "/v2/profile";
  }
  return null;
}

function getNotificationActionLabel(notification: Notification) {
  if (notification.target_type === "discussion") return "Open discussion";
  if (notification.target_type === "conversation") return "Open message";
  if (notification.target_type === "identity_verification") return "Open verification";
  if (notification.target_type === "profile") return "Open profile";
  return "Open";
}

function getTypeLabel(type: string) {
  if (type === "new_message" || type === "message_reply") return "Message";
  if (type === "followed_discussion") return "Followed discussion";
  if (type === "followed_reply") return "Followed reply";
  return type.replace(/_/g, " ");
}

function formatNotificationTime(value: string) {
  const timestamp = new Date(value).getTime();
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

function getNotificationIcon(type: string) {
  if (type === "follow") return UserPlus;
  if (type === "mention") return Bell;
  if (type === "new_message" || type === "message_reply") return Mail;
  return MessageCircle;
}

export default function V2NotificationsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [alerts, setNotifications] = useState<Notification[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<NotificationFilter>("all");
  const [typeFilter, setTypeFilter] = useState<NotificationTypeFilter>("all");
  const [sortMode, setSortMode] = useState<NotificationSortMode>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [aiEntitlement, setAiEntitlement] = useState<AiEntitlement>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const loadingRef = useRef(true);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState(false);

  const canUseAdvancedControls = hasAdvancedNotificationAccess(aiEntitlement, isAdmin);
  const unreadCount = alerts.filter((notification) => !notification.read_at).length;
  const readCount = alerts.length - unreadCount;
  const messageCount = alerts.filter((notification) => notification.type === "new_message" || notification.type === "message_reply").length;
  const replyCount = alerts.filter((notification) => notification.type === "reply" || notification.type === "followed_reply").length;
  const mentionCount = alerts.filter((notification) => notification.type === "mention").length;

  async function markNotificationIdsRead(ids: string[], userId: string) {
    if (ids.length === 0) return true;
    const readAt = new Date().toISOString();
    const { error } = await supabase.from("notifications").update({ read_at: readAt }).eq("user_id", userId).in("id", ids).is("read_at", null);
    if (error) {
      setMessage("Unable to mark notifications as read.");
      return false;
    }
    setNotifications((current) => current.map((notification) => ids.includes(notification.id) ? { ...notification, read_at: readAt } : notification));
    window.dispatchEvent(new Event("loombus:notifications-changed"));
    return true;
  }

  async function loadActorProfiles(actorIds: string[]) {
    if (actorIds.length === 0) return;
    const { data: profileData } = await supabase.from("profiles").select("id, username, full_name, avatar_url").in("id", actorIds);
    const profileMap: Record<string, Profile> = {};
    for (const profile of profileData ?? []) profileMap[profile.id] = profile;
    setProfiles(profileMap);
  }

  async function loadNotifications(userId: string) {
    setNotificationLoading(true);
    setMessage("");
    try {
      const [profileResult, entitlementResult, blockedRelationshipUserIds, alertsResult] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", userId).maybeSingle(),
        supabase.from("user_ai_entitlements").select("tier, ai_assisted_enabled, monthly_summary_limit").eq("user_id", userId).maybeSingle(),
        getBlockedRelationshipUserIds(supabase, userId),
        supabase.from("notifications").select("id, actor_id, type, target_type, target_id, message, read_at, created_at").eq("user_id", userId).order("created_at", { ascending: false }),
      ]);
      const firstError = profileResult.error || entitlementResult.error || alertsResult.error;
      if (firstError) throw firstError;
      setIsAdmin(Boolean(profileResult.data?.is_admin));
      setAiEntitlement((entitlementResult.data ?? null) as AiEntitlement);
      const loadedNotifications = filterBlockedActorNotifications((alertsResult.data ?? []) as Notification[], blockedRelationshipUserIds);
      setNotifications(loadedNotifications);
      const actorIds = [...new Set(loadedNotifications.map((notification) => notification.actor_id).filter((id): id is string => Boolean(id)))];
      void loadActorProfiles(actorIds);
    } catch {
      setMessage("Notifications could not load. Please refresh and try again.");
      setNotifications([]);
    } finally {
      setNotificationLoading(false);
    }
  }

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      const userId = data.session?.user.id ?? null;
      setCurrentUserId(userId);
      if (userId && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") await loadNotifications(userId);
    } catch {
      setPayload(getDefaultShellPayload());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!loadingRef.current) return;
      setMessage((current) => current || "Notifications took too long to load. Please refresh if the list looks incomplete.");
      setLoading(false);
      setNotificationLoading(false);
    }, 10000);
    return () => window.clearTimeout(timeoutId);
  }, []);
  useEffect(() => {
    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => void loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  async function markRead(id: string) {
    if (!currentUserId) return;
    setMessage("");
    await markNotificationIdsRead([id], currentUserId);
  }

  async function openNotification(notification: Notification, href: string) {
    if (!currentUserId) {
      window.location.href = href;
      return;
    }
    setMessage("");
    if (!notification.read_at) await markNotificationIdsRead([notification.id], currentUserId);
    window.location.href = href;
  }

  async function deleteNotification(id: string) {
    if (!currentUserId || working) return;
    setMessage("");
    setWorking(true);
    const { error } = await supabase.from("notifications").delete().eq("user_id", currentUserId).eq("id", id);
    setWorking(false);
    if (error) {
      setMessage("Unable to delete notification.");
      return;
    }
    setNotifications((current) => current.filter((notification) => notification.id !== id));
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  async function markAllRead() {
    if (!currentUserId || working) return;
    const unreadIds = alerts.filter((notification) => !notification.read_at).map((notification) => notification.id);
    if (unreadIds.length === 0) {
      setMessage("No unread notifications to mark read.");
      return;
    }
    setMessage("");
    setWorking(true);
    const success = await markNotificationIdsRead(unreadIds, currentUserId);
    setWorking(false);
    if (success) setMessage("All unread notifications marked read.");
  }

  async function clearReadNotifications() {
    if (!currentUserId || working) return;
    const readIds = alerts.filter((notification) => notification.read_at).map((notification) => notification.id);
    if (readIds.length === 0) {
      setMessage("No read notifications to clear.");
      return;
    }
    setMessage("");
    setWorking(true);
    const { error } = await supabase.from("notifications").delete().eq("user_id", currentUserId).in("id", readIds);
    setWorking(false);
    if (error) {
      setMessage("Unable to clear read notifications.");
      return;
    }
    setNotifications((current) => current.filter((notification) => !readIds.includes(notification.id)));
    setMessage("Read notifications cleared.");
    window.dispatchEvent(new Event("loombus:notifications-changed"));
  }

  const filteredNotifications = useMemo(() => {
    const activeTypeFilter = canUseAdvancedControls ? typeFilter : "all";
    const activeSortMode = canUseAdvancedControls ? sortMode : "newest";
    const filtered = alerts.filter((notification) => {
      if (filterMode === "unread" && notification.read_at) return false;
      if (filterMode === "read" && !notification.read_at) return false;
      if (activeTypeFilter === "messages") return notification.type === "new_message" || notification.type === "message_reply";
      if (activeTypeFilter !== "all" && notification.type !== activeTypeFilter) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return activeSortMode === "oldest" ? aTime - bTime : bTime - aTime;
    });
  }, [alerts, filterMode, typeFilter, sortMode, canUseAdvancedControls]);

  const filterOptions: { label: string; value: NotificationFilter; count: number }[] = [
    { label: "All", value: "all", count: alerts.length },
    { label: "Unread", value: "unread", count: unreadCount },
    { label: "Read", value: "read", count: readCount },
  ];

  if (loading) return <V2ShellGateCard title="Checking V2 Notifications access" message="Loombus is verifying access before loading the V2 Notifications shell." loading />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 Notifications shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <V2ShellGateCard title="V2 Notifications is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f8fafc] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-slate-500">Notifications</p>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Notifications inbox</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Updates from replies, follows, mentions, messages, and conversations connected to you.</p>
          </div>
          {!notificationLoading && alerts.length > 0 && (
            <div className="flex flex-col gap-2 sm:items-end">
              <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-slate-600">{unreadCount === 0 ? "All caught up" : `${unreadCount} unread`}</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={markAllRead} disabled={working || unreadCount === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"><Check className="size-4" />Mark all read</button>
                <button type="button" onClick={clearReadNotifications} disabled={working || readCount === 0} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="size-4" />Clear read</button>
                <button type="button" onClick={() => setShowFilters((open) => !open)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"><SlidersHorizontal className="size-4" />Filters</button>
                <Link href="/v2/settings" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 shadow-sm transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800"><Settings className="size-4" />Settings</Link>
              </div>
            </div>
          )}
        </header>

        {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">{message}</div>}

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => <button key={option.value} type="button" onClick={() => setFilterMode(option.value)} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${filterMode === option.value ? "bg-amber-300 text-slate-950" : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-amber-50 hover:text-amber-800"}`}>{option.label}<span className={`grid size-6 place-items-center rounded-full text-xs ${filterMode === option.value ? "bg-slate-950/10" : "bg-white text-slate-500"}`}>{option.count}</span></button>)}
              </div>
              {showFilters && (
                <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 lg:grid-cols-2">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Type filter</p>
                    <div className="flex flex-wrap gap-2">
                      {[["all", "All types"], ["reply", "Replies"], ["mention", "Mentions"], ["follow", "Follows"], ["followed_discussion", "Followed discussions"], ["followed_reply", "Followed replies"], ["messages", "Messages"]].map(([value, label]) => <button key={value} type="button" onClick={() => setTypeFilter(value as NotificationTypeFilter)} disabled={!canUseAdvancedControls && value !== "all"} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${typeFilter === value ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-800"} disabled:cursor-not-allowed disabled:opacity-50`}>{label}</button>)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-slate-500">Sort order</p>
                    <div className="flex flex-wrap gap-2">
                      {[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([value, label]) => <button key={value} type="button" onClick={() => setSortMode(value as NotificationSortMode)} disabled={!canUseAdvancedControls && value !== "newest"} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${sortMode === value ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 text-slate-500 hover:border-amber-200 hover:text-amber-800"} disabled:cursor-not-allowed disabled:opacity-50`}>{label}</button>)}
                    </div>
                  </div>
                  {!canUseAdvancedControls && <Link href="/v2/premium" className="text-sm font-black text-amber-800">Unlock type filters and sort controls with Premium.</Link>}
                </div>
              )}
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-sm">
              {notificationLoading && <div className="p-6 text-sm font-semibold text-slate-500">Loading notifications...</div>}
              {!notificationLoading && alerts.length === 0 && <EmptyState />}
              {!notificationLoading && alerts.length > 0 && filteredNotifications.length === 0 && <div className="p-6"><h2 className="text-xl font-black text-slate-950">No notifications found.</h2><p className="mt-2 text-sm leading-6 text-slate-600">No notifications match the current filters.</p><button type="button" onClick={() => { setFilterMode("all"); setTypeFilter("all"); setSortMode("newest"); }} className="mt-4 rounded-xl bg-amber-300 px-4 py-2 text-sm font-black text-slate-950">Clear filters</button></div>}
              {!notificationLoading && filteredNotifications.map((notification) => {
                const href = getNotificationHref(notification, profiles);
                const actorProfile = notification.actor_id ? profiles[notification.actor_id] : undefined;
                const Icon = getNotificationIcon(notification.type);
                return (
                  <article key={notification.id} className={`border-b border-slate-100 p-4 transition last:border-b-0 ${notification.read_at ? "bg-white" : "bg-amber-50/40"}`}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {!notification.read_at && <span className="rounded-full bg-amber-300 px-2.5 py-1 text-xs font-black text-slate-950">New</span>}
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{getTypeLabel(notification.type)}</span>
                      <span className="ml-auto text-xs font-semibold text-slate-500">{formatNotificationTime(notification.created_at)}</span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon className="size-5" /></span>
                      <ProfileAvatar profile={actorProfile} size="md" />
                      <div className="min-w-0 flex-1"><p className={`text-sm leading-7 ${notification.read_at ? "text-slate-500" : "font-semibold text-slate-800"}`}>{getNotificationMessage(notification, profiles)}</p></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                      {href && <button type="button" onClick={() => void openNotification(notification, href)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800">{getNotificationActionLabel(notification)}</button>}
                      {!notification.read_at && <button type="button" onClick={() => void markRead(notification.id)} disabled={working} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50">Mark read</button>}
                      <button type="button" onClick={() => void deleteNotification(notification.id)} disabled={working} className="rounded-xl border border-red-100 px-4 py-2 text-sm font-black text-red-700 transition hover:border-red-200 hover:bg-red-50 disabled:opacity-50">Delete</button>
                    </div>
                  </article>
                );
              })}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><ShieldCheck className="size-5 text-amber-700" /><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Attention panel</h2></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Total</p><p className="mt-1 text-lg font-black text-slate-950">{alerts.length}</p></div>
                <div className="rounded-2xl bg-amber-50 p-3"><p className="text-xs font-bold text-amber-800">Unread</p><p className="mt-1 text-lg font-black text-amber-900">{unreadCount}</p></div>
                <div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">Read</p><p className="mt-1 text-lg font-black text-slate-950">{readCount}</p></div>
              </div>
              <Link href="/v2/settings" className="mt-5 flex items-center justify-between text-sm font-black text-amber-800">Notification Settings <ChevronRight className="size-4" /></Link>
            </section>
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Current inbox</h2>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">View</span><span className="font-black capitalize text-slate-950">{filterMode}</span></div>
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Showing</span><span className="font-black text-slate-950">{filteredNotifications.length} of {alerts.length}</span></div>
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Messages</span><span className="font-black text-slate-950">{messageCount}</span></div>
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Replies</span><span className="font-black text-slate-950">{replyCount}</span></div>
                <div className="flex items-center justify-between"><span className="font-semibold text-slate-600">Mentions</span><span className="font-black text-slate-950">{mentionCount}</span></div>
              </div>
            </section>
          </aside>
        </section>
      </section>
      <V2ShellMobileNav />
    </main>
  );

  function EmptyState() {
    return (
      <div className="p-6 sm:p-8">
        <h2 className="text-xl font-black text-slate-950">No notifications yet.</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Notifications appear when people reply, mention you, follow you, or interact with activity connected to your contributions.</p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href="/v2/create" className="inline-flex justify-center rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-amber-400">Create a discussion</Link>
          <Link href="/v2/discussions" className="inline-flex justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-amber-200 hover:bg-amber-50">Browse discussions</Link>
          <Link href="/v2/profile" className="inline-flex justify-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 transition hover:border-amber-200 hover:bg-amber-50">Review profile</Link>
        </div>
      </div>
    );
  }
}
