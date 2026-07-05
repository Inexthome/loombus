"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import V2CreateRoomPage from "../../v2/rooms/new/page";

const PENDING_ROOM_PLAN_KEY = "loombus:pending-room-plan";

function getPlanPath() {
  return `${window.location.pathname}${window.location.search}`;
}

export default function PublicRoomNewPage() {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [intentPath, setIntentPath] = useState("/rooms/new?plan=free");

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      const path = getPlanPath();
      const nextIntentPath = path.includes("plan=") ? path : "/rooms/new?plan=free";
      window.localStorage.setItem(PENDING_ROOM_PLAN_KEY, nextIntentPath);
      setIntentPath(nextIntentPath);

      const { data } = await supabase.auth.getSession();

      if (!mounted) return;
      setAuthenticated(Boolean(data.session));
      setChecking(false);
    }

    void loadSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (checking) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-8rem)] max-w-xl flex-col justify-center">
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <p className="text-zinc-400">Checking room setup access...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authenticated) {
    const encodedIntentPath = encodeURIComponent(intentPath);

    return (
      <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 sm:py-16">
        <section className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col justify-center">
          <Link href="/create-room" className="mb-10 inline-block text-sm text-zinc-500 hover:text-white">
            ← Back to Create Room
          </Link>
          <div className="rounded-[2rem] border border-zinc-800 bg-zinc-950 p-6 shadow-2xl shadow-black/30 sm:p-8">
            <div className="mb-6 grid size-14 place-items-center rounded-2xl bg-white text-black">
              <Lock className="size-7" />
            </div>
            <p className="mb-3 text-xs font-black uppercase tracking-[0.24em] text-zinc-500">Private Room Setup</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Join Loombus to continue this room plan.</h1>
            <p className="mt-5 leading-7 text-zinc-400">
              Loombus saved your selected room plan. Create an account or sign in, then you will return here to create the private room.
            </p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href={`/signup?next=${encodedIntentPath}`} className="rounded-full bg-white px-6 py-3 text-center text-sm font-semibold text-black transition hover:bg-zinc-200">
                Create account
              </Link>
              <Link href={`/login?next=${encodedIntentPath}`} className="rounded-full border border-zinc-700 px-6 py-3 text-center text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 hover:text-white">
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return <V2CreateRoomPage />;
}
