"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_requests: boolean;
};

type ProtectedRequestRow = {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  authority_review_status: string;
  scope_review_status: string;
  privilege_review_status: string;
  reporter_protection_status: string;
  victim_protection_status: string;
  unrelated_member_minimization_status: string;
  updated_at: string;
  jurisdiction?: string | null;
  narrowed_scope?: string | null;
  privilege_review_summary?: string | null;
  reporter_protection_summary?: string | null;
  victim_protection_summary?: string | null;
  unrelated_member_minimization_summary?: string | null;
};

const PROTECTED_REVIEW_STATUSES = [
  "unreviewed",
  "pending",
  "not_identified",
  "identified",
  "requires_counsel",
  "resolved",
];

const MINIMIZATION_STATUSES = [
  "unreviewed",
  "pending",
  "not_applicable",
  "required",
  "completed",
  "requires_counsel",
];

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function authorizedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href =
      "/login?next=%2Fadmin%2Flegal-operations%2Fprotected-party-review";
    throw new Error("Authentication required.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    window.location.href =
      "/login?next=%2Fadmin%2Flegal-operations%2Fprotected-party-review";
    throw new Error("Authentication required.");
  }

  return response;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

const panelClass = "rounded-2xl border p-5 shadow-sm";
const fieldClass =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#CBAB5B]";
const buttonClass =
  "rounded-xl bg-[#CBAB5B] px-4 py-2 text-sm font-semibold text-black transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50";

const panelStyle = {
  background: "var(--loombus-surface)",
  borderColor: "var(--loombus-border)",
  color: "var(--loombus-text)",
};

const fieldStyle = {
  background: "var(--loombus-surface)",
  borderColor: "var(--loombus-border)",
  color: "var(--loombus-text)",
};

export default function ProtectedPartyReviewClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [requests, setRequests] = useState<ProtectedRequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProtectedRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");

  const [editor, setEditor] = useState({
    privilegeReviewStatus: "unreviewed",
    privilegeReviewSummary: "",
    reporterProtectionStatus: "unreviewed",
    reporterProtectionSummary: "",
    victimProtectionStatus: "unreviewed",
    victimProtectionSummary: "",
    unrelatedMemberMinimizationStatus: "unreviewed",
    unrelatedMemberMinimizationSummary: "",
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        "/api/admin/legal-operations/protected-party-review"
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load protected-party review."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        requests: ProtectedRequestRow[];
      };
      setRestricted(false);
      setAuthorization(body.authorization);
      setRequests(body.requests);
      if (selectedId && !body.requests.some((row) => row.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  const loadDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        `/api/admin/legal-operations/protected-party-review?requestId=${encodeURIComponent(requestId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(
          await responseMessage(response, "Unable to load protected-party review metadata.")
        );
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        request: ProtectedRequestRow;
      };
      setAuthorization(body.authorization);
      setDetail(body.request);
      setEditor({
        privilegeReviewStatus: body.request.privilege_review_status,
        privilegeReviewSummary: body.request.privilege_review_summary ?? "",
        reporterProtectionStatus: body.request.reporter_protection_status,
        reporterProtectionSummary: body.request.reporter_protection_summary ?? "",
        victimProtectionStatus: body.request.victim_protection_status,
        victimProtectionSummary: body.request.victim_protection_summary ?? "",
        unrelatedMemberMinimizationStatus:
          body.request.unrelated_member_minimization_status,
        unrelatedMemberMinimizationSummary:
          body.request.unrelated_member_minimization_summary ?? "",
      });
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  async function saveReview() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        "/api/admin/legal-operations/protected-party-review",
        {
          method: "POST",
          body: JSON.stringify({
            operation: "update_protected_party_review",
            requestId: selectedId,
            ...editor,
          }),
        }
      );

      if (!response.ok) {
        setMessage(
          await responseMessage(response, "Unable to update protected-party review metadata.")
        );
        return;
      }

      await Promise.all([loadDetail(selectedId), loadList()]);
      setMessage("Protected-party review updated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update protected-party review metadata."
      );
    } finally {
      setWorking(false);
    }
  }

  if (restricted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className={panelClass} style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Restricted workspace
          </p>
          <h1
            className="mt-2 text-2xl font-semibold"
            style={{ color: "var(--loombus-text-strong)" }}
          >
            Protected Party Review
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires platform administrator status, an active Legal Operations
            authorization, and the dedicated request-review capability.
          </p>
          <Link
            className="mt-5 inline-block text-sm font-semibold text-[#CBAB5B]"
            href="/admin"
          >
            Return to Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Internal only · Issue #674
          </p>
          <h1
            className="mt-1 text-3xl font-semibold"
            style={{ color: "var(--loombus-text-strong)" }}
          >
            Protected Party Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Record minimum-necessary privilege, reporter, victim, and unrelated-member
            minimization review metadata. Do not paste communications, attachments,
            responsive records, evidence, or unnecessary protected-party identifiers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/legal-operations"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-strong)" }}
          >
            Legal Operations
          </Link>
          <Link
            href="/admin"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-strong)" }}
          >
            Admin
          </Link>
        </div>
      </div>

      <div
        className="mb-5 rounded-xl border px-4 py-3 text-sm"
        style={{
          borderColor: "rgba(203,171,91,0.55)",
          background: "rgba(203,171,91,0.10)",
          color: "var(--loombus-text-strong)",
        }}
      >
        This workspace does not generate exports, approve disclosures, approve emergency
        disclosures, send member notices, or transmit data externally.
      </div>

      {message ? (
        <div
          className="mb-5 rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "rgba(203,171,91,0.55)",
            background: "rgba(203,171,91,0.10)",
            color: "var(--loombus-text-strong)",
          }}
        >
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className={panelClass} style={panelStyle}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
              Requests
            </h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
              {authorization?.can_review_requests ? "Review enabled" : "Review disabled"}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {loading ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Loading…
              </p>
            ) : null}
            {!loading && requests.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                No legal requests recorded.
              </p>
            ) : null}
            {requests.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className="rounded-xl border p-3 text-left transition hover:border-[#CBAB5B]"
                style={{
                  borderColor:
                    selectedId === row.id ? "#CBAB5B" : "var(--loombus-border)",
                  background:
                    selectedId === row.id
                      ? "rgba(203,171,91,0.10)"
                      : "var(--loombus-surface)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    {row.request_number}
                  </span>
                  <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    {titleCase(row.status)}
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                  {titleCase(row.request_type)} · updated {formatDate(row.updated_at)}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                  <span>Privilege: {titleCase(row.privilege_review_status)}</span>
                  <span>Reporter: {titleCase(row.reporter_protection_status)}</span>
                  <span>Victim: {titleCase(row.victim_protection_status)}</span>
                  <span>
                    Minimization: {titleCase(row.unrelated_member_minimization_status)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedId ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Select a legal request to review protected-party and unrelated-member
                minimization metadata.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Loading request…
              </p>
            </div>
          ) : (
            <>
              <div className={panelClass} style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                      {detail.request_number}
                    </h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                      {titleCase(detail.request_type)} · {titleCase(detail.status)}
                    </p>
                  </div>
                  <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    Authority {titleCase(detail.authority_review_status)} · Scope {titleCase(detail.scope_review_status)}
                  </span>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="Jurisdiction" value={detail.jurisdiction ?? "Not recorded"} />
                  <Info
                    label="Narrowed scope"
                    value={detail.narrowed_scope ?? "Not recorded"}
                  />
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                  Protected-party review state
                </h3>
                <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                  Summaries are limited to 4,000 characters each and should contain only
                  the minimum metadata needed to explain the review state.
                </p>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <ReviewCard
                    label="Privilege"
                    status={editor.privilegeReviewStatus}
                    statuses={PROTECTED_REVIEW_STATUSES}
                    summary={editor.privilegeReviewSummary}
                    onStatus={(value) => setEditor({ ...editor, privilegeReviewStatus: value })}
                    onSummary={(value) => setEditor({ ...editor, privilegeReviewSummary: value })}
                  />
                  <ReviewCard
                    label="Reporter protection"
                    status={editor.reporterProtectionStatus}
                    statuses={PROTECTED_REVIEW_STATUSES}
                    summary={editor.reporterProtectionSummary}
                    onStatus={(value) => setEditor({ ...editor, reporterProtectionStatus: value })}
                    onSummary={(value) => setEditor({ ...editor, reporterProtectionSummary: value })}
                  />
                  <ReviewCard
                    label="Victim protection"
                    status={editor.victimProtectionStatus}
                    statuses={PROTECTED_REVIEW_STATUSES}
                    summary={editor.victimProtectionSummary}
                    onStatus={(value) => setEditor({ ...editor, victimProtectionStatus: value })}
                    onSummary={(value) => setEditor({ ...editor, victimProtectionSummary: value })}
                  />
                  <ReviewCard
                    label="Unrelated-member minimization"
                    status={editor.unrelatedMemberMinimizationStatus}
                    statuses={MINIMIZATION_STATUSES}
                    summary={editor.unrelatedMemberMinimizationSummary}
                    onStatus={(value) =>
                      setEditor({ ...editor, unrelatedMemberMinimizationStatus: value })
                    }
                    onSummary={(value) =>
                      setEditor({ ...editor, unrelatedMemberMinimizationSummary: value })
                    }
                  />
                </div>

                <button
                  className={`${buttonClass} mt-5`}
                  disabled={working}
                  type="button"
                  onClick={() => void saveReview()}
                >
                  {working ? "Saving…" : "Save protected-party review"}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function ReviewCard({
  label,
  status,
  statuses,
  summary,
  onStatus,
  onSummary,
}: {
  label: string;
  status: string;
  statuses: string[];
  summary: string;
  onStatus: (value: string) => void;
  onSummary: (value: string) => void;
}) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "var(--loombus-border)", background: "var(--loombus-surface-strong)" }}
    >
      <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--loombus-text-strong)" }}>
        {label} status
        <select
          className={fieldClass}
          style={fieldStyle}
          value={status}
          onChange={(event) => onStatus(event.target.value)}
        >
          {statuses.map((value) => (
            <option key={value} value={value}>
              {titleCase(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="mt-3 grid gap-1.5 text-sm font-medium" style={{ color: "var(--loombus-text-strong)" }}>
        Minimum-necessary summary
        <textarea
          className={fieldClass}
          style={fieldStyle}
          rows={4}
          maxLength={4000}
          value={summary}
          onChange={(event) => onSummary(event.target.value)}
        />
      </label>
      <div className="mt-1 text-right text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
        {summary.length}/4000
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: "var(--loombus-border)", background: "var(--loombus-surface-strong)" }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[#CBAB5B]">{label}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm" style={{ color: "var(--loombus-text-strong)" }}>
        {value}
      </div>
    </div>
  );
}
