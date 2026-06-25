"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
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
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type AppearanceOption = {
  key: "system" | "dark_gold" | "light_blue";
  label: string;
  description: string;
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
  appearanceOptions?: AppearanceOption[];
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
  { label: "Discussions", href: "/discussions", icon: MessageCircle },
  { label: "Create", href: "/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2#rooms", icon: Users },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Alerts", href: "/notifications", icon: Bell },
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

function getGreetingName({
  fullName,
  username,
  email,
}: {
  fullName?: string | null;
  username?: string | null;
  email?: string | null;
}) {
  const profileName = fullName?.trim() || username?.trim();

  if (profileName) {
    return profileName.split(/\s+/)[0] ?? profileName;
  }

  const emailName = email?.split("@")[0]?.trim();

  return emailName || "there";
}

function getRecentDiscussionAge(value: string) {
  const createdAt = new Date(value).getTime();

  if (!Number.isFinite(createdAt)) {
    return "Recently";
  }

  const diffMs = Date.now() - createdAt;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);

  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function FlagPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}: {enabled ? "on" : "off"}
    </span>
  );
}

function MetricCard({
  title,
  value,
  description,
  href,
  action,
  urgent = false,
}: {
  title: string;
  value: string;
  description: string;
  href: string;
  action: string;
  urgent?: boolean;
}) {
  return (
    <article
      className={`rounded-3xl border p-4 ${
        urgent
          ? "border-blue-300/35 bg-blue-500/15"
          : "border-white/10 bg-slate-950/45"
      }`}
    >
      <p className="text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
      <p className="mt-2 min-h-10 text-xs leading-5 text-slate-400">{description}</p>
      <Link
        href={href}
        className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-blue-300/40 hover:text-white"
      >
        {action}
      </Link>
    </article>
  );
}

function ShellGateCard({
  title,
  message,
  payload,
  loading = false,
}: {
  title: string;
  message: string;
  payload?: ShellPayload | null;
  loading?: boolean;
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
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>

        {payload && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/discussions"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Return to V1
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            Recheck access
          </button>
        </div>
      </section>
    </main>
  );
}

function V2Shell({
  payload,
  homeData,
  homeLoading,
  homeMessage,
}: {
  payload: ShellPayload;
  homeData: V2HomeData;
  homeLoading: boolean;
  homeMessage: string;
}) {
  const appearanceLabel = useMemo(() => {
    const preference = payload.preferences?.appearance_theme ?? "system";
    return payload.appearanceOptions?.find((option) => option.key === preference)?.label ?? "System";
  }, [payload.appearanceOptions, payload.preferences?.appearance_theme]);

  const attentionCount = homeData.unreadMessages + homeData.unreadNotifications;
  const contributionCount = homeData.authoredDiscussionCount + homeData.replyCount;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-24 border-r border-white/10 bg-slate-950/80 px-3 py-5 backdrop-blur-xl lg:flex lg:flex-col lg:items-center">
        <Link
          href="/v2"
          aria-label="Loombus V2 home"
          className="mb-7 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5"
        >
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
        </Link>

        <nav aria-label="V2 navigation" className="flex flex-1 flex-col items-center gap-2">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`group relative grid size-12 place-items-center rounded-2xl border transition ${
                  item.primary
                    ? "border-blue-400/40 bg-blue-500 text-white shadow-lg shadow-blue-950/30"
                    : item.active
                      ? "border-white/15 bg-white/10 text-white"
                      : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-5" />
                <span className="pointer-events-none absolute left-[3.75rem] z-30 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/discussions"
          className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          V1
        </Link>
      </aside>

      <div className="relative z-10 lg:pl-24">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Shell</p>
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Signal over noise</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:inline-flex">
                {appearanceLabel}
              </span>
              <Link
                href="/search"
                aria-label="Search"
                className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white"
              >
                <Search className="size-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/30">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-200">Welcome back, {homeData.greetingName}.</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
                    Here is what needs attention across Loombus.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    V2 Home is now reading live account activity while keeping Discussions, Create, and all public navigation on the current V1 experience.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                  Feature flag active
                </div>
              </div>

              {homeMessage && (
                <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  {homeMessage}
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetricCard
                  title="Needs Attention"
                  value={homeLoading ? "..." : formatCount(attentionCount)}
                  description={
                    attentionCount > 0
                      ? "Unread messages and notifications are waiting for review."
                      : "No unread messages or notifications right now."
                  }
                  href={attentionCount > 0 ? "/notifications" : "/messages"}
                  action={attentionCount > 0 ? "Review activity" : "View inbox"}
                  urgent={attentionCount > 0}
                />
                <MetricCard
                  title="Your Signal"
                  value={homeLoading ? "..." : formatCount(contributionCount)}
                  description="Discussions and replies you have contributed across Loombus."
                  href="/my-activity"
                  action="Open activity"
                  urgent={contributionCount > 0}
                />
                <MetricCard
                  title="Saved Ideas"
                  value={homeLoading ? "..." : formatCount(homeData.savedCount)}
                  description={
                    homeData.savedCount > 0
                      ? "Return to discussions you marked as worth keeping."
                      : "Save useful discussions to build your personal signal shelf."
                  }
                  href="/saved"
                  action={homeData.savedCount > 0 ? "Review saved" : "Browse discussions"}
                  urgent={homeData.savedCount > 0}
                />
              </div>
            </div>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-200">Recent Signals</p>
                  <h2 className="mt-2 text-2xl font-bold">Latest discussions</h2>
                </div>
                <Link href="/discussions" className="rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-blue-300/40 hover:text-white">
                  Open V1 feed
                </Link>
              </div>

              <div className="space-y-3">
                {homeLoading && (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    Loading recent discussions...
                  </div>
                )}

                {!homeLoading && homeData.recentDiscussions.length === 0 && (
                  <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300">
                    No recent discussions are available yet.
                  </div>
                )}

                {!homeLoading && homeData.recentDiscussions.map((discussion) => (
                  <Link
                    key={discussion.id}
                    href={`/discussions/${discussion.id}`}
                    className="block rounded-3xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-blue-300/35 hover:bg-blue-500/10"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">
                        {discussion.topic || "Discussion"}
                      </p>
                      <span className="text-xs text-slate-500">{getRecentDiscussionAge(discussion.created_at)}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold tracking-tight text-white">{discussion.title}</h3>
                  </Link>
                ))}
              </div>
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/discussions" className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-blue-300/30 hover:bg-blue-500/10">
                <MessageCircle className="size-6 text-blue-200" />
                <h3 className="mt-4 text-xl font-bold">Continue discussions</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">Use the existing discussion experience while V2 feed screens are wired in safely.</p>
              </Link>

              <Link href="/create" className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-blue-300/30 hover:bg-blue-500/10">
                <Plus className="size-6 text-blue-200" />
                <h3 className="mt-4 text-xl font-bold">Create a signal</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">Start from the current composer until the V2 composer is connected behind the flag.</p>
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold">Rollout state</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
                <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
                <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                V2 is visible only when the server resolves access for the signed-in user. Public users remain on V1.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <Reply className="size-5 text-blue-200" />
                <h2 className="font-bold">Your activity</h2>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-2xl font-bold">{homeLoading ? "..." : formatCount(homeData.authoredDiscussionCount)}</p>
                  <p className="mt-1 text-xs text-slate-400">Discussions</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-2xl font-bold">{homeLoading ? "..." : formatCount(homeData.replyCount)}</p>
                  <p className="mt-1 text-xs text-slate-400">Replies</p>
                </div>
              </div>
              <Link href="/my-activity" className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-blue-300/40 hover:text-white">
                View activity
              </Link>
            </section>

            <section id="rooms" className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <Users className="size-5 text-blue-200" />
                <h2 className="font-bold">Rooms</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {payload.flags.v2_rooms
                  ? "Rooms are available for this account and can be connected to the V2 room directory next."
                  : "Rooms are installed in the backend but still hidden behind v2_rooms."}
              </p>
            </section>

            <section className="rounded-[2rem] border border-[#d4af37]/25 bg-[#d4af37]/10 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-[#f7d56d]" />
                <h2 className="font-bold text-[#f7d56d]">Next wiring</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#fff3c4]">
                V2 Home now reads live account data. Next, we can wire V2-specific Discussions, Create, Rooms, and Messages without touching V1 defaults.
              </p>
            </section>
          </aside>
        </section>
      </div>
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

  async function loadV2HomeData({
    accessToken,
    userId,
    email,
  }: {
    accessToken: string;
    userId: string;
    email: string | null;
  }) {
    setHomeLoading(true);
    setHomeMessage("");

    try {
      const [
        profileResult,
        unreadMessagesResult,
        notificationsResult,
        savedResult,
        authoredResult,
        repliesResult,
        recentResult,
      ] = await Promise.allSettled([
        supabase
          .from("profiles")
          .select("full_name, username")
          .eq("id", userId)
          .maybeSingle(),
        fetch("/api/messages/unread-count", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then((response) => (response.ok ? response.json() : { unreadCount: 0 })),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("read_at", null),
        supabase
          .from("bookmarks")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId),
        supabase
          .from("discussions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("replies")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .is("deleted_at", null),
        supabase
          .from("discussions")
          .select("id, title, topic, created_at")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const profile =
        profileResult.status === "fulfilled" && !profileResult.value.error
          ? (profileResult.value.data as { full_name: string | null; username: string | null } | null)
          : null;

      const unreadMessages =
        unreadMessagesResult.status === "fulfilled"
          ? Number(unreadMessagesResult.value?.unreadCount ?? 0)
          : 0;

      const unreadNotifications =
        notificationsResult.status === "fulfilled" ? notificationsResult.value.count ?? 0 : 0;
      const savedCount = savedResult.status === "fulfilled" ? savedResult.value.count ?? 0 : 0;
      const authoredDiscussionCount = authoredResult.status === "fulfilled" ? authoredResult.value.count ?? 0 : 0;
      const replyCount = repliesResult.status === "fulfilled" ? repliesResult.value.count ?? 0 : 0;
      const recentDiscussions =
        recentResult.status === "fulfilled" && !recentResult.value.error
          ? ((recentResult.value.data ?? []) as RecentDiscussion[])
          : [];

      setHomeData({
        greetingName: getGreetingName({
          fullName: profile?.full_name,
          username: profile?.username,
          email,
        }),
        unreadMessages,
        unreadNotifications,
        savedCount,
        authoredDiscussionCount,
        replyCount,
        recentDiscussions,
      });
    } catch {
      setHomeData((current) => ({
        ...current,
        greetingName: current.greetingName || "there",
      }));
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
      const response = await fetch("/api/v2/shell", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;

      setPayload(nextPayload);

      if (
        accessToken &&
        data.session?.user?.id &&
        nextPayload.configured &&
        nextPayload.flags.v2_shell &&
        nextPayload.version === "v2"
      ) {
        await loadV2HomeData({
          accessToken,
          userId: data.session.user.id,
          email: data.session.user.email ?? null,
        });
      } else {
        setHomeData(DEFAULT_HOME_DATA);
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

  if (loading) {
    return (
      <ShellGateCard
        title="Checking V2 access"
        message="Loombus is verifying whether this signed-in account is allowed to use the V2 shell."
        loading
      />
    );
  }

  if (message) {
    return (
      <ShellGateCard
        title="V2 access check failed safely"
        message={message}
        payload={payload}
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <ShellGateCard
        title="Sign in required"
        message="The V2 shell is internal-only right now. Sign in first so Loombus can check the v2_shell rollout flag for your account."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <ShellGateCard
        title="V2 shell is not enabled"
        message="The V2 shell foundation is installed, but this account is not currently allowed through the v2_shell flag. This is expected until you add your user ID to the allowlist."
        payload={payload}
      />
    );
  }

  return (
    <V2Shell
      payload={payload}
      homeData={homeData}
      homeLoading={homeLoading}
      homeMessage={homeMessage}
    />
  );
}
