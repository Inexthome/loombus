"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type V2Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

const MENU_ITEMS = [
  { label: "People", href: "/people" },
  { label: "Labs", href: "/labs" },
  { label: "Saved", href: "/saved" },
  { label: "Stickies", href: "/stickies" },
  { label: "Profile", href: "/profile" },
  { label: "My Discussions", href: "/my-discussions" },
  { label: "My Replies / Activity", href: "/my-activity" },
  { label: "Settings", href: "/settings" },
];

function getInitial(profile: V2Profile | null, email: string | null) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || email?.trim() || "User";
  return label.slice(0, 1).toUpperCase();
}

function getDisplayName(profile: V2Profile | null, email: string | null) {
  return profile?.full_name?.trim() || profile?.username?.trim() || email?.split("@")[0] || "Account";
}

export function V2UserAvatarMenu() {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<V2Profile | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user ?? null;

      if (!mounted || !user) return;

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
        <div className="absolute left-0 mt-3 w-72 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20">
          <div className="px-3 py-3">
            <p className="truncate text-sm font-black text-slate-950">{displayName}</p>
            {email && <p className="mt-1 truncate text-xs font-medium text-slate-500">{email}</p>}
          </div>
          <div className="h-px bg-slate-100" />
          <div className="py-2">
            {MENU_ITEMS.map((item) => (
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
        </div>
      )}
    </div>
  );
}
