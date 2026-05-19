"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
};

type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
};

type Reply = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
};

function MentionText({ text }: { text: string }) {
  const parts = text.split(/(@[a-zA-Z0-9_]{2,30})/g);

  return (
    <>
      {parts.map((part, index) => {
        const match = part.match(/^@([a-zA-Z0-9_]{2,30})$/);

        if (!match) {
          return <span key={`${part}-${index}`}>{part}</span>;
        }

        const username = match[1].toLowerCase();

        return (
          <Link
            key={`${part}-${index}`}
            href={`/u/${username}`}
            className="font-medium text-white underline decoration-zinc-600 underline-offset-4 transition hover:decoration-white"
          >
            @{username}
          </Link>
        );
      })}
    </>
  );
}

function getProfileInitials(profile: Profile | undefined | null) {
  const label = profile?.full_name?.trim() || profile?.username?.trim() || "L";

  const parts = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts
    .map((part) => part[0]?.toUpperCase())
    .join("") || "L";
}

function ProfileAvatar({
  profile,
  size = "md",
}: {
  profile?: Profile | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-zinc-800 bg-black font-medium text-zinc-300 ${sizeClass}`}
      aria-hidden="true"
    >
      {getProfileInitials(profile)}
    </span>
  );
}

function ProfileName({
  profile,
  fallback = "Loombus member",
}: {
  profile?: Profile | null;
  fallback?: string;
}) {
  const label =
    profile?.full_name || (profile?.username ? `@${profile.username}` : fallback);

  if (!profile?.username) {
    return <>{label}</>;
  }

  return (
    <Link
      href={`/u/${profile.username}`}
      className="text-zinc-400 transition hover:text-white"
    >
      {label}
    </Link>
  );
}

export default function DiscussionPage() {
  const params = useParams();
  const id = params.id as string;

  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [replyProfiles, setReplyProfiles] = useState<Record<string, Profile>>({});
  const [replyBody, setReplyBody] = useState("");
  const [postingReply, setPostingReply] = useState(false);
  const [deletingReplyId, setDeletingReplyId] = useState<string | null>(null);
  const [reportingReplyId, setReportingReplyId] = useState<string | null>(null);
  const [reportedDiscussion, setReportedDiscussion] = useState(false);
  const [reportedReplyIds, setReportedReplyIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [bookmarkMessage, setBookmarkMessage] = useState("");
  const [isSaved, setIsSaved] = useState(false);
  const [savedBookmarkId, setSavedBookmarkId] = useState<string | null>(null);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [reportMessage, setReportMessage] = useState("");

  useEffect(() => {
    async function loadDiscussion() {
      const { data: discussionData, error: discussionError } = await supabase
        .from("discussions")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (discussionError || !discussionData) {
        setDiscussion(null);
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", discussionData.user_id)
        .single();

      const { data: repliesData } = await supabase
        .from("replies")
        .select("*")
        .eq("discussion_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });

      const replyUserIds = [...new Set((repliesData ?? []).map((reply) => reply.user_id))];

      const replyProfileMap: Record<string, Profile> = {};

      if (replyUserIds.length > 0) {
        const { data: replyProfileData } = await supabase
          .from("profiles")
          .select("*")
          .in("id", replyUserIds);

        for (const replyProfile of replyProfileData ?? []) {
          replyProfileMap[replyProfile.id] = replyProfile;
        }
      }

      const { data: viewerData } = await supabase.auth.getUser();

      setCurrentUserId(viewerData.user?.id ?? null);

      await supabase.from("discussion_views").insert({
        discussion_id: id,
        viewer_id: viewerData.user?.id ?? null,
      });

      if (viewerData.user) {
        const { data: savedData } = await supabase
          .from("bookmarks")
          .select("id")
          .eq("user_id", viewerData.user.id)
          .eq("discussion_id", id)
          .maybeSingle();

        setIsSaved(Boolean(savedData));
        setSavedBookmarkId(savedData?.id ?? null);

        const { data: existingDiscussionReport } = await supabase
          .from("reports")
          .select("id")
          .eq("reporter_id", viewerData.user.id)
          .eq("discussion_id", id)
          .is("reply_id", null)
          .maybeSingle();

        setReportedDiscussion(Boolean(existingDiscussionReport));

        const replyIds = (repliesData ?? []).map((reply) => reply.id);

        if (replyIds.length > 0) {
          const { data: existingReplyReports } = await supabase
            .from("reports")
            .select("reply_id")
            .eq("reporter_id", viewerData.user.id)
            .in("reply_id", replyIds);

          setReportedReplyIds(
            (existingReplyReports ?? [])
              .map((report) => report.reply_id)
              .filter((replyId): replyId is string => Boolean(replyId))
          );
        }

        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", viewerData.user.id)
          .single();

        setIsAdmin(Boolean(viewerProfile?.is_admin));
      }

      setDiscussion(discussionData);
      setProfile(profileData ?? null);
      setReplies(repliesData ?? []);
      setReplyProfiles(replyProfileMap);
      setLoading(false);
    }

    loadDiscussion();
  }, [id]);

  async function handleReply() {
    setMessage("");

    if (postingReply) {
      return;
    }

    if (!replyBody.trim()) {
      setMessage("Reply cannot be empty.");
      return;
    }

    setPostingReply(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          discussionId: id,
          body: replyBody,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to post reply.");
        return;
      }

      const newReply = result.reply as Reply | undefined;

      if (newReply) {
        setReplies((current) => [...current, newReply]);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", newReply.user_id)
          .single();

        if (profileData) {
          setReplyProfiles((current) => ({
            ...current,
            [newReply.user_id]: profileData,
          }));
        }
      }

      setReplyBody("");
      setMessage("Reply posted.");
    } finally {
      setPostingReply(false);
    }
  }

  async function handleDeleteReply(replyId: string) {
    setMessage("");

    if (deletingReplyId) {
      return;
    }

    setDeletingReplyId(replyId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();

      if (!sessionData.session) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          replyId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to delete reply.");
        return;
      }

      setReplies((current) =>
        current.filter((reply) => reply.id !== replyId)
      );
      setMessage("Reply deleted.");
    } finally {
      setDeletingReplyId(null);
    }
  }

  async function handleBookmark() {
    setBookmarkMessage("");

    if (savingBookmark) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: bookmark, error } = await supabase
        .from("bookmarks")
        .insert({
          user_id: userData.user.id,
          discussion_id: id,
        })
        .select("id")
        .single();

      if (error) {
        setBookmarkMessage("Already saved or unable to save.");
        return;
      }

      setIsSaved(true);
      setSavedBookmarkId(bookmark?.id ?? null);
      setBookmarkMessage("Discussion saved.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleRemoveBookmark() {
    setBookmarkMessage("");

    if (savingBookmark || !savedBookmarkId) {
      return;
    }

    setSavingBookmark(true);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("id", savedBookmarkId)
        .eq("user_id", userData.user.id);

      if (error) {
        setBookmarkMessage("Unable to remove saved discussion.");
        return;
      }

      setIsSaved(false);
      setSavedBookmarkId(null);
      setBookmarkMessage("Saved discussion removed.");
    } finally {
      setSavingBookmark(false);
    }
  }

  async function handleReport() {
    setReportMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { data: existingReport } = await supabase
      .from("reports")
      .select("id")
      .eq("reporter_id", userData.user.id)
      .eq("discussion_id", id)
      .is("reply_id", null)
      .maybeSingle();

    if (existingReport) {
      setReportedDiscussion(true);
      setReportMessage("You already reported this discussion.");
      return;
    }

    const { error } = await supabase.from("reports").insert({
      reporter_id: userData.user.id,
      discussion_id: id,
      reason: "User submitted report",
    });

    if (error) {
      if (error.code === "23505") {
        setReportedDiscussion(true);
        setReportMessage("You already reported this discussion.");
        return;
      }

      setReportMessage("Unable to submit report.");
      return;
    }

    setReportedDiscussion(true);
    setReportMessage("Discussion reported.");
  }

  async function handleReportReply(replyId: string) {
    setReportMessage("");

    if (reportingReplyId) {
      return;
    }

    setReportingReplyId(replyId);

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: existingReport } = await supabase
        .from("reports")
        .select("id")
        .eq("reporter_id", userData.user.id)
        .eq("reply_id", replyId)
        .maybeSingle();

      if (existingReport) {
        setReportedReplyIds((current) =>
          current.includes(replyId) ? current : [...current, replyId]
        );
        setReportMessage("You already reported this reply.");
        return;
      }

      const { error } = await supabase.from("reports").insert({
        reporter_id: userData.user.id,
        discussion_id: id,
        reply_id: replyId,
        reason: "User submitted reply report",
      });

      if (error) {
        if (error.code === "23505") {
          setReportedReplyIds((current) =>
            current.includes(replyId) ? current : [...current, replyId]
          );
          setReportMessage("You already reported this reply.");
          return;
        }

        setReportMessage("Unable to report reply.");
        return;
      }

      setReportedReplyIds((current) =>
        current.includes(replyId) ? current : [...current, replyId]
      );
      setReportMessage("Reply reported.");
    } finally {
      setReportingReplyId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl text-zinc-400">
          Loading discussion...
        </div>
      </main>
    );
  }

  if (!discussion) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-6 text-4xl font-semibold">
            Discussion not found.
          </h1>

          <Link href="/discussions" className="text-zinc-400 hover:text-white">
            ← Back to discussions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/discussions"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to discussions
        </Link>

        <p className="mb-4 text-sm text-zinc-500">
          {discussion.topic}
        </p>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          {discussion.title}
        </h1>

        <p className="mb-3 text-sm text-zinc-600">
          <span className="inline-flex items-center gap-3">
              <ProfileAvatar profile={profile} />
              <span>
                by <ProfileName profile={profile} />
              </span>
            </span>
        </p>

        <p className="mb-10 text-xl leading-relaxed text-zinc-300">
          {discussion.body}
        </p>

        <div className="mb-12 flex flex-wrap items-center gap-4">
          {isSaved ? (
            <button
              onClick={handleRemoveBookmark}
              disabled={savingBookmark}
              className="rounded-full border border-zinc-800 bg-zinc-900 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Removing..." : "Unsave"}
            </button>
          ) : (
            <button
              onClick={handleBookmark}
              disabled={savingBookmark}
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {savingBookmark ? "Saving..." : "Save Discussion"}
            </button>
          )}

          <button
            onClick={handleReport}
            disabled={reportedDiscussion}
            className="rounded-full border border-red-900 px-5 py-3 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
          >
            {reportedDiscussion ? "Reported" : "Report Discussion"}
          </button>

          {(bookmarkMessage || reportMessage) && (
            <p className="text-sm text-zinc-500">
              {bookmarkMessage || reportMessage}
            </p>
          )}
        </div>

        <div className="mb-16 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="mb-6 text-xl font-medium">
            AI Summary
          </h2>

          <p className="leading-relaxed text-zinc-400">
            AI summaries will be generated here later. For now, this section
            reserves space for the platform intelligence layer.
          </p>
        </div>

        <div>
          <h2 className="mb-8 text-2xl font-medium">
            Replies
          </h2>

          <form className="mb-10 rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <label className="mb-3 block text-sm text-zinc-400">
              Add a thoughtful reply
            </label>

            <textarea
              rows={5}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              disabled={postingReply}
              placeholder="Contribute with clarity, context, and signal... Use @username to mention someone."
              className="mb-4 w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none focus:border-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-600"
            />

            <button
              type="button"
              onClick={handleReply}
              disabled={postingReply}
              className="rounded-full bg-white px-5 py-3 text-sm text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {postingReply ? "Posting..." : "Post Reply"}
            </button>

            {message && <p className="mt-4 text-sm text-zinc-400">{message}</p>}
          </form>

          <div className="space-y-6">
            {replies.map((reply) => {
              const canDeleteReply =
                Boolean(currentUserId) &&
                (reply.user_id === currentUserId || isAdmin);

              const hasReportedReply = reportedReplyIds.includes(reply.id);

              const canReportReply =
                Boolean(currentUserId) && reply.user_id !== currentUserId;

              return (
                <div
                  key={reply.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm text-zinc-500">
                      <span className="inline-flex items-center gap-3">
                        <ProfileAvatar
                          profile={replyProfiles[reply.user_id]}
                          size="sm"
                        />
                        <ProfileName profile={replyProfiles[reply.user_id]} />
                      </span>
                    </p>

                    {canReportReply && (
                      <button
                        type="button"
                        onClick={() => handleReportReply(reply.id)}
                        disabled={reportingReplyId === reply.id || hasReportedReply}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {hasReportedReply
                          ? "Reported"
                          : reportingReplyId === reply.id
                            ? "Reporting..."
                            : "Report"}
                      </button>
                    )}

                    {canDeleteReply && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReply(reply.id)}
                        disabled={deletingReplyId === reply.id}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-red-900 hover:text-red-300 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {deletingReplyId === reply.id ? "Deleting..." : "Delete"}
                      </button>
                    )}
                  </div>

                  <p className="whitespace-pre-wrap leading-relaxed text-zinc-300">
                    <MentionText text={reply.body} />
                  </p>
                </div>
              );
            })}

            {replies.length === 0 && (
              <p className="text-zinc-500">
                No replies yet. Be the first to contribute.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
