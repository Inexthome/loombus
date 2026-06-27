"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
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

type RoomCard = {
  name: string;
  type: "Research" | "Builder" | "Civic" | "Local" | "Private";
  description: string;
  members: string;
  signals: string;
  tag: string;
  featured?: boolean;
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
  { label: "Settings", href: "/settings", icon: Settings },
];

const FILTERS = ["All Rooms", "Local", "Expert", "Private", "Following", "Trending"];

const ROOMS: RoomCard[] = [
  {
    name: "Loombus Research Lab",
    type: "Research",
    description: "A space for structured questions, evidence, sources, and high-signal synthesis.",
    members: "128",
    signals: "42",
    tag: "Expert",
    featured: true,
  },
  {
    name: "Builders’ Room",
    type: "Builder",
    description: "Product builders, founders, and makers testing ideas before they become noise.",
    members: "84",
    signals: "31",
    tag: "Trending",
  },
  {
    name: "Civic Futures Lab",
    type: "Civic",
    description: "A calmer room for policy, governance, local systems, and civic problem solving.",
    members: "63",
    signals: "19",
    tag: "Expert",
  },
  {
    name: "Condo Residents Network",
    type: "Private",
    description: "A private community shell for building-specific resident updates and coordination.",
    members: "24",
    signals: "8",
    tag: "Private",
  },
  {
    name: "Local Voices Jacksonville",
    type: "Local",
    description: "Local questions, neighborhood insight, and regional discussions without the endless scroll.",
    members: "57",
    signals: "16",
    tag: "Local",
  },
  {
    name: "Private Neighbors Circle",
    type: "Private",
    description: "A small trusted circle model for private coordination and focused updates.",
    members: "12",
    signals: "5",
    tag: "Private",
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
        <Link href="/search" aria-label="Search" className="grid size-10 place-items-center rounded-full text-blue-100 transition hover:bg-white/10 hover:text-white">
          <Search className="size-5" />
        </Link>
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
  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <span className="grid size-14 place-items-center rounded-3xl bg-gradient-to-br from-blue-950 via-blue-700 to-cyan-400 text-xl font-black text-white">
          {room.name.slice(0, 1)}
        </span>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{room.tag}</span>
      </div>
      <h2 className="mt-5 text-xl font-black text-slate-950">{room.name}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{room.description}</p>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
        <span>{room.members} members</span>
        <span>{room.signals} signals</span>
      </div>
      <button type="button" className="mt-5 w-full rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black text-blue-700 transition hover:border-blue-200 hover:bg-blue-50">
        Preview Room
      </button>
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
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Rooms</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Browse focused spaces for structured conversations. This shell is read-only while room membership and room discussions stay guarded.
            </p>
          </div>
          <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-black text-blue-700">
            {payload.flags.v2_rooms ? "Rooms flag on" : "Rooms preview shell"}
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="mb-4 flex gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <Search className="size-5 text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search rooms, topics, and communities"
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
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Your Rooms</h2>
              <div className="mt-4 space-y-3">
                {ROOMS.slice(0, 3).map((room) => (
                  <div key={room.name} className="rounded-2xl bg-slate-50 px-3 py-3 text-sm font-bold text-slate-700">
                    {room.name}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Suggested Rooms</h2>
                <TrendingUp className="size-5 text-blue-600" />
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p><span className="font-black text-slate-800">Builders’ Room</span> — active product discussion.</p>
                <p><span className="font-black text-slate-800">Local Voices Jacksonville</span> — local signal without noise.</p>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <CalendarDays className="size-5 text-blue-600" />
                <h2 className="font-black text-slate-950">Upcoming Room Events</h2>
              </div>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-blue-50 px-3 py-3">
                  <p className="font-black text-blue-900">Research Lab Weekly Signal</p>
                  <p className="mt-1 text-blue-700">Preview placeholder</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="font-black text-slate-800">Community Builders Check-in</p>
                  <p className="mt-1 text-slate-500">Preview placeholder</p>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-amber-700" />
                <h2 className="font-black text-amber-900">Safe rollout</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-800">
                This page does not create rooms, join rooms, or write memberships yet. It only previews the V2 Rooms shell.
              </p>
            </section>
          </aside>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
