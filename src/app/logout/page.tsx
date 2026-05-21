"use client";

export const dynamic = "force-dynamic";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

function clearSupabaseBrowserStorage() {
  try {
    for (const storage of [window.localStorage, window.sessionStorage]) {
      for (const key of Object.keys(storage)) {
        if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
          storage.removeItem(key);
        }
      }
    }
  } catch {
    // Storage can be unavailable in some browser privacy modes.
  }
}

export default function LogoutPage() {
  useEffect(() => {
    async function logout() {
      try {
        await Promise.race([
          supabase.auth.signOut(),
          new Promise((resolve) => window.setTimeout(resolve, 2500)),
        ]);
      } finally {
        clearSupabaseBrowserStorage();
        window.location.replace("/login");
      }
    }

    logout();
  }, []);

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
        <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
          Loombus
        </p>

        <h1 className="mb-4 text-4xl font-semibold tracking-tight">
          Signing you out...
        </h1>

        <p className="leading-relaxed text-zinc-400">
          If this takes more than a few seconds, refresh this page.
        </p>
      </div>
    </main>
  );
}
