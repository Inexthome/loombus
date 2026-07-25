"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Database,
  FileClock,
  Gauge,
  HardDrive,
  Info,
  ListChecks,
  Loader2,
  MessageSquareReply,
  RefreshCw,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type HealthLevel = "action" | "watch" | "good" | "info";

type AnalyticsPayload = {
  generatedAt: string;
  room: {
    id: string;
    name: string;
    roomType: string;
    supportRoom: boolean;
    subscriptionStatus: string;
    plan: {
      id: string;
      label: string;
      memberLimit: number | null;
      storageBytes: number;
    };
  };
  window: {
    days: number;
    currentSince: string;
    previousSince: string;
  };
  health: {
    score: number;
    status: "healthy" | "watch" | "action";
    label: string;
    findings: Array<{
      level: HealthLevel;
      title: string;
      detail: string;
      deduction: number;
    }>;
    dataComplete: boolean;
    cappedSources: string[];
  };
  metrics: {
    members: {
      active: number;
      suspended: number;
      staff: number;
      limit: number | null;
      utilization: number | null;
    };
    activity: {
      current: number;
      previous: number;
      changePercent: number;
      lastSevenDays: number;
      activeContributors: number;
    };
    discussions: {
      created: number;
      previousCreated: number;
      changePercent: number;
      replies: number;
      previousReplies: number;
      repliedDiscussions: number;
      responseCoverage: number;
      maturedDiscussions: number;
      unansweredAfter24Hours: number;
      medianFirstResponseHours: number | null;
      openCases: number | null;
    };
    moderation: {
      open: number;
      urgent: number;
      unassigned: number;
      escalated: number;
      oldestOpenHours: number | null;
      resolvedInWindow: number;
      medianResolutionHours: number | null;
    };
    storage: {
      files: number;
      usedBytes: number;
      limitBytes: number;
      utilization: number | null;
    };
    tasks: {
      active: number;
      overdue: number;
      blocked: number;
      unassigned: number;
      completedInWindow: number;
    };
    events: {
      upcoming: number;
      completedInWindow: number;
      rsvps: {
        going: number;
        maybe: number;
        declined: number;
        waitlist: number;
      };
      participantCoverage: number;
    };
    delivery: {
      preferenceRecords: number;
      inAppEnabled: number;
      digestEnabled: number;
      notificationsGenerated: number;
      preferenceCoverage: number;
      latestDigestSentAt: string | null;
    };
    retention: {
      latestRun: {
        mode: string;
        status: string;
        candidateCount: number;
        stagedCount: number;
        excludedCount: number;
        startedAt: string | null;
        completedAt: string | null;
        error: string | null;
      } | null;
      activeHolds: number;
      permanentDeletionEnabled: boolean;
    };
  };
  trend: Array<{
    date: string;
    activity: number;
    discussions: number;
    replies: number;
  }>;
  moduleActivity: Array<{
    moduleKey: string;
    count: number;
    percentage: number;
  }>;
  privacy: {
    aggregateOnly: boolean;
    note: string;
  };
  error?: string;
  code?: string;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount >= 10 || unit === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[unit]}`;
}

function formatHours(value: number | null) {
  if (value === null) return "No completed sample";
  if (value < 1) return `${Math.max(1, Math.round(value * 60))} min`;
  if (value < 48) return `${value.toFixed(value >= 10 ? 0 : 1)} hr`;
  return `${(value / 24).toFixed(1)} days`;
}

function formatDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : "Not available";
}

function moduleLabel(value: string) {
  return value
    .replaceAll("-", " ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function changeLabel(value: number) {
  if (value === 0) return "No change from prior window";
  return `${value > 0 ? "+" : ""}${value}% from prior window`;
}

function findingStyle(level: HealthLevel) {
  if (level === "action") {
    return "border-red-500/35 bg-red-500/10 text-red-800 dark:text-red-200";
  }
  if (level === "watch") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  if (level === "good") {
    return "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  return "border-[var(--border)] bg-[var(--background)] text-[var(--text)]";
}

function FindingIcon({ level }: { level: HealthLevel }) {
  if (level === "action") return <ShieldAlert className="h-5 w-5 shrink-0" />;
  if (level === "watch") return <AlertTriangle className="h-5 w-5 shrink-0" />;
  if (level === "good") return <CheckCircle2 className="h-5 w-5 shrink-0" />;
  return <Info className="h-5 w-5 shrink-0" />;
}

function Progress({ value, label }: { value: number | null; label: string }) {
  const normalized = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{label}</span>
        <span>{value === null ? "No fixed limit" : `${value}%`}</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[var(--border)]"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? "No fixed limit" : `${value}%`}
      >
        <div
          className="h-full rounded-full bg-[var(--text)] transition-[width]"
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        {icon}
        <h2 className="text-sm font-semibold text-[var(--text)]">{label}</h2>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-[var(--text)]">{value}</p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{detail}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </article>
  );
}

function TrendChart({ data }: { data: AnalyticsPayload["trend"] }) {
  const maximum = Math.max(
    1,
    ...data.flatMap((point) => [point.activity, point.discussions, point.replies])
  );
  return (
    <div className="overflow-x-auto pb-2">
      <div className="min-w-[720px]">
        <div className="flex h-52 items-end gap-2 border-b border-[var(--border)] px-1" aria-label="Daily Room activity trend">
          {data.map((point) => (
            <div key={point.date} className="flex min-w-4 flex-1 items-end justify-center gap-[2px]" title={`${point.date}: ${point.activity} activity, ${point.discussions} discussions, ${point.replies} replies`}>
              <span
                className="w-1/3 rounded-t bg-[var(--text)] opacity-90"
                style={{ height: `${Math.max(3, (point.activity / maximum) * 100)}%` }}
                aria-hidden="true"
              />
              <span
                className="w-1/3 rounded-t bg-[var(--text)] opacity-55"
                style={{ height: `${Math.max(3, (point.discussions / maximum) * 100)}%` }}
                aria-hidden="true"
              />
              <span
                className="w-1/3 rounded-t bg-[var(--text)] opacity-25"
                style={{ height: `${Math.max(3, (point.replies / maximum) * 100)}%` }}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
          <span>{data[0]?.date ?? ""}</span>
          <span>{data.at(-1)?.date ?? ""}</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-[var(--text)] opacity-90" />All activity</span>
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-[var(--text)] opacity-55" />Discussions</span>
        <span className="flex items-center gap-2"><span className="h-2 w-4 rounded bg-[var(--text)] opacity-25" />Replies</span>
      </div>
    </div>
  );
}

export default function RoomAnalyticsClient() {
  const params = useParams();
  const rawRoomId = params?.roomId;
  const roomId = useMemo(
    () => (Array.isArray(rawRoomId) ? rawRoomId[0] : rawRoomId ?? ""),
    [rawRoomId]
  );
  const [windowDays, setWindowDays] = useState(30);
  const [payload, setPayload] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const accessToken = useCallback(async () => {
    const result = await supabase.auth.getSession();
    const token = result.data.session?.access_token ?? "";
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(
        `/rooms/${roomId}/analytics`
      )}`;
      return null;
    }
    return token;
  }, [roomId]);

  const load = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    setErrorCode("");
    try {
      const token = await accessToken();
      if (!token) return;
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(roomId)}/analytics?window=${windowDays}`,
        {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }
      );
      const result = (await response.json().catch(() => ({}))) as AnalyticsPayload;
      if (!response.ok || !result.health) {
        throw Object.assign(
          new Error(result.error || "Room analytics could not be loaded."),
          { code: result.code || "" }
        );
      }
      setPayload(result);
    } catch (cause) {
      const typed = cause as Error & { code?: string };
      setError(typed.message || "Room analytics could not be loaded.");
      setErrorCode(typed.code || "");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken, roomId, windowDays]);

  useEffect(() => {
    void load();
  }, [load]);

  const healthTone =
    payload?.health.status === "healthy"
      ? "border-emerald-500/35 bg-emerald-500/10"
      : payload?.health.status === "watch"
        ? "border-amber-500/35 bg-amber-500/10"
        : "border-red-500/35 bg-red-500/10";

  return (
    <main className="rooms-live-shell min-h-screen px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Room operations</p>
              <h1 className="mt-2 text-2xl font-semibold text-[var(--text)] sm:text-3xl">
                {payload?.room.name ? `${payload.room.name} analytics` : "Room analytics"}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
                Private operational indicators for capacity, response coverage, workload, moderation, storage, events, delivery, and retention. This is not a public score or member ranking.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/rooms/${encodeURIComponent(roomId)}`} className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium">
                Back to Room
              </Link>
              <button type="button" onClick={() => void load()} className="rounded-full border border-[var(--border)] p-2" aria-label="Refresh Room analytics">
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </button>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Analytics window">
            {[7, 30, 90].map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                aria-pressed={windowDays === days}
                className={`rounded-full border px-4 py-2 text-sm font-medium ${
                  windowDays === days
                    ? "border-[var(--text)] bg-[var(--text)] text-[var(--background)]"
                    : "border-[var(--border)] text-[var(--text)]"
                }`}
              >
                {days} days
              </button>
            ))}
            {payload ? (
              <span className="ml-auto text-xs text-[var(--muted)]">Updated {formatDate(payload.generatedAt)}</span>
            ) : null}
          </div>
        </header>

        {error ? (
          <section role="alert" className="rounded-3xl border border-red-500/35 bg-red-500/10 p-5 text-sm text-red-800 dark:text-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">{error}</p>
                {errorCode === "room_analytics_plan_required" ? (
                  <p className="mt-2 leading-relaxed">This dashboard follows the existing Operations entitlement and begins with Organization Plus.</p>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {loading ? (
          <section className="flex items-center gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading private Room operations…
          </section>
        ) : payload ? (
          <>
            <section className={`rounded-3xl border p-5 shadow-sm sm:p-6 ${healthTone}`}>
              <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text)]">
                    <Gauge className="h-5 w-5" /> Operational health
                  </div>
                  <p className="mt-5 text-6xl font-semibold tracking-tight text-[var(--text)]">{payload.health.score}</p>
                  <p className="mt-2 text-lg font-semibold text-[var(--text)]">{payload.health.label}</p>
                  <p className="mt-2 text-xs leading-relaxed text-[var(--muted)]">
                    A private management indicator based on operational pressure. Activity volume and popularity do not lower this score.
                  </p>
                </div>
                <div className="space-y-3">
                  {payload.health.findings.map((finding, index) => (
                    <div key={`${finding.title}-${index}`} className={`flex items-start gap-3 rounded-2xl border p-4 ${findingStyle(finding.level)}`}>
                      <FindingIcon level={finding.level} />
                      <div>
                        <p className="text-sm font-semibold">{finding.title}</p>
                        <p className="mt-1 text-sm leading-relaxed opacity-90">{finding.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className={`rounded-2xl border p-4 text-sm leading-relaxed ${payload.privacy.aggregateOnly ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100" : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]"}`}>
              <div className="flex items-start gap-3">
                <Database className="mt-0.5 h-5 w-5 shrink-0" />
                <p>{payload.privacy.note}</p>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<Users className="h-5 w-5" />}
                label="Members"
                value={formatNumber(payload.metrics.members.active)}
                detail={`${payload.metrics.members.staff} staff. ${payload.metrics.members.suspended} suspended.`}
              >
                <Progress value={payload.metrics.members.utilization} label="Member capacity" />
              </MetricCard>

              <MetricCard
                icon={<Activity className="h-5 w-5" />}
                label="Activity"
                value={formatNumber(payload.metrics.activity.current)}
                detail={`${payload.metrics.activity.activeContributors} contributors. ${changeLabel(payload.metrics.activity.changePercent)}.`}
              >
                <p className="text-xs text-[var(--muted)]">{payload.metrics.activity.lastSevenDays} events in the last 7 days</p>
              </MetricCard>

              <MetricCard
                icon={<MessageSquareReply className="h-5 w-5" />}
                label={payload.room.supportRoom ? "Support cases" : "Discussions"}
                value={formatNumber(payload.metrics.discussions.created)}
                detail={`${payload.metrics.discussions.replies} replies. Median first response: ${formatHours(payload.metrics.discussions.medianFirstResponseHours)}.`}
              >
                <Progress value={payload.metrics.discussions.responseCoverage} label="Response coverage" />
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {payload.metrics.discussions.unansweredAfter24Hours} waiting more than 24 hours
                  {payload.metrics.discussions.openCases !== null ? ` · ${payload.metrics.discussions.openCases} open cases` : ""}
                </p>
              </MetricCard>

              <MetricCard
                icon={<ShieldAlert className="h-5 w-5" />}
                label="Moderation"
                value={formatNumber(payload.metrics.moderation.open)}
                detail={`${payload.metrics.moderation.urgent} urgent or high priority. ${payload.metrics.moderation.unassigned} unassigned.`}
              >
                <p className="text-xs text-[var(--muted)]">
                  Oldest open: {formatHours(payload.metrics.moderation.oldestOpenHours)} · Median resolution: {formatHours(payload.metrics.moderation.medianResolutionHours)}
                </p>
              </MetricCard>

              <MetricCard
                icon={<HardDrive className="h-5 w-5" />}
                label="Storage"
                value={formatBytes(payload.metrics.storage.usedBytes)}
                detail={`${formatNumber(payload.metrics.storage.files)} current files of ${formatBytes(payload.metrics.storage.limitBytes)} available.`}
              >
                <Progress value={payload.metrics.storage.utilization} label="Storage utilization" />
              </MetricCard>

              <MetricCard
                icon={<ListChecks className="h-5 w-5" />}
                label="Tasks"
                value={formatNumber(payload.metrics.tasks.active)}
                detail={`${payload.metrics.tasks.overdue} overdue. ${payload.metrics.tasks.blocked} blocked. ${payload.metrics.tasks.unassigned} unassigned.`}
              >
                <p className="text-xs text-[var(--muted)]">{payload.metrics.tasks.completedInWindow} completed in this window</p>
              </MetricCard>

              <MetricCard
                icon={<CalendarDays className="h-5 w-5" />}
                label="Events"
                value={formatNumber(payload.metrics.events.upcoming)}
                detail={`${payload.metrics.events.rsvps.going} going. ${payload.metrics.events.rsvps.maybe} maybe. ${payload.metrics.events.rsvps.waitlist} waitlisted.`}
              >
                <Progress value={payload.metrics.events.participantCoverage} label="Upcoming participant coverage" />
              </MetricCard>

              <MetricCard
                icon={<BellRing className="h-5 w-5" />}
                label="Delivery"
                value={formatNumber(payload.metrics.delivery.notificationsGenerated)}
                detail={`${payload.metrics.delivery.inAppEnabled} in-app preference records enabled. ${payload.metrics.delivery.digestEnabled} Room digests enabled.`}
              >
                <Progress value={payload.metrics.delivery.preferenceCoverage} label="Preference coverage" />
                <p className="mt-3 text-xs text-[var(--muted)]">Latest successful Room digest: {formatDate(payload.metrics.delivery.latestDigestSentAt)}</p>
              </MetricCard>
            </section>

            <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
              <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  <h2 className="text-lg font-semibold text-[var(--text)]">Daily operating trend</h2>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">The chart displays up to the latest 30 days inside the selected reporting window.</p>
                <div className="mt-6"><TrendChart data={payload.trend} /></div>
              </article>

              <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  <h2 className="text-lg font-semibold text-[var(--text)]">Activity by module</h2>
                </div>
                <div className="mt-5 space-y-4">
                  {payload.moduleActivity.length > 0 ? payload.moduleActivity.map((module) => (
                    <div key={module.moduleKey}>
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-[var(--text)]">{moduleLabel(module.moduleKey)}</span>
                        <span className="text-[var(--muted)]">{module.count} · {module.percentage}%</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                        <div className="h-full rounded-full bg-[var(--text)]" style={{ width: `${Math.max(2, module.percentage)}%` }} />
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-[var(--muted)]">No Room activity was recorded in this window.</p>
                  )}
                </div>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <FileClock className="h-5 w-5" />
                  <h2 className="text-lg font-semibold text-[var(--text)]">Retention staging</h2>
                </div>
                {payload.metrics.retention.latestRun ? (
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Latest run</p>
                      <p className="mt-2 text-lg font-semibold capitalize text-[var(--text)]">{payload.metrics.retention.latestRun.mode} · {payload.metrics.retention.latestRun.status}</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">Started {formatDate(payload.metrics.retention.latestRun.startedAt)}</p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4">
                      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Candidate result</p>
                      <p className="mt-2 text-lg font-semibold text-[var(--text)]">{payload.metrics.retention.latestRun.candidateCount} candidates</p>
                      <p className="mt-2 text-xs text-[var(--muted)]">{payload.metrics.retention.latestRun.stagedCount} staged · {payload.metrics.retention.latestRun.excludedCount} excluded</p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--muted)]">No retention preview or staging run has been recorded.</p>
                )}
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--muted)]">
                  <span>{payload.metrics.retention.activeHolds} active legal or operational holds</span>
                  <Link href={`/rooms/${encodeURIComponent(roomId)}/retention`} className="font-semibold text-[var(--text)] underline underline-offset-4">Open retention</Link>
                </div>
                <p className="mt-3 text-xs text-[var(--muted)]">Permanent deletion remains disabled until staged-retention production verification is complete.</p>
              </article>

              <article className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-2">
                  <Clock3 className="h-5 w-5" />
                  <h2 className="text-lg font-semibold text-[var(--text)]">Operational links</h2>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Link href={`/rooms/${encodeURIComponent(roomId)}/moderation`} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm font-semibold text-[var(--text)]">Moderation center</Link>
                  <Link href={`/rooms/${encodeURIComponent(roomId)}/notifications`} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm font-semibold text-[var(--text)]">Notification delivery</Link>
                  <Link href={`/rooms/${encodeURIComponent(roomId)}/governance`} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm font-semibold text-[var(--text)]">Governance controls</Link>
                  <Link href={`/rooms/${encodeURIComponent(roomId)}/retention`} className="rounded-2xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm font-semibold text-[var(--text)]">Retention staging</Link>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
