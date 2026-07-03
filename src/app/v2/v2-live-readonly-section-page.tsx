"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
  StickyNote,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { V2ReadOnlyCompatCards } from "./v2-readonly-compat-cards";

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

type FallbackCard = {
  title: string;
  description: string;
  meta: string;
};

type SectionConfig = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  chips: string[];
  searchPlaceholder: string;
  cards: FallbackCard[];
  sideTitle: string;
  sideItems: string[];
  footer: Array<{ title: string; description: string }>;
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
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const SECTION_CONFIGS: Record<string, SectionConfig> = {
  people: {
    slug: "people",
    title: "People",
    eyebrow: "Discover",
    description: "Find thoughtful contributors, mutual connections, and people shaping useful discussions.",
    chips: ["All", "Following", "Followers", "Mutual", "Suggested"],
    searchPlaceholder: "Search people, bios, topics, and rooms",
    icon: UserRound,
    cards: [
      { title: "Thoughtful contributors", description: "Live profile data will appear here when available.", meta: "People shell" },
      { title: "Mutual context", description: "Follow and relationship actions remain guarded for a later pass.", meta: "Read-only" },
    ],
    sideTitle: "People Compatibility",
    sideItems: ["Live profiles", "Blocked-user filtering", "No follow mutations", "Profile actions guarded"],
    footer: [
      { title: "Real Contributors", description: "V2 reads existing profile data without changing relationships." },
      { title: "Safe Discovery", description: "Blocked profiles stay hidden using existing V1 rules." },
      { title: "Actions Later", description: "Follow, message, and profile edits stay guarded." },
    ],
  },
  saved: {
    slug: "saved",
    title: "Saved",
    eyebrow: "Library",
    description: "Your personal library for discussions, replies, files, and links.",
    chips: ["All Saved", "Discussions", "Replies", "Folders", "Files", "Links"],
    searchPlaceholder: "Search saved discussions, replies, files, and folders",
    icon: Bookmark,
    cards: [
      { title: "Saved discussions", description: "Your saved discussions from V1 will appear here when available.", meta: "Saved shell" },
      { title: "Folders and organization", description: "Move/remove actions remain guarded for a later pass.", meta: "Read-only" },
    ],
    sideTitle: "Saved Compatibility",
    sideItems: ["Reads bookmarks", "Opens V2 discussion detail", "No remove action", "Folder actions guarded"],
    footer: [
      { title: "Personal Library", description: "Saved discussions are hydrated from existing V1 bookmarks." },
      { title: "Quick Return", description: "Open saved discussions inside the V2 discussion detail shell." },
      { title: "No Mutations", description: "Moving and removing saved items will come after parity checks." },
    ],
  },
  stickies: {
    slug: "stickies",
    title: "Stickies",
    eyebrow: "Library",
    description: "Capture useful thoughts, reminders, and discussion notes.",
    chips: ["All", "Private", "Discussion Notes", "Room Notes", "Follow-ups", "Pinned"],
    searchPlaceholder: "Search notes, tags, and attached sources",
    icon: StickyNote,
    cards: [
      { title: "Your stickies", description: "Premium/admin stickies appear here when available.", meta: "Stickies shell" },
      { title: "Discussion memory", description: "Reorder and delete stay guarded for a later V2 wiring pass.", meta: "Read-only" },
    ],
    sideTitle: "Stickies Compatibility",
    sideItems: ["Uses /api/stickies", "Premium/admin guard preserved", "No reorder", "No delete"],
    footer: [
      { title: "Private Notes", description: "Stickies are loaded through the existing protected V1 API." },
      { title: "Discussion Memory", description: "Open attached discussions inside V2 when possible." },
      { title: "Guarded Actions", description: "Reorder/delete will be added only after exact V1 parity." },
    ],
  },
  "my-discussions": {
    slug: "my-discussions",
    title: "My Discussions",
    eyebrow: "My Loombus",
    description: "Manage discussions you started, drafted, or archived.",
    chips: ["Published", "Drafts", "Archived", "Needs Attention"],
    searchPlaceholder: "Search your discussions",
    icon: MessageCircle,
    cards: [
      { title: "Your discussions", description: "Discussions you started will appear here when available.", meta: "My Discussions shell" },
      { title: "Creator actions", description: "Edit, archive, and delete remain guarded for a later pass.", meta: "Read-only" },
    ],
    sideTitle: "Creator Compatibility",
    sideItems: ["Reads your discussions", "Opens V2 detail", "No edit/delete", "Drafts guarded"],
    footer: [
      { title: "Creator Workspace", description: "Review your own discussions without changing them." },
      { title: "Thread Re-entry", description: "Open your discussions in the V2 detail shell." },
      { title: "Safe Actions", description: "Owner actions stay in V1 until permission parity is complete." },
    ],
  },
  "my-replies": {
    slug: "my-replies",
    title: "My Replies",
    eyebrow: "My Loombus",
    description: "Review replies you posted across Loombus and jump back into the thread.",
    chips: ["All Replies", "Recent", "Highlighted", "Quoted", "With Responses"],
    searchPlaceholder: "Search your replies",
    icon: MessageCircle,
    cards: [
      { title: "Your replies", description: "Replies you posted will appear here when available.", meta: "My Replies shell" },
      { title: "Reply actions", description: "Edit and delete remain guarded for a later pass.", meta: "Read-only" },
    ],
    sideTitle: "Reply Compatibility",
    sideItems: ["Reads your replies", "Joins discussion titles", "Opens V2 threads", "No edit/delete"],
    footer: [
      { title: "Reply History", description: "Review what you posted across existing V1 replies." },
      { title: "Thread Re-entry", description: "Jump back to the related V2 discussion detail." },
      { title: "Guarded Mutations", description: "Editing and deleting replies stays in V1 for now." },
    ],
  },
  profile: {
    slug: "profile",
    title: "Profile",
    eyebrow: "My Loombus",
    description: "Your profile, contributions, and presence across Loombus.",
    chips: ["Overview", "Discussions", "Replies", "Rooms", "Labs", "Contributions"],
    searchPlaceholder: "Search your profile activity",
    icon: UserRound,
    cards: [
      { title: "Your profile", description: "Your real profile and contribution counts will appear here.", meta: "Profile shell" },
      { title: "Visibility controls", description: "Profile edits and visibility changes remain guarded.", meta: "Read-only" },
    ],
    sideTitle: "Profile Compatibility",
    sideItems: ["Reads profile", "Counts discussions", "Counts replies", "Counts saved items"],
    footer: [
      { title: "Identity & Presence", description: "See your profile data without editing it yet." },
      { title: "Contribution Overview", description: "Counts are hydrated from existing V1 tables." },
      { title: "Edit Later", description: "Profile edit actions remain guarded until parity is checked." },
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
          <Link href="/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open V1</Link>
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
              <Link key={item.label} href={item.href} className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${item.primary ? "border border-white/40 text-white hover:bg-white/10" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
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

export function V2LiveReadOnlySectionPage({ sectionSlug }: { sectionSlug: string }) {
  const section = SECTION_CONFIGS[sectionSlug] ?? SECTION_CONFIGS.people;
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState(section.chips[0] ?? "All");

  useEffect(() => {
    let mounted = true;

    async function loadShell() {
      if (mounted) {
        setLoading(true);
        setMessage("");
      }

      try {
        const { data } = await supabase.auth.getSession();
        const accessToken = data.session?.access_token;
        const requestInit = accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {};
        const response = await fetch("/api/v2/shell", requestInit);
        const nextPayload = (await response.json().catch(() => getDefaultShellPayload())) as ShellPayload;
        if (mounted) setPayload(nextPayload);
      } catch {
        if (mounted) {
          setPayload(getDefaultShellPayload());
          setMessage("Unable to verify V2 shell access. Current Loombus remains available.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadShell();
    const { data } = supabase.auth.onAuthStateChange(() => {
      void loadShell();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (loading) return <GateCard title={`Loading ${section.title}`} message="Loombus is verifying access before loading this V2 shell page." loading />;
  if (message) return <GateCard title="V2 shell check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 shell is internal-only right now. Sign in first so Loombus can verify access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 shell is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  const Icon = section.icon;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7f7f8] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">{section.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{section.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{section.description}</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={section.searchPlaceholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {section.chips.map((chip) => (
                <button key={chip} type="button" onClick={() => setActiveChip(chip)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeChip === chip ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {chip}
                </button>
              ))}
            </div>

            <V2ReadOnlyCompatCards sectionSlug={section.slug} query={query} fallbackCards={section.cards} fallbackIcon={Icon} />
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.1)]">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">{section.sideTitle}</h2>
              <div className="mt-4 space-y-3">
                {section.sideItems.map((item) => <div key={item} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">{item}</div>)}
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3"><ShieldCheck className="size-5 text-amber-700" /><h2 className="font-black text-amber-900">Read-only compatibility</h2></div>
              <p className="mt-3 text-sm leading-6 text-amber-800">This V2 page reads existing V1 data only. Live writes, edit/delete, billing, admin, message, report, and publish behavior stay guarded.</p>
            </section>
          </aside>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          {section.footer.map((item) => (
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
