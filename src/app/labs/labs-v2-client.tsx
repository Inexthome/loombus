"use client";

import Link from "next/link";
import {
  ArrowRight,
  Beaker,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Gauge,
  Lightbulb,
  LifeBuoy,
  LockKeyhole,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type LabsFeatureRequestStatus =
  | "submitted"
  | "reviewing"
  | "planned"
  | "shipped"
  | "declined";

type LabsFeatureRequest = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: LabsFeatureRequestStatus;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  voted_by_me: boolean;
};

type LabsRequestRow = Omit<LabsFeatureRequest, "vote_count" | "voted_by_me">;

type Entitlement = {
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
};

type ProfileAccount = {
  is_admin: boolean | null;
};

type FilterStatus = "all" | LabsFeatureRequestStatus;
type SortMode = "newest" | "votes" | "status";
type PlanKey = "signed_out" | "free" | "premium" | "premium_plus" | "admin";

const STATUS_LABELS: Record<LabsFeatureRequestStatus, string> = {
  submitted: "Submitted",
  reviewing: "Reviewing",
  planned: "Planned",
  shipped: "Shipped",
  declined: "Declined",
};

const STATUS_ORDER: Record<LabsFeatureRequestStatus, number> = {
  planned: 0,
  reviewing: 1,
  submitted: 2,
  shipped: 3,
  declined: 4,
};

const FILTER_OPTIONS: { value: FilterStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewing", label: "Reviewing" },
  { value: "planned", label: "Planned" },
  { value: "shipped", label: "Shipped" },
  { value: "declined", label: "Declined" },
];

const PROGRAM_ITEMS: {
  title: string;
  description: string;
  Icon: LucideIcon;
  access: "member" | "premium_plus" | "admin" | "registry";
}[] = [
  {
    title: "Request board",
    description: "Signed-in members can review the Labs request workflow and its current statuses.",
    Icon: Lightbulb,
    access: "member",
  },
  {
    title: "Feature submissions",
    description: "Signed-in members can submit a concrete problem and proposed platform improvement.",
    Icon: MessageSquarePlus,
    access: "member",
  },
  {
    title: "Labs voting",
    description: "Premium Plus and Admin accounts can add or remove one vote per request.",
    Icon: ThumbsUp,
    access: "premium_plus",
  },
  {
    title: "Admin review queue",
    description: "Admins can move requests through review, planning, shipment, or decline states.",
    Icon: ShieldCheck,
    access: "admin",
  },
];

function getPlanKey(
  entitlement: Entitlement | null,
  isAdmin: boolean,
  signedIn: boolean
): PlanKey {
  if (!signedIn) return "signed_out";
  if (isAdmin || entitlement?.tier === "admin") return "admin";
  if (!entitlement?.ai_assisted_enabled) return "free";
  if (
    entitlement.tier === "premium_plus" ||
    (entitlement.tier === "premium" &&
      (entitlement.monthly_summary_limit ?? 0) > 50)
  ) {
    return "premium_plus";
  }
  if (entitlement.tier === "premium") return "premium";
  return "free";
}

function getPlanLabel(plan: PlanKey) {
  if (plan === "signed_out") return "Signed out";
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  if (plan === "admin") return "Admin";
  return "Free";
}

function canVoteInLabs(plan: PlanKey) {
  return plan === "premium_plus" || plan === "admin";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function statusClass(status: LabsFeatureRequestStatus) {
  return `labs-v2-status is-${status}`;
}

function getProgramState(
  access: (typeof PROGRAM_ITEMS)[number]["access"],
  signedIn: boolean,
  canVote: boolean,
  isAdmin: boolean
) {
  if (access === "member") {
    return signedIn
      ? { label: "Available", className: "is-available" }
      : { label: "Sign-in required", className: "is-unavailable" };
  }

  if (access === "premium_plus") {
    return canVote
      ? { label: "Available", className: "is-available" }
      : { label: "Premium Plus", className: "is-limited" };
  }

  if (access === "admin") {
    return isAdmin
      ? { label: "Available", className: "is-available" }
      : { label: "Admin only", className: "is-unavailable" };
  }

  return { label: "Not published", className: "is-unavailable" };
}

function ResourceLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="labs-v2-link-card">
      <div>
        <strong>{title}</strong>
        <span>{description}</span>
      </div>
      <ChevronRight aria-hidden="true" />
    </Link>
  );
}

export default function LabsV2Client() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [requests, setRequests] = useState<LabsFeatureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [workingVoteId, setWorkingVoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  const signedIn = Boolean(currentUserId);
  const currentPlan = getPlanKey(entitlement, isAdmin, signedIn);
  const canVote = canVoteInLabs(currentPlan);

  function showMessage(nextMessage: string, isError = false) {
    setMessage(nextMessage);
    setMessageIsError(isError);
  }

  useEffect(() => {
    let mounted = true;

    async function loadLabs() {
      setLoading(true);
      setLoadError("");

      try {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const user = userData.user;
        if (!user) {
          if (mounted) {
            setCurrentUserId(null);
            setEntitlement(null);
            setIsAdmin(false);
            setRequests([]);
          }
          return;
        }

        const [profileResult, entitlementResult, requestResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", user.id)
            .maybeSingle(),
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("labs_feature_requests")
            .select(
              "id, user_id, title, description, status, admin_note, reviewed_at, created_at, updated_at"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (profileResult.error) throw profileResult.error;
        if (entitlementResult.error) throw entitlementResult.error;
        if (requestResult.error) throw requestResult.error;

        const baseRequests = (requestResult.data ?? []) as LabsRequestRow[];
        const requestIds = baseRequests.map((request) => request.id);
        let voteRows: { request_id: string; user_id: string }[] = [];

        if (requestIds.length > 0) {
          const { data: votes, error: voteError } = await supabase
            .from("labs_feature_request_votes")
            .select("request_id, user_id")
            .in("request_id", requestIds);

          if (voteError) throw voteError;
          voteRows = (votes ?? []) as { request_id: string; user_id: string }[];
        }

        const voteCounts = voteRows.reduce<Record<string, number>>(
          (counts, vote) => {
            counts[vote.request_id] = (counts[vote.request_id] ?? 0) + 1;
            return counts;
          },
          {}
        );
        const myVotes = new Set(
          voteRows
            .filter((vote) => vote.user_id === user.id)
            .map((vote) => vote.request_id)
        );

        if (!mounted) return;

        const profile = (profileResult.data ?? null) as ProfileAccount | null;
        const nextEntitlement = (entitlementResult.data ?? null) as Entitlement | null;
        setCurrentUserId(user.id);
        setIsAdmin(Boolean(profile?.is_admin || nextEntitlement?.tier === "admin"));
        setEntitlement(nextEntitlement);
        setRequests(
          baseRequests.map((request) => ({
            ...request,
            vote_count: voteCounts[request.id] ?? 0,
            voted_by_me: myVotes.has(request.id),
          }))
        );
      } catch (error) {
        console.error("Unable to load Loombus Labs.", error);
        if (mounted) {
          setLoadError(
            "Labs access and request data could not be loaded. Refresh and try again."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadLabs();
    return () => {
      mounted = false;
    };
  }, []);

  const statusCounts = useMemo(() => {
    return requests.reduce<Record<LabsFeatureRequestStatus, number>>(
      (counts, request) => {
        counts[request.status] += 1;
        return counts;
      },
      {
        submitted: 0,
        reviewing: 0,
        planned: 0,
        shipped: 0,
        declined: 0,
      }
    );
  }, [requests]);

  const myRequestCount = useMemo(
    () => requests.filter((request) => request.user_id === currentUserId).length,
    [currentUserId, requests]
  );

  const visibleRequests = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) return false;
      if (!normalizedQuery) return true;
      return [request.title, request.description, request.admin_note ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });

    return [...filtered].sort((left, right) => {
      if (sortMode === "votes") {
        return (
          right.vote_count - left.vote_count ||
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        );
      }
      if (sortMode === "status") {
        return (
          STATUS_ORDER[left.status] - STATUS_ORDER[right.status] ||
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
        );
      }
      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });
  }, [requests, searchQuery, sortMode, statusFilter]);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    showMessage("");

    if (!currentUserId) {
      window.location.href = "/login?next=/labs";
      return;
    }

    const cleanTitle = title.trim();
    const cleanDescription = description.trim();

    if (cleanTitle.length < 3) {
      showMessage("Feature request title must be at least 3 characters.", true);
      return;
    }
    if (cleanDescription.length < 10) {
      showMessage("Feature request description must be at least 10 characters.", true);
      return;
    }

    setSubmitting(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=/labs";
        return;
      }

      const response = await fetch("/api/labs/requests", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: cleanTitle,
          description: cleanDescription,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        request?: LabsRequestRow;
        error?: string;
      };

      if (!response.ok || !result.request) {
        showMessage(
          result.error ??
            "The request could not be submitted or returned an incomplete response.",
          true
        );
        return;
      }

      setRequests((current) => [
        {
          ...result.request!,
          vote_count: 0,
          voted_by_me: false,
        },
        ...current,
      ]);
      setTitle("");
      setDescription("");
      showMessage("Feature request submitted to Loombus Labs.");
    } catch {
      showMessage("Unable to submit the Labs request. Try again.", true);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleVote(requestId: string) {
    if (workingVoteId) return;
    showMessage("");

    if (!currentUserId) {
      window.location.href = "/login?next=/labs";
      return;
    }

    if (!canVote) {
      showMessage("Labs voting requires Premium Plus or Admin access.", true);
      return;
    }

    setWorkingVoteId(requestId);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=/labs";
        return;
      }

      const response = await fetch("/api/labs/requests/vote", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ requestId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        voted?: boolean;
        voteCount?: number;
        error?: string;
      };

      if (!response.ok) {
        showMessage(result.error ?? "Unable to update the Labs vote.", true);
        return;
      }

      setRequests((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                voted_by_me: Boolean(result.voted),
                vote_count:
                  typeof result.voteCount === "number"
                    ? result.voteCount
                    : request.vote_count,
              }
            : request
        )
      );
    } catch {
      showMessage("Unable to update the Labs vote. Try again.", true);
    } finally {
      setWorkingVoteId(null);
    }
  }

  if (loading) {
    return (
      <main className="labs-v2-page">
        <section className="labs-v2-state">
          <p className="labs-v2-eyebrow">Loombus Labs</p>
          <h1>Loading Labs & Early Access…</h1>
          <p>Checking account eligibility and the current request workflow.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="labs-v2-page">
      <div className="labs-v2-shell">
        <nav className="labs-v2-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight aria-hidden="true" size={14} />
          <span>Labs & Early Access</span>
        </nav>

        <header className="labs-v2-hero">
          <div>
            <p className="labs-v2-eyebrow">Labs & Early Access Center</p>
            <h1>Help shape what Loombus becomes next.</h1>
            <p className="labs-v2-hero-copy">
              Submit grounded product ideas, follow their real review status, and use
              Premium Plus voting to signal which improvements deserve stronger attention.
              Labs does not invent experiment access or feature flags that are not connected
              to the current platform.
            </p>
          </div>
          <div className="labs-v2-hero-actions">
            <Link href="/premium" className="labs-v2-primary">
              <Sparkles aria-hidden="true" />
              Review plans
            </Link>
            <Link href="/support" className="labs-v2-secondary">
              <LifeBuoy aria-hidden="true" />
              Get support
            </Link>
          </div>
        </header>

        <section className="labs-v2-metrics" aria-label="Labs account summary">
          <div className="labs-v2-metric">
            <span>Current access</span>
            <strong>{getPlanLabel(currentPlan)}</strong>
          </div>
          <div className="labs-v2-metric">
            <span>Visible requests</span>
            <strong>{signedIn ? requests.length : "Sign in"}</strong>
          </div>
          <div className="labs-v2-metric">
            <span>Your requests</span>
            <strong>{signedIn ? myRequestCount : "—"}</strong>
          </div>
          <div className="labs-v2-metric">
            <span>Voting</span>
            <strong>{canVote ? "Available" : "Premium Plus"}</strong>
          </div>
        </section>

        {loadError && <div className="labs-v2-notice is-error">{loadError}</div>}
        {message && (
          <div className={`labs-v2-notice${messageIsError ? " is-error" : ""}`}>
            {message}
          </div>
        )}

        <section className="labs-v2-program-grid" aria-label="Current Labs capabilities">
          {PROGRAM_ITEMS.map((item) => {
            const state = getProgramState(item.access, signedIn, canVote, isAdmin);
            return (
              <article key={item.title} className="labs-v2-program-card">
                <span className="labs-v2-program-icon">
                  <item.Icon aria-hidden="true" />
                </span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
                <span className={`labs-v2-program-status ${state.className}`}>
                  {state.label}
                </span>
              </article>
            );
          })}
        </section>

        <section className="labs-v2-experiment-empty">
          <span className="labs-v2-section-icon">
            <FlaskConical aria-hidden="true" />
          </span>
          <div>
            <h2>No separate experiment enrollment catalog is published here.</h2>
            <p>
              The current production Labs contract is the feature-request board, status
              workflow, Premium Plus voting, and Admin review queue. This page will not show
              invented experiments, enrollment states, rollout percentages, or feature flags.
            </p>
          </div>
        </section>

        {!signedIn ? (
          <section className="labs-v2-state">
            <LockKeyhole aria-hidden="true" />
            <h1>Sign in to enter Loombus Labs.</h1>
            <p>
              All signed-in members can submit requests and follow the current board. Premium
              Plus and Admin accounts can vote.
            </p>
            <div className="labs-v2-inline-actions">
              <Link href="/login?next=/labs" className="labs-v2-primary">
                Log in
              </Link>
              <Link href="/signup" className="labs-v2-secondary">
                Create account
              </Link>
            </div>
          </section>
        ) : (
          <>
            <div className="labs-v2-layout">
              <div className="labs-v2-main">
                <section className="labs-v2-card">
                  <div className="labs-v2-card-header">
                    <div className="labs-v2-card-header-copy">
                      <span className="labs-v2-section-icon">
                        <MessageSquarePlus aria-hidden="true" />
                      </span>
                      <div>
                        <h2>Submit a Labs request</h2>
                        <p>
                          Describe the problem, who it affects, and how the proposed change
                          would improve Signal over noise.
                        </p>
                      </div>
                    </div>
                  </div>

                  <form className="labs-v2-form" onSubmit={submitRequest}>
                    <label className="labs-v2-field">
                      Feature title
                      <input
                        className="labs-v2-input"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={160}
                        placeholder="Example: Topic-level reading queue"
                      />
                      <span className="labs-v2-character-count">{title.length}/160</span>
                    </label>

                    <label className="labs-v2-field">
                      Why should this exist?
                      <textarea
                        className="labs-v2-textarea"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={4000}
                        placeholder="Describe the problem, the members it helps, and the expected behavior."
                      />
                      <span className="labs-v2-character-count">
                        {description.length}/4000
                      </span>
                    </label>

                    <div className="labs-v2-inline-actions">
                      <button className="labs-v2-primary" type="submit" disabled={submitting}>
                        <Send aria-hidden="true" />
                        {submitting ? "Submitting…" : "Submit request"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>

              <aside className="labs-v2-aside">
                <section className="labs-v2-card">
                  <div className="labs-v2-card-header-copy">
                    <span className="labs-v2-section-icon">
                      <CircleDot aria-hidden="true" />
                    </span>
                    <div>
                      <h2>Workflow status</h2>
                      <p>Counts reflect requests visible to the current account.</p>
                    </div>
                  </div>
                  <div className="labs-v2-summary-grid" style={{ marginTop: "1rem" }}>
                    {(
                      [
                        "submitted",
                        "reviewing",
                        "planned",
                        "shipped",
                        "declined",
                      ] as LabsFeatureRequestStatus[]
                    ).map((status) => (
                      <div key={status} className="labs-v2-summary-item">
                        <span>{STATUS_LABELS[status]}</span>
                        <strong>{statusCounts[status]}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="labs-v2-card">
                  <div className="labs-v2-card-header-copy">
                    <span className="labs-v2-section-icon">
                      <Beaker aria-hidden="true" />
                    </span>
                    <div>
                      <h2>Labs resources</h2>
                      <p>Review access, usage, help, and account options.</p>
                    </div>
                  </div>
                  <div className="labs-v2-link-list" style={{ marginTop: "1rem" }}>
                    <ResourceLink
                      href="/premium"
                      title="Premium & Plans"
                      description="Review Premium Plus Labs voting access."
                    />
                    <ResourceLink
                      href="/ai-usage"
                      title="AI Usage"
                      description="Review current AI allowance and activity."
                    />
                    <ResourceLink
                      href="/support"
                      title="Support"
                      description="Report a Labs or account problem."
                    />
                    {isAdmin && (
                      <ResourceLink
                        href="/admin/labs"
                        title="Admin Labs"
                        description="Review and update request statuses."
                      />
                    )}
                  </div>
                </section>
              </aside>
            </div>

            <section className="labs-v2-board">
              <div className="labs-v2-board-header">
                <div>
                  <p className="labs-v2-eyebrow">Request board</p>
                  <h2>Current Labs requests</h2>
                  <p>
                    Search the real request workflow, filter by review state, and sort by
                    recency or member votes.
                  </p>
                </div>
                <div className="labs-v2-card-actions">
                  <span className="labs-v2-program-status is-available">
                    {visibleRequests.length} shown
                  </span>
                </div>
              </div>

              <div className="labs-v2-toolbar">
                <div style={{ position: "relative" }}>
                  <Search
                    aria-hidden="true"
                    size={16}
                    style={{
                      position: "absolute",
                      left: "0.8rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--loombus-text-subtle)",
                      pointerEvents: "none",
                    }}
                  />
                  <input
                    className="labs-v2-search"
                    style={{ paddingLeft: "2.3rem" }}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search requests and notes"
                    aria-label="Search Labs requests"
                  />
                </div>
                <select
                  className="labs-v2-select"
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as FilterStatus)
                  }
                  aria-label="Filter Labs requests by status"
                >
                  {FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="labs-v2-select"
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  aria-label="Sort Labs requests"
                >
                  <option value="newest">Newest</option>
                  <option value="votes">Most votes</option>
                  <option value="status">Workflow status</option>
                </select>
              </div>

              {visibleRequests.length === 0 ? (
                <div className="labs-v2-empty">
                  <h3>No matching Labs requests</h3>
                  <p>
                    Adjust the search or status filter, or submit the first request in this
                    view.
                  </p>
                </div>
              ) : (
                <div className="labs-v2-request-list">
                  {visibleRequests.map((request) => {
                    const isMine = request.user_id === currentUserId;
                    return (
                      <article key={request.id} className="labs-v2-request">
                        <div className="labs-v2-request-head">
                          <div>
                            <div className="labs-v2-request-title-row">
                              <h3>{request.title}</h3>
                              {isMine && (
                                <span className="labs-v2-owner-badge">Your request</span>
                              )}
                            </div>
                            <p className="labs-v2-request-meta">
                              Submitted {formatDate(request.created_at)} · {request.vote_count}{" "}
                              {request.vote_count === 1 ? "vote" : "votes"}
                            </p>
                          </div>
                          <span className={statusClass(request.status)}>
                            {STATUS_LABELS[request.status]}
                          </span>
                        </div>

                        <p className="labs-v2-request-description">
                          {request.description}
                        </p>

                        {request.admin_note && (
                          <div className="labs-v2-admin-note">
                            <strong>Loombus review note</strong>
                            <p>{request.admin_note}</p>
                          </div>
                        )}

                        <div className="labs-v2-card-actions">
                          <button
                            type="button"
                            className={`labs-v2-vote-button${
                              request.voted_by_me ? " is-voted" : ""
                            }`}
                            onClick={() => void toggleVote(request.id)}
                            disabled={!canVote || workingVoteId === request.id}
                            title={
                              canVote
                                ? "Add or remove your Labs vote"
                                : "Labs voting requires Premium Plus or Admin access"
                            }
                          >
                            {request.voted_by_me ? (
                              <CheckCircle2 aria-hidden="true" />
                            ) : (
                              <ThumbsUp aria-hidden="true" />
                            )}
                            {workingVoteId === request.id
                              ? "Updating…"
                              : request.voted_by_me
                                ? "Voted"
                                : "Vote"}
                          </button>
                          {!canVote && (
                            <span className="labs-v2-voting-note">
                              Premium Plus or Admin access is required to vote.
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
