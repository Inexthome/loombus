"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_requests: boolean;
  can_review_emergency: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type PhaseState = {
  draftAssessmentMetadataOnly: boolean;
  emergencyCriteriaStandardApproved: boolean;
  emergencyApprovalEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  exportEnabled: boolean;
  externalContactEnabled: boolean;
  externalTransmissionEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
};

type EmergencyRequestRow = {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  counsel_review_status: string;
  emergency_review_status: string;
  emergency_review_revision: number;
  updated_at: string;
  emergency_criteria_summary?: string | null;
};

const REVIEW_STATUSES = ["unreviewed", "draft", "requires_counsel"];

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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Femergency-review";
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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Femergency-review";
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

export default function EmergencyReviewClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<PhaseState | null>(null);
  const [requests, setRequests] = useState<EmergencyRequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EmergencyRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState({
    reviewStatus: "unreviewed",
    emergencyCriteriaSummary: "",
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/legal-operations/emergency-review");
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load emergency review."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        requests: EmergencyRequestRow[];
        phase: PhaseState;
      };
      setRestricted(false);
      setAuthorization(body.authorization);
      setPhase(body.phase);
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
        `/api/admin/legal-operations/emergency-review?requestId=${encodeURIComponent(requestId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load emergency review metadata."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        request: EmergencyRequestRow;
        phase: PhaseState;
      };
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setDetail(body.request);
      setEditor({
        reviewStatus: body.request.emergency_review_status,
        emergencyCriteriaSummary: body.request.emergency_criteria_summary ?? "",
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

  async function saveDraft() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/legal-operations/emergency-review", {
        method: "POST",
        body: JSON.stringify({
          operation: "update_emergency_review_draft",
          requestId: selectedId,
          ...editor,
        }),
      });

      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to update emergency review draft."));
        return;
      }

      await Promise.all([loadDetail(selectedId), loadList()]);
      setMessage("Draft emergency review metadata updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update emergency review draft.");
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
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Emergency Review
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires platform administrator status, an active Legal Operations
            authorization, can_review_requests, and the dedicated can_review_emergency
            capability. This capability does not grant emergency approval, disclosure,
            external contact, or transmission.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-[#CBAB5B]" href="/admin">
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
          <h1 className="mt-1 text-3xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Emergency Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Record draft-only internal assessment metadata for emergency-disclosure request
            records. This workspace does not establish a legal emergency standard and cannot
            approve, disclose, contact an outside party, or transmit data.
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
        No substantive emergency-disclosure criteria are approved in this phase. Emergency
        approval, disclosure approval, export, member notice sending, external contact, and
        external transmission remain disabled. Qualified counsel review is required before any
        approval criteria or approval workflow.
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={panelStyle}>
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className={panelClass} style={panelStyle}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
              Emergency requests
            </h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
              {authorization?.can_review_emergency ? "Review enabled" : "Review disabled"}
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {loading ? <p className="text-sm">Loading…</p> : null}
            {!loading && requests.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                No emergency-disclosure request records.
              </p>
            ) : null}
            {requests.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className="rounded-xl border p-3 text-left transition hover:border-[#CBAB5B]"
                style={{
                  borderColor: selectedId === row.id ? "#CBAB5B" : "var(--loombus-border)",
                  background:
                    selectedId === row.id ? "rgba(203,171,91,0.10)" : "var(--loombus-surface)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{row.request_number}</span>
                  <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    {titleCase(row.emergency_review_status)}
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                  {titleCase(row.status)} · Revision {row.emergency_review_revision}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
                  Updated {formatDate(row.updated_at)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedId ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Select an emergency-disclosure request record to review draft assessment metadata.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <div className={panelClass} style={panelStyle}>Loading request…</div>
          ) : (
            <>
              <div className={panelClass} style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{detail.request_number}</h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                      {titleCase(detail.request_type)} · {titleCase(detail.status)}
                    </p>
                  </div>
                  <div className="text-right text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    <div>Counsel: {titleCase(detail.counsel_review_status)}</div>
                    <div>Draft revision: {detail.emergency_review_revision}</div>
                  </div>
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3 className="text-lg font-semibold">Draft assessment</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                  Use minimum-necessary internal metadata only. Do not treat this field as an
                  approved legal threshold, evidence repository, member-data store, or external
                  communication record.
                </p>

                <label className="mt-5 block text-sm font-semibold">
                  Review status
                  <select
                    className={`${fieldClass} mt-2`}
                    style={fieldStyle}
                    value={editor.reviewStatus}
                    onChange={(event) =>
                      setEditor((current) => ({ ...current, reviewStatus: event.target.value }))
                    }
                  >
                    {REVIEW_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {titleCase(status)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block text-sm font-semibold">
                  Draft emergency review summary
                  <textarea
                    className={`${fieldClass} mt-2 min-h-40`}
                    style={fieldStyle}
                    maxLength={4000}
                    value={editor.emergencyCriteriaSummary}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        emergencyCriteriaSummary: event.target.value,
                      }))
                    }
                    placeholder="Internal draft assessment only. No approved criteria are established by this field."
                  />
                </label>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={working}
                    onClick={() => void saveDraft()}
                  >
                    {working ? "Saving…" : "Save draft assessment"}
                  </button>
                  <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    Optimistic revision control is enforced by the database.
                  </span>
                </div>
              </div>
            </>
          )}

          <div className={panelClass} style={panelStyle}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#CBAB5B]">
              Authority boundary
            </h3>
            <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>Role: {authorization ? titleCase(authorization.role) : "Not loaded"}</div>
              <div>Emergency review: {authorization?.can_review_emergency ? "Enabled" : "Disabled"}</div>
              <div>Emergency approval: {authorization?.can_approve_emergency ? "Enabled" : "Disabled"}</div>
              <div>Disclosure authority: {authorization?.can_disclose ? "Enabled" : "Disabled"}</div>
              <div>Export authority: {authorization?.can_export ? "Enabled" : "Disabled"}</div>
              <div>External transmission: {phase?.externalTransmissionEnabled ? "Enabled" : "Disabled"}</div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
