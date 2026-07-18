"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleAlert,
  DoorOpen,
  GitBranch,
  HandHeart,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
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
import type { ProviderServicesManageResponse } from "@/lib/provider-services";
import type { ServiceRequestManageResponse } from "@/lib/service-requests";
import type {
  MarketplaceManageResponse,
  MarketplaceReport,
} from "@/lib/marketplace";
import { supabase } from "@/lib/supabase/client";

export type PlatformModule =
  | "overview"
  | "marketplace"
  | "businesses"
  | "jobs"
  | "events"
  | "requests"
  | "services"
  | "rooms"
  | "appointments"
  | "local"
  | "matches";

type PlatformModuleKey = Exclude<
  PlatformModule,
  "overview"
>;

type AccessState =
  | "checking"
  | "allowed"
  | "denied"
  | "error";

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
};

type ModuleErrors = Partial<
  Record<PlatformModuleKey, string>
>;

type ModuleDefinition = {
  key: PlatformModuleKey;
  title: string;
  description: string;
  publicHref: string;
  manageHref: string;
  publicLabel?: string;
  manageLabel?: string;
  Icon: LucideIcon;
};

type ErrorPayload = {
  error?: unknown;
  code?: unknown;
};

const MODULES: ModuleDefinition[] = [
  {
    key: "marketplace",
    title: "Marketplace",
    description:
      "Approve submitted listings, request changes, suspend or remove listings, and resolve member reports.",
    publicHref: "/marketplace",
    manageHref: "/marketplace/manage",
    Icon: ShoppingBag,
  },
  {
    key: "businesses",
    title: "Business Directory",
    description:
      "Review business listings, verification decisions, ownership claims, and directory reports.",
    publicHref: "/businesses",
    manageHref: "/businesses/manage",
    Icon: Building2,
  },
  {
    key: "jobs",
    title: "Jobs",
    description:
      "Review attributable job postings, employer publication requirements, and reported opportunities.",
    publicHref: "/jobs",
    manageHref: "/jobs/manage",
    Icon: BriefcaseBusiness,
  },
  {
    key: "events",
    title: "Events",
    description:
      "Review public event submissions, future-date requirements, organizers, locations, and reported events.",
    publicHref: "/events",
    manageHref: "/events/manage",
    Icon: CalendarDays,
  },
  {
    key: "requests",
    title: "Requests",
    description:
      "Review public needs, requester attribution, deadlines, reports, suspensions, and removal decisions.",
    publicHref: "/requests",
    manageHref: "/requests/manage",
    Icon: HandHeart,
  },
  {
    key: "services",
    title: "Services",
    description:
      "Review provider listings, business attribution, pricing context, appointment connections, and reports.",
    publicHref: "/services",
    manageHref: "/services/manage",
    Icon: Wrench,
  },
  {
    key: "rooms",
    title: "Rooms",
    description:
      "Review private Room registry health, report snapshots, membership demand, ownership attribution, and billing-state diagnostics without opening private Room content.",
    publicHref: "/rooms",
    manageHref: "/rooms",
    publicLabel: "Open Rooms",
    manageLabel: "Open Room workspace",
    Icon: DoorOpen,
  },
  {
    key: "appointments",
    title: "Appointments",
    description:
      "Review appointment lifecycle diagnostics, provider and requester attribution, overdue accepted bookings, and supported administrator cancellations.",
    publicHref: "/appointments",
    manageHref: "/appointments",
    publicLabel: "Open Appointments",
    manageLabel: "Open provider workspace",
    Icon: CalendarClock,
  },
  {
    key: "local",
    title: "Local",
    description:
      "Inspect Local Discovery source coverage, privacy-safe location anchoring, missing areas, and source freshness without rebuilding indexes or editing source records.",
    publicHref: "/local",
    manageHref: "/local/manage",
    publicLabel: "Open Local",
    manageLabel: "Open location workspace",
    Icon: MapPin,
  },
  {
    key: "matches",
    title: "Matches",
    description:
      "Inspect Intelligent Matching eligibility, confidence distribution, feedback signals, delivery health, and stale candidates without manually approving or changing matches.",
    publicHref: "/matches",
    manageHref: "/matches",
    publicLabel: "Open Matches",
    manageLabel: "Open matching workspace",
    Icon: GitBranch,
  },
];

function readableError(
  payload: ErrorPayload,
  fallback: string
) {
  return typeof payload.error === "string"
    ? payload.error
    : fallback;
}

class AuthorizedRequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string | null
  ) {
    super(message);
    this.name = "AuthorizedRequestError";
  }
}

async function authorizedGet<T>(
  token: string,
  url: string,
  fallback: string
): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new AuthorizedRequestError(
      readableError(payload, fallback),
      response.status,
      typeof payload.code === "string"
        ? payload.code
        : null
    );
  }

  return payload as T;
}

async function authorizedPost(
  token: string,
  url: string,
  body: Record<string, unknown>
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as ErrorPayload;

  if (!response.ok) {
    throw new Error(
      readableError(payload, "The administrator action could not be completed.")
    );
  }

  return payload;
}

function countLabel(value: number | null) {
  return value === null
    ? "Unavailable"
    : value.toLocaleString();
}

function StateCard({
  title,
  description,
  warning = false,
  children,
}: {
  title: string;
  description: string;
  warning?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 py-16 text-[var(--loombus-text)]">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-7 shadow-xl shadow-black/5 sm:p-9">
        <span
          className={[
            "inline-flex h-12 w-12 items-center justify-center rounded-2xl",
            warning
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
              : "bg-[var(--loombus-page-bg)]",
          ].join(" ")}
        >
          {warning ? (
            <CircleAlert aria-hidden="true" />
          ) : (
            <ShieldCheck aria-hidden="true" />
          )}
        </span>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
          Platform Operations
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          {title}
        </h1>
        <p className="mt-3 leading-7 text-[var(--loombus-text-muted)]">
          {description}
        </p>

        {children ? (
          <div className="mt-6 flex flex-wrap gap-3">
            {children}
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function PlatformOperationsClient({
  initialModule,
}: {
  initialModule: PlatformModule;
}) {
  const [accessState, setAccessState] =
    useState<AccessState>("checking");
  const [accessToken, setAccessToken] = useState("");
  const [data, setData] =
    useState<Partial<PlatformData> | null>(null);
  const [moduleErrors, setModuleErrors] =
    useState<ModuleErrors>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [marketplaceNotes, setMarketplaceNotes] =
    useState<Record<string, string>>({});
  const [marketplaceReportNotes, setMarketplaceReportNotes] =
    useState<Record<string, string>>({});

  const load = useCallback(async (token: string) => {
    setLoading(true);
    setError("");

    try {
      const [
        marketplaceResult,
        businessesResult,
        jobsResult,
        eventsResult,
        requestsResult,
        servicesResult,
        roomsResult,
        appointmentsResult,
        localResult,
        matchesResult,
      ] = await Promise.allSettled([
        authorizedGet<MarketplaceManageResponse>(
          token,
          "/api/marketplace?manage=1",
          "Marketplace moderation could not load."
        ),
        authorizedGet<BusinessManageResponse>(
          token,
          "/api/businesses?manage=1",
          "Business Directory moderation could not load."
        ),
        authorizedGet<JobsManageResponse>(
          token,
          "/api/jobs?manage=1",
          "Jobs moderation could not load."
        ),
        authorizedGet<EventsManageResponse>(
          token,
          "/api/events?manage=1",
          "Events moderation could not load."
        ),
        authorizedGet<ServiceRequestManageResponse>(
          token,
          "/api/requests?manage=1",
          "Requests moderation could not load."
        ),
        authorizedGet<ProviderServicesManageResponse>(
          token,
          "/api/services?manage=1",
          "Services moderation could not load."
        ),
        authorizedGet<RoomsAdminResponse>(
          token,
          "/api/admin/platform/rooms",
          "Rooms operations could not load."
        ),
        authorizedGet<AppointmentsAdminResponse>(
          token,
          "/api/admin/platform/appointments",
          "Appointments operations could not load."
        ),
        authorizedGet<LocalAdminResponse>(
          token,
          "/api/admin/platform/local",
          "Local diagnostics could not load."
        ),
        authorizedGet<MatchesAdminResponse>(
          token,
          "/api/admin/platform/matches",
          "Matches diagnostics could not load."
        ),
      ] as const);

      const nextData: Partial<PlatformData> = {};
      const nextErrors: ModuleErrors = {};
      let denied = false;

      function assignResult<K extends PlatformModuleKey>(
        key: K,
        result: PromiseSettledResult<PlatformData[K]>
      ) {
        if (result.status === "fulfilled") {
          if (result.value.isAdmin !== true) {
            denied = true;
            return;
          }

          nextData[key] = result.value;
          return;
        }

        const reason = result.reason;

        if (
          reason instanceof AuthorizedRequestError &&
          reason.status === 403
        ) {
          denied = true;
          return;
        }

        nextErrors[key] =
          reason instanceof Error
            ? reason.message
            : `${
                MODULES.find(
                  (item) => item.key === key
                )?.title ?? "Module"
              } could not load.`;
      }

      assignResult("marketplace", marketplaceResult);
      assignResult("businesses", businessesResult);
      assignResult("jobs", jobsResult);
      assignResult("events", eventsResult);
      assignResult("requests", requestsResult);
      assignResult("services", servicesResult);
      assignResult("rooms", roomsResult);
      assignResult(
        "appointments",
        appointmentsResult
      );
      assignResult("local", localResult);
      assignResult("matches", matchesResult);

      if (denied) {
        setData(null);
        setModuleErrors({});
        setAccessState("denied");
        return;
      }

      const loadedCount = Object.keys(nextData).length;
      const failedModules = Object.keys(
        nextErrors
      ) as PlatformModuleKey[];

      setModuleErrors(nextErrors);

      if (loadedCount === 0) {
        setData(null);
        setError(
          Object.values(nextErrors)[0] ??
            "Platform Operations could not load."
        );
        setAccessState("error");
        return;
      }

      setData(nextData);
      setAccessState("allowed");

      if (failedModules.length > 0) {
        const labels = failedModules
          .map(
            (key) =>
              MODULES.find(
                (item) => item.key === key
              )?.title ?? key
          )
          .join(", ");

        setError(
          `${failedModules.length} ${
            failedModules.length === 1
              ? "module is"
              : "modules are"
          } temporarily unavailable: ${labels}. Available modules remain loaded.`
        );
      }
    } catch (caught) {
      setData(null);
      setModuleErrors({});
      setError(
        caught instanceof Error
          ? caught.message
          : "Platform Operations could not load."
      );
      setAccessState("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function start() {
      try {
        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!active) return;

        const token =
          sessionData.session?.access_token ?? "";

        if (!token) {
          const next =
            initialModule === "overview"
              ? "/admin/platform"
              : `/admin/platform/${initialModule}`;

          window.location.replace(
            `/login?next=${encodeURIComponent(next)}`
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
            : "Administrator access could not be verified."
        );
        setAccessState("error");
        setLoading(false);
      }
    }

    void start();

    return () => {
      active = false;
    };
  }, [initialModule, load]);

  const counts = useMemo(() => {
    const marketplace = data?.marketplace
      ? data.marketplace.moderation.pendingListings.length +
        data.marketplace.moderation.openReports.length
      : null;

    const businesses = data?.businesses
      ? data.businesses.moderation.pendingBusinesses.length +
        data.businesses.moderation.pendingClaims.length +
        data.businesses.moderation.openReports.length
      : null;

    const jobs = data?.jobs
      ? data.jobs.moderation.pendingJobs.length +
        data.jobs.moderation.openReports.length
      : null;

    const events = data?.events
      ? data.events.events.filter(
          (event) => event.status === "pending"
        ).length + data.events.reports.length
      : null;

    const requests = data?.requests
      ? data.requests.metrics.pending +
        data.requests.metrics.openReports
      : null;

    const services = data?.services
      ? data.services.metrics.pending +
        data.services.metrics.openReports
      : null;

    const rooms = data?.rooms
      ? data.rooms.metrics.openReports +
        data.rooms.metrics.billingAttention
      : null;

    const appointments = data?.appointments
      ? data.appointments.metrics.overdueAccepted
      : null;

    const local = data?.local
      ? data.local.metrics.attentionRecords
      : null;

    const matches = data?.matches
      ? data.matches.metrics.attentionTotal
      : null;

    const moduleCounts = [
      marketplace,
      businesses,
      jobs,
      events,
      requests,
      services,
      rooms,
      appointments,
      local,
      matches,
    ];

    const total = moduleCounts.some(
      (value) => value === null
    )
      ? null
      : moduleCounts.reduce<number>(
          (sum, value) => sum + (value ?? 0),
          0
        );

    return {
      marketplace,
      businesses,
      jobs,
      events,
      requests,
      services,
      rooms,
      appointments,
      local,
      matches,
      total,
    };
  }, [data]);

  const runAction = useCallback(
    async (
      endpoint: string,
      payload: Record<string, unknown>,
      successMessage: string
    ) => {
      if (!accessToken || working) return;

      setWorking(true);
      setMessage("");
      setError("");

      try {
        await authorizedPost(
          accessToken,
          endpoint,
          payload
        );
        setMessage(successMessage);
        await load(accessToken);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The administrator action could not be completed."
        );
      } finally {
        setWorking(false);
      }
    },
    [accessToken, load, working]
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
        labels[decision] ??
          "The Marketplace listing was updated."
      );
    },
    [marketplaceNotes, runAction]
  );

  const reviewMarketplaceReport = useCallback(
    async (
      report: MarketplaceReport,
      decision: string
    ) => {
      await runAction(
        "/api/marketplace",
        {
          action: "review_report",
          reportId: report.id,
          decision,
          note:
            marketplaceReportNotes[report.id] ?? "",
        },
        decision === "resolve"
          ? "The Marketplace report was resolved."
          : "The Marketplace report was dismissed."
      );
    },
    [marketplaceReportNotes, runAction]
  );

  if (accessState === "checking" && !data) {
    return (
      <StateCard
        title="Verifying administrator access"
        description="Loombus is confirming your existing administrator role and loading the operational queues."
      >
        <Loader2
          className="animate-spin"
          aria-label="Loading"
        />
      </StateCard>
    );
  }

  if (accessState === "denied") {
    return (
      <StateCard
        title="Administrator access is required"
        description="This workspace is restricted to accounts with the existing Loombus administrator role. No platform queue data was displayed."
        warning
      >
        <Link
          href="/discussions"
          className="rounded-xl bg-[var(--loombus-text)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-page-bg)]"
        >
          Return to Loombus
        </Link>
        <Link
          href="/support"
          className="rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
        >
          Open Support
        </Link>
      </StateCard>
    );
  }

  if (accessState === "error" && !data) {
    return (
      <StateCard
        title="Platform Operations could not load"
        description={
          error ||
          "Refresh the page and try again."
        }
        warning
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-xl bg-[var(--loombus-text)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-page-bg)]"
        >
          Reload page
        </button>
        <Link
          href="/admin"
          className="rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold"
        >
          Admin home
        </Link>
      </StateCard>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--loombus-page-bg)] px-4 pb-24 pt-8 text-[var(--loombus-text)] sm:px-6">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--loombus-text-muted)]"
        >
          <ArrowLeft size={16} />
          Admin Operations Center
        </Link>

        <header className="mt-5 rounded-[2rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6 shadow-xl shadow-black/5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--loombus-text-subtle)]">
                Platform Operations
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-[-0.05em] sm:text-5xl">
                Trust, moderation, and operational oversight.
              </h1>
              <p className="mt-4 leading-7 text-[var(--loombus-text-muted)]">
                Review Marketplace, Business Directory, Jobs,
                Events, Requests, Services, Rooms, Appointments,
                Local, and Matches without entering seller,
                organizer, requester, provider, employer, private
                Room, location-source, or matching-rule workflows.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setMessage("");
                void load(accessToken);
              }}
              disabled={
                loading || working || !accessToken
              }
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading ? "animate-spin" : ""
                }
              />
              {loading
                ? "Refreshing"
                : "Refresh queues"}
            </button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                Active queue
              </p>
              <strong className="mt-2 block text-3xl">
                {countLabel(counts.total)}
              </strong>
              <span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">
                {counts.total === null
                  ? "One or more module totals are unavailable. Available queues remain usable."
                  : "Items requiring an administrator decision."}
              </span>
            </article>

            {MODULES.map((module) => (
              <article
                key={module.key}
                className="rounded-2xl bg-[var(--loombus-page-bg)] p-4"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                  {module.title}
                </p>
                <strong className="mt-2 block text-3xl">
                  {countLabel(counts[module.key])}
                </strong>
                <span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">
                  {counts[module.key] === null
                    ? "This module is temporarily unavailable. Other queues remain loaded."
                    : "Pending decisions, reports, and operational exceptions."}
                </span>
              </article>
            ))}
          </div>
        </header>

        <nav
          className="mt-5 flex gap-2 overflow-x-auto rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-2"
          aria-label="Platform Operations modules"
        >
          <Link
            href="/admin/platform"
            aria-current={
              initialModule === "overview"
                ? "page"
                : undefined
            }
            className={[
              "shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold",
              initialModule === "overview"
                ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]"
                : "text-[var(--loombus-text-muted)]",
            ].join(" ")}
          >
            Overview
          </Link>

          {MODULES.map((module) => {
            const active =
              initialModule === module.key;
            const count = counts[module.key];

            return (
              <Link
                key={module.key}
                href={`/admin/platform/${module.key}`}
                aria-current={
                  active ? "page" : undefined
                }
                className={[
                  "inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold",
                  active
                    ? "bg-[var(--loombus-text)] text-[var(--loombus-page-bg)]"
                    : "text-[var(--loombus-text-muted)]",
                ].join(" ")}
              >
                {module.title}
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-xs",
                    active
                      ? "bg-[var(--loombus-page-bg)]/15"
                      : "bg-[var(--loombus-page-bg)]",
                  ].join(" ")}
                >
                  {countLabel(count)}
                </span>
              </Link>
            );
          })}
        </nav>

        {message ? (
          <p
            className="mt-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300"
            role="status"
          >
            {message}
          </p>
        ) : null}

        {error ? (
          <p
            className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        {initialModule === "overview" ? (
          <section className="mt-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--loombus-text-subtle)]">
                Platform modules
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                Choose an operational queue.
              </h2>
              <p className="mt-2 text-[var(--loombus-text-muted)]">
                The cards below open dedicated administrator
                surfaces. They do not expose creation or editing
                tools.
              </p>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {MODULES.map((module) => {
                const count = counts[module.key];

                return (
                  <article
                    key={module.key}
                    className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6"
                  >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--loombus-page-bg)]">
                      <module.Icon
                        size={21}
                        aria-hidden="true"
                      />
                    </span>

                    <div className="mt-5 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {module.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                          {module.description}
                        </p>
                      </div>

                      <span className="rounded-full bg-[var(--loombus-page-bg)] px-3 py-1 text-sm font-bold">
                        {countLabel(count)}
                      </span>
                    </div>

                    <Link
                      href={`/admin/platform/${module.key}`}
                      className="mt-6 inline-flex rounded-xl bg-[var(--loombus-text)] px-4 py-2.5 text-sm font-semibold text-[var(--loombus-page-bg)]"
                    >
                      Open administrator queue
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {MODULES.map((module) => {
          if (initialModule !== module.key) {
            return null;
          }

          const moduleError =
            moduleErrors[module.key];

          return (
            <section key={module.key} className="mt-6">
              <div className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--loombus-page-bg)]">
                      <module.Icon
                        size={21}
                        aria-hidden="true"
                      />
                    </span>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.17em] text-[var(--loombus-text-subtle)]">
                        Administrator module
                      </p>
                      <h2 className="mt-1 text-2xl font-semibold">
                        {module.title}
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                        {module.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={module.publicHref}
                      className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      {module.publicLabel ??
                        "View public surface"}
                    </Link>
                    <Link
                      href={module.manageHref}
                      className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      {module.manageLabel ??
                        "Open owner workspace"}
                    </Link>
                  </div>
                </div>
              </div>

              {moduleError ? (
                <div
                  className="mt-6 rounded-[1.6rem] border border-amber-500/30 bg-amber-500/10 p-5 sm:p-6"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <CircleAlert
                      className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-300"
                      size={20}
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-semibold">
                        {module.title} is temporarily
                        unavailable
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                        {moduleError}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void load(accessToken)
                        }
                        disabled={
                          loading ||
                          working ||
                          !accessToken
                        }
                        className="mt-4 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50"
                      >
                        Retry queues
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {module.key === "marketplace" &&
              data?.marketplace ? (
                <>
                  <MarketplaceAdminMetrics />
                  <MarketplaceAdminReview
                    data={data.marketplace}
                    working={working}
                    moderationNotes={
                      marketplaceNotes
                    }
                    setModerationNotes={
                      setMarketplaceNotes
                    }
                    reportNotes={
                      marketplaceReportNotes
                    }
                    setReportNotes={
                      setMarketplaceReportNotes
                    }
                    moderate={
                      moderateMarketplace
                    }
                    reviewReport={
                      reviewMarketplaceReport
                    }
                  />
                </>
              ) : null}

              {module.key === "businesses" &&
              data?.businesses ? (
                <BusinessModerationPanel
                  moderation={
                    data.businesses.moderation
                  }
                  moderate={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/businesses",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "jobs" &&
              data?.jobs ? (
                <JobModerationPanel
                  pendingJobs={
                    data.jobs.moderation
                      .pendingJobs
                  }
                  openReports={
                    data.jobs.moderation
                      .openReports
                  }
                  moderate={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/jobs",
                      payload,
                      successMessage
                    )
                  }
                  working={working}
                />
              ) : null}

              {module.key === "events" &&
              data?.events ? (
                <EventModerationPanel
                  data={data.events}
                  working={working}
                  runAction={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/events",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "requests" &&
              data?.requests ? (
                <RequestModerationPanel
                  data={data.requests}
                  working={working}
                  runAction={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/requests",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "services" &&
              data?.services ? (
                <ServiceModerationPanel
                  data={data.services}
                  working={working}
                  runAction={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/services",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "rooms" &&
              data?.rooms ? (
                <RoomOperationsPanel
                  data={data.rooms}
                  working={working}
                  runAction={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/admin/platform/rooms",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "appointments" &&
              data?.appointments ? (
                <AppointmentOperationsPanel
                  data={data.appointments}
                  working={working}
                  runAction={(
                    payload,
                    successMessage
                  ) =>
                    runAction(
                      "/api/admin/platform/appointments",
                      payload,
                      successMessage
                    )
                  }
                />
              ) : null}

              {module.key === "local" &&
              data?.local ? (
                <LocalOperationsPanel
                  data={data.local}
                />
              ) : null}

              {module.key === "matches" &&
              data?.matches ? (
                <MatchesOperationsPanel
                  data={data.matches}
                />
              ) : null}
            </section>
          );
        })}
      </div>
    </main>
  );
}
