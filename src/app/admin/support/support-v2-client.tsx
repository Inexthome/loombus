"use client";

import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  ExternalLink,
  FileText,
  Inbox,
  LifeBuoy,
  Loader2,
  Mail,
  RefreshCw,
  Search,
  ShieldAlert,
  Tag,
  UserRound,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type SupportStatus = "new" | "reviewing" | "resolved" | "closed";

type SupportRequest = {
  id: string;
  user_id: string | null;
  email: string;
  category: string;
  subject: string;
  message: string;
  status: SupportStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupportProfile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
};

type SupportTemplate = {
  key: string;
  title: string;
  category: string;
  body: string[];
};

type MetricDefinition = {
  label: string;
  value: number;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

const STATUSES: SupportStatus[] = ["new", "reviewing", "resolved", "closed"];

const STATUS_LABELS: Record<SupportStatus, string> = {
  new: "New",
  reviewing: "Reviewing",
  resolved: "Resolved",
  closed: "Closed",
};

const RESPONSE_TEMPLATES: SupportTemplate[] = [
  {
    key: "account-access",
    title: "Account access",
    category: "account",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support. We received your account access request and are reviewing the details.",
      "",
      "For account protection, please do not send passwords, verification codes, payment card numbers, or private authentication tokens. If this is a login or password issue, use the password reset or sign-in flow first, then reply with the account email and a short description of what happened.",
      "",
      "We will review the account context and follow up if more information is needed.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "billing-premium",
    title: "Billing / Premium",
    category: "billing",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support about billing or Premium access.",
      "",
      "Please include the account email, the plan involved, and whether the issue is about checkout, billing portal access, subscription status, or Extra AI Pack credits. Do not send full payment card details.",
      "",
      "We will review the billing status and follow up with the safest next step.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "safety-concern",
    title: "Safety concern",
    category: "safety",
    body: [
      "Hi,",
      "",
      "Thanks for reporting this safety concern. We take safety reports seriously and will review the context carefully.",
      "",
      "Please include any relevant discussion link, profile link, report reason, screenshot context, and a short explanation of what concerned you. Do not include sensitive private information unless it is necessary to understand the issue.",
      "",
      "If there is an immediate emergency or threat of physical harm, contact local emergency services first.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "accessibility",
    title: "Accessibility issue",
    category: "accessibility",
    body: [
      "Hi,",
      "",
      "Thanks for telling us about an accessibility issue on Loombus.",
      "",
      "Please include the page or feature where it happened, the device or browser you used, any assistive technology involved, and what made the experience difficult or blocked.",
      "",
      "We will review this and use it to improve accessibility across the platform.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "bug-report",
    title: "Bug report",
    category: "bug",
    body: [
      "Hi,",
      "",
      "Thanks for reporting this bug.",
      "",
      "Please include the page where it happened, what you expected, what actually happened, and the steps to reproduce it. Device, browser, screenshot context, and error text are also helpful.",
      "",
      "We will review the issue and prioritize it based on impact.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "feedback",
    title: "Product feedback",
    category: "feedback",
    body: [
      "Hi,",
      "",
      "Thanks for sharing feedback about Loombus.",
      "",
      "We review feedback for patterns around clarity, usefulness, safety, and the signal-over-noise experience. Your note has been received and can help guide future improvements.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "legal-rights",
    title: "Legal / rights concern",
    category: "legal",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus about a legal or rights concern.",
      "",
      "Please include the relevant content link, the specific rights concern, your relationship to the content, and any documentation needed to understand the request. Do not include unnecessary sensitive information.",
      "",
      "We will review the submission carefully and follow up if additional information is required.",
      "",
      "Loombus Support",
    ],
  },
  {
    key: "resolved",
    title: "Resolved confirmation",
    category: "resolved",
    body: [
      "Hi,",
      "",
      "Thanks for contacting Loombus support. We reviewed this request and marked it as resolved.",
      "",
      "If the issue continues or you have new information, please submit a new support request with the updated details.",
      "",
      "Loombus Support",
    ],
  },
];

function formatDate(value: string | null | undefined, includeTime = true) {
  if (!value) return "Not recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(timestamp));
}

function requestAge(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown age";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / 3_600_000));
  if (hours < 1) return "Less than an hour old";
  if (hours < 24) return `${hours}h old`;
  const days = Math.floor(hours / 24);
  return `${days}d old`;
}

function statusTone(status: SupportStatus) {
  if (status === "new") return "danger";
  if (status === "reviewing") return "warning";
  if (status === "resolved") return "success";
  return "muted";
}

function categoryIcon(category: string): LucideIcon {
  const normalized = category.toLowerCase();
  if (normalized === "bug") return Wrench;
  if (normalized === "safety" || normalized === "legal") return ShieldAlert;
  if (normalized === "account") return UserRound;
  if (normalized === "billing") return FileText;
  return LifeBuoy;
}

export default function AdminSupportV2Client() {
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, SupportProfile>>({});
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [statusDraft, setStatusDraft] = useState<SupportStatus>("new");
  const [noteDraft, setNoteDraft] = useState("");
  const [working, setWorking] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const loadRequests = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fsupport";
        return;
      }

      const response = await fetch("/api/admin/support/requests", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fsupport";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        setRequests([]);
        setMessage(result.error ?? "Admin access required.");
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load support operations.");
        setAuthChecked(true);
        return;
      }

      const loadedRequests = (result.requests ?? []) as SupportRequest[];
      const profileMap = ((result.profiles ?? []) as SupportProfile[]).reduce<
        Record<string, SupportProfile>
      >((map, profile) => {
        map[profile.id] = profile;
        return map;
      }, {});

      setRequests(loadedRequests);
      setProfiles(profileMap);
      setAuthorized(true);
      setAuthChecked(true);
      setSelectedRequestId((current) => {
        if (current && loadedRequests.some((item) => item.id === current)) return current;
        const requestedId = new URLSearchParams(window.location.search).get("request");
        if (requestedId && loadedRequests.some((item) => item.id === requestedId)) return requestedId;
        return loadedRequests[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load support operations.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const categories = useMemo(
    () => [...new Set(requests.map((item) => item.category).filter(Boolean))].sort(),
    [requests]
  );

  const visibleRequests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!query) return true;
      const profile = item.user_id ? profiles[item.user_id] : undefined;
      return [
        item.id,
        item.email,
        item.category,
        item.subject,
        item.message,
        item.status,
        item.admin_note,
        item.user_id,
        profile?.username,
        profile?.full_name,
        profile?.account_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categoryFilter, profiles, requests, searchQuery, statusFilter]);

  useEffect(() => {
    if (!visibleRequests.length) {
      setSelectedRequestId(null);
      return;
    }
    if (!selectedRequestId || !visibleRequests.some((item) => item.id === selectedRequestId)) {
      setSelectedRequestId(visibleRequests[0].id);
    }
  }, [selectedRequestId, visibleRequests]);

  const selectedRequest =
    visibleRequests.find((item) => item.id === selectedRequestId) ?? null;

  useEffect(() => {
    if (!selectedRequest) return;
    setStatusDraft(selectedRequest.status);
    setNoteDraft(selectedRequest.admin_note ?? "");
    const url = new URL(window.location.href);
    url.searchParams.set("request", selectedRequest.id);
    window.history.replaceState({}, "", url);
  }, [selectedRequest]);

  const counts = useMemo(() => {
    const statusCounts = { new: 0, reviewing: 0, resolved: 0, closed: 0 };
    for (const item of requests) statusCounts[item.status] += 1;
    return statusCounts;
  }, [requests]);

  const metrics: MetricDefinition[] = [
    { label: "New", value: counts.new, detail: "Awaiting first review", Icon: Inbox, priority: true },
    { label: "Reviewing", value: counts.reviewing, detail: "Active support work", Icon: Clock3 },
    { label: "Resolved", value: counts.resolved, detail: "Resolution recorded", Icon: CheckCircle2 },
    { label: "Closed", value: counts.closed, detail: "No further action", Icon: XCircle },
  ];

  async function saveSelected() {
    if (!selectedRequest || working) return;
    const changed =
      statusDraft !== selectedRequest.status || noteDraft.trim() !== (selectedRequest.admin_note ?? "");
    if (!changed) {
      setMessage("No changes to save.");
      return;
    }

    setWorking(true);
    setMessage("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fsupport";
        return;
      }
      const response = await fetch("/api/admin/support/requests", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          status: statusDraft,
          adminNote: noteDraft,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(result.error ?? "Unable to update support request.");
        return;
      }
      const updated = result.request as SupportRequest;
      setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage("Support request updated.");
    } catch {
      setMessage("Unable to update support request.");
    } finally {
      setWorking(false);
    }
  }

  async function copyTemplate(template: SupportTemplate) {
    try {
      await navigator.clipboard.writeText(template.body.join("\n"));
      setMessage(`${template.title} template copied.`);
    } catch {
      setMessage("Unable to copy the template.");
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
  }

  if (!authChecked || loading) {
    return (
      <main className="support-v2-page">
        <div className="support-v2-state-card">
          <Loader2 className="support-v2-spinner" size={22} />
          <div><strong>Loading Support Operations</strong><span>Preparing the support queue and member context.</span></div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="support-v2-page">
        <div className="support-v2-state-card is-denied">
          <AlertCircle size={24} />
          <div><strong>Access denied</strong><span>{message || "Admin access is required."}</span></div>
          <Link href="/admin">Back to Admin</Link>
        </div>
      </main>
    );
  }

  const member = selectedRequest?.user_id ? profiles[selectedRequest.user_id] : undefined;
  const reviewer = selectedRequest?.reviewed_by ? profiles[selectedRequest.reviewed_by] : undefined;
  const CategoryIcon = selectedRequest ? categoryIcon(selectedRequest.category) : LifeBuoy;

  return (
    <main className="support-v2-page">
      <div className="support-v2-shell">
        <header className="support-v2-hero">
          <div>
            <Link href="/admin" className="support-v2-back-link"><ArrowLeft size={15} />Back to Admin</Link>
            <p className="support-v2-eyebrow">Support Operations</p>
            <h1>Resolve member requests with context.</h1>
            <p>Review structured support submissions, record internal notes, and move each request through a clear operational status.</p>
          </div>
          <div className="support-v2-hero-actions">
            <button type="button" onClick={() => void loadRequests(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="support-v2-spinner" size={16} /> : <RefreshCw size={16} />}
              Refresh
            </button>
            <button type="button" className="is-secondary" onClick={() => setTemplatesOpen((current) => !current)}>
              <Clipboard size={16} />Templates
            </button>
          </div>
        </header>

        <section className="support-v2-metrics" aria-label="Support request metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article key={label} className={`support-v2-metric${priority ? " is-priority" : ""}`}>
              <div><Icon size={17} /><span>{label}</span></div><strong>{value}</strong><p>{detail}</p>
            </article>
          ))}
        </section>

        {message && <div className="support-v2-notice"><AlertCircle size={17} /><span>{message}</span><button onClick={() => setMessage("")} aria-label="Dismiss message"><XCircle size={16} /></button></div>}

        {templatesOpen && (
          <section className="support-v2-templates">
            <div className="support-v2-section-heading"><div><p className="support-v2-eyebrow">Safe reply starters</p><h2>Response templates</h2></div><span>Templates copy to the clipboard. They do not send email.</span></div>
            <div className="support-v2-template-grid">
              {RESPONSE_TEMPLATES.map((template) => (
                <article key={template.key}>
                  <div><span>{template.category}</span><h3>{template.title}</h3></div>
                  <p>{template.body.filter(Boolean).slice(0, 2).join(" ")}</p>
                  <button type="button" onClick={() => void copyTemplate(template)}><Clipboard size={14} />Copy template</button>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="support-v2-toolbar">
          <label className="support-v2-search"><Search size={17} /><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search subject, email, message, member, or note" /></label>
          <div className="support-v2-filter-row">
            <label><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
            <label><span>Category</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>

        <section className="support-v2-workspace">
          <aside className="support-v2-queue">
            <div className="support-v2-queue-heading"><div><p className="support-v2-eyebrow">Request queue</p><h2>{visibleRequests.length} shown</h2></div><span>{requests.length}</span></div>
            <div className="support-v2-queue-list">
              {visibleRequests.map((item) => {
                const profile = item.user_id ? profiles[item.user_id] : undefined;
                const Icon = categoryIcon(item.category);
                return (
                  <button key={item.id} type="button" className={item.id === selectedRequestId ? "is-selected" : ""} onClick={() => setSelectedRequestId(item.id)}>
                    <div className="support-v2-queue-top"><span className={`support-v2-badge is-${statusTone(item.status)}`}>{STATUS_LABELS[item.status]}</span><time>{requestAge(item.created_at)}</time></div>
                    <h3>{item.subject}</h3>
                    <p>{item.message}</p>
                    <div className="support-v2-queue-meta"><span><Icon size={13} />{item.category}</span><span><Mail size={13} />{profile?.username ? `@${profile.username}` : item.email}</span></div>
                    <ChevronRight size={17} className="support-v2-chevron" />
                  </button>
                );
              })}
              {!visibleRequests.length && <div className="support-v2-empty"><Inbox size={22} /><strong>No requests match.</strong><span>Adjust or clear the current filters.</span><button type="button" onClick={clearFilters}>Clear filters</button></div>}
            </div>
          </aside>

          <section className="support-v2-detail">
            {!selectedRequest ? (
              <div className="support-v2-empty is-detail"><LifeBuoy size={26} /><strong>Select a support request.</strong><span>Choose a request from the queue to review its full context.</span></div>
            ) : (
              <>
                <header className="support-v2-detail-header">
                  <div className="support-v2-detail-title-row"><span className="support-v2-category-icon"><CategoryIcon size={20} /></span><div><div className="support-v2-badge-row"><span className={`support-v2-badge is-${statusTone(selectedRequest.status)}`}>{STATUS_LABELS[selectedRequest.status]}</span><span className="support-v2-badge is-muted">{selectedRequest.category}</span></div><h2>{selectedRequest.subject}</h2><p>Submitted {formatDate(selectedRequest.created_at)} · {requestAge(selectedRequest.created_at)}</p></div></div>
                  <a href={`mailto:${selectedRequest.email}?subject=${encodeURIComponent(`Re: ${selectedRequest.subject}`)}`}><Mail size={15} />Reply by email<ExternalLink size={13} /></a>
                </header>

                <div className="support-v2-detail-body">
                  <section className="support-v2-message-card"><p className="support-v2-eyebrow">Member message</p><div>{selectedRequest.message}</div></section>

                  <div className="support-v2-context-grid">
                    <section className="support-v2-context-card">
                      <div className="support-v2-card-heading"><UserRound size={17} /><h3>Member context</h3></div>
                      {member ? <div className="support-v2-member"><ProfileAvatar profile={member} size="lg" /><div><strong>{getProfileDisplayName(member)}</strong><span>{member.username ? `@${member.username}` : selectedRequest.email}</span></div></div> : <p className="support-v2-muted">No linked Loombus profile. The request was submitted with {selectedRequest.email}.</p>}
                      <dl><div><dt>Account status</dt><dd>{member?.account_status?.replaceAll("_", " ") || "Not linked"}</dd></div><div><dt>Enforcement reason</dt><dd>{member?.enforcement_reason || "None recorded"}</dd></div><div><dt>Suspended until</dt><dd>{formatDate(member?.suspended_until)}</dd></div></dl>
                      {selectedRequest.user_id && <Link href={`/admin/users?member=${encodeURIComponent(selectedRequest.user_id)}`}>Open Member Operations<ExternalLink size={13} /></Link>}
                    </section>

                    <section className="support-v2-context-card">
                      <div className="support-v2-card-heading"><Tag size={17} /><h3>Request record</h3></div>
                      <dl><div><dt>Request ID</dt><dd>{selectedRequest.id}</dd></div><div><dt>Email</dt><dd>{selectedRequest.email}</dd></div><div><dt>Created</dt><dd>{formatDate(selectedRequest.created_at)}</dd></div><div><dt>Updated</dt><dd>{formatDate(selectedRequest.updated_at)}</dd></div><div><dt>Last reviewed</dt><dd>{formatDate(selectedRequest.reviewed_at)}</dd></div><div><dt>Reviewed by</dt><dd>{reviewer ? getProfileDisplayName(reviewer) : selectedRequest.reviewed_by || "Not reviewed"}</dd></div></dl>
                    </section>
                  </div>

                  <section className="support-v2-resolution-card">
                    <div className="support-v2-section-heading"><div><p className="support-v2-eyebrow">Internal resolution</p><h3>Record the operational outcome</h3></div><span>Notes remain internal and are not emailed automatically.</span></div>
                    <div className="support-v2-resolution-form">
                      <label><span>Status</span><select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as SupportStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}</select></label>
                      <label><span>Admin note</span><textarea value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={2000} placeholder="Record context, steps taken, or the reason for the final status." /></label>
                    </div>
                    <div className="support-v2-resolution-actions"><span>{noteDraft.length}/2000</span><button type="button" onClick={() => void saveSelected()} disabled={working}>{working ? <Loader2 className="support-v2-spinner" size={16} /> : <CheckCircle2 size={16} />}{working ? "Saving" : "Save outcome"}</button></div>
                  </section>

                  <nav className="support-v2-related-links" aria-label="Related Admin tools">
                    <Link href={`/admin/audit?search=${encodeURIComponent(selectedRequest.id)}`}><FileText size={15} />Audit context<ChevronRight size={14} /></Link>
                    <Link href="/admin/reports"><ShieldAlert size={15} />Reports<ChevronRight size={14} /></Link>
                    <Link href="/admin/safety"><AlertCircle size={15} />Safety Operations<ChevronRight size={14} /></Link>
                  </nav>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
