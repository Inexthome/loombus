"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userData.user.id)
        .single();

      if (data) {
        setFullName(data.full_name ?? "");
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function saveProfile() {
    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
      username,
      bio,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }

    setMessage("Profile updated successfully.");
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
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

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Full Name
            </label>

            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Username
            </label>

            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="@saint"
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">
              Bio
            </label>

            <textarea
              rows={5}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write a short introduction..."
              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500"
            />
          </div>

          <button
            type="button"
            onClick={saveProfile}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200"
          >
            Save Profile
          </button>

          {message && (
            <p className="text-sm text-zinc-400">
              {message}
            </p>
          )}

        </div>
      </div>
    </main>
  );
}
