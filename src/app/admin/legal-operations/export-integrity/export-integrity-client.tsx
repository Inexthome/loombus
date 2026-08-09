"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Authorization = {
  role: string;
  can_review_export_integrity: boolean;
  can_export: boolean;
  can_disclose: boolean;
  can_approve_emergency: boolean;
};

type Phase = {
  integrityReviewEnabled: boolean;
  exportGenerationEnabled: boolean;
  packageMutationEnabled: boolean;
  artifactRegistrationEnabled: boolean;
  verificationRecordingEnabled: boolean;
  custodyEventRecordingEnabled: boolean;
  externalTransferEnabled: boolean;
  disclosureApprovalEnabled: boolean;
  emergencyApprovalEnabled: boolean;
  memberNoticeSendingEnabled: boolean;
  externalTransmissionEnabled: boolean;
};

type ExportPackage = {
  id: string;
  request_id: string;
  disclosure_id: string;
  status: string;
  package_label: string;
  manifest_item_count: number;
  artifact_count: number;
  total_bytes: number;
  manifest_sha256: string | null;
  package_sha256: string | null;
  generated_at: string | null;
  verified_at: string | null;
  sealed_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
};

type ApiBody = {
  authorization: Authorization;
  phase: Phase;
  packages: ExportPackage[];
  artifacts: unknown[];
  verifications: unknown[];
  custodyEvents: unknown[];
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

function ControlCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
      <h3 className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6" style={{ color: "var(--loombus-text-muted)" }}>
        {text}
      </p>
    </div>
  );
}

export default function ExportIntegrityClient() {
  const [body, setBody] = useState<ApiBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [restricted, setRestricted] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const sessionResult = await supabase.auth.getSession();
        const token = sessionResult.data.session?.access_token;
        if (!token) {
          window.location.href = "/login?next=%2Fadmin%2Flegal-operations%2Fexport-integrity";
          return;
        }

        const response = await fetch("/api/admin/legal-operations/export-integrity", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!active) return;
        if (response.status === 403) {
          setRestricted(true);
          return;
        }

        const result = (await response.json().catch(() => ({}))) as ApiBody & { error?: string };
        if (!response.ok) {
          setMessage(result.error ?? "Unable to load export-integrity controls.");
          return;
        }

        setBody(result);
      } catch (error) {
        if (active) setMessage(error instanceof Error ? error.message : "Unable to load controls.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(
    () => ({
      packages: body?.packages.length ?? 0,
      artifacts: body?.artifacts.length ?? 0,
      verifications: body?.verifications.length ?? 0,
      custody: body?.custodyEvents.length ?? 0,
    }),
    [body]
  );

  if (restricted) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
        <div className={panelClass} style={panelStyle}>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Restricted workspace
          </p>
          <h1 className="mt-2 text-2xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Export Integrity
          </h1>
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Access requires the dedicated can_review_export_integrity capability. This capability does not grant export authority.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-[#CBAB5B]" href="/admin/legal-operations">
            Return to Legal Operations
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#CBAB5B]">
            Internal only · Issue #674
          </p>
          <h1 className="mt-1 text-3xl font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
            Chain of Custody and Export Integrity
          </h1>
          <p className="mt-2 max-w-4xl text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            Read-only control metadata for future export package integrity and custody history. This workspace does not create or retrieve export content.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/legal-operations" className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-strong)" }}>
            Legal Operations
          </Link>
          <Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--loombus-border)", color: "var(--loombus-text-strong)" }}>
            Admin
          </Link>
        </div>
      </div>

      <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(203,171,91,0.55)", background: "rgba(203,171,91,0.10)", color: "var(--loombus-text-strong)" }}>
        Export generation, source collection, artifact registration, verification recording, custody mutation, external transfer, disclosure approval, emergency approval, notices, and external transmission are disabled.
      </div>

      {message ? (
        <div className="mb-5 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(203,171,91,0.55)", background: "rgba(203,171,91,0.10)", color: "var(--loombus-text-strong)" }}>
          {message}
        </div>
      ) : null}

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Export packages" value={counts.packages} />
          <Metric label="Artifact metadata rows" value={counts.artifacts} />
          <Metric label="Verification rows" value={counts.verifications} />
          <Metric label="Custody events" value={counts.custody} />
        </div>
        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
          <span>Role: {body?.authorization.role ? titleCase(body.authorization.role) : loading ? "Loading" : "Unavailable"}</span>
          <span>Integrity review: {body?.authorization.can_review_export_integrity ? "Enabled" : "Unavailable"}</span>
          <span>Export authority: {body?.authorization.can_export ? "Enabled" : "Disabled"}</span>
          <span>Disclosure authority: {body?.authorization.can_disclose ? "Enabled" : "Disabled"}</span>
          <span>Emergency approval: {body?.authorization.can_approve_emergency ? "Enabled" : "Disabled"}</span>
        </div>
      </section>

      <section className={`${panelClass} mb-5`} style={panelStyle}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
          Foundation controls
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ControlCard title="Package lifecycle" text="The schema separates planned, generated, verified, sealed, and voided states. Generated and later states require accountable actor and timestamp metadata." />
          <ControlCard title="Integrity evidence" text="Future package and artifact metadata uses SHA-256 digests, byte counts, artifact counts, manifest coverage, and append-only verification results. Payload bytes are not stored in these tables." />
          <ControlCard title="Chain of custody" text="Future custody events are append-only and distinguish internal handoff, external transfer, receipt, access, voiding, and destruction. No custody-event write path exists in this phase." />
          <ControlCard title="Separation of duties" text="can_review_export_integrity is separate from can_export. Reviewing metadata cannot generate an export, approve a disclosure, or transmit data." />
        </div>
      </section>

      <section className={panelClass} style={panelStyle}>
        <h2 className="text-lg font-semibold" style={{ color: "var(--loombus-text-strong)" }}>
          Package register
        </h2>
        {loading ? (
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>Loading foundation metadata…</p>
        ) : body?.packages.length ? (
          <div className="mt-4 grid gap-3">
            {body.packages.map((item) => (
              <div key={item.id} className="rounded-xl border p-4" style={{ borderColor: "var(--loombus-border)" }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold" style={{ color: "var(--loombus-text-strong)" }}>{item.package_label}</span>
                  <span className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: "rgba(203,171,91,0.6)", color: "#CBAB5B" }}>{titleCase(item.status)}</span>
                </div>
                <div className="mt-2 text-xs" style={{ color: "var(--loombus-text-muted)" }}>
                  Manifest items: {item.manifest_item_count} · Artifacts: {item.artifact_count} · Bytes: {item.total_bytes}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm" style={{ color: "var(--loombus-text-muted)" }}>
            No export packages exist. That is the expected state for this foundation-only phase.
          </p>
        )}
      </section>
    </main>
  );
}
