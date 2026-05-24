"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { ProfileAvatar, getProfileDisplayName } from "@/components/profile-avatar";

type AuditMetadata = Record<string, unknown> | null;

type AuditLog = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  metadata: AuditMetadata;
  created_at: string;
  actor_id: string | null;
};

type Profile = {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

const actionLabels: Record<string, string> = {
  "discussion.created": "Discussion created",
  "discussion.soft_deleted": "Discussion soft deleted",
  "discussion.restored": "Discussion restored",
  "reply.created": "Reply created",
  "reply.soft_deleted": "Reply soft deleted",
  "reply.restored": "Reply restored",
  "account.warned": "Account warned",
  "account.suspended": "Account suspended",
  "account.banned": "Account banned",
  "account.restored": "Account restored",
};

const actionDescriptions: Record<string, string> = {
  "discussion.created": "A member published a new discussion.",
  "discussion.soft_deleted": "An admin removed a discussion from public view.",
  "discussion.restored": "An admin restored a previously deleted discussion.",
  "reply.created": "A member posted a reply.",
  "reply.soft_deleted": "A reply was removed from public view.",
  "reply.restored": "An admin restored a previously deleted reply.",
  "account.warned": "An admin warned a member account.",
  "account.suspended": "An admin temporarily suspended a member account.",
  "account.banned": "An admin banned a member account.",
  "account.restored": "An admin restored a member account to active status.",
};

function getActionLabel(action: string) {
  return actionLabels[action] ?? action.replaceAll(".", " ");
}

function getActionDescription(action: string) {
  return actionDescriptions[action] ?? "Platform activity recorded by Loombus.";
}

function getActionBadgeClass(action: string) {
  if (action.includes("soft_deleted")) {
    return "border-red-900 text-red-300";
  }

  if (action.includes("banned")) {
    return "border-red-900 text-red-300";
  }

  if (action.includes("suspended")) {
    return "border-amber-800 text-amber-300";
  }

  if (action.includes("warned")) {
    return "border-sky-800 text-sky-300";
  }

  if (action.includes("restored")) {
    return "border-emerald-900 text-emerald-300";
  }

  if (action.includes("created")) {
    return "border-blue-900 text-blue-300";
  }

  return "border-zinc-700 text-zinc-300";
}

function formatMetadataValue(value: unknown) {
  if (value === null || value === undefined) {
    return "—";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value, null, 2);
}

function getTargetLabel(log: AuditLog) {
  const targetType = log.target_type || "target";

  if (!log.target_id) {
    return targetType;
  }

  return `${targetType} · ${log.target_id}`;
}

function isTestAuditLog(log: AuditLog) {
  const metadata = log.metadata ?? {};

  return (
    metadata.test === true ||
    metadata.is_test === true ||
    metadata.source === "test" ||
    metadata.environment === "test" ||
    log.action.includes(".test") ||
    log.target_type === "test"
  );
}

function getLogSearchText(log: AuditLog, actorProfile: Profile | undefined) {
  return [
    log.action,
    getActionLabel(log.action),
    getActionDescription(log.action),
    log.target_type,
    log.target_id,
    log.actor_id,
    actorProfile?.username,
    actorProfile?.full_name,
    JSON.stringify(log.metadata ?? {}),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function AdminAuditPage() {
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showTestRecords, setShowTestRecords] = useState(false);

  useEffect(() => {
    async function loadLogs() {
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
        .order("created_at", { ascending: false })
        .limit(100);

      const loadedLogs = (data ?? []) as AuditLog[];

      setLogs(loadedLogs);

      const actorIds = [
        ...new Set(
          loadedLogs
            .map((log) => log.actor_id)
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

    loadLogs();
  }, []);

  const actionOptions = useMemo(
    () => [...new Set(logs.map((log) => log.action).filter(Boolean))].sort(),
    [logs]
  );

  const targetTypeOptions = useMemo(
    () => [...new Set(logs.map((log) => log.target_type).filter(Boolean))].sort(),
    [logs]
  );

  const actorOptions = useMemo(
    () =>
      [
        ...new Set(
          logs
            .map((log) => log.actor_id)
            .filter((actorId): actorId is string => Boolean(actorId))
        ),
      ].sort((a, b) => {
        const profileA = profiles[a];
        const profileB = profiles[b];

        return getProfileDisplayName(profileA, a).localeCompare(
          getProfileDisplayName(profileB, b)
        );
      }),
    [logs, profiles]
  );

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const startTime = startDate
      ? new Date(`${startDate}T00:00:00`).getTime()
      : null;
    const endTime = endDate
      ? new Date(`${endDate}T23:59:59`).getTime()
      : null;

    return logs.filter((log) => {
      if (!showTestRecords && isTestAuditLog(log)) {
        return false;
      }

      if (actionFilter !== "all" && log.action !== actionFilter) {
        return false;
      }

      if (actorFilter !== "all" && log.actor_id !== actorFilter) {
        return false;
      }

      if (targetTypeFilter !== "all" && log.target_type !== targetTypeFilter) {
        return false;
      }

      const logTime = new Date(log.created_at).getTime();

      if (startTime && logTime < startTime) {
        return false;
      }

      if (endTime && logTime > endTime) {
        return false;
      }

      if (query) {
        const actorProfile = log.actor_id ? profiles[log.actor_id] : undefined;
        return getLogSearchText(log, actorProfile).includes(query);
      }

      return true;
    });
  }, [
    logs,
    profiles,
    searchQuery,
    actionFilter,
    actorFilter,
    targetTypeFilter,
    startDate,
    endDate,
    showTestRecords,
  ]);

  function clearFilters() {
    setSearchQuery("");
    setActionFilter("all");
    setActorFilter("all");
    setTargetTypeFilter("all");
    setStartDate("");
    setEndDate("");
    setShowTestRecords(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-6xl text-zinc-400">
          Loading audit logs...
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
            Admin access required.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-6 py-16 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex items-center justify-between">
          <div>
            <p className="mb-3 text-sm uppercase tracking-[0.3em] text-zinc-500">
              Administration
            </p>

            <h1 className="text-5xl font-semibold tracking-tight">
              Audit Logs
            </h1>

            <p className="mt-4 max-w-2xl leading-relaxed text-zinc-500">
              Review platform activity, moderation actions, actors, targets,
              timestamps, and supporting metadata.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
          >
            Back to Admin
          </Link>
        </div>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
            Audit review guide
          </p>

          <h2 className="mb-4 text-2xl font-medium">
            Use audit logs as the moderation record trail.
          </h2>

          <p className="mb-5 max-w-3xl text-sm leading-relaxed text-zinc-500">
            Audit logs help reconstruct what happened, who acted, what target
            was affected, and which metadata was recorded. Use this page when
            reviewing moderation history, restore decisions, disputed actions,
            or unusual platform activity.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Follow the actor
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Start with who performed the action, then compare that actor with related reports or restores.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Check the target
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Use the target type and ID to connect the event to a discussion, reply, profile, or system object.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-900 bg-black p-4">
              <p className="mb-2 text-sm font-medium text-zinc-300">
                Read metadata
              </p>

              <p className="text-sm leading-relaxed text-zinc-600">
                Metadata can explain why the action happened and preserve context for later review.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Audit filters
              </p>

              <h2 className="text-2xl font-medium">
                Narrow the moderation record.
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search action, actor, target, metadata..."
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              />
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Action</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All actions</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {getActionLabel(action)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Actor</span>
              <select
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All actors</option>
                {actorOptions.map((actorId) => {
                  const actorProfile = profiles[actorId];

                  return (
                    <option key={actorId} value={actorId}>
                      {getProfileDisplayName(actorProfile, actorId)}
                      {actorProfile?.username ? ` (@${actorProfile.username})` : ""}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Target type</span>
              <select
                value={targetTypeFilter}
                onChange={(event) => setTargetTypeFilter(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              >
                <option value="all">All target types</option>
                {targetTypeOptions.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {targetType}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">Start date</span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              />
            </label>

            <label className="block text-sm text-zinc-500">
              <span className="mb-2 block">End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-black px-4 py-3 text-sm text-zinc-300 outline-none focus:border-zinc-600"
              />
            </label>
          </div>

          <label className="mt-5 flex items-center gap-3 text-sm text-zinc-500">
            <input
              type="checkbox"
              checked={showTestRecords}
              onChange={(event) => setShowTestRecords(event.target.checked)}
              className="h-4 w-4"
            />
            Show test records when metadata marks an audit event as test data
          </label>

          <p className="mt-4 text-sm text-zinc-600">
            Showing {filteredLogs.length} of {logs.length} audit records.
          </p>
        </section>

        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const actorProfile = log.actor_id ? profiles[log.actor_id] : undefined;
            const metadataEntries = Object.entries(log.metadata ?? {});

            return (
              <div
                key={log.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs ${getActionBadgeClass(log.action)}`}
                      >
                        {getActionLabel(log.action)}
                      </span>

                      <span className="text-xs text-zinc-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <h2 className="text-2xl font-medium">
                      {getActionDescription(log.action)}
                    </h2>
                  </div>

                  <div className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-500">
                    {log.target_type || "target"}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Actor
                    </p>

                    {log.actor_id ? (
                      <div className="flex items-center gap-3">
                        <ProfileAvatar profile={actorProfile} size="md" />

                        <div className="min-w-0">
                          <p className="truncate text-sm text-zinc-300">
                            {getProfileDisplayName(actorProfile, "Unknown actor")}
                          </p>

                          <p className="truncate text-xs text-zinc-600">
                            {actorProfile?.username ? `@${actorProfile.username}` : log.actor_id}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">
                        System / unknown actor
                      </p>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Target
                    </p>

                    <p className="break-all text-sm text-zinc-300">
                      {getTargetLabel(log)}
                    </p>
                  </div>
                </div>

                {metadataEntries.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-zinc-900 bg-black p-4">
                    <p className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-600">
                      Metadata
                    </p>

                    <div className="grid gap-3 md:grid-cols-2">
                      {metadataEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-zinc-900 bg-zinc-950 p-3"
                        >
                          <p className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-600">
                            {key.replaceAll("_", " ")}
                          </p>

                          <p className="whitespace-pre-wrap break-words text-sm text-zinc-400">
                            {formatMetadataValue(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {!filteredLogs.length && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8">
              <h2 className="mb-3 text-2xl font-medium">
                {logs.length ? "No audit logs match these filters." : "No audit logs yet."}
              </h2>

              <p className="mb-6 max-w-2xl text-zinc-500">
                {logs.length
                  ? "Adjust or clear the current filters to review more audit records."
                  : "Audit events will appear here after tracked platform actions are recorded, such as moderation actions, restores, created content, or AI-assisted admin-relevant events."}
              </p>

              <div className="flex flex-wrap gap-3">
                {logs.length ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link
                    href="/admin/reports"
                    className="inline-flex rounded-full border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                  >
                    Open reports
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
