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

export type PolicyScheduledTransitionReason =
  | PolicyEligibilityReason
  | "no_stored_public_effective_version"
  | "multiple_stored_public_effective_versions"
  | "multiple_due_successors_for_predecessor"
  | "due_scheduled_chain_disconnected";

export type PolicyScheduledTransitionState =
  | "none"
  | "pending"
  | "activated"
  | "blocked";

export type PolicyLifecycleProjectionResult = {
  family: PolicyDocumentFamily;
  versions: PolicyVersionRecord[];
  currentVersion: PolicyVersionRecord | null;
  transitionState: PolicyScheduledTransitionState;
  activatedVersions: readonly string[];
  blockedReasons: readonly PolicyScheduledTransitionReason[];
};

export type PolicyResolutionResult = {
  resolved: boolean;
  reasons: PolicyResolutionReason[];
  family: PolicyDocumentFamily | null;
  version: PolicyVersionRecord | null;
};

function uniqueReasons<T extends string>(reasons: readonly T[]) {
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

function effectiveTime(version: PolicyVersionRecord) {
  if (!version.effectiveAt) return null;
  const parsed = new Date(version.effectiveAt).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizedEffectiveVersion(version: PolicyVersionRecord) {
  return version.status === "effective"
    ? version
    : ({ ...version, status: "effective" } satisfies PolicyVersionRecord);
}

function evaluateProjectedPublicationEligibility(
  family: PolicyDocumentFamily,
  version: PolicyVersionRecord,
  now: Date,
) {
  return evaluatePolicyVersionPublicationEligibility(
    family,
    normalizedEffectiveVersion(version),
    now,
  );
}

/**
 * Project a registry-managed family to the public lifecycle state that applies at
 * `now` without mutating repository records.
 *
 * Stored `effective`/`superseded` records remain the durable audit source. A
 * scheduled successor is projected into the public lifecycle only after its
 * effective timestamp and only when the exact predecessor chain and every
 * publication gate still pass. Ambiguity or approval/source/blocker drift fails
 * closed at that transition point and leaves the last valid current version live.
 */
export function projectPolicyFamilyPublicLifecycle(
  family: PolicyDocumentFamily,
  now = new Date(),
): PolicyLifecycleProjectionResult {
  const versions = family.registryManagedVersions.map((version) => ({ ...version }));
  const storedPublicEffective = versions.filter(
    (version) =>
      version.status === "effective" &&
      evaluatePolicyVersionPublicationEligibility(family, version, now).eligible,
  );
  const scheduled = versions.filter((version) => version.status === "scheduled");

  if (storedPublicEffective.length === 0) {
    return {
      family,
      versions,
      currentVersion: null,
      transitionState: scheduled.length > 0 ? "blocked" : "none",
      activatedVersions: [],
      blockedReasons:
        scheduled.length > 0 ? ["no_stored_public_effective_version"] : [],
    };
  }

  if (storedPublicEffective.length > 1) {
    return {
      family,
      versions,
      currentVersion: null,
      transitionState: "blocked",
      activatedVersions: [],
      blockedReasons: ["multiple_stored_public_effective_versions"],
    };
  }

  let current = storedPublicEffective[0];
  const nowMs = now.getTime();
  const due = scheduled
    .filter((version) => {
      const timestamp = effectiveTime(version);
      return timestamp !== null && timestamp <= nowMs;
    })
    .sort((left, right) => {
      const byTime = (effectiveTime(left) ?? 0) - (effectiveTime(right) ?? 0);
      return byTime !== 0 ? byTime : left.version.localeCompare(right.version);
    });
  const pending = scheduled.some((version) => {
    const timestamp = effectiveTime(version);
    return timestamp !== null && timestamp > nowMs;
  });
  const activatedVersions: string[] = [];
  const blockedReasons: PolicyScheduledTransitionReason[] = [];
  const remaining = [...due];

  while (remaining.length > 0) {
    const successors = remaining.filter(
      (candidate) => candidate.supersedesVersion === current.version,
    );

    if (successors.length === 0) {
      blockedReasons.push("due_scheduled_chain_disconnected");
      break;
    }
    if (successors.length > 1) {
      blockedReasons.push("multiple_due_successors_for_predecessor");
      break;
    }

    const candidate = successors[0];
    const eligibility = evaluateProjectedPublicationEligibility(
      family,
      candidate,
      now,
    );
    if (!eligibility.eligible) {
      blockedReasons.push(...eligibility.reasons);
      break;
    }

    const currentIndex = versions.findIndex(
      (version) => version.version === current.version,
    );
    const candidateIndex = versions.findIndex(
      (version) => version.version === candidate.version,
    );
    if (currentIndex < 0 || candidateIndex < 0) {
      blockedReasons.push("due_scheduled_chain_disconnected");
      break;
    }

    versions[currentIndex] = {
      ...versions[currentIndex],
      status: "superseded",
    };
    versions[candidateIndex] = {
      ...versions[candidateIndex],
      status: "effective",
    };
    current = versions[candidateIndex];
    activatedVersions.push(candidate.version);
    remaining.splice(remaining.indexOf(candidate), 1);
  }

  const blocked = blockedReasons.length > 0;
  return {
    family,
    versions,
    currentVersion: current,
    transitionState: blocked
      ? "blocked"
      : activatedVersions.length > 0
        ? "activated"
        : pending
          ? "pending"
          : "none",
    activatedVersions,
    blockedReasons: uniqueReasons(blockedReasons),
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

  const projection = projectPolicyFamilyPublicLifecycle(family, now);
  const eligible = projection.versions.filter(
    (version) =>
      version.status === "effective" &&
      evaluatePolicyVersionPublicationEligibility(family, version, now).eligible,
  );

  if (eligible.length === 0) {
    return unresolved(["no_public_effective_version"], family);
  }

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

  const projection = projectPolicyFamilyPublicLifecycle(family, now);
  const version =
    projection.versions.find(
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
