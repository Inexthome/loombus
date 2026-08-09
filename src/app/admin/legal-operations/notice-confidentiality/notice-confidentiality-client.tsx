"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_requests: boolean;
  can_review_notice_confidentiality: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type PhaseState = {
  draftDecisionMetadataOnly: boolean;
  finalLegalApprovalEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
  confidentialityReleaseEnabled: boolean;
  exportEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  externalTransmissionEnabled: boolean;
};

type NoticeRequestRow = {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  counsel_review_status: string;
  notice_confidentiality_review_status: string;
  notice_confidentiality_revision: number;
  updated_at: string;
  confidentiality_notes?: string | null;
  member_notice_decision?: string | null;
  delayed_notice_basis?: string | null;
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
    window.location.href =
      "/login?next=%2Fadmin%2Flegal-operations%2Fnotice-confidentiality";
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
      "/login?next=%2Fadmin%2Flegal-operations%2Fnotice-confidentiality";
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

export default function NoticeConfidentialityClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<PhaseState | null>(null);
  const [requests, setRequests] = useState<NoticeRequestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<NoticeRequestRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");

  const [editor, setEditor] = useState({
    reviewStatus: "unreviewed",
    confidentialityNotes: "",
    memberNoticeDecision: "",
    delayedNoticeBasis: "",
  });

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        "/api/admin/legal-operations/notice-confidentiality"
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(
          await responseMessage(response, "Unable to load notice/confidentiality review.")
        );
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        requests: NoticeRequestRow[];
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
        `/api/admin/legal-operations/notice-confidentiality?requestId=${encodeURIComponent(requestId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(
          await responseMessage(response, "Unable to load notice/confidentiality metadata.")
        );
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        request: NoticeRequestRow;
        phase: PhaseState;
      };
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setDetail(body.request);
      setEditor({
        reviewStatus: body.request.notice_confidentiality_review_status,
        confidentialityNotes: body.request.confidentiality_notes ?? "",
        memberNoticeDecision: body.request.member_notice_decision ?? "",
        delayedNoticeBasis: body.request.delayed_notice_basis ?? "",
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
      const response = await authorizedFetch(
        "/api/admin/legal-operations/notice-confidentiality",
        {
          method: "POST",
          body: JSON.stringify({
            operation: "update_notice_confidentiality_draft",
            requestId: selectedId,
            ...editor,
          }),
        }
      );

      if (!response.ok) {
        setMessage(
          await responseMessage(response, "Unable to update notice/confidentiality draft.")
        );
        return;
      }

      await Promise.all([loadDetail(selectedId), loadList()]);
      setMessage("Draft notice/confidentiality decision metadata updated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update notice/confidentiality draft."
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
            Notice & Confidentiality Review
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires platform administrator status, an active Legal Operations
            authorization, can_review_requests, and the dedicated
            can_review_notice_confidentiality capability. This capability does not grant
            final notice approval or notice sending.
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
            Notice & Confidentiality Review
          </h1>
          <p className="mt-2 max-w-3xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Record draft-only confidentiality notes, a draft member-notice recommendation,
            and a draft delayed-notice basis. These fields are internal decision metadata,
            not final legal approval and not a notice-delivery workflow.
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
        Final legal approval, member notice sending, confidentiality release, export,
        disclosure approval, emergency approval, and external transmission are disabled.
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
              {authorization?.can_review_notice_confidentiality ? "Review enabled" : "Review disabled"}
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
                    {titleCase(row.notice_confidentiality_review_status)}
                  </span>
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                  {titleCase(row.request_type)} · {titleCase(row.status)}
                </div>
                <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
                  Revision {row.notice_confidentiality_revision} · updated {formatDate(row.updated_at)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedId ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Select a legal request to review draft notice/confidentiality decision metadata.
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
                  <div className="text-right text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                    <div>Counsel: {titleCase(detail.counsel_review_status)}</div>
                    <div>Draft revision: {detail.notice_confidentiality_revision}</div>
                  </div>
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                  Draft decision metadata
                </h3>
                <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                  Keep entries minimum-necessary. Do not paste responsive records, member
                  messages, attachments, evidence, or unrelated personal data.
                </p>

                <div className="mt-5 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--loombus-text-strong)" }}>
                    Review status
                    <select
                      className={fieldClass}
                      style={fieldStyle}
                      value={editor.reviewStatus}
                      onChange={(event) =>
                        setEditor({ ...editor, reviewStatus: event.target.value })
                      }
                    >
                      {REVIEW_STATUSES.map((value) => (
                        <option key={value} value={value}>
                          {titleCase(value)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <DraftField
                    label="Confidentiality notes"
                    value={editor.confidentialityNotes}
                    onChange={(value) => setEditor({ ...editor, confidentialityNotes: value })}
                  />
                  <DraftField
                    label="Draft member-notice recommendation"
                    value={editor.memberNoticeDecision}
                    onChange={(value) => setEditor({ ...editor, memberNoticeDecision: value })}
                  />
                  <DraftField
                    label="Draft delayed-notice basis"
                    value={editor.delayedNoticeBasis}
                    onChange={(value) => setEditor({ ...editor, delayedNoticeBasis: value })}
                  />
                </div>

                <button
                  className={`${buttonClass} mt-5`}
                  disabled={working}
                  type="button"
                  onClick={() => void saveDraft()}
                >
                  {working ? "Saving…" : "Save draft review"}
                </button>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                  Authority boundary
                </h3>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2" style={{ color: "var(--loombus-text-muted)" }}>
                  <State label="Notice/confidentiality review" enabled={Boolean(authorization?.can_review_notice_confidentiality)} />
                  <State label="General request review" enabled={Boolean(authorization?.can_review_requests)} />
                  <State label="Final legal approval" enabled={Boolean(phase?.finalLegalApprovalEnabled)} />
                  <State label="Member notice sending" enabled={Boolean(phase?.memberNoticeSendingEnabled)} />
                  <State label="Confidentiality release" enabled={Boolean(phase?.confidentialityReleaseEnabled)} />
                  <State label="Export authority" enabled={Boolean(authorization?.can_export)} />
                  <State label="Disclosure authority" enabled={Boolean(authorization?.can_disclose)} />
                  <State label="Emergency approval" enabled={Boolean(authorization?.can_approve_emergency)} />
                  <State label="External transmission" enabled={Boolean(phase?.externalTransmissionEnabled)} />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function DraftField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium" style={{ color: "var(--loombus-text-strong)" }}>
      {label}
      <textarea
        className={fieldClass}
        style={fieldStyle}
        rows={4}
        maxLength={4000}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-right text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
        {value.length}/4000
      </span>
    </label>
  );
}

function State({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border px-3 py-2" style={{ borderColor: "var(--loombus-border)" }}>
      <span>{label}</span>
      <span className={enabled ? "font-semibold text-emerald-600" : "font-semibold text-zinc-500"}>
        {enabled ? "Enabled" : "Disabled"}
      </span>
    </div>
  );
}
