"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  FileSearch,
  Filter,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type DeletedReply = {
  id: string;
  body: string;
  user_id: string;
  discussion_id: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
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
  deletion_reason: string | null;
};

type MetricDefinition = {
  label: string;
  value: number;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
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

function getProfileName(profile: Profile | undefined, fallback = "Unknown member") {
  return profile?.full_name?.trim() || profile?.username?.trim() || fallback;
}

function getProfileHandle(profile: Profile | undefined) {
  return profile?.username ? `@${profile.username}` : "No public handle";
}

function getAccountStatus(profile: Profile | undefined) {
  return profile?.account_status?.trim() || "unknown";
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function getWordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function getAccountBucket(profile: Profile | undefined) {
  const status = getAccountStatus(profile);
  if (status === "active") return "active";
  if (status === "warned") return "warned";
  if (
    status === "suspended" ||
    status === "banned" ||
    status === "deactivated" ||
    status === "deletion_requested"
  ) {
    return "restricted";
  }
  return "unknown";
}

export default function AdminDeletedRepliesV2Client() {
  const [replies, setReplies] = useState<DeletedReply[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [discussions, setDiscussions] = useState<Record<string, Discussion>>({});
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [authorStatusFilter, setAuthorStatusFilter] = useState("all");
  const [deletedByFilter, setDeletedByFilter] = useState("all");
  const [parentFilter, setParentFilter] = useState("all");
  const [selectedReplyId, setSelectedReplyId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadReplies = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted-replies";
        return;
      }

      const response = await fetch("/api/admin/deleted-replies", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted-replies";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        setReplies([]);
        setMessage(result.error ?? "Admin access required.");
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load deleted replies.");
        setAuthChecked(true);
        return;
      }

      const loadedReplies = (result.replies ?? []) as DeletedReply[];
      const loadedProfiles = (result.profiles ?? []) as Profile[];
      const loadedDiscussions = (result.discussions ?? []) as Discussion[];

      setReplies(loadedReplies);
      setProfiles(
        loadedProfiles.reduce<Record<string, Profile>>((map, profile) => {
          map[profile.id] = profile;
          return map;
        }, {})
      );
      setDiscussions(
        loadedDiscussions.reduce<Record<string, Discussion>>((map, discussion) => {
          map[discussion.id] = discussion;
          return map;
        }, {})
      );
      setCurrentAdminId(result.currentAdminId ?? "");
      setAuthorized(true);
      setAuthChecked(true);

      setSelectedReplyId((current) => {
        if (current && loadedReplies.some((reply) => reply.id === current)) {
          return current;
        }

        const requestedReply = new URLSearchParams(window.location.search).get("reply");
        if (requestedReply && loadedReplies.some((reply) => reply.id === requestedReply)) {
          return requestedReply;
        }

        return loadedReplies[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load deleted replies.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadReplies();
  }, [loadReplies]);

  const visibleReplies = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return replies.filter((reply) => {
      const author = profiles[reply.user_id];
      const deletedBy = reply.deleted_by ? profiles[reply.deleted_by] : undefined;
      const discussion = discussions[reply.discussion_id];

      if (
        authorStatusFilter !== "all" &&
        getAccountBucket(author) !== authorStatusFilter
      ) {
        return false;
      }

      if (deletedByFilter === "self" && reply.deleted_by !== reply.user_id) return false;
      if (deletedByFilter === "admin" && !deletedBy?.is_admin) return false;
      if (
        deletedByFilter === "member" &&
        (!reply.deleted_by || reply.deleted_by === reply.user_id || deletedBy?.is_admin)
      ) {
        return false;
      }
      if (deletedByFilter === "unknown" && reply.deleted_by && deletedBy) return false;

      if (parentFilter === "available" && (!discussion || discussion.deleted_at)) return false;
      if (parentFilter === "deleted" && !discussion?.deleted_at) return false;
      if (parentFilter === "unavailable" && discussion) return false;

      if (!query) return true;

      const searchable = [
        reply.id,
        reply.body,
        reply.user_id,
        reply.deleted_by,
        reply.discussion_id,
        author?.username,
        author?.full_name,
        author?.account_status,
        deletedBy?.username,
        deletedBy?.full_name,
        discussion?.title,
        discussion?.topic,
        discussion?.deletion_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    authorStatusFilter,
    deletedByFilter,
    discussions,
    parentFilter,
    profiles,
    replies,
    searchQuery,
  ]);

  useEffect(() => {
    if (!visibleReplies.length) {
      setSelectedReplyId(null);
      return;
    }

    if (!selectedReplyId || !visibleReplies.some((reply) => reply.id === selectedReplyId)) {
      setSelectedReplyId(visibleReplies[0].id);
    }
  }, [selectedReplyId, visibleReplies]);

  const selectedReply = useMemo(
    () => replies.find((reply) => reply.id === selectedReplyId) ?? null,
    [replies, selectedReplyId]
  );

  const selectedAuthor = selectedReply ? profiles[selectedReply.user_id] : undefined;
  const selectedDeletedBy =
    selectedReply?.deleted_by ? profiles[selectedReply.deleted_by] : undefined;
  const selectedDiscussion = selectedReply
    ? discussions[selectedReply.discussion_id]
    : undefined;
  const selectedIsSelfDeleted = Boolean(
    selectedReply?.deleted_by && selectedReply.deleted_by === selectedReply.user_id
  );
  const selectedParentDeleted = Boolean(selectedDiscussion?.deleted_at);

  const metrics = useMemo<MetricDefinition[]>(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = replies.filter((reply) => {
      const deletedAt = reply.deleted_at ? new Date(reply.deleted_at).getTime() : Number.NaN;
      return Number.isFinite(deletedAt) && deletedAt >= sevenDaysAgo;
    }).length;
    const deletedParents = replies.filter(
      (reply) => Boolean(discussions[reply.discussion_id]?.deleted_at)
    ).length;
    const adminRemoved = replies.filter((reply) => {
      const deletingProfile = reply.deleted_by ? profiles[reply.deleted_by] : undefined;
      return Boolean(deletingProfile?.is_admin);
    }).length;

    return [
      {
        label: "Deleted replies",
        value: replies.length,
        detail: "Currently waiting in the recovery queue.",
        Icon: MessageSquareReply,
        priority: true,
      },
      {
        label: "Last 7 days",
        value: recent,
        detail: "Replies removed during the latest review window.",
        Icon: Clock3,
      },
      {
        label: "Deleted parents",
        value: deletedParents,
        detail: "Replies whose parent discussions are also hidden.",
        Icon: ShieldAlert,
      },
      {
        label: "Admin removals",
        value: adminRemoved,
        detail: "Records with a recognized Admin deleting profile.",
        Icon: UsersRound,
      },
    ];
  }, [discussions, profiles, replies]);

  function selectReply(replyId: string) {
    setSelectedReplyId(replyId);
    setCopiedId(false);

    const url = new URL(window.location.href);
    url.searchParams.set("reply", replyId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function clearFilters() {
    setSearchQuery("");
    setAuthorStatusFilter("all");
    setDeletedByFilter("all");
    setParentFilter("all");
  }

  async function restoreReply(reply: DeletedReply) {
    if (restoringId) return;

    const parentState = discussions[reply.discussion_id]?.deleted_at
      ? " Its parent discussion is also deleted, so the reply will remain hidden until that discussion is restored."
      : "";
    const confirmed = window.confirm(
      `Restore this reply? The reply will return to its discussion.${parentState}`
    );

    if (!confirmed) return;

    setMessage("");
    setRestoringId(reply.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted-replies";
        return;
      }

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "restore_reply",
          replyId: reply.id,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to restore reply.");
        return;
      }

      setReplies((current) => current.filter((item) => item.id !== reply.id));
      setMessage(
        discussions[reply.discussion_id]?.deleted_at
          ? "Reply restored. Its parent discussion remains deleted."
          : "Reply restored."
      );

      const url = new URL(window.location.href);
      url.searchParams.delete("reply");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    } catch {
      setMessage("Unable to restore reply.");
    } finally {
      setRestoringId(null);
    }
  }

  async function copyReplyId() {
    if (!selectedReply) return;

    try {
      await navigator.clipboard.writeText(selectedReply.id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      setMessage("Unable to copy the reply ID.");
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="deleted-replies-v2-page">
        <div className="deleted-replies-v2-state-card">
          <Loader2 className="deleted-replies-v2-spinner" size={24} aria-hidden="true" />
          <div>
            <h1>Loading reply recovery operations</h1>
            <p>Verifying Admin access and retrieving deleted reply records.</p>
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="deleted-replies-v2-page">
        <div className="deleted-replies-v2-state-card">
          <ShieldAlert size={26} aria-hidden="true" />
          <div>
            <h1>Access denied</h1>
            <p>{message || "Admin access is required to review deleted replies."}</p>
            <Link href="/admin">Return to Admin</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="deleted-replies-v2-page">
      <div className="deleted-replies-v2-shell">
        <section className="deleted-replies-v2-hero">
          <div>
            <Link href="/admin" className="deleted-replies-v2-back-link">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to Admin
            </Link>
            <p className="deleted-replies-v2-eyebrow">Recovery Operations</p>
            <h1>Deleted replies</h1>
            <p>
              Review reply content, author standing, deleting-profile context, and the
              parent discussion before reversing a soft deletion.
            </p>
          </div>

          <div className="deleted-replies-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadReplies(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="deleted-replies-v2-spinner" size={16} aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              {refreshing ? "Refreshing" : "Refresh queue"}
            </button>
            <Link href="/admin/deleted">Deleted discussions</Link>
          </div>
        </section>

        <section className="deleted-replies-v2-metrics" aria-label="Deleted reply metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article
              key={label}
              className={`deleted-replies-v2-metric${priority ? " is-priority" : ""}`}
            >
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
          <div className="deleted-replies-v2-notice" role="status">
            <AlertTriangle size={17} aria-hidden="true" />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="deleted-replies-v2-toolbar" aria-label="Recovery filters">
          <label className="deleted-replies-v2-search">
            <Search size={17} aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search reply, member, discussion, topic, or ID"
            />
          </label>

          <div className="deleted-replies-v2-filter-row">
            <label>
              <span>Author standing</span>
              <select
                value={authorStatusFilter}
                onChange={(event) => setAuthorStatusFilter(event.target.value)}
              >
                <option value="all">All account states</option>
                <option value="active">Active</option>
                <option value="warned">Warned</option>
                <option value="restricted">Restricted</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <label>
              <span>Deleted by</span>
              <select
                value={deletedByFilter}
                onChange={(event) => setDeletedByFilter(event.target.value)}
              >
                <option value="all">All deleting profiles</option>
                <option value="self">Reply author</option>
                <option value="admin">Admin account</option>
                <option value="member">Another member</option>
                <option value="unknown">Unknown or missing</option>
              </select>
            </label>

            <label>
              <span>Parent discussion</span>
              <select
                value={parentFilter}
                onChange={(event) => setParentFilter(event.target.value)}
              >
                <option value="all">All parent states</option>
                <option value="available">Publicly available</option>
                <option value="deleted">Also deleted</option>
                <option value="unavailable">Record unavailable</option>
              </select>
            </label>

            <button type="button" onClick={clearFilters}>
              <RotateCcw size={14} aria-hidden="true" />
              Clear filters
            </button>
          </div>
        </section>

        <section className="deleted-replies-v2-workspace">
          <aside className="deleted-replies-v2-queue">
            <header className="deleted-replies-v2-queue-heading">
              <div>
                <p className="deleted-replies-v2-eyebrow">Recovery queue</p>
                <h2>Replies awaiting review</h2>
              </div>
              <span>{visibleReplies.length}</span>
            </header>

            {visibleReplies.length ? (
              <div className="deleted-replies-v2-queue-list">
                {visibleReplies.map((reply) => {
                  const author = profiles[reply.user_id];
                  const discussion = discussions[reply.discussion_id];
                  const isSelected = reply.id === selectedReplyId;

                  return (
                    <button
                      key={reply.id}
                      type="button"
                      className={isSelected ? "is-selected" : undefined}
                      onClick={() => selectReply(reply.id)}
                    >
                      <div className="deleted-replies-v2-queue-top">
                        <span className="deleted-replies-v2-badge is-danger">Deleted</span>
                        <time dateTime={reply.deleted_at ?? undefined}>
                          {formatRelativeTime(reply.deleted_at)}
                        </time>
                      </div>
                      <h3>{discussion?.title || "Discussion unavailable"}</h3>
                      <p>{reply.body || "No reply body recorded."}</p>
                      <div className="deleted-replies-v2-queue-meta">
                        <span>
                          <UserRound size={12} aria-hidden="true" />
                          {getProfileName(author)}
                        </span>
                        <span>
                          <FileSearch size={12} aria-hidden="true" />
                          {discussion?.topic || "Unknown topic"}
                        </span>
                      </div>
                      <ChevronRight
                        className="deleted-replies-v2-chevron"
                        size={17}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="deleted-replies-v2-empty">
                <CheckCircle2 size={24} aria-hidden="true" />
                <h3>{replies.length ? "No matching replies" : "Recovery queue is clear"}</h3>
                <p>
                  {replies.length
                    ? "Adjust or clear the filters to review more deleted replies."
                    : "Soft-deleted replies will appear here until they are restored."}
                </p>
                {replies.length ? (
                  <button type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </aside>

          <article className="deleted-replies-v2-detail">
            {selectedReply ? (
              <>
                <header className="deleted-replies-v2-detail-header">
                  <div>
                    <div className="deleted-replies-v2-badge-row">
                      <span className="deleted-replies-v2-badge is-danger">Deleted</span>
                      <span className="deleted-replies-v2-badge is-muted">
                        {selectedDiscussion?.topic || "Unknown topic"}
                      </span>
                      {selectedIsSelfDeleted ? (
                        <span className="deleted-replies-v2-badge is-warning">Self-deleted</span>
                      ) : null}
                      {selectedParentDeleted ? (
                        <span className="deleted-replies-v2-badge is-warning">Parent deleted</span>
                      ) : null}
                    </div>
                    <h2>{selectedDiscussion?.title || "Discussion unavailable"}</h2>
                    <p>
                      Reply deleted {formatDateTime(selectedReply.deleted_at)} · Reply created {formatDateTime(selectedReply.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="deleted-replies-v2-restore-button"
                    onClick={() => void restoreReply(selectedReply)}
                    disabled={Boolean(restoringId)}
                  >
                    {restoringId === selectedReply.id ? (
                      <Loader2 className="deleted-replies-v2-spinner" size={16} aria-hidden="true" />
                    ) : (
                      <RotateCcw size={16} aria-hidden="true" />
                    )}
                    {restoringId === selectedReply.id ? "Restoring" : "Restore reply"}
                  </button>
                </header>

                <div className="deleted-replies-v2-detail-body">
                  <section className={`deleted-replies-v2-warning-card${selectedParentDeleted ? " is-parent-deleted" : ""}`}>
                    <AlertTriangle size={20} aria-hidden="true" />
                    <div>
                      <h3>
                        {selectedParentDeleted
                          ? "The parent discussion is also deleted"
                          : "Restoration returns this reply to its discussion"}
                      </h3>
                      <p>
                        {selectedParentDeleted
                          ? "Restoring the reply clears its deletion fields and records a reply restoration audit event, but the reply remains hidden until the parent discussion is restored."
                          : "Confirm that the reply should return to the public conversation. The existing moderation action clears its deletion fields and records a reply restoration audit event."}
                      </p>
                    </div>
                  </section>

                  <section className="deleted-replies-v2-content-card">
                    <div className="deleted-replies-v2-section-heading">
                      <div>
                        <p className="deleted-replies-v2-eyebrow">Reply content</p>
                        <h3>Original body</h3>
                      </div>
                      <span>{getWordCount(selectedReply.body)} words</span>
                    </div>
                    <p className="deleted-replies-v2-content-body">
                      {selectedReply.body || "No reply body was recorded."}
                    </p>
                  </section>

                  <div className="deleted-replies-v2-context-grid">
                    <section className="deleted-replies-v2-context-card">
                      <div className="deleted-replies-v2-section-heading">
                        <div>
                          <p className="deleted-replies-v2-eyebrow">Author</p>
                          <h3>Member context</h3>
                        </div>
                        <UsersRound size={18} aria-hidden="true" />
                      </div>

                      <div className="deleted-replies-v2-profile-row">
                        <ProfileAvatar profile={selectedAuthor} size="md" />
                        <div>
                          <strong>{getProfileName(selectedAuthor)}</strong>
                          <span>{getProfileHandle(selectedAuthor)}</span>
                        </div>
                      </div>

                      <dl>
                        <div>
                          <dt>Account status</dt>
                          <dd>{formatStatus(getAccountStatus(selectedAuthor))}</dd>
                        </div>
                        <div>
                          <dt>Admin account</dt>
                          <dd>{selectedAuthor?.is_admin ? "Yes" : "No"}</dd>
                        </div>
                        <div>
                          <dt>Author ID</dt>
                          <dd>{selectedReply.user_id}</dd>
                        </div>
                      </dl>

                      <div className="deleted-replies-v2-link-row">
                        <Link href={`/admin/users?member=${encodeURIComponent(selectedReply.user_id)}`}>
                          Review member
                        </Link>
                        {selectedAuthor?.username ? (
                          <Link href={`/u/${encodeURIComponent(selectedAuthor.username)}`}>
                            Public profile
                          </Link>
                        ) : null}
                      </div>
                    </section>

                    <section className="deleted-replies-v2-context-card">
                      <div className="deleted-replies-v2-section-heading">
                        <div>
                          <p className="deleted-replies-v2-eyebrow">Removal record</p>
                          <h3>Deleting-profile context</h3>
                        </div>
                        <Trash2 size={18} aria-hidden="true" />
                      </div>

                      <div className="deleted-replies-v2-profile-row">
                        <ProfileAvatar profile={selectedDeletedBy} size="md" />
                        <div>
                          <strong>
                            {selectedReply.deleted_by
                              ? getProfileName(selectedDeletedBy, "Unknown deleting profile")
                              : "No deleting profile recorded"}
                          </strong>
                          <span>
                            {selectedReply.deleted_by
                              ? getProfileHandle(selectedDeletedBy)
                              : "Deletion actor unavailable"}
                          </span>
                        </div>
                      </div>

                      <dl>
                        <div>
                          <dt>Deleted at</dt>
                          <dd>{formatDateTime(selectedReply.deleted_at)}</dd>
                        </div>
                        <div>
                          <dt>Deleted by</dt>
                          <dd>{selectedReply.deleted_by ?? "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>Deletion type</dt>
                          <dd>
                            {selectedIsSelfDeleted
                              ? "Reply author"
                              : selectedDeletedBy?.is_admin
                                ? "Admin account"
                                : selectedReply.deleted_by
                                  ? "Another member"
                                  : "Unknown"}
                          </dd>
                        </div>
                      </dl>
                    </section>
                  </div>

                  <section className="deleted-replies-v2-parent-card">
                    <div className="deleted-replies-v2-section-heading">
                      <div>
                        <p className="deleted-replies-v2-eyebrow">Parent discussion</p>
                        <h3>Conversation context</h3>
                      </div>
                      <MessageSquareReply size={18} aria-hidden="true" />
                    </div>

                    {selectedDiscussion ? (
                      <>
                        <div className="deleted-replies-v2-parent-title">
                          <strong>{selectedDiscussion.title || "Untitled discussion"}</strong>
                          <span>{selectedDiscussion.topic || "No topic"}</span>
                        </div>
                        <dl>
                          <div>
                            <dt>Discussion status</dt>
                            <dd>{selectedDiscussion.deleted_at ? "Deleted" : "Available"}</dd>
                          </div>
                          <div>
                            <dt>Discussion ID</dt>
                            <dd>{selectedDiscussion.id}</dd>
                          </div>
                          <div>
                            <dt>Deletion reason</dt>
                            <dd>{selectedDiscussion.deletion_reason || "Not applicable"}</dd>
                          </div>
                        </dl>
                        <div className="deleted-replies-v2-link-row">
                          {selectedDiscussion.deleted_at ? (
                            <Link href={`/admin/deleted?discussion=${encodeURIComponent(selectedDiscussion.id)}`}>
                              Review deleted discussion
                            </Link>
                          ) : (
                            <Link href={`/discussions/${encodeURIComponent(selectedDiscussion.id)}`}>
                              Open discussion
                            </Link>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="deleted-replies-v2-muted-copy">
                        The parent discussion record could not be loaded. Review audit context before restoring this reply.
                      </p>
                    )}
                  </section>

                  <section className="deleted-replies-v2-record-card">
                    <div className="deleted-replies-v2-section-heading">
                      <div>
                        <p className="deleted-replies-v2-eyebrow">Recovery record</p>
                        <h3>Identifiers and audit context</h3>
                      </div>
                      <Clock3 size={18} aria-hidden="true" />
                    </div>

                    <dl>
                      <div>
                        <dt>Reply ID</dt>
                        <dd>{selectedReply.id}</dd>
                      </div>
                      <div>
                        <dt>Discussion ID</dt>
                        <dd>{selectedReply.discussion_id}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDateTime(selectedReply.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Current Admin</dt>
                        <dd>{currentAdminId}</dd>
                      </div>
                    </dl>

                    <div className="deleted-replies-v2-link-row">
                      <button type="button" onClick={() => void copyReplyId()}>
                        <Clipboard size={14} aria-hidden="true" />
                        {copiedId ? "Copied" : "Copy reply ID"}
                      </button>
                      <Link href={`/admin/audit?search=${encodeURIComponent(selectedReply.id)}`}>
                        Open audit context
                      </Link>
                      <Link href="/admin/reports">Open reports</Link>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="deleted-replies-v2-empty deleted-replies-v2-empty-detail">
                <Filter size={26} aria-hidden="true" />
                <h3>Select a deleted reply</h3>
                <p>Choose an item from the recovery queue to review its content and context.</p>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
