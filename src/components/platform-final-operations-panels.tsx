"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock,
  GitBranch,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";

export type LocalAdminResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: {
    totalDocuments: number;
    activePublic: number;
    anchored: number;
    missingLocation: number;
    stale30Days: number;
    remoteAvailable: number;
    attentionRecords: number;
    sourceCount: number;
  };
  sources: Array<{
    sourceTable: string;
    label: string;
    total: number;
    activePublic: number;
    anchored: number;
    missingLocation: number;
    stale30Days: number;
    remoteAvailable: number;
    coveragePercent: number;
  }>;
  attention: Array<{
    id: string;
    sourceTable: string;
    sourceLabel: string;
    title: string;
    href: string;
    ownerId: string | null;
    ownerLabel: string;
    visibility: string;
    status: string;
    activePublic: boolean;
    locationLabel: string;
    locationMode: string | null;
    locationPrecision: string | null;
    remoteAvailable: boolean;
    directLocation: boolean;
    inheritedLocation: boolean;
    anchored: boolean;
    missingLocation: boolean;
    stale: boolean;
    updatedAt: string | null;
    ageDays: number | null;
    startsAt: string | null;
    endsAt: string | null;
  }>;
};

type MatchEntity = {
  type: string;
  id: string;
  title: string;
  href: string;
  status: string;
};

export type MatchesAdminResponse = {
  isAdmin: boolean;
  generatedAt: string;
  metrics: {
    totalCandidates: number;
    eligible: number;
    expired: number;
    ineligible: number;
    averageConfidence: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    unviewedEligible: number;
    saved: number;
    dismissed: number;
    actedOn: number;
    staleEligible: number;
    feedbackAttention: number;
    failedDeliveries: number;
    pausedAccounts: number;
    activeRules: number;
    attentionTotal: number;
  };
  feedbackCounts: {
    helpful: number;
    notRelevant: number;
    incorrect: number;
    unsafe: number;
  };
  deliveryCounts: {
    queued: number;
    sent: number;
    skipped: number;
    failed: number;
  };
  candidates: Array<{
    id: string;
    viewerId: string;
    viewerLabel: string;
    viewerAccountStatus: string;
    viewerSuspendedUntil: string | null;
    direction: string;
    eligibilityStatus: string;
    confidence: number;
    factors: Record<string, unknown>;
    explanation: string[];
    source: MatchEntity;
    target: MatchEntity;
    createdAt: string | null;
    refreshedAt: string | null;
    expiresAt: string | null;
    viewed: boolean;
    dismissed: boolean;
    saved: boolean;
    actedOn: boolean;
    stale: boolean;
  }>;
  feedbackSignals: Array<{
    id: string;
    candidateId: string;
    feedbackType: string;
    note: string | null;
    createdAt: string | null;
    viewerLabel: string;
    confidence: number | null;
    direction: string | null;
    source: MatchEntity | null;
    target: MatchEntity | null;
  }>;
};

function Metric({
  label,
  value,
  description,
  warning = false,
}: {
  label: string;
  value: number | string;
  description: string;
  warning?: boolean;
}) {
  return (
    <article
      className={[
        "rounded-2xl border p-4",
        warning
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-[var(--loombus-border)] bg-[var(--loombus-page-bg)]",
      ].join(" ")}
    >
      <span className="text-xs font-bold uppercase tracking-[0.13em] text-[var(--loombus-text-subtle)]">
        {label}
      </span>
      <strong className="mt-2 block text-2xl">
        {typeof value === "number"
          ? value.toLocaleString()
          : value}
      </strong>
      <p className="mt-1 text-xs leading-5 text-[var(--loombus-text-muted)]">
        {description}
      </p>
    </article>
  );
}

function Section({
  icon,
  eyebrow,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--loombus-page-bg)]">
          {icon}
        </span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--loombus-text-subtle)]">
            {eyebrow}
          </p>
          <h3 className="mt-1 text-xl font-semibold">
            {title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
            {description}
          </p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Badge({
  children,
  warning = false,
}: {
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <span
      className={[
        "rounded-full border px-2.5 py-1 text-xs font-semibold",
        warning
          ? "border-amber-500/30 text-amber-700 dark:text-amber-300"
          : "border-[var(--loombus-border)] text-[var(--loombus-text-muted)]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-[var(--loombus-border)] p-6 text-sm text-[var(--loombus-text-muted)]">
      {children}
    </p>
  );
}

export function LocalOperationsPanel({
  data,
}: {
  data: LocalAdminResponse;
}) {
  const coverage =
    data.metrics.activePublic > 0
      ? Math.round(
          (data.metrics.anchored /
            data.metrics.activePublic) *
            100
        )
      : 100;

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Active Local records"
          value={data.metrics.activePublic}
          description="Public active source documents eligible for Local Discovery."
        />
        <Metric
          label="Location coverage"
          value={`${coverage}%`}
          description="Records with direct, inherited, or place-based location context."
        />
        <Metric
          label="Missing location"
          value={data.metrics.missingLocation}
          description="Active non-remote records without usable Local area context."
          warning={data.metrics.missingLocation > 0}
        />
        <Metric
          label="30-day review"
          value={data.metrics.stale30Days}
          description="Records with an absent or older source timestamp."
          warning={data.metrics.stale30Days > 0}
        />
      </section>

      <Section
        icon={<MapPin size={19} aria-hidden="true" />}
        eyebrow="Source health"
        title="Local coverage by module"
        description="These totals inspect the shared Local Discovery document and privacy-safe location layers. No index rebuild or source mutation is performed."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--loombus-border)] text-xs uppercase tracking-[0.12em] text-[var(--loombus-text-subtle)]">
                <th className="px-3 py-3">Source</th>
                <th className="px-3 py-3">Active</th>
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Missing</th>
                <th className="px-3 py-3">30-day review</th>
                <th className="px-3 py-3">Remote</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map((source) => (
                <tr
                  key={source.sourceTable}
                  className="border-b border-[var(--loombus-border)] last:border-b-0"
                >
                  <td className="px-3 py-4">
                    <strong>{source.label}</strong>
                    <span className="mt-1 block text-xs text-[var(--loombus-text-subtle)]">
                      {source.total.toLocaleString()} indexed documents
                    </span>
                  </td>
                  <td className="px-3 py-4">
                    {source.activePublic.toLocaleString()}
                  </td>
                  <td className="px-3 py-4">
                    {source.coveragePercent}%
                  </td>
                  <td className="px-3 py-4">
                    {source.missingLocation.toLocaleString()}
                  </td>
                  <td className="px-3 py-4">
                    {source.stale30Days.toLocaleString()}
                  </td>
                  <td className="px-3 py-4">
                    {source.remoteAvailable.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section
        icon={<Clock size={19} aria-hidden="true" />}
        eyebrow="Operational attention"
        title="Location and freshness exceptions"
        description="Records must be corrected in their owning module. Local does not expose a parallel editor or global reindex action."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {data.attention.map((record) => (
            <article
              key={`${record.sourceTable}:${record.id}`}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{record.sourceLabel}</Badge>
                {record.missingLocation ? (
                  <Badge warning>Missing location</Badge>
                ) : null}
                {record.stale ? (
                  <Badge warning>
                    {record.ageDays === null
                      ? "Timestamp missing"
                      : `${record.ageDays} days since update`}
                  </Badge>
                ) : null}
              </div>

              <h4 className="mt-3 font-semibold">
                {record.title}
              </h4>
              <p className="mt-1 text-sm text-[var(--loombus-text-muted)]">
                {record.ownerLabel}
              </p>
              <p className="mt-3 text-xs text-[var(--loombus-text-muted)]">
                {record.locationLabel} · Updated{" "}
                {formatDateTime(record.updatedAt)}
              </p>

              <Link
                href={record.href}
                className="mt-4 inline-flex rounded-xl border border-[var(--loombus-border)] px-3 py-2 text-xs font-semibold"
              >
                Open owning record
              </Link>
            </article>
          ))}

          {data.attention.length === 0 ? (
            <EmptyState>
              No active Local records currently meet the missing-location or 30-day review criteria.
            </EmptyState>
          ) : null}
        </div>
      </Section>

      <section className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              Local remains an aggregation layer.
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
              Publication, suspension, removal, ownership, and location editing stay in the source module that owns each record. This administrator view is diagnostic only.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export function MatchesOperationsPanel({
  data,
}: {
  data: MatchesAdminResponse;
}) {
  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Eligible candidates"
          value={data.metrics.eligible}
          description="Candidates carrying the existing eligible status."
        />
        <Metric
          label="Average confidence"
          value={`${data.metrics.averageConfidence}%`}
          description="Average stored confidence across the inspected window."
        />
        <Metric
          label="Feedback attention"
          value={data.metrics.feedbackAttention}
          description="Unsafe and incorrect feedback signals."
          warning={data.metrics.feedbackAttention > 0}
        />
        <Metric
          label="Operational exceptions"
          value={data.metrics.attentionTotal}
          description="Feedback attention, stale candidates, and failed deliveries."
          warning={data.metrics.attentionTotal > 0}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section
          icon={<BarChart3 size={19} aria-hidden="true" />}
          eyebrow="Algorithm health"
          title="Eligibility and confidence"
          description="Matches are generated from active Requests and Services. This view does not approve candidates or alter scoring."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric
              label="High confidence"
              value={data.metrics.highConfidence}
              description="Stored confidence of 80 or higher."
            />
            <Metric
              label="Medium confidence"
              value={data.metrics.mediumConfidence}
              description="Stored confidence from 60 through 79."
            />
            <Metric
              label="Low confidence"
              value={data.metrics.lowConfidence}
              description="Stored confidence below 60."
            />
            <Metric
              label="Stale eligible"
              value={data.metrics.staleEligible}
              description="Older than seven days or past expiration."
              warning={data.metrics.staleEligible > 0}
            />
            <Metric
              label="Paused accounts"
              value={data.metrics.pausedAccounts}
              description="Members who paused matching."
            />
            <Metric
              label="Active rules"
              value={data.metrics.activeRules}
              description="Saved user rules marked active."
            />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
              <strong>Candidate states</strong>
              <p className="mt-3">Expired: {data.metrics.expired}</p>
              <p>Ineligible: {data.metrics.ineligible}</p>
              <p>Saved: {data.metrics.saved}</p>
              <p>Dismissed: {data.metrics.dismissed}</p>
              <p>Acted on: {data.metrics.actedOn}</p>
            </article>
            <article className="rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
              <strong>Delivery states</strong>
              <p className="mt-3">Queued: {data.deliveryCounts.queued}</p>
              <p>Sent: {data.deliveryCounts.sent}</p>
              <p>Skipped: {data.deliveryCounts.skipped}</p>
              <p>Failed: {data.deliveryCounts.failed}</p>
            </article>
          </div>
        </Section>

        <Section
          icon={<AlertTriangle size={19} aria-hidden="true" />}
          eyebrow="Member feedback"
          title="Quality and safety signals"
          description="Feedback has no review or resolution status in the current schema."
        >
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Metric
              label="Unsafe"
              value={data.feedbackCounts.unsafe}
              description="Candidate marked unsafe."
              warning={data.feedbackCounts.unsafe > 0}
            />
            <Metric
              label="Incorrect"
              value={data.feedbackCounts.incorrect}
              description="Candidate marked incorrect."
              warning={data.feedbackCounts.incorrect > 0}
            />
            <Metric
              label="Not relevant"
              value={data.feedbackCounts.notRelevant}
              description="Candidate marked not relevant."
            />
            <Metric
              label="Helpful"
              value={data.feedbackCounts.helpful}
              description="Candidate marked helpful."
            />
          </div>

          <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1">
            {data.feedbackSignals.map((signal) => (
              <article
                key={signal.id}
                className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge warning>
                    {signal.feedbackType.replaceAll("_", " ")}
                  </Badge>
                  {signal.confidence !== null ? (
                    <Badge>{signal.confidence}% confidence</Badge>
                  ) : null}
                </div>

                <p className="mt-3 text-sm font-semibold">
                  {signal.viewerLabel}
                </p>
                {signal.source && signal.target ? (
                  <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
                    {signal.source.title} → {signal.target.title}
                  </p>
                ) : null}
                {signal.note ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--loombus-text-muted)]">
                    {signal.note}
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-[var(--loombus-text-subtle)]">
                  Submitted {formatDateTime(signal.createdAt)}
                </p>
              </article>
            ))}

            {data.feedbackSignals.length === 0 ? (
              <EmptyState>
                No unsafe, incorrect, or not-relevant feedback signals were returned.
              </EmptyState>
            ) : null}
          </div>
        </Section>
      </div>

      <Section
        icon={<GitBranch size={19} aria-hidden="true" />}
        eyebrow="Candidate diagnostics"
        title="Recent match candidates"
        description="These factors and explanations are stored matching output. No administrator control changes a candidate."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {data.candidates.map((candidate) => (
            <article
              key={candidate.id}
              className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{candidate.eligibilityStatus}</Badge>
                <Badge>{candidate.confidence}% confidence</Badge>
                {candidate.stale ? (
                  <Badge warning>Operational review</Badge>
                ) : null}
                {candidate.saved ? <Badge>Saved</Badge> : null}
                {candidate.dismissed ? <Badge>Dismissed</Badge> : null}
                {candidate.actedOn ? <Badge>Acted on</Badge> : null}
              </div>

              <p className="mt-3 text-sm font-semibold">
                {candidate.viewerLabel}
              </p>
              <p className="mt-1 text-xs text-[var(--loombus-text-subtle)]">
                Account: {candidate.viewerAccountStatus}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <Link
                  href={candidate.source.href}
                  className="rounded-xl border border-[var(--loombus-border)] p-3 text-sm font-semibold"
                >
                  {candidate.source.title}
                </Link>
                <Sparkles
                  size={17}
                  className="mx-auto text-[var(--loombus-text-subtle)]"
                  aria-hidden="true"
                />
                <Link
                  href={candidate.target.href}
                  className="rounded-xl border border-[var(--loombus-border)] p-3 text-sm font-semibold"
                >
                  {candidate.target.title}
                </Link>
              </div>

              <div className="mt-4 grid gap-1 text-xs text-[var(--loombus-text-muted)]">
                <span>
                  Direction: {candidate.direction.replaceAll("_", " ")}
                </span>
                <span>
                  Refreshed: {formatDateTime(candidate.refreshedAt)}
                </span>
                <span>
                  Expires: {formatDateTime(candidate.expiresAt)}
                </span>
              </div>

              {candidate.explanation.length ? (
                <ul className="mt-4 space-y-1 text-sm text-[var(--loombus-text-muted)]">
                  {candidate.explanation.slice(0, 5).map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}

          {data.candidates.length === 0 ? (
            <EmptyState>
              No Intelligent Matching candidates were returned.
            </EmptyState>
          ) : null}
        </div>
      </Section>

      <section className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-5">
        <div className="flex items-start gap-3">
          <Activity
            size={20}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
          <div>
            <h3 className="font-semibold">
              Matching remains user-controlled.
            </h3>
            <p className="mt-1 text-sm leading-6 text-[var(--loombus-text-muted)]">
              Administrators can inspect algorithm health and feedback, but cannot manually approve matches, alter confidence, change preferences, block members, or disable accounts from this module.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
