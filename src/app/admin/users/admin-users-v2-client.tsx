"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  CreditCard,
  ExternalLink,
  FileWarning,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserRoundCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import {
  getIdentityVerificationDisplay,
  normalizeIdentityVerificationStatus,
  type IdentityVerificationStatus,
} from "@/lib/identity-verification";
import { validatePublicProfileCompletion } from "@/lib/profile-completion";
import {
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
} from "@/lib/subscription-plans";
import { supabase } from "@/lib/supabase/client";

type AccountStatus =
  | "active"
  | "warned"
  | "suspended"
  | "banned"
  | "deactivated"
  | "deletion_requested"
  | "unknown";

type AgeBand = "unknown" | "under_13" | "teen" | "adult";
type AccountAction = "warn_user" | "suspend_user" | "ban_user" | "restore_user";

type EntitlementRow = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  updated_at: string | null;
};

type MemberRow = {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  enforcement_note: string | null;
  enforced_at: string | null;
  suspended_until: string | null;
  identity_verification_status: string | null;
  identity_verification_provider: string | null;
  identity_verified_at: string | null;
  legal_name_verified: boolean | null;
  identity_restriction_reason: string | null;
  date_of_birth_on_file: boolean;
  age_band: string | null;
  teen_safety_mode: boolean;
  guardian_required: boolean;
  entitlement: EntitlementRow | null;
};

type MemberView = {
  member: MemberRow;
  accountStatus: AccountStatus;
  ageBand: AgeBand;
  identityStatus: IdentityVerificationStatus;
  identityDisplay: ReturnType<typeof getIdentityVerificationDisplay>;
  planKey: string;
  planDisplay: ReturnType<typeof getSubscriptionDisplay>;
  publicProfileComplete: boolean;
  publicProfileIssue: string;
};

type MetricDefinition = {
  label: string;
  value: number;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

const IDENTITY_STATUS_OPTIONS: IdentityVerificationStatus[] = [
  "unverified",
  "pending",
  "verified",
  "failed",
  "restricted",
];

const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  active: "Active",
  warned: "Warned",
  suspended: "Suspended",
  banned: "Banned",
  deactivated: "Deactivated",
  deletion_requested: "Deletion requested",
  unknown: "Needs review",
};

function normalizeAccountStatus(value: string | null | undefined): AccountStatus {
  if (
    value === "active" ||
    value === "warned" ||
    value === "suspended" ||
    value === "banned" ||
    value === "deactivated" ||
    value === "deletion_requested"
  ) {
    return value;
  }

  return value ? "unknown" : "active";
}

function normalizeAgeBand(value: string | null | undefined): AgeBand {
  if (
    value === "unknown" ||
    value === "under_13" ||
    value === "teen" ||
    value === "adult"
  ) {
    return value;
  }

  return "unknown";
}

function formatAgeBand(value: AgeBand) {
  if (value === "under_13") return "Under 13";
  if (value === "teen") return "Teen";
  if (value === "adult") return "Adult";
  return "Unknown";
}

function formatIdentityStatus(value: IdentityVerificationStatus) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Not recorded";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Not recorded";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(timestamp));
}

function maskId(value: string | null | undefined) {
  if (!value) return "Not linked";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function toLocalDateTimeValue(value: string | null | undefined) {
  const date = value ? new Date(value) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function buildMemberView(member: MemberRow): MemberView {
  const identityStatus = normalizeIdentityVerificationStatus(
    member.identity_verification_status
  );
  const profileGate = validatePublicProfileCompletion({
    fullName: member.full_name,
    username: member.username,
    bio: member.bio,
  });

  return {
    member,
    accountStatus: normalizeAccountStatus(member.account_status),
    ageBand: normalizeAgeBand(member.age_band),
    identityStatus,
    identityDisplay: getIdentityVerificationDisplay(identityStatus),
    planKey: getSubscriptionDisplayKey(member.entitlement),
    planDisplay: getSubscriptionDisplay(member.entitlement),
    publicProfileComplete: profileGate.ok,
    publicProfileIssue: profileGate.ok ? "" : profileGate.message,
  };
}

function accountTone(status: AccountStatus) {
  if (status === "active") return "success";
  if (status === "warned") return "warning";
  if (status === "suspended") return "attention";
  if (status === "banned") return "danger";
  if (status === "deletion_requested") return "violet";
  return "muted";
}

function ageTone(ageBand: AgeBand, teenSafetyMode: boolean, guardianRequired: boolean) {
  if (ageBand === "under_13" || guardianRequired) return "danger";
  if (ageBand === "teen" || teenSafetyMode) return "warning";
  if (ageBand === "adult") return "success";
  return "muted";
}

export default function AdminUsersV2Client() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [identityFilter, setIdentityFilter] = useState("all");
  const [ageFilter, setAgeFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [workingAction, setWorkingAction] = useState("");
  const [identityReason, setIdentityReason] = useState("");
  const [enforcementReason, setEnforcementReason] = useState("");
  const [enforcementNote, setEnforcementNote] = useState("");
  const [suspendedUntil, setSuspendedUntil] = useState(toLocalDateTimeValue(null));

  const loadMembers = useCallback(async (manualRefresh = false) => {
    if (manualRefresh) setRefreshing(true);
    else setLoading(true);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fusers";
        return;
      }

      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login?next=%2Fadmin%2Fusers";
        return;
      }

      if (response.status === 403) {
        setAuthorized(false);
        setAuthChecked(true);
        setMembers([]);
        setMessage(result.error ?? "Admin access required.");
        return;
      }

      if (!response.ok) {
        setMessage(result.error ?? "Unable to load member operations.");
        setAuthChecked(true);
        return;
      }

      const loadedMembers = (result.users ?? []) as MemberRow[];
      setMembers(loadedMembers);
      setCurrentAdminId(result.currentAdminId ?? "");
      setAuthorized(true);
      setAuthChecked(true);

      setSelectedMemberId((current) => {
        if (current && loadedMembers.some((member) => member.id === current)) {
          return current;
        }

        const params = new URLSearchParams(window.location.search);
        const requestedMember = (params.get("member") ?? params.get("search") ?? "")
          .trim()
          .toLowerCase();

        if (requestedMember) {
          const match = loadedMembers.find((member) =>
            [member.id, member.username, member.full_name]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(requestedMember))
          );
          if (match) return match.id;
        }

        return loadedMembers[0]?.id ?? null;
      });
    } catch {
      setMessage("Unable to load member operations.");
      setAuthChecked(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const memberViews = useMemo(() => members.map(buildMemberView), [members]);

  const visibleMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return memberViews.filter((view) => {
      const { member } = view;

      if (statusFilter !== "all" && view.accountStatus !== statusFilter) return false;
      if (planFilter !== "all" && view.planKey !== planFilter) return false;
      if (identityFilter !== "all" && view.identityStatus !== identityFilter) return false;

      if (ageFilter === "teen_safety" && !member.teen_safety_mode) return false;
      if (ageFilter === "guardian_required" && !member.guardian_required) return false;
      if (
        ageFilter !== "all" &&
        ageFilter !== "teen_safety" &&
        ageFilter !== "guardian_required" &&
        view.ageBand !== ageFilter
      ) {
        return false;
      }

      if (profileFilter === "complete" && !view.publicProfileComplete) return false;
      if (profileFilter === "incomplete" && view.publicProfileComplete) return false;

      if (!query) return true;

      const searchable = [
        member.id,
        member.username,
        member.full_name,
        member.bio,
        view.accountStatus,
        view.identityStatus,
        member.identity_verification_provider,
        member.identity_restriction_reason,
        view.ageBand,
        member.teen_safety_mode ? "teen safety" : "",
        member.guardian_required ? "guardian required" : "",
        member.date_of_birth_on_file ? "date of birth on file" : "date of birth missing",
        view.planKey,
        view.planDisplay.label,
        member.entitlement?.stripe_subscription_status,
        member.entitlement?.stripe_customer_id,
        member.entitlement?.stripe_subscription_id,
        view.publicProfileComplete ? "profile complete" : "profile incomplete",
        view.publicProfileIssue,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    ageFilter,
    identityFilter,
    memberViews,
    planFilter,
    profileFilter,
    searchQuery,
    statusFilter,
  ]);

  useEffect(() => {
    if (visibleMembers.length === 0) {
      setSelectedMemberId(null);
      return;
    }

    if (!selectedMemberId || !visibleMembers.some((view) => view.member.id === selectedMemberId)) {
      setSelectedMemberId(visibleMembers[0].member.id);
    }
  }, [selectedMemberId, visibleMembers]);

  const selectedView = useMemo(
    () => memberViews.find((view) => view.member.id === selectedMemberId) ?? null,
    [memberViews, selectedMemberId]
  );

  useEffect(() => {
    if (!selectedView) return;
    setIdentityReason(selectedView.member.identity_restriction_reason ?? "");
    setEnforcementReason(selectedView.member.enforcement_reason ?? "");
    setEnforcementNote(selectedView.member.enforcement_note ?? "");
    setSuspendedUntil(toLocalDateTimeValue(selectedView.member.suspended_until));
  }, [selectedView]);

  const counts = useMemo(() => {
    const restrictedStatuses = new Set<AccountStatus>([
      "suspended",
      "banned",
      "deactivated",
      "deletion_requested",
      "unknown",
    ]);

    return {
      total: memberViews.length,
      restricted: memberViews.filter((view) => restrictedStatuses.has(view.accountStatus)).length,
      warned: memberViews.filter((view) => view.accountStatus === "warned").length,
      identityReview: memberViews.filter((view) =>
        ["pending", "failed", "restricted"].includes(view.identityStatus)
      ).length,
      teenSafety: memberViews.filter((view) => view.member.teen_safety_mode).length,
      incomplete: memberViews.filter((view) => !view.publicProfileComplete).length,
      billingLinked: memberViews.filter((view) =>
        Boolean(view.member.entitlement?.stripe_customer_id)
      ).length,
      paid: memberViews.filter((view) =>
        ["premium", "premium_plus"].includes(view.planKey)
      ).length,
    };
  }, [memberViews]);

  const metrics: MetricDefinition[] = [
    { label: "Members", value: counts.total, detail: "Profiles available to Admin review.", Icon: UsersRound },
    { label: "Access restricted", value: counts.restricted, detail: "Accounts blocked from protected product access.", Icon: ShieldAlert, priority: counts.restricted > 0 },
    { label: "Warnings", value: counts.warned, detail: "Members currently carrying an account warning.", Icon: AlertTriangle },
    { label: "Identity review", value: counts.identityReview, detail: "Pending, failed, or restricted verification states.", Icon: Fingerprint, priority: counts.identityReview > 0 },
    { label: "Teen safety", value: counts.teenSafety, detail: "Accounts using teen-safety protections.", Icon: ShieldCheck },
    { label: "Profile incomplete", value: counts.incomplete, detail: "Members missing public-profile requirements.", Icon: FileWarning },
    { label: "Paid plans", value: counts.paid, detail: "Premium and Premium Plus member records.", Icon: Sparkles },
    { label: "Billing linked", value: counts.billingLinked, detail: "Members with a Stripe customer reference.", Icon: CreditCard },
  ];

  function selectMember(memberId: string) {
    setSelectedMemberId(memberId);
    const url = new URL(window.location.href);
    url.searchParams.set("member", memberId);
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }

  function clearFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setPlanFilter("all");
    setIdentityFilter("all");
    setAgeFilter("all");
    setProfileFilter("all");
  }

  async function updateIdentityVerification(status: IdentityVerificationStatus) {
    if (!selectedView || workingAction) return;

    setWorkingAction(`identity:${status}`);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fusers";
        return;
      }

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: "update_identity_verification",
          targetUserId: selectedView.member.id,
          identityVerificationStatus: status,
          identityRestrictionReason: identityReason,
          legalNameVerified: status === "verified",
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update identity verification.");
        return;
      }

      setMembers((current) =>
        current.map((member) =>
          member.id === selectedView.member.id
            ? {
                ...member,
                identity_verification_status:
                  result.identityVerificationStatus ?? status,
                identity_verification_provider:
                  result.identityVerificationProvider ?? null,
                identity_verified_at: result.identityVerifiedAt ?? null,
                legal_name_verified: Boolean(result.legalNameVerified),
                identity_restriction_reason:
                  result.identityRestrictionReason ?? null,
              }
            : member
        )
      );
      setIdentityReason(result.identityRestrictionReason ?? "");
      setMessage("Identity verification status updated.");
    } catch {
      setMessage("Unable to update identity verification.");
    } finally {
      setWorkingAction("");
    }
  }

  async function enforceAccount(action: AccountAction) {
    if (!selectedView || workingAction) return;

    const member = selectedView.member;
    if (member.id === currentAdminId) {
      setMessage("You cannot enforce your own Admin account.");
      return;
    }

    if (action !== "restore_user" && !enforcementReason.trim()) {
      setMessage("Add an enforcement reason before continuing.");
      return;
    }

    const suspendedUntilIso =
      action === "suspend_user" && suspendedUntil
        ? new Date(suspendedUntil).toISOString()
        : null;

    if (
      action === "suspend_user" &&
      (!suspendedUntilIso || new Date(suspendedUntilIso).getTime() <= Date.now())
    ) {
      setMessage("Choose a suspension end time in the future.");
      return;
    }

    const actionLabel =
      action === "warn_user"
        ? "warn"
        : action === "suspend_user"
          ? "suspend"
          : action === "ban_user"
            ? "ban"
            : "restore";
    const confirmed = window.confirm(
      `Confirm that you want to ${actionLabel} ${getProfileDisplayName(member)}. This action is recorded in the Admin audit log.`
    );
    if (!confirmed) return;

    setWorkingAction(action);
    setMessage("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        window.location.href = "/login?next=%2Fadmin%2Fusers";
        return;
      }

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action,
          targetUserId: member.id,
          enforcementReason: enforcementReason.trim(),
          enforcementNote: enforcementNote.trim(),
          suspendedUntil: suspendedUntilIso,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update account access.");
        return;
      }

      setMembers((current) =>
        current.map((currentMember) =>
          currentMember.id === member.id
            ? {
                ...currentMember,
                account_status: result.accountStatus ?? currentMember.account_status,
                enforcement_reason: result.enforcementReason ?? null,
                enforcement_note: result.enforcementNote ?? null,
                enforced_at: result.enforcedAt ?? null,
                suspended_until: result.suspendedUntil ?? null,
              }
            : currentMember
        )
      );
      setEnforcementReason(result.enforcementReason ?? "");
      setEnforcementNote(result.enforcementNote ?? "");
      setSuspendedUntil(toLocalDateTimeValue(result.suspendedUntil ?? null));
      setMessage(`Account ${action === "restore_user" ? "restored" : "enforcement updated"}.`);
    } catch {
      setMessage("Unable to update account access.");
    } finally {
      setWorkingAction("");
    }
  }

  if (!authChecked || loading) {
    return (
      <AdminUsersState
        eyebrow="Member operations"
        title="Loading member records..."
        description="Verifying Admin access and assembling profile, age-safety, identity, plan, and account-status context."
        loading
      />
    );
  }

  if (!authorized) {
    return (
      <AdminUsersState
        eyebrow="Admin only"
        title="Access denied."
        description={message || "Member Operations is available only to authorized Admin accounts."}
      />
    );
  }

  return (
    <main className="admin-users-v2-page">
      <div className="admin-users-v2-shell">
        <header className="admin-users-v2-hero">
          <div className="admin-users-v2-hero-copy">
            <Link href="/admin" className="admin-users-v2-back-link">
              <ArrowLeft aria-hidden="true" size={16} />
              Back to Admin Operations
            </Link>
            <p className="admin-users-v2-eyebrow">Member operations</p>
            <h1>Review the member, not just the status.</h1>
            <p>
              Search Loombus members and bring account access, identity review,
              age-safety context, public-profile readiness, plan access, and billing
              references into one Admin workspace.
            </p>
          </div>
          <div className="admin-users-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadMembers(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 aria-hidden="true" className="admin-users-v2-spin" size={17} />
              ) : (
                <RefreshCw aria-hidden="true" size={17} />
              )}
              {refreshing ? "Refreshing" : "Refresh records"}
            </button>
            <span>Admin-only data · no public indexing</span>
          </div>
        </header>

        <section className="admin-users-v2-metrics" aria-label="Member operations summary">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article
              key={label}
              className={`admin-users-v2-metric${priority ? " is-priority" : ""}`}
            >
              <div>
                <span>{label}</span>
                <Icon aria-hidden="true" size={18} />
              </div>
              <strong>{value}</strong>
              <p>{detail}</p>
            </article>
          ))}
        </section>

        {message ? (
          <div className="admin-users-v2-notice" role="status">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        ) : null}

        <section className="admin-users-v2-toolbar" aria-label="Member filters">
          <label className="admin-users-v2-search">
            <Search aria-hidden="true" size={18} />
            <span className="sr-only">Search members</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search name, username, ID, plan, identity, status, or billing reference"
            />
          </label>

          <div className="admin-users-v2-filter-grid">
            <FilterSelect label="Account" value={statusFilter} onChange={setStatusFilter}>
              <option value="all">All account states</option>
              <option value="active">Active</option>
              <option value="warned">Warned</option>
              <option value="suspended">Suspended</option>
              <option value="banned">Banned</option>
              <option value="deactivated">Deactivated</option>
              <option value="deletion_requested">Deletion requested</option>
              <option value="unknown">Needs review</option>
            </FilterSelect>
            <FilterSelect label="Plan" value={planFilter} onChange={setPlanFilter}>
              <option value="all">All plans</option>
              <option value="free">Free</option>
              <option value="premium">Premium</option>
              <option value="premium_plus">Premium Plus</option>
              <option value="admin">Admin</option>
            </FilterSelect>
            <FilterSelect label="Identity" value={identityFilter} onChange={setIdentityFilter}>
              <option value="all">All identity states</option>
              {IDENTITY_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatIdentityStatus(status)}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Age safety" value={ageFilter} onChange={setAgeFilter}>
              <option value="all">All age-safety states</option>
              <option value="unknown">Age unknown</option>
              <option value="teen">Teen</option>
              <option value="adult">Adult</option>
              <option value="under_13">Under 13</option>
              <option value="teen_safety">Teen Safety Mode</option>
              <option value="guardian_required">Guardian required</option>
            </FilterSelect>
            <FilterSelect label="Public profile" value={profileFilter} onChange={setProfileFilter}>
              <option value="all">All profile states</option>
              <option value="complete">Complete</option>
              <option value="incomplete">Incomplete</option>
            </FilterSelect>
          </div>

          <div className="admin-users-v2-toolbar-footer">
            <span>Showing {visibleMembers.length} of {members.length} members</span>
            <button type="button" onClick={clearFilters}>
              <RotateCcw aria-hidden="true" size={14} />
              Clear filters
            </button>
          </div>
        </section>

        <section className="admin-users-v2-workspace">
          <aside className="admin-users-v2-queue" aria-label="Member results">
            <div className="admin-users-v2-queue-heading">
              <div>
                <p className="admin-users-v2-eyebrow">Member queue</p>
                <h2>Choose a member to review</h2>
              </div>
              <span>{visibleMembers.length}</span>
            </div>

            {visibleMembers.length === 0 ? (
              <div className="admin-users-v2-empty-queue">
                <Search aria-hidden="true" size={22} />
                <h3>No members match.</h3>
                <p>Clear filters or use a broader search.</p>
                <button type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <div className="admin-users-v2-queue-list">
                {visibleMembers.map((view) => {
                  const selected = view.member.id === selectedMemberId;
                  return (
                    <button
                      key={view.member.id}
                      type="button"
                      className="admin-users-v2-queue-item"
                      aria-pressed={selected}
                      onClick={() => selectMember(view.member.id)}
                    >
                      <ProfileAvatar profile={view.member} size="md" />
                      <span className="admin-users-v2-queue-copy">
                        <strong>{getProfileDisplayName(view.member)}</strong>
                        <small>
                          {view.member.username ? `@${view.member.username}` : "No username"}
                        </small>
                        <span className="admin-users-v2-queue-badges">
                          <StatusBadge tone={accountTone(view.accountStatus)}>
                            {ACCOUNT_STATUS_LABELS[view.accountStatus]}
                          </StatusBadge>
                          <StatusBadge tone="muted">{view.planDisplay.label}</StatusBadge>
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" size={17} />
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          <div className="admin-users-v2-detail">
            {selectedView ? (
              <MemberDetail
                view={selectedView}
                currentAdminId={currentAdminId}
                workingAction={workingAction}
                identityReason={identityReason}
                setIdentityReason={setIdentityReason}
                enforcementReason={enforcementReason}
                setEnforcementReason={setEnforcementReason}
                enforcementNote={enforcementNote}
                setEnforcementNote={setEnforcementNote}
                suspendedUntil={suspendedUntil}
                setSuspendedUntil={setSuspendedUntil}
                updateIdentityVerification={updateIdentityVerification}
                enforceAccount={enforceAccount}
              />
            ) : (
              <div className="admin-users-v2-detail-empty">
                <CircleUserRound aria-hidden="true" size={28} />
                <h2>Select a member.</h2>
                <p>Choose a record from the member queue to open the Admin review workspace.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function MemberDetail({
  view,
  currentAdminId,
  workingAction,
  identityReason,
  setIdentityReason,
  enforcementReason,
  setEnforcementReason,
  enforcementNote,
  setEnforcementNote,
  suspendedUntil,
  setSuspendedUntil,
  updateIdentityVerification,
  enforceAccount,
}: {
  view: MemberView;
  currentAdminId: string;
  workingAction: string;
  identityReason: string;
  setIdentityReason: (value: string) => void;
  enforcementReason: string;
  setEnforcementReason: (value: string) => void;
  enforcementNote: string;
  setEnforcementNote: (value: string) => void;
  suspendedUntil: string;
  setSuspendedUntil: (value: string) => void;
  updateIdentityVerification: (status: IdentityVerificationStatus) => Promise<void>;
  enforceAccount: (action: AccountAction) => Promise<void>;
}) {
  const { member } = view;
  const isSelf = member.id === currentAdminId;
  const identityWorking = workingAction.startsWith("identity:");
  const enforcementWorking = Boolean(workingAction) && !identityWorking;

  return (
    <div className="admin-users-v2-detail-inner">
      <section className="admin-users-v2-member-header">
        <div className="admin-users-v2-member-identity">
          <ProfileAvatar profile={member} size="xl" />
          <div>
            <p className="admin-users-v2-eyebrow">Selected member</p>
            <h2>{getProfileDisplayName(member)}</h2>
            <p>{member.username ? `@${member.username}` : "No public username"}</p>
          </div>
        </div>
        <div className="admin-users-v2-member-badges">
          <StatusBadge tone={accountTone(view.accountStatus)}>
            {ACCOUNT_STATUS_LABELS[view.accountStatus]}
          </StatusBadge>
          <StatusBadge tone="gold">{view.planDisplay.label}</StatusBadge>
          <StatusBadge tone={view.identityStatus === "verified" ? "success" : "warning"}>
            ID {formatIdentityStatus(view.identityStatus)}
          </StatusBadge>
          <StatusBadge tone={ageTone(view.ageBand, member.teen_safety_mode, member.guardian_required)}>
            {formatAgeBand(view.ageBand)}
          </StatusBadge>
          {member.is_admin ? <StatusBadge tone="violet">Admin</StatusBadge> : null}
        </div>
        <div className="admin-users-v2-member-id">
          <span>Member ID</span>
          <code>{member.id}</code>
        </div>
      </section>

      {!view.publicProfileComplete ? (
        <section className="admin-users-v2-attention-card">
          <FileWarning aria-hidden="true" size={20} />
          <div>
            <strong>Public profile needs completion</strong>
            <p>{view.publicProfileIssue}</p>
          </div>
        </section>
      ) : null}

      <section className="admin-users-v2-panel">
        <PanelHeading
          eyebrow="Account access"
          title="Review and enforce account standing"
          description="Warnings preserve access. Suspensions, bans, deactivation, and deletion-pending states are blocked by Loombus account enforcement."
          Icon={KeyRound}
        />

        <div className="admin-users-v2-info-grid">
          <Info label="Current status" value={ACCOUNT_STATUS_LABELS[view.accountStatus]} />
          <Info label="Enforcement reason" value={member.enforcement_reason || "None recorded"} />
          <Info label="Enforced at" value={formatDate(member.enforced_at, true)} />
          <Info label="Suspended until" value={formatDate(member.suspended_until, true)} />
        </div>

        <div className="admin-users-v2-form-grid">
          <label>
            <span>Enforcement reason</span>
            <input
              type="text"
              value={enforcementReason}
              onChange={(event) => setEnforcementReason(event.target.value)}
              maxLength={240}
              placeholder="Required for warning, suspension, or ban"
            />
          </label>
          <label>
            <span>Suspension end</span>
            <input
              type="datetime-local"
              value={suspendedUntil}
              onChange={(event) => setSuspendedUntil(event.target.value)}
            />
          </label>
          <label className="admin-users-v2-form-wide">
            <span>Internal enforcement note</span>
            <textarea
              value={enforcementNote}
              onChange={(event) => setEnforcementNote(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Optional operational context for the audit record"
            />
          </label>
        </div>

        {isSelf ? (
          <p className="admin-users-v2-inline-note">
            <ShieldAlert aria-hidden="true" size={16} />
            Self-enforcement is disabled for the current Admin account.
          </p>
        ) : null}

        <div className="admin-users-v2-action-row">
          <ActionButton
            label="Warn member"
            Icon={AlertTriangle}
            tone="warning"
            working={workingAction === "warn_user"}
            disabled={isSelf || enforcementWorking}
            onClick={() => void enforceAccount("warn_user")}
          />
          <ActionButton
            label="Suspend member"
            Icon={CalendarClock}
            tone="attention"
            working={workingAction === "suspend_user"}
            disabled={isSelf || enforcementWorking}
            onClick={() => void enforceAccount("suspend_user")}
          />
          <ActionButton
            label="Ban member"
            Icon={Ban}
            tone="danger"
            working={workingAction === "ban_user"}
            disabled={isSelf || enforcementWorking}
            onClick={() => void enforceAccount("ban_user")}
          />
          <ActionButton
            label="Restore active access"
            Icon={UserCheck}
            tone="success"
            working={workingAction === "restore_user"}
            disabled={isSelf || enforcementWorking}
            onClick={() => void enforceAccount("restore_user")}
          />
        </div>
      </section>

      <section className="admin-users-v2-panel">
        <PanelHeading
          eyebrow="Identity review"
          title="Record the verification outcome"
          description="Manual verification records status and internal context only. Loombus does not display identity documents or biometric data in this workspace."
          Icon={Fingerprint}
        />

        <div className="admin-users-v2-info-grid">
          <Info label="Status" value={formatIdentityStatus(view.identityStatus)} />
          <Info label="Provider" value={member.identity_verification_provider || "Not recorded"} />
          <Info label="Legal name" value={member.legal_name_verified ? "Verified" : "Not verified"} />
          <Info label="Verified at" value={formatDate(member.identity_verified_at, true)} />
        </div>

        <label className="admin-users-v2-standalone-field">
          <span>Reason for failed or restricted status</span>
          <input
            type="text"
            value={identityReason}
            onChange={(event) => setIdentityReason(event.target.value)}
            maxLength={500}
            placeholder="Example: Verification could not be completed."
          />
        </label>

        <div className="admin-users-v2-identity-actions">
          {IDENTITY_STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={view.identityStatus === status}
              disabled={identityWorking}
              onClick={() => void updateIdentityVerification(status)}
            >
              {workingAction === `identity:${status}` ? (
                <Loader2 aria-hidden="true" className="admin-users-v2-spin" size={15} />
              ) : view.identityStatus === status ? (
                <CheckCircle2 aria-hidden="true" size={15} />
              ) : null}
              {formatIdentityStatus(status)}
            </button>
          ))}
        </div>
      </section>

      <section className="admin-users-v2-panel">
        <PanelHeading
          eyebrow="Member context"
          title="Age safety and public profile readiness"
          description="Age-safety values come from the protected profile_sensitive record. The raw date of birth is intentionally not exposed to this client workspace."
          Icon={ShieldCheck}
        />

        <div className="admin-users-v2-info-grid">
          <Info label="Age band" value={formatAgeBand(view.ageBand)} />
          <Info label="DOB record" value={member.date_of_birth_on_file ? "On file" : "Missing"} />
          <Info label="Teen Safety Mode" value={member.teen_safety_mode ? "Enabled" : "Not enabled"} />
          <Info label="Guardian required" value={member.guardian_required ? "Yes" : "No"} />
          <Info label="Public profile" value={view.publicProfileComplete ? "Complete" : "Incomplete"} />
          <Info label="Profile issue" value={view.publicProfileIssue || "No completion issue"} />
        </div>

        <div className="admin-users-v2-bio-card">
          <span>Public bio</span>
          <p>{member.bio?.trim() || "No public bio has been provided."}</p>
        </div>
      </section>

      <section className="admin-users-v2-panel">
        <PanelHeading
          eyebrow="Plan and billing"
          title="Review entitlement and billing references"
          description="This view is diagnostic. Plan and usage changes remain in the dedicated AI Access workspace."
          Icon={CreditCard}
        />

        <div className="admin-users-v2-info-grid">
          <Info label="Plan" value={view.planDisplay.label} />
          <Info label="AI enabled" value={member.entitlement?.ai_assisted_enabled ? "Yes" : "No"} />
          <Info label="Summary limit" value={`${member.entitlement?.monthly_summary_limit ?? 0}/month`} />
          <Info label="Writing limit" value={`${member.entitlement?.monthly_writing_limit ?? 0}/month`} />
          <Info label="Research limit" value={`${member.entitlement?.monthly_research_limit ?? 0}/month`} />
          <Info label="Discovery limit" value={`${member.entitlement?.monthly_discovery_limit ?? 0}/month`} />
          <Info label="Stripe status" value={member.entitlement?.stripe_subscription_status || "Not linked"} />
          <Info label="Current period end" value={formatDate(member.entitlement?.stripe_current_period_end, true)} />
          <Info label="Stripe customer" value={maskId(member.entitlement?.stripe_customer_id)} />
          <Info label="Stripe subscription" value={maskId(member.entitlement?.stripe_subscription_id)} />
          <Info label="Entitlement updated" value={formatDate(member.entitlement?.updated_at, true)} />
        </div>
      </section>

      <section className="admin-users-v2-quick-links">
        <Link href="/admin/ai-access">
          <UserRoundCog aria-hidden="true" size={17} />
          Manage entitlement
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
        <Link href="/admin/reports">
          <ShieldAlert aria-hidden="true" size={17} />
          Open reports
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
        <Link href="/admin/audit">
          <Clock3 aria-hidden="true" size={17} />
          Review audit log
          <ChevronRight aria-hidden="true" size={16} />
        </Link>
        {member.username ? (
          <Link href={`/u/${member.username}`} target="_blank">
            <ExternalLink aria-hidden="true" size={17} />
            View public profile
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ) : null}
      </section>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  description,
  Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}) {
  return (
    <div className="admin-users-v2-panel-heading">
      <span><Icon aria-hidden="true" size={19} /></span>
      <div>
        <p className="admin-users-v2-eyebrow">{eyebrow}</p>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-users-v2-info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({
  tone,
  children,
}: {
  tone: "success" | "warning" | "attention" | "danger" | "violet" | "gold" | "muted";
  children: React.ReactNode;
}) {
  return (
    <span className="admin-users-v2-status" data-tone={tone}>
      {children}
    </span>
  );
}

function ActionButton({
  label,
  Icon,
  tone,
  working,
  disabled,
  onClick,
}: {
  label: string;
  Icon: LucideIcon;
  tone: "warning" | "attention" | "danger" | "success";
  working: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="admin-users-v2-action-button"
      data-tone={tone}
      disabled={disabled}
      onClick={onClick}
    >
      {working ? (
        <Loader2 aria-hidden="true" className="admin-users-v2-spin" size={16} />
      ) : (
        <Icon aria-hidden="true" size={16} />
      )}
      {working ? "Updating..." : label}
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="admin-users-v2-filter">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function AdminUsersState({
  eyebrow,
  title,
  description,
  loading = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  loading?: boolean;
}) {
  return (
    <main className="admin-users-v2-page admin-users-v2-state-page">
      <section className="admin-users-v2-state-card">
        {loading ? (
          <Loader2 aria-hidden="true" className="admin-users-v2-spin" size={28} />
        ) : (
          <ShieldAlert aria-hidden="true" size={28} />
        )}
        <p className="admin-users-v2-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {!loading ? (
          <Link href="/admin">
            <ArrowLeft aria-hidden="true" size={16} />
            Return to Admin Operations
          </Link>
        ) : null}
      </section>
    </main>
  );
}
