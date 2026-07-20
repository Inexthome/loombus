"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileSearch,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  AdminActionButton,
  AdminActionLink,
  AdminMetricCard,
  AdminPlatformShell,
  AdminPlatformState,
  AdminQueueSection,
  AdminRefreshButton,
  AdminStatusBadge,
} from "./admin-platform-foundation";

type AccessState = "checking" | "allowed" | "denied" | "error";

type SearchMetrics = {
  totalDocuments: number;
  activePublic: number;
  restrictedDocuments: number;
  sourceCount: number;
  attentionTotal: number;
  orphaned: number;
  indexLagging: number;
  missingSourceTimestamp: number;
  invalidHref: number;
  emptyVector: number;
  unregisteredSource: number;
  stale30Days: number;
  archived: number;
};

type SearchSourceHealth = {
  sourceTable: string;
  total: number;
  activePublic: number;
  restricted: number;
  archived: number;
  attention: number;
  stale30Days: number;
  orphaned: number;
  indexLagging: number;
  missingSourceTimestamp: number;
  invalidHref: number;
  emptyVector: number;
  repairAvailable: boolean;
  lastSourceUpdatedAt: string | null;
  lastIndexedAt: string | null;
};

type SearchIssue = {
  documentId: string;
  sourceTable: string;
  entityType: string;
  entityId: string;
  visibility: string;
  status: string;
  href: string | null;
  sourceUpdatedAt: string | null;
  indexedAt: string | null;
  repairAvailable: boolean;
  issueCodes: string[];
};

type SearchHealthResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: SearchMetrics;
  visibility: {
    public: number;
    authenticated: number;
    premium: number;
    member: number;
    private: number;
  };
  sources: SearchSourceHealth[];
  issues: SearchIssue[];
  boundaries: {
    sourceRebuildAvailable: boolean;
    documentRepairAvailable: boolean;
    arbitraryDeleteAvailable: boolean;
    visibilityMutationAvailable: boolean;
    rankingMutationAvailable: boolean;
    sourceContentMutationAvailable: boolean;
    sourceOwnedEligibility: boolean;
    privateContentLoaded: boolean;
    publicSearchRouteUnchanged: boolean;
  };
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

async function authorizedRequest<T>(
  token: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch("/api/admin/platform/search", {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new AdminRequestError(
      typeof payload.error === "string"
        ? payload.error
        : "Search Operations could not complete this request.",
      response.status,
      typeof payload.code === "string" ? payload.code : null,
    );
  }

  return payload as unknown as T;
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function label(value: string) {
  return value.replaceAll("_", " ");
}

function QueueBadge({ count }: { count: number }) {
  return (
    <AdminStatusBadge status={count ? "attention" : "ready"}>
      {count ? `${count} flags` : "Healthy"}
    </AdminStatusBadge>
  );
}

const recordClass =
  "rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6";
const detailClass =
  "inline-flex rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)]";
const emptyClass =
  "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";

export default function SearchOperationsClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<SearchHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingKey, setWorkingKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const result = await authorizedRequest<SearchHealthResponse>(token);
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
            : "Search Operations could not load.",
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
            `/login?next=${encodeURIComponent("/admin/platform/search")}`,
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

  const runAction = useCallback(
    async (
      key: string,
      payload: Record<string, unknown>,
      successMessage: string,
    ) => {
      if (!accessToken || workingKey) return;

      setWorkingKey(key);
      setMessage("");
      setError("");

      try {
        await authorizedRequest(accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setMessage(successMessage);
        await load(accessToken);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The Search operation could not be completed.",
        );
      } finally {
        setWorkingKey("");
      }
    },
    [accessToken, load, workingKey],
  );

  const sourcesNeedingAttention = useMemo(
    () => data?.sources.filter((source) => source.attention > 0).length ?? 0,
    [data],
  );

  if (accessState === "checking") {
    return (
      <AdminPlatformState
        title="Loading Search Operations"
        description="Loombus is verifying your administrator role and loading protected index-health diagnostics."
        loading
      />
    );
  }

  if (accessState === "denied") {
    return (
      <AdminPlatformState
        title="Administrator access is required"
        description="This workspace is restricted to accounts with the existing Loombus administrator role. No Search index data was displayed."
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
        title="Search Operations could not load"
        description={error || "Refresh the page and try again."}
        tone="danger"
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)]"
        >
          Reload module
        </button>
        <AdminActionLink href="/admin/platform">Platform overview</AdminActionLink>
      </AdminPlatformState>
    );
  }

  const metrics = data.metrics;

  return (
    <AdminPlatformShell
      active="search"
      eyebrow="Administrator module"
      title="Search Operations"
      description="Monitor the unified Loombus index, rebuild one registered source family, and repair derived records while preserving source-owned eligibility, privacy, visibility, and ranking rules."
      notice={message}
      error={error}
      actions={
        <>
          <AdminActionLink href="/search">Open Everything Search</AdminActionLink>
          <AdminRefreshButton
            loading={loading || Boolean(workingKey)}
            onClick={() => {
              setMessage("");
              void load(accessToken);
            }}
            label="Refresh health"
          />
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Health flags"
          value={metrics.attentionTotal}
          description="Orphans, index lag, missing source timestamps, invalid destinations, empty vectors, or unregistered sources."
          icon={<ShieldCheck size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Indexed documents"
          value={metrics.totalDocuments}
          description="All public, permissioned, private, and archived records in the unified registry."
          icon={<Database size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Active public"
          value={metrics.activePublic}
          description="Records currently eligible for public Everything Search."
          icon={<Search size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Source families"
          value={metrics.sourceCount}
          description={`${sourcesNeedingAttention} source families currently contain an index-health flag.`}
          icon={<FileSearch size={20} aria-hidden="true" />}
        />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <AdminQueueSection
          eyebrow="Index health"
          title="Derived-record integrity"
          description="These checks inspect index metadata only. Private Room discussions, files, resources, calendars, and member workspaces are not loaded."
          action={<QueueBadge count={metrics.attentionTotal} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Orphaned sources", metrics.orphaned],
              ["Index lagging", metrics.indexLagging],
              ["Missing source time", metrics.missingSourceTimestamp],
              ["Empty search vector", metrics.emptyVector],
              ["Invalid destination", metrics.invalidHref],
              ["Unregistered source", metrics.unregisteredSource],
            ].map(([itemLabel, value]) => (
              <article
                key={String(itemLabel)}
                className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                  {String(itemLabel)}
                </p>
                <strong className="mt-2 block text-2xl">{Number(value)}</strong>
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
              <strong>Restricted records</strong>
              <p className="mt-2 text-[var(--loombus-text-muted)]">
                {metrics.restrictedDocuments.toLocaleString()}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
              <strong>30-day freshness review</strong>
              <p className="mt-2 text-[var(--loombus-text-muted)]">
                {metrics.stale30Days.toLocaleString()}
              </p>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
              <strong>Archived documents</strong>
              <p className="mt-2 text-[var(--loombus-text-muted)]">
                {metrics.archived.toLocaleString()}
              </p>
            </article>
          </div>
        </AdminQueueSection>

        <AdminQueueSection
          eyebrow="Operational boundaries"
          title="Source-owned repair only"
          description="Rebuild and repair actions regenerate derived Search records from their owning tables. They do not edit the source record or create a parallel publication state."
          action={<AdminStatusBadge status="ready">Protected</AdminStatusBadge>}
        >
          <div className="grid gap-3">
            {[
              ["Source content mutation", data.boundaries.sourceContentMutationAvailable],
              ["Visibility mutation", data.boundaries.visibilityMutationAvailable],
              ["Ranking mutation", data.boundaries.rankingMutationAvailable],
              ["Arbitrary index deletion", data.boundaries.arbitraryDeleteAvailable],
            ].map(([itemLabel, available]) => (
              <div
                key={String(itemLabel)}
                className="flex items-center justify-between rounded-2xl bg-[var(--loombus-page-bg)] p-4"
              >
                <span className="text-sm font-semibold">{String(itemLabel)}</span>
                <AdminStatusBadge status={available ? "attention" : "ready"}>
                  {available ? "Available" : "Not available"}
                </AdminStatusBadge>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6 text-[var(--loombus-text-muted)]">
            Public `/search` remains unchanged. Source eligibility, Room membership,
            account enforcement, premium access, blocking, and source-specific lifecycle
            rules remain authoritative.
          </p>
        </AdminQueueSection>
      </div>

      <div className="mt-5">
        <AdminQueueSection
          eyebrow="Source registry"
          title="Rebuild one source family"
          description="A source rebuild replays the existing indexing adapter, removes derived orphans for that source, and leaves all owning records unchanged."
          action={<QueueBadge count={sourcesNeedingAttention} />}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {data.sources.map((source) => {
              const key = `source:${source.sourceTable}`;
              const working = workingKey === key;
              return (
                <article key={source.sourceTable} className={recordClass}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <AdminStatusBadge
                          status={source.attention ? "attention" : "ready"}
                        >
                          {source.attention ? `${source.attention} flags` : "Healthy"}
                        </AdminStatusBadge>
                        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                          {source.sourceTable}
                        </span>
                      </div>
                      <h3 className="mt-3 text-xl font-semibold">
                        {label(source.sourceTable)}
                      </h3>
                    </div>
                    {source.repairAvailable ? (
                      <AdminActionButton
                        type="button"
                        disabled={Boolean(workingKey)}
                        onClick={() =>
                          void runAction(
                            key,
                            {
                              action: "rebuild_source",
                              sourceTable: source.sourceTable,
                            },
                            `${label(source.sourceTable)} was rebuilt from its owning source.`,
                          )
                        }
                      >
                        <RefreshCw
                          size={15}
                          className={working ? "animate-spin" : ""}
                          aria-hidden="true"
                        />
                        {working ? "Rebuilding" : "Rebuild source"}
                      </AdminActionButton>
                    ) : (
                      <AdminStatusBadge status="foundation">Static source</AdminStatusBadge>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className={detailClass}>{source.total} indexed</span>
                    <span className={detailClass}>{source.activePublic} public</span>
                    <span className={detailClass}>{source.restricted} restricted</span>
                    <span className={detailClass}>{source.stale30Days} freshness review</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[var(--loombus-text-muted)] sm:grid-cols-2">
                    <span>Last source update: {formatDate(source.lastSourceUpdatedAt)}</span>
                    <span>Last indexed: {formatDate(source.lastIndexedAt)}</span>
                  </div>
                </article>
              );
            })}
          </div>
        </AdminQueueSection>
      </div>

      <div className="mt-5">
        <AdminQueueSection
          eyebrow="Repair queue"
          title="Derived records requiring attention"
          description="The queue shows identifiers and health metadata only. Restricted record titles, bodies, files, and Room content are not exposed here."
          action={<QueueBadge count={data.issues.length} />}
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {data.issues.map((issue) => {
              const key = `issue:${issue.documentId}`;
              const working = workingKey === key;
              return (
                <article key={issue.documentId} className={recordClass}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-700 dark:text-amber-300">
                      <AlertTriangle size={18} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                        {issue.sourceTable} · {label(issue.entityType)}
                      </p>
                      <h3 className="mt-1 break-all text-base font-semibold">
                        {issue.entityId}
                      </h3>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {issue.issueCodes.map((code) => (
                      <AdminStatusBadge key={code} status="attention">
                        {label(code)}
                      </AdminStatusBadge>
                    ))}
                    <span className={detailClass}>{label(issue.visibility)}</span>
                    <span className={detailClass}>{label(issue.status)}</span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-[var(--loombus-text-muted)] sm:grid-cols-2">
                    <span>Source updated: {formatDate(issue.sourceUpdatedAt)}</span>
                    <span>Indexed: {formatDate(issue.indexedAt)}</span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {issue.repairAvailable ? (
                      <AdminActionButton
                        type="button"
                        primary
                        disabled={Boolean(workingKey)}
                        onClick={() =>
                          void runAction(
                            key,
                            {
                              action: "repair_document",
                              sourceTable: issue.sourceTable,
                              entityId: issue.entityId,
                            },
                            "The Search document was regenerated from its owning source.",
                          )
                        }
                      >
                        <Wrench size={15} aria-hidden="true" />
                        {working ? "Repairing" : "Repair document"}
                      </AdminActionButton>
                    ) : null}
                    {issue.href ? (
                      <Link
                        href={issue.href}
                        className="inline-flex min-h-11 items-center rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold"
                      >
                        Open destination
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {data.issues.length === 0 ? (
              <div className={emptyClass}>
                <CheckCircle2 className="mx-auto mb-3" size={22} aria-hidden="true" />
                No derived Search records currently require repair.
              </div>
            ) : null}
          </div>
        </AdminQueueSection>
      </div>
    </AdminPlatformShell>
  );
}
