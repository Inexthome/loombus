"use client";

import Link from "next/link";
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type ReportStatus = "new" | "reviewing" | "dismissed" | "actioned";
type AccountStatus =
  | "active"
  | "warned"
  | "suspended"
  | "banned"
  | "deactivated"
  | "deletion_requested";
type AccountEnforcementAction =
  | "warn_user"
  | "suspend_user"
  | "ban_user"
  | "restore_user";
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
type ReportKind = "discussion" | "reply" | "profile" | "message";

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
  moderation_note?: string;
};

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

const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  dismissed: "Dismissed",
  actioned: "Actioned",
};

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  warned: "Warned",
  suspended: "Suspended",
  banned: "Banned",
  deactivated: "Deactivated",
  deletion_requested: "Deletion requested",
};

const FILTER_LABELS: Record<ReportFilter, string> = {
  all: "All",
  new: "New",
  reviewing: "Reviewing",
  dismissed: "Dismissed",
  actioned: "Actioned",
  discussions: "Discussions",
  replies: "Replies",
  profiles: "Profiles",
  messages: "Messages",
};

const KIND_DETAILS: Record<
  ReportKind,
  { label: string; singular: string; Icon: LucideIcon }
> = {
  discussion: { label: "Discussions", singular: "Discussion report", Icon: FileText },
  reply: { label: "Replies", singular: "Reply report", Icon: MessageCircle },
  profile: { label: "Profiles", singular: "Profile report", Icon: UserRound },
  message: { label: "Messages", singular: "Private message report", Icon: ShieldAlert },
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

  if (status === "reviewed") return "dismissed";
  return "new";
}

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

function getMessageReportMetadata(report: Pick<Report, "resolution_note">) {
  if (!report.resolution_note) return null;

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

function getReportKind(report: Report): ReportKind {
  if (getMessageReportMetadata(report)) return "message";
  if (report.reported_profile_id) return "profile";
  if (report.reply_id) return "reply";
  return "discussion";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getProfileName(profile: Profile | null | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Loombus member";
}

function getStatusDescription(status: ReportStatus) {
  if (status === "new") return "Awaiting an Admin review.";
  if (status === "reviewing") return "An Admin has started the review.";
  if (status === "dismissed") return "Closed without a moderation action.";
  return "Closed after a moderation action.";
}

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeReportStatus(status);
  return (
    <span className={`reports-v2-status is-${normalized}`}>
      {REPORT_STATUS_LABELS[normalized]}
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
  priority = false,
}: {
  label: string;
  value: number;
  description: string;
  priority?: boolean;
}) {
  return (
    <article className={`reports-v2-metric${priority ? " is-priority" : ""}`}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <p>{description}</p>
    </article>
  );
}

export default function ReportsV2Client() {
  const [reports, setReports] = useState<Report[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [filterMode, setFilterMode] = useState<ReportFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [enforcementReasons, setEnforcementReasons] = useState<Record<string, string>>({});
  const [enforcementNotes, setEnforcementNotes] = useState<Record<string, string>>({});
  const [suspensionDays, setSuspensionDays] = useState<Record<string, string>>({});
  const [enforcingProfileId, setEnforcingProfileId] = useState<string | null>(null);
  const [messageEvidence, setMessageEvidence] = useState<Record<string, MessageEvidence>>({});
  const [loadingEvidenceId, setLoadingEvidenceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [actionWorking, setActionWorking] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const loadReports = useCallback(async (options: { refresh?: boolean } = {}) => {
    if (options.refresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login?next=%2Fadmin%2Freports";
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (profileError || !profile?.is_admin) {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from("reports")
        .select(`
          id,
          reason,
          status,
          reviewed_by,
          reviewed_at,
          resolution_note,
          status_updated_by,
          status_updated_at,
          actioned_by,
          actioned_at,
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

      if (error) throw error;

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
      setSelectedReportId((current) =>
        current && normalized.some((report) => report.id === current)
          ? current
          : normalized[0]?.id ?? null
      );

      const profileIds = [
        ...normalized.map((report) => report.replies?.user_id),
        ...normalized.map((report) => report.reported_profile_id),
        ...normalized.map((report) => report.reviewed_by),
        ...normalized.map((report) => report.status_updated_by),
        ...normalized.map((report) => report.actioned_by),
      ].filter((id): id is string => Boolean(id));

      const uniqueProfileIds = [...new Set(profileIds)];

      if (uniqueProfileIds.length > 0) {
        const { data: profileData, error: profilesError } = await supabase
          .from("profiles")
          .select(
            "id, username, full_name, account_status, enforcement_reason, enforcement_note, enforced_at, suspended_until"
          )
          .in("id", uniqueProfileIds);

        if (profilesError) throw profilesError;

        setProfiles(
          Object.fromEntries(
            ((profileData ?? []) as Profile[]).map((item) => [item.id, item])
          )
        );
      } else {
        setProfiles({});
      }

      setLoadedAt(new Date());
    } catch (error) {
      console.error("Unable to load reports.", error);
      setMessage("The moderation queue could not load. Refresh and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const counts = useMemo(() => {
    const result = {
      all: reports.length,
      new: 0,
      reviewing: 0,
      dismissed: 0,
      actioned: 0,
      discussions: 0,
      replies: 0,
      profiles: 0,
      messages: 0,
    } satisfies Record<ReportFilter, number>;

    for (const report of reports) {
      result[normalizeReportStatus(report.status)] += 1;
      const kind = getReportKind(report);
      if (kind === "discussion") result.discussions += 1;
      if (kind === "reply") result.replies += 1;
      if (kind === "profile") result.profiles += 1;
      if (kind === "message") result.messages += 1;
    }

    return result;
  }, [reports]);

  const filteredReports = useMemo(() => {
    const cleanQuery = searchQuery.trim().toLowerCase();

    return reports.filter((report) => {
      const status = normalizeReportStatus(report.status);
      const kind = getReportKind(report);
      const matchesFilter =
        filterMode === "all" ||
        filterMode === status ||
        (filterMode === "discussions" && kind === "discussion") ||
        (filterMode === "replies" && kind === "reply") ||
        (filterMode === "profiles" && kind === "profile") ||
        (filterMode === "messages" && kind === "message");

      if (!matchesFilter) return false;
      if (!cleanQuery) return true;

      const metadata = getMessageReportMetadata(report);
      const reportedProfile = report.reported_profile_id
        ? profiles[report.reported_profile_id]
        : null;
      const replyAuthor = report.replies?.user_id
        ? profiles[report.replies.user_id]
        : null;

      return [
        report.reason,
        report.discussions?.title,
        report.discussions?.topic,
        report.replies?.body,
        getProfileName(reportedProfile),
        reportedProfile?.username,
        getProfileName(replyAuthor),
        replyAuthor?.username,
        metadata?.notes,
        metadata?.moderation_note,
        metadata?.conversation_id,
        metadata?.message_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(cleanQuery);
    });
  }, [filterMode, profiles, reports, searchQuery]);

  useEffect(() => {
    if (filteredReports.length === 0) {
      setSelectedReportId(null);
      return;
    }

    if (!selectedReportId || !filteredReports.some((report) => report.id === selectedReportId)) {
      setSelectedReportId(filteredReports[0].id);
    }
  }, [filteredReports, selectedReportId]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token ?? "";

    if (!accessToken) {
      window.location.href = "/login?next=%2Fadmin%2Freports";
      return null;
    }

    return accessToken;
  }

  async function softDeleteDiscussion(report: Report) {
    const discussionId = report.discussions?.id;
    if (!discussionId) return;

    const confirmed = window.confirm(
      `Soft delete “${report.discussions?.title ?? "this discussion"}”? The discussion will leave public view and remain recoverable in Admin.`
    );
    if (!confirmed) return;

    setMessage("");
    setActionWorking(`delete-discussion:${report.id}`);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

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

      setReports((current) => current.filter((item) => item.id !== report.id));
      setMessage("Discussion soft deleted. The report was removed from this queue view.");
    } finally {
      setActionWorking(null);
    }
  }

  async function softDeleteReply(report: Report) {
    const replyId = report.reply_id;
    if (!replyId) return;

    const confirmed = window.confirm(
      "Soft delete this reply? It will leave public view and remain recoverable in Admin."
    );
    if (!confirmed) return;

    setMessage("");
    setActionWorking(`delete-reply:${report.id}`);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch("/api/replies/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ replyId }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to soft delete reply.");
        return;
      }

      setReports((current) => current.filter((item) => item.id !== report.id));
      setMessage("Reply soft deleted. The report was removed from this queue view.");
    } finally {
      setActionWorking(null);
    }
  }

  async function updateReportStatus(
    report: Report,
    action: "set_report_reviewing" | "dismiss_report" | "mark_report_actioned"
  ) {
    setMessage("");
    setActionWorking(`${action}:${report.id}`);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const cleanNote = (reviewNotes[report.id] ?? "").trim();
      const messageMetadata = getMessageReportMetadata(report);
      const resolutionNote = messageMetadata
        ? JSON.stringify({ ...messageMetadata, moderation_note: cleanNote })
        : cleanNote;

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          reportId: report.id,
          resolutionNote,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update report status.");
        return;
      }

      const nextStatus = normalizeReportStatus(String(result.status ?? "new"));
      const savedResolutionNote = messageMetadata
        ? resolutionNote
        : typeof result.resolutionNote === "string"
          ? result.resolutionNote
          : null;

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                status: nextStatus,
                status_updated_by:
                  typeof result.statusUpdatedBy === "string"
                    ? result.statusUpdatedBy
                    : null,
                status_updated_at:
                  typeof result.statusUpdatedAt === "string"
                    ? result.statusUpdatedAt
                    : new Date().toISOString(),
                reviewed_by:
                  typeof result.reviewedBy === "string" ? result.reviewedBy : null,
                reviewed_at:
                  typeof result.reviewedAt === "string" ? result.reviewedAt : null,
                actioned_by:
                  typeof result.actionedBy === "string" ? result.actionedBy : null,
                actioned_at:
                  typeof result.actionedAt === "string" ? result.actionedAt : null,
                resolution_note: savedResolutionNote,
              }
            : item
        )
      );

      setReviewNotes((current) => {
        const next = { ...current };
        delete next[report.id];
        return next;
      });

      setMessage(
        nextStatus === "reviewing"
          ? "Report marked reviewing."
          : nextStatus === "dismissed"
            ? "Report dismissed."
            : "Report marked actioned."
      );
    } finally {
      setActionWorking(null);
    }
  }

  async function updateAccountEnforcement(
    profileId: string,
    action: AccountEnforcementAction
  ) {
    const profile = profiles[profileId];
    const profileName = getProfileName(profile);

    if (action === "suspend_user") {
      const confirmed = window.confirm(
        `Suspend ${profileName}? The account will remain restricted until the selected end date.`
      );
      if (!confirmed) return;
    }

    if (action === "ban_user") {
      const confirmed = window.confirm(
        `Ban ${profileName}? This is a severe account-level enforcement action.`
      );
      if (!confirmed) return;
    }

    setMessage("");
    setEnforcingProfileId(profileId);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const enforcementReason =
        enforcementReasons[profileId]?.trim() ||
        "Moderation action from profile report review";
      const enforcementNote = enforcementNotes[profileId]?.trim() ?? "";
      const daysValue = Number(suspensionDays[profileId] || "7");
      const suspensionDurationDays =
        Number.isFinite(daysValue) && daysValue > 0 ? daysValue : 7;
      const suspendedUntil =
        action === "suspend_user"
          ? new Date(
              Date.now() + suspensionDurationDays * 24 * 60 * 60 * 1000
            ).toISOString()
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
            typeof result.enforcementReason === "string"
              ? result.enforcementReason
              : null,
          enforcement_note:
            typeof result.enforcementNote === "string" ? result.enforcementNote : null,
          enforced_at:
            typeof result.enforcedAt === "string"
              ? result.enforcedAt
              : new Date().toISOString(),
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
      const accessToken = await getAccessToken();
      if (!accessToken) return;

      const response = await fetch(
        `/api/admin/messages/evidence?reportId=${encodeURIComponent(reportId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const result = await response.json().catch(() => ({}));

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

  function getEvidenceParticipantLabel(evidence: MessageEvidence, userId: string) {
    const participant = evidence.participants.find((item) => item.userId === userId);
    return (
      participant?.fullName ||
      participant?.username ||
      `Member ${userId.slice(0, 8)}`
    );
  }

  if (loading) {
    return (
      <main className="reports-v2-page reports-v2-state-page">
        <div className="reports-v2-state-card" aria-live="polite">
          <Loader2 aria-hidden="true" className="reports-v2-spin" />
          <p className="reports-v2-eyebrow">Admin moderation</p>
          <h1>Loading the report queue</h1>
          <p>Verifying Admin access and retrieving current moderation records.</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="reports-v2-page reports-v2-state-page">
        <div className="reports-v2-state-card">
          <ShieldAlert aria-hidden="true" />
          <p className="reports-v2-eyebrow">Restricted workspace</p>
          <h1>Admin access required</h1>
          <p>This moderation queue is available only to authorized Loombus Admins.</p>
          <Link href="/home">Return to Loombus</Link>
        </div>
      </main>
    );
  }

  const selectedKind = selectedReport ? getReportKind(selectedReport) : null;
  const selectedMetadata = selectedReport
    ? getMessageReportMetadata(selectedReport)
    : null;
  const selectedProfile = selectedReport?.reported_profile_id
    ? profiles[selectedReport.reported_profile_id]
    : null;
  const selectedReplyAuthor = selectedReport?.replies?.user_id
    ? profiles[selectedReport.replies.user_id]
    : null;
  const selectedReviewer = selectedReport?.reviewed_by
    ? profiles[selectedReport.reviewed_by]
    : null;
  const selectedStatusUpdater = selectedReport?.status_updated_by
    ? profiles[selectedReport.status_updated_by]
    : null;
  const selectedActionAdmin = selectedReport?.actioned_by
    ? profiles[selectedReport.actioned_by]
    : null;
  const selectedStatus = selectedReport
    ? normalizeReportStatus(selectedReport.status)
    : null;
  const selectedEvidence = selectedReport
    ? messageEvidence[selectedReport.id]
    : null;
  const selectedTargetTitle = selectedReport
    ? selectedKind === "profile"
      ? getProfileName(selectedProfile)
      : selectedKind === "message"
        ? selectedMetadata?.type === "private_conversation"
          ? "Private conversation"
          : "Private message"
        : selectedKind === "reply"
          ? `Reply by ${getProfileName(selectedReplyAuthor)}`
          : selectedReport.discussions?.title ?? "Discussion unavailable"
    : "";

  const filterOptions: ReportFilter[] = [
    "all",
    "new",
    "reviewing",
    "dismissed",
    "actioned",
    "discussions",
    "replies",
    "profiles",
    "messages",
  ];

  return (
    <main className="reports-v2-page">
      <div className="reports-v2-shell">
        <header className="reports-v2-hero">
          <div className="reports-v2-hero-copy">
            <Link href="/admin" className="reports-v2-back-link">
              <ArrowLeft aria-hidden="true" size={17} />
              Admin operations
            </Link>
            <p className="reports-v2-eyebrow">Moderation command center</p>
            <h1>Reports</h1>
            <p>
              Triage member-submitted reports, inspect the available context, record a
              decision, and use existing moderation controls without leaving the queue.
            </p>
          </div>

          <div className="reports-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadReports({ refresh: true })}
              disabled={refreshing}
            >
              <RefreshCw
                aria-hidden="true"
                size={17}
                className={refreshing ? "reports-v2-spin" : undefined}
              />
              {refreshing ? "Refreshing" : "Refresh queue"}
            </button>
            <span>
              {loadedAt ? `Updated ${formatDateTime(loadedAt.toISOString())}` : "Not refreshed yet"}
            </span>
          </div>
        </header>

        <section className="reports-v2-metrics" aria-label="Report queue summary">
          <MetricCard
            label="New"
            value={counts.new}
            description="Waiting for first review"
            priority={counts.new > 0}
          />
          <MetricCard
            label="Reviewing"
            value={counts.reviewing}
            description="Currently in progress"
          />
          <MetricCard
            label="Actioned"
            value={counts.actioned}
            description="Closed after action"
          />
          <MetricCard
            label="Total"
            value={counts.all}
            description="All visible report records"
          />
        </section>

        <section className="reports-v2-toolbar" aria-label="Report queue controls">
          <label className="reports-v2-search">
            <Search aria-hidden="true" size={19} />
            <span className="reports-v2-sr-only">Search reports</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search reason, target, contributor, or message metadata"
            />
          </label>

          <nav className="reports-v2-filters" aria-label="Filter reports">
            {filterOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={filterMode === option}
                onClick={() => setFilterMode(option)}
              >
                <span>{FILTER_LABELS[option]}</span>
                <strong>{counts[option]}</strong>
              </button>
            ))}
          </nav>
        </section>

        {message ? (
          <div className="reports-v2-notice" role="status">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              <XCircle aria-hidden="true" size={18} />
            </button>
          </div>
        ) : null}

        <div className="reports-v2-workspace">
          <aside className="reports-v2-queue" aria-label="Moderation report queue">
            <div className="reports-v2-queue-heading">
              <div>
                <p className="reports-v2-eyebrow">Queue</p>
                <h2>{FILTER_LABELS[filterMode]}</h2>
              </div>
              <span>{filteredReports.length}</span>
            </div>

            {filteredReports.length === 0 ? (
              <div className="reports-v2-queue-empty">
                <CheckCircle2 aria-hidden="true" size={24} />
                <h3>No matching reports</h3>
                <p>Change the filter or clear the search to review another part of the queue.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterMode("all");
                    setSearchQuery("");
                  }}
                >
                  Show all reports
                </button>
              </div>
            ) : (
              <div className="reports-v2-queue-list">
                {filteredReports.map((report) => {
                  const kind = getReportKind(report);
                  const KindIcon = KIND_DETAILS[kind].Icon;
                  const metadata = getMessageReportMetadata(report);
                  const reportedProfile = report.reported_profile_id
                    ? profiles[report.reported_profile_id]
                    : null;
                  const replyAuthor = report.replies?.user_id
                    ? profiles[report.replies.user_id]
                    : null;
                  const targetTitle =
                    kind === "profile"
                      ? getProfileName(reportedProfile)
                      : kind === "message"
                        ? metadata?.type === "private_conversation"
                          ? "Private conversation"
                          : "Private message"
                        : kind === "reply"
                          ? `Reply by ${getProfileName(replyAuthor)}`
                          : report.discussions?.title ?? "Discussion unavailable";

                  return (
                    <button
                      key={report.id}
                      type="button"
                      className={`reports-v2-queue-item${
                        selectedReportId === report.id ? " is-selected" : ""
                      }`}
                      onClick={() => setSelectedReportId(report.id)}
                    >
                      <span className="reports-v2-kind-icon">
                        <KindIcon aria-hidden="true" size={18} />
                      </span>
                      <span className="reports-v2-queue-copy">
                        <span className="reports-v2-queue-topline">
                          <em>{KIND_DETAILS[kind].singular}</em>
                          <StatusBadge status={report.status} />
                        </span>
                        <strong>{targetTitle}</strong>
                        <span className="reports-v2-queue-reason">{report.reason}</span>
                        <time dateTime={report.created_at}>{formatDateTime(report.created_at)}</time>
                      </span>
                      <ChevronRight aria-hidden="true" size={18} />
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <section className="reports-v2-detail" aria-label="Selected report review">
            {!selectedReport || !selectedKind || !selectedStatus ? (
              <div className="reports-v2-detail-empty">
                <Flag aria-hidden="true" size={30} />
                <p className="reports-v2-eyebrow">Report review</p>
                <h2>Select a report</h2>
                <p>Choose a queue item to inspect context, evidence, history, and available actions.</p>
              </div>
            ) : (
              <>
                <header className="reports-v2-detail-header">
                  <div>
                    <p className="reports-v2-eyebrow">{KIND_DETAILS[selectedKind].singular}</p>
                    <h2>{selectedTargetTitle}</h2>
                    <p>
                      Submitted {formatDateTime(selectedReport.created_at)} · {getStatusDescription(selectedStatus)}
                    </p>
                  </div>
                  <StatusBadge status={selectedReport.status} />
                </header>

                <div className="reports-v2-detail-body">
                  <section className="reports-v2-panel is-reason">
                    <div className="reports-v2-panel-heading">
                      <span className="reports-v2-panel-icon">
                        <AlertOctagon aria-hidden="true" size={19} />
                      </span>
                      <div>
                        <p className="reports-v2-eyebrow">Report reason</p>
                        <h3>Why this was submitted</h3>
                      </div>
                    </div>
                    <p className="reports-v2-reason-text">{selectedReport.reason}</p>
                    {selectedMetadata?.notes ? (
                      <div className="reports-v2-reporter-note">
                        <strong>Reporter note</strong>
                        <p>{selectedMetadata.notes}</p>
                      </div>
                    ) : null}
                  </section>

                  <section className="reports-v2-panel">
                    <div className="reports-v2-panel-heading">
                      <span className="reports-v2-panel-icon">
                        {selectedKind === "profile" ? (
                          <UserRound aria-hidden="true" size={19} />
                        ) : selectedKind === "message" ? (
                          <ShieldAlert aria-hidden="true" size={19} />
                        ) : selectedKind === "reply" ? (
                          <MessageCircle aria-hidden="true" size={19} />
                        ) : (
                          <FileText aria-hidden="true" size={19} />
                        )}
                      </span>
                      <div>
                        <p className="reports-v2-eyebrow">Target context</p>
                        <h3>{selectedTargetTitle}</h3>
                      </div>
                    </div>

                    {selectedKind === "discussion" ? (
                      <div className="reports-v2-target-card">
                        <div>
                          <span>{selectedReport.discussions?.topic || "Discussion"}</span>
                          <p>
                            Review the full thread before removing it. The report record does not contain the complete discussion body.
                          </p>
                        </div>
                        {selectedReport.discussions ? (
                          <Link href={`/discussions/${selectedReport.discussions.id}`}>
                            Open discussion <ExternalLink aria-hidden="true" size={15} />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedKind === "reply" ? (
                      <div className="reports-v2-target-card is-stacked">
                        <div>
                          <span>Reply by {getProfileName(selectedReplyAuthor)}</span>
                          <p className="reports-v2-quoted-copy">
                            {selectedReport.replies?.body ?? "Reply unavailable."}
                          </p>
                          {selectedReport.replies?.deleted_at ? (
                            <em>This reply is already deleted.</em>
                          ) : null}
                        </div>
                        {selectedReport.discussions ? (
                          <Link href={`/discussions/${selectedReport.discussions.id}`}>
                            Open discussion <ExternalLink aria-hidden="true" size={15} />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedKind === "profile" ? (
                      <div className="reports-v2-target-card">
                        <div>
                          <span>
                            {selectedProfile?.username
                              ? `@${selectedProfile.username}`
                              : "Username unavailable"}
                          </span>
                          <p>
                            Current account status: {ACCOUNT_STATUS_LABELS[normalizeAccountStatus(selectedProfile?.account_status)]}
                          </p>
                        </div>
                        {selectedProfile?.username ? (
                          <Link href={`/u/${selectedProfile.username}`}>
                            Open profile <ExternalLink aria-hidden="true" size={15} />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}

                    {selectedKind === "message" && selectedMetadata ? (
                      <div className="reports-v2-message-metadata">
                        <div>
                          <span>Type</span>
                          <strong>
                            {selectedMetadata.type === "private_conversation"
                              ? "Private conversation"
                              : "Private message"}
                          </strong>
                        </div>
                        <div>
                          <span>Conversation</span>
                          <strong>{selectedMetadata.conversation_id ?? "Unavailable"}</strong>
                        </div>
                        {selectedMetadata.message_id ? (
                          <div>
                            <span>Reported message</span>
                            <strong>{selectedMetadata.message_id}</strong>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  {selectedKind === "message" ? (
                    <section className="reports-v2-panel">
                      <div className="reports-v2-panel-heading is-split">
                        <div className="reports-v2-panel-heading-copy">
                          <span className="reports-v2-panel-icon">
                            <ShieldCheck aria-hidden="true" size={19} />
                          </span>
                          <div>
                            <p className="reports-v2-eyebrow">Restricted evidence</p>
                            <h3>Conversation context</h3>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="reports-v2-secondary-button"
                          onClick={() => void loadMessageEvidence(selectedReport.id)}
                          disabled={loadingEvidenceId === selectedReport.id}
                        >
                          {loadingEvidenceId === selectedReport.id ? (
                            <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                          ) : selectedEvidence ? (
                            <XCircle aria-hidden="true" size={16} />
                          ) : (
                            <ShieldCheck aria-hidden="true" size={16} />
                          )}
                          {loadingEvidenceId === selectedReport.id
                            ? "Loading evidence"
                            : selectedEvidence
                              ? "Hide evidence"
                              : "View evidence"}
                        </button>
                      </div>

                      {!selectedEvidence ? (
                        <p className="reports-v2-muted-copy">
                          Evidence is loaded only when requested and is limited to the existing Admin evidence endpoint.
                        </p>
                      ) : (
                        <div className="reports-v2-evidence">
                          <div className="reports-v2-evidence-summary">
                            <div>
                              <span>Participants</span>
                              <strong>{selectedEvidence.participants.length}</strong>
                            </div>
                            <div>
                              <span>Messages shown</span>
                              <strong>{selectedEvidence.messages.length}</strong>
                            </div>
                          </div>

                          <div className="reports-v2-participants">
                            {selectedEvidence.participants.map((participant) => (
                              <article key={participant.userId}>
                                <strong>
                                  {participant.fullName || participant.username || "Loombus member"}
                                </strong>
                                <span>
                                  {participant.username ? `@${participant.username}` : participant.userId}
                                </span>
                                <em>Status: {participant.accountStatus || "unknown"}</em>
                              </article>
                            ))}
                          </div>

                          <div className="reports-v2-message-list">
                            {selectedEvidence.messages.map((evidenceMessage) => (
                              <article
                                key={evidenceMessage.id}
                                className={
                                  evidenceMessage.isReportedMessage ? "is-reported" : undefined
                                }
                              >
                                <div>
                                  <strong>
                                    {getEvidenceParticipantLabel(
                                      selectedEvidence,
                                      evidenceMessage.senderId
                                    )}
                                  </strong>
                                  <time dateTime={evidenceMessage.createdAt}>
                                    {formatDateTime(evidenceMessage.createdAt)}
                                  </time>
                                </div>
                                {evidenceMessage.isReportedMessage ? (
                                  <span className="reports-v2-evidence-label">Reported message</span>
                                ) : null}
                                <p>
                                  {evidenceMessage.deletedBySender
                                    ? "Message deleted by sender."
                                    : evidenceMessage.body || "(empty message)"}
                                </p>
                              </article>
                            ))}
                          </div>
                        </div>
                      )}
                    </section>
                  ) : null}

                  {selectedKind === "profile" && selectedProfile ? (
                    <section className="reports-v2-panel is-enforcement">
                      <div className="reports-v2-panel-heading">
                        <span className="reports-v2-panel-icon">
                          <Ban aria-hidden="true" size={19} />
                        </span>
                        <div>
                          <p className="reports-v2-eyebrow">Account enforcement</p>
                          <h3>{ACCOUNT_STATUS_LABELS[normalizeAccountStatus(selectedProfile.account_status)]}</h3>
                        </div>
                      </div>

                      <div className="reports-v2-enforcement-history">
                        {selectedProfile.enforcement_reason ? (
                          <p><strong>Existing reason:</strong> {selectedProfile.enforcement_reason}</p>
                        ) : null}
                        {selectedProfile.enforced_at ? (
                          <p><strong>Last updated:</strong> {formatDateTime(selectedProfile.enforced_at)}</p>
                        ) : null}
                        {selectedProfile.suspended_until ? (
                          <p><strong>Suspended until:</strong> {formatDateTime(selectedProfile.suspended_until)}</p>
                        ) : null}
                      </div>

                      <div className="reports-v2-field-grid">
                        <label>
                          <span>Enforcement reason</span>
                          <input
                            type="text"
                            maxLength={240}
                            value={enforcementReasons[selectedProfile.id] ?? selectedReport.reason}
                            onChange={(event) =>
                              setEnforcementReasons((current) => ({
                                ...current,
                                [selectedProfile.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          <span>Suspension days</span>
                          <input
                            type="number"
                            min={1}
                            value={suspensionDays[selectedProfile.id] ?? "7"}
                            onChange={(event) =>
                              setSuspensionDays((current) => ({
                                ...current,
                                [selectedProfile.id]: event.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>

                      <label className="reports-v2-field">
                        <span>Internal enforcement note</span>
                        <textarea
                          rows={3}
                          maxLength={2000}
                          value={enforcementNotes[selectedProfile.id] ?? ""}
                          onChange={(event) =>
                            setEnforcementNotes((current) => ({
                              ...current,
                              [selectedProfile.id]: event.target.value,
                            }))
                          }
                          placeholder="Optional context for the audit trail"
                        />
                      </label>

                      <div className="reports-v2-enforcement-actions">
                        <button
                          type="button"
                          onClick={() => void updateAccountEnforcement(selectedProfile.id, "warn_user")}
                          disabled={enforcingProfileId === selectedProfile.id}
                        >
                          <AlertTriangle aria-hidden="true" size={16} /> Warn
                        </button>
                        <button
                          type="button"
                          className="is-warning"
                          onClick={() => void updateAccountEnforcement(selectedProfile.id, "suspend_user")}
                          disabled={enforcingProfileId === selectedProfile.id}
                        >
                          <Clock3 aria-hidden="true" size={16} /> Suspend
                        </button>
                        <button
                          type="button"
                          className="is-danger"
                          onClick={() => void updateAccountEnforcement(selectedProfile.id, "ban_user")}
                          disabled={enforcingProfileId === selectedProfile.id}
                        >
                          <Ban aria-hidden="true" size={16} /> Ban
                        </button>
                        {normalizeAccountStatus(selectedProfile.account_status) !== "active" ? (
                          <button
                            type="button"
                            className="is-success"
                            onClick={() => void updateAccountEnforcement(selectedProfile.id, "restore_user")}
                            disabled={enforcingProfileId === selectedProfile.id}
                          >
                            <UserCheck aria-hidden="true" size={16} /> Restore active
                          </button>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  <section className="reports-v2-panel">
                    <div className="reports-v2-panel-heading">
                      <span className="reports-v2-panel-icon">
                        <Clock3 aria-hidden="true" size={19} />
                      </span>
                      <div>
                        <p className="reports-v2-eyebrow">Decision history</p>
                        <h3>Recorded moderation state</h3>
                      </div>
                    </div>

                    <dl className="reports-v2-history-grid">
                      <div>
                        <dt>Status</dt>
                        <dd>{REPORT_STATUS_LABELS[selectedStatus]}</dd>
                      </div>
                      <div>
                        <dt>Status updated</dt>
                        <dd>{formatDateTime(selectedReport.status_updated_at)}</dd>
                      </div>
                      <div>
                        <dt>Updated by</dt>
                        <dd>{selectedReport.status_updated_by ? getProfileName(selectedStatusUpdater) : "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Reviewed</dt>
                        <dd>{formatDateTime(selectedReport.reviewed_at)}</dd>
                      </div>
                      <div>
                        <dt>Reviewed by</dt>
                        <dd>{selectedReport.reviewed_by ? getProfileName(selectedReviewer) : "Not recorded"}</dd>
                      </div>
                      <div>
                        <dt>Actioned by</dt>
                        <dd>{selectedReport.actioned_by ? getProfileName(selectedActionAdmin) : "Not recorded"}</dd>
                      </div>
                    </dl>

                    {(selectedKind === "message"
                      ? selectedMetadata?.moderation_note
                      : selectedReport.resolution_note) ? (
                      <div className="reports-v2-saved-note">
                        <strong>Saved resolution note</strong>
                        <p>
                          {selectedKind === "message"
                            ? selectedMetadata?.moderation_note
                            : selectedReport.resolution_note}
                        </p>
                      </div>
                    ) : null}
                  </section>

                  {selectedStatus === "new" || selectedStatus === "reviewing" ? (
                    <section className="reports-v2-panel">
                      <div className="reports-v2-panel-heading">
                        <span className="reports-v2-panel-icon">
                          <Flag aria-hidden="true" size={19} />
                        </span>
                        <div>
                          <p className="reports-v2-eyebrow">Resolution record</p>
                          <h3>Add decision context</h3>
                        </div>
                      </div>
                      <label className="reports-v2-field">
                        <span>Resolution note</span>
                        <textarea
                          rows={4}
                          maxLength={2000}
                          value={
                            reviewNotes[selectedReport.id] ??
                            (selectedKind === "message"
                              ? selectedMetadata?.moderation_note ?? ""
                              : selectedReport.resolution_note ?? "")
                          }
                          onChange={(event) =>
                            setReviewNotes((current) => ({
                              ...current,
                              [selectedReport.id]: event.target.value,
                            }))
                          }
                          placeholder="Record what was reviewed and why the report was dismissed or actioned."
                        />
                      </label>
                    </section>
                  ) : null}
                </div>

                <footer className="reports-v2-action-bar">
                  <div className="reports-v2-action-copy">
                    <strong>{REPORT_STATUS_LABELS[selectedStatus]}</strong>
                    <span>Use the least severe action that resolves the report.</span>
                  </div>

                  <div className="reports-v2-primary-actions">
                    {selectedStatus === "new" ? (
                      <button
                        type="button"
                        onClick={() => void updateReportStatus(selectedReport, "set_report_reviewing")}
                        disabled={Boolean(actionWorking)}
                      >
                        {actionWorking === `set_report_reviewing:${selectedReport.id}` ? (
                          <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                        ) : (
                          <Clock3 aria-hidden="true" size={16} />
                        )}
                        Start review
                      </button>
                    ) : null}

                    {selectedStatus === "new" || selectedStatus === "reviewing" ? (
                      <>
                        <button
                          type="button"
                          className="is-neutral"
                          onClick={() => void updateReportStatus(selectedReport, "dismiss_report")}
                          disabled={Boolean(actionWorking)}
                        >
                          {actionWorking === `dismiss_report:${selectedReport.id}` ? (
                            <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                          ) : (
                            <XCircle aria-hidden="true" size={16} />
                          )}
                          Dismiss
                        </button>
                        <button
                          type="button"
                          className="is-primary"
                          onClick={() => void updateReportStatus(selectedReport, "mark_report_actioned")}
                          disabled={Boolean(actionWorking)}
                        >
                          {actionWorking === `mark_report_actioned:${selectedReport.id}` ? (
                            <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                          ) : (
                            <CheckCircle2 aria-hidden="true" size={16} />
                          )}
                          Mark actioned
                        </button>
                      </>
                    ) : null}

                    {selectedKind === "discussion" && selectedReport.discussions ? (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void softDeleteDiscussion(selectedReport)}
                        disabled={Boolean(actionWorking)}
                      >
                        {actionWorking === `delete-discussion:${selectedReport.id}` ? (
                          <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                        ) : (
                          <Trash2 aria-hidden="true" size={16} />
                        )}
                        Soft delete discussion
                      </button>
                    ) : null}

                    {selectedKind === "reply" &&
                    selectedReport.replies &&
                    !selectedReport.replies.deleted_at ? (
                      <button
                        type="button"
                        className="is-danger"
                        onClick={() => void softDeleteReply(selectedReport)}
                        disabled={Boolean(actionWorking)}
                      >
                        {actionWorking === `delete-reply:${selectedReport.id}` ? (
                          <Loader2 aria-hidden="true" className="reports-v2-spin" size={16} />
                        ) : (
                          <Trash2 aria-hidden="true" size={16} />
                        )}
                        Soft delete reply
                      </button>
                    ) : null}
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
