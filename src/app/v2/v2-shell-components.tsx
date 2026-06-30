"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, Lock } from "lucide-react";
import { V2_ACTION_NAV_ITEMS, V2_PRIMARY_NAV_ITEMS } from "./v2-navigation";
import { V2UserAvatarMenu } from "./v2-user-avatar-menu";

export type FeatureFlags = {
  v2_shell: boolean;
  v2_signal_brief: boolean;
  v2_rooms: boolean;
};

export type ShellPayload = {
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

function isNavActive(pathname: string, href: string) {
  if (href === "/v2") return pathname === "/v2" || pathname === "/v2/home";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getDefaultShellPayload(): ShellPayload {
  return {
    version: "v1",
    configured: false,
    authenticated: false,
    flags: DEFAULT_FLAGS,
  };
}

export function V2ShellGateCard({ title, message, loading = false, payload }: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
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

export function V2ShellTopNav() {
  const pathname = usePathname() ?? "/v2";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex min-w-0 shrink-0 items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 shrink-0 object-contain" />
          <span className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">Loombus</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {V2_PRIMARY_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active
                    ? "border border-white/40 bg-white text-slate-950 shadow-sm"
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
        <div className="flex shrink-0 items-center gap-2">
          {V2_ACTION_NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                data-active={active ? "true" : undefined}
                className={`relative grid size-10 place-items-center rounded-full transition ${
                  active ? "bg-white text-slate-950 shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className="size-5" />
                {item.badge && <span className="absolute right-0 top-0 grid size-5 place-items-center rounded-full border border-slate-300 bg-white text-[10px] font-black text-slate-950 shadow-sm">{item.badge}</span>}
              </Link>
            );
          })}
          <V2UserAvatarMenu placement="topnav" />
        </div>
      </div>
    </header>
  );
}

export function V2ShellMobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 text-xs font-semibold text-slate-500">
        {V2_PRIMARY_NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="flex flex-col items-center gap-1 rounded-2xl py-2 text-slate-500">
              <Icon className={`size-5 ${item.primary ? "rounded-full border border-zinc-300 bg-zinc-50 p-1 text-zinc-950 shadow-sm" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
