"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LoombusLoadingScreen } from "@/components/loombus-loading-screen";
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

export function V2ShellGateCard(_props: { title: string; message: string; loading?: boolean; payload?: ShellPayload | null }) {
  return <LoombusLoadingScreen fixed />;
}

export function V2ShellTopNav() {
  const pathname = usePathname() ?? "/v2";
  const navHidden = useMobileNavAutoHide();

  return (
    <header className={`sticky top-0 z-30 border-b border-slate-200 bg-[#061942] loombus-v2-top-nav shadow-sm transition-transform duration-200 ease-out md:translate-y-0 ${navHidden ? "-translate-y-full" : "translate-y-0"}`}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/v2" className="flex min-w-0 shrink-0 items-center gap-3 font-bold">
          <img src="/assets/brand/loombus-mark-transparent.png" alt="" className="size-9 shrink-0 object-contain" />
          <span className="text-lg font-black tracking-tight text-slate-950 sm:text-xl">Loombus</span>
        </Link>
        <nav className="hidden min-w-0 flex-1 items-center justify-center gap-1 md:flex">
          {V2_TOP_NAV_ITEMS.map((item) => {
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
                {item.badge && <span className="v2-nav-badge absolute right-0 top-0 grid size-5 place-items-center rounded-full border border-amber-500 bg-amber-300 text-[10px] font-black text-slate-950 shadow-sm">{item.badge}</span>}
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
    <nav className={`fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 loombus-v2-bottom-nav px-3 pb-3 pt-2 shadow-2xl backdrop-blur transition-transform duration-200 ease-out md:hidden ${navHidden ? "translate-y-[120%]" : "translate-y-0"}`}>
      <div className="mx-auto grid max-w-sm grid-cols-3 gap-1 text-xs font-semibold text-slate-500">
        {V2_TOP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <Link key={item.label} href={item.href} aria-current={active ? "page" : undefined} data-active={active ? "true" : undefined} className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${active ? "text-slate-950" : "text-slate-500"}`}>
              <Icon className={`size-5 ${item.primary ? "rounded-full border border-zinc-300 bg-zinc-50 p-1 text-zinc-950 shadow-sm" : ""}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
