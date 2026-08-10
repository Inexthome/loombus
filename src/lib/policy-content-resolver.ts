import {
  evaluatePolicyVersionPublicationEligibility,
  policyContentRegistry,
  type PolicyContentRegistry,
  type PolicyDocumentFamily,
  type PolicyEligibilityReason,
  type PolicyVersionRecord,
} from "./policy-content-registry";

export type PolicyResolutionReason =
  | PolicyEligibilityReason
  | "archive_routing_disabled"
  | "version_not_found"
  | "historical_status_not_servable"
  | "no_public_effective_version"
  | "multiple_public_effective_versions";

export type PolicyResolutionResult = {
  resolved: boolean;
  reasons: PolicyResolutionReason[];
  family: PolicyDocumentFamily | null;
  version: PolicyVersionRecord | null;
};

function uniqueReasons(reasons: PolicyResolutionReason[]) {
  return [...new Set(reasons)];
}

function findFamily(
  registry: PolicyContentRegistry,
  documentId: string,
): PolicyDocumentFamily | null {
  return (
    registry.documentFamilies.find(
      (candidate) => candidate.documentId === documentId,
    ) ?? null
  );
}

function unresolved(
  reasons: PolicyResolutionReason[],
  family: PolicyDocumentFamily | null = null,
  version: PolicyVersionRecord | null = null,
): PolicyResolutionResult {
  return {
    resolved: false,
    reasons: uniqueReasons(reasons),
    family,
    version,
  };
}

function resolved(
  family: PolicyDocumentFamily,
  version: PolicyVersionRecord,
): PolicyResolutionResult {
  return {
    resolved: true,
    reasons: [],
    family,
    version,
  };
}

function evaluateHistoricalServingEligibility(
  family: PolicyDocumentFamily,
  version: PolicyVersionRecord,
  now: Date,
): PolicyEligibilityReason[] {
  if (version.status !== "effective" && version.status !== "superseded") {
    return [];
  }

  // Historical serving uses the same publication gate that applied to the
  // effective copy, except a superseded version is allowed to remain addressable
  // after replacement. All identity, audience, approval, source-revision, date,
  // public-ready, and blocker requirements still fail closed.
  const normalizedVersion: PolicyVersionRecord =
    version.status === "superseded"
      ? { ...version, status: "effective" }
      : version;

  return evaluatePolicyVersionPublicationEligibility(
    family,
    normalizedVersion,
    now,
  ).reasons;
}

export function resolvePolicyCurrentVersionFromRegistry(
  registry: PolicyContentRegistry,
  documentId: string,
  now = new Date(),
): PolicyResolutionResult {
  if (!registry.registryRoutingEnabled) {
    return unresolved(["registry_routing_disabled"]);
  }

  const family = findFamily(registry, documentId);
  if (!family) {
    return unresolved(["unknown_document_family"]);
  }

  if (family.migrationState !== "registry_managed") {
    return unresolved(["document_family_not_registry_managed"], family);
  }

  const eligible = family.registryManagedVersions.filter(
    (version) =>
      version.status === "effective" &&
      evaluatePolicyVersionPublicationEligibility(family, version, now).eligible,
  );

  if (eligible.length === 0) {
    return unresolved(["no_public_effective_version"], family);
  }

  // Multiple publication-eligible effective versions for one document family are
  // ambiguous. Fail closed rather than silently choosing one by array order.
  if (eligible.length > 1) {
    return unresolved(["multiple_public_effective_versions"], family);
  }

  return resolved(family, eligible[0]);
}

export function resolvePolicyArchiveVersionFromRegistry(
  registry: PolicyContentRegistry,
  documentId: string,
  versionId: string,
  now = new Date(),
): PolicyResolutionResult {
  if (!registry.archiveRoutingEnabled) {
    return unresolved(["archive_routing_disabled"]);
  }

  const family = findFamily(registry, documentId);
  if (!family) {
    return unresolved(["unknown_document_family"]);
  }

  if (family.migrationState !== "registry_managed") {
    return unresolved(["document_family_not_registry_managed"], family);
  }

  const version =
    family.registryManagedVersions.find(
      (candidate) => candidate.version === versionId,
    ) ?? null;

  if (!version) {
    return unresolved(["version_not_found"], family);
  }

  if (version.status !== "effective" && version.status !== "superseded") {
    return unresolved(["historical_status_not_servable"], family, version);
  }

  const eligibilityReasons = evaluateHistoricalServingEligibility(
    family,
    version,
    now,
  );
  if (eligibilityReasons.length > 0) {
    return unresolved(eligibilityReasons, family, version);
  }

  return resolved(family, version);
}

export function resolvePolicyCurrentVersion(
  documentId: string,
  now = new Date(),
): PolicyResolutionResult {
  return resolvePolicyCurrentVersionFromRegistry(
    policyContentRegistry,
    documentId,
    now,
  );
}

export function resolvePolicyArchiveVersion(
  documentId: string,
  versionId: string,
  now = new Date(),
): PolicyResolutionResult {
  return resolvePolicyArchiveVersionFromRegistry(
    policyContentRegistry,
    documentId,
    versionId,
    now,
  );
}
