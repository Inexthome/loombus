"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { V2_MENU_GROUPS } from "./v2-navigation";

type V2Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
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

export function V2UserAvatarMenu({ placement = "disabled" }: V2UserAvatarMenuProps = {}) {
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<V2Profile | null>(null);
  const [hasSession, setHasSession] = useState(false);

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
        .select("full_name, username, avatar_url")
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
    <div ref={menuRef} className="v2-avatar-menu-inline relative flex size-10 shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`loombus-mobile-shell-avatar grid size-10 place-items-center rounded-full border p-0 transition ${open ? "ring-2 ring-[color:var(--loombus-text-subtle)]" : ""}`}
        aria-expanded={open}
        aria-label="Open V2 menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-[color:var(--loombus-primary-bg)] text-sm font-black text-[color:var(--loombus-primary-text)]">
            {getInitial(profile, email)}
          </span>
        )}
      </button>

      {open && (
        <div className="loombus-mobile-menu-panel absolute right-0 top-full z-50 mt-2 max-h-[calc(100vh-5rem)] w-[min(20rem,calc(100vw-1.5rem))] overflow-y-auto rounded-3xl border p-3">
          <div className="loombus-mobile-menu-header border-b px-3 py-3">
            <p className="loombus-mobile-menu-title truncate text-sm font-black">{displayName}</p>
            {email && <p className="loombus-mobile-menu-subtitle mt-1 truncate text-xs font-medium">{email}</p>}
          </div>
          <div className="space-y-3 py-3">
            {V2_MENU_GROUPS.map((group) => (
              <section key={group.title}>
                <p className="loombus-mobile-menu-section-label px-3 pb-1 text-[11px] font-black uppercase tracking-[0.18em]">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center justify-between rounded-2xl border px-3 py-2 text-sm font-bold transition ${active ? "loombus-mobile-menu-link-active" : "loombus-mobile-menu-link-inactive"}`}
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <Icon className="size-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.badge && <span className="loombus-mobile-nav-badge grid size-5 place-items-center rounded-full text-[10px] font-black">{item.badge}</span>}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
