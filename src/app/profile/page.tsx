"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function FixProfilePage() {
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");

  async function fixProfile() {
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Profile fixed. Replies and discussions should now show your name.");
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Profile
        </h1>

        <p className="mb-8 text-zinc-400">
          Manage your public Loombus profile.
        </p>

        <div className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <input
            type="text"
            placeholder="Your full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
          />

          <button
            type="button"
            onClick={fixProfile}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200"
          >
            Save Profile
          </button>

          {message && <p className="text-sm text-zinc-400">{message}</p>}
        </div>
      </div>
    </main>
  );
}
