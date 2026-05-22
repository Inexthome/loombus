"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
};

type BlockRow = {
  id: string;
  blocked_id: string;
  created_at: string;
};

type BlockedProfile = {
  block_id: string;
  created_at: string;
  profile: Profile;
};

export default function BlockedUsersPage() {
  const [blockedProfiles, setBlockedProfiles] = useState<BlockedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [workingProfileId, setWorkingProfileId] = useState<string | null>(null);

  useEffect(() => {
    async function loadBlockedUsers() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: blockRows, error: blockError } = await supabase
        .from("user_blocks")
        .select("id, blocked_id, created_at")
        .eq("blocker_id", userData.user.id)
        .order("created_at", { ascending: false });

      if (blockError) {
        setMessage("Unable to load blocked users.");
        setLoading(false);
        return;
      }

      const blockedIds = [
        ...new Set(((blockRows ?? []) as BlockRow[]).map((row) => row.blocked_id)),
      ];

      if (blockedIds.length === 0) {
        setBlockedProfiles([]);
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, bio")
        .in("id", blockedIds);

      if (profileError) {
        setMessage("Unable to load blocked profiles.");
        setLoading(false);
        return;
      }

      const profileMap = new Map(
        ((profileData ?? []) as Profile[]).map((profile) => [profile.id, profile])
      );

      setBlockedProfiles(
        ((blockRows ?? []) as BlockRow[])
          .map((block) => {
            const profile = profileMap.get(block.blocked_id);

            if (!profile) {
              return null;
            }

            return {
              block_id: block.id,
              created_at: block.created_at,
              profile,
            };
          })
          .filter((item): item is BlockedProfile => Boolean(item))
      );

      setLoading(false);
    }

    loadBlockedUsers();
  }, []);

  async function unblockProfile(profileId: string) {
    setMessage("");

    if (workingProfileId) {
      return;
    }

    setWorkingProfileId(profileId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/blocks/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          targetUserId: profileId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to unblock user.");
        return;
      }

      if (result.blocked) {
        setMessage("Block status was out of sync. This member is still blocked.");
        return;
      }

      setBlockedProfiles((current) =>
        current.filter((item) => item.profile.id !== profileId)
      );
      setMessage("User unblocked.");
    } finally {
      setWorkingProfileId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading blocked users...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/settings"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to settings
        </Link>

        <div className="mb-12">
          <p className="mb-4 text-sm uppercase tracking-[0.3em] text-zinc-500">
            Privacy
          </p>

          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            Blocked Users
          </h1>

          <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
            Review members you blocked and unblock them when you are ready.
            Blocked users are filtered from People, feeds, replies, and notifications.
          </p>
        </div>

        {message && (
          <div className="mb-6 rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-400 shadow-2xl shadow-black/30">
            {message}
          </div>
        )}

        {blockedProfiles.length === 0 ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30">
            <h2 className="mb-3 text-2xl font-medium">
              No blocked users.
            </h2>

            <p className="text-zinc-400">
              Members you block will appear here so you can manage them later.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {blockedProfiles.map((item) => {
              const profile = item.profile;
              const isWorking = workingProfileId === profile.id;

              return (
                <div
                  key={item.block_id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30"
                >
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <ProfileAvatar profile={profile} size="xl" />

                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-medium">
                          {getProfileDisplayName(profile)}
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                          {profile.username ? `@${profile.username}` : "No username yet"}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => unblockProfile(profile.id)}
                      disabled={isWorking}
                      className="shrink-0 rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      {isWorking ? "Updating..." : "Unblock"}
                    </button>
                  </div>

                  <p className="mb-4 line-clamp-3 leading-relaxed text-zinc-400">
                    {profile.bio || "No bio yet."}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
                    <span>
                      Blocked {new Date(item.created_at).toLocaleDateString()}
                    </span>

                    {profile.username && (
                      <Link
                        href={`/u/${profile.username}`}
                        className="text-zinc-400 transition hover:text-white"
                      >
                        View profile →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
