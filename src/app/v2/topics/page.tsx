"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Compass,
  Filter,
  Heart,
  Home,
  Landmark,
  Layers,
  Leaf,
  LineChart,
  Loader2,
  Lock,
  Mail,
  MessageCircle,
  Network,
  Plus,
  Search,
  Shield,
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

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
};

type TopicCard = {
  name: string;
  description: string;
  followers: string;
  newToday: string;
  contributor: string;
  contributorMeta: string;
  update: string;
  time: string;
  cta: "Follow" | "View Topic";
  icon: LucideIcon;
  tone: string;
};

type FollowedTopic = {
  name: string;
  followers: string;
  icon: LucideIcon;
  tone: string;
};

type TrendingTopic = {
  name: string;
  signals: string;
};

type Contributor = {
  name: string;
  org: string;
  signals: string;
};

type SuggestedTopic = {
  name: string;
  followers: string;
  icon: LucideIcon;
  tone: string;
};

type Benefit = {
  label: string;
  detail: string;
  icon: LucideIcon;
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
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Messages", href: "/v2/messages", icon: Mail },
];

const FILTERS = ["All Topics", "Following", "Trending", "Technology", "Society", "Governance", "Science", "Local", "Climate"];

const TOPICS: TopicCard[] = [
  {
    name: "Decentralized Identity",
    description: "Exploring self-sovereign identity, privacy, and digital trust.",
    followers: "1.2k followers",
    newToday: "128 new today",
    contributor: "Nadia Karim",
    contributorMeta: "Decentralized identity standards update",
    update: "Decentralized identity standards update",
    time: "2h ago",
    cta: "Follow",
    icon: Shield,
    tone: "bg-cyan-700 text-white",
  },
  {
    name: "AI Alignment",
    description: "Ensuring AI systems are safe, aligned, and beneficial.",
    followers: "980 followers",
    newToday: "86 new today",
    contributor: "Ethan Cole",
    contributorMeta: "New research on alignment evaluation",
    update: "New research on alignment evaluation",
    time: "3h ago",
    cta: "Follow",
    icon: Sparkles,
    tone: "bg-violet-700 text-white",
  },
  {
    name: "Climate Tech",
    description: "Innovations and policies for a sustainable future.",
    followers: "870 followers",
    newToday: "72 new today",
    contributor: "Mira Patel",
    contributorMeta: "Climate tech funding surges in Q2",
    update: "Climate tech funding surges in Q2",
    time: "4h ago",
    cta: "Follow",
    icon: Leaf,
    tone: "bg-emerald-600 text-white",
  },
  {
    name: "Digital Commons",
    description: "Building open, fair, and accessible digital ecosystems.",
    followers: "640 followers",
    newToday: "64 new today",
    contributor: "James Wu",
    contributorMeta: "Open data for public good",
    update: "Open data for public good",
    time: "5h ago",
    cta: "Follow",
    icon: Users,
    tone: "bg-blue-700 text-white",
  },
  {
    name: "Web3 Governance",
    description: "Designing transparent, participatory systems for the decentralized web.",
    followers: "520 followers",
    newToday: "52 new today",
    contributor: "Alex Rivera",
    contributorMeta: "DAO governance models compared",
    update: "DAO governance models compared",
    time: "6h ago",
    cta: "View Topic",
    icon: Landmark,
    tone: "bg-indigo-700 text-white",
  },
  {
    name: "Civic Futures",
    description: "Strengthening communities through policy, tech, and participation.",
    followers: "410 followers",
    newToday: "36 new today",
    contributor: "Tanya Fields",
    contributorMeta: "Local civic innovation spotlight",
    update: "Local civic innovation spotlight",
    time: "7h ago",
    cta: "Follow",
    icon: Network,
    tone: "bg-green-700 text-white",
  },
];

const FOLLOWED_TOPICS: FollowedTopic[] = [
  { name: "Decentralized Identity", followers: "1.2k followers", icon: Shield, tone: "bg-cyan-700 text-white" },
  { name: "Climate Tech", followers: "870 followers", icon: Leaf, tone: "bg-emerald-600 text-white" },
  { name: "Web3 Governance", followers: "520 followers", icon: Landmark, tone: "bg-indigo-700 text-white" },
  { name: "Civic Futures", followers: "410 followers", icon: Network, tone: "bg-green-700 text-white" },
];

const TRENDING_TOPICS: TrendingTopic[] = [
  { name: "Decentralized Identity", signals: "1.2k signals" },
  { name: "AI Alignment", signals: "980 signals" },
  { name: "Climate Tech", signals: "870 signals" },
  { name: "Digital Commons", signals: "640 signals" },
  { name: "Web3 Governance", signals: "520 signals" },
];

const CONTRIBUTORS: Contributor[] = [
  { name: "Nadia Karim", org: "Loombus Lab", signals: "1.8k signals" },
  { name: "Ethan Cole", org: "Civic Futures Lab", signals: "1.6k signals" },
  { name: "Mira Patel", org: "Open Systems Lab", signals: "1.4k signals" },
  { name: "Alex Rivera", org: "Community Lab", signals: "1.2k signals" },
];

const SUGGESTED_TOPICS: SuggestedTopic[] = [
  { name: "Open Science", followers: "380 followers", icon: Landmark, tone: "bg-blue-700 text-white" },
  { name: "Ethical Tech", followers: "420 followers", icon: Shield, tone: "bg-emerald-700 text-white" },
  { name: "Smart Cities", followers: "310 followers", icon: Layers, tone: "bg-cyan-700 text-white" },
];

const BENEFITS: Benefit[] = [
  { label: "Idea-Based Discovery", detail: "Browse conversations by topics that matter, not algorithms.", icon: Compass },
  { label: "Follow Topics", detail: "Stay updated on the ideas and themes you care about.", icon: Heart },
  { label: "Trending Signals", detail: "See what’s gaining traction across the community.", icon: TrendingUp },
  { label: "Structured Exploration", detail: "Navigate topics with clarity and context that scales.", icon: Layers },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
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
        {payload && <p className="mt-5 text-xs text-slate-300">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</p>}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">Back to V2 Home</Link>
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
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Search className="size-5" /></Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white"><Bell className="size-5" /><span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">8</span></Link>
        </div>
      </div>
    </header>
  );
}

function MobileBottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {MOBILE_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500">
              <Icon className={`size-5 ${item.primary ? "rounded-full bg-blue-600 p-1 text-white" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function TopicCardView({ topic }: { topic: TopicCard }) {
  const Icon = topic.icon;

  return (
    <article className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md sm:p-5">
      <div className="flex gap-4">
        <span className={`grid size-14 shrink-0 place-items-center rounded-2xl ${topic.tone} sm:size-16`}>
          <Icon className="size-8" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-black text-slate-950 sm:text-lg">{topic.name}</h2>
              <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{topic.description}</p>
            </div>
            <button type="button" className="hidden shrink-0 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:inline-flex">{topic.cta}</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs font-bold text-slate-500">
            <span>{topic.followers}</span>
            <span className="inline-flex items-center gap-2"><span className="size-1.5 rounded-full bg-blue-600" />{topic.newToday}</span>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-900">{topic.contributor.split(" ").map((part) => part[0]).join("")}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-950">{topic.contributor} <span className="text-blue-600">●</span></p>
              <p className="truncate text-xs font-semibold text-slate-500">{topic.update}</p>
              <p className="text-xs font-semibold text-slate-500">{topic.time}</p>
            </div>
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50 sm:hidden">{topic.cta}</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FollowedTopicsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Followed Topics</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {FOLLOWED_TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <article key={topic.name} className="flex items-center gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${topic.tone}`}><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{topic.name}</h3>
                <p className="text-xs font-semibold text-slate-500">{topic.followers}</p>
              </div>
              <span className="size-2 rounded-full bg-emerald-500" />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrendingTopicsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Trending Topics</h2>
        <LineChart className="size-4 text-blue-700" />
      </div>
      <div className="space-y-3">
        {TRENDING_TOPICS.map((topic, index) => (
          <article key={topic.name} className="flex items-center gap-3 text-sm">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-blue-600 text-xs font-black text-white">{index + 1}</span>
            <h3 className="min-w-0 flex-1 truncate font-black text-slate-950">{topic.name}</h3>
            <span className="text-xs font-semibold text-slate-500">{topic.signals}</span>
          </article>
        ))}
      </div>
      <button type="button" className="mt-5 flex w-full items-center justify-between text-sm font-black text-blue-700">View all topics <ChevronRight className="size-4" /></button>
    </section>
  );
}

function ContributorsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Top Contributors</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {CONTRIBUTORS.map((contributor) => (
          <article key={contributor.name} className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-xs font-black text-amber-900">{contributor.name.split(" ").map((part) => part[0]).join("")}</span>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-black text-slate-950">{contributor.name}</h3>
              <p className="truncate text-xs font-semibold text-slate-500">{contributor.org}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-slate-500">{contributor.signals}</p>
              <button type="button" className="mt-1 rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Follow</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function SuggestedTopicsCard() {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-slate-700">Suggested Topics</h2>
        <button type="button" className="text-xs font-black text-blue-700">View all</button>
      </div>
      <div className="space-y-4">
        {SUGGESTED_TOPICS.map((topic) => {
          const Icon = topic.icon;
          return (
            <article key={topic.name} className="flex items-center gap-3">
              <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${topic.tone}`}><Icon className="size-5" /></span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black text-slate-950">{topic.name}</h3>
                <p className="text-xs font-semibold text-slate-500">{topic.followers}</p>
              </div>
              <button type="button" className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Follow</button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default function V2TopicsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadShell() {
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      const response = await fetch("/api/v2/shell", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
      const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
      setPayload(nextPayload);
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

  if (loading) return <GateCard title="Checking V2 Topics access" message="Loombus is verifying access before loading the V2 Topics shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Topics shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Topics is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-5">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Topics</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Explore conversations organized by ideas, themes, and real-world interests.</p>
        </header>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <div className="flex gap-3">
              <label className="relative flex-1">
                <span className="sr-only">Search topics</span>
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                <input type="search" placeholder="Search topics" className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-semibold text-slate-700 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-blue-300 focus:ring-4 focus:ring-blue-100" />
              </label>
              <button type="button" aria-label="Topic filters" className="grid size-14 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-blue-700 shadow-sm transition hover:bg-blue-50">
                <Filter className="size-5" />
              </button>
            </div>

            <nav className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter, index) => (
                <button key={filter} type="button" className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${index === 0 ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}>{filter}</button>
              ))}
            </nav>

            <section className="grid gap-4 lg:grid-cols-2">
              {TOPICS.map((topic) => <TopicCardView key={topic.name} topic={topic} />)}
            </section>

            <div className="flex justify-center">
              <button type="button" className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-6 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                Load more topics
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <FollowedTopicsCard />
            <TrendingTopicsCard />
            <ContributorsCard />
            <SuggestedTopicsCard />
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          {BENEFITS.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <article key={benefit.label} className="flex gap-4 rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-sm md:block">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-blue-700 md:mt-3">{benefit.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{benefit.detail}</p>
                </div>
              </article>
            );
          })}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
