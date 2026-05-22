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
  creator_website_url: string | null;
  creator_support_url: string | null;
  creator_support_label: string | null;
};

type Discussion = {
  id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type ProfileBadge = {
  key: "premium" | "premium_plus" | "admin";
  label: string;
};

function getBadgeClassName(badge: ProfileBadge) {
  if (badge.key === "admin") {
    return "border-sky-800 bg-sky-950/40 text-sky-300";
  }

  if (badge.key === "premium_plus") {
    return "border-violet-800 bg-violet-950/40 text-violet-300";
  }

  return "border-emerald-800 bg-emerald-950/40 text-emerald-300";
}

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
  const [blockMessage, setBlockMessage] = useState("");
  const [followWorking, setFollowWorking] = useState(false);
  const [reportWorking, setReportWorking] = useState(false);
  const [blockWorking, setBlockWorking] = useState(false);
  const [reportedProfile, setReportedProfile] = useState(false);
  const [reportReason, setReportReason] = useState(DEFAULT_REPORT_REASON);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByProfile, setIsBlockedByProfile] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [profileBadge, setProfileBadge] = useState<ProfileBadge | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, username, bio, avatar_url, creator_website_url, creator_support_url, creator_support_label")
        .eq("username", username)
        .single();

      if (!profileData) {
        setLoading(false);
        return;
      }

      setProfile(profileData);

      const badgeResponse = await fetch("/api/profiles/badges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profileIds: [profileData.id],
        }),
      });

      if (badgeResponse.ok) {
        const badgeResult = (await badgeResponse.json()) as {
          badges?: Record<string, ProfileBadge>;
        };

        setProfileBadge(badgeResult.badges?.[profileData.id] ?? null);
      }

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

        const { data: ownBlockData } = await supabase
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", viewerId)
          .eq("blocked_id", profileData.id)
          .maybeSingle();

        setIsBlocked(Boolean(ownBlockData));

        const { data: incomingBlockData } = await supabase
          .from("user_blocks")
          .select("id")
          .eq("blocker_id", profileData.id)
          .eq("blocked_id", viewerId)
          .maybeSingle();

        setIsBlockedByProfile(Boolean(incomingBlockData));
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
    setBlockMessage("");

    if (isBlocked) {
      setFollowMessage("Unblock this member before following them.");
      return;
    }

    if (isBlockedByProfile) {
      setFollowMessage("You cannot follow this member.");
      return;
    }

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

  async function toggleBlock() {
    setBlockMessage("");
    setFollowMessage("");
    setReportMessage("");

    if (!profile || blockWorking) {
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      window.location.href = "/login";
      return;
    }

    setBlockWorking(true);

    try {
      const response = await fetch("/api/blocks/toggle", {
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
        setBlockMessage(result.error ?? "Unable to update block status.");
        return;
      }

      setIsBlocked(Boolean(result.blocked));

      if (result.blocked) {
        setIsFollowing(false);
        setFollowerCount((count) => (isFollowing ? Math.max(0, count - 1) : count));
        setBlockMessage("Member blocked. Follow connection removed.");
      } else {
        setBlockMessage("Member unblocked.");
      }
    } finally {
      setBlockWorking(false);
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
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading profile...
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
            User not found.
          </h1>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 rounded-3xl border border-zinc-800 bg-zinc-950 p-8">
          <div className="mb-6 flex items-center gap-5">
            <ProfileAvatar profile={profile} size="xl" />

            <div>
              <div className="mb-2 flex flex-wrap items-center gap-3">
                <p className="text-sm text-zinc-500">
                  @{profile.username}
                </p>

                {profileBadge && (
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getBadgeClassName(profileBadge)}`}
                  >
                    {profileBadge.label}
                  </span>
                )}
              </div>

              <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
                {profile.full_name}
              </h1>
            </div>
          </div>

          <p className="max-w-2xl leading-relaxed text-zinc-400">
            {profile.bio || "No bio added yet."}
          </p>

          {(profile.creator_website_url || profile.creator_support_url) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {profile.creator_website_url && (
                <a
                  href={profile.creator_website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  Website
                </a>
              )}

              {profile.creator_support_url && (
                <a
                  href={profile.creator_support_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                >
                  {profile.creator_support_label || "Support"}
                </a>
              )}
            </div>
          )}

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
              {isBlockedByProfile ? (
                <div className="rounded-3xl border border-zinc-800 bg-black p-5 text-sm text-zinc-500">
                  You cannot interact with this profile.
                </div>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  {!isBlocked && (
                    <button
                      onClick={toggleFollow}
                      disabled={followWorking}
                      className="rounded-full bg-white px-6 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      {followWorking ? "Updating..." : isFollowing ? "Following" : "Follow"}
                    </button>
                  )}

                  {!isBlocked && (
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
                  )}

                  {!isBlocked && (
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
                  )}

                  <button
                    type="button"
                    onClick={toggleBlock}
                    disabled={blockWorking}
                    className="rounded-full border border-zinc-800 px-6 py-3 text-sm text-zinc-400 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                  >
                    {blockWorking
                      ? "Updating..."
                      : isBlocked
                        ? "Unblock User"
                        : "Block User"}
                  </button>
                </div>
              )}

              {(followMessage || reportMessage || blockMessage) && (
                <p className="mt-4 text-sm text-zinc-500">
                  {followMessage || reportMessage || blockMessage}
                </p>
              )}
            </div>
          )}
        </div>

        <h2 className="mb-8 text-3xl font-semibold tracking-tight">
          Discussions
        </h2>

        <div className="space-y-5">
          {discussions.map((discussion) => (
            <Link
              key={discussion.id}
              href={`/discussions/${discussion.id}`}
              className="block rounded-3xl border border-zinc-800 bg-zinc-950 p-7 shadow-2xl shadow-black/30 transition hover:-translate-y-0.5 hover:border-zinc-700"
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
