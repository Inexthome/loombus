"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BadgeCheck,
  Bell,
  Bookmark,
  BookOpen,
  CalendarDays,
  Edit3,
  Eye,
  Globe2,
  Home,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  perspective_marker: string | null;
  creator_website_url: string | null;
  creator_support_url: string | null;
  creator_support_label: string | null;
};

type DiscussionRow = {
  id: string;
  title: string;
  topic: string | null;
  body: string | null;
  created_at: string;
};

type ReplyRow = {
  id: string;
  discussion_id: string;
  body: string | null;
  created_at: string;
};

type ReplyCard = ReplyRow & {
  discussionTitle: string;
  discussionTopic: string | null;
};

type ProfileStats = {
  discussions: number;
  replies: number;
  signals: number;
  rooms: number;
  saved: number;
};

type ProfileData = {
  profile: ProfileRow | null;
  stats: ProfileStats;
  discussions: DiscussionRow[];
  replies: ReplyCard[];
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const DEFAULT_STATS: ProfileStats = {
  discussions: 0,
  replies: 0,
  signals: 0,
  rooms: 0,
  saved: 0,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "People", href: "/v2/people", icon: Users },
];

const PROFILE_TABS = ["Overview", "Discussions", "Replies", "Rooms", "Labs", "Contributions"];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function isV2Allowed(payload: ShellPayload | null) {
  return Boolean(payload?.authenticated && payload.configured && payload.flags.v2_shell && payload.version === "v2");
}

function stripHtml(value: string | null | undefined) {
  return (value ?? "")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string, maxLength = 130) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Recently";

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) return `${Math.max(1, Math.round(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.round(diffMs / hour)}h ago`;
  if (diffMs < 7 * day) return `${Math.round(diffMs / day)}d ago`;

  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatCount(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}m`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
}

function getDisplayName(profile: ProfileRow | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getUsername(profile: ProfileRow | null) {
  const username = profile?.username?.trim();
  return username ? `@${username}` : "@profile";
}

function getInitials(profile: ProfileRow | null) {
  const label = getDisplayName(profile);
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "L"
  );
}

async function loadProfileData(viewerId: string): Promise<ProfileData> {
  const [profileResult, discussionCountResult, replyCountResult, savedCountResult, discussionListResult, replyListResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, username, avatar_url, bio, perspective_marker, creator_website_url, creator_support_url, creator_support_label")
      .eq("id", viewerId)
      .maybeSingle(),
    supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", viewerId).is("deleted_at", null),
    supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", viewerId),
    supabase
      .from("discussions")
      .select("id, title, topic, body, created_at")
      .eq("user_id", viewerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("replies")
      .select("id, discussion_id, body, created_at")
      .eq("user_id", viewerId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (discussionCountResult.error) throw discussionCountResult.error;
  if (replyCountResult.error) throw replyCountResult.error;
  if (savedCountResult.error) throw savedCountResult.error;
  if (discussionListResult.error) throw discussionListResult.error;
  if (replyListResult.error) throw replyListResult.error;

  const replyRows = (replyListResult.data ?? []) as ReplyRow[];
  const discussionIds = [...new Set(replyRows.map((reply) => reply.discussion_id).filter(Boolean))];
  let replyDiscussionMap = new Map<string, DiscussionRow>();

  if (discussionIds.length > 0) {
    const { data: replyDiscussionData, error: replyDiscussionError } = await supabase
      .from("discussions")
      .select("id, title, topic, body, created_at")
      .in("id", discussionIds)
      .is("deleted_at", null);

    if (replyDiscussionError) throw replyDiscussionError;
    replyDiscussionMap = new Map(((replyDiscussionData ?? []) as DiscussionRow[]).map((discussion) => [discussion.id, discussion]));
  }

  const discussions = (discussionListResult.data ?? []) as DiscussionRow[];
  const replies = replyRows.map((reply) => {
    const discussion = replyDiscussionMap.get(reply.discussion_id);
    return {
      ...reply,
      discussionTitle: discussion?.title ?? "Discussion",
      discussionTopic: discussion?.topic ?? null,
    };
  });
  const discussionCount = discussionCountResult.count ?? 0;
  const replyCount = replyCountResult.count ?? 0;
  const savedCount = savedCountResult.count ?? 0;

  return {
    profile: (profileResult.data ?? null) as ProfileRow | null,
    stats: {
      discussions: discussionCount,
      replies: replyCount,
      signals: discussionCount + replyCount + savedCount,
      rooms: 0,
      saved: savedCount,
    },
    discussions,
    replies,
  };
}

function GateCard({
  title,
  message,
  loading = false,
  payload,
}: {
  title: string;
  message: string;
  loading?: boolean;
  payload?: ShellPayload | null;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Home
          </Link>
          <Link href="/profile" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open Profile Settings
          </Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-blue-950 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
          <span className="text-xl">Loombus</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 size-2 rounded-full bg-blue-400" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {[
          { label: "Home", href: "/v2", icon: Home },
          { label: "Discuss", href: "/v2/discussions", icon: MessageCircle },
          { label: "Create", href: "/v2/create", icon: Plus, primary: true },
          { label: "Rooms", href: "/v2/rooms", icon: Users },
          { label: "Profile", href: "/v2/profile", icon: UserRound, active: true },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-700" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ProfileHero({ profile, stats }: { profile: ProfileRow | null; stats: ProfileStats }) {
  const displayName = getDisplayName(profile);
  const username = getUsername(profile);
  const bio = stripHtml(profile?.bio) || "Share who you are, what you care about, and how others can understand your perspective.";
  const perspective = profile?.perspective_marker?.trim() || "Contributor";
  const avatarUrl = profile?.avatar_url?.trim();

  const statItems = [
    { label: "Discussions", value: stats.discussions, icon: BookOpen },
    { label: "Replies", value: stats.replies, icon: Reply },
    { label: "Signals", value: stats.signals, icon: Sparkles },
    { label: "Rooms", value: stats.rooms, icon: Users },
    { label: "Saved", value: stats.saved, icon: Bookmark },
  ];

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
      <div className="h-24 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.25),transparent_32%),linear-gradient(120deg,#eaf4ff,#f8fbff)]" />
      <div className="px-5 pb-5 sm:px-7 sm:pb-6">
        <div className="flex flex-col gap-5 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="-mt-12 grid size-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-slate-950 text-2xl font-black text-white shadow-xl">
              {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : getInitials(profile)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-black tracking-tight text-slate-950">{displayName}</h2>
                <BadgeCheck className="size-5 text-blue-600" />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
                <span>{username}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-700">{perspective}</span>
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">{truncate(bio, 170)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {["Technology", "Research", "Identity", "Web3"].map((tag) => (
                  <span key={tag} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> Joined Loombus</span>
                <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" /> Profile hub</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-3">
            <Link href="/profile" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
              <Edit3 className="size-4" />
              Edit Profile
            </Link>
            <Link href="/settings" className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              <Settings className="size-4" />
              Settings
            </Link>
          </div>
        </div>
        <div className="grid gap-3 pt-5 sm:grid-cols-5">
          {statItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center justify-center gap-2 border-slate-200 py-2 text-center sm:border-r last:sm:border-r-0">
                <Icon className="size-4 text-blue-700" />
                <div>
                  <p className="text-base font-black text-slate-950">{formatCount(item.value)}</p>
                  <p className="text-xs font-semibold text-slate-500">{item.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FeaturedDiscussions({ discussions }: { discussions: DiscussionRow[] }) {
  const items = discussions.length > 0 ? discussions : [
    { id: "empty-1", title: "Start a discussion", topic: "Discussion", body: "Your featured discussions will appear here as you publish on Loombus.", created_at: new Date().toISOString() },
  ];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-black text-slate-950">Featured Discussions</h2>
        <Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-4">
        {items.map((discussion, index) => (
          <article key={discussion.id} className="grid gap-4 rounded-2xl border border-slate-100 p-3 sm:grid-cols-[112px_minmax(0,1fr)]">
            <div className="grid aspect-square place-items-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-400 text-white">
              <Sparkles className="size-8" />
            </div>
            <div className="min-w-0">
              <Link href={discussion.id.startsWith("empty") ? "/v2/create" : `/v2/discussions/${discussion.id}`} className="font-black text-slate-950 hover:text-blue-700">
                {discussion.title}
              </Link>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">{discussion.topic || "Discussion"}</span>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-black text-emerald-700">Signal</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{truncate(stripHtml(discussion.body) || "Discussion preview will appear here.", 110)}</p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                <span>{index === 0 ? 128 : 84} replies</span>
                <span>{index === 0 ? "1.2k" : 870} signals</span>
                <span>{formatRelativeTime(discussion.created_at)}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function RecentReplies({ replies }: { replies: ReplyCard[] }) {
  const items = replies.length > 0 ? replies : [
    { id: "empty-reply", discussion_id: "", discussionTitle: "Recent replies", discussionTopic: "Reply", body: "Replies you post across Loombus will appear here.", created_at: new Date().toISOString() },
  ];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-black text-slate-950">Recent Replies</h2>
        <Link href="/v2/my-replies" className="text-sm font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-3">
        {items.map((reply) => (
          <Link key={reply.id} href={reply.discussion_id ? `/v2/discussions/${reply.discussion_id}` : "/v2/discussions"} className="flex items-start gap-3 rounded-2xl border border-slate-100 p-3 transition hover:border-blue-200 hover:bg-blue-50/30">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-950 text-white"><Reply className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-slate-950">{reply.discussionTitle}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{reply.discussionTopic || "Discussion"} · {formatRelativeTime(reply.created_at)}</p>
              <p className="mt-1 text-sm leading-5 text-slate-600">{truncate(stripHtml(reply.body) || "Reply preview will appear here.", 85)}</p>
            </div>
            <span className="mt-2 size-2 rounded-full bg-blue-600" />
          </Link>
        ))}
      </div>
    </section>
  );
}

function RoomsAndLabs() {
  const rooms = [
    { title: "Loombus Research Lab", meta: "Member" },
    { title: "Builders Room", meta: "Member" },
    { title: "Open Systems Lab", meta: "Member" },
  ];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-black text-slate-950">Rooms & Labs</h2>
        <Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link>
      </div>
      <div className="space-y-3">
        {rooms.map((room) => (
          <div key={room.title} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
            <div className="grid size-10 place-items-center rounded-xl bg-slate-950 text-white"><Users className="size-4" /></div>
            <div>
              <p className="text-sm font-black text-slate-950">{room.title}</p>
              <p className="text-xs font-semibold text-slate-500">{room.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RightRail({ profile, stats }: { profile: ProfileRow | null; stats: ProfileStats }) {
  const websiteUrl = profile?.creator_website_url?.trim();
  const supportUrl = profile?.creator_support_url?.trim();

  return (
    <aside className="space-y-4">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-black text-slate-950">Known For</h2>
        <div className="space-y-4">
          {[
            { title: "Thoughtful Insights", meta: `${formatCount(stats.signals)} signals across profile activity`, icon: Award },
            { title: "In-Depth Research", meta: "Context-driven participation", icon: BookOpen },
            { title: "Quality Contributor", meta: "Consistent and constructive", icon: ShieldCheck },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex gap-3">
                <Icon className="mt-1 size-5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-black text-slate-950">{item.title}</p>
                  <p className="text-xs font-semibold leading-5 text-slate-500">{item.meta}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-black text-slate-950">Recent Activity</h2>
          <Link href="/v2/my-discussions" className="text-sm font-black text-blue-700">View all</Link>
        </div>
        <div className="space-y-4 text-sm">
          <div className="flex gap-3"><span className="mt-1 size-2 rounded-full border border-blue-600" /><p className="text-slate-600">Started or updated profile activity <span className="font-bold text-slate-950">recently</span></p></div>
          <div className="flex gap-3"><span className="mt-1 size-2 rounded-full border border-blue-600" /><p className="text-slate-600">Replied across active discussions</p></div>
          <div className="flex gap-3"><span className="mt-1 size-2 rounded-full border border-blue-600" /><p className="text-slate-600">Saved discussions for later review</p></div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-black text-slate-950">Privacy & Visibility</h2>
          <Link href="/profile" className="text-sm font-black text-blue-700">Manage</Link>
        </div>
        <div className="space-y-3 text-sm font-semibold text-slate-600">
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Eye className="size-4" />Profile Visibility</span><span>Public</span></div>
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><Globe2 className="size-4" />Activity Visibility</span><span>Public</span></div>
          <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2"><MessageCircle className="size-4" />Messages</span><span>Guarded</span></div>
        </div>
        {(websiteUrl || supportUrl) && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            {websiteUrl && <Link href={websiteUrl} target="_blank" className="mb-2 block text-sm font-black text-blue-700">Creator website</Link>}
            {supportUrl && <Link href={supportUrl} target="_blank" className="block text-sm font-black text-blue-700">{profile?.creator_support_label?.trim() || "Support"}</Link>}
          </div>
        )}
      </section>
    </aside>
  );
}

function FooterCards() {
  return (
    <section className="mt-6 grid gap-4 md:grid-cols-4">
      {[
        { title: "Identity & Presence", description: "Showcase who you are and how others find you.", icon: UserRound },
        { title: "Contribution Overview", description: "See your discussions, replies, saved items, and signals.", icon: Sparkles },
        { title: "Manage Visibility", description: "Use profile settings to control how you engage.", icon: ShieldCheck },
        { title: "Quality Reputation", description: "Build trust through constructive participation.", icon: Award },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Icon className="size-6" /></div>
            <h3 className="mt-3 font-black text-blue-700">{item.title}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
          </div>
        );
      })}
    </section>
  );
}

export default function V2ProfilePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Overview");

  useEffect(() => {
    let mounted = true;

    async function loadPage() {
      if (mounted) {
        setLoading(true);
        setMessage("");
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        const requestInit = accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {};
        const response = await fetch("/api/v2/shell", requestInit);
        const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

        if (mounted) setPayload(nextPayload);
        if (!isV2Allowed(nextPayload)) return;

        const { data: userData } = await supabase.auth.getUser();
        const viewerId = userData.user?.id;
        if (!viewerId) return;

        const nextProfileData = await loadProfileData(viewerId);
        if (mounted) setProfileData(nextProfileData);
      } catch {
        if (mounted) {
          setPayload(getDefaultShellPayload());
          setMessage("Unable to load the V2 profile dashboard safely. Current Loombus remains available.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPage();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadPage();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const data = useMemo<ProfileData>(() => profileData ?? { profile: null, stats: DEFAULT_STATS, discussions: [], replies: [] }, [profileData]);

  if (loading) return <GateCard title="Loading Profile" message="Loombus is verifying access before loading this V2 profile page." loading />;
  if (message) return <GateCard title="V2 profile check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950">Profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Your profile, contributions, and presence across Loombus.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <ProfileHero profile={data.profile} stats={data.stats} />

            <div className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-0">
              {PROFILE_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 border-b-2 px-4 py-3 text-sm font-black transition ${activeTab === tab ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-blue-700"}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
              <FeaturedDiscussions discussions={data.discussions} />
              <div className="space-y-5">
                <RecentReplies replies={data.replies} />
                <RoomsAndLabs />
              </div>
            </div>
          </div>

          <RightRail profile={data.profile} stats={data.stats} />
        </section>

        <FooterCards />
      </section>
      <MobileBottomNav />
    </main>
  );
}
