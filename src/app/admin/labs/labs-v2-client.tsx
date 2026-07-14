"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Beaker,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  ExternalLink,
  FlaskConical,
  Gauge,
  Loader2,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  Vote,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ProfileAvatar,
  getProfileDisplayName,
} from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

const LABS_STATUSES = [
  "submitted",
  "reviewing",
  "planned",
  "shipped",
  "declined",
] as const;

type LabsStatus = (typeof LABS_STATUSES)[number];
type StatusFilter = "all" | LabsStatus;
type AccessFilter = "all" | "free" | "premium" | "premium_plus" | "admin";
type AccountFilter = "all" | "active" | "restricted" | "unknown";
type SortMode = "newest" | "oldest" | "votes";

type ProfileContext = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type EntitlementContext = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  updated_at: string | null;
};

type LabsRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: LabsStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  requester: ProfileContext | null;
  reviewer: ProfileContext | null;
  entitlement: EntitlementContext | null;
  labs_access: Exclude<AccessFilter, "all">;
};

type LabsResponse = {
  currentAdminId?: string;
  generatedAt?: string;
  requests?: LabsRequest[];
  request?: LabsRequest;
  error?: string;
  code?: string;
};

const STATUS_LABELS: Record<LabsStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const ACCESS_LABELS: Record<Exclude<AccessFilter, "all">, string> = {
  free: "Free",
  premium: "Premium",
  premium_plus: "Premium Plus",
  admin: "Admin",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatRelativeTime(value: string | null | undefined) {
  if (!value) return "No timestamp";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No timestamp";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value);
}

function getAccountStanding(profile: ProfileContext | null) {
  const status = profile?.account_status?.trim().toLowerCase();
  if (!status) return { label: "Unknown", className: "is-neutral" };
  if (status === "active") return { label: "Active", className: "is-good" };
  return {
    label: status.replaceAll("_", " "),
    className: "is-danger",
  };
}

function matchesAccountFilter(
  profile: ProfileContext | null,
  filter: AccountFilter
) {
  if (filter === "all") return true;
  const status = profile?.account_status?.trim().toLowerCase();
  if (filter === "unknown") return !status;
  if (filter === "active") return status === "active";
  return Boolean(status && status !== "active");
}

function statusClass(status: LabsStatus) {
  return `admin-labs-v2-status is-${status}`;
}

function selectedRequestHref(requestId: string) {
  return `/admin/labs?request=${encodeURIComponent(requestId)}`;
}

export default function AdminLabsV2Client() {
  const [requests, setRequests] = useState<LabsRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("all");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [statusDraft, setStatusDraft] = useState<LabsStatus>("submitted");
  const [noteDraft, setNoteDraft] = useState("");
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [working, setWorking] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const loadRequests = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");
    setMessageIsError(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=/admin/labs";
        return;
      }

      const response = await fetch("/api/admin/labs/requests", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = (await response.json().catch(() => ({}))) as LabsResponse;

      if (response.status === 401) {
        window.location.href = "/login?next=/admin/labs";
        return;
      }

      if (response.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to load Labs operations.");
      }

      const loadedRequests = Array.isArray(result.requests) ? result.requests : [];
      setRequests(loadedRequests);
      setGeneratedAt(result.generatedAt ?? null);
      setAccessDenied(false);

      setSelectedRequestId((current) => {
        const requestedId = new URLSearchParams(window.location.search).get(
          "request"
        );
        if (requestedId && loadedRequests.some((item) => item.id === requestedId)) {
          return requestedId;
        }
        if (current && loadedRequests.some((item) => item.id === current)) {
          return current;
        }
        return loadedRequests[0]?.id ?? null;
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load Labs operations."
      );
      setMessageIsError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests(false);
  }, [loadRequests]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (selectedRequestId) url.searchParams.set("request", selectedRequestId);
    else url.searchParams.delete("request");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, [selectedRequestId]);

  const filteredRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (accessFilter !== "all" && request.labs_access !== accessFilter) return false;
      if (!matchesAccountFilter(request.requester, accountFilter)) return false;

      if (!normalizedQuery) return true;

      return [
        request.title,
        request.description,
        request.admin_note ?? "",
        request.id,
        request.user_id,
        request.requester?.username ?? "",
        request.requester?.full_name ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "votes") {
        return (
          right.vote_count - left.vote_count ||
          new Date(right.created_at).getTime() -
            new Date(left.created_at).getTime()
        );
      }

      if (sortMode === "oldest") {
        return (
          new Date(left.created_at).getTime() -
          new Date(right.created_at).getTime()
        );
      }

      return (
        new Date(right.created_at).getTime() -
        new Date(left.created_at).getTime()
      );
    });
  }, [
    accessFilter,
    accountFilter,
    requests,
    searchQuery,
    sortMode,
    statusFilter,
  ]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );

  useEffect(() => {
    if (!selectedRequest) return;
    setStatusDraft(selectedRequest.status);
    setNoteDraft(selectedRequest.admin_note ?? "");
  }, [selectedRequest]);

  const metrics = useMemo(() => {
    return requests.reduce(
      (result, request) => {
        result.total += 1;
        result.votes += request.vote_count;
        result[request.status] += 1;
        return result;
      },
      {
        total: 0,
        votes: 0,
        submitted: 0,
        reviewing: 0,
        planned: 0,
        shipped: 0,
        declined: 0,
      }
    );
  }, [requests]);

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setAccessFilter("all");
    setAccountFilter("all");
    setSortMode("newest");
  }

  async function saveReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRequest || working) return;

    setWorking(true);
    setMessage("");
    setMessageIsError(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=/admin/labs";
        return;
      }

      const response = await fetch("/api/admin/labs/requests", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: statusDraft,
          adminNote: noteDraft,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as LabsResponse;

      if (!response.ok || !result.request) {
        throw new Error(result.error ?? "Unable to update the Labs request.");
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === result.request?.id ? result.request : request
        )
      );
      setMessage("Labs request review saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update the Labs request."
      );
      setMessageIsError(true);
    } finally {
      setWorking(false);
    }
  }

  async function deleteRequest() {
    if (!selectedRequest || working) return;

    const confirmed = window.confirm(
      `Permanently delete “${selectedRequest.title}”? This removes the request and its votes and cannot be undone.`
    );
    if (!confirmed) return;

    setWorking(true);
    setMessage("");
    setMessageIsError(false);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=/admin/labs";
        return;
      }

      const response = await fetch("/api/admin/labs/requests", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId: selectedRequest.id }),
      });
      const result = (await response.json().catch(() => ({}))) as LabsResponse;

      if (!response.ok) {
        throw new Error(result.error ?? "Unable to delete the Labs request.");
      }

      const remaining = requests.filter(
        (request) => request.id !== selectedRequest.id
      );
      setRequests(remaining);
      setSelectedRequestId(remaining[0]?.id ?? null);
      setMessage("Labs request permanently deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to delete the Labs request."
      );
      setMessageIsError(true);
    } finally {
      setWorking(false);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
      setMessageIsError(false);
    } catch {
      setMessage(`Unable to copy ${label.toLowerCase()}.`);
      setMessageIsError(true);
    }
  }

  if (loading) {
    return (
      <main className="admin-labs-v2-page">
        <section className="admin-labs-v2-state">
          <Loader2 aria-hidden="true" className="is-spinning" />
          <p className="admin-labs-v2-eyebrow">Labs Operations</p>
          <h1>Loading the request queue…</h1>
          <p>Verifying Admin access and assembling member, vote, and review context.</p>
        </section>
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="admin-labs-v2-page">
        <section className="admin-labs-v2-state">
          <ShieldCheck aria-hidden="true" />
          <p className="admin-labs-v2-eyebrow">Admin only</p>
          <h1>Access denied.</h1>
          <p>Labs Operations is available only to active Admin accounts.</p>
          <Link href="/" className="admin-labs-v2-primary-action">
            Return home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-labs-v2-page">
      <div className="admin-labs-v2-shell">
        <nav className="admin-labs-v2-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/admin">
            <ArrowLeft aria-hidden="true" />
            Admin
          </Link>
          <ChevronRight aria-hidden="true" />
          <span>Labs Operations</span>
        </nav>

        <header className="admin-labs-v2-hero">
          <div>
            <p className="admin-labs-v2-eyebrow">Admin Labs Operations</p>
            <h1>Turn member requests into accountable product decisions.</h1>
            <p>
              Review the existing Loombus Labs request workflow, member access,
              votes, statuses, and Admin notes without inventing unsupported
              experiments or rollout controls.
            </p>
          </div>
          <div className="admin-labs-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadRequests(true)}
              disabled={refreshing}
              className="admin-labs-v2-primary-action"
            >
              <RefreshCw
                aria-hidden="true"
                className={refreshing ? "is-spinning" : undefined}
              />
              {refreshing ? "Refreshing" : "Refresh queue"}
            </button>
            <Link href="/labs" className="admin-labs-v2-secondary-action">
              <ExternalLink aria-hidden="true" />
              Open public Labs
            </Link>
          </div>
        </header>

        <div className="admin-labs-v2-link-row" aria-label="Admin destinations">
          <Link href="/admin/users">Members</Link>
          <Link href="/admin/ai-access">AI Access</Link>
          <Link href="/admin/topic-memory">Topic Memory</Link>
          <Link href="/admin/audit?search=labs.">Audit</Link>
          <Link href="/admin/health">Health</Link>
        </div>

        <section className="admin-labs-v2-metrics" aria-label="Labs request metrics">
          <article>
            <span className="admin-labs-v2-metric-icon is-submitted">
              <Beaker aria-hidden="true" />
            </span>
            <div>
              <span>Submitted</span>
              <strong>{metrics.submitted}</strong>
              <small>{metrics.total} total requests</small>
            </div>
          </article>
          <article>
            <span className="admin-labs-v2-metric-icon is-reviewing">
              <Gauge aria-hidden="true" />
            </span>
            <div>
              <span>Active review</span>
              <strong>{metrics.reviewing + metrics.planned}</strong>
              <small>{metrics.planned} planned</small>
            </div>
          </article>
          <article>
            <span className="admin-labs-v2-metric-icon is-shipped">
              <CheckCircle2 aria-hidden="true" />
            </span>
            <div>
              <span>Shipped</span>
              <strong>{metrics.shipped}</strong>
              <small>{metrics.declined} declined</small>
            </div>
          </article>
          <article>
            <span className="admin-labs-v2-metric-icon is-votes">
              <Vote aria-hidden="true" />
            </span>
            <div>
              <span>Total votes</span>
              <strong>{metrics.votes}</strong>
              <small>Across the current queue</small>
            </div>
          </article>
        </section>

        {message && (
          <div
            className={`admin-labs-v2-notice${messageIsError ? " is-error" : ""}`}
            role={messageIsError ? "alert" : "status"}
          >
            {messageIsError ? (
              <AlertTriangle aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            <span>{message}</span>
          </div>
        )}

        <section className="admin-labs-v2-workspace">
          <aside className="admin-labs-v2-queue-panel">
            <div className="admin-labs-v2-panel-heading">
              <div>
                <p className="admin-labs-v2-eyebrow">Request queue</p>
                <h2>Product signals</h2>
              </div>
              <span>{filteredRequests.length}</span>
            </div>

            <div className="admin-labs-v2-filters">
              <label className="admin-labs-v2-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Search Labs requests</span>
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search title, member, note, or ID"
                />
              </label>

              <div className="admin-labs-v2-filter-grid">
                <label>
                  <span>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as StatusFilter)
                    }
                  >
                    <option value="all">All statuses</option>
                    {LABS_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {STATUS_LABELS[status]}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Labs access</span>
                  <select
                    value={accessFilter}
                    onChange={(event) =>
                      setAccessFilter(event.target.value as AccessFilter)
                    }
                  >
                    <option value="all">All access</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="premium_plus">Premium Plus</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <label>
                  <span>Account</span>
                  <select
                    value={accountFilter}
                    onChange={(event) =>
                      setAccountFilter(event.target.value as AccountFilter)
                    }
                  >
                    <option value="all">All accounts</option>
                    <option value="active">Active</option>
                    <option value="restricted">Restricted</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>

                <label>
                  <span>Order</span>
                  <select
                    value={sortMode}
                    onChange={(event) =>
                      setSortMode(event.target.value as SortMode)
                    }
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="votes">Most votes</option>
                  </select>
                </label>
              </div>

              <button
                type="button"
                onClick={clearFilters}
                className="admin-labs-v2-clear"
              >
                Clear filters
              </button>
            </div>

            <div className="admin-labs-v2-queue" role="list">
              {filteredRequests.length === 0 ? (
                <div className="admin-labs-v2-empty">
                  <FlaskConical aria-hidden="true" />
                  <strong>No requests match these filters.</strong>
                  <span>Clear filters or refresh the queue.</span>
                </div>
              ) : (
                filteredRequests.map((request) => {
                  const accountStanding = getAccountStanding(request.requester);
                  return (
                    <button
                      key={request.id}
                      type="button"
                      role="listitem"
                      onClick={() => setSelectedRequestId(request.id)}
                      className={`admin-labs-v2-queue-item${
                        selectedRequestId === request.id ? " is-selected" : ""
                      }`}
                    >
                      <div className="admin-labs-v2-queue-item-topline">
                        <span className={statusClass(request.status)}>
                          {STATUS_LABELS[request.status]}
                        </span>
                        <span className="admin-labs-v2-vote-count">
                          <Vote aria-hidden="true" />
                          {request.vote_count}
                        </span>
                      </div>
                      <strong>{request.title}</strong>
                      <span className="admin-labs-v2-requester-line">
                        {getProfileDisplayName(request.requester)}
                        {request.requester?.username
                          ? ` · @${request.requester.username}`
                          : ""}
                      </span>
                      <div className="admin-labs-v2-queue-meta">
                        <span>{formatRelativeTime(request.created_at)}</span>
                        <span className={`admin-labs-v2-inline-state ${accountStanding.className}`}>
                          {accountStanding.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <p className="admin-labs-v2-generated">
              {generatedAt
                ? `Generated ${formatDateTime(generatedAt)}`
                : "Generation time unavailable"}
            </p>
          </aside>

          <section className="admin-labs-v2-detail-panel">
            {!selectedRequest ? (
              <div className="admin-labs-v2-empty is-detail">
                <Sparkles aria-hidden="true" />
                <strong>Select a Labs request.</strong>
                <span>Choose a queue item to review its full operational context.</span>
              </div>
            ) : (
              <>
                <header className="admin-labs-v2-detail-heading">
                  <div>
                    <p className="admin-labs-v2-eyebrow">Selected Labs request</p>
                    <h2>{selectedRequest.title}</h2>
                    <span>
                      Submitted {formatDateTime(selectedRequest.created_at)} · Updated{" "}
                      {formatRelativeTime(selectedRequest.updated_at)}
                    </span>
                  </div>
                  <span className={statusClass(selectedRequest.status)}>
                    {STATUS_LABELS[selectedRequest.status]}
                  </span>
                </header>

                <div className="admin-labs-v2-description-card">
                  <h3>Member proposal</h3>
                  <p>{selectedRequest.description}</p>
                </div>

                <section className="admin-labs-v2-context-section">
                  <div className="admin-labs-v2-section-heading">
                    <UserRound aria-hidden="true" />
                    <div>
                      <h3>Member and access context</h3>
                      <p>Minimum operational context for this request.</p>
                    </div>
                  </div>

                  <div className="admin-labs-v2-member-card">
                    <div className="admin-labs-v2-member-identity">
                      <ProfileAvatar profile={selectedRequest.requester} size="lg" />
                      <div>
                        <strong>
                          {getProfileDisplayName(selectedRequest.requester)}
                        </strong>
                        <span>
                          {selectedRequest.requester?.username
                            ? `@${selectedRequest.requester.username}`
                            : selectedRequest.user_id}
                        </span>
                      </div>
                    </div>
                    <div className="admin-labs-v2-member-badges">
                      <span className="admin-labs-v2-access-badge">
                        {ACCESS_LABELS[selectedRequest.labs_access]}
                      </span>
                      <span
                        className={`admin-labs-v2-inline-state ${
                          getAccountStanding(selectedRequest.requester).className
                        }`}
                      >
                        {getAccountStanding(selectedRequest.requester).label}
                      </span>
                    </div>
                  </div>

                  {selectedRequest.requester?.enforcement_reason && (
                    <div className="admin-labs-v2-warning-card">
                      <AlertTriangle aria-hidden="true" />
                      <div>
                        <strong>Account enforcement context</strong>
                        <span>{selectedRequest.requester.enforcement_reason}</span>
                        {selectedRequest.requester.suspended_until && (
                          <small>
                            Until {formatDateTime(selectedRequest.requester.suspended_until)}
                          </small>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="admin-labs-v2-action-links">
                    <Link href={`/admin/users?user=${selectedRequest.user_id}`}>
                      Member Operations
                    </Link>
                    <Link href={`/admin/ai-access?member=${selectedRequest.user_id}`}>
                      AI Access
                    </Link>
                    {selectedRequest.requester?.username && (
                      <Link href={`/u/${selectedRequest.requester.username}`}>
                        Public profile
                      </Link>
                    )}
                    <Link href="/admin/audit?search=labs.">Labs audit events</Link>
                  </div>
                </section>

                <form onSubmit={saveReview} className="admin-labs-v2-review-form">
                  <div className="admin-labs-v2-section-heading">
                    <ShieldCheck aria-hidden="true" />
                    <div>
                      <h3>Review decision</h3>
                      <p>Update only the supported status and member-visible Admin note.</p>
                    </div>
                  </div>

                  <label>
                    <span>Status</span>
                    <select
                      value={statusDraft}
                      onChange={(event) =>
                        setStatusDraft(event.target.value as LabsStatus)
                      }
                      disabled={working}
                    >
                      {LABS_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABELS[status]}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    <span>Admin note</span>
                    <textarea
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      maxLength={2000}
                      rows={6}
                      disabled={working}
                      placeholder="Explain the decision, next step, or shipped outcome for the member."
                    />
                    <small>{noteDraft.length}/2000 characters</small>
                  </label>

                  <div className="admin-labs-v2-review-actions">
                    <button
                      type="submit"
                      disabled={working}
                      className="admin-labs-v2-primary-action"
                    >
                      {working ? (
                        <Loader2 aria-hidden="true" className="is-spinning" />
                      ) : (
                        <Save aria-hidden="true" />
                      )}
                      {working ? "Saving" : "Save review"}
                    </button>
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => void deleteRequest()}
                      className="admin-labs-v2-danger-action"
                    >
                      <Trash2 aria-hidden="true" />
                      Permanently delete
                    </button>
                  </div>

                  <p className="admin-labs-v2-reviewer-line">
                    {selectedRequest.reviewed_at
                      ? `Last reviewed ${formatDateTime(selectedRequest.reviewed_at)}`
                      : "Not yet reviewed"}
                    {selectedRequest.reviewer
                      ? ` by ${getProfileDisplayName(selectedRequest.reviewer)}`
                      : ""}
                  </p>
                </form>

                <section className="admin-labs-v2-record-section">
                  <div className="admin-labs-v2-section-heading">
                    <Clipboard aria-hidden="true" />
                    <div>
                      <h3>Record context</h3>
                      <p>Identifiers, timestamps, and vote signal.</p>
                    </div>
                  </div>

                  <div className="admin-labs-v2-data-grid">
                    <div>
                      <span>Votes</span>
                      <strong>{selectedRequest.vote_count}</strong>
                    </div>
                    <div>
                      <span>Labs access</span>
                      <strong>{ACCESS_LABELS[selectedRequest.labs_access]}</strong>
                    </div>
                    <div>
                      <span>Created</span>
                      <strong>{formatDateTime(selectedRequest.created_at)}</strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>{formatDateTime(selectedRequest.updated_at)}</strong>
                    </div>
                  </div>

                  <div className="admin-labs-v2-copy-grid">
                    <button
                      type="button"
                      onClick={() => void copyValue(selectedRequest.id, "Request ID")}
                    >
                      <span>Request ID</span>
                      <strong>{selectedRequest.id}</strong>
                      <Clipboard aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void copyValue(selectedRequest.user_id, "Member ID")}
                    >
                      <span>Member ID</span>
                      <strong>{selectedRequest.user_id}</strong>
                      <Clipboard aria-hidden="true" />
                    </button>
                  </div>

                  <Link
                    href={selectedRequestHref(selectedRequest.id)}
                    className="admin-labs-v2-deep-link"
                  >
                    Copyable selected-request view
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </section>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
