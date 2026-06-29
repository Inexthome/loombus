"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  ChevronRight,
  Code2,
  FlaskConical,
  Home,
  Leaf,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  ShieldCheck,
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

type LabCard = {
  title: string;
  description: string;
  members: string;
  followers: string;
  latestUpdate: string;
  latestAge: string;
  status: "Member" | "Requested" | "Open";
  category: "Research" | "Civic" | "Technology" | "Product Experiments";
  accent: string;
  icon: typeof FlaskConical;
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
  { label: "Labs", href: "/v2/labs", icon: FlaskConical, active: true },
];

const FILTERS = ["All Labs", "Following", "Research", "Product Experiments", "Civic", "Technology", "Requested"];

const LABS: LabCard[] = [
  {
    title: "Loombus Research Lab",
    description: "Advancing decentralized systems, identity, trust, and social coordination.",
    members: "1.8k",
    followers: "124",
    latestUpdate: "Exploring verifiable reputation in cross-platform communities.",
    latestAge: "2h ago",
    status: "Member",
    category: "Research",
    accent: "from-slate-950 to-indigo-700",
    icon: FlaskConical,
  },
  {
    title: "Civic Futures Lab",
    description: "Designing civic tools and infrastructure for participatory, transparent communities.",
    members: "1.4k",
    followers: "96",
    latestUpdate: "New draft: Civic data portability for transparent governance.",
    latestAge: "1d ago",
    status: "Member",
    category: "Civic",
    accent: "from-emerald-700 to-teal-400",
    icon: Users,
  },
  {
    title: "Open Systems Lab",
    description: "Building open protocols, open data, and interoperable social systems.",
    members: "980",
    followers: "72",
    latestUpdate: "Experiment: Interoperable discussion threads.",
    latestAge: "3d ago",
    status: "Requested",
    category: "Technology",
    accent: "from-violet-700 to-purple-500",
    icon: Code2,
  },
  {
    title: "AI Conversation Tools Lab",
    description: "Exploring ethical AI tools that enhance meaningful conversations.",
    members: "870",
    followers: "54",
    latestUpdate: "Prototype: Context-aware summaries for long threads.",
    latestAge: "4d ago",
    status: "Requested",
    category: "Product Experiments",
    accent: "from-blue-700 to-cyan-400",
    icon: MessageCircle,
  },
  {
    title: "Climate Solutions Hub",
    description: "Coordinating climate research, data, and action across communities.",
    members: "620",
    followers: "48",
    latestUpdate: "New dataset: Community climate resilience indicators.",
    latestAge: "5d ago",
    status: "Member",
    category: "Civic",
    accent: "from-teal-700 to-emerald-400",
    icon: Leaf,
  },
];

const RECENT_UPDATES = [
  { title: "Verifiable reputation in communities", lab: "Loombus Research Lab", age: "2h ago", icon: FlaskConical },
  { title: "Civic data portability draft", lab: "Civic Futures Lab", age: "1d ago", icon: Users },
  { title: "Interoperable discussion threads", lab: "Open Systems Lab", age: "3d ago", icon: Code2 },
  { title: "AI thread summarization prototype", lab: "AI Conversation Tools Lab", age: "4d ago", icon: MessageCircle },
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
          <Link href="/labs" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">Open current Labs</Link>
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

function StatusPill({ status }: { status: LabCard["status"] }) {
  if (status === "Member") return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Member</span>;
  if (status === "Requested") return <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700">Requested</span>;
  return <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">Open</span>;
}

function LabCardView({ lab }: { lab: LabCard }) {
  const Icon = lab.icon;
  const needsAccess = lab.status === "Requested";
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className={`grid size-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${lab.accent} text-white shadow-lg`}>
          <Icon className="size-9" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-black text-slate-950">{lab.title}</h2>
            <ShieldCheck className="size-4 text-blue-600" />
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">{lab.description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-500">
            <span className="inline-flex items-center gap-1.5"><Users className="size-4" /> {lab.members} members</span>
            <span className="inline-flex items-center gap-1.5"><MessageCircle className="size-4" /> {lab.followers} followers</span>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-600">
            <span className="font-black text-slate-800">Latest update:</span> {lab.latestUpdate}
            <span className="ml-3 text-xs text-slate-400">{lab.latestAge}</span>
          </p>
        </div>
        <div className="flex gap-2 sm:min-w-[120px] sm:flex-col">
          <Link href="/labs" className="rounded-xl bg-blue-600 px-4 py-2 text-center text-sm font-black text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700">
            {needsAccess ? "Request Access" : "View Lab"}
          </Link>
          <Link href="/labs" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
            {needsAccess ? "Learn More" : "Follow"}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function V2LabsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Labs");

  const filteredLabs = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return LABS.filter((lab) => {
      const matchesQuery = !cleanQuery || `${lab.title} ${lab.description} ${lab.category} ${lab.status}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All Labs" ||
        activeFilter === "Following" ||
        (activeFilter === "Requested" && lab.status === "Requested") ||
        activeFilter === lab.category;
      return matchesQuery && matchesFilter;
    });
  }, [activeFilter, query]);

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
      setMessage("Unable to verify V2 Labs access. Current Labs remains available.");
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

  if (loading) return <GateCard title="Checking V2 Labs access" message="Loombus is verifying access before loading the V2 Labs shell." loading />;
  if (message) return <GateCard title="V2 Labs check failed safely" message={message} payload={payload} />;
  if (!payload?.authenticated) return <GateCard title="Sign in required" message="The V2 Labs shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") return <GateCard title="V2 Labs is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on V1." payload={payload} />;

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] loombus-v2-page-bg text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Labs</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Explore research, experiments, and early Loombus features.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search labs, experiments, and updates" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
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

            <div className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm">
              {filteredLabs.length === 0 && <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-600">No labs match this V2 filter.</div>}
              {filteredLabs.map((lab) => <LabCardView key={lab.title} lab={lab} />)}
              <div className="flex items-center justify-between border-t border-slate-100 px-1 pt-4 text-sm text-slate-600">
                <span>Explore more labs and experiments shaping the future of Loombus.</span>
                <Link href="/labs" className="inline-flex items-center gap-2 font-black text-blue-700 transition hover:text-blue-900">View all labs <ChevronRight className="size-4" /></Link>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Your lab access</h2>
                <Link href="/labs" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {LABS.slice(0, 4).map((lab) => {
                  const Icon = lab.icon;
                  return (
                    <Link key={lab.title} href="/labs" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                      <span className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${lab.accent} text-white`}><Icon className="size-4" /></span><span className="truncate text-sm font-black text-slate-800">{lab.title}</span></span>
                      <span className="flex items-center gap-2"><StatusPill status={lab.status} /><ChevronRight className="size-4 text-slate-400" /></span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Recent lab updates</h2>
                <Link href="/labs" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-4">
                {RECENT_UPDATES.map((update) => {
                  const Icon = update.icon;
                  return (
                    <Link key={update.title} href="/labs" className="flex gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span>
                      <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{update.title}</span><span className="block truncate text-xs font-semibold text-slate-500">{update.lab} · {update.age}</span></span>
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Request lab access</h2>
              <p className="mt-4 text-sm font-black text-slate-950">Want to join a lab?</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">Request access to collaborate on experiments and early features.</p>
              <Link href="/labs" className="mt-4 block rounded-xl border border-slate-200 bg-white px-4 py-2 text-center text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">Browse Labs</Link>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Labs you follow</h2>
                <Link href="/labs" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {LABS.filter((lab) => lab.status === "Member").map((lab) => {
                  const Icon = lab.icon;
                  return (
                    <Link key={lab.title} href="/labs" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 transition hover:bg-blue-50">
                      <span className="flex min-w-0 items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${lab.accent} text-white`}><Icon className="size-4" /></span><span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{lab.title}</span><span className="block text-xs font-semibold text-slate-400">{lab.members} members</span></span></span>
                      <span className="size-2 rounded-full bg-blue-600" />
                    </Link>
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
