"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_transparency_reporting: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type Phase = {
  methodologyOnly: boolean;
  aggregationExecutionEnabled: boolean;
  snapshotGenerationEnabled: boolean;
  requestSpecificDataEnabled: boolean;
  publicPublicationEnabled: boolean;
  publicTransparencyPageEnabled: boolean;
  exportEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
  externalTransmissionEnabled: boolean;
};

type TransparencyRow = {
  control_key: string;
  control_kind: "dimension" | "counting_rule" | "privacy_control" | "publication_gate";
  display_name: string;
  source_fields: string[];
  aggregation_contract: string;
  null_handling: string;
  publication_approval_status: "unapproved" | "approved" | "not_applicable";
  aggregation_execution_enabled: boolean;
  publication_enabled: boolean;
  request_specific_data_allowed: boolean;
  counsel_review_required: boolean;
  suppression_rule_required: boolean;
  unresolved_items: string[];
  evidence_sources: string[];
  notes: string | null;
  sort_order: number;
  updated_at: string;
};

const panelClass = "rounded-2xl border p-5 shadow-sm";
const panelStyle = {
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

async function authorizedFetch(input: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    window.location.href =
      "/login?next=%2Fadmin%2Flegal-operations%2Ftransparency-reporting";
    throw new Error("Authentication required.");
  }

  const response = await fetch(input, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    window.location.href =
      "/login?next=%2Fadmin%2Flegal-operations%2Ftransparency-reporting";
    throw new Error("Authentication required.");
  }

  return response;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
      <div className="text-2xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
        {value}
      </div>
      <div className="mt-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full border px-2.5 py-1 text-xs"
      style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-muted)" }}
    >
      {children}
    </span>
  );
}

export default function TransparencyReportingClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [rows, setRows] = useState<TransparencyRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const loadRegistry = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await authorizedFetch(
        "/api/admin/legal-operations/transparency-reporting"
      );
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? "Unable to load transparency-reporting methodology.");
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        rows: TransparencyRow[];
        phase: Phase;
      };

      setRestricted(false);
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setRows(body.rows);
      setSelectedKey((current) =>
        current && body.rows.some((row) => row.control_key === current)
          ? current
          : body.rows[0]?.control_key ?? null
      );
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

  const filteredRows = useMemo(
    () =>
      kindFilter === "all"
        ? rows
        : rows.filter((row) => row.control_kind === kindFilter),
    [kindFilter, rows]
  );

  const selected = useMemo(
    () => rows.find((row) => row.control_key === selectedKey) ?? null,
    [rows, selectedKey]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      approved: rows.filter((row) => row.publication_approval_status === "approved").length,
      aggregationEnabled: rows.filter((row) => row.aggregation_execution_enabled).length,
      counselRequired: rows.filter((row) => row.counsel_review_required).length,
    }),
    [rows]
  );

  if (restricted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className={panelClass} style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Restricted workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Transparency Reporting
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires the dedicated can_review_transparency_reporting capability. This
            capability does not grant request mutation, aggregation execution, publication,
            export, disclosure, emergency approval, notice, or external-transmission authority.
          </p>
          <Link
            className="mt-5 inline-block text-sm font-semibold text-[#CBAB5B]"
            href="/admin/legal-operations"
          >
            Return to Legal Operations
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
          <h1 className="mt-1 text-3xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Aggregate Transparency Reporting
          </h1>
          <p className="mt-2 max-w-4xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Methodology-only controls for future aggregate transparency reporting. This workspace
            does not generate request counts, load request-specific records, create report
            snapshots, or publish anything externally.
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
          background: "rgba(203,171,91,0.08)",
          color: "var(--loombus-text-strong)",
        }}
      >
        Aggregate execution, snapshot generation, request-specific output, public publication,
        export, disclosure approval, emergency approval, notices, and external transmission are
        disabled. No small-cell threshold or public category taxonomy is approved in this phase.
      </div>

      <section className={panelClass} style={panelStyle}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Methodology controls" value={counts.total} />
          <Metric label="Publication controls approved" value={counts.approved} />
          <Metric label="Aggregation execution enabled" value={counts.aggregationEnabled} />
          <Metric label="Counsel review required" value={counts.counselRequired} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
          <span>Role: {authorization?.role ?? "Loading"}</span>
          <span>
            Transparency reporting review: {authorization?.can_review_transparency_reporting ? "Enabled" : "Disabled"}
          </span>
          <span>Export authority: {authorization?.can_export ? "Enabled" : "Disabled"}</span>
          <span>Disclosure authority: {authorization?.can_disclose ? "Enabled" : "Disabled"}</span>
          <span>
            Emergency approval: {authorization?.can_approve_emergency ? "Enabled" : "Disabled"}
          </span>
          <span>Registry mode: {phase?.methodologyOnly ? "Methodology only" : "Unknown"}</span>
        </div>
      </section>

      {message ? (
        <div className="mt-5 rounded-xl border p-4 text-sm" style={panelStyle}>
          {message}
        </div>
      ) : null}

      <section className={`${panelClass} mt-5`} style={panelStyle}>
        <label className="text-sm font-semibold" htmlFor="control-kind">
          Control type
        </label>
        <select
          id="control-kind"
          value={kindFilter}
          onChange={(event) => setKindFilter(event.target.value)}
          className="mt-2 w-full rounded-xl border px-3 py-2 text-sm sm:max-w-sm"
          style={{
            borderColor: "var(--loombus-border)",
            background: "var(--loombus-surface)",
            color: "var(--loombus-text-strong)",
          }}
        >
          <option value="all">All controls</option>
          <option value="dimension">Dimensions</option>
          <option value="counting_rule">Counting rules</option>
          <option value="privacy_control">Privacy controls</option>
          <option value="publication_gate">Publication gates</option>
        </select>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className={panelClass} style={panelStyle}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
              Methodology controls
            </h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>
              {filteredRows.length} shown
            </span>
          </div>
          <div className="space-y-2">
            {loading ? (
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
                Loading methodology metadata…
              </p>
            ) : null}
            {filteredRows.map((row) => (
              <button
                key={row.control_key}
                type="button"
                onClick={() => setSelectedKey(row.control_key)}
                className="w-full rounded-xl border p-3 text-left"
                style={{
                  borderColor:
                    selectedKey === row.control_key ? "rgba(203,171,91,0.8)" : "var(--loombus-border)",
                  background:
                    selectedKey === row.control_key ? "rgba(203,171,91,0.08)" : "transparent",
                }}
              >
                <div className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                  {row.display_name}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Tag>{titleCase(row.control_kind)}</Tag>
                  <Tag>{titleCase(row.publication_approval_status)}</Tag>
                  {row.suppression_rule_required ? <Tag>Suppression Required</Tag> : null}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={panelClass} style={panelStyle}>
          {selected ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#CBAB5B]">
                {titleCase(selected.control_kind)}
              </p>
              <h2 className="mt-1 text-2xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                {selected.display_name}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <Tag>{titleCase(selected.publication_approval_status)}</Tag>
                <Tag>{selected.aggregation_execution_enabled ? "Aggregation Enabled" : "Aggregation Disabled"}</Tag>
                <Tag>{selected.publication_enabled ? "Publication Enabled" : "Publication Disabled"}</Tag>
                <Tag>{selected.counsel_review_required ? "Counsel Required" : "Counsel Not Required"}</Tag>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
                  <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    Aggregation contract
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--loombus-text-muted)" }}>
                    {selected.aggregation_contract}
                  </p>
                </div>
                <div className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
                  <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    Null and unresolved handling
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--loombus-text-muted)" }}>
                    {selected.null_handling}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    Candidate source fields
                  </h3>
                  <div className="mt-2 space-y-2">
                    {selected.source_fields.map((field) => (
                      <div key={field} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-muted)" }}>
                        {field}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    Unresolved methodology items
                  </h3>
                  <div className="mt-2 space-y-2">
                    {selected.unresolved_items.map((item) => (
                      <div key={item} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-muted)" }}>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                  Repository evidence
                </h3>
                <div className="mt-2 space-y-2">
                  {selected.evidence_sources.map((source) => (
                    <div key={source} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-muted)" }}>
                      {source}
                    </div>
                  ))}
                </div>
              </div>

              {selected.notes ? (
                <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
                  <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
                    Notes
                  </h3>
                  <p className="mt-2 text-sm leading-6" style={{ color: "var(--loombus-text-muted)" }}>
                    {selected.notes}
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>
              No methodology control selected.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
