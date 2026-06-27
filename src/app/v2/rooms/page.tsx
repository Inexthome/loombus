"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  FlaskConical,
  Home,
  Leaf,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
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

type RoomCard = {
  name: string;
  type: "Research" | "Builder" | "Civic" | "Local" | "Private" | "Condo";
  description: string;
  members: string;
  activity: string;
  tag: string;
  accent: string;
  updateAuthor: string;
  updateText: string;
  updateAge: string;
  action: "View Room" | "Join";
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
  { label: "Rooms", href: "/v2/rooms", icon: Users, active: true },
  { label: "Messages", href: "/v2/messages", icon: Bell },
];

const FILTERS = ["All Rooms", "Local", "Expert", "Private", "Following", "Trending"];

const ROOMS: RoomCard[] = [
  {
    name: "Loombus Research Lab",
    type: "Research",
    description: "Explore research, experiments, and insights about the future of communities.",
    members: "1.2k",
    activity: "Active now",
    tag: "Expert",
    accent: "from-slate-950 to-blue-800",
    updateAuthor: "Nadia Karim",
    updateText: "Shared a new research brief",
    updateAge: "2h ago",
    action: "View Room",
  },
  {
    name: "Builders’ Room",
    type: "Builder",
    description: "A space for builders and operators sharing ideas and solving challenges.",
    members: "980",
    activity: "12 new today",
    tag: "Trending",
    accent: "from-blue-700 to-cyan-400",
    updateAuthor: "Mason Alvarado",
    updateText: "Started a discussion",
    updateAge: "1h ago",
    action: "Join",
  },
  {
    name: "Civic Futures Lab",
    type: "Civic",
    description: "Designing better systems and policies for stronger communities.",
    members: "870",
    activity: "Active now",
    tag: "Expert",
    accent: "from-emerald-600 to-green-400",
    updateAuthor: "Elena Park",
    updateText: "Shared policy ideas",
    updateAge: "3h ago",
    action: "View Room",
  },
  {
    name: "Condo Residents Network",
    type: "Condo",
    description: "Connect with condo residents and share updates that matter.",
    members: "640",
    activity: "6 new today",
    tag: "Private",
    accent: "from-violet-700 to-indigo-500",
    updateAuthor: "James Wu",
    updateText: "Posted a building update",
    updateAge: "4h ago",
    action: "Join",
  },
  {
    name: "Local Voices Jacksonville",
    type: "Local",
    description: "A local space to discuss issues, events, and opportunities in Jax.",
    members: "520",
    activity: "Active now",
    tag: "Local",
    accent: "from-orange-600 to-amber-400",
    updateAuthor: "Tanya Fields",
    updateText: "Shared a community event",
    updateAge: "5h ago",
    action: "View Room",
  },
  {
    name: "Private Neighbors Circle",
    type: "Private",
    description: "Invite-only space for neighbors to coordinate and stay informed.",
    members: "156",
    activity: "Active now",
    tag: "Private",
    accent: "from-teal-700 to-cyan-500",
    updateAuthor: "Michael Brown",
    updateText: "Shared a neighborhood update",
    updateAge: "6h ago",
    action: "Join",
  },
];

const SUGGESTED_ROOMS = [
  { name: "Climate Solutions Hub", members: "620 members", icon: Leaf },
  { name: "Open Systems Lab", members: "410 members", icon: Building2 },
  { name: "Youth Voices", members: "330 members", icon: Users },
];

const ROOM_EVENTS = [
  { day: "22", month: "MAY", title: "Research Briefing: Identity in Web3", room: "Loombus Research Lab", time: "Thu, May 22 · 12:00 PM ET", count: "128" },
  { day: "24", month: "MAY", title: "Builders’ Office Hours", room: "Builders’ Room", time: "Sat, May 24 · 2:00 PM ET", count: "86" },
  { day: "27", month: "MAY", title: "Civic Tech Roundtable", room: "Civic Futures Lab", time: "Tue, May 27 · 6:00 PM ET", count: "94" },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

function getRoomIcon(room: RoomCard) {
  if (room.type === "Research") return FlaskConical;
  if (room.type === "Civic") return Leaf;
  if (room.type === "Condo") return Building2;
  if (room.type === "Local") return Home;
  if (room.type === "Private") return Lock;
  return Users;
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
          <Link href="/v2/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Search className="size-5" />
          </Link>
          <Link href="/v2/notifications" aria-label="Notifications" className="relative grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
            <Bell className="size-5" />
            <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-blue-500 text-[10px] font-bold text-white">8</span>
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
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">v2_rooms: {payload.flags.v2_rooms ? "on" : "off"}</span>
          </div>
        )}
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/v2" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Back to V2 Home
          </Link>
          <Link href="/v2/discussions" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Open V2 Discussions
          </Link>
        </div>
      </section>
    </main>
  );
}

function RoomCardView({ room }: { room: RoomCard }) {
  const Icon = getRoomIcon(room);
  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="grid gap-4 sm:grid-cols-[76px_minmax(0,1fr)]">
        <div className={`grid size-16 place-items-center rounded-2xl bg-gradient-to-br ${room.accent} text-white shadow-lg`}>
          <Icon className="size-8" />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-lg font-black text-slate-950">{room.name}</h2>
            {room.type === "Private" && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">Private</span>}
          </div>
          <p className="mt-1 text-sm leading-6 text-slate-600">{room.description}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
        <span>{room.members} members</span>
        <span className="flex items-center gap-2"><span className="size-2 rounded-full bg-emerald-500" /> {room.activity}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="grid size-8 place-items-center rounded-full bg-slate-100 font-black text-slate-600">{room.updateAuthor.slice(0, 1)}</span>
          <div>
            <p className="font-black text-slate-700">{room.updateAuthor}</p>
            <p>{room.updateText} · {room.updateAge}</p>
          </div>
        </div>
        <Link href="/v2/rooms" className={`rounded-2xl px-4 py-2 text-sm font-black transition ${room.action === "Join" ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-blue-50 text-blue-700 hover:bg-blue-100"}`}>
          {room.action}
        </Link>
      </div>
    </article>
  );
}

export default function V2RoomsPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All Rooms");

  const filteredRooms = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return ROOMS.filter((room) => {
      const matchesQuery = !cleanQuery || `${room.name} ${room.description} ${room.type} ${room.tag}`.toLowerCase().includes(cleanQuery);
      const matchesFilter =
        activeFilter === "All Rooms" ||
        activeFilter === "Following" ||
        activeFilter === "Trending" && room.tag === "Trending" ||
        activeFilter === "Expert" && room.tag === "Expert" ||
        activeFilter === "Private" && room.type === "Private" ||
        activeFilter === "Local" && room.type === "Local";
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
      setMessage("Unable to verify V2 Rooms access. Current Loombus remains available.");
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
    return <GateCard title="Checking V2 Rooms access" message="Loombus is verifying access before loading the V2 Rooms shell." loading />;
  }

  if (message) {
    return <GateCard title="V2 Rooms check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 Rooms shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 Rooms is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Loombus experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-7 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Rooms</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Dedicated spaces for communities and focused groups.</p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search rooms and communities"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setActiveFilter(filter)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${activeFilter === filter ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:text-blue-700"}`}
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {filteredRooms.map((room) => <RoomCardView key={room.name} room={room} />)}
              {filteredRooms.length === 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm md:col-span-2">
                  No rooms match this filter.
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-center">
              <button type="button" className="inline-flex items-center gap-2 rounded-2xl bg-blue-50 px-5 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
                Load more rooms
                <ChevronDown className="size-4" />
              </button>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Your Rooms</h2>
                <Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {ROOMS.slice(0, 5).map((room) => {
                  const Icon = getRoomIcon(room);
                  return (
                    <Link key={room.name} href="/v2/rooms" className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className={`grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${room.accent} text-white`}><Icon className="size-4" /></span>
                        <span className="min-w-0"><span className="block truncate">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.members} members · {room.activity}</span></span>
                      </span>
                      <span className="size-2 shrink-0 rounded-full bg-blue-600" />
                    </Link>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Suggested Rooms</h2>
                <Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-3">
                {SUGGESTED_ROOMS.map((room) => {
                  const Icon = room.icon;
                  return (
                    <div key={room.name} className="flex items-center justify-between gap-3 rounded-2xl px-1 py-2">
                      <span className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon className="size-4" /></span>
                        <span className="min-w-0"><span className="block truncate text-sm font-black text-slate-800">{room.name}</span><span className="block text-xs font-semibold text-slate-400">{room.members}</span></span>
                      </span>
                      <button type="button" className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100">Join</button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Upcoming Room Events</h2>
                <Link href="/v2/rooms" className="text-sm font-black text-blue-700">View all</Link>
              </div>
              <div className="mt-4 space-y-4">
                {ROOM_EVENTS.map((event) => (
                  <div key={event.title} className="grid grid-cols-[52px_minmax(0,1fr)] gap-3 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                    <div className="rounded-2xl bg-blue-50 px-2 py-2 text-center">
                      <p className="text-[10px] font-black text-slate-500">{event.month}</p>
                      <p className="text-xl font-black text-slate-950">{event.day}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-950">{event.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{event.room}</p>
                      <p className="mt-1 text-xs text-slate-500">{event.time}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{event.count} interested</p>
                    </div>
                  </div>
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
