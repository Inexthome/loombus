"use client";

import Link from "next/link";
import { ArrowRight, Database, Search, ShieldCheck } from "lucide-react";
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AdminActionLink,
  AdminMetricCard,
  AdminPlatformShell,
  AdminPlatformState,
  AdminQueueSection,
  AdminRefreshButton,
  AdminStatusBadge,
  formatAdminMetric,
} from "./admin-platform-foundation";
import {
  ADMIN_PLATFORM_MODULES,
  type AdminPlatformModuleKey,
} from "./admin-platform-registry";

type AccessState = "checking" | "allowed" | "denied" | "error";

type OverviewModule = {
  key: AdminPlatformModuleKey;
  metric: number | null;
  metricLabel: string;
  status: "ready" | "unavailable";
  detail: string;
};

type OverviewResponse = {
  isAdmin: boolean;
  generatedAt: string;
  activeQueue: number | null;
  modules: OverviewModule[];
};

type DuplicateSummaryResponse = {
  isAdmin?: boolean;
  openSignals?: number;
  pendingScans?: number;
  scanErrors?: number;
  error?: unknown;
  code?: unknown;
};

type ErrorPayload = {
  error?: unknown;
  code?: unknown;
};

class AdminRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null,
  ) {
    super(message);
    this.name = "AdminRequestError";
  }
}

async function duplicateSummary(token: string): Promise<OverviewModule> {
  try {
    const response = await fetch("/api/admin/platform/duplicates/summary", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => ({}))) as DuplicateSummaryResponse;

    if (response.status === 403) {
      throw new AdminRequestError(
        typeof payload.error === "string"
          ? payload.error
          : "Administrator access is required.",
        403,
        typeof payload.code === "string" ? payload.code : null,
      );
    }

    if (!response.ok || payload.isAdmin !== true) {
      return {
        key: "duplicates",
        metric: null,
        metricLabel: "open signals",
        status: "unavailable",
        detail:
          typeof payload.error === "string"
            ? payload.error
            : "Media Duplicate Review summary is temporarily unavailable.",
      };
    }

    const pendingScans = Number(payload.pendingScans ?? 0);
    const scanErrors = Number(payload.scanErrors ?? 0);

    return {
      key: "duplicates",
      metric: Number(payload.openSignals ?? 0),
      metricLabel: "open signals",
      status: "ready",
      detail:
        pendingScans || scanErrors
          ? `${pendingScans} media scans pending and ${scanErrors} scan errors require operational attention.`
          : "Cross-account exact-content signals are ready for protected administrator review.",
    };
  } catch (caught) {
    if (caught instanceof AdminRequestError) throw caught;
    return {
      key: "duplicates",
      metric: null,
      metricLabel: "open signals",
      status: "unavailable",
      detail:
        caught instanceof Error
          ? caught.message
          : "Media Duplicate Review summary is temporarily unavailable.",
    };
  }
}

async function authorizedOverview(token: string): Promise<OverviewResponse> {
  const [response, duplicates] = await Promise.all([
    fetch("/api/admin/platform/overview", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
    duplicateSummary(token),
  ]);
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new AdminRequestError(
      typeof payload.error === "string"
        ? payload.error
        : "Platform Operations overview could not load.",
      response.status,
      typeof payload.code === "string" ? payload.code : null,
    );
  }

  const overview = payload as unknown as OverviewResponse;
  return {
    ...overview,
    modules: [
      ...overview.modules.filter((module) => module.key !== "duplicates"),
      duplicates,
    ],
  };
}

export default function PlatformOverviewClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await authorizedOverview(token);
      if (result.isAdmin !== true) {
        setData(null);
        setAccessState("denied");
        return;
      }
      setData(result);
      setAccessState("allowed");
    } catch (caught) {
      if (caught instanceof AdminRequestError && caught.status === 403) {
        setData(null);
        setAccessState("denied");
      } else {
        setData(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "Platform Operations overview could not load.",
        );
        setAccessState("error");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;

        const token = sessionData.session?.access_token ?? "";
        if (!token) {
          window.location.replace(
            `/login?next=${encodeURIComponent("/admin/platform")}`,
          );
          return;
        }

        setAccessToken(token);
        await load(token);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Administrator access could not be verified.",
        );
        setAccessState("error");
        setLoading(false);
      }
    }

    void start();
    return () => {
      active = false;
    };
  }, [load]);

  const moduleMap = useMemo(
    () => new Map((data?.modules ?? []).map((module) => [module.key, module])),
    [data],
  );

  const availableModules = data?.modules.filter((module) => module.status === "ready").length ?? 0;
  const unavailableModules = data?.modules.filter((module) => module.status === "unavailable").length ?? 0;
  const searchMetric = moduleMap.get("search")?.metric ?? null;

  if (accessState === "checking") {
    return (
      <AdminPlatformState
        title="Verifying administrator access"
        description="Loombus is confirming your administrator role and loading lightweight operational summaries. Full module queues are not loaded on this page."
        loading
      />
    );
  }

  if (accessState === "denied") {
    return (
      <AdminPlatformState
        title="Administrator access is required"
        description="This workspace is restricted to accounts with the existing Loombus administrator role. No platform queue data was displayed."
        tone="warning"
      >
        <AdminActionLink href="/discussions" primary>
          Return to Loombus
        </AdminActionLink>
        <AdminActionLink href="/support">Open Support</AdminActionLink>
      </AdminPlatformState>
    );
  }

  if (accessState === "error" || !data) {
    return (
      <AdminPlatformState
        title="Platform Operations could not load"
        description={error || "Refresh the page and try again."}
        tone="danger"
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)]"
        >
          Reload page
        </button>
        <AdminActionLink href="/admin">Admin home</AdminActionLink>
      </AdminPlatformState>
    );
  }

  return (
    <AdminPlatformShell
      active="overview"
      eyebrow="Admin platform"
      title="Platform Operations overview"
      description="Review lightweight operational summaries across Loombus, then open one protected module to load only that module's queue and diagnostics."
      error={error}
      actions={
        <AdminRefreshButton
          loading={loading}
          onClick={() => void load(accessToken)}
          label="Refresh overview"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Active queue"
          value={data.activeQueue}
          description={
            data.activeQueue === null
              ? "One or more operational summaries are unavailable, so a false total is not shown."
              : "Pending decisions, open reports, and operational exceptions across the ten queue-bearing modules."
          }
          icon={<ShieldCheck size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Available modules"
          value={availableModules}
          description="Protected summaries that responded successfully."
          icon={<Database size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Unavailable modules"
          value={unavailableModules}
          description="Unavailable values remain a dash instead of being reported as zero."
        />
        <AdminMetricCard
          label="Search index"
          value={searchMetric}
          description="Indexed documents reported by the protected Search Operations workspace."
          icon={<Search size={20} aria-hidden="true" />}
        />
      </div>

      <div className="mt-5">
        <AdminQueueSection
          eyebrow="Operational modules"
          title="Open one queue at a time"
          description="The overview reads direct summary counts. Opening a module loads only its own protected payload, not all twelve operational modules."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {ADMIN_PLATFORM_MODULES.map((definition) => {
              const summary = moduleMap.get(definition.key);
              const unavailable = summary?.status === "unavailable";
              const metric = summary?.metric ?? null;

              return (
                <article
                  key={definition.key}
                  className="rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-soft)] text-[var(--loombus-gold)]">
                      {createElement(definition.Icon, { size: 20, "aria-hidden": true })}
                    </span>
                    <AdminStatusBadge
                      status={
                        unavailable
                          ? "unavailable"
                          : metric && metric > 0
                            ? "attention"
                            : "ready"
                      }
                    >
                      {unavailable
                        ? "Unavailable"
                        : metric && metric > 0
                          ? definition.key === "search"
                            ? "Indexed"
                            : "Needs review"
                          : "Ready"}
                    </AdminStatusBadge>
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-5">
                    <div>
                      <h3 className="text-xl font-semibold">{definition.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                        {definition.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <strong className="block text-2xl font-semibold">
                        {formatAdminMetric(metric)}
                      </strong>
                      <span className="text-xs text-[var(--loombus-text-subtle)]">
                        {summary?.metricLabel ?? definition.metricLabel}
                      </span>
                    </div>
                  </div>

                  <p className="mt-4 rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {summary?.detail ?? "Summary unavailable."}
                  </p>

                  <Link
                    href={`/admin/platform/${definition.key}`}
                    className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"
                  >
                    Open {definition.shortTitle}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </AdminQueueSection>
      </div>
    </AdminPlatformShell>
  );
}
