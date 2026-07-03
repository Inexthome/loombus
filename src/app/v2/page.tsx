"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  ChevronRight,
  FlaskConical,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type ShellPreference = {
  layout_version: "v1" | "v2" | null;
  appearance_theme: "system" | "dark" | "light" | null;
  home_sections: string[] | null;
  compact_mode: boolean | null;
  last_seen_v2_prompt_at: string | null;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
  preferences: ShellPreference | null;
};

type RecentDiscussion = {
  id: string;
  title: string;
  topic: string | null;
  created_at: string;
  replyCount: number;
  viewCount: number;
  savedCount: number;
  savedByViewer: boolean;
};

type RoomSummary = {
  id: string;
  slug: string;
  name: string;
  memberCount: number;
  discussionCount: number;
};

type LabsUpdate = {
  id: string;
  title: string;
  created_at: string;
};

type V2HomeData = {
  greetingName: string;
  unreadMessages: number;
  unreadNotifications: number;
  savedCount: number;
  authoredDiscussionCount: number;
  replyCount: number;
  labsUpdateCount: number;
  labsUpdates: LabsUpdate[];
  rooms: RoomSummary[];
  recentDiscussions: RecentDiscussion[];
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const DEFAULT_LABS_UPDATES: LabsUpdate[] = [
  { id: "loombus-research-lab", title: "Loombus Research Lab", created_at: new Date().toISOString() },
  { id: "civic-futures-lab", title: "Civic Futures Lab", created_at: new Date().toISOString() },
  { id: "open-systems-lab", title: "Open Systems Lab", created_at: new Date().toISOString() },
];

const DEFAULT_ROOMS: RoomSummary[] = [
  { id: "loombus-research-lab", slug: "loombus-research-lab", name: "Loombus Research Lab", memberCount: 12, discussionCount: 3 },
  { id: "builders-room", slug: "builders-room", name: "Builders’ Room", memberCount: 8, discussionCount: 0 },
  { id: "civic-futures-lab", slug: "civic-futures-lab", name: "Civic Futures Lab", memberCount: 15, discussionCount: 1 },
];

const DEFAULT_HOME_DATA: V2HomeData = {
  greetingName: "there",
  unreadMessages: 0,
  unreadNotifications: 0,
  savedCount: 0,
  authoredDiscussionCount: 0,
  replyCount: 0,
  labsUpdateCount: 0,
  labsUpdates: DEFAULT_LABS_UPDATES,
  rooms: DEFAULT_ROOMS,
  recentDiscussions: [],
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home, active: true },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
    preferences: null,
  };
}

function formatCount(value: number) {
  return Math.max(0, value).toLocaleString();
}

function getCompactCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return formatCount(value);
}

function getSignalScore(discussion: RecentDiscussion) {
  return discussion.replyCount * 3 + discussion.savedCount * 5 + discussion.viewCount;
}

function getGreetingName({ fullName, username, email }: { fullName?: string | null; username?: string | null; email?: string | null }) {
  const profileName = fullName?.trim() || username?.trim();
  if (profileName) return profileName.split(/\s+/)[0] ?? profileName;
  return email?.split("@")[0]?.trim() || "there";
}

function getRecentDiscussionAge(value: string) {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return "Recently";
  const diffMinutes = Math.floor((Date.now() - createdAt) / 60000);
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function ShellGateCard({ title, message, payload, loading = false }: { title: string; message: string; payload?: ShellPayload | null; loading?: boolean }) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_rooms: {payload.flags.v2_rooms ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/discussions" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Return to V1</Link>
          <button type="button" onClick={() => window.location.reload()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Recheck access</button>
        </div>
      </section>
    </main>
  );
}

function V2TopNav({ unreadNotifications }: { unreadNotifications: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
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
                  item.active
                    ? "border-b border-white text-white"
                    : item.primary
                      ? "border border-white/40 text-white hover:bg-white/10"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            {unreadNotifications > 0 && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">{Math.min(unreadNotifications, 9)}</span>}
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
        {V2_NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${item.active ? "text-blue-600" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function AttentionCard({ title, count, description, href, actionLabel, children, items }: { title: string; count: number; description: string; href: string; actionLabel: string; children: React.ReactNode; items: string[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-600">{children}</span>
          <div>
            <h3 className="font-black text-slate-950">{title}</h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">{description}</p>
          </div>
        </div>
        <span className="grid size-8 place-items-center rounded-full bg-blue-100 text-sm font-black text-blue-700">{formatCount(count)}</span>
      </div>
      <div className="mt-5 divide-y divide-slate-100 border-t border-slate-100 pt-2">
        {items.map((item) => <p key={item} className="py-2 text-sm font-semibold text-slate-600">{item}</p>)}
      </div>
      <Link href={href} className="mt-3 flex items-center justify-between rounded-2xl px-1 py-2 text-sm font-black text-blue-700 transition hover:text-blue-900">
        {actionLabel}
        <ChevronRight className="size-4" />
      </Link>
    </article>
  );
}

function V2Shell({ payload, homeData, homeLoading, homeMessage, onSaveFeatured }: { payload: ShellPayload; homeData: V2HomeData; homeLoading: boolean; homeMessage: string; onSaveFeatured: (discussion: RecentDiscussion) => Promise<boolean> }) {
  const featuredDiscussion = homeData.recentDiscussions[0] ?? null;
  const recentSignals = homeData.recentDiscussions.slice(1, 5);
  const [savingFeaturedId, setSavingFeaturedId] = useState<string | null>(null);
  const [savedFeaturedIds, setSavedFeaturedIds] = useState<Set<string>>(new Set());
  const [saveMessage, setSaveMessage] = useState("");
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const discussion of homeData.recentDiscussions) {
      const topic = discussion.topic || "Discussion";
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [homeData.recentDiscussions]);
  const trendingTopics = topicCounts.length > 0 ? topicCounts : [["Discussions", 0]];
  const roomRows = homeData.rooms.length > 0 ? homeData.rooms : DEFAULT_ROOMS;
  const labsUpdates = homeData.labsUpdates.length > 0 ? homeData.labsUpdates : DEFAULT_LABS_UPDATES;
  const labsUpdateCount = Math.max(homeData.labsUpdateCount, labsUpdates.length);
  const featuredSaved = featuredDiscussion ? featuredDiscussion.savedByViewer || savedFeaturedIds.has(featuredDiscussion.id) : false;

  async function saveFeaturedDiscussion(discussion: RecentDiscussion) {
    if (savingFeaturedId) return;
    setSavingFeaturedId(discussion.id);
    setSaveMessage("");
    const success = await onSaveFeatured(discussion);
    if (success) {
      setSavedFeaturedIds((current) => new Set(current).add(discussion.id));
      setSaveMessage("Featured signal saved.");
    } else {
      setSaveMessage("Unable to save featured signal. Open the discussion to save it there.");
    }
    setSavingFeaturedId(null);
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2TopNav unreadNotifications={homeData.unreadNotifications} />
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Welcome back, <span className="text-blue-600">{homeData.greetingName}</span>.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Here is what needs attention across your Loombus activity.</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Link href="/v2#signal-brief" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
              <Sparkles className="size-4" />
              Signal Brief
            </Link>
            <span className="text-sm font-semibold text-slate-500">Today</span>
          </div>
        </header>

        {homeMessage && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{homeMessage}</div>}
        {saveMessage && <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{saveMessage}</div>}

        <section id="signal-brief" className="mb-6 scroll-mt-24 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.12)] sm:p-6">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Needs attention</p>
          <div className="grid gap-4 lg:grid-cols-3">
            <AttentionCard title="New Replies" count={homeData.replyCount} description={`${formatCount(homeData.replyCount)} replies connected to your activity`} href="/v2/my-replies" actionLabel="View all replies" items={homeData.replyCount > 0 ? ["Unread replies in active discussions", "New context waiting for review"] : ["No new replies right now", "Recent replies will appear here"]}><Reply className="size-5" /></AttentionCard>
            <AttentionCard title="Saved Discussions" count={homeData.savedCount} description={`${formatCount(homeData.savedCount)} discussions saved`} href="/v2/saved" actionLabel="View all saved" items={homeData.savedCount > 0 ? ["Saved discussions ready to revisit", "Organized for later reading"] : ["No saved discussions yet", "Saved items will appear here"]}><Bookmark className="size-5" /></AttentionCard>
            <AttentionCard title="Labs Updates" count={labsUpdateCount} description={`${formatCount(labsUpdateCount)} Labs items available`} href="/v2/labs" actionLabel="View all updates" items={labsUpdates.slice(0, 3).map((item) => item.title)}><FlaskConical className="size-5" /></AttentionCard>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.13)] sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Featured signal</p>
              {homeLoading ? <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading featured signal...</div> : featuredDiscussion ? (
                <article className="mt-4 grid gap-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] ring-1 ring-white/80 transition sm:grid-cols-[260px_minmax(0,1fr)] sm:p-6">
                  <Link href={`/v2/discussions/${featuredDiscussion.id}`} className="grid min-h-56 place-items-center rounded-3xl bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-400 text-white shadow-inner"><Sparkles className="size-16" /></Link>
                  <div className="min-w-0">
                    <div className="mb-3 flex flex-wrap items-center gap-2"><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{featuredDiscussion.topic || "Discussion"}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">Discussion</span></div>
                    <Link href={`/v2/discussions/${featuredDiscussion.id}`} className="text-3xl font-black tracking-tight text-slate-950 transition hover:text-blue-700">{featuredDiscussion.title}</Link>
                    <p className="mt-3 text-base leading-7 text-slate-600">A recent discussion with signal worth reviewing.</p>
                    <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-sm font-bold text-slate-500">
                      <span>💬 {getCompactCount(featuredDiscussion.replyCount)}</span><span>🔖 {getCompactCount(featuredDiscussion.savedCount + (savedFeaturedIds.has(featuredDiscussion.id) ? 1 : 0))}</span><span>👁 {getCompactCount(featuredDiscussion.viewCount)}</span><span>{getRecentDiscussionAge(featuredDiscussion.created_at)}</span>
                      <button type="button" onClick={() => void saveFeaturedDiscussion(featuredDiscussion)} disabled={savingFeaturedId === featuredDiscussion.id || featuredSaved} className="ml-auto rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60">{savingFeaturedId === featuredDiscussion.id ? "Saving..." : featuredSaved ? "Saved" : "Save"}</button>
                      <Link href={`/v2/discussions/${featuredDiscussion.id}`} className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">View Discussion</Link>
                    </div>
                  </div>
                </article>
              ) : <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No featured signal yet.</div>}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_18px_44px_rgba(15,23,42,0.13)] sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Recent signals</p><Link href="/v2/discussions" className="text-sm font-black text-blue-700 transition hover:text-blue-900">View all</Link></div>
              <div className="space-y-3">
                {homeLoading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading recent discussions...</div>}
                {!homeLoading && recentSignals.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No recent signals are available yet.</div>}
                {!homeLoading && recentSignals.map((discussion) => <Link key={discussion.id} href={`/v2/discussions/${discussion.id}`} className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-950">{discussion.title}</h3><p className="mt-1 text-sm text-slate-500">{discussion.topic || "Discussion"} · {getRecentDiscussionAge(discussion.created_at)}</p></div><span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-orange-800">Signal {getSignalScore(discussion)}</span></div></Link>)}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Trending topics</h2><TrendingUp className="size-5 text-blue-600" /></div>
              <div className="mt-4 space-y-3">
                {trendingTopics.map(([topic, count], index) => <Link key={topic} href={`/v2/discussions${topic === "Discussions" ? "" : `?topic=${encodeURIComponent(topic)}`}`} className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2 font-bold text-slate-700"><span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>{topic}</span><span className="text-xs font-semibold text-slate-400">{count} signals</span></Link>)}
              </div>
              <Link href="/v2/discussions" className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm font-black text-blue-700">View all topics<ChevronRight className="size-4" /></Link>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Your Rooms</h2><Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3 text-sm">
                {roomRows.map((room) => <Link key={room.id} href={`/v2/rooms${room.slug ? `?room=${encodeURIComponent(room.slug)}` : ""}`} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 font-bold text-slate-700"><span className="flex items-center gap-3"><Users className="size-4 text-blue-600" /> <span><span className="block">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{formatCount(room.memberCount)} members{room.discussionCount > 0 ? ` · ${formatCount(room.discussionCount)} discussions` : ""}</span></span></span><span className="text-blue-600">•</span></Link>)}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}

export default function V2Page() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [homeData, setHomeData] = useState<V2HomeData>(DEFAULT_HOME_DATA);
  const [homeLoading, setHomeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [homeMessage, setHomeMessage] = useState("");

  async function loadV2HomeData({ accessToken, userId, email }: { accessToken: string; userId: string; email: string | null }) {
    setHomeLoading(true);
    setHomeMessage("");
    try {
      const [profileResult, unreadMessagesResult, notificationsResult, savedResult, authoredResult, repliesResult, recentResult, labsResult, roomsResult] = await Promise.allSettled([
        supabase.from("profiles").select("full_name, username").eq("id", userId).maybeSingle(),
        fetch("/api/messages/unread-count", { headers: { Authorization: `Bearer ${accessToken}` } }).then((response) => (response.ok ? response.json() : { unreadCount: 0 })),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("discussions").select("id, title, topic, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
        supabase.from("labs_feature_requests").select("id, title, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(3),
        fetch("/api/v2/rooms?limit=3", { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }).then((response) => (response.ok ? response.json() : { rooms: [] })),
      ]);

      const profile = profileResult.status === "fulfilled" && !profileResult.value.error ? (profileResult.value.data as { full_name: string | null; username: string | null } | null) : null;
      const unreadMessages = unreadMessagesResult.status === "fulfilled" ? Number(unreadMessagesResult.value?.unreadCount ?? 0) : 0;
      const unreadNotifications = notificationsResult.status === "fulfilled" ? notificationsResult.value.count ?? 0 : 0;
      const savedCount = savedResult.status === "fulfilled" ? savedResult.value.count ?? 0 : 0;
      const authoredDiscussionCount = authoredResult.status === "fulfilled" ? authoredResult.value.count ?? 0 : 0;
      const replyCount = repliesResult.status === "fulfilled" ? repliesResult.value.count ?? 0 : 0;
      const labsUpdateCount = labsResult.status === "fulfilled" && !labsResult.value.error ? (labsResult.value.count ?? 0) : DEFAULT_LABS_UPDATES.length;
      const labsUpdates = labsResult.status === "fulfilled" && !labsResult.value.error ? ((labsResult.value.data ?? []) as LabsUpdate[]) : DEFAULT_LABS_UPDATES;
      const rooms = roomsResult.status === "fulfilled" ? (((roomsResult.value?.rooms ?? []) as RoomSummary[]).slice(0, 3)) : DEFAULT_ROOMS;
      const recentRows = recentResult.status === "fulfilled" && !recentResult.value.error ? ((recentResult.value.data ?? []) as Array<Omit<RecentDiscussion, "replyCount" | "viewCount" | "savedCount" | "savedByViewer">>) : [];
      const recentIds = recentRows.map((discussion) => discussion.id);
      let replyCounts: Record<string, number> = {};
      let viewCounts: Record<string, number> = {};
      let bookmarkCounts: Record<string, number> = {};
      let viewerSavedDiscussionIds = new Set<string>();

      if (recentIds.length > 0) {
        const [recentReplies, recentViews, recentBookmarks, viewerBookmarks] = await Promise.all([
          supabase.from("replies").select("discussion_id").in("discussion_id", recentIds).is("deleted_at", null),
          supabase.from("discussion_views").select("discussion_id").in("discussion_id", recentIds),
          supabase.from("bookmarks").select("discussion_id").in("discussion_id", recentIds),
          supabase.from("bookmarks").select("discussion_id").eq("user_id", userId).in("discussion_id", recentIds),
        ]);
        for (const reply of recentReplies.data ?? []) replyCounts[reply.discussion_id] = (replyCounts[reply.discussion_id] ?? 0) + 1;
        for (const view of recentViews.data ?? []) viewCounts[view.discussion_id] = (viewCounts[view.discussion_id] ?? 0) + 1;
        for (const bookmark of recentBookmarks.data ?? []) bookmarkCounts[bookmark.discussion_id] = (bookmarkCounts[bookmark.discussion_id] ?? 0) + 1;
        viewerSavedDiscussionIds = new Set((viewerBookmarks.data ?? []).map((bookmark) => bookmark.discussion_id).filter(Boolean));
      }

      setHomeData({
        greetingName: getGreetingName({ fullName: profile?.full_name, username: profile?.username, email }),
        unreadMessages,
        unreadNotifications,
        savedCount,
        authoredDiscussionCount,
        replyCount,
        labsUpdateCount,
        labsUpdates: labsUpdates.length > 0 ? labsUpdates : DEFAULT_LABS_UPDATES,
        rooms: rooms.length > 0 ? rooms : DEFAULT_ROOMS,
        recentDiscussions: recentRows.map((discussion) => ({
          ...discussion,
          replyCount: replyCounts[discussion.id] ?? 0,
          viewCount: viewCounts[discussion.id] ?? 0,
          savedCount: bookmarkCounts[discussion.id] ?? 0,
          savedByViewer: viewerSavedDiscussionIds.has(discussion.id),
        })),
      });
    } catch {
      setHomeData((current) => ({ ...current, greetingName: current.greetingName || "there" }));
      setHomeMessage("Some V2 Home activity could not load. V1 remains available.");
    } finally {
      setHomeLoading(false);
    }
  }

  async function handleSaveFeaturedDiscussion(discussion: RecentDiscussion) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) return false;
    const response = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ discussionId: discussion.id }),
    });
    if (!response.ok && response.status !== 409) return false;
    setHomeData((current) => ({
      ...current,
      savedCount: current.savedCount + (discussion.savedByViewer ? 0 : 1),
      recentDiscussions: current.recentDiscussions.map((item) => item.id === discussion.id ? { ...item, savedByViewer: true, savedCount: item.savedByViewer ? item.savedCount : item.savedCount + 1 } : item),
    }));
    return true;
  }

  async function loadShell() {
    setLoading(true);
    setMessage("");
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadV2HomeData({ accessToken, userId: data.session.user.id, email: data.session.user.email ?? null });
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => { loadShell(); });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <ShellGateCard title="Checking V2 access" message="Loombus is verifying whether this account can use the V2 shell." loading />;
  if (message) return <ShellGateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <ShellGateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can check your access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return <V2Shell payload={payload} homeData={homeData} homeLoading={homeLoading} homeMessage={homeMessage} onSaveFeatured={handleSaveFeaturedDiscussion} />;
}
