"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type DiscussionRef = {
  id: string;
  title: string;
  topic: string;
} | null;

type ReplyRef = {
  id: string;
  body: string;
  user_id: string;
  discussion_id: string;
  deleted_at: string | null;
} | null;

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
};

type Report = {
  id: string;
  reason: string;
  status: string;
  created_at: string;
  discussion_id: string | null;
  reply_id: string | null;
  reported_profile_id: string | null;
  discussions: DiscussionRef;
  replies: ReplyRef;
};

type ReportFilter = "all" | "open" | "reviewed" | "discussions" | "replies" | "profiles";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filterMode, setFilterMode] = useState<ReportFilter>("all");
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadReports() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data } = await supabase
        .from("reports")
        .select(`
          id,
          reason,
          status,
          created_at,
          discussion_id,
          reply_id,
          reported_profile_id,
          discussions (
            id,
            title,
            topic
          ),
          replies (
            id,
            body,
            user_id,
            discussion_id,
            deleted_at
          )
        `)
        .order("created_at", { ascending: false });

      const normalized = (data ?? []).map((item) => ({
        ...item,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
        replies: Array.isArray(item.replies)
          ? item.replies[0] ?? null
          : item.replies,
      })) as Report[];

      setReports(normalized);

      const replyUserIds = normalized
        .map((report) => report.replies?.user_id)
        .filter((id): id is string => Boolean(id));

      const reportedProfileIds = normalized
        .map((report) => report.reported_profile_id)
        .filter((id): id is string => Boolean(id));

      const profileIds = [...new Set([...replyUserIds, ...reportedProfileIds])];

      if (profileIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name")
          .in("id", profileIds);

        const profileMap: Record<string, Profile> = {};

        for (const item of profileData ?? []) {
          profileMap[item.id] = item;
        }

        setProfiles(profileMap);
      }

      setLoading(false);
    }

    loadReports();
  }, []);

  async function softDeleteDiscussion(discussionId: string | undefined | null) {
    if (!discussionId) {
      return;
    }

    setMessage("");

    const { data: userData } = await supabase.auth.getUser();

    if (!userData.user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase
      .from("discussions")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userData.user.id,
        deletion_reason: "Admin moderation action",
      })
      .eq("id", discussionId);

    if (error) {
      setMessage(`Unable to soft delete discussion: ${error.message}`);
      return;
    }

    await supabase.from("audit_logs").insert({
      actor_id: userData.user.id,
      action: "discussion.soft_deleted",
      target_type: "discussion",
      target_id: discussionId,
      metadata: {
        reason: "Admin moderation action",
      },
    });

    setReports((current) =>
      current.filter((report) => report.discussion_id !== discussionId)
    );
  }

  async function softDeleteReply(reportId: string, replyId: string | null) {
    if (!replyId) {
      return;
    }

    setMessage("");

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
      setMessage(result.error ?? "Unable to soft delete reply.");
      return;
    }

    setReports((current) =>
      current.filter((report) => report.id !== reportId)
    );
    setMessage("Reply soft deleted.");
  }

  async function markReviewed(reportId: string) {
    setMessage("");

    const { error } = await supabase
      .from("reports")
      .update({ status: "reviewed" })
      .eq("id", reportId);

    if (error) {
      setMessage(`Unable to mark reviewed: ${error.message}`);
      return;
    }

    setReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? { ...report, status: "reviewed" }
          : report
      )
    );
  }

  function getReplyAuthorLabel(reply: ReplyRef) {
    if (!reply) {
      return "Unknown author";
    }

    const profile = profiles[reply.user_id];

    return profile?.full_name || profile?.username || "Loombus member";
  }

  const filteredReports = reports.filter((report) => {
    if (filterMode === "open") {
      return report.status === "open";
    }

    if (filterMode === "reviewed") {
      return report.status === "reviewed";
    }

    if (filterMode === "discussions") {
      return !report.reply_id && !report.reported_profile_id;
    }

    if (filterMode === "replies") {
      return Boolean(report.reply_id);
    }

    if (filterMode === "profiles") {
      return Boolean(report.reported_profile_id);
    }

    return true;
  });

  const filterOptions: {
    label: string;
    value: ReportFilter;
    count: number;
  }[] = [
    {
      label: "All",
      value: "all",
      count: reports.length,
    },
    {
      label: "Open",
      value: "open",
      count: reports.filter((report) => report.status === "open").length,
    },
    {
      label: "Reviewed",
      value: "reviewed",
      count: reports.filter((report) => report.status === "reviewed").length,
    },
    {
      label: "Discussions",
      value: "discussions",
      count: reports.filter((report) => !report.reply_id && !report.reported_profile_id).length,
    },
    {
      label: "Replies",
      value: "replies",
      count: reports.filter((report) => Boolean(report.reply_id)).length,
    },
    {
      label: "Profiles",
      value: "profiles",
      count: reports.filter((report) => Boolean(report.reported_profile_id)).length,
    },
  ];

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl text-zinc-400">
          Loading reports...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="text-zinc-400">
            This moderation area is restricted to admins.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Reports
        </h1>

        <p className="mb-8 text-zinc-500">
          Review discussions, replies, and profiles submitted for moderation.
        </p>

        <div className="mb-10 flex flex-wrap gap-3">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilterMode(option.value)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                filterMode === option.value
                  ? "bg-white text-black"
                  : "border border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-white"
              }`}
            >
              {option.label}
              <span className="ml-2 opacity-70">
                {option.count}
              </span>
            </button>
          ))}
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        {filteredReports.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
            <h2 className="mb-3 text-2xl font-medium">
              No reports found.
            </h2>

            <p className="text-zinc-400">
              No reports match the current filter.
            </p>
          </div>
        )}

        <div className="space-y-6">
          {filteredReports.map((report) => {
            const isReplyReport = Boolean(report.reply_id);
            const isProfileReport = Boolean(report.reported_profile_id);
            const reportedProfile = report.reported_profile_id
              ? profiles[report.reported_profile_id]
              : null;

            return (
              <div
                key={report.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="mb-3 text-sm text-zinc-500">
                      {new Date(report.created_at).toLocaleString()}
                    </p>

                    <p className="mb-2 text-xs uppercase tracking-[0.25em] text-zinc-600">
                      {isProfileReport
                        ? "Profile report"
                        : isReplyReport
                          ? "Reply report"
                          : "Discussion report"}
                    </p>

                    <h2 className="text-2xl font-medium">
                      {isProfileReport
                        ? reportedProfile?.full_name || reportedProfile?.username || "Profile unavailable"
                        : report.discussions?.title ?? "Discussion unavailable"}
                    </h2>
                  </div>

                  <p className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                    {report.status}
                  </p>
                </div>

                <p className="mb-3 text-zinc-400">
                  Reason: {report.reason}
                </p>

                {isProfileReport && (
                  <div className="mb-4 rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-2 text-sm text-zinc-500">
                      Reported profile
                    </p>

                    <p className="leading-relaxed text-zinc-400">
                      {reportedProfile
                        ? `${reportedProfile.full_name || "Loombus member"}${
                            reportedProfile.username ? ` (@${reportedProfile.username})` : ""
                          }`
                        : "Profile unavailable."}
                    </p>
                  </div>
                )}

                {isReplyReport && (
                  <div className="mb-4 rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-2 text-sm text-zinc-500">
                      Reply by {getReplyAuthorLabel(report.replies)}
                    </p>

                    <p className="whitespace-pre-wrap leading-relaxed text-zinc-400">
                      {report.replies?.body ?? "Reply unavailable."}
                    </p>

                    {report.replies?.deleted_at && (
                      <p className="mt-3 text-xs text-zinc-600">
                        This reply is already deleted.
                      </p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-4">
                  {isProfileReport && reportedProfile?.username && (
                    <Link
                      href={`/u/${reportedProfile.username}`}
                      className="text-sm text-zinc-300 hover:text-white"
                    >
                      View profile →
                    </Link>
                  )}

                  {!isProfileReport && report.discussions && (
                    <Link
                      href={`/discussions/${report.discussions.id}`}
                      className="text-sm text-zinc-300 hover:text-white"
                    >
                      View discussion →
                    </Link>
                  )}

                  {report.status !== "reviewed" && (
                    <button
                      onClick={() => markReviewed(report.id)}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                    >
                      Mark reviewed
                    </button>
                  )}

                  {!isReplyReport && !isProfileReport && report.discussions && (
                    <button
                      onClick={() => softDeleteDiscussion(report.discussions?.id)}
                      className="rounded-full border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300"
                    >
                      Soft delete discussion
                    </button>
                  )}

                  {isReplyReport && report.replies && !report.replies.deleted_at && (
                    <button
                      onClick={() => softDeleteReply(report.id, report.reply_id)}
                      className="rounded-full border border-red-900 px-4 py-2 text-sm text-red-400 transition hover:border-red-700 hover:text-red-300"
                    >
                      Soft delete reply
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
