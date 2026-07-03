"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabase/client";
import { V2_MENU_GROUPS } from "./v2-navigation";

type V2Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_admin?: boolean | null;
};

type V2UserAvatarMenuProps = {
  placement?: "topnav" | "disabled";
};

const ENTRY_PATHS = new Set(["/v2/login", "/v2/signup", "/v2/reset-password"]);

function getInitial(profile: V2Profile | null, email: string | null) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || email?.trim() || "User";
  return label.slice(0, 1).toUpperCase();
}

function getDisplayName(profile: V2Profile | null, email: string | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || email?.split("@")[0] || "Account";
}

function hasNativeInlineAvatar(topNav: HTMLElement) {
  const avatars = Array.from(topNav.querySelectorAll<HTMLElement>(".v2-avatar-menu-inline"));
  return avatars.some((avatar) => !avatar.closest(".v2-avatar-portal-host"));
}

function findV2TopNavActionGroup() {
  const topNav = document.querySelector<HTMLElement>(".loombus-v2-top-nav");
  if (!topNav) return null;
  if (hasNativeInlineAvatar(topNav)) return null;

  const actionLink = topNav.querySelector<HTMLAnchorElement>('a[aria-label="Search"], a[href="/v2/search"], a[aria-label="Notifications"], a[href="/v2/notifications"]');
  if (actionLink?.parentElement) return actionLink.parentElement as HTMLElement;

  const directContainer = topNav.querySelector<HTMLElement>(":scope > div");
  const actionGroup = directContainer?.querySelector<HTMLElement>(":scope > div:last-child");
  return actionGroup ?? null;
}

export function V2UserAvatarMenuPortal() {
  const pathname = usePathname();
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (ENTRY_PATHS.has(pathname)) {
      setHost(null);
      return;
    }

    let mounted = true;
    let hostNode: HTMLDivElement | null = null;
    let observer: MutationObserver | null = null;
    let frame = 0;

    function cleanupHost() {
      hostNode?.remove();
      hostNode = null;
      if (mounted) setHost(null);
    }

    function mountIntoLegacyNav() {
      const actionGroup = findV2TopNavActionGroup();

      if (!actionGroup) {
        cleanupHost();
        return;
      }

      if (hostNode && hostNode.parentElement === actionGroup) {
        if (mounted) setHost(hostNode);
        return;
      }

      cleanupHost();
      hostNode = document.createElement("div");
      hostNode.className = "v2-avatar-portal-host flex size-10 shrink-0 items-center justify-center";
      actionGroup.appendChild(hostNode);
      if (mounted) setHost(hostNode);
    }

    function scheduleMount() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(mountIntoLegacyNav);
    }

    scheduleMount();
    observer = new MutationObserver(scheduleMount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      mounted = false;
      if (frame) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      cleanupHost();
    };
  }, [pathname]);

  if (!host) return null;
  return createPortal(<V2UserAvatarMenu placement="topnav" />, host);
}

export function V2UserAvatarMenu({ placement = "disabled" }: V2UserAvatarMenuProps = {}) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<V2Profile | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const isAdmin = profile?.is_admin === true;

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!mounted) return;

      if (!user) {
        setHasSession(false);
        setEmail(null);
        setProfile(null);
        return;
      }

      setHasSession(true);
      setEmail(user.email ?? null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, is_admin")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted) {
        setProfile((profileData as V2Profile | null) ?? null);
      }
    }

    loadProfile();

    const { data } = supabase.auth.onAuthStateChange(() => {
      loadProfile();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  if (placement !== "topnav" || ENTRY_PATHS.has(pathname) || !hasSession) {
    return null;
  }

  const displayName = getDisplayName(profile, email);

  return (
    <div ref={menuRef} className="v2-avatar-menu-inline relative z-40 flex size-10 shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`grid size-10 place-items-center rounded-full transition ${
          open ? "bg-white text-slate-950 shadow-sm" : "text-blue-100 hover:bg-white/10 hover:text-white"
        }`}
        aria-expanded={open}
        aria-label="Open V2 menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="size-8 rounded-full object-cover ring-1 ring-white/50" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-white text-sm font-black text-slate-950 ring-1 ring-white/50">
            {getInitial(profile, email)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-3 max-h-[calc(100vh-5rem)] w-80 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl shadow-slate-950/20">
          <div className="px-3 py-3">
            <p className="truncate text-sm font-black text-slate-950">{displayName}</p>
            {email && <p className="mt-1 truncate text-xs font-medium text-slate-500">{email}</p>}
          </div>
          <div className="h-px bg-slate-100" />
          <div className="space-y-3 py-3">
            {V2_MENU_GROUPS.map((group) => {
              const visibleItems = group.items.filter((item) => !item.adminOnly || isAdmin);
              if (visibleItems.length === 0) return null;

              return (
                <section key={group.title}>
                  <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.label}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className="flex items-center justify-between rounded-2xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
                        >
                          <span className="inline-flex min-w-0 items-center gap-2">
                            <Icon className="size-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          {item.badge && <span className="grid size-5 place-items-center rounded-full bg-slate-950 text-[10px] font-black text-white">{item.badge}</span>}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
