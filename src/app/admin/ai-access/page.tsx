"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";
import {
  getAiUsageLabel,
  getSubscriptionDisplay,
  getSubscriptionDisplayKey,
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

type AdminPlanKey = "premium" | "premium_plus" | "admin";

const ADMIN_PLAN_LIMITS: Record<AdminPlanKey, Partial<AiEntitlement>> = {
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
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatCurrencyUsd(value: number | string | null | undefined) {
  const numberValue = toNumber(value);

  if (numberValue <= 0) {
    return "$0.00000000";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  }).format(numberValue);
}

function getPlanTextClass(planKey: ReturnType<typeof getSubscriptionDisplayKey>) {
  if (planKey === "admin") {
    return "text-sky-400";
  }

  if (planKey === "premium_plus") {
    return "text-violet-400";
  }

  if (planKey === "premium") {
    return "text-emerald-400";
  }

  return "text-zinc-500";
}

export default function AdminAiAccessPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entitlements, setEntitlements] = useState<AiEntitlement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [message, setMessage] = useState("");
  const [workingUserId, setWorkingUserId] = useState<string | null>(null);
  const [grantUsername, setGrantUsername] = useState("");
  const [grantingPremium, setGrantingPremium] = useState(false);
  const [usageFeatureFilter, setUsageFeatureFilter] = useState("all");
  const [usageStatusFilter, setUsageStatusFilter] = useState("all");

  useEffect(() => {
    async function loadAiAccess() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: adminProfile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (!adminProfile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const response = await fetch("/api/admin/ai-access/entitlements", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(`Unable to load AI entitlements: ${result.error ?? "Unknown error."}`);
        setLoading(false);
        return;
      }

      setEntitlements((result.entitlements ?? []) as AiEntitlement[]);
      setUsageEvents((result.usageEvents ?? []) as UsageEvent[]);

      const profileMap: Record<string, Profile> = {};

      for (const profile of (result.profiles ?? []) as Profile[]) {
        profileMap[profile.id] = profile;
      }

      setProfiles(profileMap);

      setLoading(false);
    }

    loadAiAccess();
  }, []);

  const usageByUser = useMemo(() => {
    const usage: Record<
      string,
      {
        total: number;
        successful: number;
        failed: number;
      }
    > = {};

    for (const event of usageEvents) {
      usage[event.user_id] ??= {
        total: 0,
        successful: 0,
        failed: 0,
      };

      usage[event.user_id].total += 1;

      if (event.success) {
        usage[event.user_id].successful += 1;
      } else {
        usage[event.user_id].failed += 1;
      }
    }

    return usage;
  }, [usageEvents]);

  const usageFeatureOptions = useMemo(() => {
    return [...new Set(usageEvents.map((event) => event.feature_key))].sort();
  }, [usageEvents]);

  const filteredUsageEvents = useMemo(() => {
    return usageEvents.filter((event) => {
      if (
        usageFeatureFilter !== "all" &&
        event.feature_key !== usageFeatureFilter
      ) {
        return false;
      }

      if (usageStatusFilter === "success" && !event.success) {
        return false;
      }

      if (usageStatusFilter === "failed" && event.success) {
        return false;
      }

      if (usageStatusFilter === "cached" && !event.cached) {
        return false;
      }

      if (usageStatusFilter === "generated" && event.cached) {
        return false;
      }

      return true;
    });
  }, [usageEvents, usageFeatureFilter, usageStatusFilter]);

  const costSummary = useMemo(() => {
    const byFeature: Record<
      string,
      {
        featureKey: string;
        estimatedCostUsd: number;
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
        events: number;
      }
    > = {};

    let estimatedCostUsd = 0;
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let pricedEvents = 0;

    for (const event of usageEvents) {
      const eventCost = toNumber(event.estimated_cost_usd);
      const eventPromptTokens = event.prompt_tokens ?? 0;
      const eventCompletionTokens = event.completion_tokens ?? 0;
      const eventTotalTokens = event.total_tokens ?? 0;

      estimatedCostUsd += eventCost;
      promptTokens += eventPromptTokens;
      completionTokens += eventCompletionTokens;
      totalTokens += eventTotalTokens;

      if (eventCost > 0) {
        pricedEvents += 1;
      }

      byFeature[event.feature_key] ??= {
        featureKey: event.feature_key,
        estimatedCostUsd: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        events: 0,
      };

      byFeature[event.feature_key].estimatedCostUsd += eventCost;
      byFeature[event.feature_key].promptTokens += eventPromptTokens;
      byFeature[event.feature_key].completionTokens += eventCompletionTokens;
      byFeature[event.feature_key].totalTokens += eventTotalTokens;
      byFeature[event.feature_key].events += 1;
    }

    return {
      estimatedCostUsd,
      promptTokens,
      completionTokens,
      totalTokens,
      pricedEvents,
      byFeature: Object.values(byFeature).sort(
        (a, b) => b.estimatedCostUsd - a.estimatedCostUsd
      ),
    };
  }, [usageEvents]);


  function formatFeatureKey(featureKey: string) {
    return featureKey
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  async function updateEntitlement(
    userId: string,
    updates: Partial<AiEntitlement>
  ) {
    setMessage("");

    if (workingUserId) {
      return;
    }

    setWorkingUserId(userId);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setWorkingUserId(null);
      window.location.href = "/login";
      return;
    }

    let result: { entitlement?: AiEntitlement; error?: string } = {};

    try {
      const response = await fetch("/api/admin/ai-access/entitlements", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId,
          updates,
        }),
      });

      result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update AI access.");
        setWorkingUserId(null);
        return;
      }
    } catch {
      setMessage("Unable to update AI access.");
      setWorkingUserId(null);
      return;
    }

    if (!result.entitlement) {
      setMessage("AI access updated, but the response was incomplete. Refresh to confirm.");
      setWorkingUserId(null);
      return;
    }

    setEntitlements((current) =>
      current.map((item) =>
        item.user_id === userId ? (result.entitlement as AiEntitlement) : item
      )
    );

    setMessage("AI access updated.");
    setWorkingUserId(null);
  }

  async function setPremium(userId: string) {
    await updateEntitlement(userId, ADMIN_PLAN_LIMITS.premium);
  }

  async function setPremiumPlus(userId: string) {
    await updateEntitlement(userId, ADMIN_PLAN_LIMITS.premium_plus);
  }

  async function setAdmin(userId: string) {
    await updateEntitlement(userId, ADMIN_PLAN_LIMITS.admin);
  }

  async function setFree(userId: string) {
    await updateEntitlement(userId, {
      tier: "free",
      ai_assisted_enabled: false,
      monthly_summary_limit: 0,
      monthly_writing_limit: 0,
      monthly_research_limit: 0,
      monthly_discovery_limit: 0,
    });
  }

  async function grantPremiumByUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (grantingPremium) {
      return;
    }

    const cleanUsername = grantUsername
      .replace(/^@+/, "")
      .trim()
      .toLowerCase();

    if (!cleanUsername) {
      setMessage("Enter a username to grant Premium AI access.");
      return;
    }

    setGrantingPremium(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    if (!accessToken) {
      setGrantingPremium(false);
      window.location.href = "/login";
      return;
    }

    let result: {
      entitlement?: AiEntitlement;
      profile?: Profile;
      error?: string;
    } = {};

    try {
      const response = await fetch("/api/admin/ai-access/entitlements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          username: cleanUsername,
        }),
      });

      result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to grant Premium AI access.");
        setGrantingPremium(false);
        return;
      }
    } catch {
      setMessage("Unable to grant Premium AI access.");
      setGrantingPremium(false);
      return;
    }

    if (!result.entitlement || !result.profile) {
      setMessage("Premium AI access was updated, but the response was incomplete. Refresh to confirm.");
      setGrantingPremium(false);
      return;
    }

    const profile = result.profile;
    const entitlement = result.entitlement;

    setProfiles((current) => ({
      ...current,
      [profile.id]: profile,
    }));

    setEntitlements((current) => {
      const existing = current.some((item) => item.user_id === profile.id);

      if (existing) {
        return current.map((item) =>
          item.user_id === profile.id ? entitlement : item
        );
      }

      return [entitlement, ...current];
    });

    setGrantUsername("");
    setMessage(`Premium AI access granted to @${profile.username ?? cleanUsername}.`);
    setGrantingPremium(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading AI access...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="mb-4 text-5xl font-semibold tracking-tight">
            Access denied.
          </h1>

          <p className="text-zinc-400">
            Admin access is required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              AI Access
            </h1>

            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
              Manage Premium AI-Assisted Layer entitlements and review recent AI usage.
            </p>
          </div>

          <Link
            href="/admin"
            className="w-fit rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to Admin
          </Link>
        </div>

        {message && (
          <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <form
          onSubmit={grantPremiumByUsername}
          className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-6"
        >
          <div className="mb-5">
            <h2 className="mb-2 text-2xl font-medium">
              Grant Premium by username
            </h2>

            <p className="leading-relaxed text-zinc-500">
              Enter a Loombus username to enable Premium with the 50-action monthly limit.
              Use the plan controls below to set Premium Plus or Admin access.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <input
              type="text"
              value={grantUsername}
              onChange={(event) => setGrantUsername(event.target.value)}
              placeholder="username, for example example-user"
              className="min-w-0 flex-1 rounded-2xl border border-zinc-800 bg-black px-5 py-3 text-white outline-none transition placeholder:text-zinc-600 focus:border-zinc-600"
            />

            <button
              type="submit"
              disabled={grantingPremium}
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
            >
              {grantingPremium ? "Granting..." : "Grant Premium"}
            </button>
          </div>
        </form>

        <div className="mb-10 grid gap-6 md:grid-cols-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
              Entitlements
            </p>

            <h2 className="text-4xl font-semibold">
              {entitlements.length}
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
              Premium enabled
            </p>

            <h2 className="text-4xl font-semibold">
              {
                entitlements.filter(
                  (item) =>
                    item.ai_assisted_enabled &&
                    ["premium", "admin"].includes(item.tier)
                ).length
              }
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
              Recent AI events
            </p>

            <h2 className="text-4xl font-semibold">
              {usageEvents.length}
            </h2>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
              Estimated AI cost
            </p>

            <h2 className="text-4xl font-semibold">
              {formatCurrencyUsd(costSummary.estimatedCostUsd)}
            </h2>
          </div>
        </div>


        <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-6">
            <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
              Cost dashboard
            </p>

            <h2 className="text-2xl font-medium">
              AI cost and token usage
            </h2>

            <p className="mt-3 max-w-2xl leading-relaxed text-zinc-500">
              Estimated costs are calculated from provider-reported token usage when
              the model price is known. Cached events and older events without token
              metadata may show zero cost.
            </p>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="mb-2 text-sm text-zinc-500">Estimated cost</p>
              <p className="text-2xl font-semibold">
                {formatCurrencyUsd(costSummary.estimatedCostUsd)}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="mb-2 text-sm text-zinc-500">Total tokens</p>
              <p className="text-2xl font-semibold">
                {costSummary.totalTokens.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="mb-2 text-sm text-zinc-500">Input tokens</p>
              <p className="text-2xl font-semibold">
                {costSummary.promptTokens.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-5">
              <p className="mb-2 text-sm text-zinc-500">Output tokens</p>
              <p className="text-2xl font-semibold">
                {costSummary.completionTokens.toLocaleString()}
              </p>
            </div>
          </div>

          {costSummary.byFeature.length === 0 ? (
            <div className="rounded-2xl border border-zinc-900 bg-black p-5 text-zinc-500">
              No AI usage events are available for cost reporting yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {costSummary.byFeature.slice(0, 8).map((feature) => (
                <div
                  key={feature.featureKey}
                  className="rounded-2xl border border-zinc-900 bg-black p-5"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">
                        {formatFeatureKey(feature.featureKey)}
                      </h3>

                      <p className="text-xs text-zinc-600">
                        {feature.events} events
                      </p>
                    </div>

                    <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">
                      {formatCurrencyUsd(feature.estimatedCostUsd)}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-500">
                    {feature.totalTokens.toLocaleString()} tokens ·{" "}
                    {feature.promptTokens.toLocaleString()} input ·{" "}
                    {feature.completionTokens.toLocaleString()} output
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mb-10 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm uppercase tracking-wide text-zinc-500">
                Diagnostics
              </p>

              <h2 className="text-2xl font-medium">
                Recent AI usage events
              </h2>

              <p className="mt-3 max-w-2xl leading-relaxed text-zinc-500">
                Review Premium AI activity, cache usage, failures, provider details,
                and raw provider errors for admin troubleshooting.
              </p>
            </div>

            <div className="flex flex-col gap-3 md:min-w-72">
              <select
                value={usageFeatureFilter}
                onChange={(event) => setUsageFeatureFilter(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All features</option>
                {usageFeatureOptions.map((featureKey) => (
                  <option key={featureKey} value={featureKey}>
                    {formatFeatureKey(featureKey)}
                  </option>
                ))}
              </select>

              <select
                value={usageStatusFilter}
                onChange={(event) => setUsageStatusFilter(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none transition focus:border-zinc-600"
              >
                <option value="all">All statuses</option>
                <option value="success">Successful</option>
                <option value="failed">Failed</option>
                <option value="cached">Cached</option>
                <option value="generated">Generated</option>
              </select>
            </div>
          </div>

          {filteredUsageEvents.length === 0 ? (
            <div className="rounded-2xl border border-zinc-900 bg-black p-5 text-zinc-500">
              No AI usage events match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-zinc-600">
                  <tr className="border-b border-zinc-900">
                    <th className="py-3 pr-4 font-medium">User</th>
                    <th className="py-3 pr-4 font-medium">Feature</th>
                    <th className="py-3 pr-4 font-medium">Status</th>
                    <th className="py-3 pr-4 font-medium">Provider</th>
                    <th className="py-3 pr-4 font-medium">Tokens</th>
                    <th className="py-3 pr-4 font-medium">Est. cost</th>
                    <th className="py-3 pr-4 font-medium">Target</th>
                    <th className="py-3 pr-4 font-medium">Created</th>
                    <th className="py-3 font-medium">Error</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsageEvents.slice(0, 100).map((event) => {
                    const profile = profiles[event.user_id];

                    return (
                      <tr
                        key={event.id}
                        className="border-b border-zinc-900 align-top text-zinc-400"
                      >
                        <td className="py-4 pr-4">
                          {profile ? (
                            <div className="flex items-center gap-3">
                              <ProfileAvatar profile={profile} />

                              <div>
                                <p className="text-zinc-200">
                                  {getProfileDisplayName(profile)}
                                </p>

                                {profile.username && (
                                  <p className="text-xs text-zinc-600">
                                    @{profile.username}
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-zinc-600">
                              {event.user_id.slice(0, 8)}...
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-4">
                          <span className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300">
                            {formatFeatureKey(event.feature_key)}
                          </span>
                        </td>

                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p className={event.success ? "text-emerald-400" : "text-red-400"}>
                              {event.success ? "Success" : "Failed"}
                            </p>

                            <p className="text-xs text-zinc-600">
                              {event.cached ? "Cached" : "Generated"}
                            </p>
                          </div>
                        </td>

                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p>{event.provider ?? "—"}</p>
                            <p className="text-xs text-zinc-600">
                              {event.model_name ?? "No model"}
                            </p>
                          </div>
                        </td>

                        <td className="py-4 pr-4">
                          <div className="space-y-1">
                            <p>{event.total_tokens?.toLocaleString() ?? "—"}</p>
                            <p className="text-xs text-zinc-600">
                              {(event.prompt_tokens ?? 0).toLocaleString()} in ·{" "}
                              {(event.completion_tokens ?? 0).toLocaleString()} out
                            </p>
                          </div>
                        </td>

                        <td className="py-4 pr-4 text-xs text-zinc-400">
                          {formatCurrencyUsd(event.estimated_cost_usd)}
                        </td>

                        <td className="py-4 pr-4">
                          {event.target_type === "discussion" && event.target_id ? (
                            <Link
                              href={`/discussions/${event.target_id}`}
                              className="text-zinc-300 underline-offset-4 hover:text-white hover:underline"
                            >
                              Open discussion
                            </Link>
                          ) : (
                            <span className="text-zinc-600">
                              {event.target_type ?? "—"}
                            </span>
                          )}
                        </td>

                        <td className="py-4 pr-4 text-xs text-zinc-600">
                          {new Date(event.created_at).toLocaleString()}
                        </td>

                        <td className="max-w-sm py-4">
                          {event.error_message ? (
                            <p className="whitespace-pre-wrap break-words text-xs text-red-300">
                              {event.error_message}
                            </p>
                          ) : (
                            <span className="text-zinc-700">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {entitlements.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-zinc-500">
            No AI entitlements found yet.
          </div>
        ) : (
          <div className="space-y-6">
            {entitlements.map((entitlement) => {
              const profile = profiles[entitlement.user_id];
              const usage = usageByUser[entitlement.user_id] ?? {
                total: 0,
                successful: 0,
                failed: 0,
              };
              const isWorking = workingUserId === entitlement.user_id;
              const planKey = getSubscriptionDisplayKey(entitlement);
              const planDisplay = getSubscriptionDisplay(entitlement);
              const usageLabel = getAiUsageLabel(entitlement);
              const isPremium =
                entitlement.ai_assisted_enabled &&
                ["premium", "premium_plus", "admin"].includes(planKey);
              const isPremiumPlus = planKey === "premium_plus";
              const isAdmin = planKey === "admin";

              return (
                <div
                  key={entitlement.user_id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
                >
                  <div className="mb-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 items-center gap-4">
                      <ProfileAvatar profile={profile} size="xl" />

                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-medium">
                          {getProfileDisplayName(profile)}
                        </h2>

                        <p className="mt-1 text-sm text-zinc-500">
                          {profile?.username ? `@${profile.username}` : entitlement.user_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setPremium(entitlement.user_id)}
                        disabled={isWorking || planKey === "premium"}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {isWorking ? "Updating..." : "Set Premium"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setPremiumPlus(entitlement.user_id)}
                        disabled={isWorking || isPremiumPlus}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition hover:border-violet-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {isWorking ? "Updating..." : "Set Premium Plus"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAdmin(entitlement.user_id)}
                        disabled={isWorking || isAdmin}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-300 transition hover:border-sky-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {isWorking ? "Updating..." : "Set Admin"}
                      </button>

                      <button
                        type="button"
                        onClick={() => setFree(entitlement.user_id)}
                        disabled={isWorking || entitlement.tier === "free"}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        Set Free
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        Tier
                      </p>

                      <p className="text-zinc-300">
                        {planDisplay.label}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        AI enabled
                      </p>

                      <p className={getPlanTextClass(planKey)}>
                        {entitlement.ai_assisted_enabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        Summary limit
                      </p>

                      <p className="text-zinc-300">
                        {usageLabel}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        Recent usage
                      </p>

                      <p className="text-zinc-300">
                        {usage.total} events
                      </p>

                      <p className="mt-1 text-xs text-zinc-600">
                        {usage.successful} success · {usage.failed} failed
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-600">
                    <span>
                      Writing: {entitlement.monthly_writing_limit}/month
                    </span>

                    <span>
                      Research: {entitlement.monthly_research_limit}/month
                    </span>

                    <span>
                      Discovery: {entitlement.monthly_discovery_limit}/month
                    </span>

                    <span>
                      Updated {new Date(entitlement.updated_at).toLocaleString()}
                    </span>
                  </div>

                  {entitlement.notes && (
                    <p className="mt-4 rounded-2xl border border-zinc-900 bg-black p-4 text-sm leading-relaxed text-zinc-500">
                      {entitlement.notes}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
