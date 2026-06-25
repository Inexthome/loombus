"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Bookmark,
  Home,
  Loader2,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

type AppearanceOption = {
  key: "system" | "dark_gold" | "light_blue";
  label: string;
  description: string;
};

type ShellPreference = {
  layout_version: "v1" | "v2" | null;
  appearance_theme: "system" | "dark_gold" | "light_blue" | null;
  home_sections: string[] | null;
  compact_mode: boolean | null;
  last_seen_v2_prompt_at: string | null;
};

type ShellPayload = {
  version: "v1" | "v2";
  configured: boolean;
  authenticated: boolean;
  flags: FeatureFlags;
  preferences: ShellPreference | null;
  appearanceOptions?: AppearanceOption[];
};

const DEFAULT_FLAGS: FeatureFlags = {
  v2_shell: false,
  v2_signal_brief: false,
  v2_rooms: false,
};

const V2_NAV_ITEMS = [
  { label: "Home", href: "/v2", icon: Home, active: true },
  { label: "Discussions", href: "/discussions", icon: MessageCircle },
  { label: "Create", href: "/create", icon: Plus, primary: true },
  { label: "Rooms", href: "/v2#rooms", icon: Users },
  { label: "Saved", href: "/saved", icon: Bookmark },
  { label: "Alerts", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
];

const SIGNAL_CARDS = [
  {
    title: "Needs Attention",
    value: "Ready",
    description: "Replies, mentions, and updates will land here when wired to live data.",
  },
  {
    title: "Recent Signals",
    value: "V1 linked",
    description: "The shell keeps existing discussions available while V2 is being built.",
  },
  {
    title: "Rooms",
    value: "Hidden",
    description: "Rooms stay behind their own flag until the room experience is ready.",
  },
];

function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
    preferences: null,
  };
}

function FlagPill({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${
        enabled
          ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
          : "border-white/10 bg-white/5 text-slate-300"
      }`}
    >
      {label}: {enabled ? "on" : "off"}
    </span>
  );
}

function ShellGateCard({
  title,
  message,
  payload,
  loading = false,
}: {
  title: string;
  message: string;
  payload?: ShellPayload | null;
  loading?: boolean;
}) {
  return (
    <main className="fixed inset-0 z-[80] flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <section className="w-full max-w-2xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-12 place-items-center rounded-2xl bg-blue-500/15 text-blue-200 ring-1 ring-blue-300/20">
            {loading ? <Loader2 className="size-5 animate-spin" /> : <Lock className="size-5" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
          </div>
        </div>

        <p className="text-sm leading-6 text-slate-300 sm:text-base">{message}</p>

        {payload && (
          <div className="mt-5 flex flex-wrap gap-2">
            <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
            <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
            <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
          </div>
        )}

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/discussions"
            className="rounded-2xl bg-white px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-slate-200"
          >
            Return to V1
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/30 hover:text-white"
          >
            Recheck access
          </button>
        </div>
      </section>
    </main>
  );
}

function V2Shell({ payload }: { payload: ShellPayload }) {
  const appearanceLabel = useMemo(() => {
    const preference = payload.preferences?.appearance_theme ?? "system";
    return payload.appearanceOptions?.find((option) => option.key === preference)?.label ?? "System";
  }, [payload.appearanceOptions, payload.preferences?.appearance_theme]);

  return (
    <main className="fixed inset-0 z-[80] min-h-screen overflow-y-auto bg-[#07111f] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.26),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(212,175,55,0.18),_transparent_32%)]" />

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-24 border-r border-white/10 bg-slate-950/80 px-3 py-5 backdrop-blur-xl lg:flex lg:flex-col lg:items-center">
        <Link
          href="/v2"
          aria-label="Loombus V2 home"
          className="mb-7 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/5"
        >
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 object-contain" />
        </Link>

        <nav aria-label="V2 navigation" className="flex flex-1 flex-col items-center gap-2">
          {V2_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`group relative grid size-12 place-items-center rounded-2xl border transition ${
                  item.primary
                    ? "border-blue-400/40 bg-blue-500 text-white shadow-lg shadow-blue-950/30"
                    : item.active
                      ? "border-white/15 bg-white/10 text-white"
                      : "border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className="size-5" />
                <span className="pointer-events-none absolute left-[3.75rem] z-30 rounded-full border border-white/10 bg-slate-950 px-3 py-1 text-xs text-white opacity-0 shadow-xl transition group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <Link
          href="/discussions"
          className="rounded-2xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-white/25 hover:text-white"
        >
          V1
        </Link>
      </aside>

      <div className="relative z-10 lg:pl-24">
        <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-blue-200">Loombus V2 Shell</p>
              <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">Signal over noise</h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 sm:inline-flex">
                {appearanceLabel}
              </span>
              <Link
                href="/search"
                aria-label="Search"
                className="grid size-10 place-items-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:text-white"
              >
                <Search className="size-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.05] p-6 shadow-2xl shadow-black/30">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-blue-200">Welcome back, Saint.</p>
                  <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-5xl">
                    Here is what needs attention across Loombus.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                    This is the first real V2 shell route. It is gated by `v2_shell`, keeps V1 as the default, and is ready to be wired to live V2 sections one piece at a time.
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200">
                  Feature flag active
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {SIGNAL_CARDS.map((card) => (
                  <article key={card.title} className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
                    <p className="text-sm font-semibold text-slate-300">{card.title}</p>
                    <p className="mt-2 text-2xl font-bold">{card.value}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{card.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Link href="/discussions" className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-blue-300/30 hover:bg-blue-500/10">
                <MessageCircle className="size-6 text-blue-200" />
                <h3 className="mt-4 text-xl font-bold">Continue discussions</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">Use the existing discussion experience while V2 feed screens are wired in safely.</p>
              </Link>

              <Link href="/create" className="rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-5 transition hover:border-blue-300/30 hover:bg-blue-500/10">
                <Plus className="size-6 text-blue-200" />
                <h3 className="mt-4 text-xl font-bold">Create a signal</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">Start from the current composer until the V2 composer is connected behind the flag.</p>
              </Link>
            </div>
          </div>

          <aside className="space-y-4">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="size-5 text-emerald-200" />
                <h2 className="font-bold">Rollout state</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <FlagPill label="v2_shell" enabled={payload.flags.v2_shell} />
                <FlagPill label="v2_signal_brief" enabled={payload.flags.v2_signal_brief} />
                <FlagPill label="v2_rooms" enabled={payload.flags.v2_rooms} />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                V2 is visible only when the server resolves access for the signed-in user. Public users remain on V1.
              </p>
            </section>

            <section id="rooms" className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center gap-3">
                <Users className="size-5 text-blue-200" />
                <h2 className="font-bold">Rooms</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-300">
                {payload.flags.v2_rooms
                  ? "Rooms are available for this account and can be connected to the V2 room directory next."
                  : "Rooms are installed in the backend but still hidden behind v2_rooms."}
              </p>
            </section>

            <section className="rounded-[2rem] border border-[#d4af37]/25 bg-[#d4af37]/10 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="size-5 text-[#f7d56d]" />
                <h2 className="font-bold text-[#f7d56d]">Next wiring</h2>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#fff3c4]">
                Next PRs can replace each placeholder with live V2 Home, Discussions, Create, Rooms, and Messages components without touching V1 defaults.
              </p>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

export default function V2Page() {
  const [payload, setPayload] = useState<ShellPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

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
      setMessage("Unable to verify V2 shell access. Current Loombus remains on V1.");
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
    return (
      <ShellGateCard
        title="Checking V2 access"
        message="Loombus is verifying whether this signed-in account is allowed to use the V2 shell."
        loading
      />
    );
  }

  if (message) {
    return (
      <ShellGateCard
        title="V2 access check failed safely"
        message={message}
        payload={payload}
      />
    );
  }

  if (!payload?.authenticated) {
    return (
      <ShellGateCard
        title="Sign in required"
        message="The V2 shell is internal-only right now. Sign in first so Loombus can check the v2_shell rollout flag for your account."
        payload={payload}
      />
    );
  }

  if (!payload.configured || !payload.flags.v2_shell || payload.version !== "v2") {
    return (
      <ShellGateCard
        title="V2 shell is not enabled"
        message="The V2 shell foundation is installed, but this account is not currently allowed through the v2_shell flag. This is expected until you add your user ID to the allowlist."
        payload={payload}
      />
    );
  }

  return <V2Shell payload={payload} />;
}
