"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Bell,
  Home,
  Inbox,
  Loader2,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
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
  { label: "Messages", href: "/v2/messages", icon: Bell, active: true },
  { label: "Settings", href: "/settings", icon: Settings },
];

const MOCK_THREADS = [
  {
    name: "Loombus Team",
    note: "V2 messaging shell preview is ready for layout testing.",
    time: "Now",
    active: true,
  },
  {
    name: "Product feedback",
    note: "Review message actions in the current Messages route.",
    time: "Today",
    active: false,
  },
  {
    name: "Community room",
    note: "Rooms and messages will share this V2 navigation shell.",
    time: "Yesterday",
    active: false,
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
          <Link href="/messages" className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200">
            Open current Messages
          </Link>
          <Link href="/v2" className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white">
            Back to V2 Home
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function V2MessagesPage() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");

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
      setMessage("Unable to verify V2 Messages access. Current Messages remains available.");
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
    return <GateCard title="Checking V2 Messages access" message="Loombus is verifying access before loading the V2 Messages shell." loading />;
  }

  if (message) {
    return <GateCard title="V2 Messages check failed safely" message={message} payload={payload} />;
  }

  if (!payload?.authenticated) {
    return <GateCard title="Sign in required" message="The V2 Messages shell is internal-only right now. Sign in first so Loombus can check your v2_shell access." payload={payload} />;
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return <GateCard title="V2 Messages is not enabled" message="This account is not currently allowed through the v2_shell flag. Public users remain on the current Messages experience." payload={payload} />;
  }

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#f7fbff] text-slate-950">
      <V2TopNav />
      <section className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Messages</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              A calmer inbox shell for focused private conversations. Current send/read actions stay in the existing Messages route until V2 wiring is complete.
            </p>
          </div>
          <Link href="/messages" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700">
            <Send className="size-4" />
            Open current Messages
          </Link>
        </header>

        <section className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Search className="size-5 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search messages"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-2">
              {MOCK_THREADS.filter((thread) => !query || `${thread.name} ${thread.note}`.toLowerCase().includes(query.toLowerCase())).map((thread) => (
                <button
                  key={thread.name}
                  type="button"
                  className={`flex w-full items-start gap-3 rounded-3xl border p-3 text-left transition ${thread.active ? "border-blue-200 bg-blue-50" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"}`}
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-100 text-sm font-black text-blue-700">
                    {thread.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-black text-slate-900">{thread.name}</span>
                      <span className="text-xs font-semibold text-slate-400">{thread.time}</span>
                    </span>
                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-500">{thread.note}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-blue-100 font-black text-blue-700">L</span>
                <div>
                  <h2 className="font-black text-slate-950">Loombus Team</h2>
                  <p className="text-xs font-semibold text-slate-500">V2 shell preview</p>
                </div>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-full text-slate-500 transition hover:bg-slate-100">
                <MoreHorizontal className="size-5" />
              </button>
            </div>

            <div className="min-h-[440px] space-y-4 bg-slate-50 p-5">
              <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm leading-6 text-slate-700">
                  This is the V2 Messages shell. It is intentionally read-only for this pass so we can test layout, navigation, spacing, and mobile behavior without touching the current private-message system.
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-400">System preview · Now</p>
              </div>

              <div className="ml-auto max-w-xl rounded-3xl bg-blue-600 p-4 text-white shadow-sm">
                <p className="text-sm leading-6">
                  Use the current Messages route for real send/read actions until live V2 message data is wired in safely.
                </p>
                <p className="mt-2 text-xs font-semibold text-blue-100">Safe handoff</p>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white p-4">
              <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                <Inbox className="size-5 text-blue-600" />
                V2 compose is disabled in this shell pass. Use current Messages to send.
              </div>
            </div>
          </section>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <MessageCircle className="size-6 text-blue-600" />
            <h3 className="mt-3 font-black text-slate-950">Focused threads</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">Designed for clear private conversations instead of noisy inbox clutter.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <Users className="size-6 text-blue-600" />
            <h3 className="mt-3 font-black text-slate-950">Mutual context</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">Future V2 wiring can surface profile and room context beside conversations.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <ShieldCheck className="size-6 text-blue-600" />
            <h3 className="mt-3 font-black text-slate-950">Safe rollout</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500">No message writes are added here. Current Messages remains the source of truth.</p>
          </div>
        </section>
      </section>
      <MobileBottomNav />
    </main>
  );
}
