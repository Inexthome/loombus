"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  FileSearch,
  Filter,
  Loader2,
  MessageSquareText,
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

type DeletedDiscussion = {
  id: string;
  user_id: string;
  title: string;
  topic: string;
  body: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
  deletion_reason: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
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
  const status = profile?.account_status?.trim();
  return status || "unknown";
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function getWordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

export default function AdminDeletedV2Client() {
  const [discussions, setDiscussions] = useState<DeletedDiscussion[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");
  const [reasonFilter, setReasonFilter] = useState("all");
  const [deletorFilter, setDeletorFilter] = useState("all");
  const [selectedDiscussionId, setSelectedDiscussionId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const loadDeletedDiscussions = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted";
        return;
      }

      const response = await fetch("/api/admin/deleted", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        setDiscussions([]);
        setMessage(result.error ?? "Admin access required.");
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load deleted discussions.");
        setAuthChecked(true);
        return;
      }

      const loadedDiscussions = (result.discussions ?? []) as DeletedDiscussion[];
      const loadedProfiles = (result.profiles ?? []) as Profile[];
      const profileMap = loadedProfiles.reduce<Record<string, Profile>>((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {});

      setDiscussions(loadedDiscussions);
      setProfiles(profileMap);
      setCurrentAdminId(result.currentAdminId ?? "");
      setAuthorized(true);
      setAuthChecked(true);

      setSelectedDiscussionId((current) => {
        if (current && loadedDiscussions.some((discussion) => discussion.id === current)) {
          return current;
        }

        const requestedDiscussion = new URLSearchParams(window.location.search)
          .get("discussion")
          ?.trim();

        if (
          requestedDiscussion &&
          loadedDiscussions.some((discussion) => discussion.id === requestedDiscussion)
        ) {
          return requestedDiscussion;
        }

        return loadedDiscussions[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load deleted discussions.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDeletedDiscussions();
  }, [loadDeletedDiscussions]);

  const topics = useMemo(
    () =>
      [...new Set(discussions.map((discussion) => discussion.topic).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [discussions]
  );

  const visibleDiscussions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return discussions.filter((discussion) => {
      const author = profiles[discussion.user_id];
      const deletedBy = discussion.deleted_by ? profiles[discussion.deleted_by] : undefined;
      const hasReason = Boolean(discussion.deletion_reason?.trim());
      const deletorType = !discussion.deleted_by
        ? "unknown"
        : deletedBy?.is_admin
          ? "admin"
          : "member";

      if (topicFilter !== "all" && discussion.topic !== topicFilter) return false;
      if (reasonFilter === "with_reason" && !hasReason) return false;
      if (reasonFilter === "without_reason" && hasReason) return false;
      if (deletorFilter !== "all" && deletorType !== deletorFilter) return false;

      if (!query) return true;

      return [
        discussion.id,
        discussion.title,
        discussion.topic,
        discussion.body,
        discussion.deletion_reason,
        discussion.user_id,
        discussion.deleted_by,
        author?.full_name,
        author?.username,
        deletedBy?.full_name,
        deletedBy?.username,
        getAccountStatus(author),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [deletorFilter, discussions, profiles, reasonFilter, searchQuery, topicFilter]);

  useEffect(() => {
    if (visibleDiscussions.length === 0) {
      setSelectedDiscussionId(null);
      return;
    }

    if (
      !selectedDiscussionId ||
      !visibleDiscussions.some((discussion) => discussion.id === selectedDiscussionId)
    ) {
      setSelectedDiscussionId(visibleDiscussions[0].id);
    }
  }, [selectedDiscussionId, visibleDiscussions]);

  const selectedDiscussion = useMemo(
    () =>
      visibleDiscussions.find((discussion) => discussion.id === selectedDiscussionId) ??
      null,
    [selectedDiscussionId, visibleDiscussions]
  );

  const metrics = useMemo<MetricDefinition[]>(() => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recent = discussions.filter((discussion) => {
      const timestamp = discussion.deleted_at
        ? new Date(discussion.deleted_at).getTime()
        : Number.NaN;
      return Number.isFinite(timestamp) && timestamp >= sevenDaysAgo;
    }).length;
    const withReason = discussions.filter((discussion) =>
      Boolean(discussion.deletion_reason?.trim())
    ).length;
    const adminDeleted = discussions.filter((discussion) => {
      const deletedBy = discussion.deleted_by ? profiles[discussion.deleted_by] : undefined;
      return Boolean(deletedBy?.is_admin);
    }).length;

    return [
      {
        label: "Recovery queue",
        value: discussions.length,
        detail: "Soft-deleted discussions awaiting possible recovery.",
        Icon: Trash2,
        priority: discussions.length > 0,
      },
      {
        label: "Last 7 days",
        value: recent,
        detail: "Discussions removed during the most recent seven-day window.",
        Icon: CalendarClock,
      },
      {
        label: "Reason recorded",
        value: withReason,
        detail: "Recoveries with a documented deletion reason to review.",
        Icon: FileSearch,
      },
      {
        label: "Admin removals",
        value: adminDeleted,
        detail: "Items where the recorded deleting profile is an Admin.",
        Icon: ShieldAlert,
      },
    ];
  }, [discussions, profiles]);

  function clearFilters() {
    setSearchQuery("");
    setTopicFilter("all");
    setReasonFilter("all");
    setDeletorFilter("all");
  }

  function selectDiscussion(discussionId: string) {
    setSelectedDiscussionId(discussionId);
    setCopiedId(false);
    const url = new URL(window.location.href);
    url.searchParams.set("discussion", discussionId);
    window.history.replaceState({}, "", url);
  }

  async function copyDiscussionId() {
    if (!selectedDiscussion) return;

    try {
      await navigator.clipboard.writeText(selectedDiscussion.id);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      setMessage("Unable to copy the discussion ID.");
    }
  }

  async function restoreDiscussion(discussion: DeletedDiscussion) {
    if (restoringId) return;

    const confirmed = window.confirm(
      `Restore “${discussion.title}” to public visibility? Review the content and deletion context before continuing.`
    );

    if (!confirmed) return;

    setMessage("");
    setRestoringId(discussion.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted";
        return;
      }

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "restore_discussion",
          discussionId: discussion.id,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fdeleted";
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to restore discussion.");
        return;
      }

      setDiscussions((current) => current.filter((item) => item.id !== discussion.id));
      setMessage("Discussion restored to public visibility.");

      const url = new URL(window.location.href);
      url.searchParams.delete("discussion");
      window.history.replaceState({}, "", url);
    } catch {
      setMessage("Unable to restore discussion.");
    } finally {
      setRestoringId(null);
    }
  }

  if (!authChecked || loading) {
    return (
      <main className="deleted-v2-page">
        <section className="deleted-v2-state-card" aria-live="polite">
          <Loader2 className="deleted-v2-spinner" size={24} aria-hidden="true" />
          <div>
            <p className="deleted-v2-eyebrow">Administration</p>
            <h1>Loading recovery queue</h1>
            <p>Verifying Admin access and retrieving deleted discussions.</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="deleted-v2-page">
        <section className="deleted-v2-state-card">
          <ShieldAlert size={28} aria-hidden="true" />
          <div>
            <p className="deleted-v2-eyebrow">Admin only</p>
            <h1>Access denied</h1>
            <p>{message || "Deleted discussion recovery is available only to Admin accounts."}</p>
            <Link href="/admin">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to Admin
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const selectedAuthor = selectedDiscussion
    ? profiles[selectedDiscussion.user_id]
    : undefined;
  const selectedDeletedBy = selectedDiscussion?.deleted_by
    ? profiles[selectedDiscussion.deleted_by]
    : undefined;
  const selectedIsSelfDeletion = Boolean(
    selectedDiscussion?.deleted_by &&
      selectedDiscussion.deleted_by === selectedDiscussion.user_id
  );

  return (
    <main className="deleted-v2-page">
      <div className="deleted-v2-shell">
        <section className="deleted-v2-hero">
          <div>
            <Link href="/admin" className="deleted-v2-back-link">
              <ArrowLeft size={15} aria-hidden="true" />
              Back to Admin
            </Link>
            <p className="deleted-v2-eyebrow">Recovery operations</p>
            <h1>Deleted discussions</h1>
            <p>
              Review soft-deleted discussions, confirm the original removal context,
              and restore content only when returning it to public visibility is justified.
            </p>
          </div>

          <div className="deleted-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadDeletedDiscussions(true)}
              disabled={refreshing}
            >
              <RefreshCw
                className={refreshing ? "deleted-v2-spinner" : undefined}
                size={16}
                aria-hidden="true"
              />
              {refreshing ? "Refreshing" : "Refresh queue"}
            </button>
            <Link href="/admin/deleted-replies">
              <MessageSquareText size={16} aria-hidden="true" />
              Deleted replies
            </Link>
          </div>
        </section>

        <section className="deleted-v2-metrics" aria-label="Recovery queue metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article
              key={label}
              className={`deleted-v2-metric${priority ? " is-priority" : ""}`}
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
          <div className="deleted-v2-notice" role="status">
            {message.includes("restored") ? (
              <CheckCircle2 size={18} aria-hidden="true" />
            ) : (
              <AlertTriangle size={18} aria-hidden="true" />
            )}
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="deleted-v2-toolbar" aria-label="Deleted discussion filters">
          <label className="deleted-v2-search">
            <Search size={17} aria-hidden="true" />
            <span className="sr-only">Search deleted discussions</span>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search title, body, member, reason, or ID"
            />
          </label>

          <div className="deleted-v2-filter-row">
            <label>
              <span>Topic</span>
              <select value={topicFilter} onChange={(event) => setTopicFilter(event.target.value)}>
                <option value="all">All topics</option>
                {topics.map((topic) => (
                  <option key={topic} value={topic}>
                    {topic}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Deletion reason</span>
              <select value={reasonFilter} onChange={(event) => setReasonFilter(event.target.value)}>
                <option value="all">All records</option>
                <option value="with_reason">Reason recorded</option>
                <option value="without_reason">Reason missing</option>
              </select>
            </label>

            <label>
              <span>Removed by</span>
              <select value={deletorFilter} onChange={(event) => setDeletorFilter(event.target.value)}>
                <option value="all">Any profile</option>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>

            <button type="button" onClick={clearFilters}>
              <RotateCcw size={15} aria-hidden="true" />
              Clear filters
            </button>
          </div>
        </section>

        <section className="deleted-v2-workspace">
          <aside className="deleted-v2-queue" aria-label="Deleted discussions queue">
            <header className="deleted-v2-queue-heading">
              <div>
                <p className="deleted-v2-eyebrow">Recovery queue</p>
                <h2>Deleted discussions</h2>
              </div>
              <span>{visibleDiscussions.length}</span>
            </header>

            {visibleDiscussions.length ? (
              <div className="deleted-v2-queue-list">
                {visibleDiscussions.map((discussion) => {
                  const author = profiles[discussion.user_id];
                  const isSelected = discussion.id === selectedDiscussionId;

                  return (
                    <button
                      key={discussion.id}
                      type="button"
                      className={isSelected ? "is-selected" : undefined}
                      onClick={() => selectDiscussion(discussion.id)}
                    >
                      <div className="deleted-v2-queue-top">
                        <span className="deleted-v2-badge is-danger">Deleted</span>
                        <time dateTime={discussion.deleted_at ?? undefined}>
                          {formatRelativeTime(discussion.deleted_at)}
                        </time>
                      </div>
                      <h3>{discussion.title || "Untitled discussion"}</h3>
                      <p>{discussion.body || "No discussion body recorded."}</p>
                      <div className="deleted-v2-queue-meta">
                        <span>
                          <FileSearch size={12} aria-hidden="true" />
                          {discussion.topic || "No topic"}
                        </span>
                        <span>
                          <UserRound size={12} aria-hidden="true" />
                          {getProfileName(author)}
                        </span>
                      </div>
                      <ChevronRight className="deleted-v2-chevron" size={17} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="deleted-v2-empty">
                <CheckCircle2 size={24} aria-hidden="true" />
                <h3>{discussions.length ? "No matching discussions" : "Recovery queue is clear"}</h3>
                <p>
                  {discussions.length
                    ? "Adjust or clear the filters to review more deleted discussions."
                    : "Soft-deleted discussions will appear here until they are restored."}
                </p>
                {discussions.length ? (
                  <button type="button" onClick={clearFilters}>
                    Clear filters
                  </button>
                ) : null}
              </div>
            )}
          </aside>

          <article className="deleted-v2-detail">
            {selectedDiscussion ? (
              <>
                <header className="deleted-v2-detail-header">
                  <div>
                    <div className="deleted-v2-badge-row">
                      <span className="deleted-v2-badge is-danger">Deleted</span>
                      <span className="deleted-v2-badge is-muted">
                        {selectedDiscussion.topic || "No topic"}
                      </span>
                      {selectedIsSelfDeletion ? (
                        <span className="deleted-v2-badge is-warning">Self-deleted</span>
                      ) : null}
                    </div>
                    <h2>{selectedDiscussion.title || "Untitled discussion"}</h2>
                    <p>
                      Deleted {formatDateTime(selectedDiscussion.deleted_at)} · Created {formatDateTime(selectedDiscussion.created_at)}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="deleted-v2-restore-button"
                    onClick={() => void restoreDiscussion(selectedDiscussion)}
                    disabled={Boolean(restoringId)}
                  >
                    {restoringId === selectedDiscussion.id ? (
                      <Loader2 className="deleted-v2-spinner" size={16} aria-hidden="true" />
                    ) : (
                      <RotateCcw size={16} aria-hidden="true" />
                    )}
                    {restoringId === selectedDiscussion.id ? "Restoring" : "Restore discussion"}
                  </button>
                </header>

                <div className="deleted-v2-detail-body">
                  <section className="deleted-v2-warning-card">
                    <AlertTriangle size={20} aria-hidden="true" />
                    <div>
                      <h3>Restoration returns this discussion to public visibility</h3>
                      <p>
                        Confirm that the original deletion was mistaken or no longer necessary.
                        The existing moderation action will clear the deletion timestamp, deleting
                        profile, and deletion reason, then record a restoration audit event.
                      </p>
                    </div>
                  </section>

                  <section className="deleted-v2-content-card">
                    <div className="deleted-v2-section-heading">
                      <div>
                        <p className="deleted-v2-eyebrow">Discussion content</p>
                        <h3>Original body</h3>
                      </div>
                      <span>{getWordCount(selectedDiscussion.body)} words</span>
                    </div>
                    <p className="deleted-v2-content-body">
                      {selectedDiscussion.body || "No discussion body was recorded."}
                    </p>
                  </section>

                  <div className="deleted-v2-context-grid">
                    <section className="deleted-v2-context-card">
                      <div className="deleted-v2-section-heading">
                        <div>
                          <p className="deleted-v2-eyebrow">Author</p>
                          <h3>Member context</h3>
                        </div>
                        <UsersRound size={18} aria-hidden="true" />
                      </div>

                      <div className="deleted-v2-profile-row">
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
                          <dd>{selectedDiscussion.user_id}</dd>
                        </div>
                      </dl>

                      <div className="deleted-v2-link-row">
                        <Link href={`/admin/users?member=${encodeURIComponent(selectedDiscussion.user_id)}`}>
                          Review member
                        </Link>
                        {selectedAuthor?.username ? (
                          <Link href={`/u/${encodeURIComponent(selectedAuthor.username)}`}>
                            Public profile
                          </Link>
                        ) : null}
                      </div>
                    </section>

                    <section className="deleted-v2-context-card">
                      <div className="deleted-v2-section-heading">
                        <div>
                          <p className="deleted-v2-eyebrow">Removal record</p>
                          <h3>Deletion context</h3>
                        </div>
                        <Trash2 size={18} aria-hidden="true" />
                      </div>

                      <div className="deleted-v2-profile-row">
                        <ProfileAvatar profile={selectedDeletedBy} size="md" />
                        <div>
                          <strong>
                            {selectedDiscussion.deleted_by
                              ? getProfileName(selectedDeletedBy, "Unknown deleting profile")
                              : "No deleting profile recorded"}
                          </strong>
                          <span>
                            {selectedDiscussion.deleted_by
                              ? getProfileHandle(selectedDeletedBy)
                              : "Deletion actor unavailable"}
                          </span>
                        </div>
                      </div>

                      <dl>
                        <div>
                          <dt>Deleted at</dt>
                          <dd>{formatDateTime(selectedDiscussion.deleted_at)}</dd>
                        </div>
                        <div>
                          <dt>Deleted by</dt>
                          <dd>{selectedDiscussion.deleted_by ?? "Not recorded"}</dd>
                        </div>
                        <div>
                          <dt>Reason</dt>
                          <dd>{selectedDiscussion.deletion_reason?.trim() || "No reason recorded"}</dd>
                        </div>
                      </dl>
                    </section>
                  </div>

                  <section className="deleted-v2-record-card">
                    <div className="deleted-v2-section-heading">
                      <div>
                        <p className="deleted-v2-eyebrow">Recovery record</p>
                        <h3>Identifiers and audit context</h3>
                      </div>
                      <Clock3 size={18} aria-hidden="true" />
                    </div>

                    <dl>
                      <div>
                        <dt>Discussion ID</dt>
                        <dd>{selectedDiscussion.id}</dd>
                      </div>
                      <div>
                        <dt>Created</dt>
                        <dd>{formatDateTime(selectedDiscussion.created_at)}</dd>
                      </div>
                      <div>
                        <dt>Last updated</dt>
                        <dd>{formatDateTime(selectedDiscussion.updated_at)}</dd>
                      </div>
                      <div>
                        <dt>Current Admin</dt>
                        <dd>{currentAdminId}</dd>
                      </div>
                    </dl>

                    <div className="deleted-v2-link-row">
                      <button type="button" onClick={() => void copyDiscussionId()}>
                        <Clipboard size={14} aria-hidden="true" />
                        {copiedId ? "Copied" : "Copy discussion ID"}
                      </button>
                      <Link href={`/admin/audit?search=${encodeURIComponent(selectedDiscussion.id)}`}>
                        Open audit context
                      </Link>
                      <Link href="/admin/reports">Open reports</Link>
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <div className="deleted-v2-empty deleted-v2-empty-detail">
                <Filter size={26} aria-hidden="true" />
                <h3>Select a deleted discussion</h3>
                <p>Choose an item from the recovery queue to review its content and deletion context.</p>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
