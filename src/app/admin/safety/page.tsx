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

type SafetyPatternSignal = {
  key: string;
  label: string;
  description: string;
  count: number;
  severity: "watch" | "elevated" | "high";
};

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

function getPatternSeverity(count: number): SafetyPatternSignal["severity"] {
  if (count >= 6) {
    return "high";
  }

  if (count >= 3) {
    return "elevated";
  }

  return "watch";
}

function getPatternClassName(severity: SafetyPatternSignal["severity"]) {
  if (severity === "high") {
    return "border-red-950 bg-red-950/20 text-red-200";
  }

  if (severity === "elevated") {
    return "border-amber-900 bg-amber-950/20 text-amber-200";
  }

  return "border-zinc-800 bg-black/40 text-zinc-300";
}

function getRepeatRiskLevel({
  blocked,
  warned,
  total,
}: {
  blocked: number;
  warned: number;
  total: number;
}): SafetyPatternSignal["severity"] {
  if (blocked >= 3 || total >= 6) {
    return "high";
  }

  if (blocked >= 2 || warned >= 3 || total >= 4) {
    return "elevated";
  }

  return "watch";
}

function getRepeatRiskLabel(severity: SafetyPatternSignal["severity"]) {
  if (severity === "high") {
    return "Urgent review";
  }

  if (severity === "elevated") {
    return "Elevated review";
  }

  return "Watch";
}

function getRepeatRiskBadgeClassName(severity: SafetyPatternSignal["severity"]) {
  if (severity === "high") {
    return "border-red-700 bg-red-950/40 text-red-200";
  }

  if (severity === "elevated") {
    return "border-amber-700 bg-amber-950/40 text-amber-200";
  }

  return "border-zinc-700 bg-zinc-950 text-zinc-300";
}

function getSafetySurfaceLabel(targetType: string) {
  if (targetType === "private_message") return "Private messages";
  if (targetType === "discussion") return "Discussions";
  if (targetType === "reply") return "Replies";
  if (targetType === "profile") return "Profiles";

  return targetType || "Content";
}

function getPatternPreviewText(event: SafetyEvent) {
  return [
    getMetadataString(event.metadata, "category"),
    getMetadataString(event.metadata, "message"),
    getMetadataString(event.metadata, "content_preview"),
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
        .limit(250);

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
  const repeatOffenders = useMemo(() => {
    const groups: Record<
      string,
      {
        actorId: string;
        total: number;
        blocked: number;
        warned: number;
        latestAt: string | null;
        latestEvent: SafetyEvent | null;
        categories: Set<string>;
        targetTypes: Set<string>;
      }
    > = {};

    for (const event of events) {
      if (!event.actor_id) {
        continue;
      }

      if (!groups[event.actor_id]) {
        groups[event.actor_id] = {
          actorId: event.actor_id,
          total: 0,
          blocked: 0,
          warned: 0,
          latestAt: null,
          latestEvent: null,
          categories: new Set<string>(),
          targetTypes: new Set<string>(),
        };
      }

      const group = groups[event.actor_id];
      group.total += 1;

      if (event.action === "content_safety.blocked") {
        group.blocked += 1;
      }

      if (event.action === "content_safety.warned") {
        group.warned += 1;
      }

      const category = getMetadataString(event.metadata, "category");

      if (category) {
        group.categories.add(category);
      }

      if (event.target_type) {
        group.targetTypes.add(event.target_type);
      }

      if (
        !group.latestAt ||
        new Date(event.created_at).getTime() > new Date(group.latestAt).getTime()
      ) {
        group.latestAt = event.created_at;
        group.latestEvent = event;
      }
    }

    return Object.values(groups)
      .filter((group) => group.total >= 2)
      .sort((a, b) => {
        if (b.blocked !== a.blocked) {
          return b.blocked - a.blocked;
        }

        if (b.total !== a.total) {
          return b.total - a.total;
        }

        return new Date(b.latestAt ?? 0).getTime() - new Date(a.latestAt ?? 0).getTime();
      })
      .slice(0, 12)
      .map((group) => {
        const riskLevel = getRepeatRiskLevel({
          blocked: group.blocked,
          warned: group.warned,
          total: group.total,
        });

        return {
          ...group,
          riskLevel,
          categories: [...group.categories].slice(0, 4),
          targetTypes: [...group.targetTypes].slice(0, 4),
        };
      });
  }, [events]);

  const urgentRepeatCount = repeatOffenders.filter(
    (group) => group.riskLevel === "high"
  ).length;
  const elevatedRepeatCount = repeatOffenders.filter(
    (group) => group.riskLevel === "elevated"
  ).length;

  const patternSignals = useMemo(() => {
    const signalCounts = {
      repeatedSafetyEvents: repeatOffenders.length,
      aiAssistedWarnings: events.filter(
        (event) =>
          event.action === "content_safety.warned" &&
          getMetadataString(event.metadata, "stage") === "ai_assisted"
      ).length,
      teenSafetyEvents: events.filter(
        (event) => getMetadataString(event.metadata, "teen_message_involved") === "true"
      ).length,
      rageBaitOrBroadShaming: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return text.includes("rage bait") || text.includes("broad shaming");
      }).length,
      spamLikeRepetition: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return text.includes("spam") || text.includes("repetition");
      }).length,
      hostileEscalation: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return (
          text.includes("hostile") ||
          text.includes("harassment") ||
          text.includes("abusive") ||
          text.includes("personal attack") ||
          text.includes("degrading")
        );
      }).length,
      manipulationOrDeception: events.filter((event) => {
        const text = getPatternPreviewText(event);
        return (
          text.includes("manipulation") ||
          text.includes("deception") ||
          text.includes("coordinated") ||
          text.includes("fake engagement")
        );
      }).length,
    };

    const signals: SafetyPatternSignal[] = [
      {
        key: "repeatedSafetyEvents",
        label: "Repeat safety events",
        description: "Members appearing multiple times in blocked or warned pre-submit safety events.",
        count: signalCounts.repeatedSafetyEvents,
        severity: getPatternSeverity(signalCounts.repeatedSafetyEvents),
      },
      {
        key: "aiAssistedWarnings",
        label: "AI-assisted warnings",
        description: "AI safety review flagged content that may need admin context review.",
        count: signalCounts.aiAssistedWarnings,
        severity: getPatternSeverity(signalCounts.aiAssistedWarnings),
      },
      {
        key: "teenSafetyEvents",
        label: "Teen safety events",
        description: "Private-message safety events involving at least one teen-safety account.",
        count: signalCounts.teenSafetyEvents,
        severity: getPatternSeverity(signalCounts.teenSafetyEvents),
      },
      {
        key: "rageBaitOrBroadShaming",
        label: "Rage bait or broad shaming",
        description: "Content framed to provoke, shame broadly, or lower discussion quality.",
        count: signalCounts.rageBaitOrBroadShaming,
        severity: getPatternSeverity(signalCounts.rageBaitOrBroadShaming),
      },
      {
        key: "spamLikeRepetition",
        label: "Spam-like repetition",
        description: "Repetitive or spam-like submissions caught before publishing.",
        count: signalCounts.spamLikeRepetition,
        severity: getPatternSeverity(signalCounts.spamLikeRepetition),
      },
      {
        key: "hostileEscalation",
        label: "Hostile escalation",
        description: "Hostility, harassment, abusive framing, or personal attack signals.",
        count: signalCounts.hostileEscalation,
        severity: getPatternSeverity(signalCounts.hostileEscalation),
      },
      {
        key: "manipulationOrDeception",
        label: "Manipulation or deception",
        description: "Signals related to manipulation, deception, coordination, or fake engagement.",
        count: signalCounts.manipulationOrDeception,
        severity: getPatternSeverity(signalCounts.manipulationOrDeception),
      },
    ];

    return signals
      .filter((signal) => signal.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [events, repeatOffenders]);

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

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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

          <div className="rounded-3xl border border-amber-900 bg-amber-950/20 p-5">
            <p className="mb-2 text-sm text-amber-300">Elevated</p>
            <p className="text-4xl font-semibold text-amber-200">{elevatedRepeatCount}</p>
          </div>

          <div className="rounded-3xl border border-red-950 bg-red-950/20 p-5">
            <p className="mb-2 text-sm text-red-300">Urgent</p>
            <p className="text-4xl font-semibold text-red-200">{urgentRepeatCount}</p>
          </div>
        </section>

        {message && (
          <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-400">
            {message}
          </div>
        )}

        <section className="mb-8 rounded-3xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-sm uppercase tracking-[0.25em] text-zinc-500">
                Admin pattern intelligence
              </p>

              <h2 className="text-2xl font-medium">
                Low-quality and manipulation signals.
              </h2>

              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                These are admin-only review signals based on blocked and warned pre-submit events. They do not label members publicly and do not trigger automatic enforcement.
              </p>
            </div>
          </div>

          {patternSignals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {patternSignals.map((signal) => (
                <div
                  key={signal.key}
                  className={`rounded-2xl border p-4 ${getPatternClassName(signal.severity)}`}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium">
                      {signal.label}
                    </h3>

                    <span className="rounded-full border border-current/30 px-2.5 py-1 text-xs">
                      {signal.count}
                    </span>
                  </div>

                  <p className="text-sm leading-relaxed opacity-80">
                    {signal.description}
                  </p>

                  <p className="mt-3 text-xs uppercase tracking-[0.2em] opacity-60">
                    {signal.severity} signal
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-zinc-900 bg-black p-4 text-sm text-zinc-500">
              No low-quality pattern signals are visible in the current safety queue.
            </div>
          )}
        </section>

        {repeatOffenders.length > 0 && (
          <section className="mb-8 rounded-3xl border border-red-950 bg-red-950/10 p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="mb-2 text-sm uppercase tracking-[0.25em] text-red-300">
                  Repeat offender signals
                </p>

                <h2 className="text-2xl font-medium">
                  Members with multiple safety events.
                </h2>

                <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-500">
                  Use this as a review signal, not automatic enforcement. Confirm the context before warning, suspending, or banning.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {repeatOffenders.map((group) => {
                const profile = profiles[group.actorId];

                return (
                  <div
                    key={group.actorId}
                    className="rounded-2xl border border-red-950 bg-black/40 p-4"
                  >
                    <div className="mb-4 flex items-center gap-3">
                      <ProfileAvatar profile={profile} size="md" />

                      <div className="min-w-0">
                        <p className="truncate text-sm text-zinc-300">
                          {getProfileDisplayName(profile, "Unknown member")}
                        </p>

                        <p className="truncate text-xs text-zinc-600">
                          {profile?.username ? `@${profile.username}` : group.actorId}
                        </p>

                        <p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] ${getRepeatRiskBadgeClassName(group.riskLevel)}`}>
                          {getRepeatRiskLabel(group.riskLevel)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-2">
                        <p className="text-zinc-600">Total</p>
                        <p className="mt-1 text-lg font-semibold text-zinc-200">{group.total}</p>
                      </div>

                      <div className="rounded-xl border border-red-950 bg-red-950/20 p-2">
                        <p className="text-red-300">Blocked</p>
                        <p className="mt-1 text-lg font-semibold text-red-200">{group.blocked}</p>
                      </div>

                      <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-2">
                        <p className="text-amber-300">Warned</p>
                        <p className="mt-1 text-lg font-semibold text-amber-200">{group.warned}</p>
                      </div>
                    </div>

                    {group.categories.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.categories.map((category) => (
                          <span
                            key={category}
                            className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    )}

                    {group.targetTypes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {group.targetTypes.map((targetType) => (
                          <span
                            key={targetType}
                            className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-500"
                          >
                            {getSafetySurfaceLabel(targetType)}
                          </span>
                        ))}
                      </div>
                    )}

                    {group.latestAt && (
                      <p className="mt-3 text-xs text-zinc-600">
                        Latest: {new Date(group.latestAt).toLocaleString()}
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={`/admin/users?member=${encodeURIComponent(group.actorId)}`}
                        className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:text-white"
                      >
                        Review member
                      </Link>

                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery(group.actorId);
                          setActionFilter("all");
                          setStageFilter("all");
                          setTargetTypeFilter("all");
                        }}
                        className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 transition hover:border-zinc-600 hover:text-white"
                      >
                        Show events
                      </button>

                      {group.latestEvent && (
                        <>
                          <button
                            type="button"
                            onClick={() => enforceFromSafetyQueue(group.latestEvent!, "warn_user")}
                            disabled={Boolean(enforcingEventId)}
                            className="rounded-full border border-sky-900 px-3 py-1.5 text-xs text-sky-300 transition hover:border-sky-700 hover:text-sky-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Warn
                          </button>

                          <button
                            type="button"
                            onClick={() => enforceFromSafetyQueue(group.latestEvent!, "suspend_user")}
                            disabled={Boolean(enforcingEventId)}
                            className="rounded-full border border-amber-800 px-3 py-1.5 text-xs text-amber-300 transition hover:border-amber-600 hover:text-amber-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                          >
                            Suspend
                          </button>

                          {group.riskLevel === "high" && (
                            <button
                              type="button"
                              onClick={() => enforceFromSafetyQueue(group.latestEvent!, "ban_user")}
                              disabled={Boolean(enforcingEventId)}
                              className="rounded-full border border-red-900 px-3 py-1.5 text-xs text-red-300 transition hover:border-red-700 hover:text-red-200 disabled:cursor-not-allowed disabled:border-zinc-900 disabled:text-zinc-700"
                            >
                              Ban
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
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
                <option value="private_message">Private messages</option>
                <option value="profile">Profiles</option>
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
            const teenMessageInvolved = getMetadataString(metadata, "teen_message_involved");
            const senderAgeBand = getMetadataString(metadata, "sender_age_band");
            const recipientAgeBand = getMetadataString(metadata, "recipient_age_band");

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
                      {teenMessageInvolved === "true" && (
                        <p className="text-amber-300">
                          Teen safety: sender {senderAgeBand || "unknown"} · recipient {recipientAgeBand || "unknown"}
                        </p>
                      )}
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
