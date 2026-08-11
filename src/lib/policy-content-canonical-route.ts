import "server-only";

import type { StructuredPolicyPayload } from "@/lib/policy-content-payload";
import {
  getPolicyPayloadSource,
  type PolicyPayloadSource,
} from "@/lib/policy-content-payload-registry";
import {
  policyContentRegistry,
  type PolicyContentRegistry,
  type PolicyDocumentFamily,
  type PolicyVersionRecord,
} from "@/lib/policy-content-registry";
import {
  resolvePolicyCurrentVersionFromRegistry,
  type PolicyResolutionReason,
} from "@/lib/policy-content-resolver";

export type PolicyCanonicalRouteReason =
  | PolicyResolutionReason
  | "payload_not_registered"
  | "payload_document_id_mismatch"
  | "payload_version_mismatch"
  | "payload_path_mismatch"
  | "payload_source_revision_mismatch"
  | "payload_canonical_route_mismatch";

export type PolicyCanonicalRouteResolution = {
  resolved: boolean;
  reasons: readonly PolicyCanonicalRouteReason[];
  family: PolicyDocumentFamily | null;
  version: PolicyVersionRecord | null;
  payload: StructuredPolicyPayload | null;
};

export type PolicyPayloadLookup = (
  documentId: string,
  version: string,
) => PolicyPayloadSource | null;

function uniqueReasons(reasons: readonly PolicyCanonicalRouteReason[]) {
  return [...new Set(reasons)];
}

function unresolved(
  reasons: readonly PolicyCanonicalRouteReason[],
  family: PolicyDocumentFamily | null = null,
  version: PolicyVersionRecord | null = null,
): PolicyCanonicalRouteResolution {
  return {
    resolved: false,
    reasons: uniqueReasons(reasons),
    family,
    version,
    payload: null,
  };
}

export function resolvePolicyCanonicalRoutePayloadFromRegistry(
  registry: PolicyContentRegistry,
  documentId: string,
  payloadLookup: PolicyPayloadLookup,
  now = new Date(),
): PolicyCanonicalRouteResolution {
  const current = resolvePolicyCurrentVersionFromRegistry(
    registry,
    documentId,
    now,
  );

  if (!current.resolved || !current.family || !current.version) {
    return unresolved(current.reasons, current.family, current.version);
  }

  const source = payloadLookup(documentId, current.version.version);
  if (!source) {
    return unresolved(
      ["payload_not_registered"],
      current.family,
      current.version,
    );
  }

  const reasons: PolicyCanonicalRouteReason[] = [];
  if (source.documentId !== current.version.documentId) {
    reasons.push("payload_document_id_mismatch");
  }
  if (source.version !== current.version.version) {
    reasons.push("payload_version_mismatch");
  }
  if (source.payloadPath !== current.version.payloadPath) {
    reasons.push("payload_path_mismatch");
  }
  if (source.payload.sourceRevision !== current.version.sourceRevision) {
    reasons.push("payload_source_revision_mismatch");
  }
  if (source.payload.canonicalRoute !== current.family.canonicalRoute) {
    reasons.push("payload_canonical_route_mismatch");
  }

  if (reasons.length > 0) {
    return unresolved(reasons, current.family, current.version);
  }

  return {
    resolved: true,
    reasons: [],
    family: current.family,
    version: current.version,
    payload: source.payload,
  };
}

export function resolvePolicyCanonicalRoutePayload(
  documentId: string,
  now = new Date(),
): PolicyCanonicalRouteResolution {
  return resolvePolicyCanonicalRoutePayloadFromRegistry(
    policyContentRegistry,
    documentId,
    getPolicyPayloadSource,
    now,
  );
}
