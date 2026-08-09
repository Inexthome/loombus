"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_legal_retention: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type Phase = {
  metadataOnly: boolean;
  fixedRetentionTimelinesApproved: boolean;
  dispositionExecutionEnabled: boolean;
  purgeEnabled: boolean;
  deletionEnabled: boolean;
  anonymizationEnabled: boolean;
  archiveMutationEnabled: boolean;
  exportEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
  externalTransmissionEnabled: boolean;
};

type RetentionRow = {
  record_key: string;
  display_name: string;
  source_group: string;
  source_locations: string[];
  lifecycle_trigger: string;
  normal_retention_rule: string;
  timing_status: "unapproved" | "approved" | "not_applicable";
  timing_value: string | null;
  hold_interaction: "blocks_disposition" | "retain_history" | "not_request_scoped";
  active_hold_rule: string;
  disposition_method: "retain" | "delete" | "anonymize" | "archive" | "manual_review";
  disposition_execution_enabled: boolean;
  counsel_review_required: boolean;
  canonical_register_reference: string;
  related_account_deletion_resource_keys: string[];
  accountable_owner: string;
  review_cadence: string;
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
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fretention";
    throw new Error("Authentication required.");
  }

  const response = await fetch(input, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fretention";
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

export default function LegalRetentionClient() {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);
  const [phase, setPhase] = useState<Phase | null>(null);
  const [rows, setRows] = useState<RetentionRow[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState("all");

  const loadSchedule = useCallback(async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await authorizedFetch("/api/admin/legal-operations/retention");
      if (response.status === 403) {
        setRestricted(true);
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(body.error ?? "Unable to load the Legal Operations retention schedule.");
        return;
      }

      const body = (await response.json()) as {
        authorization: Authorization;
        rows: RetentionRow[];
        phase: Phase;
      };

      setRestricted(false);
      setAuthorization(body.authorization);
      setPhase(body.phase);
      setRows(body.rows);
      setSelectedKey((current) =>
        current && body.rows.some((row) => row.record_key === current)
          ? current
          : body.rows[0]?.record_key ?? null
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
    void loadSchedule();
  }, [loadSchedule]);

  const groups = useMemo(
    () => Array.from(new Set(rows.map((row) => row.source_group))).sort(),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (groupFilter !== "all" && row.source_group !== groupFilter) return false;
      if (!normalized) return true;
      const haystack = [
        row.record_key,
        row.display_name,
        row.source_group,
        row.lifecycle_trigger,
        row.normal_retention_rule,
        row.active_hold_rule,
        row.disposition_method,
        row.accountable_owner,
        row.review_cadence,
        row.notes ?? "",
        ...row.source_locations,
        ...row.related_account_deletion_resource_keys,
        ...row.unresolved_items,
        ...row.evidence_sources,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [groupFilter, query, rows]);

  const selected = useMemo(
    () => rows.find((row) => row.record_key === selectedKey) ?? null,
    [rows, selectedKey]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      approvedTimelines: rows.filter((row) => row.timing_status === "approved").length,
      executionEnabled: rows.filter((row) => row.disposition_execution_enabled).length,
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
            Legal Retention &amp; Disposition
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires the dedicated can_review_legal_retention capability. This capability
            does not grant purge, deletion, export, disclosure, emergency approval, notice, or
            external-transmission authority.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-[#CBAB5B]" href="/admin/legal-operations">
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
            Legal Retention &amp; Disposition
          </h1>
          <p className="mt-2 max-w-4xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Metadata-only schedule for Legal Operations records. It cross-references the canonical
            Issue #668 account-deletion register without replacing it or creating fixed public
            retention commitments.
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
        style={{ borderColor: "rgba(203,171,91,0.55)", background: "rgba(203,171,91,0.10)", color: "var(--loombus-text-strong)" }}
      >
        No fixed retention timeline is approved here. Purge, deletion, anonymization, archive
        mutation, export, disclosure approval, emergency approval, notices, and external
        transmission remain disabled.
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={panelStyle}>
          {message}
        </div>
      ) : null}

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Legal record classes" value={counts.total} />
          <Metric label="Approved fixed timelines" value={counts.approvedTimelines} />
          <Metric label="Disposition execution enabled" value={counts.executionEnabled} />
          <Metric label="Counsel review required" value={counts.counselRequired} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
          <span>Role: {authorization?.role ? titleCase(authorization.role) : "Loading"}</span>
          <span>Retention review: {authorization?.can_review_legal_retention ? "Enabled" : "Unavailable"}</span>
          <span>Export authority: {authorization?.can_export ? "Enabled" : "Disabled"}</span>
          <span>Disclosure authority: {authorization?.can_disclose ? "Enabled" : "Disabled"}</span>
          <span>Emergency approval: {authorization?.can_approve_emergency ? "Enabled" : "Disabled"}</span>
          <span>Registry mode: {phase?.metadataOnly ? "Metadata only" : "Loading"}</span>
        </div>
      </section>

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <label className="grid gap-1.5 text-sm font-medium">
            Search retention metadata
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#CBAB5B]"
              style={{ background: "var(--loombus-surface)", borderColor: "var(--loombus-border)", color: "var(--loombus-text)" }}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search record classes, rules, owners, evidence, or gaps"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Source group
            <select
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-[#CBAB5B]"
              style={{ background: "var(--loombus-surface)", borderColor: "var(--loombus-border)", color: "var(--loombus-text)" }}
              value={groupFilter}
              onChange={(event) => setGroupFilter(event.target.value)}
            >
              <option value="all">All groups</option>
              {groups.map((group) => (
                <option key={group} value={group}>{titleCase(group)}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
        <section className={panelClass} style={panelStyle}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>Record classes</h2>
            <span className="text-xs" style={{ color: "var(--loombus-text-muted)" }}>{filteredRows.length} shown</span>
          </div>
          <div className="mt-4 grid gap-2">
            {loading ? <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>Loading schedule…</p> : null}
            {!loading && filteredRows.length === 0 ? <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>No record class matches the current filters.</p> : null}
            {filteredRows.map((row) => (
              <button
                key={row.record_key}
                type="button"
                onClick={() => setSelectedKey(row.record_key)}
                className="rounded-xl border p-3 text-left transition hover:border-[#CBAB5B]"
                style={{
                  borderColor: selectedKey === row.record_key ? "#CBAB5B" : "var(--loombus-border)",
                  background: selectedKey === row.record_key ? "rgba(203,171,91,0.10)" : "var(--loombus-surface)",
                }}
              >
                <div className="text-sm font-semibold" style={{ color: "var(--loombus-text-strong)" }}>{row.display_name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5"><Tag>{titleCase(row.source_group)}</Tag><Tag>{titleCase(row.timing_status)}</Tag><Tag>{titleCase(row.hold_interaction)}</Tag></div>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-5">
          {selected ? (
            <>
              <section className={panelClass} style={panelStyle}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#CBAB5B]">{titleCase(selected.source_group)}</p>
                    <h2 className="mt-1 text-xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>{selected.display_name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-1.5"><Tag>{titleCase(selected.timing_status)}</Tag><Tag>{titleCase(selected.disposition_method)}</Tag></div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <Detail title="Lifecycle trigger" text={selected.lifecycle_trigger} />
                  <Detail title="Normal retention rule" text={selected.normal_retention_rule} />
                  <Detail title="Active-hold rule" text={selected.active_hold_rule} />
                  <Detail title="Governance" text={`${selected.accountable_owner} · ${selected.review_cadence} review`} />
                </div>
              </section>

              <section className={panelClass} style={panelStyle}>
                <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>Source and Issue #668 reconciliation</h2>
                <div className="mt-4 grid gap-5 lg:grid-cols-2">
                  <List title="Source locations" values={selected.source_locations} />
                  <List title="Related Issue #668 resource keys" values={selected.related_account_deletion_resource_keys} empty="No automatic member-account deletion mapping." />
                  <List title="Unresolved decisions" values={selected.unresolved_items} />
                  <List title="Repository evidence" values={selected.evidence_sources} />
                </div>
                <div className="mt-5 rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#CBAB5B]">Canonical register</div>
                  <div className="mt-1 text-sm" style={{ color: "var(--loombus-text-strong)" }}>{selected.canonical_register_reference}</div>
                  <p className="mt-2 text-sm" style={{ color: "var(--loombus-text-muted)" }}>{selected.notes ?? "No additional note."}</p>
                </div>
              </section>
            </>
          ) : (
            <section className={panelClass} style={panelStyle}>
              <p className="text-sm" style={{ color: "var(--loombus-text-muted)" }}>Select a legal record class to review its retention controls.</p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Detail({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#CBAB5B]">{title}</div>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--loombus-text-muted)" }}>{text}</p>
    </div>
  );
}

function List({ title, values, empty = "None recorded." }: { title: string; values: string[]; empty?: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--loombus-text-strong)" }}>{title}</h3>
      {values.length ? (
        <ul className="mt-2 grid gap-2">
          {values.map((value) => (
            <li key={value} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-muted)" }}>{value}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm" style={{ color: "var(--loombus-text-muted)" }}>{empty}</p>
      )}
    </div>
  );
}
