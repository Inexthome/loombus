"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { V2_ACTION_NAV_ITEMS, V2_TOP_NAV_ITEMS } from "./v2-navigation";
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

function useMobileNavAutoHide() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScrollTop = 0;
    let ticking = false;

    function isMobileViewport() {
      return window.matchMedia("(max-width: 767px)").matches;
    }

    function getScrollTop(target: EventTarget | null) {
      if (target instanceof HTMLElement) return target.scrollTop;
      return window.scrollY || document.documentElement.scrollTop || 0;
    }

    function updateVisibility(target: EventTarget | null) {
      const currentScrollTop = Math.max(0, getScrollTop(target));

      if (!isMobileViewport()) {
        setHidden(false);
        lastScrollTop = currentScrollTop;
        return;
      }

      const scrollDelta = currentScrollTop - lastScrollTop;

      if (currentScrollTop < 20) {
        setHidden(false);
      } else if (scrollDelta > 8) {
        setHidden(true);
      } else if (scrollDelta < -8) {
        setHidden(false);
      }

      lastScrollTop = currentScrollTop;
    }

    function handleScroll(event: Event) {
      if (ticking) return;
      const target = event.target;
      window.requestAnimationFrame(() => {
        updateVisibility(target);
        ticking = false;
      });
      ticking = true;
    }

    function handleResize() {
      if (!isMobileViewport()) setHidden(false);
    }

    document.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return hidden;
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
  const navHidden = useMobileNavAutoHide();

  return (
    <header className={`sticky top-0 z-40 loombus-v2-top-nav loombus-mobile-topbar shadow-sm backdrop-blur-xl transition-transform duration-200 ease-out md:translate-y-0 ${navHidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex min-w-0 shrink-0 items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 shrink-0 object-contain" />
          <span className="truncate text-lg font-black tracking-tight text-[color:var(--loombus-text)] sm:text-xl">Loombus</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center justify-center md:flex">
          <div className="inline-flex items-center gap-1 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-1">
            {V2_TOP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-active={active ? "true" : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black transition ${
                    active
                      ? "bg-[color:var(--loombus-primary-bg)] text-[color:var(--loombus-primary-text)] shadow-sm"
                      : item.primary
                        ? "bg-[color:var(--loombus-text)] text-[color:var(--loombus-page-bg)] shadow-sm hover:opacity-90"
                        : "text-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)] hover:text-[color:var(--loombus-text)]"
                  }`}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-[color:var(--loombus-border)] bg-[color:var(--loombus-surface-strong)] p-1">
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
                  active
                    ? "bg-[color:var(--loombus-primary-bg)] text-[color:var(--loombus-primary-text)] shadow-sm"
                    : "text-[color:var(--loombus-text-muted)] hover:bg-[color:var(--loombus-surface-muted)] hover:text-[color:var(--loombus-text)]"
                }`}
              >
                <Icon className="size-5" />
                {item.badge && <span className="loombus-mobile-nav-badge absolute right-0 top-0 grid size-5 place-items-center rounded-full border border-[color:var(--loombus-border)] text-[10px] font-black shadow-sm">{item.badge}</span>}
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
  const pathname = usePathname() ?? "/v2";
  const navHidden = useMobileNavAutoHide();

  return (
    <nav className={`fixed inset-x-3 bottom-3 z-40 rounded-[1.75rem] border loombus-mobile-bottom-nav px-2 py-2 backdrop-blur-xl transition-transform duration-200 ease-out md:hidden ${navHidden ? "translate-y-[140%]" : "translate-y-0"}`}>
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-1 text-xs font-black">
        {V2_TOP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} data-active={active ? "true" : undefined} className={`flex flex-col items-center justify-center gap-1 rounded-2xl border px-2 py-2 transition ${active ? "loombus-mobile-bottom-tab-active" : "loombus-mobile-bottom-tab-inactive"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full border border-current/20 p-1" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
