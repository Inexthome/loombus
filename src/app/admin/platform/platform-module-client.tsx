"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleAlert,
  Database,
  RefreshCw,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { BusinessModerationPanel } from "@/components/business-moderation-panel";
import { JobModerationPanel } from "@/components/job-moderation-panel";
import MarketplaceAdminMetrics from "@/components/marketplace-admin-metrics";
import { MarketplaceAdminReview } from "@/components/marketplace-admin-review";
import {
  EventModerationPanel,
  RequestModerationPanel,
  ServiceModerationPanel,
} from "@/components/platform-phase2-moderation-panels";
import {
  AppointmentOperationsPanel,
  RoomOperationsPanel,
  type AppointmentsAdminResponse,
  type RoomsAdminResponse,
} from "@/components/platform-phase3-operations-panels";
import {
  LocalOperationsPanel,
  MatchesOperationsPanel,
  type LocalAdminResponse,
  type MatchesAdminResponse,
} from "@/components/platform-final-operations-panels";
import type { BusinessManageResponse } from "@/lib/business-directory";
import type { EventsManageResponse } from "@/lib/events";
import type { JobsManageResponse } from "@/lib/jobs-directory";
import type {
  MarketplaceManageResponse,
  MarketplaceReport,
} from "@/lib/marketplace";
import type { ProviderServicesManageResponse } from "@/lib/provider-services";
import type { ServiceRequestManageResponse } from "@/lib/service-requests";
import { supabase } from "@/lib/supabase/client";
import {
  AdminActionLink,
  AdminMetricCard,
  AdminPlatformShell,
  AdminPlatformState,
  AdminQueueSection,
  AdminRefreshButton,
  AdminStatusBadge,
} from "./admin-platform-foundation";
import {
  getAdminPlatformModule,
  type PlatformModuleKey,
} from "./admin-platform-registry";

type AccessState = "checking" | "allowed" | "denied" | "error";

type SearchAdminResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: {
    totalDocuments: number;
    activePublic: number;
    otherIndexed: number;
    sourceCount: number;
    sampleSize: number;
    stale30Days: number;
    missingHref: number;
  };
  sources: Array<{
    sourceTable: string;
    total: number;
    activePublic: number;
    stale30Days: number;
    missingHref: number;
    lastUpdatedAt: string | null;
  }>;
  boundaries: {
    foundationOnly: boolean;
    rebuildAvailable: boolean;
    deleteAvailable: boolean;
    visibilityMutationAvailable: boolean;
  };
};

type PlatformData = {
  marketplace: MarketplaceManageResponse;
  businesses: BusinessManageResponse;
  jobs: JobsManageResponse;
  events: EventsManageResponse;
  requests: ServiceRequestManageResponse;
  services: ProviderServicesManageResponse;
  rooms: RoomsAdminResponse;
  appointments: AppointmentsAdminResponse;
  local: LocalAdminResponse;
  matches: MatchesAdminResponse;
  search: SearchAdminResponse;
};

type ErrorPayload = {
  error?: unknown;
  code?: unknown;
  isAdmin?: unknown;
};

const ENDPOINTS: Record<PlatformModuleKey, string> = {
  marketplace: "/api/marketplace?manage=1",
  businesses: "/api/businesses?manage=1",
  jobs: "/api/jobs?manage=1",
  events: "/api/events?manage=1",
  requests: "/api/requests?manage=1",
  services: "/api/services?manage=1",
  rooms: "/api/admin/platform/rooms",
  appointments: "/api/admin/platform/appointments",
  local: "/api/admin/platform/local",
  matches: "/api/admin/platform/matches",
  search: "/api/admin/platform/search",
};

class AuthorizedRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null,
  ) {
    super(message);
    this.name = "AuthorizedRequestError";
  }
}

function readableError(payload: ErrorPayload, fallback: string) {
  return typeof payload.error === "string" ? payload.error : fallback;
}

async function authorizedGet<T>(
  token: string,
  url: string,
  fallback: string,
): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new AuthorizedRequestError(
      readableError(payload, fallback),
      response.status,
      typeof payload.code === "string" ? payload.code : null,
    );
  }

  return payload as unknown as T;
}

async function authorizedPost(
  token: string,
  url: string,
  body: Record<string, unknown>,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new Error(
      readableError(payload, "The administrator action could not be completed."),
    );
  }

  return payload;
}

function SearchFoundationPanel({ data }: { data: SearchAdminResponse }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Indexed documents"
          value={data.metrics.totalDocuments}
          description="Total records in the unified Loombus search-document registry."
          icon={<Database size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Active public"
          value={data.metrics.activePublic}
          description="Documents currently eligible for public Everything Search."
          icon={<Search size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Other indexed"
          value={data.metrics.otherIndexed}
          description="Private, permissioned, inactive, or otherwise non-public index records."
        />
        <AdminMetricCard
          label="Source families"
          value={data.metrics.sourceCount}
          description="Distinct source tables represented in the diagnostic sample."
        />
      </div>

      <AdminQueueSection
        eyebrow="Search foundation"
        title="Index registry snapshot"
        description="This PR establishes the protected route, module contract, and read-only source registry. Search operations, repair tools, and the full index-health workspace remain in the dedicated Search PR."
        action={<AdminStatusBadge status="foundation">Foundation only</AdminStatusBadge>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Diagnostic sample
            </span>
            <strong className="mt-2 block text-2xl">{data.metrics.sampleSize}</strong>
          </div>
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Stale over 30 days
            </span>
            <strong className="mt-2 block text-2xl">{data.metrics.stale30Days}</strong>
          </div>
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Missing destination
            </span>
            <strong className="mt-2 block text-2xl">{data.metrics.missingHref}</strong>
          </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--loombus-border)]">
          {data.sources.length ? (
            <div className="divide-y divide-[var(--loombus-border)]">
              {data.sources.map((source) => (
                <article
                  key={source.sourceTable}
                  className="grid gap-3 bg-[var(--loombus-surface)] p-4 sm:grid-cols-[minmax(0,1fr)_repeat(3,auto)] sm:items-center"
                >
                  <div>
                    <strong className="block">{source.sourceTable}</strong>
                    <span className="mt-1 block text-xs text-[var(--loombus-text-subtle)]">
                      Last sampled update: {source.lastUpdatedAt ? new Date(source.lastUpdatedAt).toLocaleString() : "Unavailable"}
                    </span>
                  </div>
                  <span className="text-sm text-[var(--loombus-text-muted)]">
                    {source.total} sampled
                  </span>
                  <span className="text-sm text-[var(--loombus-text-muted)]">
                    {source.activePublic} public
                  </span>
                  <span className="text-sm text-[var(--loombus-text-muted)]">
                    {source.stale30Days + source.missingHref} flags
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-[var(--loombus-text-muted)]">
              No search source records were returned.
            </div>
          )}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational boundary"
        title="No index mutation in the foundation PR"
        description="The module is read-only. It does not rebuild, delete, republish, change visibility, or bypass source-owned eligibility rules."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Rebuild index", data.boundaries.rebuildAvailable],
            ["Delete documents", data.boundaries.deleteAvailable],
            ["Change visibility", data.boundaries.visibilityMutationAvailable],
          ].map(([label, available]) => (
            <div
              key={String(label)}
              className="flex items-center justify-between rounded-2xl bg-[var(--loombus-page-bg)] p-4"
            >
              <span className="text-sm font-semibold">{String(label)}</span>
              <AdminStatusBadge status={available ? "attention" : "ready"}>
                {available ? "Available" : "Not available"}
              </AdminStatusBadge>
            </div>
          ))}
        </div>
      </AdminQueueSection>
    </div>
  );
}

export default function PlatformModuleClient({
  moduleKey,
}: {
  moduleKey: PlatformModuleKey;
}) {
  const definition = getAdminPlatformModule(moduleKey);
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] = useState<PlatformData[PlatformModuleKey] | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [marketplaceNotes, setMarketplaceNotes] = useState<Record<string, string>>({});
  const [marketplaceReportNotes, setMarketplaceReportNotes] = useState<Record<string, string>>({});

  const load = useCallback(
    async (token: string) => {
      setLoading(true);
      setError("");

      try {
        const payload = await authorizedGet<PlatformData[PlatformModuleKey]>(
          token,
          ENDPOINTS[moduleKey],
          `${definition?.title ?? "This administrator module"} could not load.`,
        );

        if ((payload as { isAdmin?: boolean }).isAdmin !== true) {
          setData(null);
          setAccessState("denied");
          return;
        }

        setData(payload);
        setAccessState("allowed");
      } catch (caught) {
        if (caught instanceof AuthorizedRequestError && caught.status === 403) {
          setData(null);
          setAccessState("denied");
        } else {
          setData(null);
          setError(
            caught instanceof Error
              ? caught.message
              : `${definition?.title ?? "This administrator module"} could not load.`,
          );
          setAccessState("error");
        }
      } finally {
        setLoading(false);
      }
    },
    [definition?.title, moduleKey],
  );

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
            `/login?next=${encodeURIComponent(`/admin/platform/${moduleKey}`)}`,
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
  }, [load, moduleKey]);

  const runAction = useCallback(
    async (
      endpoint: string,
      payload: Record<string, unknown>,
      successMessage: string,
    ) => {
      if (!accessToken || working) return;

      setWorking(true);
      setMessage("");
      setError("");

      try {
        await authorizedPost(accessToken, endpoint, payload);
        setMessage(successMessage);
        await load(accessToken);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The administrator action could not be completed.",
        );
      } finally {
        setWorking(false);
      }
    },
    [accessToken, load, working],
  );

  const moderateMarketplace = useCallback(
    async (listingId: string, decision: string) => {
      const labels: Record<string, string> = {
        approve: "The Marketplace listing was approved and published.",
        reject: "The Marketplace listing was returned for changes.",
        suspend: "The Marketplace listing was suspended.",
        remove: "The Marketplace listing was removed.",
      };
      await runAction(
        "/api/marketplace",
        {
          action: "moderate",
          listingId,
          decision,
          note: marketplaceNotes[listingId] ?? "",
        },
        labels[decision] ?? "The Marketplace listing was updated.",
      );
    },
    [marketplaceNotes, runAction],
  );

  const reviewMarketplaceReport = useCallback(
    async (report: MarketplaceReport, decision: string) => {
      await runAction(
        "/api/marketplace",
        {
          action: "review_report",
          reportId: report.id,
          decision,
          note: marketplaceReportNotes[report.id] ?? "",
        },
        decision === "resolve"
          ? "The Marketplace report was resolved."
          : "The Marketplace report was dismissed.",
      );
    },
    [marketplaceReportNotes, runAction],
  );

  if (!definition) {
    return (
      <AdminPlatformState
        title="Administrator module not found"
        description="This Platform Operations route is not registered."
        tone="warning"
      >
        <AdminActionLink href="/admin/platform" primary>
          Platform overview
        </AdminActionLink>
      </AdminPlatformState>
    );
  }

  if (accessState === "checking") {
    return (
      <AdminPlatformState
        title={`Loading ${definition.title}`}
        description={`Loombus is verifying your administrator role and loading only the ${definition.title} operational payload.`}
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
        title={`${definition.title} could not load`}
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

  const marketplaceData = moduleKey === "marketplace" ? (data as MarketplaceManageResponse) : null;
  const businessData = moduleKey === "businesses" ? (data as BusinessManageResponse) : null;
  const jobsData = moduleKey === "jobs" ? (data as JobsManageResponse) : null;
  const eventsData = moduleKey === "events" ? (data as EventsManageResponse) : null;
  const requestsData = moduleKey === "requests" ? (data as ServiceRequestManageResponse) : null;
  const servicesData = moduleKey === "services" ? (data as ProviderServicesManageResponse) : null;
  const roomsData = moduleKey === "rooms" ? (data as RoomsAdminResponse) : null;
  const appointmentsData = moduleKey === "appointments" ? (data as AppointmentsAdminResponse) : null;
  const localData = moduleKey === "local" ? (data as LocalAdminResponse) : null;
  const matchesData = moduleKey === "matches" ? (data as MatchesAdminResponse) : null;
  const searchData = moduleKey === "search" ? (data as SearchAdminResponse) : null;

  return (
    <AdminPlatformShell
      active={moduleKey}
      eyebrow="Administrator module"
      title={definition.title}
      description={`${definition.description} This page loads only the active module and preserves the existing server-side role checks and action contracts.`}
      notice={message}
      error={error}
      actions={
        <>
          <AdminActionLink href={definition.publicHref}>{definition.publicLabel}</AdminActionLink>
          <AdminActionLink href={definition.manageHref}>{definition.manageLabel}</AdminActionLink>
          <AdminRefreshButton
            loading={loading || working}
            onClick={() => {
              setMessage("");
              void load(accessToken);
            }}
            label="Refresh module"
          />
        </>
      }
    >
      <div className="mb-5 rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[var(--loombus-gold-soft)] text-[var(--loombus-gold)]">
              <definition.Icon size={20} aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-text-subtle)]">
                Active-only loading
              </p>
              <h2 className="mt-1 text-xl font-semibold">{definition.title} is isolated</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Other Admin queues are not requested from this route. Refresh and administrator actions reload only this module.
              </p>
            </div>
          </div>
          <AdminStatusBadge status={moduleKey === "search" ? "foundation" : "ready"}>
            {moduleKey === "search" ? "Foundation" : "Loaded"}
          </AdminStatusBadge>
        </div>
      </div>

      {marketplaceData ? (
        <>
          <MarketplaceAdminMetrics />
          <MarketplaceAdminReview
            data={marketplaceData}
            working={working}
            moderationNotes={marketplaceNotes}
            setModerationNotes={setMarketplaceNotes}
            reportNotes={marketplaceReportNotes}
            setReportNotes={setMarketplaceReportNotes}
            moderate={moderateMarketplace}
            reviewReport={reviewMarketplaceReport}
          />
        </>
      ) : null}

      {businessData ? (
        <BusinessModerationPanel
          moderation={businessData.moderation}
          moderate={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/businesses", payload, successMessage)
          }
        />
      ) : null}

      {jobsData ? (
        <JobModerationPanel
          pendingJobs={jobsData.moderation.pendingJobs}
          openReports={jobsData.moderation.openReports}
          moderate={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/jobs", payload, successMessage)
          }
          working={working}
        />
      ) : null}

      {eventsData ? (
        <EventModerationPanel
          data={eventsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/events", payload, successMessage)
          }
        />
      ) : null}

      {requestsData ? (
        <RequestModerationPanel
          data={requestsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/requests", payload, successMessage)
          }
        />
      ) : null}

      {servicesData ? (
        <ServiceModerationPanel
          data={servicesData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/services", payload, successMessage)
          }
        />
      ) : null}

      {roomsData ? (
        <RoomOperationsPanel
          data={roomsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/admin/platform/rooms", payload, successMessage)
          }
        />
      ) : null}

      {appointmentsData ? (
        <AppointmentOperationsPanel
          data={appointmentsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/admin/platform/appointments", payload, successMessage)
          }
        />
      ) : null}

      {localData ? <LocalOperationsPanel data={localData} /> : null}
      {matchesData ? <MatchesOperationsPanel data={matchesData} /> : null}
      {searchData ? <SearchFoundationPanel data={searchData} /> : null}

      {!loading && !data ? (
        <div className="rounded-[1.55rem] border border-amber-500/30 bg-amber-500/10 p-5" role="alert">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 text-amber-700 dark:text-amber-300" size={20} />
            <div>
              <h3 className="font-semibold">No module data was returned</h3>
              <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                Refresh this module or return to the overview.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href="/admin/platform"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-gold)]"
        >
          Platform overview <ArrowRight size={15} aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => void load(accessToken)}
          disabled={loading || working}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)] disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} aria-hidden="true" />
          Reload active module
        </button>
      </div>
    </AdminPlatformShell>
  );
}
