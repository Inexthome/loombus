"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Lightbulb,
  LockKeyhole,
  MessageSquarePlus,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
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

type ProfileAccount = { is_admin: boolean | null };
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
  access: "member" | "premium_plus" | "admin";
}[] = [
  {
    title: "Request board",
    description: "Follow ideas through real review, planning, shipment, or decline states.",
    Icon: Lightbulb,
    access: "member",
  },
  {
    title: "Feature submissions",
    description: "Describe a concrete problem, who it affects, and how Loombus could improve it.",
    Icon: MessageSquarePlus,
    access: "member",
  },
  {
    title: "Member voting",
    description: "Premium Plus members can signal which requests deserve stronger attention.",
    Icon: ThumbsUp,
    access: "premium_plus",
  },
  {
    title: "Review workflow",
    description: "Loombus admins move requests through the published product-review lifecycle.",
    Icon: ShieldCheck,
    access: "admin",
  },
];

function getPlanKey(entitlement: Entitlement | null, isAdmin: boolean, signedIn: boolean): PlanKey {
  if (!signedIn) return "signed_out";
  if (isAdmin || entitlement?.tier === "admin") return "admin";
  if (!entitlement?.ai_assisted_enabled) return "free";
  if (
    entitlement.tier === "premium_plus" ||
    (entitlement.tier === "premium" && (entitlement.monthly_summary_limit ?? 0) > 50)
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
  if (access === "member") return signedIn ? "Available" : "Sign in";
  if (access === "premium_plus") return canVote ? "Available" : "Premium Plus";
  return isAdmin ? "Available" : "Admin";
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
          supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
          supabase
            .from("user_ai_entitlements")
            .select("tier, ai_assisted_enabled, monthly_summary_limit")
            .eq("user_id", user.id)
            .maybeSingle(),
          supabase
            .from("labs_feature_requests")
            .select("id, user_id, title, description, status, admin_note, reviewed_at, created_at, updated_at")
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

        const voteCounts = voteRows.reduce<Record<string, number>>((counts, vote) => {
          counts[vote.request_id] = (counts[vote.request_id] ?? 0) + 1;
          return counts;
        }, {});
        const myVotes = new Set(
          voteRows.filter((vote) => vote.user_id === user.id).map((vote) => vote.request_id)
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
        if (mounted) setLoadError("Labs data could not be loaded. Refresh and try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadLabs();
    return () => {
      mounted = false;
    };
  }, []);

  const statusCounts = useMemo(
    () =>
      requests.reduce<Record<LabsFeatureRequestStatus, number>>(
        (counts, request) => {
          counts[request.status] += 1;
          return counts;
        },
        { submitted: 0, reviewing: 0, planned: 0, shipped: 0, declined: 0 }
      ),
    [requests]
  );

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
        return right.vote_count - left.vote_count || new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
      }
      if (sortMode === "status") {
        return STATUS_ORDER[left.status] - STATUS_ORDER[right.status] || new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ title: cleanTitle, description: cleanDescription }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        request?: LabsRequestRow;
        error?: string;
      };
      if (!response.ok || !result.request) {
        showMessage(result.error ?? "The request could not be submitted.", true);
        return;
      }
      setRequests((current) => [
        { ...result.request!, vote_count: 0, voted_by_me: false },
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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
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
                vote_count: typeof result.voteCount === "number" ? result.voteCount : request.vote_count,
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
      <main className="labs-v2-page labs-v2-loading">
        <p className="labs-v2-eyebrow">Loombus Labs</p>
        <h1>Loading Labs…</h1>
      </main>
    );
  }

  return (
    <main className="labs-v2-page">
      <div className="labs-v2-shell">
        <nav className="labs-v2-breadcrumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <ChevronRight aria-hidden="true" size={14} />
          <span>Labs</span>
        </nav>

        <header className="labs-v2-hero">
          <div>
            <p className="labs-v2-eyebrow">LOOMBUS LABS</p>
            <h1>Shape what Loombus becomes next.</h1>
            <p className="labs-v2-hero-copy">
              Labs is where members propose product improvements, follow real review decisions,
              and help prioritize what deserves attention next.
            </p>
          </div>
          <div className="labs-v2-hero-actions">
            {signedIn ? (
              <a href="#submit-request" className="labs-v2-primary">
                Submit an idea <ArrowRight aria-hidden="true" />
              </a>
            ) : (
              <Link href="/login?next=/labs" className="labs-v2-primary">
                Enter Labs <ArrowRight aria-hidden="true" />
              </Link>
            )}
          </div>
        </header>

        <section className="labs-v2-metrics" aria-label="Labs account summary">
          <div className="labs-v2-metric"><span>Access</span><strong>{getPlanLabel(currentPlan)}</strong></div>
          <div className="labs-v2-metric"><span>Requests</span><strong>{signedIn ? requests.length : "—"}</strong></div>
          <div className="labs-v2-metric"><span>Your requests</span><strong>{signedIn ? myRequestCount : "—"}</strong></div>
          <div className="labs-v2-metric"><span>Voting</span><strong>{canVote ? "Available" : "Premium Plus"}</strong></div>
        </section>

        {loadError ? <div className="labs-v2-notice is-error">{loadError}</div> : null}
        {message ? <div className={`labs-v2-notice${messageIsError ? " is-error" : ""}`}>{message}</div> : null}

        <section className="labs-v2-program" aria-labelledby="labs-program-title">
          <div className="labs-v2-section-heading">
            <p className="labs-v2-eyebrow">HOW LABS WORKS</p>
            <h2 id="labs-program-title">Ideas move through a visible product workflow.</h2>
            <p>Labs only presents capabilities that exist in the current product.</p>
          </div>
          <div className="labs-v2-program-grid">
            {PROGRAM_ITEMS.map((item) => (
              <article key={item.title} className="labs-v2-program-card">
                <span className="labs-v2-program-icon"><item.Icon aria-hidden="true" /></span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </div>
                <span className="labs-v2-program-status">{getProgramState(item.access, signedIn, canVote, isAdmin)}</span>
              </article>
            ))}
          </div>
        </section>

        {!signedIn ? (
          <section className="labs-v2-state">
            <LockKeyhole aria-hidden="true" />
            <div>
              <h2>Sign in to participate in Labs.</h2>
              <p>Members can submit requests and follow the board. Premium Plus and Admin accounts can vote.</p>
            </div>
            <div className="labs-v2-inline-actions">
              <Link href="/login?next=/labs" className="labs-v2-primary">Log in</Link>
              <Link href="/signup" className="labs-v2-secondary">Create account</Link>
            </div>
          </section>
        ) : (
          <>
            <section id="submit-request" className="labs-v2-card labs-v2-submit-section">
              <div className="labs-v2-section-heading">
                <p className="labs-v2-eyebrow">SUBMIT AN IDEA</p>
                <h2>Start with the problem, not the feature.</h2>
                <p>Explain what is difficult today, who it affects, and what better behavior would look like.</p>
              </div>
              <form className="labs-v2-form" onSubmit={submitRequest}>
                <label className="labs-v2-field">
                  <span>Feature title</span>
                  <input
                    className="labs-v2-input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={160}
                    placeholder="Example: Topic-level reading queue"
                  />
                  <small>{title.length}/160</small>
                </label>
                <label className="labs-v2-field">
                  <span>Why should this exist?</span>
                  <textarea
                    className="labs-v2-textarea"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    maxLength={4000}
                    placeholder="Describe the problem, the members it helps, and the expected behavior."
                  />
                  <small>{description.length}/4000</small>
                </label>
                <button className="labs-v2-primary" type="submit" disabled={submitting}>
                  <Send aria-hidden="true" /> {submitting ? "Submitting…" : "Submit request"}
                </button>
              </form>
            </section>

            <section className="labs-v2-workflow" aria-labelledby="labs-workflow-title">
              <div className="labs-v2-section-heading">
                <p className="labs-v2-eyebrow">WORKFLOW</p>
                <h2 id="labs-workflow-title">What is moving through Labs.</h2>
              </div>
              <div className="labs-v2-summary-grid">
                {(["submitted", "reviewing", "planned", "shipped", "declined"] as LabsFeatureRequestStatus[]).map((status) => (
                  <div key={status} className="labs-v2-summary-item">
                    <span>{STATUS_LABELS[status]}</span>
                    <strong>{statusCounts[status]}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className="labs-v2-board">
              <div className="labs-v2-board-header">
                <div className="labs-v2-section-heading">
                  <p className="labs-v2-eyebrow">REQUEST BOARD</p>
                  <h2>Current Labs requests</h2>
                  <p>Search the live request workflow, filter by state, and sort by recency or member votes.</p>
                </div>
                <span className="labs-v2-board-count">{visibleRequests.length} shown</span>
              </div>

              <div className="labs-v2-toolbar">
                <label className="labs-v2-search-wrap">
                  <Search aria-hidden="true" size={16} />
                  <span className="sr-only">Search Labs requests</span>
                  <input
                    className="labs-v2-search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search requests and notes"
                  />
                </label>
                <select
                  className="labs-v2-select"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
                  aria-label="Filter Labs requests by status"
                >
                  {FILTER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                  <p>Adjust the search or status filter, or submit the first request in this view.</p>
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
                              {isMine ? <span className="labs-v2-owner-badge">Your request</span> : null}
                            </div>
                            <p className="labs-v2-request-meta">
                              Submitted {formatDate(request.created_at)} · {request.vote_count} {request.vote_count === 1 ? "vote" : "votes"}
                            </p>
                          </div>
                          <span className={statusClass(request.status)}>{STATUS_LABELS[request.status]}</span>
                        </div>
                        <p className="labs-v2-request-description">{request.description}</p>
                        {request.admin_note ? (
                          <div className="labs-v2-admin-note">
                            <strong>Loombus review note</strong>
                            <p>{request.admin_note}</p>
                          </div>
                        ) : null}
                        <div className="labs-v2-card-actions">
                          <button
                            type="button"
                            className={`labs-v2-vote-button${request.voted_by_me ? " is-voted" : ""}`}
                            onClick={() => void toggleVote(request.id)}
                            disabled={!canVote || workingVoteId === request.id}
                            title={canVote ? "Add or remove your Labs vote" : "Labs voting requires Premium Plus or Admin access"}
                          >
                            {request.voted_by_me ? <CheckCircle2 aria-hidden="true" /> : <ThumbsUp aria-hidden="true" />}
                            {workingVoteId === request.id ? "Updating…" : request.voted_by_me ? "Voted" : "Vote"}
                          </button>
                          {!canVote ? <span className="labs-v2-voting-note">Premium Plus or Admin access is required to vote.</span> : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        <footer className="labs-v2-resources">
          <div>
            <CircleDot aria-hidden="true" />
            <span>Labs reflects live product capabilities only—no invented enrollment states or rollout percentages.</span>
          </div>
          <nav aria-label="Labs resources">
            <Link href="/premium">Plans</Link>
            <Link href="/ai-usage">AI usage</Link>
            <Link href="/support">Support</Link>
            {isAdmin ? <Link href="/admin/labs">Admin Labs</Link> : null}
          </nav>
        </footer>
      </div>
    </main>
  );
}
