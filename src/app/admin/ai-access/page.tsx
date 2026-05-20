"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

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
  user_id: string;
  feature_key: string;
  success: boolean;
};

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
        .select("user_id, feature_key, success")
        .order("created_at", { ascending: false })
        .limit(500);

      setUsageEvents((usageData ?? []) as UsageEvent[]);
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
    await updateEntitlement(userId, {
      tier: "premium",
      ai_assisted_enabled: true,
      monthly_summary_limit: 50,
      monthly_writing_limit: 25,
      monthly_research_limit: 10,
      monthly_discovery_limit: 25,
    });
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
              Enter a Loombus username to enable the Premium AI-Assisted Layer
              with default testing limits.
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
              const isPremium =
                entitlement.ai_assisted_enabled &&
                ["premium", "admin"].includes(entitlement.tier);

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
                        disabled={isWorking || isPremium}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {isWorking ? "Updating..." : "Set Premium"}
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
                        {entitlement.tier}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        AI enabled
                      </p>

                      <p className={isPremium ? "text-emerald-400" : "text-zinc-500"}>
                        {entitlement.ai_assisted_enabled ? "Enabled" : "Disabled"}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                      <p className="mb-2 text-xs uppercase tracking-wide text-zinc-600">
                        Summary limit
                      </p>

                      <p className="text-zinc-300">
                        {entitlement.monthly_summary_limit}/month
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
