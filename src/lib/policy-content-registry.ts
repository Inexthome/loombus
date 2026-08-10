import registryData from "./policy-content-registry.data.json";

export const POLICY_CONTENT_SCHEMA_VERSION = "policy_content.v1" as const;

export const POLICY_DOCUMENT_TYPES = [
  "legal",
  "policy",
  "safety",
  "help",
  "room_governance",
  "transparency",
] as const;
export type PolicyDocumentType = (typeof POLICY_DOCUMENT_TYPES)[number];

export const POLICY_CATEGORIES = [
  "account",
  "privacy",
  "security",
  "content",
  "community",
  "messaging",
  "rooms",
  "ai",
  "search",
  "commerce",
  "jobs",
  "services",
  "marketplace",
  "billing",
  "accessibility",
  "developer",
  "legal_requests",
  "child_safety",
  "moderation",
  "appeals",
  "transparency",
] as const;
export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_AUDIENCES = [
  "public",
  "members",
  "room_owners",
  "creators",
  "businesses",
  "developers",
  "administrators",
  "internal_only",
] as const;
export type PolicyAudience = (typeof POLICY_AUDIENCES)[number];

export const POLICY_VERSION_STATUSES = [
  "internal_draft",
  "review",
  "approved",
  "scheduled",
  "effective",
  "superseded",
  "withdrawn",
] as const;
export type PolicyVersionStatus = (typeof POLICY_VERSION_STATUSES)[number];

export const POLICY_APPROVAL_STATES = [
  "pending",
  "approved",
  "changes_requested",
  "not_required",
] as const;
export type PolicyApprovalState = (typeof POLICY_APPROVAL_STATES)[number];

export const POLICY_MIGRATION_STATES = [
  "legacy_public_route",
  "registry_candidate",
  "registry_managed",
] as const;
export type PolicyMigrationState = (typeof POLICY_MIGRATION_STATES)[number];

export const POLICY_VERSION_PATTERN = /^\d{4}\.\d{2}\.\d{2}\.\d+$/;

export type PolicyApprovalRecord = {
  reviewerRole: string;
  state: PolicyApprovalState;
  approvedBy: string | null;
  approvedAt: string | null;
  sourceRevision: string;
  noteReference: string | null;
  reapprovalRequiredAfterChange: boolean;
};

export type PolicyDependencyRecord = {
  dependencyId: string;
  blocking: boolean;
  note: string | null;
};

export type PolicyPublicationBlocker = {
  blockerId: string;
  active: boolean;
  note: string | null;
};

export type PolicyRelatedLink = {
  label: string;
  href: string;
};

export type PolicyVersionRecord = {
  documentId: string;
  version: string;
  slug: string;
  canonicalRoute: string;
  title: string;
  summary: string;
  documentType: PolicyDocumentType;
  category: PolicyCategory;
  audience: PolicyAudience;
  status: PolicyVersionStatus;
  publicReady: boolean;
  effectiveAt: string | null;
  lastReviewedAt: string | null;
  owner: string;
  requiredReviewers: readonly string[];
  approvals: readonly PolicyApprovalRecord[];
  productDependencies: readonly PolicyDependencyRecord[];
  publicationBlockers: readonly PolicyPublicationBlocker[];
  relatedSettings: readonly PolicyRelatedLink[];
  relatedReports: readonly PolicyRelatedLink[];
  relatedAppeals: readonly PolicyRelatedLink[];
  relatedSupport: readonly PolicyRelatedLink[];
  relatedEmergencyActions: readonly PolicyRelatedLink[];
  relatedArticles: readonly string[];
  searchKeywords: readonly string[];
  jurisdiction: string;
  locale: string;
  sourceRevision: string;
  changeNote: string | null;
  supersedesVersion: string | null;
  replacementDocumentId: string | null;
  withdrawalReason: string | null;
  payloadPath: string;
};

export type PolicyDocumentFamily = {
  documentId: string;
  canonicalRoute: string;
  documentType: PolicyDocumentType;
  category: PolicyCategory;
  currentSourcePath: string;
  migrationState: PolicyMigrationState;
  registryManagedVersions: readonly PolicyVersionRecord[];
};

export type PolicyMigrationSource = {
  sourceId: string;
  directory: string;
  filenamePattern: string;
  minimumDocuments: number;
  defaultStatus: PolicyVersionStatus;
  defaultAudience: PolicyAudience;
  forcePublicReadyFalse: boolean;
  registryImportEnabled: boolean;
  publicRoutingEnabled: boolean;
};

export type PolicyContentRegistry = {
  schemaVersion: typeof POLICY_CONTENT_SCHEMA_VERSION;
  registryRoutingEnabled: boolean;
  archiveRoutingEnabled: boolean;
  defaultLocale: string;
  defaultJurisdiction: string;
  documentFamilies: readonly PolicyDocumentFamily[];
  migrationSources: readonly PolicyMigrationSource[];
};

export const policyContentRegistry = registryData as PolicyContentRegistry;

export type PolicyEligibilityReason =
  | "registry_routing_disabled"
  | "unknown_document_family"
  | "document_family_not_registry_managed"
  | "document_id_mismatch"
  | "canonical_route_mismatch"
  | "public_ready_false"
  | "audience_not_public"
  | "status_not_effective"
  | "effective_at_missing"
  | "effective_at_invalid"
  | "effective_at_in_future"
  | "required_approval_missing"
  | "required_approval_not_approved"
  | "approval_source_revision_mismatch"
  | "active_publication_blocker"
  | "source_revision_missing"
  | "version_format_invalid";

export type PolicyEligibilityResult = {
  eligible: boolean;
  reasons: PolicyEligibilityReason[];
};

const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<PolicyVersionStatus, readonly PolicyVersionStatus[]>> = {
  internal_draft: ["review"],
  review: ["internal_draft", "approved"],
  approved: ["review", "scheduled", "effective", "withdrawn"],
  scheduled: ["approved", "effective", "withdrawn"],
  effective: ["superseded", "withdrawn"],
  superseded: [],
  withdrawn: [],
};

export function isPolicyStatusTransitionAllowed(
  from: PolicyVersionStatus,
  to: PolicyVersionStatus,
): boolean {
  return ALLOWED_STATUS_TRANSITIONS[from].includes(to);
}

export function findPolicyDocumentFamily(documentId: string): PolicyDocumentFamily | null {
  return (
    policyContentRegistry.documentFamilies.find(
      (family) => family.documentId === documentId,
    ) ?? null
  );
}

export function evaluatePolicyVersionPublicationEligibility(
  family: PolicyDocumentFamily,
  version: PolicyVersionRecord,
  now = new Date(),
): PolicyEligibilityResult {
  const reasons: PolicyEligibilityReason[] = [];

  if (version.documentId !== family.documentId) {
    reasons.push("document_id_mismatch");
  }
  if (version.canonicalRoute !== family.canonicalRoute) {
    reasons.push("canonical_route_mismatch");
  }
  if (!POLICY_VERSION_PATTERN.test(version.version)) {
    reasons.push("version_format_invalid");
  }
  if (!version.sourceRevision.trim()) {
    reasons.push("source_revision_missing");
  }
  if (!version.publicReady) {
    reasons.push("public_ready_false");
  }
  if (version.audience !== "public") {
    reasons.push("audience_not_public");
  }
  if (version.status !== "effective") {
    reasons.push("status_not_effective");
  }

  if (!version.effectiveAt) {
    reasons.push("effective_at_missing");
  } else {
    const effectiveAt = new Date(version.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) {
      reasons.push("effective_at_invalid");
    } else if (effectiveAt.getTime() > now.getTime()) {
      reasons.push("effective_at_in_future");
    }
  }

  for (const reviewerRole of version.requiredReviewers) {
    const approval = version.approvals.find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (!approval) {
      reasons.push("required_approval_missing");
      continue;
    }
    if (approval.state !== "approved") {
      reasons.push("required_approval_not_approved");
      continue;
    }
    if (approval.sourceRevision !== version.sourceRevision) {
      reasons.push("approval_source_revision_mismatch");
    }
  }

  if (version.publicationBlockers.some((blocker) => blocker.active)) {
    reasons.push("active_publication_blocker");
  }

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function evaluatePolicyPublicServingEligibility(
  documentId: string,
  version: PolicyVersionRecord,
  now = new Date(),
): PolicyEligibilityResult {
  const reasons: PolicyEligibilityReason[] = [];
  const family = findPolicyDocumentFamily(documentId);

  if (!policyContentRegistry.registryRoutingEnabled) {
    reasons.push("registry_routing_disabled");
  }
  if (!family) {
    reasons.push("unknown_document_family");
    return { eligible: false, reasons };
  }
  if (family.migrationState !== "registry_managed") {
    reasons.push("document_family_not_registry_managed");
  }

  const versionResult = evaluatePolicyVersionPublicationEligibility(
    family,
    version,
    now,
  );
  reasons.push(...versionResult.reasons);

  return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export function isPolicyVersionPublicationEligible(
  family: PolicyDocumentFamily,
  version: PolicyVersionRecord,
  now = new Date(),
): boolean {
  return evaluatePolicyVersionPublicationEligibility(family, version, now).eligible;
}

export function canPolicyRegistryServePublicVersion(
  documentId: string,
  version: PolicyVersionRecord,
  now = new Date(),
): boolean {
  return evaluatePolicyPublicServingEligibility(documentId, version, now).eligible;
}
