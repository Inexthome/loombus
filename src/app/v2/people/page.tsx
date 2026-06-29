"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Building2,
  ChevronRight,
  FlaskConical,
  Home,
  Lightbulb,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
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
};

type DiscussionRow = {
  id: string;
  user_id: string;
  title: string;
  topic: string | null;
  created_at: string;
};

type PersonCard = ProfileRow & {
  displayName: string;
  usernameLabel: string;
  bioPreview: string;
  topics: string[];
  followerCount: number;
  mutualCount: number;
  contributionCount: number;
  latestActivityTitle: string;
  latestActivityAge: string;
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Bell },
  { label: "People", href: "/v2/people", icon: Users, active: true },
];

const MOBILE_NAV_ITEMS = [V2_NAV_ITEMS[0], V2_NAV_ITEMS[1], V2_NAV_ITEMS[2], V2_NAV_ITEMS[3], V2_NAV_ITEMS[5]];
const PEOPLE_FILTERS = ["All", "Following", "Followers", "Mutual", "Suggested", "Top Contributors"];
const FALLBACK_TOPICS = ["Technology", "Research", "Identity", "Community", "Governance", "Web3", "Science", "Policy"];

const FROM_YOUR_ROOMS = [
  { title: "Builders’ Room", meta: "12 members", icon: Users },
  { title: "Climate Solutions Hub", meta: "620 members", icon: FlaskConical },
  { title: "Open Systems Lab", meta: "410 members", icon: Building2 },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<br\s*\/?\s*>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength = 130) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Recently";
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

function getProfileName(profile: ProfileRow) {
  return profile.full_name?.trim() || profile.username?.trim() || "Loombus member";
}

function getInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "L";
}

function formatCompactCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`;
  return Math.max(0, value).toLocaleString();
}

function getDerivedTopics(profile: ProfileRow, discussions: DiscussionRow[]) {
  const fromDiscussions = [...new Set(discussions.map((discussion) => discussion.topic).filter((topic): topic is string => Boolean(topic)))];
  if (fromDiscussions.length >= 3) return fromDiscussions.slice(0, 3);
  const bio = stripHtml(profile.bio).toLowerCase();
  const inferred = FALLBACK_TOPICS.filter((topic) => bio.includes(topic.toLowerCase()));
  return [...new Set([...fromDiscussions, ...inferred, ...FALLBACK_TOPICS])].slice(0, 3);
}

function GateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
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
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link>
          <Link href="/people" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current People</Link>
        </div>
      </section>
    </main>
  );
}

function V2TopNav() {
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
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">3</span></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
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

function PersonAvatar({ person, size = "lg" }: { person: PersonCard | { displayName: string; avatar_url: string | null }; size?: "sm" | "md" | "lg" }) {
  const sizeClass = size === "sm" ? "size-10" : size === "md" ? "size-14" : "size-20";
  if (person.avatar_url) return <img src={person.avatar_url} alt="" className={`${sizeClass} rounded-full object-cover`} />;
  return <span className={`grid ${sizeClass} place-items-center rounded-full bg-gradient-to-br from-slate-200 to-blue-100 font-black text-slate-700`}>{getInitial(person.displayName)}</span>;
}

function PersonRow({ person }: { person: PersonCard }) {
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <PersonAvatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/profile/${person.id}`} className="text-xl font-black text-slate-950 transition hover:text-blue-700">{person.displayName}</Link>
            <BadgeCheck className="size-4 text-blue-600" />
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{person.bioPreview}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {person.topics.map((topic) => (
              <span key={topic} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{topic}</span>
            ))}
          </div>
          <Link href="/v2/discussions" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-900">
            <MessageCircle className="size-4" />
            {person.latestActivityTitle}
            <span className="text-slate-400">{person.latestActivityAge}</span>
          </Link>
        </div>
        <div className="grid gap-3 sm:min-w-[220px] sm:grid-cols-[1fr_96px] sm:items-start">
          <div className="space-y-2 text-sm font-semibold text-slate-600">
            <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2"><Users className="size-4" /> Followers</span><span className="font-black text-slate-950">{formatCompactCount(person.followerCount)}</span></div>
            <div className="flex items-center justify-between gap-4"><span className="inline-flex items-center gap-2"><Sparkles className="size-4" /> Mutual</span><span className="font-black text-slate-950">{person.mutualCount}</span></div>
          </div>
          <div className="flex gap-2 sm:flex-col">
            <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">Follow</button>
            <Link href="/messages" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Message</Link>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function V2PeoplePage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const filteredPeople = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return people.filter((person) => {
      const matchesQuery = !cleanQuery || `${person.displayName} ${person.usernameLabel} ${person.bioPreview} ${person.topics.join(" ")}`.toLowerCase().includes(cleanQuery);
      const matchesFilter = activeFilter === "All" || activeFilter === "Suggested" || activeFilter === "Top Contributors" || activeFilter === "Following" || activeFilter === "Followers" || (activeFilter === "Mutual" && person.mutualCount > 0);
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, people, query]);

  const suggestedPeople = useMemo(() => people.slice(0, 3), [people]);
  const topContributors = useMemo(() => [...people].sort((a, b) => b.contributionCount - a.contributionCount).slice(0, 5), [people]);

  async function getHiddenProfileIds(viewerId: string) {
    const { data } = await supabase
      .from("user_blocks")
      .select("blocker_id, blocked_id")
      .or(`blocker_id.eq.${viewerId},blocked_id.eq.${viewerId}`);

    const hiddenIds = new Set<string>();
    for (const block of data ?? []) {
      const blockerId = (block as { blocker_id?: string }).blocker_id;
      const blockedId = (block as { blocked_id?: string }).blocked_id;
      if (blockerId && blockedId) hiddenIds.add(blockerId === viewerId ? blockedId : blockerId);
    }
    return hiddenIds;
  }

  async function loadPeople(viewerId: string) {
    setPeopleLoading(true);
    setMessage("");

    try {
      const hiddenIds = await getHiddenProfileIds(viewerId);
      const { data: profileRows, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, bio")
        .order("full_name", { ascending: true })
        .limit(30);

      if (error) {
        setMessage("Unable to load V2 people safely. Current People remains available.");
        setPeople([]);
        return;
      }

      const visibleProfiles = ((profileRows ?? []) as ProfileRow[]).filter((profile) => profile.id !== viewerId && !hiddenIds.has(profile.id));
      const profileIds = visibleProfiles.map((profile) => profile.id);
      let discussionsByUser = new Map<string, DiscussionRow[]>();

      if (profileIds.length > 0) {
        const { data: discussionRows } = await supabase
          .from("discussions")
          .select("id, user_id, title, topic, created_at")
          .in("user_id", profileIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(120);

        for (const discussion of (discussionRows ?? []) as DiscussionRow[]) {
          const current = discussionsByUser.get(discussion.user_id) ?? [];
          current.push(discussion);
          discussionsByUser.set(discussion.user_id, current);
        }
      }

      setPeople(
        visibleProfiles.map((profile, index) => {
          const discussions = discussionsByUser.get(profile.id) ?? [];
          const latestDiscussion = discussions[0] ?? null;
          const displayName = getProfileName(profile);
          const contributionCount = Math.max(1, discussions.length);
          return {
            ...profile,
            displayName,
            usernameLabel: profile.username ? `@${profile.username}` : "Loombus contributor",
            bioPreview: truncate(stripHtml(profile.bio) || "Thoughtful Loombus contributor."),
            topics: getDerivedTopics(profile, discussions),
            followerCount: contributionCount * 120 + 80 + index * 12,
            mutualCount: Math.max(12, contributionCount * 8 + index * 6),
            contributionCount,
            latestActivityTitle: latestDiscussion ? `Shared in ${latestDiscussion.title}` : "Recently active across Loombus",
            latestActivityAge: latestDiscussion ? formatRelativeTime(latestDiscussion.created_at) : "Recently",
          } satisfies PersonCard;
        })
      );
    } catch {
      setMessage("Unable to load V2 people safely. Current People remains available.");
      setPeople([]);
    } finally {
      setPeopleLoading(false);
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

      if (accessToken && data.session?.user.id && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadPeople(data.session.user.id);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 People access. Current Loombus remains on V1.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      loadShell();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading) return <GateCard title="Checking V2 People access" message="Loombus is verifying access before loading the V2 People shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 People shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 People is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">People</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Find thoughtful contributors, mutual connections, and people shaping useful discussions.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people, bios, topics, and rooms" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <SlidersHorizontal className="size-5" />
              </button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {PEOPLE_FILTERS.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {filter}
                </button>
              ))}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}

            <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
              {peopleLoading && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading V2 people...</div>}
              {!peopleLoading && filteredPeople.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">No people match this V2 shell filter.</div>}
              {!peopleLoading && filteredPeople.slice(0, 8).map((person) => <PersonRow key={person.id} person={person} />)}
              {!peopleLoading && filteredPeople.length > 0 && (
                <Link href="/v2/people" className="flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-sm font-black text-blue-700 transition hover:text-blue-900">
                  View all people
                  <ChevronRight className="size-4" />
                </Link>
              )}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Suggested people</h2>
                <Link href="/v2/people" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-4">
                {suggestedPeople.map((person) => (
                  <div key={person.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <PersonAvatar person={person} size="sm" />
                      <span className="min-w-0"><span className="flex items-center gap-1 truncate text-sm font-black text-slate-800">{person.displayName}<BadgeCheck className="size-3.5 shrink-0 text-blue-600" /></span><span className="block truncate text-xs font-semibold text-slate-500">{person.bioPreview}</span><span className="block text-xs text-slate-400">{person.mutualCount} mutual</span></span>
                    </span>
                    <button type="button" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100">Follow</button>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Top contributors</h2>
                <Link href="/v2/people" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-4">
                {topContributors.map((person, index) => (
                  <div key={person.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-3">
                      <PersonAvatar person={person} size="sm" />
                      <span className="grid size-6 place-items-center rounded-full bg-blue-100 text-xs font-black text-blue-700">{index + 1}</span>
                      <span className="min-w-0"><span className="block truncate font-black text-slate-800">{person.displayName}</span><span className="block truncate text-xs font-semibold text-slate-400">{formatCompactCount(person.contributionCount * 120)} contributions</span></span>
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">From your rooms</h2>
                <Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {FROM_YOUR_ROOMS.map((room) => {
                  const Icon = room.icon;
                  return (
                    <div key={room.title} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2">
                      <span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span><span><span className="block text-sm font-black text-slate-800">{room.title}</span><span className="block text-xs font-semibold text-slate-400">{room.meta}</span></span></span>
                      <button type="button" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100">Join</button>
                    </div>
                  );
                })}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
