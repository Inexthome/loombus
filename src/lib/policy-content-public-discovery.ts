import "server-only";

import { PLATFORM_ROUTE_REGISTRY } from "@/lib/platform-route-registry";
import {
  policyContentRegistry,
  type PolicyDocumentFamily,
  type PolicyDocumentType,
} from "@/lib/policy-content-registry";
import { resolvePolicyCurrentVersionFromRegistry } from "@/lib/policy-content-resolver";

export type PublicPolicyDiscoveryCategory =
  | "Help"
  | "Policy"
  | "Safety"
  | "Legal"
  | "Reference";

export type PublicPolicyDiscoveryEntry = {
  documentId: string;
  title: string;
  description: string;
  href: string;
  category: PublicPolicyDiscoveryCategory;
  keywords: readonly string[];
};

function discoveryCategory(
  documentType: PolicyDocumentType,
): PublicPolicyDiscoveryCategory {
  if (documentType === "help") return "Help";
  if (documentType === "legal") return "Legal";
  if (documentType === "safety") return "Safety";
  if (documentType === "policy" || documentType === "room_governance") {
    return "Policy";
  }
  return "Reference";
}

function getLegacyPublicEntry(family: PolicyDocumentFamily) {
  if (family.migrationState !== "legacy_public_route") return null;

  const route = PLATFORM_ROUTE_REGISTRY.find(
    (candidate) => candidate.href === family.canonicalRoute,
  );
  if (!route) return null;

  return {
    documentId: family.documentId,
    title: route.title,
    description: route.description,
    href: family.canonicalRoute,
    category: discoveryCategory(family.documentType),
    keywords: [...route.keywords],
  } satisfies PublicPolicyDiscoveryEntry;
}

function getRegistryManagedPublicEntry(
  family: PolicyDocumentFamily,
  now: Date,
) {
  if (family.migrationState !== "registry_managed") return null;

  const resolution = resolvePolicyCurrentVersionFromRegistry(
    policyContentRegistry,
    family.documentId,
    now,
  );
  if (!resolution.resolved || !resolution.version) return null;

  const version = resolution.version;
  return {
    documentId: family.documentId,
    title: version.title,
    description: version.summary,
    href: version.canonicalRoute,
    category: discoveryCategory(version.documentType),
    keywords: [...version.searchKeywords],
  } satisfies PublicPolicyDiscoveryEntry;
}

export function getPublicPolicyDiscoveryEntries(now = new Date()) {
  const entries: PublicPolicyDiscoveryEntry[] = [];

  for (const family of policyContentRegistry.documentFamilies) {
    const entry =
      getRegistryManagedPublicEntry(family, now) ?? getLegacyPublicEntry(family);
    if (entry) entries.push(entry);
  }

  return entries;
}
