"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ReportStatus = "new" | "reviewing" | "dismissed" | "actioned";

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  dismissed: "Dismissed",
  actioned: "Actioned",
};

const REPORT_STATUS_CLASSES: Record<ReportStatus, string> = {
  new: "border-zinc-700 text-zinc-300",
  reviewing: "border-sky-800 text-sky-300",
  dismissed: "border-emerald-900 text-emerald-300",
  actioned: "border-amber-800 text-amber-300",
};

function normalizeReportStatus(status: string): ReportStatus {
  if (
    status === "new" ||
    status === "reviewing" ||
    status === "dismissed" ||
    status === "actioned"
  ) {
    return status;
  }

  if (status === "open") {
    return "new";
  }

  if (status === "reviewed") {
    return "dismissed";
  }

  return "new";
}

function getReportStatusLabel(status: string) {
  return REPORT_STATUS_LABELS[normalizeReportStatus(status)];
}

function getReportStatusClass(status: string) {
  return REPORT_STATUS_CLASSES[normalizeReportStatus(status)];
}

type AccountStatus = "active" | "warned" | "suspended" | "banned" | "deactivated" | "deletion_requested";

type AccountEnforcementAction =
  | "warn_user"
  | "suspend_user"
  | "ban_user"
  | "restore_user";

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  warned: "Warned",
  suspended: "Suspended",
  banned: "Banned",
  deactivated: "Deactivated",
  deletion_requested: "Deletion requested",
};

const ACCOUNT_STATUS_CLASSES: Record<AccountStatus, string> = {
  active: "border-emerald-900 text-emerald-300",
  warned: "border-sky-800 text-sky-300",
  suspended: "border-amber-800 text-amber-300",
  banned: "border-red-900 text-red-300",
  deactivated: "border-zinc-700 text-zinc-300",
  deletion_requested: "border-violet-800 text-violet-300",
};

function normalizeAccountStatus(status: string | null | undefined): AccountStatus {
  if (
    status === "active" ||
    status === "warned" ||
    status === "suspended" ||
    status === "banned" ||
    status === "deactivated" ||
    status === "deletion_requested"
  ) {
    return status;
  }

  return "active";
}

function getAccountStatusLabel(status: string | null | undefined) {
  return ACCOUNT_STATUS_LABELS[normalizeAccountStatus(status)];
}

function getAccountStatusClass(status: string | null | undefined) {
  return ACCOUNT_STATUS_CLASSES[normalizeAccountStatus(status)];
}


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
  account_status: string | null;
  enforcement_reason: string | null;
  enforcement_note: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
};

type MessageReportMetadata = {
  type?: string;
  message_id?: string;
  conversation_id?: string;
  notes?: string;
};

function getMessageReportMetadata(report: { resolution_note: string | null }) {
  if (!report.resolution_note) {
    return null;
  }

  try {
    const parsed = JSON.parse(report.resolution_note) as MessageReportMetadata;

    if (
      parsed?.type === "private_message" ||
      parsed?.type === "private_conversation"
    ) {
      return parsed;
    }
  } catch {
    return null;
  }

  return null;
}

type MessageEvidence = {
  report: {
    id: string;
    reason: string;
    reporterId: string;
    createdAt: string;
    notes: string;
    type: string;
    messageId: string | null;
    conversationId: string;
  };
  participants: {
    userId: string;
    username: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    accountStatus: string | null;
    joinedAt: string | null;
    archivedAt: string | null;
    deletedAt: string | null;
  }[];
  messages: {
    id: string;
    senderId: string;
    messageType: string;
    body: string;
    createdAt: string;
    editedAt: string | null;
    deletedBySender: boolean;
    readByRecipientAt: string | null;
    reportedCount: number | null;
    isReportedMessage: boolean;
  }[];
};

type Report = {
  id: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  resolution_note: string | null;
  status_updated_by: string | null;
  status_updated_at: string | null;
  actioned_by: string | null;
  actioned_at: string | null;
  created_at: string;
  discussion_id: string | null;
  reply_id: string | null;
  reported_profile_id: string | null;
  discussions: DiscussionRef;
  replies: ReplyRef;
};

type ReportFilter =
  | "all"
  | "new"
  | "reviewing"
  | "dismissed"
  | "actioned"
  | "discussions"
  | "replies"
  | "profiles"
  | "messages";

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filterMode, setFilterMode] = useState<ReportFilter>("all");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [enforcementReasons, setEnforcementReasons] = useState<Record<string, string>>({});
  const [enforcementNotes, setEnforcementNotes] = useState<Record<string, string>>({});
  const [suspensionDays, setSuspensionDays] = useState<Record<string, string>>({});
  const [enforcingProfileId, setEnforcingProfileId] = useState<string | null>(null);
  const [messageEvidence, setMessageEvidence] = useState<Record<string, MessageEvidence>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
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

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/reports", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Unable to load reports: ${result.error ?? "Unknown error."}`);
        setLoading(false);
        return;
      }

      type RawReport = Omit<Report, "discussions" | "replies"> & {
        discussions: DiscussionRef | DiscussionRef[];
        replies: ReplyRef | ReplyRef[];
      };

      const data = (result.reports ?? []) as RawReport[];

      const normalized = data.map((item) => ({
        ...item,
        discussions: Array.isArray(item.discussions)
          ? item.discussions[0] ?? null
          : item.discussions,
        replies: Array.isArray(item.replies)
          ? item.replies[0] ?? null
          : item.replies,
      })) as Report[];

      setReports(normalized);

      const profileMap: Record<string, Profile> = {};

      for (const item of (result.profiles ?? []) as Profile[]) {
        profileMap[item.id] = item;
      }

      setProfiles(profileMap);

      setLoading(false);
    }

    loadReports();
  }, []);

  async function softDeleteDiscussion(discussionId: string | undefined | null) {
    if (!discussionId) {
      return;
    }

    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const response = await fetch("/api/admin/moderation/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action: "soft_delete_discussion",
        discussionId,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to soft delete discussion.");
      return;
    }

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

  async function updateReportStatus(
    reportId: string,
    action: "set_report_reviewing" | "dismiss_report" | "mark_report_actioned"
  ) {
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    const resolutionNote = (reviewNotes[reportId] ?? "").trim();

    const response = await fetch("/api/admin/moderation/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        action,
        reportId,
        resolutionNote,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.error ?? "Unable to update report status.");
      return;
    }

    const nextStatus =
      typeof result.status === "string" ? normalizeReportStatus(result.status) : "new";
    const statusUpdatedBy =
      typeof result.statusUpdatedBy === "string" ? result.statusUpdatedBy : null;
    const statusUpdatedAt =
      typeof result.statusUpdatedAt === "string" ? result.statusUpdatedAt : new Date().toISOString();
    const reviewedBy =
      typeof result.reviewedBy === "string" ? result.reviewedBy : null;
    const reviewedAt =
      typeof result.reviewedAt === "string" ? result.reviewedAt : null;
    const actionedBy =
      typeof result.actionedBy === "string" ? result.actionedBy : null;
    const actionedAt =
      typeof result.actionedAt === "string" ? result.actionedAt : null;
    const savedResolutionNote =
      typeof result.resolutionNote === "string" ? result.resolutionNote : null;

    setReports((current) =>
      current.map((report) =>
        report.id === reportId
          ? {
              ...report,
              status: nextStatus,
              status_updated_by: statusUpdatedBy,
              status_updated_at: statusUpdatedAt,
              reviewed_by: reviewedBy,
              reviewed_at: reviewedAt,
              actioned_by: actionedBy,
              actioned_at: actionedAt,
              resolution_note: savedResolutionNote,
            }
          : report
      )
    );

    setReviewNotes((current) => {
      const next = { ...current };
      delete next[reportId];
      return next;
    });

    setMessage(
      nextStatus === "reviewing"
        ? "Report marked reviewing."
        : nextStatus === "dismissed"
          ? "Report dismissed."
          : "Report marked actioned."
    );
  }

  async function updateAccountEnforcement(
    profileId: string,
    action: AccountEnforcementAction
  ) {
    setMessage("");
    setEnforcingProfileId(profileId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const currentReason = enforcementReasons[profileId]?.trim();
      const enforcementReason =
        currentReason || "Moderation action from profile report review";
      const enforcementNote = enforcementNotes[profileId]?.trim() ?? "";

      const daysValue = Number(suspensionDays[profileId] || "7");
      const suspensionDurationDays =
        Number.isFinite(daysValue) && daysValue > 0 ? daysValue : 7;

      const suspendedUntil =
        action === "suspend_user"
          ? new Date(Date.now() + suspensionDurationDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          targetUserId: profileId,
          enforcementReason: action === "restore_user" ? "" : enforcementReason,
          enforcementNote,
          suspendedUntil,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update account enforcement.");
        return;
      }

      setProfiles((current) => ({
        ...current,
        [profileId]: {
          ...current[profileId],
          account_status:
            typeof result.accountStatus === "string" ? result.accountStatus : "active",
          enforcement_reason:
            typeof result.enforcementReason === "string" ? result.enforcementReason : null,
          enforcement_note:
            typeof result.enforcementNote === "string" ? result.enforcementNote : null,
          enforced_at:
            typeof result.enforcedAt === "string" ? result.enforcedAt : new Date().toISOString(),
          suspended_until:
            typeof result.suspendedUntil === "string" ? result.suspendedUntil : null,
        },
      }));

      setMessage(
        action === "warn_user"
          ? "Account warned."
          : action === "suspend_user"
            ? "Account suspended."
            : action === "ban_user"
              ? "Account banned."
              : "Account restored to active."
      );
    } finally {
      setEnforcingProfileId(null);
    }
  }

  async function loadMessageEvidence(reportId: string) {
    if (messageEvidence[reportId]) {
      setMessageEvidence((current) => {
        const next = { ...current };
        delete next[reportId];
        return next;
      });
      return;
    }

    setMessage("");
    setLoadingEvidenceId(reportId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch(
        `/api/admin/messages/evidence?reportId=${encodeURIComponent(reportId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load message evidence.");
        return;
      }

      setMessageEvidence((current) => ({
        ...current,
        [reportId]: result as MessageEvidence,
      }));
    } catch {
      setMessage("Unable to load message evidence.");
    } finally {
      setLoadingEvidenceId(null);
    }
  }

  function getEvidenceParticipantLabel(
    evidence: MessageEvidence,
    userId: string
  ) {
    const participant = evidence.participants.find((item) => item.userId === userId);

    return (
      participant?.fullName ||
      participant?.username ||
      `Member ${userId.slice(0, 8)}`
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
    if (
      filterMode === "new" ||
      filterMode === "reviewing" ||
      filterMode === "dismissed" ||
      filterMode === "actioned"
    ) {
      return normalizeReportStatus(report.status) === filterMode;
    }

    const messageMetadata = getMessageReportMetadata(report);

    if (filterMode === "discussions") {
      return !report.reply_id && !report.reported_profile_id && !messageMetadata;
    }

    if (filterMode === "replies") {
      return Boolean(report.reply_id);
    }

    if (filterMode === "profiles") {
      return Boolean(report.reported_profile_id);
    }

    if (filterMode === "messages") {
      return Boolean(messageMetadata);
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
      label: "New",
      value: "new",
      count: reports.filter((report) => normalizeReportStatus(report.status) === "new").length,
    },
    {
      label: "Reviewing",
      value: "reviewing",
      count: reports.filter((report) => normalizeReportStatus(report.status) === "reviewing").length,
    },
    {
      label: "Dismissed",
      value: "dismissed",
      count: reports.filter((report) => normalizeReportStatus(report.status) === "dismissed").length,
    },
    {
      label: "Actioned",
      value: "actioned",
      count: reports.filter((report) => normalizeReportStatus(report.status) === "actioned").length,
    },
    {
      label: "Discussions",
      value: "discussions",
      count: reports.filter((report) => !report.reply_id && !report.reported_profile_id && !getMessageReportMetadata(report)).length,
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
    {
      label: "Messages",
      value: "messages",
      count: reports.filter((report) => Boolean(getMessageReportMetadata(report))).length,
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
        <Link
          href="/admin"
          className="mb-10 inline-block text-sm text-zinc-500 hover:text-white"
        >
          ← Back to admin
        </Link>

        <h1 className="mb-6 text-5xl font-semibold tracking-tight">
          Reports
        </h1>

        <p className="mb-8 text-zinc-500">
          Review discussions, replies, and profiles submitted for moderation.
        </p>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Review workflow
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Triage reports before taking action.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Use this queue to separate new, reviewing, dismissed, and actioned
            reports across discussions, replies, and profiles. Open the reported
            item, add a resolution note when helpful, then dismiss the report or
            mark it actioned when a moderation decision is clear.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                1. Inspect context
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Open the discussion, reply, or profile before acting so the report is reviewed in context.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                2. Record outcome
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Add a short resolution note when the decision may matter later for appeals or pattern review.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                3. Act carefully
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Dismiss reports when no action is needed, or mark actioned when content is removed from public view.
              </p>
            </div>
          </div>
        </section>

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

            <p className="mb-5 max-w-2xl text-zinc-400">
              No reports match the current filter. Switch back to all reports to
              review the full moderation queue.
            </p>

            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Show all reports
            </button>
          </div>
        )}

        <div className="space-y-6">
          {filteredReports.map((report) => {
            const messageMetadata = getMessageReportMetadata(report);
            const isMessageReport = Boolean(messageMetadata);
            const isPrivateMessageReport = messageMetadata?.type === "private_message";
            const isPrivateConversationReport = messageMetadata?.type === "private_conversation";
            const isReplyReport = Boolean(report.reply_id);
            const isProfileReport = Boolean(report.reported_profile_id);
            const reportedProfile = report.reported_profile_id
              ? profiles[report.reported_profile_id]
              : null;
            const reviewerProfile = report.reviewed_by
              ? profiles[report.reviewed_by]
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
                      {isMessageReport
                        ? isPrivateMessageReport
                          ? "Message report"
                          : "Conversation report"
                        : isProfileReport
                          ? "Profile report"
                          : isReplyReport
                            ? "Reply report"
                            : "Discussion report"}
                    </p>

                    <h2 className="text-2xl font-medium">
                      {isMessageReport
                        ? isPrivateMessageReport
                          ? "Private message report"
                          : "Private conversation report"
                        : isProfileReport
                          ? reportedProfile?.full_name || reportedProfile?.username || "Profile unavailable"
                          : report.discussions?.title ?? "Discussion unavailable"}
                    </h2>
                  </div>

                  <p className={`rounded-full border px-3 py-1 text-xs ${getReportStatusClass(report.status)}`}>
                    {getReportStatusLabel(report.status)}
                  </p>
                </div>

                <p className="mb-3 text-zinc-400">
                  Reason: {report.reason}
                </p>

                {(report.status_updated_at ||
                  report.reviewed_at ||
                  report.actioned_at ||
                  report.reviewed_by ||
                  report.actioned_by ||
                  report.resolution_note) && (
                  <div className="mb-4 rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
                    <p className="mb-2 text-zinc-400">
                      Review details
                    </p>

                    {report.status_updated_at && (
                      <p>
                        Status updated: {new Date(report.status_updated_at).toLocaleString()}
                      </p>
                    )}

                    {report.reviewed_at && (
                      <p>
                        Reviewed: {new Date(report.reviewed_at).toLocaleString()}
                      </p>
                    )}

                    {report.reviewed_by && (
                      <p>
                        Reviewed by: {reviewerProfile?.full_name || reviewerProfile?.username || "Admin"}
                      </p>
                    )}

                    {report.actioned_at && (
                      <p>
                        Actioned: {new Date(report.actioned_at).toLocaleString()}
                      </p>
                    )}

                    {report.resolution_note && !isMessageReport && (
                      <p className="mt-2 whitespace-pre-wrap leading-relaxed">
                        Note: {report.resolution_note}
                      </p>
                    )}
                  </div>
                )}

                {isMessageReport && messageMetadata && (
                  <div className="mb-4 rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-sm text-zinc-500">
                      Message moderation metadata
                    </p>

                    <div className="grid gap-3 text-sm md:grid-cols-2">
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                        <p className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-700">
                          Type
                        </p>
                        <p className="text-zinc-300">
                          {isPrivateConversationReport ? "Private conversation" : "Private message"}
                        </p>
                      </div>

                      {messageMetadata.conversation_id && (
                        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-700">
                            Conversation ID
                          </p>
                          <p className="break-all text-zinc-300">
                            {messageMetadata.conversation_id}
                          </p>
                        </div>
                      )}

                      {messageMetadata.message_id && (
                        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3">
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-700">
                            Message ID
                          </p>
                          <p className="break-all text-zinc-300">
                            {messageMetadata.message_id}
                          </p>
                        </div>
                      )}

                      {messageMetadata.notes && (
                        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-3 md:col-span-2">
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-700">
                            Reporter notes
                          </p>
                          <p className="whitespace-pre-wrap text-zinc-300">
                            {messageMetadata.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isMessageReport && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => loadMessageEvidence(report.id)}
                      disabled={loadingEvidenceId === report.id}
                      className="rounded-full border border-sky-900 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-700 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                    >
                      {loadingEvidenceId === report.id
                        ? "Loading evidence..."
                        : messageEvidence[report.id]
                          ? "Hide evidence"
                          : "View evidence"}
                    </button>

                    {messageEvidence[report.id] && (
                      <div className="mt-4 rounded-2xl border border-zinc-900 bg-black p-4">
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="mb-2 text-sm text-zinc-500">
                              Message evidence
                            </p>

                            <p className="text-sm text-zinc-400">
                              Conversation {messageEvidence[report.id].report.conversationId}
                            </p>
                          </div>

                          <p className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                            {messageEvidence[report.id].messages.length} messages shown
                          </p>
                        </div>

                        <div className="mb-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                          <p className="mb-3 text-xs uppercase tracking-[0.18em] text-zinc-700">
                            Participants
                          </p>

                          <div className="grid gap-2 md:grid-cols-2">
                            {messageEvidence[report.id].participants.map((participant) => (
                              <div
                                key={participant.userId}
                                className="rounded-xl border border-zinc-900 bg-black p-3 text-sm"
                              >
                                <p className="font-medium text-zinc-300">
                                  {participant.fullName || participant.username || "Loombus member"}
                                </p>

                                <p className="mt-1 text-xs text-zinc-600">
                                  {participant.username ? `@${participant.username}` : participant.userId}
                                </p>

                                {participant.accountStatus && (
                                  <p className="mt-2 text-xs text-zinc-500">
                                    Status: {participant.accountStatus}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-3">
                          {messageEvidence[report.id].messages.map((evidenceMessage) => (
                            <div
                              key={evidenceMessage.id}
                              className={`rounded-2xl border p-4 ${
                                evidenceMessage.isReportedMessage
                                  ? "border-amber-800 bg-amber-950/20"
                                  : "border-zinc-900 bg-zinc-950"
                              }`}
                            >
                              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium text-zinc-300">
                                  {getEvidenceParticipantLabel(
                                    messageEvidence[report.id],
                                    evidenceMessage.senderId
                                  )}
                                  {evidenceMessage.isReportedMessage ? " · Reported message" : ""}
                                </p>

                                <p className="text-xs text-zinc-600">
                                  {new Date(evidenceMessage.createdAt).toLocaleString()}
                                </p>
                              </div>

                              {evidenceMessage.deletedBySender ? (
                                <p className="text-sm italic text-zinc-600">
                                  Message deleted by sender.
                                </p>
                              ) : (
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-400">
                                  {evidenceMessage.body || "(empty message)"}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

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

                    {reportedProfile && (
                      <div className="mt-4 rounded-2xl border border-zinc-900 bg-zinc-950 p-4">
                        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="mb-2 text-sm text-zinc-500">
                              Account enforcement
                            </p>

                            <p className={`inline-flex rounded-full border px-3 py-1 text-xs ${getAccountStatusClass(reportedProfile.account_status)}`}>
                              {getAccountStatusLabel(reportedProfile.account_status)}
                            </p>
                          </div>

                          {reportedProfile.enforced_at && (
                            <p className="text-xs text-zinc-600">
                              Updated {new Date(reportedProfile.enforced_at).toLocaleString()}
                            </p>
                          )}
                        </div>

                        {reportedProfile.enforcement_reason && (
                          <p className="mb-3 text-sm text-zinc-500">
                            Reason: {reportedProfile.enforcement_reason}
                          </p>
                        )}

                        {reportedProfile.suspended_until && (
                          <p className="mb-3 text-sm text-zinc-500">
                            Suspended until: {new Date(reportedProfile.suspended_until).toLocaleString()}
                          </p>
                        )}

                        <div className="grid gap-3 md:grid-cols-2">
                          <label className="block text-xs text-zinc-500">
                            <span className="mb-2 block">Enforcement reason</span>
                            <input
                              type="text"
                              value={enforcementReasons[reportedProfile.id] ?? report.reason}
                              onChange={(event) =>
                                setEnforcementReasons((current) => ({
                                  ...current,
                                  [reportedProfile.id]: event.target.value,
                                }))
                              }
                              maxLength={240}
                              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
                            />
                          </label>

                          <label className="block text-xs text-zinc-500">
                            <span className="mb-2 block">Suspension days</span>
                            <input
                              type="number"
                              min={1}
                              value={suspensionDays[reportedProfile.id] ?? "7"}
                              onChange={(event) =>
                                setSuspensionDays((current) => ({
                                  ...current,
                                  [reportedProfile.id]: event.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
                            />
                          </label>
                        </div>

                        <label className="mt-3 block text-xs text-zinc-500">
                          <span className="mb-2 block">Enforcement note optional</span>
                          <textarea
                            value={enforcementNotes[reportedProfile.id] ?? ""}
                            onChange={(event) =>
                              setEnforcementNotes((current) => ({
                                ...current,
                                [reportedProfile.id]: event.target.value,
                              }))
                            }
                            rows={2}
                            maxLength={2000}
                            className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
                          />
                        </label>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => updateAccountEnforcement(reportedProfile.id, "warn_user")}
                            disabled={enforcingProfileId === reportedProfile.id}
                            className="rounded-full border border-sky-900 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-700 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Warn user
                          </button>

                          <button
                            type="button"
                            onClick={() => updateAccountEnforcement(reportedProfile.id, "suspend_user")}
                            disabled={enforcingProfileId === reportedProfile.id}
                            className="rounded-full border border-amber-800 px-4 py-2 text-sm text-amber-300 transition hover:border-amber-600 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Suspend user
                          </button>

                          <button
                            type="button"
                            onClick={() => updateAccountEnforcement(reportedProfile.id, "ban_user")}
                            disabled={enforcingProfileId === reportedProfile.id}
                            className="rounded-full border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Ban user
                          </button>

                          {normalizeAccountStatus(reportedProfile.account_status) !== "active" && (
                            <button
                              type="button"
                              onClick={() => updateAccountEnforcement(reportedProfile.id, "restore_user")}
                              disabled={enforcingProfileId === reportedProfile.id}
                              className="rounded-full border border-emerald-900 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-700 hover:text-emerald-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                            >
                              Restore active
                            </button>
                          )}
                        </div>
                      </div>
                    )}
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

                {normalizeReportStatus(report.status) !== "dismissed" &&
                  normalizeReportStatus(report.status) !== "actioned" && (
                  <label className="mb-4 block">
                    <span className="mb-2 block text-sm text-zinc-500">
                      Resolution note optional
                    </span>

                    <textarea
                      value={reviewNotes[report.id] ?? report.resolution_note ?? ""}
                      onChange={(event) =>
                        setReviewNotes((current) => ({
                          ...current,
                          [report.id]: event.target.value,
                        }))
                      }
                      placeholder="Add how this report was handled before marking it reviewed."
                      rows={3}
                      className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition placeholder:text-zinc-700 focus:border-zinc-600"
                    />
                  </label>
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
                  {normalizeReportStatus(report.status) === "new" && (
                    <button
                      onClick={() => updateReportStatus(report.id, "set_report_reviewing")}
                      className="rounded-full border border-sky-900 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-700 hover:text-sky-200"
                    >
                      Start review
                    </button>
                  )}

                  {(normalizeReportStatus(report.status) === "new" ||
                    normalizeReportStatus(report.status) === "reviewing") && (
                    <button
                      onClick={() => updateReportStatus(report.id, "dismiss_report")}
                      className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                    >
                      Dismiss report
                    </button>
                  )}

                  {(normalizeReportStatus(report.status) === "new" ||
                    normalizeReportStatus(report.status) === "reviewing") && (
                    <button
                      onClick={() => updateReportStatus(report.id, "mark_report_actioned")}
                      className="rounded-full border border-amber-800 px-4 py-2 text-sm text-amber-300 transition hover:border-amber-600 hover:text-amber-200"
                    >
                      Mark actioned
                    </button>
                  )}


                  {!isReplyReport && !isProfileReport && !isMessageReport && report.discussions && (
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
