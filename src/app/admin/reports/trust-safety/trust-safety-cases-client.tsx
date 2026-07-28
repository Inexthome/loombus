"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type CaseRow = {
  id: string;
  case_number: string;
  source_type: string;
  source_id: string | null;
  severity: "S1" | "S2" | "S3" | "S4";
  primary_category: string;
  secondary_categories: string[];
  status: string;
  summary: string;
  reported_risk: string | null;
  observed_facts: string | null;
  unresolved_facts: string | null;
  reviewer_inference: string | null;
  containment_summary: string | null;
  decision: string | null;
  decision_rationale: string | null;
  external_escalation_status: string | null;
  member_notice_decision: string | null;
  preservation_status: string | null;
  target_refs: Record<string, unknown>;
  assigned_to: string | null;
  created_by: string;
  updated_by: string;
  closed_by: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};

type EvidenceRef = {
  id: string;
  case_id: string;
  evidence_type: string;
  source_system: string;
  source_table: string | null;
  source_record_id: string | null;
  storage_reference: string | null;
  existing_hash: string | null;
  original_timestamp: string | null;
  collection_purpose: string;
  minimum_necessary_justification: string;
  preservation_status: string;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
};

type CaseEvent = {
  id: string;
  case_id: string;
  evidence_ref_id: string | null;
  event_type: string;
  action: string;
  purpose: string | null;
  previous_location: string | null;
  new_location: string | null;
  details: Record<string, unknown>;
  actor_id: string | null;
  created_at: string;
};

type CaseDetail = {
  case: CaseRow;
  evidence: EvidenceRef[];
  events: CaseEvent[];
};

const SEVERITIES = ["S1", "S2", "S3", "S4"] as const;
const STATUSES = [
  "new",
  "triage",
  "contained",
  "reviewing",
  "awaiting_specialist",
  "awaiting_legal",
  "monitoring",
  "closed",
] as const;
const SOURCE_TYPES = [
  "manual",
  "report",
  "room_moderation",
  "security_email",
  "privacy_email",
  "legal_email",
  "support_email",
  "system",
  "other",
] as const;
const CATEGORIES = [
  "credible_threat",
  "child_safety",
  "sexual_exploitation",
  "intimate_image_abuse",
  "sextortion",
  "stalking",
  "doxxing",
  "trafficking",
  "dangerous_organization",
  "self_harm",
  "fraud",
  "account_security",
  "harassment",
  "impersonation",
  "privacy",
  "room_safety",
  "other",
] as const;

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

async function authorizedFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    window.location.href = "/login?next=%2Fadmin%2Freports%2Ftrust-safety";
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
    window.location.href = "/login?next=%2Fadmin%2Freports%2Ftrust-safety";
    throw new Error("Authentication required.");
  }

  return response;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

const fieldClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const labelClass = "grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const panelClass =
  "rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

export default function TrustSafetyCasesClient() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [restricted, setRestricted] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [newCase, setNewCase] = useState({
    severity: "S4",
    primaryCategory: "other",
    sourceType: "manual",
    sourceId: "",
    summary: "",
    targetRefs: "{}",
  });

  const [editor, setEditor] = useState({
    severity: "S4",
    primaryCategory: "other",
    status: "new",
    summary: "",
    reportedRisk: "",
    observedFacts: "",
    unresolvedFacts: "",
    reviewerInference: "",
    containmentSummary: "",
    decision: "",
    decisionRationale: "",
    externalEscalationStatus: "",
    memberNoticeDecision: "",
    preservationStatus: "",
    targetRefs: "{}",
  });

  const [evidenceForm, setEvidenceForm] = useState({
    evidenceType: "platform_record",
    sourceSystem: "Loombus",
    sourceTable: "",
    sourceRecordId: "",
    storageReference: "",
    existingHash: "",
    originalTimestamp: "",
    collectionPurpose: "",
    minimumNecessaryJustification: "",
    preservationStatus: "referenced",
  });

  const [eventForm, setEventForm] = useState({
    eventType: "handling",
    action: "",
    purpose: "",
    previousLocation: "",
    newLocation: "",
  });

  const loadDetail = useCallback(async (caseId: string) => {
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        `/api/admin/trust-safety/cases?caseId=${encodeURIComponent(caseId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load the selected case."));
        return;
      }
      const body = (await response.json()) as CaseDetail;
      setDetail(body);
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadCases = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const parameters = new URLSearchParams();
      if (severityFilter) parameters.set("severity", severityFilter);
      if (statusFilter) parameters.set("status", statusFilter);
      const response = await authorizedFetch(
        `/api/admin/trust-safety/cases${parameters.size ? `?${parameters}` : ""}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load Trust and Safety cases."));
        return;
      }
      const body = (await response.json()) as { cases: CaseRow[] };
      setCases(body.cases);
      const nextId =
        selectedId && body.cases.some((item) => item.id === selectedId)
          ? selectedId
          : body.cases[0]?.id ?? null;
      setSelectedId(nextId);
      if (nextId) await loadDetail(nextId);
      else setDetail(null);
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [loadDetail, selectedId, severityFilter, statusFilter]);

  useEffect(() => {
    void loadCases();
  }, [loadCases]);

  useEffect(() => {
    if (!detail?.case) return;
    const item = detail.case;
    setEditor({
      severity: item.severity,
      primaryCategory: item.primary_category,
      status: item.status,
      summary: item.summary,
      reportedRisk: item.reported_risk ?? "",
      observedFacts: item.observed_facts ?? "",
      unresolvedFacts: item.unresolved_facts ?? "",
      reviewerInference: item.reviewer_inference ?? "",
      containmentSummary: item.containment_summary ?? "",
      decision: item.decision ?? "",
      decisionRationale: item.decision_rationale ?? "",
      externalEscalationStatus: item.external_escalation_status ?? "",
      memberNoticeDecision: item.member_notice_decision ?? "",
      preservationStatus: item.preservation_status ?? "",
      targetRefs: JSON.stringify(item.target_refs ?? {}, null, 2),
    });
  }, [detail]);

  const visibleCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return cases;
    return cases.filter((item) =>
      [item.case_number, item.summary, item.primary_category, item.source_id ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [cases, search]);

  async function chooseCase(caseId: string) {
    setSelectedId(caseId);
    await loadDetail(caseId);
  }

  async function createCase(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setMessage("");
    try {
      let targetRefs: Record<string, unknown>;
      try {
        targetRefs = JSON.parse(newCase.targetRefs) as Record<string, unknown>;
      } catch {
        setMessage("Target references must be valid JSON.");
        return;
      }
      const response = await authorizedFetch("/api/admin/trust-safety/cases", {
        method: "POST",
        body: JSON.stringify({
          operation: "create_case",
          severity: newCase.severity,
          primaryCategory: newCase.primaryCategory,
          sourceType: newCase.sourceType,
          sourceId: newCase.sourceId,
          summary: newCase.summary,
          targetRefs,
        }),
      });
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to create the case."));
        return;
      }
      const body = (await response.json()) as { case: CaseRow };
      setShowCreate(false);
      setNewCase({
        severity: "S4",
        primaryCategory: "other",
        sourceType: "manual",
        sourceId: "",
        summary: "",
        targetRefs: "{}",
      });
      setSelectedId(body.case.id);
      await loadCases();
      await chooseCase(body.case.id);
      setMessage(`${body.case.case_number} created.`);
    } finally {
      setWorking(false);
    }
  }

  async function saveCase(event: React.FormEvent) {
    event.preventDefault();
    if (!detail?.case) return;
    setWorking(true);
    setMessage("");
    try {
      let targetRefs: Record<string, unknown>;
      try {
        targetRefs = JSON.parse(editor.targetRefs) as Record<string, unknown>;
      } catch {
        setMessage("Target references must be valid JSON.");
        return;
      }
      const response = await authorizedFetch("/api/admin/trust-safety/cases", {
        method: "PATCH",
        body: JSON.stringify({
          caseId: detail.case.id,
          ...editor,
          targetRefs,
        }),
      });
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to update the case."));
        return;
      }
      await loadCases();
      await loadDetail(detail.case.id);
      setMessage("Case record updated.");
    } finally {
      setWorking(false);
    }
  }

  async function addEvidence(event: React.FormEvent) {
    event.preventDefault();
    if (!detail?.case) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/trust-safety/cases", {
        method: "POST",
        body: JSON.stringify({
          operation: "add_evidence",
          caseId: detail.case.id,
          ...evidenceForm,
        }),
      });
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to add the evidence reference."));
        return;
      }
      setEvidenceForm({
        evidenceType: "platform_record",
        sourceSystem: "Loombus",
        sourceTable: "",
        sourceRecordId: "",
        storageReference: "",
        existingHash: "",
        originalTimestamp: "",
        collectionPurpose: "",
        minimumNecessaryJustification: "",
        preservationStatus: "referenced",
      });
      await loadDetail(detail.case.id);
      setMessage("Evidence reference added without copying raw media.");
    } finally {
      setWorking(false);
    }
  }

  async function addEvent(event: React.FormEvent) {
    event.preventDefault();
    if (!detail?.case) return;
    setWorking(true);
    setMessage("");
    try {
      const response = await authorizedFetch("/api/admin/trust-safety/cases", {
        method: "POST",
        body: JSON.stringify({
          operation: "add_event",
          caseId: detail.case.id,
          ...eventForm,
        }),
      });
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to append the handling event."));
        return;
      }
      setEventForm({
        eventType: "handling",
        action: "",
        purpose: "",
        previousLocation: "",
        newLocation: "",
      });
      await loadDetail(detail.case.id);
      setMessage("Append-only handling event recorded.");
    } finally {
      setWorking(false);
    }
  }

  if (restricted) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className={`${panelClass} p-8`}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Restricted workspace
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-950 dark:text-white">
            Admin access is required
          </h1>
          <p className="mt-3 text-zinc-600 dark:text-zinc-400">
            Trust and Safety case records are available only through authorized administrator access.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-6 text-zinc-950 dark:bg-black dark:text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
              Internal restricted system
            </p>
            <h1 className="mt-1 text-2xl font-semibold">Trust and Safety cases</h1>
            <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
              Case metadata, minimum-necessary evidence references, decisions, and append-only handling history. Do not store raw illegal material, personal passwords, or unnecessary sensitive data.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/reports"
              className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              Moderation reports
            </Link>
            <button
              type="button"
              onClick={() => setShowCreate((current) => !current)}
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-black hover:bg-amber-400"
            >
              {showCreate ? "Close form" : "Create case"}
            </button>
          </div>
        </header>

        {message ? (
          <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            {message}
          </div>
        ) : null}

        {showCreate ? (
          <form onSubmit={createCase} className={`${panelClass} mb-6 grid gap-4 p-5 lg:grid-cols-4`}>
            <label className={labelClass}>
              Severity
              <select
                className={fieldClass}
                value={newCase.severity}
                onChange={(event) => setNewCase((current) => ({ ...current, severity: event.target.value }))}
              >
                {SEVERITIES.map((value) => <option key={value}>{value}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Category
              <select
                className={fieldClass}
                value={newCase.primaryCategory}
                onChange={(event) => setNewCase((current) => ({ ...current, primaryCategory: event.target.value }))}
              >
                {CATEGORIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Intake source
              <select
                className={fieldClass}
                value={newCase.sourceType}
                onChange={(event) => setNewCase((current) => ({ ...current, sourceType: event.target.value }))}
              >
                {SOURCE_TYPES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              Source ID
              <input
                className={fieldClass}
                value={newCase.sourceId}
                onChange={(event) => setNewCase((current) => ({ ...current, sourceId: event.target.value }))}
                placeholder="Report, queue, or email reference"
              />
            </label>
            <label className={`${labelClass} lg:col-span-3`}>
              Case summary
              <textarea
                className={`${fieldClass} min-h-24`}
                required
                minLength={10}
                value={newCase.summary}
                onChange={(event) => setNewCase((current) => ({ ...current, summary: event.target.value }))}
                placeholder="Neutral summary. Keep allegations separate from observed facts."
              />
            </label>
            <label className={labelClass}>
              Target references JSON
              <textarea
                className={`${fieldClass} min-h-24 font-mono text-xs`}
                value={newCase.targetRefs}
                onChange={(event) => setNewCase((current) => ({ ...current, targetRefs: event.target.value }))}
              />
            </label>
            <div className="lg:col-span-4 flex justify-end">
              <button disabled={working} className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">
                Create restricted case
              </button>
            </div>
          </form>
        ) : null}

        <section className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
          <aside className={`${panelClass} h-fit overflow-hidden lg:sticky lg:top-4`}>
            <div className="grid gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
              <input className={fieldClass} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cases" />
              <div className="grid grid-cols-2 gap-2">
                <select className={fieldClass} value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)}>
                  <option value="">All severities</option>
                  {SEVERITIES.map((value) => <option key={value}>{value}</option>)}
                </select>
                <select className={fieldClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All statuses</option>
                  {STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => void loadCases()} className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                Refresh queue
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-2">
              {loading ? <p className="p-4 text-sm text-zinc-500">Loading cases...</p> : null}
              {!loading && visibleCases.length === 0 ? <p className="p-4 text-sm text-zinc-500">No cases match this view.</p> : null}
              {visibleCases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void chooseCase(item.id)}
                  className={`mb-2 w-full rounded-xl border p-3 text-left transition ${selectedId === item.id ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30" : "border-transparent hover:border-zinc-300 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm">{item.case_number}</strong>
                    <span className="rounded-full border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">{item.severity}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-300">{item.summary}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                    <span>{titleCase(item.status)}</span>
                    <span>{formatDate(item.updated_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="grid min-w-0 gap-5">
            {!detail && !detailLoading ? (
              <div className={`${panelClass} p-8 text-center text-zinc-500`}>Select or create a case.</div>
            ) : null}
            {detailLoading ? <div className={`${panelClass} p-8 text-center text-zinc-500`}>Opening case and recording authorized access...</div> : null}
            {detail && !detailLoading ? (
              <>
                <form onSubmit={saveCase} className={`${panelClass} grid gap-5 p-5`}>
                  <div className="flex flex-col gap-3 border-b border-zinc-200 pb-4 dark:border-zinc-800 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">{detail.case.case_number}</p>
                      <h2 className="mt-1 text-xl font-semibold">Case record</h2>
                      <p className="mt-1 text-sm text-zinc-500">Created {formatDate(detail.case.created_at)} · Updated {formatDate(detail.case.updated_at)}</p>
                    </div>
                    <div className="text-xs text-zinc-500 sm:text-right">
                      <p>Source: {titleCase(detail.case.source_type)}</p>
                      <p>Source ID: {detail.case.source_id ?? "Not recorded"}</p>
                      <p>Assigned role record: {detail.case.assigned_to ? "Assigned" : "Unassigned"}</p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className={labelClass}>Severity<select className={fieldClass} value={editor.severity} onChange={(event) => setEditor((current) => ({ ...current, severity: event.target.value }))}>{SEVERITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
                    <label className={labelClass}>Status<select className={fieldClass} value={editor.status} onChange={(event) => setEditor((current) => ({ ...current, status: event.target.value }))}>{STATUSES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
                    <label className={labelClass}>Category<select className={fieldClass} value={editor.primaryCategory} onChange={(event) => setEditor((current) => ({ ...current, primaryCategory: event.target.value }))}>{CATEGORIES.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}</select></label>
                  </div>

                  <label className={labelClass}>Summary<textarea className={`${fieldClass} min-h-24`} minLength={10} required value={editor.summary} onChange={(event) => setEditor((current) => ({ ...current, summary: event.target.value }))} /></label>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <label className={labelClass}>Reported risk<textarea className={`${fieldClass} min-h-28`} value={editor.reportedRisk} onChange={(event) => setEditor((current) => ({ ...current, reportedRisk: event.target.value }))} placeholder="What was alleged or reported." /></label>
                    <label className={labelClass}>Directly observed facts<textarea className={`${fieldClass} min-h-28`} value={editor.observedFacts} onChange={(event) => setEditor((current) => ({ ...current, observedFacts: event.target.value }))} /></label>
                    <label className={labelClass}>Unresolved facts<textarea className={`${fieldClass} min-h-28`} value={editor.unresolvedFacts} onChange={(event) => setEditor((current) => ({ ...current, unresolvedFacts: event.target.value }))} /></label>
                    <label className={labelClass}>Reviewer inference<textarea className={`${fieldClass} min-h-28`} value={editor.reviewerInference} onChange={(event) => setEditor((current) => ({ ...current, reviewerInference: event.target.value }))} placeholder="Keep inference distinct from observed facts." /></label>
                    <label className={labelClass}>Containment summary<textarea className={`${fieldClass} min-h-28`} value={editor.containmentSummary} onChange={(event) => setEditor((current) => ({ ...current, containmentSummary: event.target.value }))} /></label>
                    <label className={labelClass}>Decision<textarea className={`${fieldClass} min-h-28`} value={editor.decision} onChange={(event) => setEditor((current) => ({ ...current, decision: event.target.value }))} /></label>
                    <label className={labelClass}>Decision rationale<textarea className={`${fieldClass} min-h-28`} value={editor.decisionRationale} onChange={(event) => setEditor((current) => ({ ...current, decisionRationale: event.target.value }))} /></label>
                    <label className={labelClass}>External escalation status<textarea className={`${fieldClass} min-h-28`} value={editor.externalEscalationStatus} onChange={(event) => setEditor((current) => ({ ...current, externalEscalationStatus: event.target.value }))} placeholder="Record routing without attaching sensitive evidence." /></label>
                    <label className={labelClass}>Member notice decision<textarea className={`${fieldClass} min-h-28`} value={editor.memberNoticeDecision} onChange={(event) => setEditor((current) => ({ ...current, memberNoticeDecision: event.target.value }))} /></label>
                    <label className={labelClass}>Preservation status<textarea className={`${fieldClass} min-h-28`} value={editor.preservationStatus} onChange={(event) => setEditor((current) => ({ ...current, preservationStatus: event.target.value }))} placeholder="No unsupported retention deadline." /></label>
                  </div>
                  <label className={labelClass}>Target references JSON<textarea className={`${fieldClass} min-h-32 font-mono text-xs`} value={editor.targetRefs} onChange={(event) => setEditor((current) => ({ ...current, targetRefs: event.target.value }))} /></label>
                  <div className="flex justify-end"><button disabled={working} className="rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-black">Save case record</button></div>
                </form>

                <section className={`${panelClass} p-5`}>
                  <h2 className="text-lg font-semibold">Evidence references</h2>
                  <p className="mt-1 text-sm text-zinc-500">Reference existing platform records, hashes, or storage identifiers. Do not copy raw illegal or traumatic media into this workspace.</p>
                  <div className="mt-4 grid gap-3">
                    {detail.evidence.length === 0 ? <p className="text-sm text-zinc-500">No evidence references recorded.</p> : detail.evidence.map((item) => (
                      <article key={item.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{titleCase(item.evidence_type)}</strong><span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span></div>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div><dt className="text-zinc-500">Source</dt><dd>{item.source_system}{item.source_table ? ` · ${item.source_table}` : ""}</dd></div>
                          <div><dt className="text-zinc-500">Record ID</dt><dd className="break-all">{item.source_record_id ?? "Not recorded"}</dd></div>
                          <div><dt className="text-zinc-500">Storage reference</dt><dd className="break-all">{item.storage_reference ?? "Not recorded"}</dd></div>
                          <div><dt className="text-zinc-500">Existing hash</dt><dd className="break-all">{item.existing_hash ?? "Not recorded"}</dd></div>
                          <div><dt className="text-zinc-500">Purpose</dt><dd>{item.collection_purpose}</dd></div>
                          <div><dt className="text-zinc-500">Minimum necessary</dt><dd>{item.minimum_necessary_justification}</dd></div>
                        </dl>
                      </article>
                    ))}
                  </div>
                  <form onSubmit={addEvidence} className="mt-5 grid gap-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700 md:grid-cols-2">
                    <label className={labelClass}>Evidence type<input className={fieldClass} value={evidenceForm.evidenceType} onChange={(event) => setEvidenceForm((current) => ({ ...current, evidenceType: event.target.value }))} /></label>
                    <label className={labelClass}>Source system<input className={fieldClass} value={evidenceForm.sourceSystem} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceSystem: event.target.value }))} /></label>
                    <label className={labelClass}>Source table<input className={fieldClass} value={evidenceForm.sourceTable} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceTable: event.target.value }))} /></label>
                    <label className={labelClass}>Source record ID<input className={fieldClass} value={evidenceForm.sourceRecordId} onChange={(event) => setEvidenceForm((current) => ({ ...current, sourceRecordId: event.target.value }))} /></label>
                    <label className={labelClass}>Storage reference<input className={fieldClass} value={evidenceForm.storageReference} onChange={(event) => setEvidenceForm((current) => ({ ...current, storageReference: event.target.value }))} /></label>
                    <label className={labelClass}>Existing hash<input className={fieldClass} value={evidenceForm.existingHash} onChange={(event) => setEvidenceForm((current) => ({ ...current, existingHash: event.target.value }))} /></label>
                    <label className={labelClass}>Original timestamp<input className={fieldClass} type="datetime-local" value={evidenceForm.originalTimestamp} onChange={(event) => setEvidenceForm((current) => ({ ...current, originalTimestamp: event.target.value }))} /></label>
                    <label className={labelClass}>Preservation status<input className={fieldClass} value={evidenceForm.preservationStatus} onChange={(event) => setEvidenceForm((current) => ({ ...current, preservationStatus: event.target.value }))} /></label>
                    <label className={labelClass}>Collection purpose<textarea className={`${fieldClass} min-h-20`} required minLength={5} value={evidenceForm.collectionPurpose} onChange={(event) => setEvidenceForm((current) => ({ ...current, collectionPurpose: event.target.value }))} /></label>
                    <label className={labelClass}>Minimum-necessary justification<textarea className={`${fieldClass} min-h-20`} required minLength={5} value={evidenceForm.minimumNecessaryJustification} onChange={(event) => setEvidenceForm((current) => ({ ...current, minimumNecessaryJustification: event.target.value }))} /></label>
                    <div className="md:col-span-2 flex justify-end"><button disabled={working} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Add evidence reference</button></div>
                  </form>
                </section>

                <section className={`${panelClass} p-5`}>
                  <h2 className="text-lg font-semibold">Append-only handling history</h2>
                  <p className="mt-1 text-sm text-zinc-500">Authorized access, case changes, evidence references, routing, and handling actions are recorded as immutable events.</p>
                  <form onSubmit={addEvent} className="mt-4 grid gap-3 rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700 md:grid-cols-2">
                    <label className={labelClass}>Event type<select className={fieldClass} value={eventForm.eventType} onChange={(event) => setEventForm((current) => ({ ...current, eventType: event.target.value }))}><option value="handling">Handling</option><option value="note">Note</option><option value="specialist_routing">Specialist routing</option></select></label>
                    <label className={labelClass}>Action<input className={fieldClass} required minLength={2} value={eventForm.action} onChange={(event) => setEventForm((current) => ({ ...current, action: event.target.value }))} placeholder="Example: escalated_to_privacy" /></label>
                    <label className={labelClass}>Purpose<textarea className={`${fieldClass} min-h-20`} value={eventForm.purpose} onChange={(event) => setEventForm((current) => ({ ...current, purpose: event.target.value }))} /></label>
                    <label className={labelClass}>Previous location<input className={fieldClass} value={eventForm.previousLocation} onChange={(event) => setEventForm((current) => ({ ...current, previousLocation: event.target.value }))} /></label>
                    <label className={labelClass}>New location<input className={fieldClass} value={eventForm.newLocation} onChange={(event) => setEventForm((current) => ({ ...current, newLocation: event.target.value }))} /></label>
                    <div className="flex items-end justify-end"><button disabled={working} className="rounded-xl border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900">Append event</button></div>
                  </form>
                  <div className="mt-5 grid gap-3">
                    {detail.events.map((item) => (
                      <article key={item.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                        <div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">{titleCase(item.action)}</strong><span className="ml-2 rounded-full border border-zinc-300 px-2 py-0.5 text-xs text-zinc-500 dark:border-zinc-700">{titleCase(item.event_type)}</span></div><span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span></div>
                        {item.purpose ? <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{item.purpose}</p> : null}
                        {Object.keys(item.details ?? {}).length ? <pre className="mt-3 overflow-x-auto rounded-lg bg-zinc-100 p-3 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">{JSON.stringify(item.details, null, 2)}</pre> : null}
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
