"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_export: boolean;
};

type RequestSummary = {
  id: string;
  request_number: string;
  request_type: string;
  status: string;
  received_at: string;
  original_scope: string;
  narrowed_scope: string | null;
  requester_identity_status: string;
  authority_review_status: string;
  scope_review_status: string;
  counsel_review_status: string;
  cross_border_status: string;
};

type DisclosureRow = {
  id: string;
  request_id: string;
  disclosure_type: string;
  status: string;
  legal_basis_summary: string;
  scope_summary: string;
  recipient_organization: string;
  recipient_contact_ref: string | null;
  member_notice_decision: string | null;
  delayed_notice_basis: string | null;
  manifest_sha256: string | null;
  approved_by: string | null;
  approved_at: string | null;
  transmitted_by: string | null;
  transmitted_at: string | null;
  created_at: string;
  updated_at: string;
};

type DisclosureItem = {
  id: string;
  disclosure_id: string;
  resource_key: string | null;
  source_system: string;
  record_ref: string | null;
  field_names: string[];
  object_count: number;
  file_name: string | null;
  sha256: string | null;
  minimum_necessary_justification: string;
  created_at: string;
};

type DetailResponse = {
  authorization: Authorization;
  request: RequestSummary;
  disclosures: DisclosureRow[];
  items: DisclosureItem[];
};

const DISCLOSURE_TYPES = [
  "ordinary",
  "emergency",
  "preservation_ack",
  "ip_response",
  "regulatory",
  "other",
];

const EMPTY_DISCLOSURE = {
  disclosureType: "ordinary",
  legalBasisSummary: "",
  scopeSummary: "",
  recipientOrganization: "",
  recipientContactRef: "",
  memberNoticeDecision: "",
  delayedNoticeBasis: "",
};

const EMPTY_ITEM = {
  resourceKey: "",
  sourceSystem: "Loombus",
  recordRef: "",
  fieldNames: "",
  minimumNecessaryJustification: "",
};

const panel =
  "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950";
const field =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";
const label = "grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-300";
const button =
  "rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950";
const secondaryButton =
  "rounded-xl border border-zinc-300 px-3 py-2 text-sm font-semibold text-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-200";

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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fdisclosure-preparation";
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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fdisclosure-preparation";
    throw new Error("Authentication required.");
  }

  return response;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

function formFromDisclosure(disclosure: DisclosureRow) {
  return {
    disclosureType: disclosure.disclosure_type,
    legalBasisSummary: disclosure.legal_basis_summary,
    scopeSummary: disclosure.scope_summary,
    recipientOrganization: disclosure.recipient_organization,
    recipientContactRef: disclosure.recipient_contact_ref ?? "",
    memberNoticeDecision: disclosure.member_notice_decision ?? "",
    delayedNoticeBasis: disclosure.delayed_notice_basis ?? "",
  };
}

export default function DisclosurePreparationClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [selectedDisclosureId, setSelectedDisclosureId] = useState<string | null>(null);
  const [disclosureForm, setDisclosureForm] = useState(EMPTY_DISCLOSURE);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        "/api/admin/legal-operations/disclosure-preparation"
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load disclosure preparation."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        requests: RequestSummary[];
      };
      setRestricted(false);
      setAuthorization(body.authorization);
      setRequests(body.requests);
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (requestId: string) => {
    setDetailLoading(true);
    setMessage("");
    try {
      const response = await authorizedFetch(
        `/api/admin/legal-operations/disclosure-preparation?requestId=${encodeURIComponent(requestId)}`
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load disclosure preparation metadata."));
        return;
      }

      const body = (await response.json()) as DetailResponse;
      setAuthorization(body.authorization);
      setDetail(body);

      const current = body.disclosures.find((row) => row.id === selectedDisclosureId);
      if (current) {
        setDisclosureForm(formFromDisclosure(current));
      } else {
        setSelectedDisclosureId(null);
        setDisclosureForm(EMPTY_DISCLOSURE);
      }
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setDetailLoading(false);
    }
  }, [selectedDisclosureId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    if (selectedRequestId) void loadDetail(selectedRequestId);
  }, [loadDetail, selectedRequestId]);

  const itemsByDisclosure = useMemo(() => {
    const map = new Map<string, DisclosureItem[]>();
    for (const item of detail?.items ?? []) {
      map.set(item.disclosure_id, [...(map.get(item.disclosure_id) ?? []), item]);
    }
    return map;
  }, [detail?.items]);

  const selectedDisclosure = useMemo(
    () => detail?.disclosures.find((row) => row.id === selectedDisclosureId) ?? null,
    [detail?.disclosures, selectedDisclosureId]
  );

  async function post(payload: Record<string, unknown>) {
    const response = await authorizedFetch(
      "/api/admin/legal-operations/disclosure-preparation",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    if (!response.ok) {
      throw new Error(await responseMessage(response, "Disclosure preparation action failed."));
    }
    return response.json();
  }

  function beginNewDraft() {
    setSelectedDisclosureId(null);
    setDisclosureForm(EMPTY_DISCLOSURE);
    setItemForm(EMPTY_ITEM);
    setMessage("");
  }

  function selectDisclosure(disclosure: DisclosureRow) {
    setSelectedDisclosureId(disclosure.id);
    setDisclosureForm(formFromDisclosure(disclosure));
    setItemForm(EMPTY_ITEM);
    setMessage("");
  }

  async function saveDraft() {
    if (!selectedRequestId) return;
    setWorking(true);
    setMessage("");
    try {
      const operation = selectedDisclosureId
        ? "update_draft_disclosure"
        : "create_draft_disclosure";
      const body = (await post({
        operation,
        requestId: selectedRequestId,
        disclosureId: selectedDisclosureId,
        ...disclosureForm,
      })) as { disclosure: DisclosureRow };

      const saved = body.disclosure;
      setSelectedDisclosureId(saved.id);
      await loadDetail(selectedRequestId);
      setMessage(
        operation === "create_draft_disclosure"
          ? "Draft disclosure metadata created. No export was generated."
          : "Draft disclosure metadata updated. No approval state changed."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save disclosure draft.");
    } finally {
      setWorking(false);
    }
  }

  async function addManifestItem() {
    if (!selectedRequestId || !selectedDisclosureId) return;
    setWorking(true);
    setMessage("");
    try {
      const fieldNames = itemForm.fieldNames
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean);

      await post({
        operation: "add_manifest_item",
        requestId: selectedRequestId,
        disclosureId: selectedDisclosureId,
        resourceKey: itemForm.resourceKey,
        sourceSystem: itemForm.sourceSystem,
        recordRef: itemForm.recordRef,
        fieldNames,
        minimumNecessaryJustification: itemForm.minimumNecessaryJustification,
      });

      setItemForm(EMPTY_ITEM);
      await loadDetail(selectedRequestId);
      setMessage("Append-only least-data manifest item added. No source data was copied or exported.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add manifest item.");
    } finally {
      setWorking(false);
    }
  }

  if (restricted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className={panel}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-400">
            Restricted preparation workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 dark:text-zinc-100">
            Disclosure Preparation
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            This phase requires active Legal Operations authorization with the dedicated
            can_export capability. That capability permits preparation metadata only here;
            export generation, approval, member notice sending, and transmission remain disabled.
          </p>
          <Link
            className="mt-5 inline-block text-sm font-semibold text-amber-700 dark:text-amber-400"
            href="/admin/legal-operations"
          >
            Return to Legal Operations
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
            Internal only · Issue #674 · Preparation only
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-zinc-950 dark:text-zinc-100">
            Disclosure Preparation
          </h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Prepare draft disclosure-control metadata and an explicit least-data field manifest.
            Do not paste responsive content, message bodies, files, attachments, credentials, or
            exported records into this workspace.
          </p>
          <Link
            className="mt-3 inline-block text-sm font-semibold text-amber-700 dark:text-amber-400"
            href="/admin/legal-operations"
          >
            ← Legal Operations
          </Link>
        </div>
        <div className="text-right text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          <div>Role: {authorization ? titleCase(authorization.role) : "Loading"}</div>
          <div>Preparation authorization: {authorization?.can_export ? "enabled" : "disabled"}</div>
          <div>Export generation: disabled</div>
          <div>Approval and transmission: disabled</div>
        </div>
      </div>

      <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
        This control surface records intended fields and justification only. Manifest items are
        append-only and are stored with zero exported objects, no filename, no SHA-256 export hash,
        and no payload metadata.
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {message}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className={panel}>
          <h2 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">Legal requests</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-500">
            This list intentionally excludes requester contact details.
          </p>
          <div className="mt-4 grid gap-2">
            {loading ? <p className="text-sm text-zinc-500">Loading…</p> : null}
            {!loading && requests.length === 0 ? (
              <p className="text-sm text-zinc-500">No legal requests recorded.</p>
            ) : null}
            {requests.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setSelectedRequestId(row.id);
                  setSelectedDisclosureId(null);
                  setDisclosureForm(EMPTY_DISCLOSURE);
                  setItemForm(EMPTY_ITEM);
                }}
                className={`rounded-xl border p-3 text-left transition ${
                  selectedRequestId === row.id
                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                    : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                    {row.request_number}
                  </span>
                  <span className="text-xs text-zinc-500">{titleCase(row.status)}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  {titleCase(row.request_type)} · {formatDate(row.received_at)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selectedRequestId ? (
            <div className={panel}>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Select a legal request to prepare disclosure metadata. This does not create an
                export, approval, notice, or transmission.
              </p>
            </div>
          ) : detailLoading || !detail ? (
            <div className={panel}>
              <p className="text-sm text-zinc-500">Loading preparation metadata…</p>
            </div>
          ) : (
            <>
              <div className={panel}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-100">
                      {detail.request.request_number}
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500">
                      {titleCase(detail.request.request_type)} · {titleCase(detail.request.status)}
                    </p>
                  </div>
                  <button className={secondaryButton} type="button" onClick={beginNewDraft}>
                    New draft
                  </button>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Status label="Identity review" value={detail.request.requester_identity_status} />
                  <Status label="Authority review" value={detail.request.authority_review_status} />
                  <Status label="Scope review" value={detail.request.scope_review_status} />
                  <Status label="Counsel review" value={detail.request.counsel_review_status} />
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Working scope reference
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                      {detail.request.narrowed_scope ?? detail.request.original_scope}
                    </p>
                  </div>
                </div>
              </div>

              <div className={panel}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                    Draft disclosure metadata
                  </h3>
                  <span className="text-xs text-zinc-500">
                    {selectedDisclosureId ? "Editing existing draft" : "New draft"}
                  </span>
                </div>
                {selectedDisclosure && selectedDisclosure.status !== "draft" ? (
                  <p className="mt-3 rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                    This disclosure is not in draft status and is read-only in the preparation phase.
                  </p>
                ) : null}
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className={label}>
                    Disclosure type
                    <select
                      className={field}
                      value={disclosureForm.disclosureType}
                      disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                      onChange={(event) =>
                        setDisclosureForm({ ...disclosureForm, disclosureType: event.target.value })
                      }
                    >
                      {DISCLOSURE_TYPES.map((value) => (
                        <option key={value} value={value}>
                          {titleCase(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Intended recipient organization
                    <input
                      className={field}
                      value={disclosureForm.recipientOrganization}
                      disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                      onChange={(event) =>
                        setDisclosureForm({
                          ...disclosureForm,
                          recipientOrganization: event.target.value,
                        })
                      }
                    />
                  </label>
                  <TextArea
                    label="Legal-basis summary"
                    value={disclosureForm.legalBasisSummary}
                    disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                    onChange={(value) =>
                      setDisclosureForm({ ...disclosureForm, legalBasisSummary: value })
                    }
                  />
                  <TextArea
                    label="Narrow disclosure scope"
                    value={disclosureForm.scopeSummary}
                    disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                    onChange={(value) => setDisclosureForm({ ...disclosureForm, scopeSummary: value })}
                  />
                  <label className={label}>
                    Recipient contact reference
                    <input
                      className={field}
                      value={disclosureForm.recipientContactRef}
                      disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                      onChange={(event) =>
                        setDisclosureForm({
                          ...disclosureForm,
                          recipientContactRef: event.target.value,
                        })
                      }
                    />
                  </label>
                  <TextArea
                    label="Member notice decision metadata"
                    value={disclosureForm.memberNoticeDecision}
                    disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                    onChange={(value) =>
                      setDisclosureForm({ ...disclosureForm, memberNoticeDecision: value })
                    }
                  />
                  <TextArea
                    label="Delayed-notice basis metadata"
                    value={disclosureForm.delayedNoticeBasis}
                    disabled={Boolean(selectedDisclosure && selectedDisclosure.status !== "draft")}
                    onChange={(value) =>
                      setDisclosureForm({ ...disclosureForm, delayedNoticeBasis: value })
                    }
                  />
                </div>
                <button
                  className={`${button} mt-4`}
                  disabled={
                    working ||
                    Boolean(selectedDisclosure && selectedDisclosure.status !== "draft") ||
                    disclosureForm.legalBasisSummary.trim().length < 5 ||
                    disclosureForm.scopeSummary.trim().length < 5 ||
                    disclosureForm.recipientOrganization.trim().length < 2
                  }
                  type="button"
                  onClick={() => void saveDraft()}
                >
                  {selectedDisclosureId ? "Save draft metadata" : "Create draft metadata"}
                </button>
              </div>

              <div className={panel}>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                    Prepared disclosures
                  </h3>
                  <span className="text-xs text-zinc-500">{detail.disclosures.length} recorded</span>
                </div>
                <div className="mt-4 grid gap-3">
                  {detail.disclosures.length === 0 ? (
                    <p className="text-sm text-zinc-500">No disclosure drafts recorded.</p>
                  ) : null}
                  {detail.disclosures.map((disclosure) => {
                    const items = itemsByDisclosure.get(disclosure.id) ?? [];
                    return (
                      <button
                        key={disclosure.id}
                        type="button"
                        onClick={() => selectDisclosure(disclosure)}
                        className={`rounded-xl border p-4 text-left ${
                          selectedDisclosureId === disclosure.id
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                            : "border-zinc-200 dark:border-zinc-800"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                            {titleCase(disclosure.disclosure_type)} disclosure
                          </span>
                          <span className="text-xs text-zinc-500">
                            {titleCase(disclosure.status)} · {items.length} manifest item{items.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                          {disclosure.scope_summary}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          Recipient metadata: {disclosure.recipient_organization} · Updated {formatDate(disclosure.updated_at)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedDisclosure && selectedDisclosure.status === "draft" ? (
                <div className={panel}>
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                    Least-data manifest
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    Record only the intended source, record locator, explicit field names, and the
                    minimum-necessary justification. Wildcards such as * or all fields are rejected.
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className={label}>
                      Resource key
                      <input
                        className={field}
                        value={itemForm.resourceKey}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, resourceKey: event.target.value })
                        }
                      />
                    </label>
                    <label className={label}>
                      Source system
                      <input
                        className={field}
                        value={itemForm.sourceSystem}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, sourceSystem: event.target.value })
                        }
                      />
                    </label>
                    <label className={label}>
                      Record reference
                      <input
                        className={field}
                        value={itemForm.recordRef}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, recordRef: event.target.value })
                        }
                      />
                    </label>
                    <label className={label}>
                      Explicit field names
                      <textarea
                        className={field}
                        rows={4}
                        placeholder="field_one\nfield_two"
                        value={itemForm.fieldNames}
                        onChange={(event) =>
                          setItemForm({ ...itemForm, fieldNames: event.target.value })
                        }
                      />
                    </label>
                    <label className={`${label} md:col-span-2`}>
                      Minimum-necessary justification
                      <textarea
                        className={field}
                        rows={3}
                        value={itemForm.minimumNecessaryJustification}
                        onChange={(event) =>
                          setItemForm({
                            ...itemForm,
                            minimumNecessaryJustification: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <button
                    className={`${button} mt-4`}
                    disabled={
                      working ||
                      itemForm.sourceSystem.trim().length < 2 ||
                      itemForm.fieldNames.trim().length === 0 ||
                      itemForm.minimumNecessaryJustification.trim().length < 5 ||
                      (!itemForm.resourceKey.trim() && !itemForm.recordRef.trim())
                    }
                    type="button"
                    onClick={() => void addManifestItem()}
                  >
                    Add append-only manifest item
                  </button>

                  <div className="mt-5 grid gap-2">
                    {(itemsByDisclosure.get(selectedDisclosure.id) ?? []).length === 0 ? (
                      <p className="text-sm text-zinc-500">No manifest items recorded.</p>
                    ) : null}
                    {(itemsByDisclosure.get(selectedDisclosure.id) ?? []).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-zinc-200 px-3 py-3 dark:border-zinc-800"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {item.resource_key ?? "Resource"} · {item.source_system}
                          </span>
                          <span className="text-xs text-zinc-500">{formatDate(item.created_at)}</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">
                          Record reference: {item.record_ref ?? "Not recorded"}
                        </p>
                        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                          Fields: {item.field_names.join(", ")}
                        </p>
                        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {item.minimum_necessary_justification}
                        </p>
                        <p className="mt-2 text-xs text-zinc-500">
                          Exported objects: {item.object_count} · File: {item.file_name ?? "none"} · Hash: {item.sha256 ?? "none"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Status({ label: heading, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{heading}</div>
      <div className="mt-1 text-sm text-zinc-800 dark:text-zinc-200">{titleCase(value)}</div>
    </div>
  );
}

function TextArea({
  label: heading,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={label}>
      {heading}
      <textarea
        className={field}
        rows={4}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
