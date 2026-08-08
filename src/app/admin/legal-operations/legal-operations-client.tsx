"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  user_id: string;
  role: string;
  can_intake: boolean;
  can_preserve: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
  can_manage_access: boolean;
  active: boolean;
};

type LegalRequestRow = {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  intake_channel: string;
  received_at: string;
  requester_organization: string | null;
  requester_name: string | null;
  requester_contact_ref: string | null;
  requester_identity_status: string;
  requester_identity_summary: string | null;
  jurisdiction: string | null;
  asserted_authority: string | null;
  authority_review_status: string;
  authority_review_summary: string | null;
  original_scope: string;
  narrowed_scope: string | null;
  scope_review_status: string;
  counsel_review_status: string;
  deficiency_reason: string | null;
  rejection_reason: string | null;
  emergency_criteria_summary: string | null;
  cross_border_status: string;
  conflicting_law_summary: string | null;
  confidentiality_notes: string | null;
  member_notice_decision: string | null;
  delayed_notice_basis: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type HoldRow = {
  id: string;
  request_id: string;
  status: string;
  legal_basis_summary: string;
  scope_summary: string;
  starts_at: string | null;
  expires_at: string | null;
  next_review_at: string | null;
  extended_at: string | null;
  released_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

type HoldTarget = {
  id: string;
  hold_id: string;
  resource_key: string | null;
  target_type: string;
  target_ref: string | null;
  subject_user_id: string | null;
  source_system: string | null;
  minimum_necessary_reason: string;
  created_at: string;
};

type LegalEvent = {
  id: string;
  request_id: string;
  hold_id: string | null;
  disclosure_id: string | null;
  event_type: string;
  action: string;
  purpose: string | null;
  details: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

type DetailResponse = {
  authorization: Authorization;
  request: LegalRequestRow;
  holds: HoldRow[];
  targets: HoldTarget[];
  events: LegalEvent[];
};

const REQUEST_TYPES = [
  "subpoena",
  "warrant",
  "court_order",
  "preservation_request",
  "emergency_disclosure",
  "ip_notice",
  "regulatory_request",
  "law_enforcement_inquiry",
  "civil_request",
  "other",
];
const REQUEST_STATUSES = [
  "intake",
  "identity_verification",
  "authority_review",
  "scope_review",
  "awaiting_counsel",
  "preservation_active",
  "deficient",
  "rejected",
  "closed",
];
const IDENTITY_STATUSES = ["unverified", "pending", "verified", "failed", "not_applicable"];
const AUTHORITY_STATUSES = [
  "unreviewed",
  "pending",
  "sufficient",
  "insufficient",
  "requires_counsel",
];
const SCOPE_STATUSES = ["unreviewed", "pending", "accepted", "narrowed", "deficient", "rejected"];
const CROSS_BORDER_STATUSES = [
  "not_identified",
  "not_applicable",
  "identified",
  "requires_counsel",
  "resolved",
];
const TARGET_TYPES = [
  "account",
  "profile",
  "discussion",
  "reply",
  "private_message",
  "room",
  "storage_object",
  "billing_record",
  "support_record",
  "search_document",
  "ai_record",
  "trust_safety_case",
  "audit_log",
  "notification_delivery",
  "vendor_record",
  "other",
];

function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
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

function localDateTimeToIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Enter a valid local date and time.");
  }
  return date.toISOString();
}

function isoToLocalDateTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

async function authorizedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations";
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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations";
    throw new Error("Authentication required.");
  }

  return response;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

const panel = "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const field =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const label = "grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const button =
  "rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950";
const secondaryButton =
  "rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200";

export default function LegalOperationsClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [requests, setRequests] = useState<LegalRequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const [newRequest, setNewRequest] = useState({
    requestType: "preservation_request",
    intakeChannel: "legal_email",
    requesterOrganization: "",
    requesterName: "",
    requesterContactRef: "",
    jurisdiction: "",
    assertedAuthority: "",
    originalScope: "",
  });
  const [editor, setEditor] = useState({
    status: "intake",
    requesterIdentityStatus: "unverified",
    requesterIdentitySummary: "",
    authorityReviewStatus: "unreviewed",
    authorityReviewSummary: "",
    scopeReviewStatus: "unreviewed",
    narrowedScope: "",
    crossBorderStatus: "not_identified",
    deficiencyReason: "",
    rejectionReason: "",
    emergencyCriteriaSummary: "",
    conflictingLawSummary: "",
    confidentialityNotes: "",
    memberNoticeDecision: "",
    delayedNoticeBasis: "",
  });
  const [holdForm, setHoldForm] = useState({
    legalBasisSummary: "",
    scopeSummary: "",
    expiresAt: "",
    nextReviewAt: "",
  });
  const [targetForm, setTargetForm] = useState({
    holdId: "",
    targetType: "account",
    resourceKey: "",
    targetRef: "",
    subjectUserId: "",
    sourceSystem: "Loombus",
    minimumNecessaryReason: "",
  });
  const [noteForm, setNoteForm] = useState({
    eventType: "note",
    action: "review_note_added",
    purpose: "",
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (typeFilter) params.set("requestType", typeFilter);
      const response = await authorizedFetch(`/api/admin/legal-operations?${params.toString()}`);
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load Legal Operations."));
        return;
      }
      const body = (await response.json()) as {
        authorization: Authorization;
        requests: LegalRequestRow[];
      };
      setRestricted(false);
      setAuthorization(body.authorization);
      setRequests(body.requests);
      if (selectedId && !body.requests.some((row) => row.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedId, statusFilter, typeFilter]);

  const loadDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        `/api/admin/legal-operations?requestId=${encodeURIComponent(requestId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load the legal request."));
        return;
      }
      const body = (await response.json()) as DetailResponse;
      setAuthorization(body.authorization);
      setDetail(body);
      setEditor({
        status: body.request.status,
        requesterIdentityStatus: body.request.requester_identity_status,
        requesterIdentitySummary: body.request.requester_identity_summary ?? "",
        authorityReviewStatus: body.request.authority_review_status,
        authorityReviewSummary: body.request.authority_review_summary ?? "",
        scopeReviewStatus: body.request.scope_review_status,
        narrowedScope: body.request.narrowed_scope ?? "",
        crossBorderStatus: body.request.cross_border_status,
        deficiencyReason: body.request.deficiency_reason ?? "",
        rejectionReason: body.request.rejection_reason ?? "",
        emergencyCriteriaSummary: body.request.emergency_criteria_summary ?? "",
        conflictingLawSummary: body.request.conflicting_law_summary ?? "",
        confidentialityNotes: body.request.confidentiality_notes ?? "",
        memberNoticeDecision: body.request.member_notice_decision ?? "",
        delayedNoticeBasis: body.request.delayed_notice_basis ?? "",
      });
      const firstDraft = body.holds.find((hold) => hold.status === "draft");
      setTargetForm((current) => ({ ...current, holdId: firstDraft?.id ?? "" }));
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") setMessage(error.message);
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

  const targetsByHold = useMemo(() => {
    const map = new Map<string, HoldTarget[]>();
    for (const target of detail?.targets ?? []) {
      map.set(target.hold_id, [...(map.get(target.hold_id) ?? []), target]);
    }
    return map;
  }, [detail?.targets]);

  async function post(payload: Record<string, unknown>) {
    const response = await authorizedFetch("/api/admin/legal-operations", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(await responseMessage(response, "Legal Operations action failed."));
    return response.json();
  }

  async function createRequest() {
    setWorking(true);
    setMessage("");
    try {
      const body = (await post({ operation: "create_request", ...newRequest })) as {
        request: LegalRequestRow;
      };
      setShowCreate(false);
      setNewRequest((current) => ({
        ...current,
        requesterOrganization: "",
        requesterName: "",
        requesterContactRef: "",
        jurisdiction: "",
        assertedAuthority: "",
        originalScope: "",
      }));
      await loadList();
      setSelectedId(body.request.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create legal request.");
    } finally {
      setWorking(false);
    }
  }

  async function updateRequest() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({ operation: "update_request", requestId: selectedId, ...editor });
      await Promise.all([loadDetail(selectedId), loadList()]);
      setMessage("Legal request updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update legal request.");
    } finally {
      setWorking(false);
    }
  }

  async function createHold() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({
        operation: "create_hold",
        requestId: selectedId,
        legalBasisSummary: holdForm.legalBasisSummary,
        scopeSummary: holdForm.scopeSummary,
        expiresAt: localDateTimeToIso(holdForm.expiresAt),
        nextReviewAt: localDateTimeToIso(holdForm.nextReviewAt),
      });
      setHoldForm({ legalBasisSummary: "", scopeSummary: "", expiresAt: "", nextReviewAt: "" });
      await loadDetail(selectedId);
      setMessage("Draft preservation hold created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create hold.");
    } finally {
      setWorking(false);
    }
  }

  async function updateDraftHoldSchedule(holdId: string, expiresAt: string, nextReviewAt: string) {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({
        operation: "update_hold",
        requestId: selectedId,
        holdId,
        expiresAt: localDateTimeToIso(expiresAt),
        nextReviewAt: localDateTimeToIso(nextReviewAt),
      });
      await loadDetail(selectedId);
      setMessage("Draft preservation hold schedule updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update preservation hold schedule.");
    } finally {
      setWorking(false);
    }
  }

  async function addTarget() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({ operation: "add_hold_target", requestId: selectedId, ...targetForm });
      setTargetForm((current) => ({
        ...current,
        resourceKey: "",
        targetRef: "",
        subjectUserId: "",
        minimumNecessaryReason: "",
      }));
      await loadDetail(selectedId);
      setMessage("Preservation target added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add preservation target.");
    } finally {
      setWorking(false);
    }
  }

  async function changeHold(operation: "activate_hold" | "release_hold" | "expire_hold", holdId: string) {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({ operation, requestId: selectedId, holdId });
      await loadDetail(selectedId);
      setMessage("Preservation hold updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update preservation hold.");
    } finally {
      setWorking(false);
    }
  }

  async function addNote() {
    if (!selectedId) return;
    setWorking(true);
    setMessage("");
    try {
      await post({ operation: "add_event", requestId: selectedId, ...noteForm, details: {} });
      setNoteForm((current) => ({ ...current, purpose: "" }));
      await loadDetail(selectedId);
      setMessage("Handling event recorded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record handling event.");
    } finally {
      setWorking(false);
    }
  }

  if (restricted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className={panel}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Restricted workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-100">Legal Operations</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Access requires both platform administrator status and an active Legal Operations authorization.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-amber-700 dark:text-amber-400" href="/admin">
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Internal only · Issue #674 Phase 2
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950 dark:text-zinc-100">Legal Operations</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
            Restricted request review and preservation controls. Export, disclosure approval, and external transmission remain disabled.
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">
          <div>Role: {authorization ? titleCase(authorization.role) : "Loading"}</div>
          <div>Intake: {authorization?.can_intake ? "enabled" : "disabled"} · Preserve: {authorization?.can_preserve ? "enabled" : "disabled"}</div>
        </div>
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
        <section className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Requests</h2>
            {authorization?.can_intake ? (
              <button className={secondaryButton} type="button" onClick={() => setShowCreate((value) => !value)}>
                {showCreate ? "Cancel" : "New request"}
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <select className={field} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              {REQUEST_STATUSES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
            <select className={field} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All types</option>
              {REQUEST_TYPES.map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </select>
          </div>

          {showCreate ? (
            <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
              <label className={label}>Request type
                <select className={field} value={newRequest.requestType} onChange={(event) => setNewRequest({ ...newRequest, requestType: event.target.value })}>
                  {REQUEST_TYPES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </select>
              </label>
              <label className={label}>Requester organization
                <input className={field} value={newRequest.requesterOrganization} onChange={(event) => setNewRequest({ ...newRequest, requesterOrganization: event.target.value })} />
              </label>
              <label className={label}>Requester name
                <input className={field} value={newRequest.requesterName} onChange={(event) => setNewRequest({ ...newRequest, requesterName: event.target.value })} />
              </label>
              <label className={label}>Requester contact reference
                <input className={field} value={newRequest.requesterContactRef} onChange={(event) => setNewRequest({ ...newRequest, requesterContactRef: event.target.value })} />
              </label>
              <label className={label}>Jurisdiction
                <input className={field} value={newRequest.jurisdiction} onChange={(event) => setNewRequest({ ...newRequest, jurisdiction: event.target.value })} />
              </label>
              <label className={label}>Asserted authority
                <textarea className={field} rows={3} value={newRequest.assertedAuthority} onChange={(event) => setNewRequest({ ...newRequest, assertedAuthority: event.target.value })} />
              </label>
              <label className={label}>Original scope
                <textarea className={field} rows={5} value={newRequest.originalScope} onChange={(event) => setNewRequest({ ...newRequest, originalScope: event.target.value })} />
              </label>
              <button className={button} disabled={working || newRequest.originalScope.trim().length < 5} type="button" onClick={() => void createRequest()}>
                Create restricted record
              </button>
            </div>
          ) : null}

          <div className="mt-4 grid gap-2">
            {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
            {!loading && requests.length === 0 ? <p className="text-sm text-zinc-500">No legal requests recorded.</p> : null}
            {requests.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={`rounded-xl border p-3 text-left transition ${selectedId === row.id ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20" : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{row.request_number}</span>
                  <span className="text-xs text-zinc-500">{titleCase(row.status)}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{titleCase(row.request_type)} · {formatDate(row.received_at)}</div>
                <div className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{row.original_scope}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedId ? (
            <div className={panel}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Select a legal request to review its restricted metadata and preservation history.</p>
            </div>
          ) : detailLoading || !detail ? (
            <div className={panel}><p className="text-sm text-zinc-500">Loading request…</p></div>
          ) : (
            <>
              <div className={panel}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-100">{detail.request.request_number}</h2>
                    <p className="mt-1 text-sm text-zinc-500">{titleCase(detail.request.request_type)} · received {formatDate(detail.request.received_at)}</p>
                  </div>
                  <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-semibold dark:border-zinc-700">{titleCase(detail.request.status)}</span>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Info label="Requester" value={[detail.request.requester_organization, detail.request.requester_name].filter(Boolean).join(" · ") || "Not recorded"} />
                  <Info label="Jurisdiction" value={detail.request.jurisdiction ?? "Not recorded"} />
                  <Info label="Original scope" value={detail.request.original_scope} wide />
                  <Info label="Asserted authority" value={detail.request.asserted_authority ?? "Not recorded"} wide />
                  <Info label="Counsel review" value={titleCase(detail.request.counsel_review_status)} />
                  <Info label="Updated" value={formatDate(detail.request.updated_at)} />
                </div>
              </div>

              {authorization?.can_intake ? (
                <div className={panel}>
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Review state</h3>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <SelectField label="Request status" value={editor.status} values={REQUEST_STATUSES} onChange={(value) => setEditor({ ...editor, status: value })} />
                    <SelectField label="Identity review" value={editor.requesterIdentityStatus} values={IDENTITY_STATUSES} onChange={(value) => setEditor({ ...editor, requesterIdentityStatus: value })} />
                    <SelectField label="Authority review" value={editor.authorityReviewStatus} values={AUTHORITY_STATUSES} onChange={(value) => setEditor({ ...editor, authorityReviewStatus: value })} />
                    <SelectField label="Scope review" value={editor.scopeReviewStatus} values={SCOPE_STATUSES} onChange={(value) => setEditor({ ...editor, scopeReviewStatus: value })} />
                    <SelectField label="Cross-border review" value={editor.crossBorderStatus} values={CROSS_BORDER_STATUSES} onChange={(value) => setEditor({ ...editor, crossBorderStatus: value })} />
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <TextAreaField label="Identity review summary" value={editor.requesterIdentitySummary} onChange={(value) => setEditor({ ...editor, requesterIdentitySummary: value })} />
                    <TextAreaField label="Authority review summary" value={editor.authorityReviewSummary} onChange={(value) => setEditor({ ...editor, authorityReviewSummary: value })} />
                    <TextAreaField label="Narrowed scope" value={editor.narrowedScope} onChange={(value) => setEditor({ ...editor, narrowedScope: value })} />
                    <TextAreaField label="Emergency criteria summary" value={editor.emergencyCriteriaSummary} onChange={(value) => setEditor({ ...editor, emergencyCriteriaSummary: value })} />
                    <TextAreaField label="Deficiency reason" value={editor.deficiencyReason} onChange={(value) => setEditor({ ...editor, deficiencyReason: value })} />
                    <TextAreaField label="Rejection reason" value={editor.rejectionReason} onChange={(value) => setEditor({ ...editor, rejectionReason: value })} />
                    <TextAreaField label="Conflicting-law summary" value={editor.conflictingLawSummary} onChange={(value) => setEditor({ ...editor, conflictingLawSummary: value })} />
                    <TextAreaField label="Confidentiality notes" value={editor.confidentialityNotes} onChange={(value) => setEditor({ ...editor, confidentialityNotes: value })} />
                    <TextAreaField label="Member notice decision" value={editor.memberNoticeDecision} onChange={(value) => setEditor({ ...editor, memberNoticeDecision: value })} />
                    <TextAreaField label="Delayed-notice basis" value={editor.delayedNoticeBasis} onChange={(value) => setEditor({ ...editor, delayedNoticeBasis: value })} />
                  </div>
                  <button className={`${button} mt-4`} disabled={working} type="button" onClick={() => void updateRequest()}>Save review state</button>
                </div>
              ) : null}

              <div className={panel}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Preservation holds</h3>
                  <span className="text-xs text-zinc-500">{detail.holds.length} recorded</span>
                </div>

                {authorization?.can_preserve ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
                    <TextAreaField label="Legal-basis summary" value={holdForm.legalBasisSummary} onChange={(value) => setHoldForm({ ...holdForm, legalBasisSummary: value })} />
                    <TextAreaField label="Scope summary" value={holdForm.scopeSummary} onChange={(value) => setHoldForm({ ...holdForm, scopeSummary: value })} />
                    <label className={label}>Expires at<input className={field} type="datetime-local" value={holdForm.expiresAt} onChange={(event) => setHoldForm({ ...holdForm, expiresAt: event.target.value })} /></label>
                    <label className={label}>Next review at<input className={field} type="datetime-local" value={holdForm.nextReviewAt} onChange={(event) => setHoldForm({ ...holdForm, nextReviewAt: event.target.value })} /></label>
                    <p className="text-xs text-zinc-500 md:col-span-2">Date and time fields are interpreted in this browser&apos;s local timezone and stored as timezone-aware UTC timestamps.</p>
                    <button className={button} disabled={working || holdForm.legalBasisSummary.trim().length < 5 || holdForm.scopeSummary.trim().length < 5} type="button" onClick={() => void createHold()}>Create draft hold</button>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-3">
                  {detail.holds.length === 0 ? <p className="text-sm text-zinc-500">No preservation holds recorded.</p> : null}
                  {detail.holds.map((hold) => (
                    <div key={hold.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{titleCase(hold.status)} hold</div>
                        <div className="flex gap-2">
                          {authorization?.can_preserve && hold.status === "draft" ? <button className={secondaryButton} disabled={working} type="button" onClick={() => void changeHold("activate_hold", hold.id)}>Activate</button> : null}
                          {authorization?.can_preserve && hold.status === "active" ? <button className={secondaryButton} disabled={working} type="button" onClick={() => void changeHold("release_hold", hold.id)}>Release</button> : null}
                          {authorization?.can_preserve && hold.status === "active" && hold.expires_at && new Date(hold.expires_at).getTime() <= Date.now() ? <button className={secondaryButton} disabled={working} type="button" onClick={() => void changeHold("expire_hold", hold.id)}>Mark expired</button> : null}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300"><strong>Basis:</strong> {hold.legal_basis_summary}</p>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300"><strong>Scope:</strong> {hold.scope_summary}</p>
                      <p className="mt-2 text-xs text-zinc-500">Starts: {formatDate(hold.starts_at)} · Expires: {formatDate(hold.expires_at)} · Review: {formatDate(hold.next_review_at)}</p>
                      {authorization?.can_preserve && hold.status === "draft" ? (
                        <DraftHoldScheduleEditor
                          hold={hold}
                          working={working}
                          onSave={(expiresAt, nextReviewAt) => void updateDraftHoldSchedule(hold.id, expiresAt, nextReviewAt)}
                        />
                      ) : null}
                      <div className="mt-3 grid gap-2">
                        {(targetsByHold.get(hold.id) ?? []).map((target) => (
                          <div key={target.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                            <strong>{titleCase(target.target_type)}</strong> · {target.target_ref ?? target.subject_user_id ?? target.resource_key ?? "Reference"}<br />
                            {target.minimum_necessary_reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {authorization?.can_preserve && detail.holds.some((hold) => hold.status === "draft") ? (
                  <div className="mt-4 grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
                    <label className={label}>Draft hold
                      <select className={field} value={targetForm.holdId} onChange={(event) => setTargetForm({ ...targetForm, holdId: event.target.value })}>
                        <option value="">Select draft hold</option>
                        {detail.holds.filter((hold) => hold.status === "draft").map((hold) => <option key={hold.id} value={hold.id}>{hold.id.slice(0, 8)} · {hold.scope_summary.slice(0, 50)}</option>)}
                      </select>
                    </label>
                    <SelectField label="Target type" value={targetForm.targetType} values={TARGET_TYPES} onChange={(value) => setTargetForm({ ...targetForm, targetType: value })} />
                    <label className={label}>Resource key<input className={field} value={targetForm.resourceKey} onChange={(event) => setTargetForm({ ...targetForm, resourceKey: event.target.value })} /></label>
                    <label className={label}>Target reference<input className={field} value={targetForm.targetRef} onChange={(event) => setTargetForm({ ...targetForm, targetRef: event.target.value })} /></label>
                    <label className={label}>Subject user UUID<input className={field} value={targetForm.subjectUserId} onChange={(event) => setTargetForm({ ...targetForm, subjectUserId: event.target.value })} /></label>
                    <label className={label}>Source system<input className={field} value={targetForm.sourceSystem} onChange={(event) => setTargetForm({ ...targetForm, sourceSystem: event.target.value })} /></label>
                    <label className={`${label} md:col-span-2`}>Minimum-necessary reason<textarea className={field} rows={3} value={targetForm.minimumNecessaryReason} onChange={(event) => setTargetForm({ ...targetForm, minimumNecessaryReason: event.target.value })} /></label>
                    <button className={button} disabled={working || !targetForm.holdId || targetForm.minimumNecessaryReason.trim().length < 5} type="button" onClick={() => void addTarget()}>Add append-only target</button>
                  </div>
                ) : null}
              </div>

              {authorization?.can_intake ? (
                <div className={panel}>
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Handling note</h3>
                  <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
                    <label className={label}>Event type<select className={field} value={noteForm.eventType} onChange={(event) => setNoteForm({ ...noteForm, eventType: event.target.value })}><option value="note">Note</option><option value="handling">Handling</option><option value="specialist_routing">Specialist routing</option></select></label>
                    <label className={label}>Purpose<textarea className={field} rows={3} value={noteForm.purpose} onChange={(event) => setNoteForm({ ...noteForm, purpose: event.target.value })} /></label>
                  </div>
                  <button className={`${button} mt-3`} disabled={working} type="button" onClick={() => void addNote()}>Record event</button>
                </div>
              ) : null}

              <div className={panel}>
                <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Append-only history</h3>
                <div className="mt-4 grid gap-2">
                  {detail.events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-800">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{titleCase(event.event_type)} · {event.action}</span>
                        <span className="text-xs text-zinc-500">{formatDate(event.created_at)}</span>
                      </div>
                      {event.purpose ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{event.purpose}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label: heading, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{heading}</div>
      <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">{value}</div>
    </div>
  );
}

function SelectField({
  label: heading,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className={label}>
      {heading}
      <select className={field} value={value} onChange={(event) => onChange(event.target.value)}>
        {values.map((item) => <option key={item} value={item}>{titleCase(item)}</option>)}
      </select>
    </label>
  );
}

function TextAreaField({
  label: heading,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={label}>
      {heading}
      <textarea className={field} rows={3} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function DraftHoldScheduleEditor({
  hold,
  working,
  onSave,
}: {
  hold: HoldRow;
  working: boolean;
  onSave: (expiresAt: string, nextReviewAt: string) => void;
}) {
  const [expiresAt, setExpiresAt] = useState(() => isoToLocalDateTime(hold.expires_at));
  const [nextReviewAt, setNextReviewAt] = useState(() => isoToLocalDateTime(hold.next_review_at));

  useEffect(() => {
    setExpiresAt(isoToLocalDateTime(hold.expires_at));
    setNextReviewAt(isoToLocalDateTime(hold.next_review_at));
  }, [hold.expires_at, hold.next_review_at]);

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800 md:grid-cols-2">
      <label className={label}>
        Draft expires at
        <input className={field} type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
      </label>
      <label className={label}>
        Draft next review at
        <input className={field} type="datetime-local" value={nextReviewAt} onChange={(event) => setNextReviewAt(event.target.value)} />
      </label>
      <p className="text-xs text-zinc-500 md:col-span-2">Use local wall-clock time. Saving converts these values to timezone-aware UTC before the restricted API receives them.</p>
      <button className={secondaryButton} disabled={working} type="button" onClick={() => onSave(expiresAt, nextReviewAt)}>
        Save draft schedule
      </button>
    </div>
  );
}
