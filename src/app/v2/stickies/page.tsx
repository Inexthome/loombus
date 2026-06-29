"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  Bookmark,
  ChevronRight,
  ClipboardList,
  Edit3,
  FileText,
  Home,
  LinkIcon,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pin,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
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

type StickyItem = {
  id: string;
  user_id: string;
  item_type: string;
  source_key: string;
  title: string;
  subtitle: string | null;
  href: string;
  position: number;
  created_at: string;
  updated_at: string;
};

type V2StickyCard = StickyItem & {
  bodyPreview: string;
  attachedTo: string;
  tags: string[];
  visibility: "Private" | "Shared";
  color: "amber" | "violet" | "blue" | "emerald";
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
  { label: "People", href: "/v2/people", icon: Users },
];

const MOBILE_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home },
  { label: "Discussions", href: "/v2/discussions", icon: MessageCircle },
  { label: "Create", href: "/v2/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2/rooms", icon: Users },
  { label: "Stickies", href: "/v2/stickies", icon: Bookmark, active: true },
];

const FILTERS = ["All", "Private", "Discussion Notes", "Room Notes", "Follow-ups", "Pinned", "Archived"];
const SUGGESTED_TAGS = ["Research", "Strategy", "Governance", "Community", "Follow-up", "Onboarding", "Operations", "Product"];
const SAMPLE_STICKIES: V2StickyCard[] = [
  {
    id: "sample-1",
    user_id: "sample",
    item_type: "discussion",
    source_key: "sample-1",
    title: "Follow up with Nadia on DID research",
    subtitle: "The Future of Decentralized Identity · She mentioned a new framework for verifiable credentials that could strengthen our roadmap. Let’s schedule a call next week.",
    href: "/v2/discussions",
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bodyPreview: "She mentioned a new framework for verifiable credentials that could strengthen our roadmap. Let’s schedule a call next week.",
    attachedTo: "The Future of Decentralized Identity",
    tags: ["Follow-up", "Research"],
    visibility: "Private",
    color: "amber",
  },
  {
    id: "sample-2",
    user_id: "sample",
    item_type: "discussion",
    source_key: "sample-2",
    title: "Builders’ Room takeaways",
    subtitle: "Builders’ Room · Great discussion on community incentives and long-term sustainability. We should draft a proposal for the next sprint.",
    href: "/v2/rooms",
    position: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bodyPreview: "Great discussion on community incentives and long-term sustainability. We should draft a proposal for the next sprint.",
    attachedTo: "Builders’ Room",
    tags: ["Community", "Strategy"],
    visibility: "Shared",
    color: "violet",
  },
  {
    id: "sample-3",
    user_id: "sample",
    item_type: "discussion",
    source_key: "sample-3",
    title: "Remember to review governance poll",
    subtitle: "Web3 Governance · Check results from the latest poll and share insights with the team. Focus on voter sentiment for key proposals.",
    href: "/v2/discussions",
    position: 2,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bodyPreview: "Check results from the latest poll and share insights with the team. Focus on voter sentiment for key proposals.",
    attachedTo: "Web3 Governance",
    tags: ["Governance"],
    visibility: "Private",
    color: "blue",
  },
  {
    id: "sample-4",
    user_id: "sample",
    item_type: "discussion",
    source_key: "sample-4",
    title: "Idea: Contributor onboarding checklist",
    subtitle: "Open Systems Lab · Create a simple checklist to help new contributors get started and feel welcome in our community.",
    href: "/v2/rooms",
    position: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    bodyPreview: "Create a simple checklist to help new contributors get started and feel welcome in our community.",
    attachedTo: "Open Systems Lab",
    tags: ["Onboarding", "Operations"],
    visibility: "Shared",
    color: "emerald",
  },
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

function truncate(value: string, maxLength = 160) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trim()}…`;
}

function parseStickySubtitle(sticky: StickyItem) {
  const cleanSubtitle = stripHtml(sticky.subtitle);
  const [firstPart, ...rest] = cleanSubtitle.split(" · ");
  return {
    attachedTo: firstPart || "Saved discussion",
    bodyPreview: truncate(rest.join(" · ") || cleanSubtitle || "Sticky note saved for quick return."),
  };
}

function getStickyTags(sticky: StickyItem) {
  const subtitle = (sticky.subtitle ?? "").toLowerCase();
  const title = sticky.title.toLowerCase();
  const tags = [];
  if (title.includes("follow") || subtitle.includes("follow")) tags.push("Follow-up");
  if (title.includes("research") || subtitle.includes("research")) tags.push("Research");
  if (title.includes("governance") || subtitle.includes("governance")) tags.push("Governance");
  if (title.includes("builder") || subtitle.includes("community")) tags.push("Community");
  if (tags.length === 0) tags.push("Discussion Note");
  return tags.slice(0, 3);
}

function getStickyColor(index: number): V2StickyCard["color"] {
  return ["amber", "violet", "blue", "emerald"][index % 4] as V2StickyCard["color"];
}

function getColorClasses(color: V2StickyCard["color"]) {
  if (color === "violet") return { bg: "bg-violet-100", text: "text-violet-700", chip: "bg-violet-50 text-violet-700" };
  if (color === "blue") return { bg: "bg-blue-100", text: "text-blue-700", chip: "bg-blue-50 text-blue-700" };
  if (color === "emerald") return { bg: "bg-emerald-100", text: "text-emerald-700", chip: "bg-emerald-50 text-emerald-700" };
  return { bg: "bg-amber-100", text: "text-amber-700", chip: "bg-amber-50 text-amber-700" };
}

function getSourceHref(sticky: V2StickyCard) {
  if (sticky.href?.startsWith("/discussions/")) return sticky.href.replace("/discussions/", "/v2/discussions/");
  return sticky.href || "/v2/discussions";
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
          <Link href="/stickies" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Stickies</Link>
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

function StickyCard({ sticky }: { sticky: V2StickyCard }) {
  const classes = getColorClasses(sticky.color);
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className={`grid size-16 shrink-0 place-items-center rounded-2xl ${classes.bg} ${classes.text}`}>
          <ClipboardList className="size-8" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black text-slate-950">{sticky.title}</h2>
            <button type="button" aria-label="More sticky actions" className="grid size-8 place-items-center rounded-full text-slate-500 transition hover:bg-slate-50 hover:text-blue-700"><MoreHorizontal className="size-5" /></button>
          </div>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{sticky.bodyPreview}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {sticky.tags.map((tag) => (
              <span key={tag} className={`rounded-full px-3 py-1 text-xs font-black ${tag === "Research" ? "bg-emerald-50 text-emerald-700" : classes.chip}`}>{tag}</span>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
            <span>Attached to:</span>
            <Link href={getSourceHref(sticky)} className="font-black text-blue-700 transition hover:text-blue-900">{sticky.attachedTo}</Link>
          </div>
        </div>
        <span className={`self-start rounded-xl border px-3 py-2 text-xs font-black ${sticky.visibility === "Private" ? "border-slate-200 bg-white text-slate-600" : "border-emerald-100 bg-emerald-50 text-emerald-700"}`}>
          {sticky.visibility === "Private" ? "Private" : "Shared"}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-5 border-t border-slate-100 pt-4 text-sm font-black text-blue-700">
        <Link href="/stickies" className="inline-flex items-center gap-2 transition hover:text-blue-900"><Edit3 className="size-4" />Edit</Link>
        <button type="button" className="inline-flex items-center gap-2 transition hover:text-blue-900"><Pin className="size-4" />Pin</button>
        <button type="button" className="inline-flex items-center gap-2 transition hover:text-blue-900"><Archive className="size-4" />Archive</button>
        <Link href={getSourceHref(sticky)} className="inline-flex items-center gap-2 transition hover:text-blue-900"><LinkIcon className="size-4" />Open Source</Link>
      </div>
    </article>
  );
}

export default function V2StickiesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [stickies, setStickies] = useState<V2StickyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [stickiesLoading, setStickiesLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  const displayStickies = stickies.length > 0 ? stickies : SAMPLE_STICKIES;
  const filteredStickies = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return displayStickies.filter((sticky) => {
      const matchesQuery = !cleanQuery || `${sticky.title} ${sticky.bodyPreview} ${sticky.attachedTo} ${sticky.tags.join(" ")}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All" ||
        (activeFilter === "Private" && sticky.visibility === "Private") ||
        (activeFilter === "Pinned") ||
        (activeFilter === "Archived") ||
        (activeFilter === "Discussion Notes" && sticky.item_type === "discussion") ||
        (activeFilter === "Follow-ups" && sticky.tags.includes("Follow-up")) ||
        (activeFilter === "Room Notes" && sticky.attachedTo.toLowerCase().includes("room"));
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, displayStickies, query]);

  async function loadStickies(accessToken: string) {
    setStickiesLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/stickies", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Unable to load Stickies safely. Current Stickies remains available.");
        setStickies([]);
        return;
      }
      const rows = (result.stickies ?? []) as StickyItem[];
      setStickies(
        rows.map((sticky, index) => {
          const parsed = parseStickySubtitle(sticky);
          return {
            ...sticky,
            ...parsed,
            tags: getStickyTags(sticky),
            visibility: index % 2 === 0 ? "Private" : "Shared",
            color: getStickyColor(index),
          } satisfies V2StickyCard;
        })
      );
    } catch {
      setMessage("Unable to load Stickies safely. Current Stickies remains available.");
      setStickies([]);
    } finally {
      setStickiesLoading(false);
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

      if (accessToken && nextPayload.configured && nextPayload.flags.v2_shell && nextPayload.version === "v2") {
        await loadStickies(accessToken);
      }
    } catch {
      setPayload(getDefaultShellPayload());
      setMessage("Unable to verify V2 Stickies access. Current Loombus remains on V1.");
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

  if (loading) return <GateCard title="Checking V2 Stickies access" message="Loombus is verifying access before loading the V2 Stickies shell." loading />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Stickies shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Stickies is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Stickies</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Capture useful thoughts, reminders, and discussion notes.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search notes, tags, and attached sources" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
              </div>
              <button type="button" className="grid size-12 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
                <SlidersHorizontal className="size-5" />
              </button>
            </div>

            <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}>
                  {filter}
                </button>
              ))}
            </div>

            {message && <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{message}</div>}
            {stickiesLoading && <div className="mb-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">Loading Stickies...</div>}

            <div className="space-y-4">
              {!stickiesLoading && filteredStickies.length === 0 && <div className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">No stickies match this V2 shell filter.</div>}
              {!stickiesLoading && filteredStickies.map((sticky) => <StickyCard key={sticky.id} sticky={sticky} />)}
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Pinned stickies</h2><Link href="/v2/stickies" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {displayStickies.slice(0, 3).map((sticky) => {
                  const classes = getColorClasses(sticky.color);
                  return <Link key={sticky.id} href={getSourceHref(sticky)} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${classes.bg} ${classes.text}`}><ClipboardList className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{sticky.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{sticky.attachedTo}</span></span></Link>;
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Follow-up reminders</h2><Link href="/v2/stickies" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-4">
                {["Follow up with Ethan on metrics", "Share climate roadmap draft", "Check in with Mason on AI alignment"].map((reminder, index) => (
                  <div key={reminder} className="flex gap-3 rounded-2xl px-1 py-2"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700"><Bell className="size-4" /></span><span><span className="block text-sm font-black text-slate-800">{reminder}</span><span className="block text-xs font-semibold text-slate-500">{index === 0 ? "Tomorrow" : index === 1 ? "May 22" : "May 24"}</span></span></div>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recent sources</h2><Link href="/v2/stickies" className="text-sm font-black text-blue-700">View all</Link></div>
              <div className="mt-4 space-y-3">
                {displayStickies.slice(0, 3).map((sticky) => (
                  <Link key={sticky.id} href={getSourceHref(sticky)} className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><FileText className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{sticky.attachedTo}</span><span className="block text-xs font-semibold text-slate-500">Discussion source</span></span></Link>
                ))}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Suggested tags</h2>
              <div className="mt-4 flex flex-wrap gap-2">
                {SUGGESTED_TAGS.map((tag) => (
                  <button key={tag} type="button" onClick={() => setQuery(tag)} className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-100"><Tag className="mr-1 inline size-3" />{tag}</button>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
