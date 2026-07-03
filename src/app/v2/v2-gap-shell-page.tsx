"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CheckCircle2,
  FlaskConical,
  Search,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getDefaultShellPayload,
  V2ShellGateCard,
  V2ShellMobileNav,
  V2ShellTopNav,
  type ShellPayload,
} from "./v2-shell-components";

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
      { title: "Builders' Room has new updates", description: "Two new room updates are waiting for review.", meta: "5h ago · Room" },
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

function getDetailConfig(sectionKey: string, itemSlug?: string): GapShellConfig {
  const cleanTitle = decodeURIComponent(itemSlug ?? "detail")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

  const detailMap: Record<string, Pick<GapShellConfig, "title" | "eyebrow" | "description" | "Icon">> = {
    people: { title: cleanTitle || "Person Detail", eyebrow: "People Detail", description: "A V2 profile detail shell for contributor identity, recent discussions, replies, rooms, labs, and mutual context.", Icon: UserRound },
    rooms: { title: cleanTitle || "Room Detail", eyebrow: "Room Detail", description: "A V2 room detail shell for room overview, signals, members, events, and recent discussion activity.", Icon: Users },
    labs: { title: cleanTitle || "Lab Detail", eyebrow: "Lab Detail", description: "A V2 lab detail shell for research updates, access status, experiments, and lab discussions.", Icon: FlaskConical },
    topics: { title: cleanTitle || "Topic Detail", eyebrow: "Topic Detail", description: "A V2 topic detail shell for topic overview, trending discussions, contributors, and related rooms or labs.", Icon: Search },
  };

  const base = detailMap[sectionKey] ?? { title: cleanTitle || "V2 Detail", eyebrow: "Detail", description: "A read-only V2 detail shell for this secondary route.", Icon: Search };

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
    const { data } = supabase.auth.onAuthStateChange(() => loadShell());
    return () => data.subscription.unsubscribe();
  }, []);

  if (!config) return <V2ShellGateCard title="V2 page not found" message="This V2 shell route is not available yet." payload={payload} />;
  if (loading) return <V2ShellGateCard title={`Loading ${config.title}`} message="Loombus is verifying access before loading this V2 shell page." loading />;
  if (message) return <V2ShellGateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <V2ShellGateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <V2ShellGateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;
  }

  const Icon = config.Icon;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2ShellTopNav />
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
      <V2ShellMobileNav />
    </main>
  );
}
