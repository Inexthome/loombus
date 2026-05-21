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

      const { data: entitlementData, error: entitlementError } = await supabase
        .from("user_ai_entitlements")
        .select(`
          user_id,
          tier,
          ai_assisted_enabled,
          monthly_summary_limit,
          monthly_writing_limit,
          monthly_research_limit,
          monthly_discovery_limit,
          notes,
          updated_at
        `)
        .order("updated_at", { ascending: false });

      if (entitlementError) {
        setMessage(`Unable to load AI entitlements: ${entitlementError.message}`);
        setLoading(false);
        return;
      }

      const loadedEntitlements = (entitlementData ?? []) as AiEntitlement[];
      setEntitlements(loadedEntitlements);

      const userIds = [
        ...new Set(loadedEntitlements.map((item) => item.user_id)),
      ];

      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", userIds);

        const profileMap: Record<string, Profile> = {};

        for (const profile of (profileData ?? []) as Profile[]) {
          profileMap[profile.id] = profile;
        }

        setProfiles(profileMap);
      }

      const { data: usageData } = await supabase
        .from("ai_usage_events")
        .select(`
          id,
          user_id,
          feature_key,
          target_type,
          target_id,
          provider,
          model_name,
          cached,
          success,
          error_message,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(500);

      const loadedUsageEvents = (usageData ?? []) as UsageEvent[];
      setUsageEvents(loadedUsageEvents);

      const usageUserIds = [
        ...new Set(loadedUsageEvents.map((item) => item.user_id)),
      ];

      const missingUsageUserIds = usageUserIds.filter(
        (userId) => !userIds.includes(userId)
      );

      if (missingUsageUserIds.length > 0) {
        const { data: usageProfileData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", missingUsageUserIds);

        const usageProfileMap: Record<string, Profile> = {};

        for (const profile of (usageProfileData ?? []) as Profile[]) {
          usageProfileMap[profile.id] = profile;
        }

        setProfiles((current) => ({
          ...current,
          ...usageProfileMap,
        }));
      }

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

    const { error } = await supabase
      .from("user_ai_entitlements")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    if (error) {
      setMessage(`Unable to update AI access: ${error.message}`);
      setWorkingUserId(null);
      return;
    }

    setEntitlements((current) =>
      current.map((item) =>
        item.user_id === userId
          ? {
              ...item,
              ...updates,
              updated_at: new Date().toISOString(),
            }
          : item
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, full_name, avatar_url")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (profileError) {
      setMessage(`Unable to find user: ${profileError.message}`);
      setGrantingPremium(false);
      return;
    }

    if (!profile) {
      setMessage(`No Loombus profile found for @${cleanUsername}.`);
      setGrantingPremium(false);
      return;
    }

    const updatedAt = new Date().toISOString();

    const { data: entitlement, error: entitlementError } = await supabase
      .from("user_ai_entitlements")
      .upsert(
        {
          user_id: profile.id,
          tier: "premium",
          ai_assisted_enabled: true,
          monthly_summary_limit: 50,
          monthly_writing_limit: 25,
          monthly_research_limit: 10,
          monthly_discovery_limit: 25,
          notes: `Premium AI-Assisted Layer granted by admin for @${cleanUsername}.`,
          updated_at: updatedAt,
        },
        {
          onConflict: "user_id",
        }
      )
      .select(`
        user_id,
        tier,
        ai_assisted_enabled,
        monthly_summary_limit,
        monthly_writing_limit,
        monthly_research_limit,
        monthly_discovery_limit,
        notes,
        updated_at
      `)
      .single();

    if (entitlementError) {
      setMessage(`Unable to grant Premium AI access: ${entitlementError.message}`);
      setGrantingPremium(false);
      return;
    }

    setProfiles((current) => ({
      ...current,
      [profile.id]: profile,
    }));

    setEntitlements((current) => {
      const existing = current.some((item) => item.user_id === profile.id);

      if (existing) {
        return current.map((item) =>
          item.user_id === profile.id ? (entitlement as AiEntitlement) : item
        );
      }

      return [entitlement as AiEntitlement, ...current];
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
              placeholder="username, for example saint"
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

        <div className="mb-10 grid gap-6 md:grid-cols-3">
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
        </div>

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
