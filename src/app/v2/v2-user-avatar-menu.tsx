"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Settings, UserRound } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type V2Profile = {
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

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
    <div ref={menuRef} className="fixed right-4 top-3 z-[140] sm:right-6 lg:right-8">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/95 px-1.5 py-1 text-slate-900 shadow-lg shadow-slate-950/15 ring-1 ring-slate-900/5 backdrop-blur transition hover:bg-white"
        aria-expanded={open}
        aria-label="Open account menu"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="size-8 rounded-full object-cover" />
        ) : (
          <span className="grid size-8 place-items-center rounded-full bg-blue-600 text-sm font-black text-white">
            {getInitial(profile, email)}
          </span>
        )}
        <ChevronDown className={`mr-1 size-4 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-3xl border border-slate-200 bg-white p-2 text-slate-900 shadow-2xl shadow-slate-950/20">
          <div className="px-3 py-3">
            <p className="truncate text-sm font-black text-slate-950">{displayName}</p>
            {email && <p className="mt-1 truncate text-xs font-medium text-slate-500">{email}</p>}
          </div>
          <div className="h-px bg-slate-100" />
          <Link href="/profile" onClick={() => setOpen(false)} className="mt-2 flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
            <UserRound className="size-4" />
            Profile
          </Link>
          <Link href="/settings" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
            <Settings className="size-4" />
            Settings
          </Link>
        </div>
      )}
    </div>
  );
}
