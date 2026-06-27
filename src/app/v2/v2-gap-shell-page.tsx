"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FlaskConical,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
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

type GapCard = {
  title: string;
  description: string;
  meta: string;
};

type GapShellConfig = {
  title: string;
  eyebrow: string;
  description: string;
  searchPlaceholder: string;
  chips: string[];
  cards: GapCard[];
  sideTitle: string;
  sideItems: string[];
  footer: GapCard[];
  Icon: LucideIcon;
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
];

const GAP_SHELLS: Record<string, GapShellConfig> = {
  notifications: {
    title: "Notifications",
    eyebrow: "Activity",
    description: "Review replies, messages, follows, room updates, labs, and account alerts in one V2 shell.",
    searchPlaceholder: "Search notifications",
    chips: ["All", "Unread", "Replies", "Messages", "Rooms", "Labs", "System"],
    Icon: Bell,
    cards: [
      { title: "New reply in The Future of Decentralized Identity", description: "Someone replied to a discussion you follow.", meta: "2h ago · Reply" },
      { title: "Mason Alvarado followed you", description: "A thoughtful contributor started following your profile.", meta: "3h ago · Follow" },
      { title: "Builders’ Room has new updates", description: "Two new room updates are waiting for review.", meta: "5h ago · Room" },
      { title: "Premium tools are available", description: "Review your current plan and AI tool access.", meta: "1d ago · Account" },
    ],
    sideTitle: "Notification Controls",
    sideItems: ["Reply alerts", "Message alerts", "Room updates", "Lab updates"],
    footer: [
      { title: "Focused Alerts", description: "Surface what needs attention without adding noise.", meta: "V2 shell" },
      { title: "Unread Review", description: "Quickly separate new items from old context.", meta: "Read-only" },
      { title: "Account Signals", description: "Keep system and plan updates visible.", meta: "Guarded" },
    ],
  },
  search: {
    title: "Search",
    eyebrow: "Global",
    description: "Search discussions, people, rooms, labs, saved items, and your Loombus activity from one V2 shell.",
    searchPlaceholder: "Search Loombus",
    chips: ["All", "Discussions", "People", "Rooms", "Labs", "Saved", "Messages"],
    Icon: Search,
    cards: [
      { title: "Discussion results", description: "Find titles, topics, bodies, and contributor matches.", meta: "Search lane" },
      { title: "People results", description: "Find contributors by name, username, bio, and expertise.", meta: "Search lane" },
      { title: "Saved results", description: "Return to saved discussions, folders, files, and links.", meta: "Search lane" },
      { title: "Ask Loombus AI", description: "Future shell space for AI-assisted search and quick actions.", meta: "Preview" },
    ],
    sideTitle: "Search Lanes",
    sideItems: ["Discussions", "People", "Saved", "Rooms", "Labs"],
    footer: [
      { title: "Unified Search", description: "One search surface across core Loombus areas.", meta: "V2 shell" },
      { title: "Fast Return", description: "Find what you previously viewed, saved, or joined.", meta: "Read-only" },
      { title: "Signal Matching", description: "Prioritize meaningful matches over broad noise.", meta: "Preview" },
    ],
  },
  onboarding: {
    title: "Onboarding",
    eyebrow: "Getting Started",
    description: "Guide new users through profile setup, discussion basics, safety expectations, and first actions.",
    searchPlaceholder: "Search onboarding steps",
    chips: ["Start", "Profile", "Discussions", "Rooms", "Safety", "Premium"],
    Icon: CheckCircle2,
    cards: [
      { title: "Complete your profile", description: "Add a name, avatar, short bio, and contribution interests.", meta: "Step 1" },
      { title: "Understand discussions", description: "Learn how modes, topics, replies, signal, and stickies work.", meta: "Step 2" },
      { title: "Join or browse rooms", description: "Explore spaces for focused conversations and local coordination.", meta: "Step 3" },
      { title: "Review safety expectations", description: "See what Loombus expects from thoughtful contributors.", meta: "Step 4" },
    ],
    sideTitle: "Progress",
    sideItems: ["Profile setup", "First discussion", "Saved item", "Safety review"],
    footer: [
      { title: "Clear Start", description: "Help users understand Loombus without confusion.", meta: "V2 shell" },
      { title: "Guided Actions", description: "Point users to one useful next step at a time.", meta: "Read-only" },
      { title: "Safer First Use", description: "Set expectations before public participation.", meta: "Guarded" },
    ],
  },
  admin: {
    title: "Admin",
    eyebrow: "Control Center",
    description: "A read-only V2 admin shell for safety, reports, users, labs, support, audit, and rollout visibility.",
    searchPlaceholder: "Search admin areas",
    chips: ["Overview", "Users", "Reports", "Safety", "Labs", "Support", "Audit", "Rollout"],
    Icon: ShieldCheck,
    cards: [
      { title: "Safety Queue", description: "Review reported discussions, replies, and users from the admin workflow.", meta: "Read-only shell" },
      { title: "User Oversight", description: "Monitor users, access states, and account-level issues.", meta: "Read-only shell" },
      { title: "Labs Requests", description: "Track lab access requests and experimental feature review.", meta: "Read-only shell" },
      { title: "V2 Rollout Flags", description: "Review v2_shell, v2_rooms, and related rollout status.", meta: "Read-only shell" },
    ],
    sideTitle: "Admin Areas",
    sideItems: ["Users", "Reports", "Safety", "Labs", "Audit", "Support", "Deleted content"],
    footer: [
      { title: "Read-only First", description: "No admin mutations are added in this shell pass.", meta: "Safe rollout" },
      { title: "Operational View", description: "Group the admin areas before wiring live controls.", meta: "Preview" },
      { title: "Guard Before Launch", description: "Admin role checks should be hardened before public V2 release.", meta: "Next phase" },
    ],
  },
};

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getDetailConfig(sectionKey: string, itemSlug?: string): GapShellConfig {
  const cleanTitle = decodeURIComponent(itemSlug ?? "detail")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const detailMap: Record<string, Pick<GapShellConfig, "title" | "eyebrow" | "description" | "Icon">> = {
    people: {
      title: cleanTitle || "Person Detail",
      eyebrow: "People Detail",
      description: "A V2 profile detail shell for contributor identity, recent discussions, replies, rooms, labs, and mutual context.",
      Icon: UserRound,
    },
    rooms: {
      title: cleanTitle || "Room Detail",
      eyebrow: "Room Detail",
      description: "A V2 room detail shell for room overview, signals, members, events, and recent discussion activity.",
      Icon: Users,
    },
    labs: {
      title: cleanTitle || "Lab Detail",
      eyebrow: "Lab Detail",
      description: "A V2 lab detail shell for research updates, access status, experiments, and lab discussions.",
      Icon: FlaskConical,
    },
    topics: {
      title: cleanTitle || "Topic Detail",
      eyebrow: "Topic Detail",
      description: "A V2 topic detail shell for topic overview, trending discussions, contributors, and related rooms or labs.",
      Icon: Search,
    },
  };

  const base = detailMap[sectionKey] ?? {
    title: cleanTitle || "V2 Detail",
    eyebrow: "Detail",
    description: "A read-only V2 detail shell for this secondary route.",
    Icon: Search,
  };

  return {
    ...base,
    searchPlaceholder: `Search ${base.title}`,
    chips: ["Overview", "Activity", "Discussions", "Related", "Saved"],
    cards: [
      { title: "Overview", description: base.description, meta: "Read-only V2 detail shell" },
      { title: "Recent activity", description: "Placeholder lane for live activity once this detail shell is wired to V1 data.", meta: "Future wiring" },
      { title: "Related discussions", description: "Space for discussions, replies, rooms, labs, or people related to this item.", meta: "V2 shell" },
      { title: "Actions", description: "Follow, message, join, save, or request access controls stay guarded until later wiring.", meta: "No writes added" },
    ],
    sideTitle: "Detail Context",
    sideItems: ["Summary", "Recent updates", "Related signal", "Guarded actions"],
    footer: [
      { title: "Context First", description: "Keep the detail page focused before adding actions.", meta: "V2 shell" },
      { title: "Safe Wiring", description: "Live data and writes can be added after visual approval.", meta: "Guarded" },
      { title: "Connected Shell", description: "Detail routes complete the navigation path from secondary hubs.", meta: "Coverage" },
    ],
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
        {payload && (
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_shell: {payload.flags.v2_shell ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Home
          </Link>
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V1
          </Link>
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
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
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
        {V2_NAV_ITEMS.map((item) => {
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

export function V2GapShellPage({ sectionKey, itemSlug }: { sectionKey: string; itemSlug?: string }) {
  const config = itemSlug ? getDetailConfig(sectionKey, itemSlug) : GAP_SHELLS[sectionKey];
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState(config?.chips[0] ?? "All");

  const filteredCards = useMemo(() => {
    if (!config) return [];
    const cleanQuery = query.trim().toLowerCase();
    return config.cards.filter((card) => !cleanQuery || `${card.title} ${card.description} ${card.meta}`.toLowerCase().includes(cleanQuery));
  }, [config, query]);

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
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 shell access. Current Loombus remains available.");
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

  if (!config) return <GateCard title="V2 page not found" message="This V2 shell route is not available yet." payload={payload} />;
  if (loading) return <GateCard title={`Loading ${config.title}`} message="Loombus is verifying access before loading this V2 shell page." loading />;
  if (message) return <GateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  const Icon = config.Icon;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{config.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{config.description}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={config.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {config.chips.map((chip) => (
                <button key={chip} type="button" onClick={() => setActiveChip(chip)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeChip === chip ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {chip}
                </button>
              ))}
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.12)] sm:p-5">
              <div className="space-y-3">
                {filteredCards.map((card, index) => (
                  <article key={card.title} className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-blue-50/30 sm:grid-cols-[72px_minmax(0,1fr)_auto]">
                    <div className="grid size-16 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                      <Icon className="size-7" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-slate-950">{card.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{card.description}</p>
                      <p className="mt-2 text-xs font-bold text-blue-700">{card.meta}</p>
                    </div>
                    <Link href="/v2/discussions" className="self-start rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
                      {index === 0 ? "Open" : "View"}
                    </Link>
                  </article>
                ))}
                {filteredCards.length === 0 && <div className="rounded-3xl bg-slate-50 p-6 text-sm text-slate-500">No items match this search.</div>}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{config.sideTitle}</h2>
              <div className="mt-4 space-y-3">
                {config.sideItems.map((item) => (
                  <div key={item} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">{item}</div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-amber-700" /><h2 className="font-black text-amber-900">V2 shell pass</h2></div>
              <p className="mt-3 text-sm leading-6 text-amber-800">This page is a read-only V2 shell. Live writes, mutations, and route replacement stay guarded until final testing.</p>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {config.footer.map((item) => (
            <div key={item.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="size-6 text-blue-600" />
              <h3 className="mt-3 font-black text-slate-950">{item.title}</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">{item.description}</p>
            </div>
          ))}
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
