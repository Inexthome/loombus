"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function ProfilePage() {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [repliesEnabled, setRepliesEnabled] = useState(true);
  const [followsEnabled, setFollowsEnabled] = useState(true);
  const [mentionsEnabled, setMentionsEnabled] = useState(true);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

      const { data: preferences } = await supabase
        .from("notification_preferences")
        .select("replies_enabled, follows_enabled, mentions_enabled")
        .eq("user_id", userData.user.id)
        .maybeSingle();

      if (preferences) {
        setRepliesEnabled(preferences.replies_enabled ?? true);
        setFollowsEnabled(preferences.follows_enabled ?? true);
        setMentionsEnabled(preferences.mentions_enabled ?? true);
      }

      setLoading(false);
    }

    loadProfile();
  }, []);

  async function saveProfile() {
    setMessage("");
    setSaving(true);

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const cleanUsername = username
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();

    if (!/^[a-z0-9_]{2,30}$/.test(cleanUsername)) {
      setSaving(false);
      setMessage("Username must be 2-30 characters and can only use letters, numbers, and underscores.");
      return;
    }

    const { data: existingUsername } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", cleanUsername)
      .neq("id", userData.user.id)
      .maybeSingle();

    if (existingUsername) {
      setSaving(false);
      setMessage("That username is already taken. Please choose another one.");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: userData.user.id,
      full_name: fullName,
      username: cleanUsername,
      bio,
    });

    if (profileError) {
      setSaving(false);

      if (profileError.code === "23505") {
        setMessage("That username is already taken. Please choose another one.");
        return;
      }

      setMessage(`Error: ${profileError.message}`);
      return;
    }

    const { error: preferencesError } = await supabase
      .from("notification_preferences")
      .upsert({
        user_id: userData.user.id,
        replies_enabled: repliesEnabled,
        follows_enabled: followsEnabled,
        mentions_enabled: mentionsEnabled,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (preferencesError) {
      setMessage(`Profile saved, but notification settings failed: ${preferencesError.message}`);
      return;
    }

    setMessage("Profile and notification settings updated successfully.");
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
          Manage your public Loombus profile and notification preferences.
        </p>

        <div className="space-y-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <section className="space-y-5">
            <div>
              <h2 className="text-2xl font-medium">
                Public profile
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                This information appears on your Loombus profile.
              </p>
            </div>

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
              <p className="mt-2 text-xs text-zinc-600">
                Use 2-30 letters, numbers, or underscores. Usernames must be unique and should not include the @ symbol.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-zinc-400">
                Username
              </label>

              <input
                type="text"
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value
                      .replace(/^@+/, "")
                      .replace(/[^a-zA-Z0-9_]/g, "")
                      .toLowerCase()
                  )
                }
                placeholder="saint"
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
          </section>

          <section className="border-t border-zinc-900 pt-8">
            <div className="mb-5">
              <h2 className="text-2xl font-medium">
                Notification settings
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Choose which activity can create notifications for you.
              </p>
            </div>

            <div className="space-y-4">
              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Replies
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Notify me when someone replies to my discussions.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={repliesEnabled}
                  onChange={(e) => setRepliesEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Follows
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Notify me when someone follows my profile.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={followsEnabled}
                  onChange={(e) => setFollowsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>

              <label className="flex items-start justify-between gap-4 rounded-2xl border border-zinc-900 bg-black p-4">
                <span>
                  <span className="block text-sm font-medium text-zinc-200">
                    Mentions
                  </span>
                  <span className="mt-1 block text-sm text-zinc-500">
                    Reserved for future @mention notifications.
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={mentionsEnabled}
                  onChange={(e) => setMentionsEnabled(e.target.checked)}
                  className="mt-1 h-5 w-5"
                />
              </label>
            </div>
          </section>

          <button
            type="button"
            onClick={saveProfile}
            disabled={saving}
            className="rounded-full bg-white px-6 py-3 text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {saving ? "Saving..." : "Save Profile"}
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
