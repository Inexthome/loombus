"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  FileText,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Reply,
  Search,
  Settings,
  ShieldCheck,
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
  appearance_theme: "system" | "dark_gold" | "light_blue" | null;
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
};

type V2HomeData = {
  greetingName: string;
  unreadMessages: number;
  unreadNotifications: number;
  savedCount: number;
  authoredDiscussionCount: number;
  replyCount: number;
  recentDiscussions: RecentDiscussion[];
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const DEFAULT_HOME_DATA: V2HomeData = {
  greetingName: "there",
  unreadMessages: 0,
  unreadNotifications: 0,
  savedCount: 0,
  authoredDiscussionCount: 0,
  replyCount: 0,
  recentDiscussions: [],
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home, active: true },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
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
          <Link href="/discussions" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Return to V1
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Recheck access
          </button>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] text-white shadow-sm">
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
                    ? "bg-white/10 text-white ring-1 ring-white/20"
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
          <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
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

function AttentionCard({ title, count, description, href, children }: { title: string; count: number; description: string; href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="block rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
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
    </Link>
  );
}

function V2Shell({ payload, homeData, homeLoading, homeMessage }: { payload: ShellPayload; homeData: V2HomeData; homeLoading: boolean; homeMessage: string }) {
  const attentionCount = homeData.unreadMessages + homeData.unreadNotifications;
  const contributionCount = homeData.authoredDiscussionCount + homeData.replyCount;
  const featuredDiscussion = homeData.recentDiscussions[0] ?? null;
  const recentSignals = homeData.recentDiscussions.slice(1, 5);
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const discussion of homeData.recentDiscussions) {
      const topic = discussion.topic || "Discussion";
      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [homeData.recentDiscussions]);

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Welcome back, <span className="text-blue-600">{homeData.greetingName}</span>.
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Here is what needs attention across your Loombus activity.</p>
          </div>
          <Link href="/v2#signal-brief" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
            <Sparkles className="size-4" />
            Signal Brief
          </Link>
        </header>

        {homeMessage && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{homeMessage}</div>}

        <section className="mb-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">Needs attention</p>
          <div className="grid gap-4 lg:grid-cols-3">
            <AttentionCard title="New Replies" count={homeData.replyCount} description={`${formatCount(homeData.replyCount)} replies connected to your activity`} href="/my-activity">
              <Reply className="size-5" />
            </AttentionCard>
            <AttentionCard title="Saved Discussions" count={homeData.savedCount} description={`${formatCount(homeData.savedCount)} discussions saved`} href="/saved">
              <Bookmark className="size-5" />
            </AttentionCard>
            <AttentionCard title="Alerts" count={attentionCount} description={`${formatCount(homeData.unreadMessages)} messages and ${formatCount(homeData.unreadNotifications)} notifications`} href="/notifications">
              <Bell className="size-5" />
            </AttentionCard>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Featured signal</p>
              {homeLoading ? (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading featured signal...</div>
              ) : featuredDiscussion ? (
                <Link href={`/v2/discussions/${featuredDiscussion.id}`} className="mt-4 grid gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="grid aspect-video place-items-center rounded-2xl bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-400 text-5xl font-black text-white md:aspect-square">
                    {(featuredDiscussion.topic || "L").slice(0, 1)}
                  </div>
                  <div className="min-w-0 self-center">
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">{featuredDiscussion.title}</h2>
                    <span className="mt-3 inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">{featuredDiscussion.topic || "Discussion"}</span>
                    <p className="mt-4 text-sm leading-6 text-slate-600">A recent discussion with signal worth reviewing.</p>
                    <div className="mt-5 flex flex-wrap items-center gap-5 text-xs font-bold text-slate-500">
                      <span>💬 {getCompactCount(homeData.replyCount)}</span>
                      <span>🔖 {getCompactCount(homeData.savedCount)}</span>
                      <span>{getRecentDiscussionAge(featuredDiscussion.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No featured signal yet.</div>
              )}
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Recent signals</p>
                <Link href="/v2/discussions" className="text-sm font-black text-blue-700 transition hover:text-blue-900">View all</Link>
              </div>
              <div className="space-y-3">
                {homeLoading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading recent discussions...</div>}
                {!homeLoading && recentSignals.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">No recent signals are available yet.</div>}
                {!homeLoading && recentSignals.map((discussion) => (
                  <Link key={discussion.id} href={`/v2/discussions/${discussion.id}`} className="block rounded-3xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50/50">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="font-black text-slate-950">{discussion.title}</h3>
                        <p className="mt-1 text-sm text-slate-500">{discussion.topic || "Discussion"} · {getRecentDiscussionAge(discussion.created_at)}</p>
                      </div>
                      <MessageCircle className="size-5 text-blue-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Trending topics</h2>
                <TrendingUp className="size-5 text-blue-600" />
              </div>
              <div className="mt-4 space-y-3">
                {(topicCounts.length > 0 ? topicCounts : [["Discussions", 0]]).map(([topic, count], index) => (
                  <Link key={topic} href="/v2/discussions" className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-bold text-slate-700">
                      <span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
                      {topic}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">{count} signals</span>
                  </Link>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Your Rooms</h2>
              <div className="mt-4 space-y-3 text-sm">
                <Link href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 font-bold text-slate-700">
                  <span className="flex items-center gap-3"><Users className="size-4 text-blue-600" /> Loombus Research Lab</span>
                  <span className="text-blue-600">•</span>
                </Link>
                <Link href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 font-bold text-slate-700">
                  <span className="flex items-center gap-3"><Users className="size-4 text-blue-600" /> Builders’ Room</span>
                  <span className="text-blue-600">•</span>
                </Link>
                <Link href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-3 font-bold text-slate-700">
                  <span className="flex items-center gap-3"><Users className="size-4 text-blue-600" /> Civic Futures Lab</span>
                  <span className="text-blue-600">•</span>
                </Link>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-600" />
                <h2 className="font-black text-slate-950">Rollout state</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl bg-blue-50 p-3"><p className="font-black text-blue-700">{payload.flags.v2_shell ? "On" : "Off"}</p><p className="text-xs font-bold text-slate-500">V2 shell</p></div>
                <div className="rounded-2xl bg-blue-50 p-3"><p className="font-black text-blue-700">{payload.flags.v2_rooms ? "On" : "Off"}</p><p className="text-xs font-bold text-slate-500">Rooms</p></div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">Public users remain on V1 until the full V2 shell passes your test.</p>
            </section>

            <section id="signal-brief" className="rounded-[2rem] border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-blue-700" />
                <h2 className="font-black text-blue-950">Signal Brief</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-blue-900">{attentionCount > 0 ? "You have activity to review before moving deeper into discussions." : "No urgent activity. Continue building signal at your pace."}</p>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><FileText className="size-6 text-blue-600" /><h3 className="mt-3 font-black text-slate-950">Signal First</h3><p className="mt-1 text-xs leading-5 text-slate-500">Surface what matters most across your activity.</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><MessageCircle className="size-6 text-blue-600" /><h3 className="mt-3 font-black text-slate-950">Structured Discussions</h3><p className="mt-1 text-xs leading-5 text-slate-500">Topic-driven conversations with clear context.</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><Users className="size-6 text-blue-600" /><h3 className="mt-3 font-black text-slate-950">Quality Connections</h3><p className="mt-1 text-xs leading-5 text-slate-500">Engage with people and ideas that add value.</p></div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><ShieldCheck className="size-6 text-blue-600" /><h3 className="mt-3 font-black text-slate-950">Thoughtful by Design</h3><p className="mt-1 text-xs leading-5 text-slate-500">A calm, focused experience built for deep engagement.</p></div>
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
      const [profileResult, unreadMessagesResult, notificationsResult, savedResult, authoredResult, repliesResult, recentResult] = await Promise.allSettled([
        supabase.from("profiles").select("full_name, username").eq("id", userId).maybeSingle(),
        fetch("/api/messages/unread-count", { headers: { Authorization: `Bearer ${accessToken}` } }).then((response) => (response.ok ? response.json() : { unreadCount: 0 })),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null),
        supabase.from("bookmarks").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("discussions").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("replies").select("id", { count: "exact", head: true }).eq("user_id", userId).is("deleted_at", null),
        supabase.from("discussions").select("id, title, topic, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(5),
      ]);

      const profile = profileResult.status === "fulfilled" && !profileResult.value.error
        ? (profileResult.value.data as { full_name: string | null; username: string | null } | null)
        : null;
      const unreadMessages = unreadMessagesResult.status === "fulfilled" ? Number(unreadMessagesResult.value?.unreadCount ?? 0) : 0;
      const unreadNotifications = notificationsResult.status === "fulfilled" ? notificationsResult.value.count ?? 0 : 0;
      const savedCount = savedResult.status === "fulfilled" ? savedResult.value.count ?? 0 : 0;
      const authoredDiscussionCount = authoredResult.status === "fulfilled" ? authoredResult.value.count ?? 0 : 0;
      const replyCount = repliesResult.status === "fulfilled" ? repliesResult.value.count ?? 0 : 0;
      const recentDiscussions = recentResult.status === "fulfilled" && !recentResult.value.error ? ((recentResult.value.data ?? []) as RecentDiscussion[]) : [];

      setHomeData({
        greetingName: getGreetingName({ fullName: profile?.full_name, username: profile?.username, email }),
        unreadMessages,
        unreadNotifications,
        savedCount,
        authoredDiscussionCount,
        replyCount,
        recentDiscussions,
      });
    } catch {
      setHomeData((current) => ({ ...current, greetingName: current.greetingName || "there" }));
      setHomeMessage("Some V2 Home activity could not load. V1 remains available.");
    } finally {
      setHomeLoading(false);
    }
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
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <ShellGateCard title="Checking V2 access" message="Loombus is verifying whether this account can use the V2 shell." loading />;
  if (message) return <ShellGateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <ShellGateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can check your access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  return <V2Shell payload={payload} homeData={homeData} homeLoading={homeLoading} homeMessage={homeMessage} />;
}
