"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type SafetyMetadata = Record<string, unknown> | null;

type SafetyEvent = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: SafetyMetadata;
  created_at: string;
  actor_id: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type AccountEnforcementAction = "warn_user" | "suspend_user" | "ban_user";

function getMetadataString(metadata: SafetyMetadata, key: string) {
  const value = metadata?.[key];

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return "";
}

function getBadgeClass(action: string) {
  if (action === "content_safety.blocked") {
    return "border-red-900 text-red-300";
  }

  return "border-amber-800 text-amber-300";
}

function getActionLabel(action: string) {
  return action === "content_safety.blocked"
    ? "Blocked"
    : "Warned";
}

function getSearchText(event: SafetyEvent, profile: Profile | undefined) {
  return [
    event.action,
    event.target_type,
    event.target_id,
    event.actor_id,
    profile?.username,
    profile?.full_name,
    JSON.stringify(event.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AdminSafetyPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<SafetyEvent[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [message, setMessage] = useState("");
  const [enforcingEventId, setEnforcingEventId] = useState<string | null>(null);

  useEffect(() => {
    async function loadSafetyEvents() {
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", userData.user.id)
        .single();

      if (!profile?.is_admin) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);

      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, target_type, target_id, metadata, created_at, actor_id")
        .in("action", ["content_safety.blocked", "content_safety.warned"])
        .order("created_at", { ascending: false })
        .limit(100);

      const loadedEvents = (data ?? []) as SafetyEvent[];
      setEvents(loadedEvents);

      const actorIds = [
        ...new Set(
          loadedEvents
            .map((event) => event.actor_id)
            .filter((id): id is string => Boolean(id))
        ),
      ];

      if (actorIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", actorIds);

        const profileMap: Record<string, Profile> = {};

        for (const item of profileData ?? []) {
          profileMap[item.id] = item;
        }

        setProfiles(profileMap);
      }

      setLoading(false);
    }

    loadSafetyEvents();
  }, []);

  const blockedCount = events.filter((event) => event.action === "content_safety.blocked").length;
  const warnedCount = events.filter((event) => event.action === "content_safety.warned").length;
  const aiCount = events.filter((event) => getMetadataString(event.metadata, "stage") === "ai_assisted").length;
  const ruleCount = events.filter((event) => getMetadataString(event.metadata, "stage") === "rule_based").length;

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return events.filter((event) => {
      const stage = getMetadataString(event.metadata, "stage");
      const profile = event.actor_id ? profiles[event.actor_id] : undefined;

      if (actionFilter !== "all" && event.action !== actionFilter) {
        return false;
      }

      if (stageFilter !== "all" && stage !== stageFilter) {
        return false;
      }

      if (targetTypeFilter !== "all" && event.target_type !== targetTypeFilter) {
        return false;
      }

      if (query && !getSearchText(event, profile).includes(query)) {
        return false;
      }

      return true;
    });
  }, [events, profiles, searchQuery, actionFilter, stageFilter, targetTypeFilter]);

  function clearFilters() {
    setSearchQuery("");
    setActionFilter("all");
    setStageFilter("all");
    setTargetTypeFilter("all");
  }

  function getSafetyEnforcementReason(event: SafetyEvent) {
    const category = getMetadataString(event.metadata, "category");
    return category
      ? `Pre-submit safety event: ${category}`
      : "Pre-submit safety event reviewed in Safety Queue";
  }

  async function enforceFromSafetyQueue(
    event: SafetyEvent,
    enforcementAction: AccountEnforcementAction
  ) {
    if (!event.actor_id || enforcingEventId) {
      return;
    }

    const actionLabel =
      enforcementAction === "warn_user"
        ? "warn this member"
        : enforcementAction === "suspend_user"
          ? "suspend this member for 7 days"
          : "ban this member";

    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel}? This will update the member account status.`
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setEnforcingEventId(event.id);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        window.location.href = "/login";
        return;
      }

      const suspendedUntil =
        enforcementAction === "suspend_user"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const response = await fetch("/api/admin/moderation/actions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: enforcementAction,
          targetUserId: event.actor_id,
          enforcementReason: getSafetyEnforcementReason(event),
          enforcementNote: `Action taken from Safety Queue event ${event.id}.`,
          suspendedUntil,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(result.error ?? "Unable to update account enforcement.");
        return;
      }

      setMessage(
        enforcementAction === "warn_user"
          ? "Member warned."
          : enforcementAction === "suspend_user"
            ? "Member suspended for 7 days."
            : "Member banned."
      );
    } finally {
      setEnforcingEventId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading safety queue...
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
          <p className="text-zinc-400">Admin access required.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              Safety Queue
            </h1>

            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
              Review blocked and warned pre-submit safety events before they become published content.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/audit"
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Open Audit Log
            </Link>

            <Link
              href="/admin"
              className="rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
            >
              Back to Admin
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">Blocked</p>
            <p className="text-4xl font-semibold">{blockedCount}</p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">Warned</p>
            <p className="text-4xl font-semibold">{warnedCount}</p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">AI-assisted</p>
            <p className="text-4xl font-semibold">{aiCount}</p>
          </div>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="mb-2 text-sm text-zinc-500">Rule-based</p>
            <p className="text-4xl font-semibold">{ruleCount}</p>
          </div>
        </section>

        {message && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Safety filters
              </p>

              <h2 className="text-2xl font-medium">
                Narrow safety events.
              </h2>
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
            >
              Clear filters
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search actor, category, preview..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              />
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Outcome</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All outcomes</option>
                <option value="content_safety.blocked">Blocked</option>
                <option value="content_safety.warned">Warned</option>
              </select>
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Stage</span>
              <select
                value={stageFilter}
                onChange={(event) => setStageFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All stages</option>
                <option value="rule_based">Rule-based</option>
                <option value="ai_assisted">AI-assisted</option>
              </select>
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Content type</span>
              <select
                value={targetTypeFilter}
                onChange={(event) => setTargetTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All content</option>
                <option value="discussion">Discussions</option>
                <option value="reply">Replies</option>
              </select>
            </label>
          </div>

          <p className="mt-4 text-sm text-zinc-600">
            Showing {filteredEvents.length} of {events.length} safety events.
          </p>
        </section>

        <div className="space-y-4">
          {filteredEvents.map((event) => {
            const profile = event.actor_id ? profiles[event.actor_id] : undefined;
            const metadata = event.metadata ?? {};
            const stage = getMetadataString(metadata, "stage");
            const outcome = getMetadataString(metadata, "outcome");
            const category = getMetadataString(metadata, "category");
            const provider = getMetadataString(metadata, "provider");
            const modelName = getMetadataString(metadata, "model_name");
            const message = getMetadataString(metadata, "message");
            const preview = getMetadataString(metadata, "content_preview");
            const contentLength = getMetadataString(metadata, "content_length");

            return (
              <article
                key={event.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className={`rounded-full border px-3 py-1 text-xs ${getBadgeClass(event.action)}`}>
                        {getActionLabel(event.action)}
                      </span>

                      <span className="text-xs text-zinc-500">
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </div>

                    <h2 className="text-xl font-medium">
                      {category || "Safety review"}
                    </h2>

                    {message && (
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-500">
                        {message}
                      </p>
                    )}
                  </div>

                  <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                    {event.target_type || "content"}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Member
                    </p>

                    {event.actor_id ? (
                      <div className="flex items-center gap-3">
                        <ProfileAvatar profile={profile} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-300">
                            {getProfileDisplayName(profile, "Unknown member")}
                          </p>
                          <p className="truncate text-xs text-zinc-600">
                            {profile?.username ? `@${profile.username}` : event.actor_id}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        Unknown member
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Review details
                    </p>

                    <div className="grid gap-2 text-sm text-zinc-400">
                      <p>Stage: {stage || "—"}</p>
                      <p>Outcome: {outcome || "—"}</p>
                      <p>Provider: {provider || "rule-based"}</p>
                      <p>Model: {modelName || "—"}</p>
                      <p>Length: {contentLength || "—"}</p>
                    </div>
                  </div>
                </div>

                {preview && (
                  <div className="mt-4 rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Short preview
                    </p>

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-400">
                      {preview}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  {event.actor_id && (
                    <>
                      <button
                        type="button"
                        onClick={() => enforceFromSafetyQueue(event, "warn_user")}
                        disabled={enforcingEventId === event.id}
                        className="rounded-full border border-sky-900 px-4 py-2 text-sm text-sky-300 transition hover:border-sky-700 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        {enforcingEventId === event.id ? "Working..." : "Warn"}
                      </button>

                      <button
                        type="button"
                        onClick={() => enforceFromSafetyQueue(event, "suspend_user")}
                        disabled={enforcingEventId === event.id}
                        className="rounded-full border border-amber-800 px-4 py-2 text-sm text-amber-300 transition hover:border-amber-600 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        Suspend 7 days
                      </button>

                      <button
                        type="button"
                        onClick={() => enforceFromSafetyQueue(event, "ban_user")}
                        disabled={enforcingEventId === event.id}
                        className="rounded-full border border-red-900 px-4 py-2 text-sm text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                      >
                        Ban
                      </button>

                      <Link
                        href={`/admin/users?member=${encodeURIComponent(event.actor_id)}`}
                        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        Review member
                      </Link>
                    </>
                  )}

                  <Link
                    href={`/admin/audit?search=${encodeURIComponent(event.id)}`}
                    className="rounded-full border border-zinc-800 px-4 py-2 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                  >
                    View audit context
                  </Link>
                </div>
              </article>
            );
          })}

          {!filteredEvents.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">
                {events.length ? "No safety events match these filters." : "No safety events yet."}
              </h2>

              <p className="mb-6 max-w-2xl text-zinc-500">
                {events.length
                  ? "Adjust or clear the current filters to review more safety events."
                  : "Safety events will appear here when Loombus blocks or warns content before it is published."}
              </p>

              <div className="flex flex-wrap gap-3">
                {events.length ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link
                    href="/admin/audit"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Open audit log
                  </Link>
                )}

                <Link
                  href="/admin"
                  className="inline-flex rounded-full border border-zinc-800 px-5 py-3 text-sm text-zinc-400 transition hover:border-zinc-600 hover:text-white"
                >
                  Back to admin
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
