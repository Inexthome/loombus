"use client";

import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  DoorOpen,
  Flag,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import {
  type ReactNode,
  useMemo,
  useState,
} from "react";

type ActionRunner = (
  payload: Record<string, unknown>,
  successMessage: string
) => void | Promise<void>;

type ProfileSummary = {
  id: string;
  displayName: string;
  username: string | null;
  accountStatus?: string | null;
};

export type RoomsAdminResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: {
    totalRooms: number;
    activeRooms: number;
    archivedRooms: number;
    pendingDeletion: number;
    openReports: number;
    pendingApplications: number;
    billingAttention: number;
  };
  rooms: Array<{
    id: string;
    name: string;
    description: string;
    roomType: string;
    status: string;
    ownerId: string;
    owner: ProfileSummary;
    subscriptionPlan: string;
    subscriptionStatus: string;
    memberLimit: number | null;
    memberCount: number;
    pendingApplications: number;
    openReports: number;
    hasStripeCustomer: boolean;
    hasStripeSubscription: boolean;
    currentPeriodEnd: string | null;
    archivedAt: string | null;
    deletionScheduledFor: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  reports: Array<{
    id: string;
    roomId: string;
    roomName: string;
    reporter: ProfileSummary;
    targetType: string;
    targetId: string;
    targetLabel: string;
    targetSnapshot: string;
    reason: string;
    details: string;
    state: string;
    createdAt: string | null;
  }>;
  boundaries: {
    privateContentLoaded: boolean;
    roomSuspensionAvailable: boolean;
    ownershipTransferAvailable: boolean;
    billingMutationAvailable: boolean;
  };
};

export type AppointmentsAdminResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: {
    activeServices: number;
    pausedServices: number;
    pendingRequests: number;
    acceptedRequests: number;
    rescheduleProposed: number;
    overdueAccepted: number;
    completedRequests: number;
    cancelledRequests: number;
  };
  services: Array<{
    id: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    businessStatus: string | null;
    ownerId: string;
    owner: ProfileSummary;
    name: string;
    description: string;
    durationMinutes: number;
    locationMode: string;
    locationText: string | null;
    priceText: string | null;
    instructions: string | null;
    status: string;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  requests: Array<{
    id: string;
    serviceId: string;
    serviceName: string;
    businessId: string;
    businessName: string;
    businessSlug: string | null;
    providerId: string;
    provider: ProfileSummary;
    requesterId: string;
    requester: ProfileSummary;
    requestedStart: string | null;
    requestedEnd: string | null;
    proposedStart: string | null;
    proposedEnd: string | null;
    timezone: string;
    note: string | null;
    providerNote: string | null;
    status: string;
    overdue: boolean;
    actedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
  boundaries: {
    disputeQueueAvailable: boolean;
    accountSuspensionAvailable: boolean;
    paymentOperationsAvailable: boolean;
  };
};

function Metric({
  label,
  value,
  description,
}: {
  label: string;
  value: number;
  description: string;
}) {
  return (
    <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--loombus-text-subtle)]">
        {label}
      </p>
      <strong className="mt-2 block text-3xl">
        {value.toLocaleString()}
      </strong>
      <span className="mt-1 block text-sm text-[var(--loombus-text-muted)]">
        {description}
      </span>
    </article>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-2.5 py-1 text-xs font-semibold capitalize">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  danger = false,
  primary = false,
}: {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
  danger?: boolean;
  primary?: boolean;
}) {
  const className = danger
    ? "inline-flex items-center gap-2 rounded-xl border border-red-500/35 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-300"
    : primary
      ? "inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-3 py-2 text-sm font-semibold text-[var(--loombus-page-bg)] disabled:opacity-50"
      : "inline-flex items-center gap-2 rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={className}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-6 text-sm text-[var(--loombus-text-muted)]">
      {children}
    </p>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function identity(profile: ProfileSummary) {
  if (profile.username) {
    return `${profile.displayName} (@${profile.username})`;
  }

  return profile.displayName;
}

const noteClass =
  "mt-4 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none";

export function RoomOperationsPanel({
  data,
  working,
  runAction,
}: {
  data: RoomsAdminResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const attentionRooms = useMemo(
    () =>
      data.rooms.filter(
        (room) =>
          room.openReports > 0 ||
          room.pendingApplications > 0 ||
          ![
            "active",
            "trialing",
            "free",
          ].includes(
            room.subscriptionStatus.toLowerCase()
          )
      ),
    [data.rooms]
  );

  function noteFor(reportId: string) {
    return notes[reportId] ?? "";
  }

  function setNote(reportId: string, note: string) {
    setNotes((current) => ({
      ...current,
      [reportId]: note,
    }));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Open reports"
          value={data.metrics.openReports}
          description="Private Room report snapshots awaiting review."
        />
        <Metric
          label="Rooms"
          value={data.metrics.totalRooms}
          description="Recent Room registry records visible to administrators."
        />
        <Metric
          label="Pending access"
          value={data.metrics.pendingApplications}
          description="Membership applications still owned by Room managers."
        />
        <Metric
          label="Billing attention"
          value={data.metrics.billingAttention}
          description="Room subscriptions carrying an exception status."
        />
      </section>

      <section className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 shrink-0"
            size={20}
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              Private Room boundaries remain intact.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
              This administrator module loads Room metadata,
              operational totals, billing-state presence, and the
              snapshots members deliberately included in reports.
              It does not load private Room discussions, files,
              resources, calendars, or member workspaces.
              Platform-level Room suspension, ownership transfer,
              and billing mutation are not exposed because the
              current schema does not provide a durable
              administrator enforcement state separate from the
              owner lifecycle.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Flag size={20} aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Moderation queue
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Open Room reports
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {data.reports.map((report) => (
              <article
                key={report.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={report.state} />
                  <span className="text-xs text-[var(--loombus-text-subtle)]">
                    {report.targetType.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>

                <h4 className="mt-3 text-lg font-semibold">
                  {report.targetLabel}
                </h4>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  {report.roomName} · Reported by{" "}
                  {identity(report.reporter)}
                </p>

                <p className="mt-3 text-sm font-semibold">
                  {report.reason}
                </p>

                {report.details ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {report.details}
                  </p>
                ) : null}

                {report.targetSnapshot ? (
                  <div className="mt-3 rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-3 text-sm leading-6">
                    <strong className="block text-xs uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                      Submitted snapshot
                    </strong>
                    <p className="mt-2 whitespace-pre-wrap">
                      {report.targetSnapshot}
                    </p>
                  </div>
                ) : null}

                <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                  Submitted {formatDate(report.createdAt)}
                </p>

                <textarea
                  rows={3}
                  maxLength={2000}
                  value={noteFor(report.id)}
                  onChange={(event) =>
                    setNote(
                      report.id,
                      event.target.value
                    )
                  }
                  placeholder="Administrator decision note"
                  className={noteClass}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    disabled={working}
                    primary
                    onClick={() =>
                      void runAction(
                        {
                          action: "review_report",
                          reportId: report.id,
                          decision: "resolve",
                          note: noteFor(report.id),
                        },
                        "The Room report was resolved."
                      )
                    }
                  >
                    <CheckCircle2
                      size={15}
                      aria-hidden="true"
                    />
                    Resolve
                  </ActionButton>

                  <ActionButton
                    disabled={working}
                    onClick={() =>
                      void runAction(
                        {
                          action: "review_report",
                          reportId: report.id,
                          decision: "dismiss",
                          note: noteFor(report.id),
                        },
                        "The Room report was dismissed."
                      )
                    }
                  >
                    <XCircle
                      size={15}
                      aria-hidden="true"
                    />
                    Dismiss
                  </ActionButton>
                </div>
              </article>
            ))}

            {data.reports.length === 0 ? (
              <EmptyState>
                No private Room reports are awaiting
                administrator review.
              </EmptyState>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle
              size={20}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Operations
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Rooms requiring attention
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {attentionRooms.slice(0, 100).map((room) => (
              <article
                key={room.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={room.status} />
                  <StatusBadge
                    value={room.subscriptionStatus}
                  />
                  <span className="text-xs capitalize text-[var(--loombus-text-subtle)]">
                    {room.subscriptionPlan.replaceAll(
                      "_",
                      " "
                    )}
                  </span>
                </div>

                <h4 className="mt-3 text-lg font-semibold">
                  {room.name}
                </h4>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  Owner: {identity(room.owner)}
                </p>

                <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <span>
                    <strong>Members:</strong>{" "}
                    {room.memberCount.toLocaleString()}
                    {room.memberLimit === null
                      ? ""
                      : ` / ${room.memberLimit.toLocaleString()}`}
                  </span>
                  <span>
                    <strong>Reports:</strong>{" "}
                    {room.openReports.toLocaleString()}
                  </span>
                  <span>
                    <strong>Access requests:</strong>{" "}
                    {room.pendingApplications.toLocaleString()}
                  </span>
                  <span>
                    <strong>Billing identity:</strong>{" "}
                    {room.hasStripeCustomer ||
                    room.hasStripeSubscription
                      ? "Connected"
                      : "Not connected"}
                  </span>
                  <span>
                    <strong>Period end:</strong>{" "}
                    {formatDate(room.currentPeriodEnd)}
                  </span>
                  <span>
                    <strong>Updated:</strong>{" "}
                    {formatDate(room.updatedAt)}
                  </span>
                </div>
              </article>
            ))}

            {attentionRooms.length === 0 ? (
              <EmptyState>
                No Room reports, membership queues, or
                billing exceptions require attention.
              </EmptyState>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <DoorOpen size={20} aria-hidden="true" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Registry
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              Recent Rooms
            </h3>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--loombus-border)] text-xs uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                <th className="px-3 py-3">Room</th>
                <th className="px-3 py-3">Owner</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Plan</th>
                <th className="px-3 py-3">Members</th>
                <th className="px-3 py-3">Reports</th>
                <th className="px-3 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.rooms.map((room) => (
                <tr
                  key={room.id}
                  className="border-b border-[var(--loombus-border)]/70"
                >
                  <td className="px-3 py-4">
                    <strong className="block">
                      {room.name}
                    </strong>
                    <span className="text-xs capitalize text-[var(--loombus-text-muted)]">
                      {room.roomType.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    {identity(room.owner)}
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge value={room.status} />
                  </td>
                  <td className="px-3 py-4 capitalize">
                    {room.subscriptionPlan.replaceAll(
                      "_",
                      " "
                    )}
                  </td>
                  <td className="px-3 py-4">
                    {room.memberCount.toLocaleString()}
                  </td>
                  <td className="px-3 py-4">
                    {room.openReports.toLocaleString()}
                  </td>
                  <td className="px-3 py-4">
                    {formatDate(room.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export function AppointmentOperationsPanel({
  data,
  working,
  runAction,
}: {
  data: AppointmentsAdminResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [requestNotes, setRequestNotes] =
    useState<Record<string, string>>({});

  const operationalRequests = useMemo(
    () =>
      data.requests.filter((request) =>
        [
          "pending",
          "accepted",
          "reschedule_proposed",
        ].includes(request.status)
      ),
    [data.requests]
  );

  function requestNote(requestId: string) {
    return requestNotes[requestId] ?? "";
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Overdue accepted"
          value={data.metrics.overdueAccepted}
          description="Accepted appointments whose scheduled end has passed."
        />
        <Metric
          label="Pending requests"
          value={data.metrics.pendingRequests}
          description="Normal provider-response workflow, shown for diagnostics."
        />
        <Metric
          label="Accepted"
          value={data.metrics.acceptedRequests}
          description="Confirmed appointments currently in the lifecycle."
        />
        <Metric
          label="Active services"
          value={data.metrics.activeServices}
          description="Appointment services currently accepting requests."
        />
      </section>

      <section className="rounded-[1.6rem] border border-amber-500/25 bg-amber-500/5 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <ShieldCheck
            className="mt-0.5 shrink-0"
            size={20}
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              Lifecycle enforcement only.
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
              Administrators can inspect appointment operations
              and cancel an active appointment request when
              intervention is necessary. Appointment-service
              publishing remains in the provider workspace. No
              appointment dispute queue, durable provider suspension,
              payment operation, credential verification, or hidden
              professional-review system exists in this phase.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarClock
              size={20}
              aria-hidden="true"
            />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Appointment lifecycle
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Active requests
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {operationalRequests
              .slice(0, 150)
              .map((request) => (
                <article
                  key={request.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge
                      value={request.status}
                    />
                    {request.overdue ? (
                      <span className="rounded-full border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                        Overdue
                      </span>
                    ) : null}
                  </div>

                  <h4 className="mt-3 text-lg font-semibold">
                    {request.serviceName}
                  </h4>
                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {request.businessName}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm">
                    <span>
                      <strong>Provider:</strong>{" "}
                      {identity(request.provider)}
                    </span>
                    <span>
                      <strong>Requester:</strong>{" "}
                      {identity(request.requester)}
                    </span>
                    <span>
                      <strong>Scheduled:</strong>{" "}
                      {formatDate(
                        request.status ===
                          "reschedule_proposed"
                          ? request.proposedStart
                          : request.requestedStart
                      )}
                    </span>
                    <span>
                      <strong>Timezone:</strong>{" "}
                      {request.timezone}
                    </span>
                  </div>

                  {request.note ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                      Request note: {request.note}
                    </p>
                  ) : null}

                  {request.providerNote ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                      Provider note: {request.providerNote}
                    </p>
                  ) : null}

                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={requestNote(request.id)}
                    onChange={(event) =>
                      setRequestNotes((current) => ({
                        ...current,
                        [request.id]:
                          event.target.value,
                      }))
                    }
                    placeholder="Required administrator cancellation reason for the audit log"
                    className={noteClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={
                        working ||
                        requestNote(request.id).trim().length < 3
                      }
                      danger
                      onClick={() => {
                        if (
                          window.confirm(
                            "Cancel this appointment request? Both parties will be notified."
                          )
                        ) {
                          void runAction(
                            {
                              action:
                                "cancel_request",
                              requestId: request.id,
                              note: requestNote(
                                request.id
                              ),
                            },
                            "The appointment request was cancelled."
                          );
                        }
                      }}
                    >
                      <XCircle
                        size={15}
                        aria-hidden="true"
                      />
                      Cancel appointment
                    </ActionButton>
                  </div>
                </article>
              ))}

            {operationalRequests.length === 0 ? (
              <EmptyState>
                No pending, accepted, or reschedule-proposed
                appointments are in the operational lifecycle.
              </EmptyState>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Building2 size={20} aria-hidden="true" />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Provider controls
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Appointment services
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {data.services.slice(0, 200).map((service) => (
              <article
                key={service.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={service.status} />
                  {service.owner.accountStatus &&
                  service.owner.accountStatus !==
                    "active" ? (
                    <StatusBadge
                      value={
                        service.owner.accountStatus
                      }
                    />
                  ) : null}
                </div>

                <h4 className="mt-3 text-lg font-semibold">
                  {service.name}
                </h4>
                <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                  {service.businessName} ·{" "}
                  {identity(service.owner)}
                </p>

                <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                  {service.description}
                </p>

                <div className="mt-4 grid gap-2 text-sm">
                  <span>
                    <strong>Duration:</strong>{" "}
                    {service.durationMinutes} minutes
                  </span>
                  <span>
                    <strong>Location:</strong>{" "}
                    {service.locationText ||
                      service.locationMode.replaceAll(
                        "_",
                        " "
                      )}
                  </span>
                  <span>
                    <strong>Price:</strong>{" "}
                    {service.priceText ||
                      "Not stated"}
                  </span>
                  <span>
                    <strong>Business status:</strong>{" "}
                    {service.businessStatus ||
                      "Unavailable"}
                  </span>
                </div>

                <p className="mt-4 text-xs text-[var(--loombus-text-subtle)]">
                  Updated {formatDate(service.updatedAt)}. Service
                  publication and lifecycle controls remain in the
                  provider workspace.
                </p>
              </article>
            ))}

            {data.services.length === 0 ? (
              <EmptyState>
                No appointment services exist.
              </EmptyState>
            ) : null}
          </div>
        </article>
      </section>

      <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <CheckCircle2
            size={20}
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
              Lifecycle history
            </p>
            <h3 className="mt-1 text-xl font-semibold">
              Current totals
            </h3>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric
            label="Reschedules"
            value={data.metrics.rescheduleProposed}
            description="New times awaiting requester acceptance."
          />
          <Metric
            label="Completed"
            value={data.metrics.completedRequests}
            description="Appointments marked complete by providers."
          />
          <Metric
            label="Cancelled"
            value={data.metrics.cancelledRequests}
            description="Requests cancelled by either party or administration."
          />
          <Metric
            label="Paused services"
            value={data.metrics.pausedServices}
            description="Services not currently accepting requests."
          />
        </div>
      </section>
    </div>
  );
}
