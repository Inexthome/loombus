import "server-only";

import {
  policyContentRegistry,
  type PolicyContentRegistry,
  type PolicyDocumentFamily,
} from "@/lib/policy-content-registry";
import {
  projectPolicyFamilyPublicLifecycle,
  resolvePolicyArchiveVersionFromRegistry,
  type PolicyResolutionReason,
} from "@/lib/policy-content-resolver";

export type PolicyHistoryReason =
  | PolicyResolutionReason
  | "no_public_history";

export type PolicyHistoryEntry = {
  documentId: string;
  version: string;
  title: string;
  status: "effective" | "superseded";
  effectiveAt: string;
  changeNote: string | null;
  canonicalRoute: string;
  archiveHref: string;
};

export type PolicyHistoryResult = {
  visible: boolean;
  reasons: PolicyHistoryReason[];
  family: PolicyDocumentFamily | null;
  entries: PolicyHistoryEntry[];
};

export function policyArchiveHref(documentId: string, version: string) {
  return `/policies/archive/${encodeURIComponent(documentId)}/${encodeURIComponent(version)}`;
}

export function policyHistoryHref(documentId: string) {
  return `/policies/history/${encodeURIComponent(documentId)}`;
}

export function resolvePolicyPublicHistoryFromRegistry(
  registry: PolicyContentRegistry,
  documentId: string,
  now = new Date(),
): PolicyHistoryResult {
  if (!registry.archiveRoutingEnabled) {
    return {
      visible: false,
      reasons: ["archive_routing_disabled"],
      family: null,
      entries: [],
    };
  }

  const family =
    registry.documentFamilies.find(
      (candidate) => candidate.documentId === documentId,
    ) ?? null;

  if (!family) {
    return {
      visible: false,
      reasons: ["unknown_document_family"],
      family: null,
      entries: [],
    };
  }

  if (family.migrationState !== "registry_managed") {
    return {
      visible: false,
      reasons: ["document_family_not_registry_managed"],
      family,
      entries: [],
    };
  }

  const projection = projectPolicyFamilyPublicLifecycle(family, now);
  const entries: PolicyHistoryEntry[] = [];

  for (const version of projection.versions) {
    if (version.status !== "effective" && version.status !== "superseded") {
      continue;
    }

    const resolution = resolvePolicyArchiveVersionFromRegistry(
      registry,
      documentId,
      version.version,
      now,
    );
    if (!resolution.resolved || !resolution.version?.effectiveAt) {
      continue;
    }

    entries.push({
      documentId: family.documentId,
      version: resolution.version.version,
      title: resolution.version.title,
      status: resolution.version.status as "effective" | "superseded",
      effectiveAt: resolution.version.effectiveAt,
      changeNote: resolution.version.changeNote,
      canonicalRoute: family.canonicalRoute,
      archiveHref: policyArchiveHref(
        family.documentId,
        resolution.version.version,
      ),
    });
  }

  entries.sort((left, right) => {
    const byDate = Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt);
    if (byDate !== 0) return byDate;
    return right.version.localeCompare(left.version);
  });

  if (entries.length === 0) {
    return {
      visible: false,
      reasons: ["no_public_history"],
      family,
      entries: [],
    };
  }

  return {
    visible: true,
    reasons: [],
    family,
    entries,
  };
}

export function resolvePolicyPublicHistory(
  documentId: string,
  now = new Date(),
): PolicyHistoryResult {
  return resolvePolicyPublicHistoryFromRegistry(
    policyContentRegistry,
    documentId,
    now,
  );
}
