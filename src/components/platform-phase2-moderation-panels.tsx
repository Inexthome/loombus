"use client";

import {
  CalendarDays,
  CheckCircle2,
  Flag,
  HandHeart,
  ShieldCheck,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";
import {
  type ReactNode,
  useMemo,
  useState,
} from "react";
import type { EventsManageResponse } from "@/lib/events";
import type { ProviderServicesManageResponse } from "@/lib/provider-services";
import type { ServiceRequestManageResponse } from "@/lib/service-requests";

type ActionRunner = (
  payload: Record<string, unknown>,
  successMessage: string
) => void | Promise<void>;

type ActionButtonProps = {
  children: ReactNode;
  disabled: boolean;
  onClick: () => void;
  tone?: "primary" | "secondary" | "danger";
};

const textAreaClass =
  "mt-4 w-full rounded-xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none";

function ActionButton({
  children,
  disabled,
  onClick,
  tone = "secondary",
}: ActionButtonProps) {
  const className =
    tone === "primary"
      ? "inline-flex items-center gap-2 rounded-xl bg-[var(--loombus-text)] px-3 py-2 text-sm font-semibold text-[var(--loombus-page-bg)] disabled:opacity-50"
      : tone === "danger"
        ? "inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-50 dark:text-red-300"
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

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-2.5 py-1 text-xs font-semibold capitalize">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl bg-[var(--loombus-page-bg)] p-4">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
        {label}
      </span>
      <strong className="mt-2 block text-2xl">
        {value.toLocaleString()}
      </strong>
    </article>
  );
}

function EmptyQueue({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-6 text-sm text-[var(--loombus-text-muted)]">
      {children}
    </p>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "No date provided";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function eventLocation(
  event: EventsManageResponse["events"][number]
) {
  if (event.format === "online") return "Online";

  const location = [
    event.venueName,
    event.city,
    event.region,
  ]
    .filter(Boolean)
    .join(", ");

  if (event.format === "hybrid") {
    return location ? `${location} and online` : "Hybrid";
  }

  return location || "Location not stated";
}

function requestLocation(
  request: ServiceRequestManageResponse["requests"][number]
) {
  if (request.serviceMode === "remote") {
    return "Remote";
  }

  return (
    [request.city, request.region]
      .filter(Boolean)
      .join(", ") ||
    request.serviceMode.replaceAll("_", " ")
  );
}

function money(value: number | null, currency: string) {
  if (value === null) return null;

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function servicePrice(
  service: ProviderServicesManageResponse["services"][number]
) {
  if (service.priceType === "contact") {
    return "Contact for pricing";
  }

  const minimum = money(
    service.priceMin,
    service.currency
  );
  const maximum = money(
    service.priceMax,
    service.currency
  );

  if (service.priceType === "fixed") {
    return minimum || maximum || "Fixed price";
  }

  if (service.priceType === "hourly") {
    return `${minimum || maximum || "Hourly rate"} per hour`;
  }

  if (minimum && maximum) {
    return `${minimum} to ${maximum}`;
  }

  return minimum || maximum || "Price range";
}

function serviceLocation(
  service: ProviderServicesManageResponse["services"][number]
) {
  if (service.serviceMode === "remote") {
    return "Remote";
  }

  return (
    [service.city, service.region]
      .filter(Boolean)
      .join(", ") ||
    service.serviceMode.replaceAll("_", " ")
  );
}

export function EventModerationPanel({
  data,
  working,
  runAction,
}: {
  data: EventsManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const pendingEvents = useMemo(
    () =>
      data.events.filter(
        (event) => event.status === "pending"
      ),
    [data.events]
  );

  const publishedCount = useMemo(
    () =>
      data.events.filter(
        (event) => event.status === "published"
      ).length,
    [data.events]
  );

  function noteFor(key: string) {
    return notes[key] ?? "";
  }

  function updateNote(key: string, value: string) {
    setNotes((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Pending review"
          value={pendingEvents.length}
        />
        <Metric
          label="Open reports"
          value={data.reports.length}
        />
        <Metric
          label="Published"
          value={publishedCount}
        />
        <Metric
          label="All records"
          value={data.events.length}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <CalendarDays size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Publication queue
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Events awaiting review
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {pendingEvents.map((event) => {
              const key = `event:${event.id}`;

              return (
                <article
                  key={event.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={event.status} />
                    <span className="text-xs text-[var(--loombus-text-subtle)]">
                      {event.category}
                    </span>
                  </div>

                  <h4 className="mt-3 text-xl font-semibold">
                    {event.title}
                  </h4>

                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {event.businessName ||
                      event.organizerName}
                  </p>

                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {event.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm">
                    <span>
                      <strong>Starts:</strong>{" "}
                      {formatDateTime(event.startsAt)}
                    </span>
                    <span>
                      <strong>Location:</strong>{" "}
                      {eventLocation(event)}
                    </span>
                  </div>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Administrator note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            eventId: event.id,
                            decision: "approve",
                            note: noteFor(key),
                          },
                          "The event was approved and published."
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            eventId: event.id,
                            decision: "reject",
                            note: noteFor(key),
                          },
                          "The event was returned for changes."
                        )
                      }
                    >
                      <XCircle size={15} />
                      Request changes
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            eventId: event.id,
                            decision: "remove",
                            note: noteFor(key),
                          },
                          "The event was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {pendingEvents.length === 0 ? (
              <EmptyQueue>
                No Events require administrator review.
              </EmptyQueue>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Flag size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Member reports
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Open Event reports
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {data.reports.map((report) => {
              const key = `report:${report.id}`;

              return (
                <article
                  key={report.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <strong className="text-lg">
                    {report.eventTitle}
                  </strong>

                  <p className="mt-2 text-sm font-semibold">
                    {report.reason}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {report.details}
                  </p>

                  <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                    Submitted{" "}
                    {formatDateTime(report.createdAt)}
                  </p>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Report decision note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "review_report",
                            reportId: report.id,
                            decision: "resolve",
                            note: noteFor(key),
                          },
                          "The Event report was resolved."
                        )
                      }
                    >
                      <ShieldCheck size={15} />
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
                            note: noteFor(key),
                          },
                          "The Event report was dismissed."
                        )
                      }
                    >
                      Dismiss
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            eventId: report.eventId,
                            decision: "remove",
                            note:
                              noteFor(key) ||
                              `Removed while reviewing report: ${report.reason}`,
                          },
                          "The reported event was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove event
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {data.reports.length === 0 ? (
              <EmptyQueue>
                No Event reports are open.
              </EmptyQueue>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}

export function RequestModerationPanel({
  data,
  working,
  runAction,
}: {
  data: ServiceRequestManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const pendingRequests = useMemo(
    () =>
      data.requests.filter(
        (request) => request.status === "pending"
      ),
    [data.requests]
  );

  function noteFor(key: string) {
    return notes[key] ?? "";
  }

  function updateNote(key: string, value: string) {
    setNotes((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Pending review"
          value={data.metrics.pending}
        />
        <Metric
          label="Open reports"
          value={data.metrics.openReports}
        />
        <Metric
          label="Public Requests"
          value={data.metrics.open}
        />
        <Metric
          label="In progress"
          value={data.metrics.inProgress}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <HandHeart size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Publication queue
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Requests awaiting review
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {pendingRequests.map((request) => {
              const key = `request:${request.id}`;

              return (
                <article
                  key={request.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={request.status} />
                    <span className="text-xs capitalize text-[var(--loombus-text-subtle)]">
                      {request.requestType.replaceAll(
                        "_",
                        " "
                      )}
                    </span>
                  </div>

                  <h4 className="mt-3 text-xl font-semibold">
                    {request.title}
                  </h4>

                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {request.businessName ||
                      request.requesterName}
                  </p>

                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {request.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm">
                    <span>
                      <strong>Category:</strong>{" "}
                      {request.category}
                    </span>
                    <span>
                      <strong>Location:</strong>{" "}
                      {requestLocation(request)}
                    </span>
                    <span>
                      <strong>Deadline:</strong>{" "}
                      {request.deadline
                        ? formatDateTime(
                            request.deadline
                          )
                        : "No deadline stated"}
                    </span>
                  </div>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Administrator note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            requestId: request.id,
                            decision: "approve",
                            note: noteFor(key),
                          },
                          "The Request was approved and published."
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            requestId: request.id,
                            decision: "reject",
                            note: noteFor(key),
                          },
                          "The Request was returned for changes."
                        )
                      }
                    >
                      <XCircle size={15} />
                      Request changes
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            requestId: request.id,
                            decision: "remove",
                            note: noteFor(key),
                          },
                          "The Request was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {pendingRequests.length === 0 ? (
              <EmptyQueue>
                No Requests require administrator review.
              </EmptyQueue>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Flag size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Member reports
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Open Request reports
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {data.reports.map((report) => {
              const key = `request-report:${report.id}`;

              return (
                <article
                  key={report.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <strong className="text-lg">
                    {report.requestTitle}
                  </strong>

                  <p className="mt-2 text-sm font-semibold">
                    {report.reason}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {report.details}
                  </p>

                  <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                    Submitted{" "}
                    {formatDateTime(report.createdAt)}
                  </p>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Report decision note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "review_report",
                            reportId: report.id,
                            decision: "resolve",
                            note: noteFor(key),
                          },
                          "The Request report was resolved."
                        )
                      }
                    >
                      <ShieldCheck size={15} />
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
                            note: noteFor(key),
                          },
                          "The Request report was dismissed."
                        )
                      }
                    >
                      Dismiss
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            requestId: report.requestId,
                            decision: "suspend",
                            note:
                              noteFor(key) ||
                              `Suspended while reviewing report: ${report.reason}`,
                          },
                          "The reported Request was suspended."
                        )
                      }
                    >
                      Suspend Request
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            requestId: report.requestId,
                            decision: "remove",
                            note:
                              noteFor(key) ||
                              `Removed while reviewing report: ${report.reason}`,
                          },
                          "The reported Request was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove Request
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {data.reports.length === 0 ? (
              <EmptyQueue>
                No Request reports are open.
              </EmptyQueue>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}

export function ServiceModerationPanel({
  data,
  working,
  runAction,
}: {
  data: ProviderServicesManageResponse;
  working: boolean;
  runAction: ActionRunner;
}) {
  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const pendingServices = useMemo(
    () =>
      data.services.filter(
        (service) => service.status === "pending"
      ),
    [data.services]
  );

  function noteFor(key: string) {
    return notes[key] ?? "";
  }

  function updateNote(key: string, value: string) {
    setNotes((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Pending review"
          value={data.metrics.pending}
        />
        <Metric
          label="Open reports"
          value={data.metrics.openReports}
        />
        <Metric
          label="Published"
          value={data.metrics.published}
        />
        <Metric
          label="Inquiries"
          value={data.metrics.inquiries}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Wrench size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Publication queue
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Services awaiting review
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {pendingServices.map((service) => {
              const key = `service:${service.id}`;

              return (
                <article
                  key={service.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={service.status} />
                    <span className="text-xs text-[var(--loombus-text-subtle)]">
                      {service.category}
                    </span>
                  </div>

                  <h4 className="mt-3 text-xl font-semibold">
                    {service.title}
                  </h4>

                  <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                    {service.businessName ||
                      service.providerName}
                  </p>

                  <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {service.description}
                  </p>

                  <div className="mt-4 grid gap-2 text-sm">
                    <span>
                      <strong>Location:</strong>{" "}
                      {serviceLocation(service)}
                    </span>
                    <span>
                      <strong>Price:</strong>{" "}
                      {servicePrice(service)}
                    </span>
                    <span>
                      <strong>Appointment:</strong>{" "}
                      {service.appointmentServiceName ||
                        "Not connected"}
                    </span>
                  </div>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Administrator note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            serviceId: service.id,
                            decision: "approve",
                            note: noteFor(key),
                          },
                          "The Service was approved and published."
                        )
                      }
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            serviceId: service.id,
                            decision: "reject",
                            note: noteFor(key),
                          },
                          "The Service was returned for changes."
                        )
                      }
                    >
                      <XCircle size={15} />
                      Request changes
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            serviceId: service.id,
                            decision: "remove",
                            note: noteFor(key),
                          },
                          "The Service was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {pendingServices.length === 0 ? (
              <EmptyQueue>
                No Services require administrator review.
              </EmptyQueue>
            ) : null}
          </div>
        </article>

        <article className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Flag size={20} />
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
                Member reports
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                Open Service reports
              </h3>
            </div>
          </div>

          <div className="mt-5 grid gap-4">
            {data.reports.map((report) => {
              const key = `service-report:${report.id}`;

              return (
                <article
                  key={report.id}
                  className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
                >
                  <strong className="text-lg">
                    {report.serviceTitle}
                  </strong>

                  <p className="mt-2 text-sm font-semibold">
                    {report.reason}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {report.details}
                  </p>

                  <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                    Submitted{" "}
                    {formatDateTime(report.createdAt)}
                  </p>

                  <textarea
                    value={noteFor(key)}
                    onChange={(input) =>
                      updateNote(
                        key,
                        input.target.value
                      )
                    }
                    maxLength={2000}
                    rows={3}
                    placeholder="Report decision note"
                    className={textAreaClass}
                  />

                  <div className="mt-3 flex flex-wrap gap-2">
                    <ActionButton
                      disabled={working}
                      tone="primary"
                      onClick={() =>
                        void runAction(
                          {
                            action: "review_report",
                            reportId: report.id,
                            decision: "resolve",
                            note: noteFor(key),
                          },
                          "The Service report was resolved."
                        )
                      }
                    >
                      <ShieldCheck size={15} />
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
                            note: noteFor(key),
                          },
                          "The Service report was dismissed."
                        )
                      }
                    >
                      Dismiss
                    </ActionButton>

                    <ActionButton
                      disabled={working}
                      tone="danger"
                      onClick={() =>
                        void runAction(
                          {
                            action: "moderate",
                            serviceId: report.serviceId,
                            decision: "remove",
                            note:
                              noteFor(key) ||
                              `Removed while reviewing report: ${report.reason}`,
                          },
                          "The reported Service was removed."
                        )
                      }
                    >
                      <Trash2 size={15} />
                      Remove Service
                    </ActionButton>
                  </div>
                </article>
              );
            })}

            {data.reports.length === 0 ? (
              <EmptyQueue>
                No Service reports are open.
              </EmptyQueue>
            ) : null}
          </div>
        </article>
      </section>
    </div>
  );
}
