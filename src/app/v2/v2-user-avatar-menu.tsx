"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type V2Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

type MenuGroup = {
  title: string;
  items: Array<{ label: string; href: string }>;
};

const ENTRY_PATHS = new Set(["/v2/login", "/v2/signup", "/v2/reset-password"]);

const MENU_GROUPS: MenuGroup[] = [
  {
    title: "Discover",
    items: [
      { label: "People", href: "/v2/people" },
      { label: "Labs", href: "/v2/labs" },
      { label: "Topics", href: "/v2/topics" },
      { label: "Following", href: "/v2/following" },
    ],
  },
  {
    title: "Library",
    items: [
      { label: "Saved", href: "/v2/saved" },
      { label: "Stickies", href: "/v2/stickies" },
      { label: "Reading History", href: "/v2/reading-history" },
    ],
  },
  {
    title: "My Loombus",
    items: [
      { label: "My Activity", href: "/v2/my-activity" },
      { label: "My Discussions", href: "/v2/my-discussions" },
      { label: "My Replies", href: "/v2/my-replies" },
      { label: "Profile", href: "/v2/profile" },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/v2/settings" },
      { label: "Premium", href: "/v2/premium" },
      { label: "Support", href: "/v2/support" },
      { label: "Privacy/Security", href: "/v2/privacy-security" },
      { label: "Admin", href: "/v2/admin" },
    ],
  },
];

function getInitial(profile: V2Profile | null, email: string | null) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || email?.trim() || "User";
  return label.slice(0, 1).toUpperCase();
}

function getDisplayName(profile: V2Profile | null, email: string | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || email?.split("@")[0] || "Account";
}

export function V2UserAvatarMenu() {
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

  if (ENTRY_PATHS.has(pathname) || !hasSession) {
    return null;
  }

  const displayName = getDisplayName(profile, email);

  return (
    <div ref={menuRef} className="v2-avatar-menu fixed top-3 z-[140]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="grid size-11 place-items-center rounded-full border border-white/25 bg-white/95 p-0 text-slate-900 shadow-lg shadow-slate-950/15 ring-1 ring-slate-900/5 backdrop-blur transition hover:bg-white"
        aria-expanded={open}
        aria-label="Open V2 menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="size-9 rounded-full object-cover" />
        ) : (
          <span className="grid size-9 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">
            {getInitial(profile, email)}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-3 max-h-[calc(100vh-5rem)] w-80 overflow-y-auto rounded-3xl border border-slate-200 bg-white p-3 text-slate-900 shadow-2xl shadow-slate-950/20">
          <div className="px-3 py-3">
            <p className="truncate text-sm font-black text-slate-950">{displayName}</p>
            {email && <p className="mt-1 truncate text-xs font-medium text-slate-500">{email}</p>}
          </div>
          <div className="h-px bg-slate-100" />
          <div className="space-y-3 py-3">
            {MENU_GROUPS.map((group) => (
              <section key={group.title}>
                <p className="px-3 pb-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-2xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
