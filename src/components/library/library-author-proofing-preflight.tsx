"use client";

import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Props = {
  publicationId: string;
  versionId?: string | null;
  editable: boolean;
  sourceReady: boolean;
  onReadyChange?: (ready: boolean) => void;
};

type SourceRow = {
  id: string;
  version_id: string;
  sha256: string;
  ingestion_status: "pending" | "processing" | "ready" | "failed";
};

type ProofRow = {
  version_id: string;
  source_id: string;
  source_sha256: string;
  preview_confirmed_at: string;
  rights_attested_at: string;
  attestation_version: number;
};

export function LibraryAuthorProofingPreflight({
  publicationId,
  versionId,
  editable,
  sourceReady,
  onReadyChange,
}: Props) {
  const [resolvedVersionId, setResolvedVersionId] = useState<string | null>(versionId ?? null);
  const [source, setSource] = useState<SourceRow | null>(null);
  const [proof, setProof] = useState<ProofRow | null>(null);
  const [previewConfirmed, setPreviewConfirmed] = useState(false);
  const [rightsAttested, setRightsAttested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentConfirmation = useMemo(
    () => Boolean(
      sourceReady
      && source?.ingestion_status === "ready"
      && proof
      && proof.version_id === source.version_id
      && proof.source_id === source.id
      && proof.source_sha256 === source.sha256
      && proof.preview_confirmed_at
      && proof.rights_attested_at
      && proof.attestation_version === 1
    ),
    [proof, source, sourceReady],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    onReadyChange?.(false);

    let nextVersionId = versionId ?? null;
    if (!nextVersionId) {
      const publicationResult = await supabase
        .from("library_publications")
        .select("active_version_id")
        .eq("id", publicationId)
        .maybeSingle();
      if (publicationResult.error) {
        setError("Unable to load this publication's proofing state.");
        setLoading(false);
        return;
      }
      nextVersionId = publicationResult.data?.active_version_id ?? null;
    }

    setResolvedVersionId(nextVersionId);
    if (!nextVersionId) {
      setSource(null);
      setProof(null);
      setLoading(false);
      return;
    }

    const [sourceResult, proofResult] = await Promise.all([
      supabase
        .from("library_publication_sources")
        .select("id,version_id,sha256,ingestion_status")
        .eq("version_id", nextVersionId)
        .maybeSingle(),
      supabase
        .from("library_author_proofing_attestations")
        .select("version_id,source_id,source_sha256,preview_confirmed_at,rights_attested_at,attestation_version")
        .eq("version_id", nextVersionId)
        .maybeSingle(),
    ]);

    if (sourceResult.error || proofResult.error) {
      setSource(null);
      setProof(null);
      setError("Unable to load the author proofing checklist.");
      setLoading(false);
      return;
    }

    const nextSource = (sourceResult.data ?? null) as SourceRow | null;
    const nextProof = (proofResult.data ?? null) as ProofRow | null;
    setSource(nextSource);
    setProof(nextProof);

    const matches = Boolean(
      sourceReady
      && nextSource?.ingestion_status === "ready"
      && nextProof
      && nextProof.version_id === nextSource.version_id
      && nextProof.source_id === nextSource.id
      && nextProof.source_sha256 === nextSource.sha256
      && nextProof.preview_confirmed_at
      && nextProof.rights_attested_at
      && nextProof.attestation_version === 1
    );
    setPreviewConfirmed(matches);
    setRightsAttested(matches);
    onReadyChange?.(matches);
    setLoading(false);
  }, [onReadyChange, publicationId, sourceReady, versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onReadyChange?.(currentConfirmation);
  }, [currentConfirmation, onReadyChange]);

  async function confirmProofing() {
    if (!editable || !sourceReady || !resolvedVersionId || !source || saving) return;
    if (!previewConfirmed || !rightsAttested) {
      setError("Complete both author confirmations before finalizing preflight.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    const result = await supabase.rpc("confirm_library_author_proofing", {
      p_version_id: resolvedVersionId,
      p_source_id: source.id,
      p_preview_confirmed: true,
      p_rights_attested: true,
    });

    if (result.error) {
      setError("Unable to confirm proofing. Reopen the current proof and confirm the EPUB is still ready.");
      setSaving(false);
      return;
    }

    setMessage("Preflight confirmed for the current EPUB. Replacing the EPUB will require a new proof review and rights attestation.");
    await load();
    setSaving(false);
  }

  return (
    <section className="library-publish-commerce" aria-labelledby={`library-proofing-${resolvedVersionId ?? publicationId}`}>
      <div className="library-publish-commerce-heading">
        <div>
          <p className="library-publish-eyebrow">Author proof &amp; preflight</p>
          <h3 id={`library-proofing-${resolvedVersionId ?? publicationId}`}>Confirm the exact edition you intend to submit.</h3>
        </div>
        {currentConfirmation ? <span className="library-publish-state">Preflight complete</span> : null}
      </div>

      <p className="library-publish-commerce-copy">
        Review the normalized Reader proof before submission. Your confirmation is cryptographically bound to the current EPUB source; replacing that file invalidates this preflight automatically.
      </p>

      <div className="library-publish-preflight-list" aria-label="Submission preflight checklist">
        <p data-complete={sourceReady}>
          <span>{sourceReady ? <Check aria-hidden="true" /> : "1"}</span>
          <strong>EPUB processed</strong>
          <small>The current source passed ingestion and has normalized Reader content.</small>
        </p>
        <p data-complete={currentConfirmation || previewConfirmed}>
          <span>{currentConfirmation || previewConfirmed ? <Check aria-hidden="true" /> : "2"}</span>
          <strong>Reader proof reviewed</strong>
          <small>Use the normalized preview above and verify the text, order, headings, and completeness.</small>
        </p>
        <p data-complete={currentConfirmation || rightsAttested}>
          <span>{currentConfirmation || rightsAttested ? <Check aria-hidden="true" /> : "3"}</span>
          <strong>Publishing rights confirmed</strong>
          <small>Confirm that you own or control the rights necessary to publish this work through Loombus.</small>
        </p>
      </div>

      {editable && sourceReady && !currentConfirmation ? (
        <fieldset disabled={saving || loading} className="library-publish-preflight-confirmations">
          <label>
            <input
              type="checkbox"
              checked={previewConfirmed}
              onChange={(event) => {
                setPreviewConfirmed(event.target.checked);
                setMessage(null);
              }}
            />
            <span>I reviewed the normalized Reader proof and it matches the work I intend to submit.</span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={rightsAttested}
              onChange={(event) => {
                setRightsAttested(event.target.checked);
                setMessage(null);
              }}
            />
            <span>I own or control the rights necessary to publish this work on Loombus and authorize Loombus to host and distribute this edition under the applicable Library terms.</span>
          </label>
          <button
            type="button"
            className="library-publish-secondary"
            disabled={!previewConfirmed || !rightsAttested || saving}
            onClick={() => void confirmProofing()}
          >
            {saving ? <Loader2 className="library-publish-spinner" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
            Confirm final preflight
          </button>
        </fieldset>
      ) : null}

      {!sourceReady ? (
        <p className="library-publish-lock-note">Process the EPUB successfully before the final author proof can be confirmed.</p>
      ) : !editable && !currentConfirmation ? (
        <p className="library-publish-lock-note">This editorial state is locked and does not have a current author proofing confirmation.</p>
      ) : currentConfirmation ? (
        <p className="library-publish-lock-note">The current EPUB, normalized proof, and rights attestation are aligned. This version is eligible for submission.</p>
      ) : null}

      {loading ? <p className="library-publish-commerce-copy"><Loader2 className="library-publish-spinner" aria-hidden="true" /> Checking current proofing state…</p> : null}
      {error ? <p role="alert" className="library-publish-commerce-error">{error}</p> : null}
      {message ? <p role="status" className="library-publish-commerce-message">{message}</p> : null}
    </section>
  );
}
