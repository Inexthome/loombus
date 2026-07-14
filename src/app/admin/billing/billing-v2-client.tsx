"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Coins,
  CreditCard,
  Database,
  Filter,
  Gauge,
  KeyRound,
  Loader2,
  Package,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean | null;
  account_status: string | null;
  enforcement_reason: string | null;
  suspended_until: string | null;
};

type Entitlement = {
  user_id: string;
  tier: string | null;
  ai_assisted_enabled: boolean | null;
  monthly_summary_limit: number | null;
  monthly_writing_limit: number | null;
  monthly_research_limit: number | null;
  monthly_discovery_limit: number | null;
  notes: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  stripe_subscription_status: string | null;
  stripe_current_period_end: string | null;
  updated_at: string | null;
};

type ExtraCreditPack = {
  id: string;
  user_id: string;
  purchased_credits: number | null;
  remaining_credits: number | null;
  status: string | null;
  source: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_id: string | null;
  notes: string | null;
  created_at: string | null;
};

type LedgerEntry = {
  id: string;
  pack_id: string | null;
  user_id: string;
  credits_delta: number | null;
  reason: string | null;
  stripe_checkout_session_id: string | null;
  created_at: string | null;
};

type DiagnosticsResponse = {
  currentAdminId: string;
  generatedAt: string;
  packLimit: number;
  ledgerLimit: number;
  config: Record<string, boolean>;
  entitlementSummary: {
    totalEntitlements: number;
    planCounts: Record<string, number>;
    stripeLinked: number;
    subscriptionLinked: number;
    priceLinked: number;
    subscriptionStatuses: Record<string, number>;
    activeSubscriptions: number;
    syncAttention: number;
    enabledWithoutSubscription: number;
  };
  extraCreditStats: {
    totalPacks: number;
    purchasedCredits: number;
    remainingCredits: number;
    byStatus: Record<string, number>;
  };
  ledgerStats: {
    totalLedgerEntries: number;
    netCreditsDelta: number;
    byReason: Record<string, number>;
  };
  entitlements: Entitlement[];
  packs: ExtraCreditPack[];
  ledger: LedgerEntry[];
  profiles: Profile[];
};

type PlanKey = "free" | "premium" | "premium_plus" | "admin";

type MetricDefinition = {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

const CONFIG_LABELS: Record<string, string> = {
  stripeSecretKey: "Stripe secret key",
  stripeWebhookSecret: "Stripe webhook secret",
  premiumMonthlyPrice: "Premium monthly price",
  premiumMonthlyFallbackPrice: "Premium monthly fallback price",
  premiumAnnualPrice: "Premium annual price",
  premiumPlusMonthlyPrice: "Premium Plus monthly price",
  premiumPlusAnnualPrice: "Premium Plus annual price",
  extraAiPackPrice: "Extra AI Pack price",
  siteUrl: "Site URL",
  supabaseServiceRole: "Supabase service role",
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

  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function maskId(value: string | null | undefined) {
  if (!value) return "Not linked";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function humanize(value: string | null | undefined) {
  if (!value) return "Missing";
  return value
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getPlanKey(entitlement: Entitlement): PlanKey {
  if (!entitlement.ai_assisted_enabled) return "free";
  if (entitlement.tier === "admin") return "admin";

  if (
    entitlement.tier === "premium" &&
    (entitlement.monthly_summary_limit ?? 0) > 50
  ) {
    return "premium_plus";
  }

  if (entitlement.tier === "premium") return "premium";
  return "free";
}

function getPlanLabel(plan: PlanKey) {
  if (plan === "premium_plus") return "Premium Plus";
  if (plan === "premium") return "Premium";
  if (plan === "admin") return "Admin";
  return "Free";
}

function getProfileName(profile: Profile | undefined) {
  return profile?.full_name?.trim() || profile?.username?.trim() || "Unknown member";
}

function getProfileHandle(profile: Profile | undefined) {
  return profile?.username ? `@${profile.username}` : "No public handle";
}

function getAccountStatus(profile: Profile | undefined) {
  return profile?.account_status?.trim() || "unknown";
}

function isRestrictedAccount(profile: Profile | undefined) {
  const status = getAccountStatus(profile).toLowerCase();
  return !["active", "verified", "unknown"].includes(status);
}

function getLinkageState(entitlement: Entitlement) {
  const values = [
    entitlement.stripe_customer_id,
    entitlement.stripe_subscription_id,
    entitlement.stripe_price_id,
  ];
  const linked = values.filter(Boolean).length;
  if (linked === 3) return "complete";
  if (linked === 0) return "unlinked";
  return "partial";
}

function needsSyncAttention(entitlement: Entitlement) {
  const status = entitlement.stripe_subscription_status;
  const active = status === "active" || status === "trialing";
  const periodEnd = entitlement.stripe_current_period_end
    ? new Date(entitlement.stripe_current_period_end).getTime()
    : null;
  const periodExpired =
    periodEnd !== null && Number.isFinite(periodEnd) && periodEnd < Date.now();

  if (
    active &&
    (!entitlement.stripe_customer_id ||
      !entitlement.stripe_subscription_id ||
      !entitlement.stripe_price_id)
  ) {
    return true;
  }

  if (active && periodExpired) return true;
  if (entitlement.stripe_subscription_id && !status) return true;
  return false;
}

function getSubscriptionBadgeClass(status: string | null) {
  if (status === "active" || status === "trialing") return "is-good";
  if (status === "past_due" || status === "incomplete") return "is-warning";
  if (["canceled", "unpaid", "incomplete_expired"].includes(status ?? "")) {
    return "is-danger";
  }
  return "is-neutral";
}

function getPlanBadgeClass(plan: PlanKey) {
  if (plan === "admin") return "is-admin";
  if (plan === "premium_plus") return "is-plus";
  if (plan === "premium") return "is-premium";
  return "is-free";
}

export default function AdminBillingV2Client() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsResponse | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [packSearch, setPackSearch] = useState("");
  const [packStatusFilter, setPackStatusFilter] = useState("all");
  const [ledgerSearch, setLedgerSearch] = useState("");
  const [ledgerReasonFilter, setLedgerReasonFilter] = useState("all");
  const [copiedValue, setCopiedValue] = useState("");

  const loadBilling = useCallback(async (isRefresh = false) => {
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
      const response = await fetch("/api/admin/billing/diagnostics", {
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
        setAuthChecked(true);
        setMessage(result.error ?? "Unable to load billing operations.");
        return;
      }

      const loaded = result as DiagnosticsResponse;
      const requestedMember = new URLSearchParams(window.location.search).get("member");

      setDiagnostics(loaded);
      setAuthorized(true);
      setAuthChecked(true);
      setSelectedUserId(
        requestedMember &&
          loaded.entitlements.some((item) => item.user_id === requestedMember)
          ? requestedMember
          : loaded.entitlements[0]?.user_id ?? ""
      );
    } catch {
      setAuthorized(true);
      setAuthChecked(true);
      setMessage("Unable to load billing operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const profiles = useMemo(() => {
    return (diagnostics?.profiles ?? []).reduce<Record<string, Profile>>((map, profile) => {
      map[profile.id] = profile;
      return map;
    }, {});
  }, [diagnostics]);

  const statusOptions = useMemo(
    () =>
      [...new Set((diagnostics?.entitlements ?? []).map((item) => item.stripe_subscription_status ?? "missing"))].sort(),
    [diagnostics]
  );

  const packStatusOptions = useMemo(
    () =>
      [...new Set((diagnostics?.packs ?? []).map((item) => item.status ?? "unknown"))].sort(),
    [diagnostics]
  );

  const ledgerReasonOptions = useMemo(
    () =>
      [...new Set((diagnostics?.ledger ?? []).map((item) => item.reason ?? "unknown"))].sort(),
    [diagnostics]
  );

  const filteredEntitlements = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return (diagnostics?.entitlements ?? []).filter((entitlement) => {
      const profile = profiles[entitlement.user_id];
      const plan = getPlanKey(entitlement);
      const status = entitlement.stripe_subscription_status ?? "missing";
      const linkage = getLinkageState(entitlement);
      const accountStatus = getAccountStatus(profile);

      if (planFilter !== "all" && plan !== planFilter) return false;
      if (statusFilter !== "all" && status !== statusFilter) return false;

      if (linkFilter === "attention" && !needsSyncAttention(entitlement)) return false;
      if (
        ["complete", "partial", "unlinked"].includes(linkFilter) &&
        linkage !== linkFilter
      ) {
        return false;
      }

      if (accountFilter === "active" && accountStatus !== "active") return false;
      if (accountFilter === "restricted" && !isRestrictedAccount(profile)) return false;
      if (accountFilter === "unknown" && accountStatus !== "unknown") return false;

      if (!query) return true;

      return [
        entitlement.user_id,
        entitlement.tier,
        plan,
        status,
        entitlement.notes,
        entitlement.stripe_customer_id,
        entitlement.stripe_subscription_id,
        entitlement.stripe_price_id,
        profile?.username,
        profile?.full_name,
        accountStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    diagnostics,
    profiles,
    searchQuery,
    planFilter,
    statusFilter,
    linkFilter,
    accountFilter,
  ]);

  useEffect(() => {
    if (
      filteredEntitlements.length > 0 &&
      !filteredEntitlements.some((item) => item.user_id === selectedUserId)
    ) {
      setSelectedUserId(filteredEntitlements[0].user_id);
    }
  }, [filteredEntitlements, selectedUserId]);

  const selectedEntitlement = useMemo(
    () =>
      filteredEntitlements.find((item) => item.user_id === selectedUserId) ??
      filteredEntitlements[0] ??
      null,
    [filteredEntitlements, selectedUserId]
  );

  const filteredPacks = useMemo(() => {
    const query = packSearch.trim().toLowerCase();

    return (diagnostics?.packs ?? []).filter((pack) => {
      const profile = profiles[pack.user_id];
      const status = pack.status ?? "unknown";
      if (packStatusFilter !== "all" && status !== packStatusFilter) return false;
      if (!query) return true;

      return [
        pack.id,
        pack.user_id,
        pack.status,
        pack.source,
        pack.stripe_checkout_session_id,
        pack.stripe_payment_intent_id,
        pack.stripe_customer_id,
        pack.notes,
        profile?.username,
        profile?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [diagnostics, profiles, packSearch, packStatusFilter]);

  const filteredLedger = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase();

    return (diagnostics?.ledger ?? []).filter((entry) => {
      const profile = profiles[entry.user_id];
      const reason = entry.reason ?? "unknown";
      if (ledgerReasonFilter !== "all" && reason !== ledgerReasonFilter) return false;
      if (!query) return true;

      return [
        entry.id,
        entry.pack_id,
        entry.user_id,
        entry.reason,
        entry.stripe_checkout_session_id,
        profile?.username,
        profile?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [diagnostics, profiles, ledgerSearch, ledgerReasonFilter]);

  const configSummary = useMemo(() => {
    const entries = Object.entries(diagnostics?.config ?? {});
    return {
      configured: entries.filter(([, present]) => present).length,
      total: entries.length,
      missing: entries.filter(([, present]) => !present).map(([key]) => key),
    };
  }, [diagnostics]);

  const metrics = useMemo<MetricDefinition[]>(() => {
    if (!diagnostics) return [];

    return [
      {
        label: "Configuration",
        value: `${configSummary.configured}/${configSummary.total}`,
        detail: `${configSummary.missing.length} required or optional values missing`,
        Icon: KeyRound,
        priority: configSummary.missing.length > 0,
      },
      {
        label: "Active subscriptions",
        value: diagnostics.entitlementSummary.activeSubscriptions.toLocaleString(),
        detail: "Stripe status is active or trialing",
        Icon: CreditCard,
      },
      {
        label: "Billing linked",
        value: diagnostics.entitlementSummary.subscriptionLinked.toLocaleString(),
        detail: "Entitlements with a Stripe subscription ID",
        Icon: UsersRound,
      },
      {
        label: "Sync attention",
        value: diagnostics.entitlementSummary.syncAttention.toLocaleString(),
        detail: "Records with incomplete or stale active billing identity",
        Icon: AlertTriangle,
        priority: diagnostics.entitlementSummary.syncAttention > 0,
      },
      {
        label: "Extra AI Packs",
        value: diagnostics.extraCreditStats.totalPacks.toLocaleString(),
        detail: `${diagnostics.extraCreditStats.remainingCredits.toLocaleString()} credits remain`,
        Icon: Package,
      },
      {
        label: "Credit ledger",
        value: diagnostics.ledgerStats.totalLedgerEntries.toLocaleString(),
        detail: `${diagnostics.ledgerStats.netCreditsDelta.toLocaleString()} net credit delta`,
        Icon: Database,
      },
    ];
  }, [diagnostics, configSummary]);

  function selectMember(userId: string) {
    setSelectedUserId(userId);
    const params = new URLSearchParams(window.location.search);
    params.set("member", userId);
    window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
  }

  function clearEntitlementFilters() {
    setSearchQuery("");
    setPlanFilter("all");
    setStatusFilter("all");
    setLinkFilter("all");
    setAccountFilter("all");
  }

  async function copyValue(value: string | null, label: string) {
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(label);
      window.setTimeout(() => setCopiedValue(""), 1600);
    } catch {
      setMessage(`Unable to copy ${label.toLowerCase()}.`);
    }
  }

  if (loading || !authChecked) {
    return (
      <main className="billing-v2-page">
        <section className="billing-v2-state">
          <Loader2 className="billing-v2-spinner" aria-hidden="true" />
          <p>Billing Operations</p>
          <h1>Loading billing records...</h1>
        </section>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="billing-v2-page">
        <section className="billing-v2-state is-denied">
          <ShieldCheck aria-hidden="true" />
          <p>Billing Operations</p>
          <h1>Admin access is required.</h1>
          <Link href="/" className="billing-v2-primary-button">
            Return to Loombus
          </Link>
        </section>
      </main>
    );
  }

  if (!diagnostics) {
    return (
      <main className="billing-v2-page">
        <section className="billing-v2-state is-error">
          <AlertTriangle aria-hidden="true" />
          <p>Billing Operations</p>
          <h1>Billing diagnostics could not be loaded.</h1>
          <span>{message || "Try refreshing the workspace."}</span>
          <button
            type="button"
            className="billing-v2-primary-button"
            onClick={() => void loadBilling()}
          >
            Retry
          </button>
        </section>
      </main>
    );
  }

  const selectedProfile = selectedEntitlement
    ? profiles[selectedEntitlement.user_id]
    : undefined;
  const selectedPlan = selectedEntitlement
    ? getPlanKey(selectedEntitlement)
    : "free";
  const selectedLinkage = selectedEntitlement
    ? getLinkageState(selectedEntitlement)
    : "unlinked";
  const selectedNeedsAttention = selectedEntitlement
    ? needsSyncAttention(selectedEntitlement)
    : false;

  return (
    <main className="billing-v2-page">
      <div className="billing-v2-shell">
        <header className="billing-v2-hero">
          <div>
            <Link href="/admin" className="billing-v2-back-link">
              <ArrowLeft aria-hidden="true" />
              Admin
            </Link>
            <p className="billing-v2-eyebrow">Administration</p>
            <h1>Billing Operations</h1>
            <p className="billing-v2-intro">
              Review configuration readiness, Stripe identity synchronization, subscription state,
              Extra AI Pack fulfillment, and credit-ledger activity. This workspace is read-only.
            </p>
          </div>

          <div className="billing-v2-hero-actions">
            <button
              type="button"
              className="billing-v2-secondary-button"
              onClick={() => void loadBilling(true)}
              disabled={refreshing}
            >
              <RefreshCw className={refreshing ? "is-spinning" : ""} aria-hidden="true" />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
            <Link href="/admin/ai-access" className="billing-v2-primary-button">
              AI Access
              <ChevronRight aria-hidden="true" />
            </Link>
          </div>
        </header>

        <nav className="billing-v2-context-links" aria-label="Billing operations navigation">
          <Link href="/admin/users">Member Operations</Link>
          <Link href="/admin/audit?search=billing">Audit</Link>
          <Link href="/admin/health">Health</Link>
          <Link href="/premium">Premium Center</Link>
        </nav>

        {message ? (
          <div className="billing-v2-message" role="status" aria-live="polite">
            <AlertTriangle aria-hidden="true" />
            <span>{message}</span>
          </div>
        ) : null}

        <section className="billing-v2-metrics" aria-label="Billing summary">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article
              key={label}
              className={`billing-v2-metric${priority ? " is-priority" : ""}`}
            >
              <Icon aria-hidden="true" />
              <div>
                <p>{label}</p>
                <strong>{value}</strong>
                <span>{detail}</span>
              </div>
            </article>
          ))}
        </section>

        <section className="billing-v2-config-panel">
          <div className="billing-v2-section-heading">
            <div>
              <p className="billing-v2-section-eyebrow">Configuration readiness</p>
              <h2>Safe environment-presence checks</h2>
              <span>
                Secret values are never returned. This panel only confirms whether each value exists.
              </span>
            </div>
            <div className={`billing-v2-config-score${configSummary.missing.length ? " has-missing" : ""}`}>
              <Gauge aria-hidden="true" />
              <strong>{configSummary.configured}/{configSummary.total}</strong>
              <span>configured</span>
            </div>
          </div>

          <div className="billing-v2-config-grid">
            {Object.entries(diagnostics.config).map(([key, present]) => (
              <article key={key} className={`billing-v2-config-item${present ? " is-ready" : " is-missing"}`}>
                {present ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
                <div>
                  <strong>{CONFIG_LABELS[key] ?? humanize(key)}</strong>
                  <span>{present ? "Configured" : "Missing"}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="billing-v2-workspace">
          <aside className="billing-v2-queue-panel">
            <div className="billing-v2-panel-heading">
              <div>
                <p className="billing-v2-section-eyebrow">Subscription records</p>
                <h2>Entitlement queue</h2>
                <span>
                  Showing {filteredEntitlements.length} of {diagnostics.entitlements.length} records
                </span>
              </div>
              <Filter aria-hidden="true" />
            </div>

            <div className="billing-v2-filter-stack">
              <label className="billing-v2-search-field">
                <Search aria-hidden="true" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search member, Stripe ID, note..."
                />
              </label>

              <div className="billing-v2-filter-grid">
                <label>
                  <span>Plan</span>
                  <select value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}>
                    <option value="all">All plans</option>
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="premium_plus">Premium Plus</option>
                    <option value="admin">Admin</option>
                  </select>
                </label>

                <label>
                  <span>Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>{humanize(status)}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Linkage</span>
                  <select value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)}>
                    <option value="all">All linkage states</option>
                    <option value="complete">Complete</option>
                    <option value="partial">Partial</option>
                    <option value="unlinked">Unlinked</option>
                    <option value="attention">Needs attention</option>
                  </select>
                </label>

                <label>
                  <span>Account</span>
                  <select value={accountFilter} onChange={(event) => setAccountFilter(event.target.value)}>
                    <option value="all">All accounts</option>
                    <option value="active">Active</option>
                    <option value="restricted">Restricted</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </label>
              </div>

              <button type="button" className="billing-v2-clear-button" onClick={clearEntitlementFilters}>
                Clear filters
              </button>
            </div>

            <div className="billing-v2-queue-list">
              {filteredEntitlements.map((entitlement) => {
                const profile = profiles[entitlement.user_id];
                const plan = getPlanKey(entitlement);
                const status = entitlement.stripe_subscription_status;
                const attention = needsSyncAttention(entitlement);

                return (
                  <button
                    type="button"
                    key={entitlement.user_id}
                    className={`billing-v2-queue-item${selectedEntitlement?.user_id === entitlement.user_id ? " is-selected" : ""}`}
                    onClick={() => selectMember(entitlement.user_id)}
                  >
                    <ProfileAvatar profile={profile} size="md" />
                    <div className="billing-v2-queue-copy">
                      <div>
                        <strong>{getProfileName(profile)}</strong>
                        {attention ? <AlertTriangle aria-label="Needs synchronization review" /> : null}
                      </div>
                      <span>{getProfileHandle(profile)}</span>
                      <div className="billing-v2-queue-badges">
                        <span className={`billing-v2-badge ${getPlanBadgeClass(plan)}`}>
                          {getPlanLabel(plan)}
                        </span>
                        <span className={`billing-v2-badge ${getSubscriptionBadgeClass(status)}`}>
                          {humanize(status)}
                        </span>
                      </div>
                    </div>
                    <ChevronRight aria-hidden="true" />
                  </button>
                );
              })}

              {filteredEntitlements.length === 0 ? (
                <div className="billing-v2-empty-card">
                  <Search aria-hidden="true" />
                  <strong>No subscription records match.</strong>
                  <span>Adjust or clear the current filters.</span>
                </div>
              ) : null}
            </div>
          </aside>

          <section className="billing-v2-detail-panel">
            {selectedEntitlement ? (
              <>
                <div className="billing-v2-member-header">
                  <div className="billing-v2-member-identity">
                    <ProfileAvatar profile={selectedProfile} size="xl" />
                    <div>
                      <p className="billing-v2-section-eyebrow">Selected billing record</p>
                      <h2>{getProfileName(selectedProfile)}</h2>
                      <span>{getProfileHandle(selectedProfile)} · {humanize(getAccountStatus(selectedProfile))}</span>
                    </div>
                  </div>
                  <div className="billing-v2-member-badges">
                    <span className={`billing-v2-badge ${getPlanBadgeClass(selectedPlan)}`}>
                      {getPlanLabel(selectedPlan)}
                    </span>
                    <span className={`billing-v2-badge ${getSubscriptionBadgeClass(selectedEntitlement.stripe_subscription_status)}`}>
                      {humanize(selectedEntitlement.stripe_subscription_status)}
                    </span>
                  </div>
                </div>

                <div className="billing-v2-action-links">
                  <Link href={`/admin/users?user=${selectedEntitlement.user_id}`}>Member Operations</Link>
                  <Link href={`/admin/ai-access?member=${selectedEntitlement.user_id}`}>AI Access</Link>
                  <Link href={`/admin/audit?search=${selectedEntitlement.user_id}`}>Audit history</Link>
                  {selectedProfile?.username ? (
                    <Link href={`/u/${selectedProfile.username}`}>Public profile</Link>
                  ) : null}
                </div>

                {selectedNeedsAttention ? (
                  <div className="billing-v2-attention-card">
                    <AlertTriangle aria-hidden="true" />
                    <div>
                      <strong>Synchronization review recommended</strong>
                      <span>
                        This active or linked record has incomplete billing identity, a missing status,
                        or an active period end that is already in the past.
                      </span>
                    </div>
                  </div>
                ) : null}

                {isRestrictedAccount(selectedProfile) ? (
                  <div className="billing-v2-restriction-card">
                    <ShieldCheck aria-hidden="true" />
                    <div>
                      <strong>Member account is {humanize(getAccountStatus(selectedProfile))}</strong>
                      <span>
                        {selectedProfile?.enforcement_reason ||
                          "Review Member Operations before interpreting billing and access state."}
                      </span>
                    </div>
                  </div>
                ) : null}

                <div className="billing-v2-detail-section">
                  <div className="billing-v2-subheading">
                    <CreditCard aria-hidden="true" />
                    <div>
                      <h3>Stripe identity</h3>
                      <span>Linkage state: {humanize(selectedLinkage)}</span>
                    </div>
                  </div>

                  <div className="billing-v2-data-grid">
                    <CopyField
                      label="Customer ID"
                      value={selectedEntitlement.stripe_customer_id}
                      copied={copiedValue === "Customer ID"}
                      onCopy={() => void copyValue(selectedEntitlement.stripe_customer_id, "Customer ID")}
                    />
                    <CopyField
                      label="Subscription ID"
                      value={selectedEntitlement.stripe_subscription_id}
                      copied={copiedValue === "Subscription ID"}
                      onCopy={() => void copyValue(selectedEntitlement.stripe_subscription_id, "Subscription ID")}
                    />
                    <CopyField
                      label="Price ID"
                      value={selectedEntitlement.stripe_price_id}
                      copied={copiedValue === "Price ID"}
                      onCopy={() => void copyValue(selectedEntitlement.stripe_price_id, "Price ID")}
                    />
                    <DataPoint label="Subscription status" value={humanize(selectedEntitlement.stripe_subscription_status)} />
                    <DataPoint label="Current period end" value={formatDateTime(selectedEntitlement.stripe_current_period_end)} />
                    <DataPoint label="Record updated" value={formatDateTime(selectedEntitlement.updated_at)} />
                  </div>
                </div>

                <div className="billing-v2-detail-section">
                  <div className="billing-v2-subheading">
                    <Coins aria-hidden="true" />
                    <div>
                      <h3>Entitlement synchronization</h3>
                      <span>Access values currently stored in user_ai_entitlements</span>
                    </div>
                  </div>

                  <div className="billing-v2-data-grid">
                    <DataPoint label="Stored tier" value={humanize(selectedEntitlement.tier)} />
                    <DataPoint label="AI assisted" value={selectedEntitlement.ai_assisted_enabled ? "Enabled" : "Disabled"} />
                    <DataPoint label="Summary limit" value={(selectedEntitlement.monthly_summary_limit ?? 0).toLocaleString()} />
                    <DataPoint label="Writing limit" value={(selectedEntitlement.monthly_writing_limit ?? 0).toLocaleString()} />
                    <DataPoint label="Research limit" value={(selectedEntitlement.monthly_research_limit ?? 0).toLocaleString()} />
                    <DataPoint label="Discovery limit" value={(selectedEntitlement.monthly_discovery_limit ?? 0).toLocaleString()} />
                  </div>

                  <div className="billing-v2-note-card">
                    <span>Admin or webhook note</span>
                    <p>{selectedEntitlement.notes || "No entitlement note recorded."}</p>
                  </div>
                </div>

                <div className="billing-v2-record-footer">
                  <span>Member ID: {selectedEntitlement.user_id}</span>
                  <span>Generated: {formatDateTime(diagnostics.generatedAt)}</span>
                </div>
              </>
            ) : (
              <div className="billing-v2-empty-detail">
                <UserRound aria-hidden="true" />
                <h2>No billing record selected.</h2>
                <p>Select an entitlement from the queue to review its synchronization state.</p>
              </div>
            )}
          </section>
        </section>

        <section className="billing-v2-records-section">
          <div className="billing-v2-section-heading">
            <div>
              <p className="billing-v2-section-eyebrow">Extra AI Pack fulfillment</p>
              <h2>Recent pack records</h2>
              <span>
                The latest {diagnostics.packLimit} records are loaded. Showing {filteredPacks.length}.
              </span>
            </div>
            <Package aria-hidden="true" />
          </div>

          <div className="billing-v2-inline-filters">
            <label className="billing-v2-search-field">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={packSearch}
                onChange={(event) => setPackSearch(event.target.value)}
                placeholder="Search pack, member, checkout..."
              />
            </label>
            <label>
              <span>Pack status</span>
              <select value={packStatusFilter} onChange={(event) => setPackStatusFilter(event.target.value)}>
                <option value="all">All statuses</option>
                {packStatusOptions.map((status) => (
                  <option key={status} value={status}>{humanize(status)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="billing-v2-pack-grid">
            {filteredPacks.map((pack) => {
              const profile = profiles[pack.user_id];
              const purchased = pack.purchased_credits ?? 0;
              const remaining = pack.remaining_credits ?? 0;
              const used = Math.max(0, purchased - remaining);
              const percentage = purchased > 0 ? Math.min(100, Math.round((remaining / purchased) * 100)) : 0;

              return (
                <article key={pack.id} className="billing-v2-pack-card">
                  <div className="billing-v2-pack-header">
                    <div className="billing-v2-pack-member">
                      <ProfileAvatar profile={profile} size="md" />
                      <div>
                        <strong>{getProfileName(profile)}</strong>
                        <span>{getProfileHandle(profile)}</span>
                      </div>
                    </div>
                    <span className={`billing-v2-badge ${pack.status === "active" ? "is-good" : "is-neutral"}`}>
                      {humanize(pack.status)}
                    </span>
                  </div>

                  <div className="billing-v2-credit-summary">
                    <div>
                      <strong>{remaining.toLocaleString()}</strong>
                      <span>credits remaining</span>
                    </div>
                    <span>{used.toLocaleString()} used of {purchased.toLocaleString()}</span>
                  </div>
                  <div className="billing-v2-progress-track" aria-label={`${percentage}% of credits remain`}>
                    <span style={{ width: `${percentage}%` }} />
                  </div>

                  <div className="billing-v2-pack-details">
                    <DataPoint label="Source" value={humanize(pack.source)} compact />
                    <DataPoint label="Created" value={formatDateTime(pack.created_at)} compact />
                    <DataPoint label="Checkout" value={maskId(pack.stripe_checkout_session_id)} compact />
                    <DataPoint label="Payment intent" value={maskId(pack.stripe_payment_intent_id)} compact />
                  </div>

                  {pack.notes ? <p className="billing-v2-pack-note">{pack.notes}</p> : null}

                  <div className="billing-v2-card-links">
                    <Link href={`/admin/ai-access?member=${pack.user_id}`}>AI Access</Link>
                    <Link href={`/admin/audit?search=${pack.id}`}>Audit search</Link>
                  </div>
                </article>
              );
            })}

            {filteredPacks.length === 0 ? (
              <div className="billing-v2-empty-card is-wide">
                <Package aria-hidden="true" />
                <strong>No Extra AI Pack records match.</strong>
                <span>Adjust the pack search or status filter.</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="billing-v2-records-section">
          <div className="billing-v2-section-heading">
            <div>
              <p className="billing-v2-section-eyebrow">Credit accounting</p>
              <h2>Recent ledger activity</h2>
              <span>
                The latest {diagnostics.ledgerLimit} ledger entries are loaded. Showing {filteredLedger.length}.
              </span>
            </div>
            <ReceiptText aria-hidden="true" />
          </div>

          <div className="billing-v2-inline-filters">
            <label className="billing-v2-search-field">
              <Search aria-hidden="true" />
              <input
                type="search"
                value={ledgerSearch}
                onChange={(event) => setLedgerSearch(event.target.value)}
                placeholder="Search entry, pack, member, checkout..."
              />
            </label>
            <label>
              <span>Ledger reason</span>
              <select value={ledgerReasonFilter} onChange={(event) => setLedgerReasonFilter(event.target.value)}>
                <option value="all">All reasons</option>
                {ledgerReasonOptions.map((reason) => (
                  <option key={reason} value={reason}>{humanize(reason)}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="billing-v2-ledger-list">
            {filteredLedger.map((entry) => {
              const profile = profiles[entry.user_id];
              const delta = entry.credits_delta ?? 0;

              return (
                <article key={entry.id} className="billing-v2-ledger-card">
                  <div className={`billing-v2-ledger-delta${delta < 0 ? " is-negative" : " is-positive"}`}>
                    {delta > 0 ? "+" : ""}{delta.toLocaleString()}
                  </div>
                  <div className="billing-v2-ledger-main">
                    <div>
                      <strong>{humanize(entry.reason)}</strong>
                      <span>{getProfileName(profile)} · {formatRelativeTime(entry.created_at)}</span>
                    </div>
                    <div className="billing-v2-ledger-meta">
                      <span>Entry {maskId(entry.id)}</span>
                      <span>Pack {maskId(entry.pack_id)}</span>
                      <span>Checkout {maskId(entry.stripe_checkout_session_id)}</span>
                    </div>
                  </div>
                  <Link href={`/admin/ai-access?member=${entry.user_id}`} className="billing-v2-ledger-link">
                    Member
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </article>
              );
            })}

            {filteredLedger.length === 0 ? (
              <div className="billing-v2-empty-card is-wide">
                <ReceiptText aria-hidden="true" />
                <strong>No ledger entries match.</strong>
                <span>Adjust the ledger search or reason filter.</span>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="billing-v2-footer-note">
          <ShieldCheck aria-hidden="true" />
          <p>
            Billing Operations does not change subscriptions, issue refunds, expose secret values,
            or edit Stripe records. Subscription lifecycle changes remain owned by Stripe webhooks,
            Apple purchase flows, and the existing entitlement synchronization contracts.
          </p>
        </footer>
      </div>
    </main>
  );
}

function DataPoint({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={`billing-v2-data-point${compact ? " is-compact" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CopyField({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string | null;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div className="billing-v2-copy-field">
      <span>{label}</span>
      <div>
        <strong title={value ?? "Not linked"}>{maskId(value)}</strong>
        <button type="button" onClick={onCopy} disabled={!value} aria-label={`Copy ${label}`}>
          {copied ? <CheckCircle2 aria-hidden="true" /> : <Clipboard aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
