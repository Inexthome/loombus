"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  FileSearch,
  Filter,
  History,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type AuditMetadata = Record<string, unknown> | null;

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: AuditMetadata;
  created_at: string;
  actor_id: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
};

type Discussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
};

type Reply = {
  id: string;
  user_id: string;
  discussion_id: string;
  body: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

type ActionFamily =
  | "safety"
  | "account"
  | "recovery"
  | "reports"
  | "support"
  | "identity"
  | "content"
  | "ai"
  | "system";

type MetricDefinition = {
  label: string;
  value: number;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

const knownActionLabels: Record<string, string> = {
  "discussion.created": "Discussion created",
  "discussion.soft_deleted": "Discussion soft deleted",
  "discussion.restored": "Discussion restored",
  "reply.created": "Reply created",
  "reply.soft_deleted": "Reply soft deleted",
  "reply.restored": "Reply restored",
  "account.warned": "Account warned",
  "account.suspended": "Account suspended",
  "account.banned": "Account banned",
  "account.restored": "Account restored",
  "account.deactivated": "Account deactivated",
  "account.deletion_requested": "Account deletion requested",
  "content_safety.blocked": "Content safety blocked",
  "content_safety.warned": "Content safety warned",
  "report.reviewing": "Report moved to reviewing",
  "report.dismissed": "Report dismissed",
  "report.actioned": "Report actioned",
  "support_request.updated": "Support request updated",
  "identity_verification.updated": "Identity verification updated",
};

const knownActionDescriptions: Record<string, string> = {
  "discussion.created": "A member published a new discussion.",
  "discussion.soft_deleted": "A discussion was removed from public view.",
  "discussion.restored": "A previously deleted discussion was restored.",
  "reply.created": "A member posted a reply.",
  "reply.soft_deleted": "A reply was removed from public view.",
  "reply.restored": "A previously deleted reply was restored.",
  "account.warned": "An Admin warned a member account.",
  "account.suspended": "An Admin temporarily suspended a member account.",
  "account.banned": "An Admin banned a member account.",
  "account.restored": "An Admin restored a member account to active status.",
  "account.deactivated": "A member deactivated their account.",
  "account.deletion_requested": "A member requested account deletion.",
  "content_safety.blocked": "Loombus blocked content before publication.",
  "content_safety.warned": "Loombus warned a member before publication.",
  "report.reviewing": "A report entered active review.",
  "report.dismissed": "A report was dismissed after review.",
  "report.actioned": "A report was resolved with an enforcement or moderation action.",
  "support_request.updated": "An Admin updated a support request outcome or note.",
  "identity_verification.updated": "An Admin updated an identity verification state.",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "Unknown time";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown time";

  const difference = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function humanizeToken(value: string) {
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getActionLabel(action: string) {
  if (knownActionLabels[action]) return knownActionLabels[action];

  const [namespace, event] = action.split(".");
  if (!event) return humanizeToken(action);
  return `${humanizeToken(namespace)} ${humanizeToken(event).toLowerCase()}`;
}

function getActionDescription(action: string) {
  return knownActionDescriptions[action] ?? `${getActionLabel(action)} was recorded by Loombus.`;
}

function getActionFamily(action: string): ActionFamily {
  if (action.startsWith("content_safety.")) return "safety";
  if (action.startsWith("account.")) return "account";
  if (action.includes("restored") || action.includes("soft_deleted")) return "recovery";
  if (action.startsWith("report.")) return "reports";
  if (action.startsWith("support_request.")) return "support";
  if (action.includes("identity")) return "identity";
  if (action.startsWith("discussion.") || action.startsWith("reply.")) return "content";
  if (action.includes("ai") || action.includes("summary") || action.includes("research")) return "ai";
  return "system";
}

function getFamilyLabel(family: ActionFamily) {
  const labels: Record<ActionFamily, string> = {
    safety: "Safety",
    account: "Account",
    recovery: "Recovery",
    reports: "Reports",
    support: "Support",
    identity: "Identity",
    content: "Content",
    ai: "AI",
    system: "System",
  };

  return labels[family];
}

function getFamilyIcon(family: ActionFamily): LucideIcon {
  if (family === "safety") return ShieldAlert;
  if (family === "account") return UsersRound;
  if (family === "recovery") return RotateCcw;
  if (family === "reports") return FileSearch;
  if (family === "support") return History;
  if (family === "identity") return ShieldCheck;
  if (family === "content") return Activity;
  if (family === "ai") return Bot;
  return Clock3;
}

function getProfileName(profile: Profile | undefined, fallback = "Unknown member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function getProfileHandle(profile: Profile | undefined) {
  return profile?.username ? `@${profile.username}` : "No public handle";
}

function getAccountStatus(profile: Profile | undefined) {
  return profile?.account_status?.trim() || "unknown";
}

function isTestAuditLog(log: AuditLog) {
  const metadata = log.metadata ?? {};

  return (
    metadata.test === true ||
    metadata.is_test === true ||
    metadata.source === "test" ||
    metadata.environment === "test" ||
    log.action.includes(".test") ||
    log.target_type === "test"
  );
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined) return "Not recorded";
  if (["string", "number", "boolean"].includes(typeof value)) return String(value);
  return JSON.stringify(value, null, 2);
}

function getSearchText(log: AuditLog, actor: Profile | undefined) {
  return [
    log.id,
    log.action,
    getActionLabel(log.action),
    getActionDescription(log.action),
    getFamilyLabel(getActionFamily(log.action)),
    log.target_type,
    log.target_id,
    log.actor_id,
    actor?.username,
    actor?.full_name,
    JSON.stringify(log.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AdminAuditV2Client() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [discussions, setDiscussions] = useState<Record<string, Discussion>>({});
  const [replies, setReplies] = useState<Record<string, Reply>>({});
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [limit, setLimit] = useState(100);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedLogId, setSelectedLogId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showTestRecords, setShowTestRecords] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [copiedValue, setCopiedValue] = useState("");

  const loadAudit = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/audit", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        return;
      }

      if (!response.ok) {
        setAuthorized(true);
        setMessage(result.error ?? "Unable to load audit records.");
        setAuthChecked(true);
        return;
      }

      const loadedLogs = (result.logs ?? []) as AuditLog[];
      const profileMap = ((result.profiles ?? []) as Profile[]).reduce<Record<string, Profile>>(
        (map, profile) => {
          map[profile.id] = profile;
          return map;
        },
        {}
      );
      const discussionMap = ((result.discussions ?? []) as Discussion[]).reduce<
        Record<string, Discussion>
      >((map, discussion) => {
        map[discussion.id] = discussion;
        return map;
      }, {});
      const replyMap = ((result.replies ?? []) as Reply[]).reduce<Record<string, Reply>>(
        (map, reply) => {
          map[reply.id] = reply;
          return map;
        },
        {}
      );
      const params = new URLSearchParams(window.location.search);
      const requestedEvent = params.get("event");

      setLogs(loadedLogs);
      setProfiles(profileMap);
      setDiscussions(discussionMap);
      setReplies(replyMap);
      setCurrentAdminId(result.currentAdminId ?? "");
      setLimit(result.limit ?? 100);
      setAuthorized(true);
      setSelectedLogId(
        requestedEvent && loadedLogs.some((log) => log.id === requestedEvent)
          ? requestedEvent
          : loadedLogs[0]?.id ?? ""
      );

      if (!isRefresh) {
        setSearchQuery(params.get("search") ?? "");
      }

      setAuthChecked(true);
    } catch {
      setAuthorized(true);
      setMessage("Unable to load audit records.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAudit(false);
  }, [loadAudit]);

  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );

  const targetTypeOptions = useMemo(
    () => [...new Set(logs.map((log) => log.target_type).filter(Boolean))].sort(),
    [logs]
  );

  const actorOptions = useMemo(
    () =>
      [...new Set(logs.map((log) => log.actor_id).filter((id): id is string => Boolean(id)))].sort(
        (a, b) => getProfileName(profiles[a], a).localeCompare(getProfileName(profiles[b], b))
      ),
    [logs, profiles]
  );

  const visibleLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const startTime = startDate ? new Date(`${startDate}T00:00:00`).getTime() : null;
    const endTime = endDate ? new Date(`${endDate}T23:59:59`).getTime() : null;

    const filtered = logs.filter((log) => {
      if (!showTestRecords && isTestAuditLog(log)) return false;
      if (familyFilter !== "all" && getActionFamily(log.action) !== familyFilter) return false;
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (actorFilter !== "all") {
        if (actorFilter === "system" && log.actor_id) return false;
        if (actorFilter !== "system" && log.actor_id !== actorFilter) return false;
      }
      if (targetTypeFilter !== "all" && log.target_type !== targetTypeFilter) return false;

      const logTime = new Date(log.created_at).getTime();
      if (startTime && logTime < startTime) return false;
      if (endTime && logTime > endTime) return false;

      if (query) {
        const actor = log.actor_id ? profiles[log.actor_id] : undefined;
        return getSearchText(log, actor).includes(query);
      }

      return true;
    });

    return filtered.sort((a, b) => {
      const difference = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sortOrder === "newest" ? difference : -difference;
    });
  }, [
    logs,
    profiles,
    searchQuery,
    familyFilter,
    actionFilter,
    actorFilter,
    targetTypeFilter,
    startDate,
    endDate,
    showTestRecords,
    sortOrder,
  ]);

  const selectedLog =
    visibleLogs.find((log) => log.id === selectedLogId) ?? visibleLogs[0] ?? null;
  const selectedActor = selectedLog?.actor_id ? profiles[selectedLog.actor_id] : undefined;
  const selectedDiscussion =
    selectedLog?.target_type === "discussion" && selectedLog.target_id
      ? discussions[selectedLog.target_id]
      : undefined;
  const selectedReply =
    selectedLog?.target_type === "reply" && selectedLog.target_id
      ? replies[selectedLog.target_id]
      : undefined;
  const selectedReplyDiscussion = selectedReply
    ? discussions[selectedReply.discussion_id]
    : undefined;
  const selectedTargetProfile =
    selectedLog?.target_id && ["profile", "account", "user", "member"].includes(selectedLog.target_type)
      ? profiles[selectedLog.target_id]
      : undefined;
  const metadataEntries = Object.entries(selectedLog?.metadata ?? {});

  const metrics = useMemo<MetricDefinition[]>(() => {
    const productionLogs = logs.filter((log) => !isTestAuditLog(log));
    const now = Date.now();

    return [
      {
        label: "Loaded records",
        value: productionLogs.length,
        detail: `Most recent ${limit} records maximum`,
        Icon: History,
      },
      {
        label: "Last 24 hours",
        value: productionLogs.filter(
          (log) => now - new Date(log.created_at).getTime() <= 24 * 60 * 60 * 1000
        ).length,
        detail: "Recent operational activity",
        Icon: CalendarDays,
        priority: true,
      },
      {
        label: "Safety and enforcement",
        value: productionLogs.filter((log) =>
          ["safety", "account", "reports"].includes(getActionFamily(log.action))
        ).length,
        detail: "Safety, account, and report events",
        Icon: ShieldAlert,
      },
      {
        label: "System actor",
        value: productionLogs.filter((log) => !log.actor_id).length,
        detail: "Automated or unattributed records",
        Icon: Bot,
      },
    ];
  }, [logs, limit]);

  function selectLog(logId: string) {
    setSelectedLogId(logId);
    const url = new URL(window.location.href);
    url.searchParams.set("event", logId);
    window.history.replaceState({}, "", url.toString());
  }

  function clearFilters() {
    setSearchQuery("");
    setFamilyFilter("all");
    setActionFilter("all");
    setActorFilter("all");
    setTargetTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setShowTestRecords(false);
    setSortOrder("newest");

    const url = new URL(window.location.href);
    url.searchParams.delete("search");
    window.history.replaceState({}, "", url.toString());
  }

  async function copyValue(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(key);
      window.setTimeout(() => setCopiedValue(""), 1600);
    } catch {
      setMessage("Unable to copy the identifier.");
    }
  }

  function getTargetTitle(log: AuditLog) {
    if (log.target_type === "discussion" && log.target_id) {
      return discussions[log.target_id]?.title || "Discussion target";
    }

    if (log.target_type === "reply" && log.target_id) {
      return replies[log.target_id]
        ? `Reply in ${discussions[replies[log.target_id].discussion_id]?.title ?? "discussion"}`
        : "Reply target";
    }

    if (["profile", "account", "user", "member"].includes(log.target_type) && log.target_id) {
      return getProfileName(profiles[log.target_id], "Member account");
    }

    if (log.target_type === "report") return "Moderation report";
    if (log.target_type === "support_request") return "Support request";
    return humanizeToken(log.target_type || "platform target");
  }

  if (!authChecked || loading) {
    return (
      <main className="audit-v2-page">
        <div className="audit-v2-loading">
          <Loader2 className="audit-v2-spinner" size={22} aria-hidden="true" />
          <span>Loading audit operations...</span>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="audit-v2-page">
        <div className="audit-v2-state-card">
          <ShieldAlert size={28} aria-hidden="true" />
          <p className="audit-v2-eyebrow">Admin only</p>
          <h1>Access denied.</h1>
          <p>Audit operations are available only to active Admin accounts.</p>
          <Link href="/admin">Return to Admin</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="audit-v2-page">
      <div className="audit-v2-shell">
        <header className="audit-v2-hero">
          <div>
            <Link href="/admin" className="audit-v2-back-link">
              <ArrowLeft size={15} aria-hidden="true" />
              Admin
            </Link>
            <p className="audit-v2-eyebrow">Administration · Audit Operations</p>
            <h1>Trace what happened.</h1>
            <p>
              Review the platform record trail across moderation, safety, recovery,
              account enforcement, support, and system activity.
            </p>
          </div>

          <div className="audit-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadAudit(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="audit-v2-spinner" size={16} aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              {refreshing ? "Refreshing" : "Refresh records"}
            </button>
            <Link href="/admin/reports">Open reports</Link>
          </div>
        </header>

        <section className="audit-v2-metrics" aria-label="Audit metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article key={label} className={`audit-v2-metric${priority ? " is-priority" : ""}`}>
              <div>
                <Icon size={15} aria-hidden="true" />
                <span>{label}</span>
              </div>
              <strong>{value}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </section>

        {message ? (
          <div className="audit-v2-notice" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="audit-v2-toolbar">
          <label className="audit-v2-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search action, actor, target, event ID, or metadata"
            />
          </label>

          <div className="audit-v2-filter-grid">
            <label>
              <span>Family</span>
              <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                <option value="all">All families</option>
                {(["safety", "account", "recovery", "reports", "support", "identity", "content", "ai", "system"] as ActionFamily[]).map(
                  (family) => (
                    <option key={family} value={family}>
                      {getFamilyLabel(family)}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Action</span>
              <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
                <option value="all">All actions</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {getActionLabel(action)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Actor</span>
              <select value={actorFilter} onChange={(event) => setActorFilter(event.target.value)}>
                <option value="all">All actors</option>
                <option value="system">System / unknown</option>
                {actorOptions.map((actorId) => (
                  <option key={actorId} value={actorId}>
                    {getProfileName(profiles[actorId], actorId)}
                    {profiles[actorId]?.username ? ` (@${profiles[actorId].username})` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Target type</span>
              <select
                value={targetTypeFilter}
                onChange={(event) => setTargetTypeFilter(event.target.value)}
              >
                <option value="all">All target types</option>
                {targetTypeOptions.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {humanizeToken(targetType)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>

            <label>
              <span>End date</span>
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>

            <label>
              <span>Sort</span>
              <select
                value={sortOrder}
                onChange={(event) => setSortOrder(event.target.value as "newest" | "oldest")}
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>

            <button type="button" onClick={clearFilters}>
              <Filter size={15} aria-hidden="true" />
              Clear filters
            </button>
          </div>

          <label className="audit-v2-test-toggle">
            <input
              type="checkbox"
              checked={showTestRecords}
              onChange={(event) => setShowTestRecords(event.target.checked)}
            />
            <span>Include records explicitly marked as test data</span>
          </label>
        </section>

        <section className="audit-v2-workspace">
          <aside className="audit-v2-queue">
            <header className="audit-v2-queue-heading">
              <div>
                <p className="audit-v2-eyebrow">Record trail</p>
                <h2>Audit queue</h2>
              </div>
              <span>{visibleLogs.length}</span>
            </header>

            {visibleLogs.length ? (
              <div className="audit-v2-queue-list">
                {visibleLogs.map((log) => {
                  const actor = log.actor_id ? profiles[log.actor_id] : undefined;
                  const family = getActionFamily(log.action);
                  const FamilyIcon = getFamilyIcon(family);
                  const isSelected = selectedLog?.id === log.id;

                  return (
                    <button
                      key={log.id}
                      type="button"
                      className={isSelected ? "is-selected" : undefined}
                      onClick={() => selectLog(log.id)}
                    >
                      <div className="audit-v2-queue-top">
                        <span className={`audit-v2-badge is-${family}`}>
                          <FamilyIcon size={12} aria-hidden="true" />
                          {getFamilyLabel(family)}
                        </span>
                        <time dateTime={log.created_at}>{formatRelativeTime(log.created_at)}</time>
                      </div>
                      <h3>{getActionLabel(log.action)}</h3>
                      <p>{getActionDescription(log.action)}</p>
                      <div className="audit-v2-queue-meta">
                        <span>
                          <UserRound size={12} aria-hidden="true" />
                          {log.actor_id ? getProfileName(actor, "Unknown actor") : "System actor"}
                        </span>
                        <span>
                          <FileSearch size={12} aria-hidden="true" />
                          {getTargetTitle(log)}
                        </span>
                      </div>
                      <ChevronRight className="audit-v2-chevron" size={17} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="audit-v2-empty">
                <CheckCircle2 size={25} aria-hidden="true" />
                <h3>{logs.length ? "No matching records" : "No audit records yet"}</h3>
                <p>
                  {logs.length
                    ? "Adjust or clear the filters to review more audit activity."
                    : "Tracked platform events will appear here after they are recorded."}
                </p>
                {logs.length ? (
                  <button type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </aside>

          <article className="audit-v2-detail">
            {selectedLog ? (
              <>
                <header className="audit-v2-detail-header">
                  <div>
                    <div className="audit-v2-badge-row">
                      <span className={`audit-v2-badge is-${getActionFamily(selectedLog.action)}`}>
                        {getFamilyLabel(getActionFamily(selectedLog.action))}
                      </span>
                      <span className="audit-v2-badge is-muted">
                        {humanizeToken(selectedLog.target_type || "target")}
                      </span>
                      {isTestAuditLog(selectedLog) ? (
                        <span className="audit-v2-badge is-warning">Test record</span>
                      ) : null}
                    </div>
                    <h2>{getActionLabel(selectedLog.action)}</h2>
                    <p>
                      {formatDateTime(selectedLog.created_at)} · Event {selectedLog.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="audit-v2-copy-button"
                    onClick={() => void copyValue(selectedLog.id, "event")}
                  >
                    <Clipboard size={15} aria-hidden="true" />
                    {copiedValue === "event" ? "Copied" : "Copy event ID"}
                  </button>
                </header>

                <div className="audit-v2-detail-body">
                  <section className="audit-v2-summary-card">
                    <div className="audit-v2-section-heading">
                      <div>
                        <p className="audit-v2-eyebrow">Event summary</p>
                        <h3>What happened</h3>
                      </div>
                      <Activity size={19} aria-hidden="true" />
                    </div>
                    <p>{getActionDescription(selectedLog.action)}</p>
                    <dl>
                      <div>
                        <dt>Action code</dt>
                        <dd>{selectedLog.action}</dd>
                      </div>
                      <div>
                        <dt>Action family</dt>
                        <dd>{getFamilyLabel(getActionFamily(selectedLog.action))}</dd>
                      </div>
                      <div>
                        <dt>Recorded</dt>
                        <dd>{formatDateTime(selectedLog.created_at)}</dd>
                      </div>
                    </dl>
                  </section>

                  <div className="audit-v2-context-grid">
                    <section className="audit-v2-context-card">
                      <div className="audit-v2-section-heading">
                        <div>
                          <p className="audit-v2-eyebrow">Actor</p>
                          <h3>Who initiated it</h3>
                        </div>
                        <UserRound size={18} aria-hidden="true" />
                      </div>

                      {selectedLog.actor_id ? (
                        <>
                          <div className="audit-v2-profile-row">
                            <ProfileAvatar profile={selectedActor} size="md" />
                            <div>
                              <strong>{getProfileName(selectedActor, "Unknown actor")}</strong>
                              <span>{getProfileHandle(selectedActor)}</span>
                            </div>
                          </div>
                          <dl>
                            <div>
                              <dt>Actor ID</dt>
                              <dd>{selectedLog.actor_id}</dd>
                            </div>
                            <div>
                              <dt>Account status</dt>
                              <dd>{humanizeToken(getAccountStatus(selectedActor))}</dd>
                            </div>
                            <div>
                              <dt>Admin account</dt>
                              <dd>{selectedActor?.is_admin ? "Yes" : "No"}</dd>
                            </div>
                          </dl>
                          <div className="audit-v2-link-row">
                            <Link href={`/admin/users?member=${encodeURIComponent(selectedLog.actor_id)}`}>
                              Review actor
                            </Link>
                            {selectedActor?.username ? (
                              <Link href={`/u/${encodeURIComponent(selectedActor.username)}`}>
                                Public profile
                              </Link>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="audit-v2-system-actor">
                          <Bot size={22} aria-hidden="true" />
                          <div>
                            <strong>System or unknown actor</strong>
                            <span>No member actor ID was recorded for this event.</span>
                          </div>
                        </div>
                      )}
                    </section>

                    <section className="audit-v2-context-card">
                      <div className="audit-v2-section-heading">
                        <div>
                          <p className="audit-v2-eyebrow">Target</p>
                          <h3>{getTargetTitle(selectedLog)}</h3>
                        </div>
                        <FileSearch size={18} aria-hidden="true" />
                      </div>

                      {selectedTargetProfile ? (
                        <div className="audit-v2-profile-row">
                          <ProfileAvatar profile={selectedTargetProfile} size="md" />
                          <div>
                            <strong>{getProfileName(selectedTargetProfile)}</strong>
                            <span>{getProfileHandle(selectedTargetProfile)}</span>
                          </div>
                        </div>
                      ) : null}

                      {selectedDiscussion ? (
                        <div className="audit-v2-target-preview">
                          <strong>{selectedDiscussion.title}</strong>
                          <span>{selectedDiscussion.topic || "No topic"}</span>
                          {selectedDiscussion.deleted_at ? <em>Currently deleted</em> : null}
                        </div>
                      ) : null}

                      {selectedReply ? (
                        <div className="audit-v2-target-preview">
                          <strong>{selectedReplyDiscussion?.title ?? "Parent discussion unavailable"}</strong>
                          <span>{selectedReply.body || "No reply body recorded"}</span>
                          {selectedReply.deleted_at ? <em>Reply currently deleted</em> : null}
                        </div>
                      ) : null}

                      <dl>
                        <div>
                          <dt>Target type</dt>
                          <dd>{humanizeToken(selectedLog.target_type || "target")}</dd>
                        </div>
                        <div>
                          <dt>Target ID</dt>
                          <dd>{selectedLog.target_id ?? "Not recorded"}</dd>
                        </div>
                      </dl>

                      <div className="audit-v2-link-row">
                        {selectedLog.target_id ? (
                          <button
                            type="button"
                            onClick={() => void copyValue(selectedLog.target_id!, "target")}
                          >
                            <Clipboard size={14} aria-hidden="true" />
                            {copiedValue === "target" ? "Copied" : "Copy target ID"}
                          </button>
                        ) : null}
                        {selectedTargetProfile && selectedLog.target_id ? (
                          <Link href={`/admin/users?member=${encodeURIComponent(selectedLog.target_id)}`}>
                            Open member
                          </Link>
                        ) : null}
                        {selectedDiscussion ? (
                          <Link href={`/discussions/${encodeURIComponent(selectedDiscussion.id)}`}>
                            Open discussion
                          </Link>
                        ) : null}
                        {selectedReply ? (
                          <Link href={`/admin/deleted-replies?reply=${encodeURIComponent(selectedReply.id)}`}>
                            Open reply recovery
                          </Link>
                        ) : null}
                        {selectedLog.target_type === "report" && selectedLog.target_id ? (
                          <Link href={`/admin/reports?report=${encodeURIComponent(selectedLog.target_id)}`}>
                            Open report
                          </Link>
                        ) : null}
                        {selectedLog.target_type === "support_request" && selectedLog.target_id ? (
                          <Link href={`/admin/support?request=${encodeURIComponent(selectedLog.target_id)}`}>
                            Open support request
                          </Link>
                        ) : null}
                      </div>
                    </section>
                  </div>

                  <section className="audit-v2-metadata-card">
                    <div className="audit-v2-section-heading">
                      <div>
                        <p className="audit-v2-eyebrow">Recorded metadata</p>
                        <h3>Supporting context</h3>
                      </div>
                      <FileSearch size={18} aria-hidden="true" />
                    </div>

                    {metadataEntries.length ? (
                      <div className="audit-v2-metadata-grid">
                        {metadataEntries.map(([key, value]) => (
                          <div key={key}>
                            <span>{humanizeToken(key)}</span>
                            <pre>{formatMetadataValue(value)}</pre>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="audit-v2-muted-copy">No metadata was attached to this audit event.</p>
                    )}
                  </section>

                  <section className="audit-v2-record-card">
                    <div className="audit-v2-section-heading">
                      <div>
                        <p className="audit-v2-eyebrow">Operations trail</p>
                        <h3>Continue the review</h3>
                      </div>
                      <Clock3 size={18} aria-hidden="true" />
                    </div>

                    <dl>
                      <div>
                        <dt>Current Admin</dt>
                        <dd>{currentAdminId}</dd>
                      </div>
                      <div>
                        <dt>Loaded window</dt>
                        <dd>Most recent {limit} records</dd>
                      </div>
                    </dl>

                    <div className="audit-v2-link-row is-wide">
                      <Link href="/admin/users">Member Operations</Link>
                      <Link href="/admin/reports">Reports</Link>
                      <Link href="/admin/safety">Safety Operations</Link>
                      <Link href="/admin/deleted">Discussion recovery</Link>
                      <Link href="/admin/deleted-replies">Reply recovery</Link>
                      <Link href="/admin/support">Support Operations</Link>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="audit-v2-empty audit-v2-empty-detail">
                <Filter size={26} aria-hidden="true" />
                <h3>Select an audit record</h3>
                <p>Choose an event from the record trail to review its actor, target, and metadata.</p>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
