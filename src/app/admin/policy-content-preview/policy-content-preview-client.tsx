"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StructuredPolicyRenderer } from "@/components/policy-content/structured-policy-renderer";
import type { StructuredPolicyPayload } from "@/lib/policy-content-payload";
import { supabase } from "@/lib/supabase/client";

const PREVIEW_PATH = "/admin/policy-content-preview";
const DOCUMENT_ID = "POLICY-ACCESSIBILITY";
const VERSION = "2026.08.10.1";
const PREVIEW_API = `/api/admin/policy-content-preview?documentId=${encodeURIComponent(DOCUMENT_ID)}&version=${encodeURIComponent(VERSION)}`;

type AccessState = "checking" | "allowed" | "denied" | "error";

type PreviewPayload = {
  isAdmin: boolean;
  previewOnly: boolean;
  documentId: string;
  version: string;
  migrationState: string;
  status: string;
  publicReady: boolean;
  publicationEligible: boolean;
  publicationEligibilityReasons: string[];
  sourceRevision: string;
  payload: StructuredPolicyPayload;
  boundaries: {
    publicRouteSwitchover: boolean;
    registryRoutingEnabled: boolean;
    archiveRoutingEnabled: boolean;
    editable: boolean;
    approvalActionAvailable: boolean;
    publishActionAvailable: boolean;
    memberNoticeAvailable: boolean;
  };
};

type ErrorPayload = {
  error?: unknown;
  code?: unknown;
};

export default function PolicyContentPreviewClient() {
  const [accessState, setAccessState] = useState<AccessState>("checking");
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!active) return;

        const token = data.session?.access_token ?? "";
        if (!token) {
          window.location.replace(
            `/login?next=${encodeURIComponent(PREVIEW_PATH)}`,
          );
          return;
        }

        const response = await fetch(PREVIEW_API, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const payload = (await response.json().catch(() => ({}))) as
          | PreviewPayload
          | ErrorPayload;

        if (!active) return;

        if (!response.ok) {
          if (response.status === 403) {
            setAccessState("denied");
            setPreview(null);
            return;
          }

          throw new Error(
            typeof (payload as ErrorPayload).error === "string"
              ? ((payload as ErrorPayload).error as string)
              : "The policy preview could not be loaded.",
          );
        }

        const next = payload as PreviewPayload;
        if (next.isAdmin !== true || next.previewOnly !== true) {
          setAccessState("denied");
          setPreview(null);
          return;
        }

        setPreview(next);
        setAccessState("allowed");
      } catch (caught) {
        if (!active) return;
        setPreview(null);
        setError(
          caught instanceof Error
            ? caught.message
            : "The policy preview could not be loaded.",
        );
        setAccessState("error");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  if (accessState === "checking") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
          Verifying administrator access and loading the structured policy candidate...
        </div>
      </main>
    );
  }

  if (accessState === "denied") {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="rounded-3xl border border-[var(--loombus-border)] bg-[var(--loombus-surface)] p-6">
          <h1 className="text-2xl font-semibold">Administrator access required</h1>
          <p className="mt-3 text-sm text-[var(--loombus-text-muted)]">
            Policy-content candidate previews are restricted to the existing Loombus administrator role.
          </p>
        </div>
      </main>
    );
  }

  if (accessState === "error" || !preview) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div
          className="rounded-3xl border border-red-500/25 bg-red-500/10 p-6"
          role="alert"
        >
          <h1 className="text-2xl font-semibold">Preview unavailable</h1>
          <p className="mt-3 text-sm">{error || "The preview could not be loaded."}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <aside className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-8">
        <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5 shadow-lg shadow-black/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--loombus-gold)]">
                Internal policy-content preview
              </p>
              <h1 className="mt-2 text-xl font-semibold">
                {preview.documentId} · {preview.version}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--loombus-text-muted)]">
                Read-only preview from the source-controlled structured payload. This is not the live public route, does not create an approval, and cannot publish or notify members.
              </p>
            </div>
            <Link
              href="/admin/platform"
              className="w-fit rounded-full border border-[var(--loombus-border)] px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--loombus-gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--loombus-bg)]"
            >
              Back to Platform Operations
            </Link>
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-[var(--loombus-text-subtle)]">Migration state</dt>
              <dd className="mt-1 font-semibold">{preview.migrationState}</dd>
            </div>
            <div>
              <dt className="text-[var(--loombus-text-subtle)]">Version status</dt>
              <dd className="mt-1 font-semibold">{preview.status}</dd>
            </div>
            <div>
              <dt className="text-[var(--loombus-text-subtle)]">Public ready</dt>
              <dd className="mt-1 font-semibold">{preview.publicReady ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-[var(--loombus-text-subtle)]">Publication eligible</dt>
              <dd className="mt-1 font-semibold">
                {preview.publicationEligible ? "Yes" : "No"}
              </dd>
            </div>
          </dl>

          {!preview.publicationEligible ? (
            <p className="mt-4 break-words text-xs leading-5 text-[var(--loombus-text-subtle)]">
              Gate reasons: {preview.publicationEligibilityReasons.join(", ") || "not eligible"}
            </p>
          ) : null}
          <p className="mt-2 break-all text-xs text-[var(--loombus-text-subtle)]">
            Source revision: {preview.sourceRevision}
          </p>
        </div>
      </aside>

      <StructuredPolicyRenderer payload={preview.payload} />
    </>
  );
}
