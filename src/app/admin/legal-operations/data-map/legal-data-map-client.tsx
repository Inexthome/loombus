"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_requests: boolean;
};

type Phase = {
  metadataOnly: boolean;
  sourceCollectionEnabled: boolean;
  exportEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
  externalTransmissionEnabled: boolean;
};

type LegalDataSource = {
  source_key: string;
  source_group: string;
  display_name: string;
  source_kind: string;
  system_of_record: string;
  data_classes: string[];
  source_locations: string[];
  locator_contract: string;
  account_deletion_resource_keys: string[];
  external_processors: string[];
  inventory_status: "verified" | "partial" | "unresolved";
  unresolved_items: string[];
  evidence_sources: string[];
  notes: string | null;
  sort_order: number;
  updated_at: string;
};

const panelClass = "rounded-2xl border p-5 shadow-sm";
const controlClass =
  "w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#CBAB5B]";

const panelStyle = {
  background: "var(--loombus-surface)",
  borderColor: "var(--loombus-border)",
  color: "var(--loombus-text)",
};

const controlStyle = {
  background: "var(--loombus-surface)",
  borderColor: "var(--loombus-border)",
  color: "var(--loombus-text)",
};

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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fdata-map";
    throw new Error("Authentication required.");
  }

  const response = await fetch(input, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401) {
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fdata-map";
    throw new Error("Authentication required.");
  }

  return response;
}

async function responseMessage(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { error?: string };
  return body.error ?? fallback;
}

function statusExplanation(status: LegalDataSource["inventory_status"]) {
  if (status === "verified") {
    return "The listed first-party source family was directly identified in the reviewed implementation evidence. This does not imply complete provider-copy coverage.";
  }
  if (status === "partial") {
    return "The core source family is mapped, but one or more production, provider, logging, derivative, or copy inventories remain unresolved.";
  }
  return "The source family is known to matter, but production coverage is not complete enough to claim a verified inventory.";
}

export default function LegalDataMapClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [sources, setSources] = useState<LegalDataSource[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await authorizedFetch("/api/admin/legal-operations/data-map");
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        setMessage(await responseMessage(response, "Unable to load the Legal Data Map."));
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        sources: LegalDataSource[];
        phase: Phase;
      };

      setRestricted(false);
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setSources(body.sources);
      setSelectedKey((current) => {
        if (current && body.sources.some((source) => source.source_key === current)) {
          return current;
        }
        return body.sources[0]?.source_key ?? null;
      });
    } catch (error) {
      if (error instanceof Error && error.message !== "Authentication required.") {
        setMessage(error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRegistry();
  }, [loadRegistry]);

  const groups = useMemo(
    () => Array.from(new Set(sources.map((source) => source.source_group))).sort(),
    [sources]
  );

  const filteredSources = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sources.filter((source) => {
      if (groupFilter !== "all" && source.source_group !== groupFilter) return false;
      if (statusFilter !== "all" && source.inventory_status !== statusFilter) return false;
      if (!normalized) return true;

      const haystack = [
        source.source_key,
        source.source_group,
        source.display_name,
        source.source_kind,
        source.system_of_record,
        source.locator_contract,
        source.notes ?? "",
        ...source.data_classes,
        ...source.source_locations,
        ...source.external_processors,
        ...source.unresolved_items,
        ...source.evidence_sources,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [groupFilter, query, sources, statusFilter]);

  const selected = useMemo(
    () => sources.find((source) => source.source_key === selectedKey) ?? null,
    [selectedKey, sources]
  );

  const counts = useMemo(
    () => ({
      total: sources.length,
      verified: sources.filter((source) => source.inventory_status === "verified").length,
      partial: sources.filter((source) => source.inventory_status === "partial").length,
      unresolved: sources.filter((source) => source.inventory_status === "unresolved").length,
    }),
    [sources]
  );

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
            Legal Data Map
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
    <main className="mx-auto max-w-[1540px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Internal only · Issue #674
          </p>
          <h1
            className="mt-1 text-3xl font-semibold"
            style={{ color: "var(--loombus-text-strong)" }}
          >
            Legal Data Map
          </h1>
          <p
            className="mt-2 max-w-4xl text-sm"
            style={{ color: "var(--loombus-text-muted)" }}
          >
            Metadata-only inventory of systems where potentially responsive data may exist.
            A mapped source is not a finding of responsiveness, legal authority, or disclosure
            eligibility.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/legal-operations"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: "var(--loombus-border)",
              color: "var(--loombus-text-strong)",
            }}
          >
            Legal Operations
          </Link>
          <Link
            href="/admin"
            className="rounded-full border px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: "var(--loombus-border)",
              color: "var(--loombus-text-strong)",
            }}
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
        This workspace does not query source systems, collect member records, retrieve files,
        generate exports, approve disclosures, approve emergency disclosures, send member
        notices, or transmit data externally.
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

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Mapped source families" value={counts.total} />
          <Metric label="Verified" value={counts.verified} />
          <Metric label="Partial" value={counts.partial} />
          <Metric label="Unresolved" value={counts.unresolved} />
        </div>
        <div
          className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
          style={{ color: "var(--loombus-text-muted)" }}
        >
          <span>Role: {authorization?.role ? titleCase(authorization.role) : "Loading"}</span>
          <span>
            Review capability: {authorization?.can_review_requests ? "Enabled" : "Unavailable"}
          </span>
          <span>Registry mode: {phase?.metadataOnly ? "Metadata only" : "Loading"}</span>
          <span>Last source refresh occurs only through a reviewed migration.</span>
        </div>
      </section>

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <label className="grid gap-1.5 text-sm font-medium">
            Search registry metadata
            <input
              className={controlClass}
              style={controlStyle}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search systems, data classes, providers, or gaps"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Source group
            <select
              className={controlClass}
              style={controlStyle}
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>
                  {titleCase(group)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Inventory status
            <select
              className={controlClass}
              style={controlStyle}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="verified">Verified</option>
              <option value="partial">Partial</option>
              <option value="unresolved">Unresolved</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[410px_minmax(0,1fr)]">
        <section className={panelClass} style={panelStyle}>
          <div className="flex items-center justify-between gap-3">
            <h2
              className="text-lg font-semibold"
              style={{ color: "var(--loombus-text-strong)" }}
            >
              Source families
            </h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
              {filteredSources.length} shown
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {loading ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Loading registry…
              </p>
            ) : null}

            {!loading && filteredSources.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                No source family matches the current filters.
              </p>
            ) : null}

            {filteredSources.map((source) => (
              <button
                key={source.source_key}
                type="button"
                onClick={() => setSelectedKey(source.source_key)}
                className="rounded-xl border p-3 text-left transition hover:border-[#CBAB5B]"
                style={{
                  borderColor:
                    selectedKey === source.source_key
                      ? "#CBAB5B"
                      : "var(--loombus-border)",
                  background:
                    selectedKey === source.source_key
                      ? "rgba(203,171,91,0.10)"
                      : "var(--loombus-surface)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: "var(--loombus-text-strong)" }}
                  >
                    {source.display_name}
                  </span>
                  <StatusBadge status={source.inventory_status} />
                </div>
                <div
                  className="mt-1 text-xs"
                  style={{ color: "var(--loombus-text-muted)" }}
                >
                  {titleCase(source.source_group)} · {titleCase(source.source_kind)}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="grid min-w-0 gap-5">
          {!selected ? (
            <div className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Select a source family to inspect its system metadata and unresolved inventory
                boundaries.
              </p>
            </div>
          ) : (
            <>
              <div className={panelClass} style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#CBAB5B]">
                      {titleCase(selected.source_group)} · {titleCase(selected.source_kind)}
                    </p>
                    <h2
                      className="mt-1 text-xl font-semibold"
                      style={{ color: "var(--loombus-text-strong)" }}
                    >
                      {selected.display_name}
                    </h2>
                  </div>
                  <StatusBadge status={selected.inventory_status} large />
                </div>

                <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                  {statusExplanation(selected.inventory_status)}
                </p>

                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <InfoBlock label="System of record" value={selected.system_of_record} />
                  <InfoBlock label="Registry key" value={selected.source_key} mono />
                </div>

                <div className="mt-4">
                  <h3
                    className="text-sm font-semibold"
                    style={{ color: "var(--loombus-text-strong)" }}
                  >
                    Locator contract
                  </h3>
                  <p
                    className="mt-1 whitespace-pre-wrap text-sm"
                    style={{ color: "var(--loombus-text-muted)" }}
                  >
                    {selected.locator_contract}
                  </p>
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--loombus-text-strong)" }}
                >
                  Source inventory
                </h3>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <ListBlock label="Data classes" values={selected.data_classes} />
                  <ListBlock label="Source locations" values={selected.source_locations} />
                  <ListBlock
                    label="External processors"
                    values={selected.external_processors}
                    emptyText="No external processor is asserted by this row."
                  />
                  <ListBlock
                    label="Issue #668 reconciliation keys"
                    values={selected.account_deletion_resource_keys}
                    emptyText="No deletion-registry key linked."
                    mono
                  />
                </div>
              </div>

              <div className={panelClass} style={panelStyle}>
                <h3
                  className="text-lg font-semibold"
                  style={{ color: "var(--loombus-text-strong)" }}
                >
                  Inventory boundaries and evidence
                </h3>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <ListBlock
                    label="Unresolved inventory"
                    values={selected.unresolved_items}
                    emptyText="No unresolved inventory item is recorded for this source family."
                  />
                  <ListBlock
                    label="Repository evidence"
                    values={selected.evidence_sources}
                    mono
                  />
                </div>
                {selected.notes ? (
                  <div className="mt-5">
                    <h4
                      className="text-sm font-semibold"
                      style={{ color: "var(--loombus-text-strong)" }}
                    >
                      Internal note
                    </h4>
                    <p className="mt-1 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                      {selected.notes}
                    </p>
                  </div>
                ) : null}
                <p className="mt-5 text-xs" style={{ color: "var(--loombus-text-subtle)" }}>
                  Registry metadata last changed {formatDate(selected.updated_at)}. Source-system
                  contents are not loaded into this workspace.
                </p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: "var(--loombus-border)",
        background: "var(--loombus-surface-strong)",
      }}
    >
      <div className="text-2xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  large = false,
}: {
  status: LegalDataSource["inventory_status"];
  large?: boolean;
}) {
  return (
    <span
      className={`shrink-0 rounded-full border font-semibold ${large ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-[11px]"}`}
      style={{
        borderColor: status === "verified" ? "var(--loombus-border)" : "rgba(203,171,91,0.65)",
        background: status === "verified" ? "var(--loombus-surface-strong)" : "rgba(203,171,91,0.10)",
        color: status === "verified" ? "var(--loombus-text-strong)" : "#CBAB5B",
      }}
    >
      {titleCase(status)}
    </span>
  );
}

function InfoBlock({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: "var(--loombus-border)",
        background: "var(--loombus-surface-strong)",
      }}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-[#CBAB5B]">{label}</div>
      <div
        className={`mt-1 whitespace-pre-wrap break-words text-sm ${mono ? "font-mono" : ""}`}
        style={{ color: "var(--loombus-text-strong)" }}
      >
        {value}
      </div>
    </div>
  );
}

function ListBlock({
  label,
  values,
  emptyText = "None recorded.",
  mono = false,
}: {
  label: string;
  values: string[];
  emptyText?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
        {label}
      </h4>
      {values.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
          {emptyText}
        </p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {values.map((value) => (
            <li
              key={value}
              className={`rounded-lg border px-3 py-2 text-sm ${mono ? "font-mono text-xs" : ""}`}
              style={{
                borderColor: "var(--loombus-border)",
                background: "var(--loombus-surface-strong)",
                color: "var(--loombus-text-muted)",
              }}
            >
              {value}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
