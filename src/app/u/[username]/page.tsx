"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/profile-avatar";
import { DEFAULT_REPORT_REASON, REPORT_REASONS, type ReportReason } from "@/lib/report-reasons";

type Profile = {
  id: string;
  full_name: string;
  username: string;
  bio: string | null;
  avatar_url: string | null;
};

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

export default function UserProfilePage() {
  const params = useParams();
  const username = params.username as string;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followMessage, setFollowMessage] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [followWorking, setFollowWorking] = useState(false);
  const [reportWorking, setReportWorking] = useState(false);
  const [reportedProfile, setReportedProfile] = useState(false);
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id ?? null;

      setCurrentUserId(viewerId);

      if (viewerId && viewerId !== profileData.id) {
        const { data: followData } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", viewerId)
          .eq("following_id", profileData.id)
          .maybeSingle();

        setIsFollowing(Boolean(followData));

        const { data: reportData } = await supabase
          .from("reports")
          .select("id")
          .eq("reporter_id", viewerId)
          .eq("reported_profile_id", profileData.id)
          .maybeSingle();

        setReportedProfile(Boolean(reportData));
      }

      const { count: followerTotal } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileData.id);

      const { count: followingTotal } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileData.id);

      setFollowerCount(followerTotal ?? 0);
      setFollowingCount(followingTotal ?? 0);

      const { data: discussionData } = await supabase
        .from("discussions")
        .select("*")
        .is("deleted_at", null)
        .eq("user_id", profileData.id)
        .order("created_at", { ascending: false });

      setDiscussions(discussionData ?? []);
      setLoading(false);
    }

    loadProfile();
  }, [username]);

  async function toggleFollow() {
    setFollowMessage("");

    if (!profile || followWorking) {
      return;
    }

    setFollowWorking(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/follows/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionData.session.access_token}`,
      },
      body: JSON.stringify({
        targetUserId: profile.id,
      }),
    });

      const result = await response.json();

      if (!response.ok) {
        setFollowMessage(result.error ?? "Unable to update follow status.");
        return;
      }

      setIsFollowing(result.following);
      setFollowerCount((count) =>
        result.following ? count + 1 : Math.max(0, count - 1)
      );
      setFollowMessage(result.following ? "Following." : "Unfollowed.");
    } finally {
      setFollowWorking(false);
    }
  }

  async function handleReportProfile() {
    setReportMessage("");

    if (!profile || reportWorking || reportedProfile) {
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    if (userData.user.id === profile.id) {
      setReportMessage("You cannot report your own profile.");
      return;
    }

    setReportWorking(true);

    try {
      const { data: existingReport } = await supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", userData.user.id)
        .eq("reported_profile_id", profile.id)
        .maybeSingle();

      if (existingReport) {
        setReportedProfile(true);
        setReportMessage("You already reported this profile.");
        return;
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id: userData.user.id,
        reported_profile_id: profile.id,
        reason: reportReason,
      });

      if (error) {
        if (error.code === "23505") {
          setReportedProfile(true);
          setReportMessage("You already reported this profile.");
          return;
        }

        setReportMessage("Unable to report profile.");
        return;
      }

      setReportedProfile(true);
      setReportMessage("Profile reported.");
    } finally {
      setReportWorking(false);
    }
  }


  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-5xl font-semibold tracking-tight">
            User not found.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <div className="mb-6 flex items-center gap-5">
            <ProfileAvatar profile={profile} size="xl" />

            <div>
              <p className="mb-2 text-sm text-zinc-500">
                @{profile.username}
              </p>

              <h1 className="text-5xl font-semibold tracking-tight">
                {profile.full_name}
              </h1>
            </div>
          </div>

          <p className="max-w-2xl leading-relaxed text-zinc-400">
            {profile.bio || "No bio added yet."}
          </p>

          <div className="mt-6 flex gap-8 text-sm text-zinc-500">
            <Link
              href={`/u/${profile.username}/followers`}
              className="transition hover:text-white"
            >
              <span className="text-white">{followerCount}</span> followers
            </Link>

            <Link
              href={`/u/${profile.username}/following`}
              className="transition hover:text-white"
            >
              <span className="text-white">{followingCount}</span> following
            </Link>
          </div>

          {!currentUserId && (
            <div className="mt-8">
              <Link
                href="/login"
                className="inline-flex rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200"
              >
                Log in to follow
              </Link>

              <p className="mt-4 text-sm text-zinc-500">
                Members can follow contributors and build their Loombus network.
              </p>
            </div>
          )}

          {currentUserId && currentUserId !== profile.id && (
            <div className="mt-8">
              <div className="flex flex-wrap items-end gap-3">
                <button
                  onClick={toggleFollow}
                  disabled={followWorking}
                  className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  {followWorking ? "Updating..." : isFollowing ? "Following" : "Follow"}
                </button>

                <label className="flex min-w-64 flex-col text-xs text-zinc-500">
                  <span className="mb-2">Report reason</span>

                  <select
                    value={reportReason}
                    onChange={(event) => setReportReason(event.target.value as ReportReason)}
                    className="rounded-full border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleReportProfile}
                  disabled={reportWorking || reportedProfile}
                  className="rounded-full border border-red-900 px-6 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                >
                  {reportedProfile
                    ? "Reported"
                    : reportWorking
                      ? "Reporting..."
                      : "Report Profile"}
                </button>
              </div>

              {(followMessage || reportMessage) && (
                <p className="mt-4 text-sm text-zinc-500">
                  {followMessage || reportMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <h2 className="mb-8 text-3xl font-semibold tracking-tight">
          Discussions
        </h2>

        <div className="space-y-6">
          {discussions.map((discussion) => (
            <Link
              key={discussion.id}
              href={`/discussions/${discussion.id}`}
              className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-6 transition hover:border-zinc-700"
            >
              <p className="mb-3 text-sm text-zinc-500">
                {discussion.topic}
              </p>

              <h3 className="mb-3 text-2xl font-medium">
                {discussion.title}
              </h3>

              <p className="line-clamp-2 leading-relaxed text-zinc-400">
                {discussion.body}
              </p>
            </Link>
          ))}

          {discussions.length === 0 && (
            <p className="text-zinc-500">
              No discussions yet.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
