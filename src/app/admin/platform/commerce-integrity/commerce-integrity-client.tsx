"use client";

import Link from "next/link";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  COMMERCE_CATEGORY_IDS,
  COMMERCE_INTEGRITY_CATEGORIES,
  COMMERCE_INTEGRITY_TAXONOMY_VERSION,
} from "@/lib/commerce-integrity-taxonomy";
import { supabase } from "@/lib/supabase/client";

const REVIEW_MODULES = [
  ["marketplace", "Marketplace"],
  ["businesses", "Businesses"],
  ["services", "Services"],
  ["requests", "Requests"],
  ["jobs", "Jobs"],
  ["events", "Events"],
  ["appointments", "Appointments"],
] as const;

type ReviewModule = (typeof REVIEW_MODULES)[number][0];
type AccessState = "checking" | "allowed" | "denied" | "error";
type HistoryRow = {
  id: string;
  taxonomy_version: string;
  source_module: string;
  source_record_type: string;
  source_record_id: string;
  source_report_type: string | null;
  source_report_id: string | null;
  commerce_category_id: string;
  primary_safety_reason_code: string;
  secondary_safety_reason_codes: string[];
  policy_severity_code: string | null;
  record_state: string;
  classification_source: string;
  basis_note: string;
  classified_by: string;
  classified_at: string;
  supersedes_classification_id: string | null;
  trust_safety_case_id: string | null;
};

type HistoryPayload = {
  isAdmin: boolean;
  taxonomyVersion: string;
  module: ReviewModule;
  sourceRecordType: string;
  sourceReportType: string | null;
  currentHead: HistoryRow | null;
  history: HistoryRow[];
};

type ApiError = {
  error?: unknown;
  code?: unknown;
};

const inputClass =
  "mt-2 w-full rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] px-4 py-3 text-sm outline-none transition focus:border-[var(--loombus-gold)] focus:ring-2 focus:ring-[var(--loombus-gold-soft)]";
const panelClass =
  "rounded-[1.6rem] border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-5 shadow-xl shadow-black/5 sm:p-6";

function readableError(payload: ApiError, fallback: string) {
  return typeof payload.error === "string" ? payload.error : fallback;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : value;
}

export default function CommerceIntegrityClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [token, setToken] = useState("");
  const [moduleKey, setModuleKey] = useState<ReviewModule>("marketplace");
  const [recordId, setRecordId] = useState("");
  const [reportId, setReportId] = useState("");
  const [categoryId, setCategoryId] = useState("COM-01");
  const [primaryReason, setPrimaryReason] = useState("");
  const [secondaryReasons, setSecondaryReasons] = useState<string[]>([]);
  const [policySeverity, setPolicySeverity] = useState("");
  const [recordState, setRecordState] = useState<"proposed" | "confirmed">(
    "proposed",
  );
  const [basisNote, setBasisNote] = useState("");
  const [trustSafetyCaseId, setTrustSafetyCaseId] = useState("");
  const [historyPayload, setHistoryPayload] = useState<HistoryPayload | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const categoryOptions = useMemo(
    () =>
      COMMERCE_CATEGORY_IDS.filter(
        (id) =>
          COMMERCE_INTEGRITY_CATEGORIES[id].moduleApplicability[moduleKey] !==
          "not_applicable",
      ),
    [moduleKey],
  );

  const selectedCategory = COMMERCE_INTEGRITY_CATEGORIES[
    categoryId as keyof typeof COMMERCE_INTEGRITY_CATEGORIES
  ];
  const reasonOptions = selectedCategory?.safetyReasonCodes ?? [];
  const severeConfirmed =
    recordState === "confirmed" &&
    (policySeverity === "POLICY.S4" || policySeverity === "POLICY.S5");
  const reportSupported = moduleKey !== "appointments";

  useEffect(() => {
    let active = true;

    async function start() {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;

      if (sessionError) {
        setError(sessionError.message);
        setAccessState("error");
        return;
      }

      const nextToken = data.session?.access_token ?? "";
      if (!nextToken) {
        window.location.replace(
          `/login?next=${encodeURIComponent("/admin/platform/commerce-integrity")}`,
        );
        return;
      }

      setToken(nextToken);
      setAccessState("allowed");
    }

    void start();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const firstCategory = categoryOptions[0] ?? "COM-01";
    setCategoryId(firstCategory);
    setHistoryPayload(null);
    setReportId("");
    setAcknowledged(false);
  }, [categoryOptions, moduleKey]);

  useEffect(() => {
    const nextReasons = COMMERCE_INTEGRITY_CATEGORIES[
      categoryId as keyof typeof COMMERCE_INTEGRITY_CATEGORIES
    ]?.safetyReasonCodes;
    setPrimaryReason(nextReasons?.[0] ?? "");
    setSecondaryReasons([]);
  }, [categoryId]);

  async function apiGet(url: string) {
    const result = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const payload = (await result.json().catch(() => ({}))) as ApiError;
    if (!result.ok) {
      if (result.status === 403) setAccessState("denied");
      throw new Error(readableError(payload, "The reviewer request failed."));
    }
    return payload as unknown as HistoryPayload;
  }

  async function loadHistory() {
    if (!token || !recordId.trim()) return;
    setLoadingHistory(true);
    setMessage("");
    setError("");

    try {
      const payload = await apiGet(
        `/api/admin/platform/commerce-integrity?module=${encodeURIComponent(moduleKey)}&recordId=${encodeURIComponent(recordId.trim())}`,
      );
      setHistoryPayload(payload);
      setMessage(
        payload.currentHead
          ? "Existing classification history loaded. A new classification must explicitly supersede the current head."
          : "No existing commerce-integrity classification was found for this source record.",
      );
    } catch (caught) {
      setHistoryPayload(null);
      setError(caught instanceof Error ? caught.message : "History could not load.");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function submitClassification() {
    if (!token || submitting) return;
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const result = await fetch("/api/admin/platform/commerce-integrity", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          module: moduleKey,
          sourceRecordId: recordId.trim(),
          sourceReportId: reportSupported ? reportId.trim() || null : null,
          categoryId,
          primarySafetyReasonCode: primaryReason,
          secondarySafetyReasonCodes: secondaryReasons,
          policySeverityCode: policySeverity || null,
          recordState,
          basisNote: basisNote.trim(),
          supersedesClassificationId: historyPayload?.currentHead?.id ?? null,
          trustSafetyCaseId: trustSafetyCaseId.trim() || null,
        }),
      });
      const payload = (await result.json().catch(() => ({}))) as ApiError & {
        classificationId?: string;
      };

      if (!result.ok) {
        throw new Error(
          readableError(payload, "The classification could not be created."),
        );
      }

      setMessage(
        `Classification ${payload.classificationId ?? ""} was recorded without changing the source record, report status, enforcement, notice, or external-action state.`,
      );
      setBasisNote("");
      setAcknowledged(false);
      await loadHistory();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The classification could not be created.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSecondary(reason: string) {
    setSecondaryReasons((current) =>
      current.includes(reason)
        ? current.filter((item) => item !== reason)
        : [...current, reason],
    );
  }

  if (accessState === "checking") {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className={panelClass}>Verifying administrator access...</div>
      </main>
    );
  }

  if (accessState === "denied") {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className={panelClass}>
          <h1 className="text-2xl font-semibold">Administrator access required</h1>
          <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
            This manual classification workspace is restricted to the existing
            Loombus administrator role.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">
            Platform Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Commerce integrity review</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
            Record a human reviewer conclusion under {COMMERCE_INTEGRITY_TAXONOMY_VERSION}.
            This workspace does not resolve reports, moderate source records, create
            enforcement, send notices, or trigger external actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/platform"
            className="rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold"
          >
            Platform Operations
          </Link>
          <Link
            href={`/admin/platform/${moduleKey}`}
            className="rounded-full bg-[var(--loombus-gold)] px-4 py-2 text-sm font-semibold text-[var(--loombus-gold-contrast)]"
          >
            Open {REVIEW_MODULES.find(([key]) => key === moduleKey)?.[1]}
          </Link>
        </div>
      </div>

      {message ? (
        <div className="mb-5 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mb-5 rounded-2xl border border-red-500/25 bg-red-500/10 p-4 text-sm" role="alert">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <section className={panelClass}>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-1 text-[var(--loombus-gold)]" size={20} />
            <div>
              <h2 className="text-xl font-semibold">Manual classification</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                Use exact source identifiers from the existing Platform Operations
                module. Original allegations and evidence remain in their source system.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Source module
              <select
                className={inputClass}
                value={moduleKey}
                onChange={(event) => setModuleKey(event.target.value as ReviewModule)}
              >
                {REVIEW_MODULES.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold">
              Source record UUID
              <input
                className={inputClass}
                value={recordId}
                onChange={(event) => {
                  setRecordId(event.target.value);
                  setHistoryPayload(null);
                }}
                placeholder="00000000-0000-0000-0000-000000000000"
              />
            </label>
          </div>

          {reportSupported ? (
            <label className="mt-4 block text-sm font-semibold">
              Optional source report UUID
              <input
                className={inputClass}
                value={reportId}
                onChange={(event) => setReportId(event.target.value)}
                placeholder="Leave blank when classification is not tied to a report"
              />
            </label>
          ) : (
            <div className="mt-4 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-[var(--loombus-text-muted)]">
              Appointment cancellation and scheduling reasons are operational context,
              not report classifications. This source does not accept a report UUID.
            </div>
          )}

          <button
            type="button"
            onClick={() => void loadHistory()}
            disabled={!recordId.trim() || loadingHistory}
            className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            <RefreshCw size={15} className={loadingHistory ? "animate-spin" : ""} />
            Load classification history
          </button>

          <label className="mt-6 block text-sm font-semibold">
            Canonical category
            <select
              className={inputClass}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categoryOptions.map((id) => (
                <option key={id} value={id}>
                  {id} · {COMMERCE_INTEGRITY_CATEGORIES[id].title}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm font-semibold">
            Primary canonical safety reason
            <select
              className={inputClass}
              value={primaryReason}
              onChange={(event) => {
                setPrimaryReason(event.target.value);
                setSecondaryReasons((current) =>
                  current.filter((item) => item !== event.target.value),
                );
              }}
            >
              {reasonOptions.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </select>
          </label>

          {reasonOptions.length > 1 ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">Optional secondary reasons</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {reasonOptions
                  .filter((reason) => reason !== primaryReason)
                  .map((reason) => (
                    <label
                      key={reason}
                      className="flex items-start gap-2 rounded-xl border border-[var(--loombus-border)] p-3 text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={secondaryReasons.includes(reason)}
                        onChange={() => toggleSecondary(reason)}
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Review state
              <select
                className={inputClass}
                value={recordState}
                onChange={(event) =>
                  setRecordState(event.target.value as "proposed" | "confirmed")
                }
              >
                <option value="proposed">Proposed</option>
                <option value="confirmed">Confirmed</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Policy severity
              <select
                className={inputClass}
                value={policySeverity}
                onChange={(event) => setPolicySeverity(event.target.value)}
              >
                <option value="">Not assigned</option>
                {[0, 1, 2, 3, 4, 5].map((level) => (
                  <option key={level} value={`POLICY.S${level}`}>
                    POLICY.S{level}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {severeConfirmed ? (
            <label className="mt-4 block text-sm font-semibold">
              Existing Trust and Safety case UUID
              <input
                className={inputClass}
                value={trustSafetyCaseId}
                onChange={(event) => setTrustSafetyCaseId(event.target.value)}
                placeholder="Required for confirmed POLICY.S4 or POLICY.S5"
              />
            </label>
          ) : null}

          <label className="mt-4 block text-sm font-semibold">
            Reviewer basis
            <textarea
              className={inputClass}
              rows={5}
              maxLength={6000}
              value={basisNote}
              onChange={(event) => setBasisNote(event.target.value)}
              placeholder="State the reviewed facts and policy basis without copying unnecessary sensitive evidence."
            />
          </label>

          {historyPayload?.currentHead ? (
            <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
              A current classification already exists. Submitting this form will create
              a new append-only row that supersedes classification
              <code className="ml-1 break-all">{historyPayload.currentHead.id}</code>.
            </div>
          ) : null}

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-[var(--loombus-border)] p-4 text-sm">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
            />
            <span>
              I reviewed this source manually. This classification is a policy-review
              record only and does not itself establish illegality, resolve a report,
              take enforcement action, send notice, or authorize external contact.
            </span>
          </label>

          <button
            type="button"
            onClick={() => void submitClassification()}
            disabled={
              submitting ||
              !acknowledged ||
              !recordId.trim() ||
              basisNote.trim().length < 5 ||
              !primaryReason ||
              (severeConfirmed && !trustSafetyCaseId.trim())
            }
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[var(--loombus-gold)] px-5 py-3 text-sm font-semibold text-[var(--loombus-gold-contrast)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCircle2 size={16} />
            {submitting ? "Recording..." : historyPayload?.currentHead ? "Supersede current classification" : "Record classification"}
          </button>
        </section>

        <aside className="space-y-5">
          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Current source history</h2>
            <p className="mt-2 text-sm text-[var(--loombus-text-muted)]">
              Load a source UUID before recording a decision. This prevents the form
              from silently creating a parallel classification head.
            </p>
            {!historyPayload ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[var(--loombus-border)] p-5 text-sm text-[var(--loombus-text-muted)]">
                No history loaded.
              </div>
            ) : historyPayload.history.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-[var(--loombus-border)] p-5 text-sm">
                No prior classification exists for this source.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {historyPayload.history.map((row) => (
                  <article
                    key={row.id}
                    className="rounded-2xl border border-[var(--loombus-border)] bg-[var(--loombus-page-bg)] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <strong>{row.commerce_category_id}</strong>
                      <span>{row.record_state}</span>
                      {row.policy_severity_code ? <span>{row.policy_severity_code}</span> : null}
                    </div>
                    <p className="mt-2 break-words text-xs font-semibold">
                      {row.primary_safety_reason_code}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
                      {row.basis_note}
                    </p>
                    <div className="mt-3 space-y-1 text-xs text-[var(--loombus-text-subtle)]">
                      <p>Classification: {row.id}</p>
                      <p>Reviewer: {row.classified_by}</p>
                      <p>Recorded: {formatDate(row.classified_at)}</p>
                      {row.supersedes_classification_id ? (
                        <p>Supersedes: {row.supersedes_classification_id}</p>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={panelClass}>
            <h2 className="text-lg font-semibold">Phase D boundaries</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--loombus-text-muted)]">
              <li>Rooms: write-disabled.</li>
              <li>Private messages/conversations: write-disabled.</li>
              <li>Local: inherited-only, no direct classification.</li>
              <li>No AI or bulk historical classification.</li>
              <li>No report-resolution or source-moderation side effect.</li>
              <li>No enforcement, notice, disclosure, or external-action side effect.</li>
              <li>No legal conclusion is created by the classification record.</li>
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}
