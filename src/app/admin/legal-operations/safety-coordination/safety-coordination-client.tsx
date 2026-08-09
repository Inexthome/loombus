"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_requests: boolean;
  can_coordinate_safety: boolean;
  can_review_emergency: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type PhaseState = {
  internalCoordinationMetadataOnly: boolean;
  substantiveSafetyOrEmergencyStandardApproved: boolean;
  trustSafetyCaseMutationEnabled: boolean;
  legalRequestMutationEnabled: boolean;
  externalReportingEnabled: boolean;
  externalContactEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  disclosureEnabled: boolean;
  exportEnabled: boolean;
  externalTransmissionEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
};

type SafetyCaseRow = {
  id: string;
  case_number: string;
  severity: string;
  primary_category: string;
  status: string;
  updated_at: string;
};

type CoordinationRow = {
  id: string;
  trust_safety_case_id: string;
  legal_request_id: string | null;
  coordination_type: string;
  status: string;
  assigned_legal_reviewer: string | null;
  revision: number;
  updated_at: string;
  handoff_reason_summary?: string;
  minimum_necessary_reason?: string;
  created_by?: string;
  updated_by?: string;
  created_at?: string;
};

const COORDINATION_TYPES = ["child_safety", "imminent_danger", "high_risk_safety"];
const COORDINATION_STATUSES = [
  "draft",
  "legal_review_requested",
  "legal_review_acknowledged",
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

function defaultCoordinationType(category: string) {
  if (["child_safety", "sexual_exploitation", "sextortion"].includes(category)) {
    return "child_safety";
  }
  return "high_risk_safety";
}

async function authorizedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fsafety-coordination";
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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fsafety-coordination";
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

export default function SafetyCoordinationClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<PhaseState | null>(null);
  const [cases, setCases] = useState<SafetyCaseRow[]>([]);
  const [coordination, setCoordination] = useState<CoordinationRow[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<SafetyCaseRow | null>(null);
  const [selectedCoordination, setSelectedCoordination] = useState<CoordinationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [editor, setEditor] = useState({
    coordinationType: "high_risk_safety",
    status: "draft",
    handoffReasonSummary: "",
    minimumNecessaryReason: "",
    legalRequestId: "",
  });

  const coordinationByCase = useMemo(
    () => new Map(coordination.map((row) => [row.trust_safety_case_id, row])),
    [coordination]
  );

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/legal-operations/safety-coordination");
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load safety coordination."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        cases: SafetyCaseRow[];
        coordination: CoordinationRow[];
        phase: PhaseState;
      };
      setRestricted(false);
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setCases(body.cases);
      setCoordination(body.coordination);
      if (selectedCaseId && !body.cases.some((row) => row.id === selectedCaseId)) {
        setSelectedCaseId(null);
        setSelectedCase(null);
        setSelectedCoordination(null);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedCaseId]);

  const loadDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        `/api/admin/legal-operations/safety-coordination?caseId=${encodeURIComponent(caseId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load coordination metadata."));
        return;
      }

      const body = (await response.json()) as {
        case: SafetyCaseRow;
        coordination: CoordinationRow | null;
        authorization: { can_review_emergency: boolean };
        phase: PhaseState;
      };

      setSelectedCase(body.case);
      setSelectedCoordination(body.coordination);
      setPhase(body.phase);
      setAuthorization((current) =>
        current
          ? { ...current, can_review_emergency: body.authorization.can_review_emergency }
          : current
      );
      setEditor({
        coordinationType:
          body.coordination?.coordination_type ?? defaultCoordinationType(body.case.primary_category),
        status: body.coordination?.status ?? "draft",
        handoffReasonSummary: body.coordination?.handoff_reason_summary ?? "",
        minimumNecessaryReason: body.coordination?.minimum_necessary_reason ?? "",
        legalRequestId: body.coordination?.legal_request_id ?? "",
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
    if (selectedCaseId) void loadDetail(selectedCaseId);
  }, [loadDetail, selectedCaseId]);

  async function saveDraft() {
    if (!selectedCaseId) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/legal-operations/safety-coordination", {
        method: "POST",
        body: JSON.stringify({
          operation: selectedCoordination
            ? "update_coordination_draft"
            : "create_coordination_draft",
          caseId: selectedCaseId,
          coordinationType: editor.coordinationType,
          status: editor.status,
          handoffReasonSummary: editor.handoffReasonSummary,
          minimumNecessaryReason: editor.minimumNecessaryReason,
          legalRequestId: editor.legalRequestId.trim() || null,
        }),
      });

      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to save coordination draft."));
        return;
      }

      await Promise.all([loadDetail(selectedCaseId), loadList()]);
      setMessage("Internal safety coordination draft saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save coordination draft.");
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
            Safety Coordination
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires platform administrator status, an active Legal Operations
            authorization, can_review_requests, and the dedicated can_coordinate_safety
            capability. Imminent-danger coordination additionally requires
            can_review_emergency. These capabilities do not authorize external reporting,
            emergency approval, disclosure, export, contact, or transmission.
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
            Safety Coordination
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Record minimum-necessary internal coordination metadata between restricted Trust
            and Safety cases and Legal Operations. This workspace does not establish an
            emergency or child-safety legal standard and cannot report externally, contact an
            outside party, approve a disclosure, export data, or transmit data.
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
            href="/admin/reports/trust-safety"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-strong)" }}
          >
            Trust &amp; Safety
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
        Internal coordination only. No NCMEC, law-enforcement, emergency-service, requester,
        recipient, or other outside-party contact is enabled here. No substantive reporting or
        emergency threshold is approved. Trust and Safety case state, Legal Request state,
        emergency approval, disclosure, export, member notice sending, and external transmission
        remain outside this phase and require separately approved controls and qualified counsel
        review where applicable.
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
              Restricted T&amp;S case metadata
            </h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
              {authorization?.can_coordinate_safety ? "Coordination enabled" : "Coordination disabled"}
            </span>
          </div>
          <p className="mt-2 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
            Only case number, severity, category, status, and update time are exposed here. Case
            summaries, member content, evidence, messages, attachments, and Storage objects are
            not loaded by this workspace.
          </p>

          <div className="mt-4 grid gap-2">
            {loading ? <p className="text-sm">Loading…</p> : null}
            {!loading && cases.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                No eligible Trust and Safety case records. Do not create one merely to test this
                workspace.
              </p>
            ) : null}
            {cases.map((row) => {
              const coordinationRow = coordinationByCase.get(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSelectedCaseId(row.id)}
                  className="rounded-xl border p-3 text-left transition hover:border-[#CBAB5B]"
                  style={{
                    borderColor: selectedCaseId === row.id ? "#CBAB5B" : "var(--loombus-border)",
                    background:
                      selectedCaseId === row.id
                        ? "rgba(203,171,91,0.10)"
                        : "var(--loombus-surface)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{row.case_number}</span>
                    <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                      {row.severity}
                    </span>
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    {titleCase(row.primary_category)} · {titleCase(row.status)}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
                    {coordinationRow
                      ? `${titleCase(coordinationRow.status)} · Revision ${coordinationRow.revision}`
                      : "No Legal Operations coordination record"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedCaseId ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Select an eligible Trust and Safety case to review or prepare internal
                coordination metadata.
              </p>
            </div>
          ) : detailLoading || !selectedCase ? (
            <div className={panelClass} style={panelStyle}>Loading case metadata…</div>
          ) : (
            <>
              <div className={panelClass} style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">{selectedCase.case_number}</h2>
                    <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                      {titleCase(selectedCase.primary_category)} · {selectedCase.severity} ·{" "}
                      {titleCase(selectedCase.status)}
                    </p>
                  </div>
                  <div className="text-right text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    <div>Updated {formatDate(selectedCase.updated_at)}</div>
                    <div>
                      Coordination revision: {selectedCoordination?.revision ?? "Not created"}
                    </div>
                  </div>
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3 className="text-lg font-semibold">Internal coordination draft</h3>
                <p className="mt-2 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                  Record only what Legal Operations needs to understand the internal handoff.
                  Do not copy raw evidence, member messages, attachments, sensitive victim
                  details, or unnecessary case narrative into these fields.
                </p>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold">
                    Coordination type
                    <select
                      className={`${fieldClass} mt-2`}
                      style={fieldStyle}
                      value={editor.coordinationType}
                      onChange={(event) =>
                        setEditor((current) => ({ ...current, coordinationType: event.target.value }))
                      }
                    >
                      {COORDINATION_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {titleCase(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block text-sm font-semibold">
                    Coordination status
                    <select
                      className={`${fieldClass} mt-2`}
                      style={fieldStyle}
                      value={editor.status}
                      onChange={(event) =>
                        setEditor((current) => ({ ...current, status: event.target.value }))
                      }
                    >
                      {COORDINATION_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {titleCase(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {editor.coordinationType === "imminent_danger" ? (
                  <div
                    className="mt-4 rounded-xl border px-4 py-3 text-sm"
                    style={{ borderColor: "rgba(203,171,91,0.45)", color: "var(--loombus-text-muted)" }}
                  >
                    Imminent-danger coordination requires the separate can_review_emergency
                    capability. Selecting this label still does not establish an emergency legal
                    standard or authorize external contact, reporting, disclosure, or approval.
                  </div>
                ) : null}

                <label className="mt-4 block text-sm font-semibold">
                  Internal handoff reason
                  <textarea
                    className={`${fieldClass} mt-2 min-h-28`}
                    style={fieldStyle}
                    maxLength={4000}
                    value={editor.handoffReasonSummary}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        handoffReasonSummary: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="mt-4 block text-sm font-semibold">
                  Minimum-necessary reason
                  <textarea
                    className={`${fieldClass} mt-2 min-h-28`}
                    style={fieldStyle}
                    maxLength={4000}
                    value={editor.minimumNecessaryReason}
                    onChange={(event) =>
                      setEditor((current) => ({
                        ...current,
                        minimumNecessaryReason: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="mt-4 block text-sm font-semibold">
                  Optional Legal Request ID
                  <input
                    className={`${fieldClass} mt-2`}
                    style={fieldStyle}
                    value={editor.legalRequestId}
                    onChange={(event) =>
                      setEditor((current) => ({ ...current, legalRequestId: event.target.value }))
                    }
                    placeholder="UUID only, if an existing Legal Request is already relevant"
                  />
                </label>

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={working}
                    onClick={() => void saveDraft()}
                  >
                    {working
                      ? "Saving…"
                      : selectedCoordination
                        ? "Update coordination draft"
                        : "Create coordination draft"}
                  </button>
                  <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    No external action is performed by this button.
                  </span>
                </div>
              </div>
            </>
          )}

          <div className={panelClass} style={panelStyle}>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#CBAB5B]">
              Authority boundary
            </p>
            <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>Role: {authorization ? titleCase(authorization.role) : "Loading"}</div>
              <div>
                Safety coordination: {authorization?.can_coordinate_safety ? "Enabled" : "Disabled"}
              </div>
              <div>
                Emergency review: {authorization?.can_review_emergency ? "Enabled" : "Disabled"}
              </div>
              <div>Emergency approval: {authorization?.can_approve_emergency ? "Enabled" : "Disabled"}</div>
              <div>Disclosure authority: {authorization?.can_disclose ? "Enabled" : "Disabled"}</div>
              <div>Export authority: {authorization?.can_export ? "Enabled" : "Disabled"}</div>
              <div>External reporting: {phase?.externalReportingEnabled ? "Enabled" : "Disabled"}</div>
              <div>External contact: {phase?.externalContactEnabled ? "Enabled" : "Disabled"}</div>
              <div>
                External transmission: {phase?.externalTransmissionEnabled ? "Enabled" : "Disabled"}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
