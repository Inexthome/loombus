"use client";

import Link from "next/link";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleAlert,
  HandHeart,
  Loader2,
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
  | "services";

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
};

type ModuleDefinition = {
  key: Exclude<PlatformModule, "overview">;
  title: string;
  description: string;
  publicHref: string;
  manageHref: string;
  Icon: LucideIcon;
};

type ErrorPayload = {
  error?: unknown;
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
];

function readableError(
  payload: ErrorPayload,
  fallback: string
) {
  return typeof payload.error === "string"
    ? payload.error
    : fallback;
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
    throw new Error(readableError(payload, fallback));
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

function countLabel(value: number) {
  return value.toLocaleString();
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
  const [data, setData] = useState<PlatformData | null>(null);
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
        marketplace,
        businesses,
        jobs,
        events,
        requests,
        services,
      ] = await Promise.all([
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
      ]);

      if (
        !marketplace.isAdmin ||
        !businesses.isAdmin ||
        !jobs.isAdmin ||
        !events.isAdmin ||
        !requests.isAdmin ||
        !services.isAdmin
      ) {
        setData(null);
        setAccessState("denied");
        return;
      }

      setData({
        marketplace,
        businesses,
        jobs,
        events,
        requests,
        services,
      });
      setAccessState("allowed");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Platform Operations could not load."
      );
      setAccessState((current) =>
        current === "allowed" ? "allowed" : "error"
      );
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
    const marketplace =
      (data?.marketplace.moderation.pendingListings.length ??
        0) +
      (data?.marketplace.moderation.openReports.length ?? 0);

    const businesses =
      (data?.businesses.moderation.pendingBusinesses.length ??
        0) +
      (data?.businesses.moderation.pendingClaims.length ?? 0) +
      (data?.businesses.moderation.openReports.length ?? 0);

    const jobs =
      (data?.jobs.moderation.pendingJobs.length ?? 0) +
      (data?.jobs.moderation.openReports.length ?? 0);

    const events =
      (data?.events.events.filter(
        (event) => event.status === "pending"
      ).length ?? 0) +
      (data?.events.reports.length ?? 0);

    const requests =
      (data?.requests.metrics.pending ?? 0) +
      (data?.requests.metrics.openReports ?? 0);

    const services =
      (data?.services.metrics.pending ?? 0) +
      (data?.services.metrics.openReports ?? 0);

    return {
      marketplace,
      businesses,
      jobs,
      events,
      requests,
      services,
      total:
        marketplace +
        businesses +
        jobs +
        events +
        requests +
        services,
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
                Trust, moderation, and public operations.
              </h1>
              <p className="mt-4 leading-7 text-[var(--loombus-text-muted)]">
                Review Marketplace, Business Directory, Jobs,
                Events, Requests, and Services without entering
                seller, organizer, requester, provider, or employer
                creation workflows.
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
                Items requiring an administrator decision.
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
                  Pending decisions and open reports.
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
                      View public surface
                    </Link>
                    <Link
                      href={module.manageHref}
                      className="rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold"
                    >
                      Open owner workspace
                    </Link>
                  </div>
                </div>
              </div>

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
            </section>
          );
        })}
      </div>
    </main>
  );
}
