"use client";

import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Coins,
  Database,
  Gauge,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  UsersRound,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ProfileAvatar } from "@/components/profile-avatar";
import { supabase } from "@/lib/supabase/client";
import {
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
  type SubscriptionDisplayKey,
} from "@/lib/subscription-plans";

type AiEntitlement = {
  user_id: string;
  tier: string;
  ai_assisted_enabled: boolean;
  monthly_summary_limit: number;
  monthly_writing_limit: number;
  monthly_research_limit: number;
  monthly_discovery_limit: number;
  notes: string | null;
  updated_at: string;
};

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

type UsageEvent = {
  id: string;
  user_id: string;
  feature_key: string;
  target_type: string | null;
  target_id: string | null;
  provider: string | null;
  model_name: string | null;
  cached: boolean;
  success: boolean;
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  estimated_cost_usd: number | string | null;
  created_at: string;
};

type AdminPlanKey = "premium" | "premium_plus" | "admin" | "free";

type UsageAggregate = {
  total: number;
  successful: number;
  failed: number;
  cached: number;
  generated: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  latestAt: string | null;
};

type MetricDefinition = {
  label: string;
  value: string;
  detail: string;
  Icon: LucideIcon;
  priority?: boolean;
};

const ADMIN_PLAN_LIMITS: Record<AdminPlanKey, Partial<AiEntitlement>> = {
  free: {
    tier: "free",
    ai_assisted_enabled: false,
    monthly_summary_limit: 0,
    monthly_writing_limit: 0,
    monthly_research_limit: 0,
    monthly_discovery_limit: 0,
    notes: "Free AI access set by admin.",
  },
  premium: {
    tier: "premium",
    ai_assisted_enabled: true,
    monthly_summary_limit: 50,
    monthly_writing_limit: 25,
    monthly_research_limit: 10,
    monthly_discovery_limit: 25,
    notes: "Premium plan set by admin.",
  },
  premium_plus: {
    tier: "premium",
    ai_assisted_enabled: true,
    monthly_summary_limit: 150,
    monthly_writing_limit: 75,
    monthly_research_limit: 30,
    monthly_discovery_limit: 75,
    notes:
      "Premium Plus plan set by admin. Stored as tier=premium with higher monthly limits until the Premium Plus migration is added.",
  },
  admin: {
    tier: "admin",
    ai_assisted_enabled: true,
    monthly_summary_limit: 999999,
    monthly_writing_limit: 999999,
    monthly_research_limit: 999999,
    monthly_discovery_limit: 999999,
    notes: "Admin AI access set by admin.",
  },
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number | string | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 8,
  }).format(toNumber(value));
}

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
  if (!value) return "No recent activity";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "No recent activity";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;

  return `${Math.floor(days / 30)}mo ago`;
}

function formatFeatureKey(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatTokenLimit(value: number) {
  if (value >= 999999) return "Unlimited/admin";
  return value.toLocaleString();
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

function humanize(value: string) {
  return value.replaceAll("_", " ");
}

function getPlanBadgeClass(planKey: SubscriptionDisplayKey) {
  if (planKey === "admin") return "is-admin";
  if (planKey === "premium_plus") return "is-plus";
  if (planKey === "premium") return "is-premium";
  return "is-free";
}

function createUsageAggregate(): UsageAggregate {
  return {
    total: 0,
    successful: 0,
    failed: 0,
    cached: 0,
    generated: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    latestAt: null,
  };
}

export default function AdminAiAccessV2Client() {
  const [entitlements, setEntitlements] = useState<AiEntitlement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [currentAdminId, setCurrentAdminId] = useState("");
  const [usageLimit, setUsageLimit] = useState(500);
  const [authorized, setAuthorized] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState("");
  const [grantingPremium, setGrantingPremium] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [enabledFilter, setEnabledFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [usageFeatureFilter, setUsageFeatureFilter] = useState("all");
  const [usageStatusFilter, setUsageStatusFilter] = useState("all");
  const [usageSearch, setUsageSearch] = useState("");
  const [copiedValue, setCopiedValue] = useState("");

  const loadAiAccess = useCallback(async (isRefresh = false) => {
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
      const response = await fetch("/api/admin/ai-access", {
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
        setMessage(result.error ?? "Unable to load AI access operations.");
        return;
      }

      const loadedEntitlements = (result.entitlements ?? []) as AiEntitlement[];
      const loadedUsageEvents = (result.usageEvents ?? []) as UsageEvent[];
      const profileMap = ((result.profiles ?? []) as Profile[]).reduce<Record<string, Profile>>(
        (map, profile) => {
          map[profile.id] = profile;
          return map;
        },
        {}
      );
      const params = new URLSearchParams(window.location.search);
      const requestedMember = params.get("member");

      setEntitlements(loadedEntitlements);
      setUsageEvents(loadedUsageEvents);
      setProfiles(profileMap);
      setCurrentAdminId(result.currentAdminId ?? "");
      setUsageLimit(result.usageLimit ?? 500);
      setAuthorized(true);
      setAuthChecked(true);
      setSelectedUserId(
        requestedMember &&
          loadedEntitlements.some((item) => item.user_id === requestedMember)
          ? requestedMember
          : loadedEntitlements[0]?.user_id ?? ""
      );
    } catch {
      setAuthorized(true);
      setAuthChecked(true);
      setMessage("Unable to load AI access operations.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAiAccess();
  }, [loadAiAccess]);

  const usageByUser = useMemo(() => {
    const aggregates: Record<string, UsageAggregate> = {};

    for (const event of usageEvents) {
      const aggregate = aggregates[event.user_id] ?? createUsageAggregate();
      aggregate.total += 1;
      aggregate.successful += event.success ? 1 : 0;
      aggregate.failed += event.success ? 0 : 1;
      aggregate.cached += event.cached ? 1 : 0;
      aggregate.generated += event.cached ? 0 : 1;
      aggregate.promptTokens += event.prompt_tokens ?? 0;
      aggregate.completionTokens += event.completion_tokens ?? 0;
      aggregate.totalTokens += event.total_tokens ?? 0;
      aggregate.estimatedCostUsd += toNumber(event.estimated_cost_usd);
      aggregate.latestAt =
        !aggregate.latestAt || event.created_at > aggregate.latestAt
          ? event.created_at
          : aggregate.latestAt;
      aggregates[event.user_id] = aggregate;
    }

    return aggregates;
  }, [usageEvents]);

  const overallUsage = useMemo(() => {
    const aggregate = createUsageAggregate();

    for (const event of usageEvents) {
      aggregate.total += 1;
      aggregate.successful += event.success ? 1 : 0;
      aggregate.failed += event.success ? 0 : 1;
      aggregate.cached += event.cached ? 1 : 0;
      aggregate.generated += event.cached ? 0 : 1;
      aggregate.promptTokens += event.prompt_tokens ?? 0;
      aggregate.completionTokens += event.completion_tokens ?? 0;
      aggregate.totalTokens += event.total_tokens ?? 0;
      aggregate.estimatedCostUsd += toNumber(event.estimated_cost_usd);
      aggregate.latestAt =
        !aggregate.latestAt || event.created_at > aggregate.latestAt
          ? event.created_at
          : aggregate.latestAt;
    }

    return aggregate;
  }, [usageEvents]);

  const featureOptions = useMemo(
    () => [...new Set(usageEvents.map((event) => event.feature_key))].sort(),
    [usageEvents]
  );

  const featureSummary = useMemo(() => {
    const summary: Record<
      string,
      { events: number; failures: number; tokens: number; cost: number }
    > = {};

    for (const event of usageEvents) {
      summary[event.feature_key] ??= {
        events: 0,
        failures: 0,
        tokens: 0,
        cost: 0,
      };
      summary[event.feature_key].events += 1;
      summary[event.feature_key].failures += event.success ? 0 : 1;
      summary[event.feature_key].tokens += event.total_tokens ?? 0;
      summary[event.feature_key].cost += toNumber(event.estimated_cost_usd);
    }

    return Object.entries(summary)
      .map(([featureKey, values]) => ({ featureKey, ...values }))
      .sort((a, b) => b.cost - a.cost || b.events - a.events);
  }, [usageEvents]);

  const visibleEntitlements = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return entitlements.filter((entitlement) => {
      const profile = profiles[entitlement.user_id];
      const planKey = getSubscriptionDisplayKey(entitlement);
      const accountStatus = getAccountStatus(profile);
      const usage = usageByUser[entitlement.user_id];

      if (planFilter !== "all" && planKey !== planFilter) return false;
      if (enabledFilter === "enabled" && !entitlement.ai_assisted_enabled) return false;
      if (enabledFilter === "disabled" && entitlement.ai_assisted_enabled) return false;
      if (accountFilter !== "all" && accountStatus !== accountFilter) return false;

      if (!query) return true;

      return [
        entitlement.user_id,
        profile?.username,
        profile?.full_name,
        planKey,
        entitlement.tier,
        entitlement.notes,
        accountStatus,
        usage?.latestAt,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    entitlements,
    profiles,
    usageByUser,
    searchQuery,
    planFilter,
    enabledFilter,
    accountFilter,
  ]);

  const selectedEntitlement = useMemo(
    () => entitlements.find((item) => item.user_id === selectedUserId) ?? null,
    [entitlements, selectedUserId]
  );
  const selectedProfile = selectedEntitlement
    ? profiles[selectedEntitlement.user_id]
    : undefined;
  const selectedUsage = selectedEntitlement
    ? usageByUser[selectedEntitlement.user_id] ?? createUsageAggregate()
    : createUsageAggregate();
  const selectedRecentEvents = selectedEntitlement
    ? usageEvents.filter((event) => event.user_id === selectedEntitlement.user_id).slice(0, 12)
    : [];

  const filteredUsageEvents = useMemo(() => {
    const query = usageSearch.trim().toLowerCase();

    return usageEvents.filter((event) => {
      const profile = profiles[event.user_id];

      if (
        usageFeatureFilter !== "all" &&
        event.feature_key !== usageFeatureFilter
      ) {
        return false;
      }

      if (usageStatusFilter === "success" && !event.success) return false;
      if (usageStatusFilter === "failed" && event.success) return false;
      if (usageStatusFilter === "cached" && !event.cached) return false;
      if (usageStatusFilter === "generated" && event.cached) return false;

      if (!query) return true;

      return [
        event.id,
        event.user_id,
        profile?.username,
        profile?.full_name,
        event.feature_key,
        event.provider,
        event.model_name,
        event.target_type,
        event.target_id,
        event.error_message,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    usageEvents,
    profiles,
    usageFeatureFilter,
    usageStatusFilter,
    usageSearch,
  ]);

  const metrics: MetricDefinition[] = [
    {
      label: "Entitlements",
      value: entitlements.length.toLocaleString(),
      detail: "Members with an AI entitlement record.",
      Icon: KeyRound,
      priority: true,
    },
    {
      label: "AI enabled",
      value: entitlements
        .filter((item) => item.ai_assisted_enabled)
        .length.toLocaleString(),
      detail: "Premium or Admin AI access currently enabled.",
      Icon: Sparkles,
    },
    {
      label: "Recent failures",
      value: overallUsage.failed.toLocaleString(),
      detail: `Failures inside the latest ${usageLimit.toLocaleString()} usage events.`,
      Icon: ShieldAlert,
    },
    {
      label: "Estimated cost",
      value: formatCurrency(overallUsage.estimatedCostUsd),
      detail: "Provider-priced cost inside the loaded usage window.",
      Icon: Coins,
    },
  ];

  function selectMember(userId: string) {
    setSelectedUserId(userId);
    const url = new URL(window.location.href);
    url.searchParams.set("member", userId);
    window.history.replaceState({}, "", url);
  }

  function clearFilters() {
    setSearchQuery("");
    setPlanFilter("all");
    setEnabledFilter("all");
    setAccountFilter("all");
  }

  async function updateEntitlement(
    userId: string,
    updates: Partial<AiEntitlement>
  ) {
    if (workingUserId) return;

    setWorkingUserId(userId);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/ai-access/entitlements", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ userId, updates }),
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!response.ok || !result.entitlement) {
        setMessage(result.error ?? "Unable to update AI access.");
        return;
      }

      const entitlement = result.entitlement as AiEntitlement;
      setEntitlements((current) =>
        current.map((item) =>
          item.user_id === userId ? entitlement : item
        )
      );
      setMessage("AI access updated.");
    } catch {
      setMessage("Unable to update AI access.");
    } finally {
      setWorkingUserId(null);
    }
  }

  async function applyPlan(planKey: AdminPlanKey) {
    if (!selectedEntitlement) return;

    const planLabel =
      planKey === "premium_plus"
        ? "Premium Plus"
        : planKey.charAt(0).toUpperCase() + planKey.slice(1);
    const memberName = getProfileName(selectedProfile);
    const confirmed = window.confirm(
      `Set ${memberName} to ${planLabel} AI access? This replaces the current monthly AI limits.`
    );

    if (!confirmed) return;

    await updateEntitlement(
      selectedEntitlement.user_id,
      ADMIN_PLAN_LIMITS[planKey]
    );
  }

  async function grantPremiumByUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (grantingPremium) return;

    const cleanUsername = grantUsername
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();

    if (!cleanUsername) {
      setMessage("Enter a username to grant Premium AI access.");
      return;
    }

    setGrantingPremium(true);
    setMessage("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      window.location.href = "/login";
      return;
    }

    try {
      const response = await fetch("/api/admin/ai-access/entitlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ username: cleanUsername }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.entitlement || !result.profile) {
        setMessage(result.error ?? "Unable to grant Premium AI access.");
        return;
      }

      const entitlement = result.entitlement as AiEntitlement;
      const profile = result.profile as Profile;

      setProfiles((current) => ({ ...current, [profile.id]: profile }));
      setEntitlements((current) => {
        const exists = current.some((item) => item.user_id === profile.id);
        return exists
          ? current.map((item) =>
              item.user_id === profile.id ? entitlement : item
            )
          : [entitlement, ...current];
      });
      setGrantUsername("");
      setSelectedUserId(profile.id);
      setMessage(`Premium AI access granted to @${profile.username ?? cleanUsername}.`);

      const url = new URL(window.location.href);
      url.searchParams.set("member", profile.id);
      window.history.replaceState({}, "", url);
    } catch {
      setMessage("Unable to grant Premium AI access.");
    } finally {
      setGrantingPremium(false);
    }
  }

  async function copyValue(value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedValue(value);
    window.setTimeout(() => setCopiedValue(""), 1600);
  }

  if (loading || !authChecked) {
    return (
      <main className="ai-access-v2-page">
        <div className="ai-access-v2-state-card">
          <Loader2 className="ai-access-v2-spinner" size={24} aria-hidden="true" />
          <h1>Loading AI Access Operations</h1>
          <p>Verifying Admin access and loading entitlement and usage records.</p>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="ai-access-v2-page">
        <div className="ai-access-v2-state-card">
          <ShieldAlert size={26} aria-hidden="true" />
          <h1>Access denied</h1>
          <p>Admin access is required to review or change AI entitlements.</p>
          <Link href="/">Return home</Link>
        </div>
      </main>
    );
  }

  const selectedPlanKey = selectedEntitlement
    ? getSubscriptionDisplayKey(selectedEntitlement)
    : "free";
  const selectedPlan = selectedEntitlement
    ? getSubscriptionDisplay(selectedEntitlement)
    : getSubscriptionDisplay(null);
  const selectedIsWorking = workingUserId === selectedEntitlement?.user_id;

  return (
    <main className="ai-access-v2-page">
      <div className="ai-access-v2-shell">
        <header className="ai-access-v2-hero">
          <div>
            <Link href="/admin" className="ai-access-v2-back-link">
              <ArrowLeft size={15} aria-hidden="true" />
              Admin workspace
            </Link>
            <p className="ai-access-v2-eyebrow">Administration · AI operations</p>
            <h1>AI Access Operations</h1>
            <p>
              Review member entitlements, apply the existing plan presets, and diagnose
              the latest recorded AI usage without changing billing or subscription data.
            </p>
          </div>

          <div className="ai-access-v2-hero-actions">
            <button
              type="button"
              onClick={() => void loadAiAccess(true)}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 className="ai-access-v2-spinner" size={16} aria-hidden="true" />
              ) : (
                <RefreshCw size={16} aria-hidden="true" />
              )}
              {refreshing ? "Refreshing" : "Refresh records"}
            </button>
            <Link href="/admin/billing">Open billing</Link>
          </div>
        </header>

        {message ? (
          <div className="ai-access-v2-notice" role="status">
            <Activity size={17} aria-hidden="true" />
            <span>{message}</span>
          </div>
        ) : null}

        <section className="ai-access-v2-metrics" aria-label="AI access metrics">
          {metrics.map(({ label, value, detail, Icon, priority }) => (
            <article
              key={label}
              className={`ai-access-v2-metric${priority ? " is-priority" : ""}`}
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

        <form className="ai-access-v2-grant" onSubmit={grantPremiumByUsername}>
          <div>
            <p className="ai-access-v2-eyebrow">Direct grant</p>
            <h2>Grant the existing Premium preset by username</h2>
            <p>
              This creates or replaces the member entitlement with 50 summaries, 25
              writing actions, 10 research actions, and 25 discovery actions per month.
            </p>
          </div>
          <div className="ai-access-v2-grant-controls">
            <input
              value={grantUsername}
              onChange={(event) => setGrantUsername(event.target.value)}
              placeholder="username"
              aria-label="Username"
            />
            <button type="submit" disabled={grantingPremium}>
              {grantingPremium ? (
                <Loader2 className="ai-access-v2-spinner" size={16} aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              {grantingPremium ? "Granting" : "Grant Premium"}
            </button>
          </div>
        </form>

        <section className="ai-access-v2-toolbar" aria-label="Entitlement filters">
          <div className="ai-access-v2-search">
            <Search size={17} aria-hidden="true" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search member, username, plan, note, or user ID"
            />
          </div>
          <div className="ai-access-v2-filter-row">
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
              <span>AI state</span>
              <select
                value={enabledFilter}
                onChange={(event) => setEnabledFilter(event.target.value)}
              >
                <option value="all">Enabled and disabled</option>
                <option value="enabled">Enabled</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <label>
              <span>Account</span>
              <select
                value={accountFilter}
                onChange={(event) => setAccountFilter(event.target.value)}
              >
                <option value="all">All account states</option>
                <option value="active">Active</option>
                <option value="warned">Warned</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </label>
            <button type="button" onClick={clearFilters}>Clear filters</button>
          </div>
        </section>

        <section className="ai-access-v2-workspace">
          <aside className="ai-access-v2-queue">
            <header>
              <div>
                <p className="ai-access-v2-eyebrow">Entitlement queue</p>
                <h2>Member access</h2>
              </div>
              <span>{visibleEntitlements.length}</span>
            </header>

            {visibleEntitlements.length ? (
              <div className="ai-access-v2-queue-list">
                {visibleEntitlements.map((entitlement) => {
                  const profile = profiles[entitlement.user_id];
                  const planKey = getSubscriptionDisplayKey(entitlement);
                  const plan = getSubscriptionDisplay(entitlement);
                  const usage = usageByUser[entitlement.user_id] ?? createUsageAggregate();
                  const selected = entitlement.user_id === selectedUserId;

                  return (
                    <button
                      key={entitlement.user_id}
                      type="button"
                      className={selected ? "is-selected" : undefined}
                      onClick={() => selectMember(entitlement.user_id)}
                    >
                      <div className="ai-access-v2-queue-profile">
                        <ProfileAvatar profile={profile} size="sm" />
                        <div>
                          <strong>{getProfileName(profile)}</strong>
                          <span>{getProfileHandle(profile)}</span>
                        </div>
                      </div>
                      <div className="ai-access-v2-queue-top">
                        <span className={`ai-access-v2-badge ${getPlanBadgeClass(planKey)}`}>
                          {plan.label}
                        </span>
                        <time dateTime={usage.latestAt ?? undefined}>
                          {formatRelativeTime(usage.latestAt)}
                        </time>
                      </div>
                      <div className="ai-access-v2-queue-meta">
                        <span>{entitlement.ai_assisted_enabled ? "AI enabled" : "AI disabled"}</span>
                        <span>{usage.total.toLocaleString()} recent events</span>
                        {usage.failed ? <span>{usage.failed} failed</span> : null}
                      </div>
                      <ChevronRight className="ai-access-v2-chevron" size={17} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="ai-access-v2-empty">
                <CheckCircle2 size={24} aria-hidden="true" />
                <h3>{entitlements.length ? "No matching entitlements" : "No entitlement records"}</h3>
                <p>
                  {entitlements.length
                    ? "Adjust or clear the filters to review more members."
                    : "Grant Premium by username to create the first entitlement record."}
                </p>
                {entitlements.length ? (
                  <button type="button" onClick={clearFilters}>Clear filters</button>
                ) : null}
              </div>
            )}
          </aside>

          <article className="ai-access-v2-detail">
            {selectedEntitlement ? (
              <>
                <header className="ai-access-v2-detail-header">
                  <div className="ai-access-v2-detail-profile">
                    <ProfileAvatar profile={selectedProfile} size="xl" />
                    <div>
                      <div className="ai-access-v2-badge-row">
                        <span className={`ai-access-v2-badge ${getPlanBadgeClass(selectedPlanKey)}`}>
                          {selectedPlan.label}
                        </span>
                        <span className="ai-access-v2-badge is-muted">
                          {humanize(getAccountStatus(selectedProfile))}
                        </span>
                        {selectedProfile?.is_admin ? (
                          <span className="ai-access-v2-badge is-admin">Profile Admin</span>
                        ) : null}
                      </div>
                      <h2>{getProfileName(selectedProfile)}</h2>
                      <p>{getProfileHandle(selectedProfile)} · Updated {formatDateTime(selectedEntitlement.updated_at)}</p>
                    </div>
                  </div>
                  <div className="ai-access-v2-detail-links">
                    <Link href={`/admin/users?member=${encodeURIComponent(selectedEntitlement.user_id)}`}>
                      Member Operations
                    </Link>
                    {selectedProfile?.username ? (
                      <Link href={`/u/${encodeURIComponent(selectedProfile.username)}`}>Public profile</Link>
                    ) : null}
                  </div>
                </header>

                <div className="ai-access-v2-detail-body">
                  {getAccountStatus(selectedProfile) !== "active" ? (
                    <section className="ai-access-v2-warning-card">
                      <ShieldAlert size={20} aria-hidden="true" />
                      <div>
                        <h3>Account access is not active</h3>
                        <p>
                          The entitlement record can still be changed here, but account enforcement may prevent the member from using Loombus.
                          {selectedProfile?.enforcement_reason
                            ? ` Recorded reason: ${selectedProfile.enforcement_reason}`
                            : ""}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  <section className="ai-access-v2-plan-card">
                    <div className="ai-access-v2-section-heading">
                      <div>
                        <p className="ai-access-v2-eyebrow">Plan controls</p>
                        <h3>Apply an existing entitlement preset</h3>
                      </div>
                      <span>Changes are audited and do not modify Stripe or billing records.</span>
                    </div>
                    <div className="ai-access-v2-plan-actions">
                      {(["free", "premium", "premium_plus", "admin"] as AdminPlanKey[]).map((planKey) => {
                        const label = planKey === "premium_plus"
                          ? "Premium Plus"
                          : planKey.charAt(0).toUpperCase() + planKey.slice(1);
                        const disabled = selectedIsWorking || selectedPlanKey === planKey;

                        return (
                          <button
                            key={planKey}
                            type="button"
                            disabled={disabled}
                            onClick={() => void applyPlan(planKey)}
                          >
                            {selectedIsWorking ? (
                              <Loader2 className="ai-access-v2-spinner" size={15} aria-hidden="true" />
                            ) : (
                              <KeyRound size={15} aria-hidden="true" />
                            )}
                            {selectedIsWorking ? "Updating" : `Set ${label}`}
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  <section className="ai-access-v2-limits-card">
                    <div className="ai-access-v2-section-heading">
                      <div>
                        <p className="ai-access-v2-eyebrow">Monthly limits</p>
                        <h3>Stored entitlement values</h3>
                      </div>
                      <Gauge size={19} aria-hidden="true" />
                    </div>
                    <div className="ai-access-v2-limit-grid">
                      <div><span>Summaries</span><strong>{formatTokenLimit(selectedEntitlement.monthly_summary_limit)}</strong></div>
                      <div><span>Writing</span><strong>{formatTokenLimit(selectedEntitlement.monthly_writing_limit)}</strong></div>
                      <div><span>Research</span><strong>{formatTokenLimit(selectedEntitlement.monthly_research_limit)}</strong></div>
                      <div><span>Discovery</span><strong>{formatTokenLimit(selectedEntitlement.monthly_discovery_limit)}</strong></div>
                    </div>
                  </section>

                  <div className="ai-access-v2-context-grid">
                    <section className="ai-access-v2-context-card">
                      <div className="ai-access-v2-section-heading">
                        <div>
                          <p className="ai-access-v2-eyebrow">Entitlement record</p>
                          <h3>Access state</h3>
                        </div>
                        <Database size={18} aria-hidden="true" />
                      </div>
                      <dl>
                        <div><dt>Stored tier</dt><dd>{selectedEntitlement.tier}</dd></div>
                        <div><dt>AI assisted</dt><dd>{selectedEntitlement.ai_assisted_enabled ? "Enabled" : "Disabled"}</dd></div>
                        <div><dt>Updated</dt><dd>{formatDateTime(selectedEntitlement.updated_at)}</dd></div>
                        <div><dt>Member ID</dt><dd>{selectedEntitlement.user_id}</dd></div>
                        <div><dt>Current Admin</dt><dd>{currentAdminId}</dd></div>
                      </dl>
                      <div className="ai-access-v2-note">
                        <span>Admin note</span>
                        <p>{selectedEntitlement.notes?.trim() || "No entitlement note recorded."}</p>
                      </div>
                      <div className="ai-access-v2-link-row">
                        <button type="button" onClick={() => void copyValue(selectedEntitlement.user_id)}>
                          <Clipboard size={14} aria-hidden="true" />
                          {copiedValue === selectedEntitlement.user_id ? "Copied" : "Copy member ID"}
                        </button>
                        <Link href={`/admin/audit?search=${encodeURIComponent(selectedEntitlement.user_id)}`}>Audit history</Link>
                      </div>
                    </section>

                    <section className="ai-access-v2-context-card">
                      <div className="ai-access-v2-section-heading">
                        <div>
                          <p className="ai-access-v2-eyebrow">Loaded usage window</p>
                          <h3>Member diagnostics</h3>
                        </div>
                        <Bot size={18} aria-hidden="true" />
                      </div>
                      <div className="ai-access-v2-usage-summary">
                        <div><span>Events</span><strong>{selectedUsage.total.toLocaleString()}</strong></div>
                        <div><span>Failures</span><strong>{selectedUsage.failed.toLocaleString()}</strong></div>
                        <div><span>Tokens</span><strong>{selectedUsage.totalTokens.toLocaleString()}</strong></div>
                        <div><span>Est. cost</span><strong>{formatCurrency(selectedUsage.estimatedCostUsd)}</strong></div>
                      </div>
                      <p className="ai-access-v2-context-copy">
                        These figures cover only the latest {usageLimit.toLocaleString()} platform usage events loaded for this workspace, not a billing ledger or lifetime total.
                      </p>
                    </section>
                  </div>

                  <section className="ai-access-v2-member-events">
                    <div className="ai-access-v2-section-heading">
                      <div>
                        <p className="ai-access-v2-eyebrow">Recent member activity</p>
                        <h3>Latest AI usage events</h3>
                      </div>
                      <span>{selectedRecentEvents.length} shown</span>
                    </div>
                    {selectedRecentEvents.length ? (
                      <div className="ai-access-v2-event-list">
                        {selectedRecentEvents.map((event) => (
                          <article key={event.id}>
                            <div className="ai-access-v2-event-top">
                              <span className={`ai-access-v2-badge ${event.success ? "is-success" : "is-danger"}`}>
                                {event.success ? "Success" : "Failed"}
                              </span>
                              <time dateTime={event.created_at}>{formatRelativeTime(event.created_at)}</time>
                            </div>
                            <h4>{formatFeatureKey(event.feature_key)}</h4>
                            <p>{event.provider ?? "Provider not recorded"} · {event.model_name ?? "Model not recorded"}</p>
                            <div className="ai-access-v2-event-meta">
                              <span>{event.cached ? "Cached" : "Generated"}</span>
                              <span>{(event.total_tokens ?? 0).toLocaleString()} tokens</span>
                              <span>{formatCurrency(event.estimated_cost_usd)}</span>
                            </div>
                            {event.error_message ? <pre>{event.error_message}</pre> : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="ai-access-v2-empty is-inline">
                        <Clock3 size={22} aria-hidden="true" />
                        <h4>No usage events in the loaded window</h4>
                        <p>This entitlement has no matching event among the latest records.</p>
                      </div>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <div className="ai-access-v2-empty is-detail">
                <UserRound size={26} aria-hidden="true" />
                <h3>Select an entitlement</h3>
                <p>Choose a member from the queue to review access, limits, and recent usage.</p>
              </div>
            )}
          </article>
        </section>

        <section className="ai-access-v2-diagnostics">
          <div className="ai-access-v2-section-heading">
            <div>
              <p className="ai-access-v2-eyebrow">Platform diagnostics</p>
              <h2>Latest {usageLimit.toLocaleString()} AI usage events</h2>
            </div>
            <span>Operational telemetry only. This is not the subscription billing ledger.</span>
          </div>

          <div className="ai-access-v2-diagnostic-metrics">
            <div><span>Total events</span><strong>{overallUsage.total.toLocaleString()}</strong></div>
            <div><span>Successful</span><strong>{overallUsage.successful.toLocaleString()}</strong></div>
            <div><span>Failed</span><strong>{overallUsage.failed.toLocaleString()}</strong></div>
            <div><span>Total tokens</span><strong>{overallUsage.totalTokens.toLocaleString()}</strong></div>
            <div><span>Estimated cost</span><strong>{formatCurrency(overallUsage.estimatedCostUsd)}</strong></div>
          </div>

          <div className="ai-access-v2-diagnostic-grid">
            <section className="ai-access-v2-feature-summary">
              <div className="ai-access-v2-section-heading">
                <div><p className="ai-access-v2-eyebrow">Feature cost</p><h3>Highest recorded usage</h3></div>
                <Coins size={18} aria-hidden="true" />
              </div>
              {featureSummary.length ? (
                <div className="ai-access-v2-feature-list">
                  {featureSummary.slice(0, 8).map((feature) => (
                    <article key={feature.featureKey}>
                      <div><strong>{formatFeatureKey(feature.featureKey)}</strong><span>{feature.events} events</span></div>
                      <div><strong>{formatCurrency(feature.cost)}</strong><span>{feature.tokens.toLocaleString()} tokens</span></div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="ai-access-v2-context-copy">No usage events are available for cost reporting.</p>
              )}
            </section>

            <section className="ai-access-v2-usage-feed">
              <div className="ai-access-v2-usage-filters">
                <div className="ai-access-v2-search">
                  <Search size={16} aria-hidden="true" />
                  <input
                    value={usageSearch}
                    onChange={(event) => setUsageSearch(event.target.value)}
                    placeholder="Search usage, provider, model, target, or error"
                  />
                </div>
                <select value={usageFeatureFilter} onChange={(event) => setUsageFeatureFilter(event.target.value)}>
                  <option value="all">All features</option>
                  {featureOptions.map((feature) => (
                    <option key={feature} value={feature}>{formatFeatureKey(feature)}</option>
                  ))}
                </select>
                <select value={usageStatusFilter} onChange={(event) => setUsageStatusFilter(event.target.value)}>
                  <option value="all">All states</option>
                  <option value="success">Successful</option>
                  <option value="failed">Failed</option>
                  <option value="cached">Cached</option>
                  <option value="generated">Generated</option>
                </select>
              </div>

              {filteredUsageEvents.length ? (
                <div className="ai-access-v2-usage-event-list">
                  {filteredUsageEvents.slice(0, 100).map((event) => {
                    const profile = profiles[event.user_id];
                    return (
                      <article key={event.id}>
                        <div className="ai-access-v2-event-top">
                          <div className="ai-access-v2-usage-person">
                            <ProfileAvatar profile={profile} size="sm" />
                            <div><strong>{getProfileName(profile)}</strong><span>{getProfileHandle(profile)}</span></div>
                          </div>
                          <span className={`ai-access-v2-badge ${event.success ? "is-success" : "is-danger"}`}>
                            {event.success ? "Success" : "Failed"}
                          </span>
                        </div>
                        <h4>{formatFeatureKey(event.feature_key)}</h4>
                        <p>{event.provider ?? "Provider not recorded"} · {event.model_name ?? "Model not recorded"}</p>
                        <div className="ai-access-v2-event-meta">
                          <span>{event.cached ? "Cached" : "Generated"}</span>
                          <span>{(event.total_tokens ?? 0).toLocaleString()} tokens</span>
                          <span>{formatCurrency(event.estimated_cost_usd)}</span>
                          <time dateTime={event.created_at}>{formatDateTime(event.created_at)}</time>
                        </div>
                        {event.error_message ? <pre>{event.error_message}</pre> : null}
                        <div className="ai-access-v2-link-row">
                          <button type="button" onClick={() => selectMember(event.user_id)}>Review entitlement</button>
                          {event.target_type === "discussion" && event.target_id ? (
                            <Link href={`/discussions/${event.target_id}`}>Open discussion</Link>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="ai-access-v2-empty is-inline">
                  <XCircle size={22} aria-hidden="true" />
                  <h4>No usage events match the filters</h4>
                  <p>Adjust the feature, status, or search filters.</p>
                </div>
              )}
            </section>
          </div>
        </section>

        <footer className="ai-access-v2-footer-links">
          <Link href="/admin/users"><UsersRound size={15} aria-hidden="true" />Member Operations</Link>
          <Link href="/admin/audit"><Database size={15} aria-hidden="true" />Audit Operations</Link>
          <Link href="/admin/health"><Gauge size={15} aria-hidden="true" />System Health</Link>
          <Link href="/ai-usage"><Bot size={15} aria-hidden="true" />Member AI Usage</Link>
        </footer>
      </div>
    </main>
  );
}
