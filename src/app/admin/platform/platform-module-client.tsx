"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Database,
  DoorOpen,
  Flag,
  GitBranch,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
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
import type {
  AppointmentsAdminResponse,
  RoomsAdminResponse,
} from "@/components/platform-phase3-operations-panels";
import type {
  LocalAdminResponse,
  MatchesAdminResponse,
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
  AdminActionButton,
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

type ActionRunner = (
  payload: Record<string, unknown>,
  successMessage: string,
) => void | Promise<void>;

type ProfileSummary = {
  id: string;
  displayName: string;
  username: string | null;
  accountStatus?: string | null;
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

const recordClass =
  "rounded-[1.55rem] border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5 sm:p-6";
const emptyClass =
  "rounded-2xl border border-dashed border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-7 text-center text-sm text-[var(--loombus-text-muted)]";
const detailPillClass =
  "inline-flex items-center gap-1.5 rounded-full border border-[var(--loombus-border)] px-3 py-1.5 text-xs text-[var(--loombus-text-muted)]";
const textareaClass =
  "mt-3 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const dangerButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-500/30 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300";

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

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function identity(profile: ProfileSummary) {
  return profile.username
    ? `${profile.displayName} (@${profile.username})`
    : profile.displayName;
}

function QueueBadge({ count, noun = "open" }: { count: number; noun?: string }) {
  return (
    <AdminStatusBadge status={count ? "attention" : "ready"}>
      {count ? `${count} ${noun}` : "Queue clear"}
    </AdminStatusBadge>
  );
}

function StatusPill({ value, attention = false }: { value: string; attention?: boolean }) {
  return (
    <AdminStatusBadge status={attention ? "attention" : "ready"}>
      {value.replaceAll("_", " ")}
    </AdminStatusBadge>
  );
}

function NotesField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <label className="mt-5 block text-sm font-semibold" htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        rows={3}
        maxLength={2000}
        value={value}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(event.target.value)
        }
        placeholder={placeholder}
        className={textareaClass}
      />
    </>
  );
}

function BoundaryCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
      <div className="flex items-start gap-3">
        <ShieldCheck
          className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300"
          size={19}
          aria-hidden="true"
        />
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {description}
          </p>
          {children ? <div className="mt-4 flex flex-wrap gap-2">{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

function RoomsOperationsWorkspace({
  data,
  working,
  runAction,
}: {
  data: RoomsAdminResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const attentionRooms = useMemo(
    () =>
      data.rooms.filter(
        (room) =>
          room.openReports > 0 ||
          room.pendingApplications > 0 ||
          room.status === "pending_deletion" ||
          !["active", "trialing", "free"].includes(
            room.subscriptionStatus.toLowerCase(),
          ),
      ),
    [data.rooms],
  );
  const noteFor = (id: string) => notes[id] ?? "";
  const setNote = (id: string, value: string) =>
    setNotes((current) => ({ ...current, [id]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Open reports"
          value={data.metrics.openReports}
          description="Private Room report snapshots awaiting an administrator outcome."
          icon={<Flag size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Room registry"
          value={data.metrics.totalRooms}
          description={`${data.metrics.activeRooms} active, ${data.metrics.archivedRooms} archived, and ${data.metrics.pendingDeletion} pending deletion.`}
          icon={<DoorOpen size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Pending access"
          value={data.metrics.pendingApplications}
          description="Membership applications still controlled by Room owners and managers."
          icon={<Users size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Billing attention"
          value={data.metrics.billingAttention}
          description="Room subscriptions carrying an exception or inactive billing state."
          icon={<AlertTriangle size={20} aria-hidden="true" />}
        />
      </div>

      <AdminQueueSection
        eyebrow="Privacy boundary"
        title="Private Room operations remain scoped"
        description="The Admin workspace receives Room metadata, operational counts, billing-state presence, and only the snapshots members deliberately included in reports."
        action={<AdminStatusBadge status="ready">Boundary enforced</AdminStatusBadge>}
      >
        <BoundaryCard
          title="Private content is not loaded"
          description="Room discussions, files, resources, calendars, and member workspaces remain outside this administrator payload. Suspension, ownership transfer, and billing mutation are not exposed because durable platform-level action contracts do not exist for them."
        >
          <StatusPill value="Metadata only" />
          <StatusPill value="Report snapshots only" />
          <StatusPill value="No billing mutation" />
        </BoundaryCard>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Trust and safety"
        title="Open Room reports"
        description="Resolve or dismiss submitted Room report snapshots while preserving the original report, target attribution, and administrator audit note."
        action={<QueueBadge count={data.reports.length} />}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.reports.map((report) => (
            <article key={report.id} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={report.state} attention />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                  {report.targetType.replaceAll("_", " ")}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{report.targetLabel}</h3>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                {report.roomName} · Reported by {identity(report.reporter)}
              </p>
              <p className="mt-4 text-sm font-semibold">{report.reason}</p>
              {report.details ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">
                  {report.details}
                </p>
              ) : null}
              {report.targetSnapshot ? (
                <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                    Submitted snapshot
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-7">
                    {report.targetSnapshot}
                  </p>
                </div>
              ) : null}
              <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                Submitted {formatDateTime(report.createdAt)}
              </p>
              <NotesField
                id={`room-report-note-${report.id}`}
                label="Decision note"
                placeholder="Record the review outcome or supporting context."
                value={noteFor(report.id)}
                onChange={(value) => setNote(report.id, value)}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <AdminActionButton
                  type="button"
                  primary
                  disabled={working}
                  onClick={() =>
                    void runAction(
                      {
                        action: "review_report",
                        reportId: report.id,
                        decision: "resolve",
                        note: noteFor(report.id),
                      },
                      "The Room report was resolved.",
                    )
                  }
                >
                  <CheckCircle2 size={15} aria-hidden="true" /> Resolve
                </AdminActionButton>
                <AdminActionButton
                  type="button"
                  disabled={working}
                  onClick={() =>
                    void runAction(
                      {
                        action: "review_report",
                        reportId: report.id,
                        decision: "dismiss",
                        note: noteFor(report.id),
                      },
                      "The Room report was dismissed.",
                    )
                  }
                >
                  <XCircle size={15} aria-hidden="true" /> Dismiss
                </AdminActionButton>
              </div>
            </article>
          ))}
          {data.reports.length === 0 ? (
            <p className={emptyClass}>No private Room reports require review.</p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational attention"
        title="Rooms with exceptions"
        description="Review Room status, membership pressure, report volume, owner identity, and billing-state presence without exposing private content."
        action={<QueueBadge count={attentionRooms.length} noun="flagged" />}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {attentionRooms.slice(0, 100).map((room) => (
            <article key={room.id} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  value={room.status}
                  attention={room.status !== "active"}
                />
                <StatusPill
                  value={room.subscriptionStatus}
                  attention={!["active", "trialing", "free"].includes(
                    room.subscriptionStatus.toLowerCase(),
                  )}
                />
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                  {room.subscriptionPlan.replaceAll("_", " ")}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold">{room.name}</h3>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                Owner: {identity(room.owner)}
              </p>
              {room.description ? (
                <p className="mt-3 line-clamp-3 text-sm leading-7 text-[var(--loombus-text-muted)]">
                  {room.description}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={detailPillClass}>
                  <Users size={13} aria-hidden="true" /> {room.memberCount.toLocaleString()}
                  {room.memberLimit === null
                    ? " members"
                    : ` of ${room.memberLimit.toLocaleString()} members`}
                </span>
                <span className={detailPillClass}>{room.openReports} reports</span>
                <span className={detailPillClass}>
                  {room.pendingApplications} access requests
                </span>
                <span className={detailPillClass}>
                  Billing identity: {room.hasStripeCustomer || room.hasStripeSubscription ? "Connected" : "Not connected"}
                </span>
                <span className={detailPillClass}>
                  Period end: {formatDateTime(room.currentPeriodEnd)}
                </span>
              </div>
              <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">
                Updated {formatDateTime(room.updatedAt)}
              </p>
            </article>
          ))}
          {attentionRooms.length === 0 ? (
            <p className={emptyClass}>
              No Room reports, membership queues, deletion states, or billing exceptions require attention.
            </p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Registry"
        title="Recent Rooms"
        description="A responsive registry view of the Room records returned by the protected endpoint."
        action={<AdminStatusBadge status="ready">{data.rooms.length} records</AdminStatusBadge>}
      >
        <div className="grid gap-3 xl:grid-cols-2">
          {data.rooms.map((room) => (
            <article key={room.id} className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-semibold">{room.name}</h3>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {identity(room.owner)} · {room.roomType.replaceAll("_", " ")}
                  </p>
                </div>
                <StatusPill value={room.status} attention={room.status !== "active"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--loombus-text-muted)]">
                <span>{room.subscriptionPlan.replaceAll("_", " ")} plan</span>
                <span>·</span>
                <span>{room.memberCount.toLocaleString()} members</span>
                <span>·</span>
                <span>{room.openReports} reports</span>
                <span>·</span>
                <span>Updated {formatDateTime(room.updatedAt)}</span>
              </div>
            </article>
          ))}
          {data.rooms.length === 0 ? <p className={emptyClass}>No Rooms were returned.</p> : null}
        </div>
      </AdminQueueSection>
    </div>
  );
}

function AppointmentsOperationsWorkspace({
  data,
  working,
  runAction,
}: {
  data: AppointmentsAdminResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const operationalRequests = useMemo(
    () =>
      data.requests.filter((request) =>
        ["pending", "accepted", "reschedule_proposed"].includes(request.status),
      ),
    [data.requests],
  );
  const noteFor = (id: string) => notes[id] ?? "";
  const setNote = (id: string, value: string) =>
    setNotes((current) => ({ ...current, [id]: value }));

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Overdue accepted"
          value={data.metrics.overdueAccepted}
          description="Accepted appointments whose scheduled end has passed."
          icon={<Clock3 size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Pending requests"
          value={data.metrics.pendingRequests}
          description="Requests awaiting the normal provider response workflow."
          icon={<CalendarClock size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Accepted"
          value={data.metrics.acceptedRequests}
          description="Confirmed appointments currently in the lifecycle."
          icon={<CheckCircle2 size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Active services"
          value={data.metrics.activeServices}
          description="Appointment services currently accepting requests."
          icon={<Building2 size={20} aria-hidden="true" />}
        />
      </div>

      <AdminQueueSection
        eyebrow="Operational boundary"
        title="Administrator intervention is lifecycle-only"
        description="Provider publishing remains in the provider workspace. The only administrator mutation exposed by the existing endpoint is an audited cancellation of an active request."
        action={<AdminStatusBadge status="ready">Contract preserved</AdminStatusBadge>}
      >
        <BoundaryCard
          title="No hidden professional or payment controls"
          description="There is no appointment dispute queue, provider credential review, durable provider suspension, payment operation, or professional ranking system in this module."
        >
          <StatusPill value="Audited cancellation" />
          <StatusPill value="Provider-owned publishing" />
          <StatusPill value="No payment operations" />
        </BoundaryCard>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Appointment lifecycle"
        title="Active requests"
        description="Review provider, requester, schedule, notes, and current status before using the existing administrator cancellation contract."
        action={<QueueBadge count={operationalRequests.length} noun="active" />}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {operationalRequests.slice(0, 150).map((request) => (
            <article key={request.id} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={request.status} attention={request.overdue} />
                {request.overdue ? (
                  <AdminStatusBadge status="attention">Overdue</AdminStatusBadge>
                ) : null}
              </div>
              <h3 className="mt-3 text-xl font-semibold">{request.serviceName}</h3>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                {request.businessName}
              </p>
              <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <span><strong>Provider:</strong> {identity(request.provider)}</span>
                <span><strong>Requester:</strong> {identity(request.requester)}</span>
                <span>
                  <strong>Scheduled:</strong>{" "}
                  {formatDateTime(
                    request.status === "reschedule_proposed"
                      ? request.proposedStart
                      : request.requestedStart,
                  )}
                </span>
                <span><strong>Timezone:</strong> {request.timezone}</span>
              </div>
              {request.note ? (
                <p className="mt-4 rounded-2xl bg-[var(--loombus-surface)] p-4 text-sm leading-7 text-[var(--loombus-text-muted)]">
                  <strong className="text-[var(--loombus-text)]">Requester note:</strong>{" "}
                  {request.note}
                </p>
              ) : null}
              {request.providerNote ? (
                <p className="mt-3 rounded-2xl bg-[var(--loombus-surface)] p-4 text-sm leading-7 text-[var(--loombus-text-muted)]">
                  <strong className="text-[var(--loombus-text)]">Provider note:</strong>{" "}
                  {request.providerNote}
                </p>
              ) : null}
              <NotesField
                id={`appointment-cancel-note-${request.id}`}
                label="Administrator cancellation reason"
                placeholder="Required for the audit log and party notifications."
                value={noteFor(request.id)}
                onChange={(value) => setNote(request.id, value)}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working || noteFor(request.id).trim().length < 3}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Cancel this appointment request? Both parties will be notified.",
                      )
                    ) {
                      void runAction(
                        {
                          action: "cancel_request",
                          requestId: request.id,
                          note: noteFor(request.id),
                        },
                        "The appointment request was cancelled.",
                      );
                    }
                  }}
                  className={dangerButtonClass}
                >
                  <XCircle size={15} aria-hidden="true" /> Cancel appointment
                </button>
              </div>
            </article>
          ))}
          {operationalRequests.length === 0 ? (
            <p className={emptyClass}>
              No pending, accepted, or reschedule-proposed appointments are active.
            </p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Provider registry"
        title="Appointment services"
        description="Inspect business ownership, service status, delivery details, location, duration, and provider account state. Publishing controls remain with the provider."
        action={<AdminStatusBadge status="ready">{data.services.length} services</AdminStatusBadge>}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.services.slice(0, 200).map((service) => (
            <article key={service.id} className={recordClass}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill value={service.status} attention={service.status !== "active"} />
                    {service.owner.accountStatus && service.owner.accountStatus !== "active" ? (
                      <StatusPill value={service.owner.accountStatus} attention />
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-xl font-semibold">{service.name}</h3>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {service.businessName} · {identity(service.owner)}
                  </p>
                </div>
                {service.businessSlug ? (
                  <Link
                    href={`/businesses/${service.businessSlug}`}
                    className="shrink-0 text-sm font-semibold text-[var(--loombus-gold)]"
                  >
                    Open business
                  </Link>
                ) : null}
              </div>
              <p className="mt-4 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">
                {service.description}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={detailPillClass}>{service.durationMinutes} minutes</span>
                <span className={detailPillClass}>
                  <MapPin size={13} aria-hidden="true" /> {service.locationText || service.locationMode.replaceAll("_", " ")}
                </span>
                <span className={detailPillClass}>{service.priceText || "Price not stated"}</span>
                <span className={detailPillClass}>Business: {service.businessStatus || "Unavailable"}</span>
              </div>
              {service.instructions ? (
                <p className="mt-4 rounded-2xl bg-[var(--loombus-surface)] p-4 text-sm leading-7 text-[var(--loombus-text-muted)]">
                  {service.instructions}
                </p>
              ) : null}
              <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">
                Updated {formatDateTime(service.updatedAt)}
              </p>
            </article>
          ))}
          {data.services.length === 0 ? (
            <p className={emptyClass}>No appointment services exist.</p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Lifecycle totals"
        title="Appointment state distribution"
        description="Current read-only totals across reschedules, completions, cancellations, and paused provider services."
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Reschedules" value={data.metrics.rescheduleProposed} description="Proposed times awaiting requester acceptance." />
          <AdminMetricCard label="Completed" value={data.metrics.completedRequests} description="Appointments marked complete by providers." />
          <AdminMetricCard label="Cancelled" value={data.metrics.cancelledRequests} description="Requests cancelled by a party or administration." />
          <AdminMetricCard label="Paused services" value={data.metrics.pausedServices} description="Services not currently accepting requests." />
        </div>
      </AdminQueueSection>
    </div>
  );
}

function LocalOperationsWorkspace({ data }: { data: LocalAdminResponse }) {
  const coverage =
    data.metrics.activePublic > 0
      ? Math.round((data.metrics.anchored / data.metrics.activePublic) * 100)
      : 100;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Active Local records"
          value={data.metrics.activePublic}
          description="Public active source documents eligible for Local Discovery."
          icon={<MapPin size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Location coverage"
          value={`${coverage}%`}
          description="Records with direct, inherited, or place-based location context."
        />
        <AdminMetricCard
          label="Missing location"
          value={data.metrics.missingLocation}
          description="Active non-remote records without usable Local area context."
          icon={<AlertTriangle size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="30-day review"
          value={data.metrics.stale30Days}
          description="Records with an absent or older source timestamp."
          icon={<Clock3 size={20} aria-hidden="true" />}
        />
      </div>

      <AdminQueueSection
        eyebrow="Source health"
        title="Local coverage by module"
        description="Inspect the shared Local Discovery document and privacy-safe location layers without rebuilding the index or mutating source records."
        action={<AdminStatusBadge status="ready">{data.metrics.sourceCount} sources</AdminStatusBadge>}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.sources.map((source) => (
            <article key={source.sourceTable} className={recordClass}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{source.label}</h3>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {source.total.toLocaleString()} indexed documents
                  </p>
                </div>
                <AdminStatusBadge
                  status={source.missingLocation || source.stale30Days ? "attention" : "ready"}
                >
                  {source.coveragePercent}% covered
                </AdminStatusBadge>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm"><strong className="block text-lg">{source.activePublic}</strong>Active public</div>
                <div className="rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm"><strong className="block text-lg">{source.anchored}</strong>Anchored</div>
                <div className="rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm"><strong className="block text-lg">{source.missingLocation}</strong>Missing location</div>
                <div className="rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm"><strong className="block text-lg">{source.stale30Days}</strong>30-day review</div>
                <div className="rounded-2xl bg-[var(--loombus-surface)] p-3 text-sm"><strong className="block text-lg">{source.remoteAvailable}</strong>Remote available</div>
              </div>
            </article>
          ))}
          {data.sources.length === 0 ? (
            <p className={emptyClass}>No Local source summaries were returned.</p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational attention"
        title="Location and freshness exceptions"
        description="Open the owning record to correct missing location context or review stale source data. Local does not expose a parallel editor."
        action={<QueueBadge count={data.attention.length} noun="flagged" />}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.attention.map((record) => (
            <article key={`${record.sourceTable}:${record.id}`} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill value={record.sourceLabel} />
                {record.missingLocation ? (
                  <AdminStatusBadge status="attention">Missing location</AdminStatusBadge>
                ) : null}
                {record.stale ? (
                  <AdminStatusBadge status="attention">
                    {record.ageDays === null ? "Timestamp missing" : `${record.ageDays} days old`}
                  </AdminStatusBadge>
                ) : null}
              </div>
              <h3 className="mt-3 text-xl font-semibold">{record.title}</h3>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                {record.ownerLabel}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={detailPillClass}>
                  <MapPin size={13} aria-hidden="true" /> {record.locationLabel}
                </span>
                <span className={detailPillClass}>{record.visibility}</span>
                <span className={detailPillClass}>{record.status}</span>
                {record.remoteAvailable ? <span className={detailPillClass}>Remote available</span> : null}
              </div>
              <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">
                Updated {formatDateTime(record.updatedAt)}
              </p>
              <Link
                href={record.href}
                className="mt-4 inline-flex min-h-11 items-center rounded-full border border-[var(--loombus-border)] px-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)]"
              >
                Open owning record
              </Link>
            </article>
          ))}
          {data.attention.length === 0 ? (
            <p className={emptyClass}>
              No active Local records meet the missing-location or 30-day review criteria.
            </p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational boundary"
        title="Local remains an aggregation layer"
        description="Publication, suspension, removal, ownership, and location editing remain in the source module that owns each record."
        action={<AdminStatusBadge status="ready">Diagnostic only</AdminStatusBadge>}
      >
        <BoundaryCard
          title="No parallel source mutation"
          description="This workspace reports source health and directs administrators to the owning record. It does not expose global edits, record deletion, visibility changes, or index rebuild actions."
        />
      </AdminQueueSection>
    </div>
  );
}

function MatchesOperationsWorkspace({ data }: { data: MatchesAdminResponse }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="Eligible candidates"
          value={data.metrics.eligible}
          description="Candidates carrying the existing eligible status."
          icon={<Sparkles size={20} aria-hidden="true" />}
          featured
        />
        <AdminMetricCard
          label="Average confidence"
          value={`${data.metrics.averageConfidence}%`}
          description="Average stored confidence across the inspected window."
          icon={<GitBranch size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Feedback attention"
          value={data.metrics.feedbackAttention}
          description="Unsafe and incorrect member feedback signals."
          icon={<Flag size={20} aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Operational exceptions"
          value={data.metrics.attentionTotal}
          description="Feedback attention, stale candidates, and failed deliveries."
          icon={<AlertTriangle size={20} aria-hidden="true" />}
        />
      </div>

      <AdminQueueSection
        eyebrow="Algorithm health"
        title="Eligibility, confidence, and delivery"
        description="Inspect stored matching output generated from active Requests and Services. This workspace does not approve candidates or alter scoring."
        action={<AdminStatusBadge status="ready">Read-only diagnostics</AdminStatusBadge>}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="High confidence" value={data.metrics.highConfidence} description="Stored confidence of 80 or higher." />
          <AdminMetricCard label="Medium confidence" value={data.metrics.mediumConfidence} description="Stored confidence from 60 through 79." />
          <AdminMetricCard label="Low confidence" value={data.metrics.lowConfidence} description="Stored confidence below 60." />
          <AdminMetricCard label="Stale eligible" value={data.metrics.staleEligible} description="Older than seven days or past expiration." />
          <AdminMetricCard label="Expired" value={data.metrics.expired} description="Candidates carrying an expired status." />
          <AdminMetricCard label="Ineligible" value={data.metrics.ineligible} description="Candidates excluded by existing eligibility rules." />
          <AdminMetricCard label="Paused accounts" value={data.metrics.pausedAccounts} description="Members who paused matching." />
          <AdminMetricCard label="Active rules" value={data.metrics.activeRules} description="Saved user rules marked active." />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <article className={recordClass}>
            <h3 className="font-semibold">Candidate activity</h3>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <span>Unviewed eligible: {data.metrics.unviewedEligible}</span>
              <span>Saved: {data.metrics.saved}</span>
              <span>Dismissed: {data.metrics.dismissed}</span>
              <span>Acted on: {data.metrics.actedOn}</span>
            </div>
          </article>
          <article className={recordClass}>
            <h3 className="font-semibold">Delivery states</h3>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <span>Queued: {data.deliveryCounts.queued}</span>
              <span>Sent: {data.deliveryCounts.sent}</span>
              <span>Skipped: {data.deliveryCounts.skipped}</span>
              <span>Failed: {data.deliveryCounts.failed}</span>
            </div>
          </article>
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Member feedback"
        title="Quality and safety signals"
        description="The current schema records feedback but does not provide a review or resolution status. These signals remain diagnostic."
        action={<QueueBadge count={data.feedbackSignals.length} noun="signals" />}
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard label="Unsafe" value={data.feedbackCounts.unsafe} description="Candidates marked unsafe." />
          <AdminMetricCard label="Incorrect" value={data.feedbackCounts.incorrect} description="Candidates marked incorrect." />
          <AdminMetricCard label="Not relevant" value={data.feedbackCounts.notRelevant} description="Candidates marked not relevant." />
          <AdminMetricCard label="Helpful" value={data.feedbackCounts.helpful} description="Candidates marked helpful." />
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {data.feedbackSignals.map((signal) => (
            <article key={signal.id} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  status={["unsafe", "incorrect"].includes(signal.feedbackType) ? "attention" : "ready"}
                >
                  {signal.feedbackType.replaceAll("_", " ")}
                </AdminStatusBadge>
                {signal.confidence !== null ? (
                  <StatusPill value={`${signal.confidence}% confidence`} />
                ) : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{signal.viewerLabel}</h3>
              {signal.source && signal.target ? (
                <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                  {signal.source.title} to {signal.target.title}
                </p>
              ) : null}
              {signal.note ? (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[var(--loombus-text-muted)]">
                  {signal.note}
                </p>
              ) : null}
              <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                Submitted {formatDateTime(signal.createdAt)}
              </p>
            </article>
          ))}
          {data.feedbackSignals.length === 0 ? (
            <p className={emptyClass}>No matching feedback signals were returned.</p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Candidate diagnostics"
        title="Recent match candidates"
        description="Review viewer account status, source and target records, direction, confidence, stored explanations, lifecycle state, and freshness."
        action={<AdminStatusBadge status="ready">{data.candidates.length} candidates</AdminStatusBadge>}
      >
        <div className="grid gap-4 xl:grid-cols-2">
          {data.candidates.map((candidate) => (
            <article key={candidate.id} className={recordClass}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill
                  value={candidate.eligibilityStatus}
                  attention={candidate.eligibilityStatus !== "eligible"}
                />
                <StatusPill value={`${candidate.confidence}% confidence`} />
                {candidate.stale ? (
                  <AdminStatusBadge status="attention">Operational review</AdminStatusBadge>
                ) : null}
                {candidate.saved ? <StatusPill value="Saved" /> : null}
                {candidate.dismissed ? <StatusPill value="Dismissed" /> : null}
                {candidate.actedOn ? <StatusPill value="Acted on" /> : null}
              </div>
              <h3 className="mt-3 text-lg font-semibold">{candidate.viewerLabel}</h3>
              <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">
                Account: {candidate.viewerAccountStatus}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <Link
                  href={candidate.source.href}
                  className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)]"
                >
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                    {candidate.source.type}
                  </span>
                  <span className="mt-1 block">{candidate.source.title}</span>
                </Link>
                <Sparkles
                  size={17}
                  className="mx-auto text-[var(--loombus-gold)]"
                  aria-hidden="true"
                />
                <Link
                  href={candidate.target.href}
                  className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm font-semibold transition hover:border-[var(--loombus-gold)]"
                >
                  <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                    {candidate.target.type}
                  </span>
                  <span className="mt-1 block">{candidate.target.title}</span>
                </Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className={detailPillClass}>Direction: {candidate.direction.replaceAll("_", " ")}</span>
                <span className={detailPillClass}>Refreshed: {formatDateTime(candidate.refreshedAt)}</span>
                <span className={detailPillClass}>Expires: {formatDateTime(candidate.expiresAt)}</span>
              </div>
              {candidate.explanation.length ? (
                <div className="mt-4 rounded-2xl bg-[var(--loombus-surface)] p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
                    Stored explanation
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-[var(--loombus-text-muted)]">
                    {candidate.explanation.slice(0, 5).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </article>
          ))}
          {data.candidates.length === 0 ? (
            <p className={emptyClass}>No Intelligent Matching candidates were returned.</p>
          ) : null}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational boundary"
        title="Matching remains user-controlled"
        description="Administrators can inspect algorithm health and member feedback, but cannot approve matches, alter confidence, change preferences, block members, or disable accounts from this module."
        action={<AdminStatusBadge status="ready">Diagnostic only</AdminStatusBadge>}
      >
        <BoundaryCard
          title="No administrator scoring controls"
          description="Candidate generation, eligibility, preference rules, saved state, dismissal, and member action remain governed by the existing matching system and user-owned settings."
        />
      </AdminQueueSection>
    </div>
  );
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
        description="This protected route provides a read-only source registry. Search repair tools and the full index-health workspace remain in the dedicated Search phase."
        action={<AdminStatusBadge status="foundation">Foundation only</AdminStatusBadge>}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Diagnostic sample</span>
            <strong className="mt-2 block text-2xl">{data.metrics.sampleSize}</strong>
          </div>
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Stale over 30 days</span>
            <strong className="mt-2 block text-2xl">{data.metrics.stale30Days}</strong>
          </div>
          <div className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">Missing destination</span>
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
                  <span className="text-sm text-[var(--loombus-text-muted)]">{source.total} sampled</span>
                  <span className="text-sm text-[var(--loombus-text-muted)]">{source.activePublic} public</span>
                  <span className="text-sm text-[var(--loombus-text-muted)]">{source.stale30Days + source.missingHref} flags</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="p-6 text-sm text-[var(--loombus-text-muted)]">No search source records were returned.</div>
          )}
        </div>
      </AdminQueueSection>

      <AdminQueueSection
        eyebrow="Operational boundary"
        title="No index mutation in the foundation"
        description="The module is read-only. It does not rebuild, delete, republish, change visibility, or bypass source-owned eligibility rules."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["Rebuild index", data.boundaries.rebuildAvailable],
            ["Delete documents", data.boundaries.deleteAvailable],
            ["Change visibility", data.boundaries.visibilityMutationAvailable],
          ].map(([label, available]) => (
            <div key={String(label)} className="flex items-center justify-between rounded-2xl bg-[var(--loombus-page-bg)] p-4">
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
        <RoomsOperationsWorkspace
          data={roomsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/admin/platform/rooms", payload, successMessage)
          }
        />
      ) : null}

      {appointmentsData ? (
        <AppointmentsOperationsWorkspace
          data={appointmentsData}
          working={working}
          runAction={(payload: Record<string, unknown>, successMessage: string) =>
            runAction("/api/admin/platform/appointments", payload, successMessage)
          }
        />
      ) : null}

      {localData ? <LocalOperationsWorkspace data={localData} /> : null}
      {matchesData ? <MatchesOperationsWorkspace data={matchesData} /> : null}
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
