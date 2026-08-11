import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const AUTHORIZED_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  history: "src/lib/policy-content-history.ts",
  payloadRegistry: "src/lib/policy-content-payload-registry.ts",
  archiveRoute: "src/app/policies/archive/[documentId]/[version]/page.tsx",
  historyRoute: "src/app/policies/history/[documentId]/page.tsx",
  liveAccessibility: "src/app/accessibility/page.tsx",
};

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    errors.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) {
    errors.push(`${context}: missing expected fragment ${JSON.stringify(fragment)}`);
  }
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) {
    errors.push(`${context}: forbidden fragment present ${JSON.stringify(fragment)}`);
  }
}

const registry = JSON.parse(read(paths.registry));
const historySource = read(paths.history);
const payloadRegistrySource = read(paths.payloadRegistry);
const archiveRouteSource = read(paths.archiveRoute);
const historyRouteSource = read(paths.historyRoute);
const liveAccessibilitySource = read(paths.liveAccessibility);

if (registry.registryRoutingEnabled !== true) {
  errors.push("production registry routing must be enabled after Accessibility activation");
}
if (registry.archiveRoutingEnabled !== true) {
  errors.push("production archive routing must be enabled after Accessibility activation");
}

const accessibility = registry.documentFamilies.find(
  (family) => family.documentId === "POLICY-ACCESSIBILITY",
);
if (!accessibility) {
  errors.push("POLICY-ACCESSIBILITY family is missing");
} else {
  if (accessibility.migrationState !== "registry_managed") {
    errors.push("Accessibility must be registry_managed after activation");
  }
  const candidate = accessibility.registryManagedVersions.find(
    (version) => version.version === "2026.07.18.1",
  );
  if (!candidate) {
    errors.push("Accessibility version 2026.07.18.1 is missing");
  } else {
    if (candidate.status !== "effective") errors.push("Accessibility version must be status=effective");
    if (candidate.publicReady !== true) errors.push("Accessibility effective version must be publicReady=true");
    if (candidate.effectiveAt !== AUTHORIZED_EFFECTIVE_AT) errors.push("Accessibility effectiveAt does not match explicit authorization");
    for (const role of ["Product Owner", "Accessibility"]) {
      const approval = candidate.approvals.find(
        (entry) => entry.reviewerRole === role,
      );
      if (approval?.state !== "approved") {
        errors.push(`${role} reviewer approval must remain approved`);
      }
      if (approval?.sourceRevision !== candidate.sourceRevision) {
        errors.push(`${role} reviewer approval must remain bound to the exact source revision`);
      }
    }
    const routeBlocker = candidate.publicationBlockers.find(
      (blocker) => blocker.blockerId === "registry_route_switchover_not_authorized",
    );
    if (routeBlocker?.active !== false) {
      errors.push("route-switchover blocker must be inactive after authorization");
    }
    if (!routeBlocker?.note?.includes("5248313219")) {
      errors.push("route-switchover blocker note must cite Issue #671 authorization comment");
    }
    if (candidate.publicationBlockers.some((blocker) => blocker.active === true)) {
      errors.push("Accessibility effective version must have no active publication blocker");
    }
  }
}

for (const fragment of [
  "resolvePolicyPublicHistoryFromRegistry",
  "archive_routing_disabled",
  "document_family_not_registry_managed",
  "resolvePolicyArchiveVersionFromRegistry",
  "policyArchiveHref",
  "/policies/archive/",
]) {
  expect(historySource, fragment, paths.history);
}

for (const fragment of [
  'import "server-only"',
  "POLICY-ACCESSIBILITY/2026.07.18.1.json",
  "validateStructuredPolicyPayload",
  "getPolicyPayloadSource",
]) {
  expect(payloadRegistrySource, fragment, paths.payloadRegistry);
}
for (const forbidden of ["import(`", "readFileSync", "request.nextUrl", "searchParams"]) {
  reject(payloadRegistrySource, forbidden, paths.payloadRegistry);
}

for (const fragment of [
  "resolvePolicyArchiveVersion",
  "getPolicyPayloadSource",
  "notFound()",
  "StructuredPolicyRenderer",
  "View current",
]) {
  expect(archiveRouteSource, fragment, paths.archiveRoute);
}
for (const forbidden of ["readFileSync", "import(`", "approvedBy", "publicationBlockers"]) {
  reject(archiveRouteSource, forbidden, paths.archiveRoute);
}

for (const fragment of [
  "resolvePolicyPublicHistory",
  "notFound()",
  "View exact version",
  "Internal review notes, publication blockers, and reviewer details are not included.",
]) {
  expect(historyRouteSource, fragment, paths.historyRoute);
}
for (const forbidden of [
  "approvedBy",
  "approvedAt",
  "approvals",
  "sourceRevision",
  "publicationBlockers.map",
  "productDependencies",
]) {
  reject(historyRouteSource, forbidden, paths.historyRoute);
}

reject(liveAccessibilitySource, "policy-content-history", "legacy Accessibility parity source");
reject(liveAccessibilitySource, "policy-content-resolver", "legacy Accessibility parity source");
reject(liveAccessibilitySource, "policy-content-payload-registry", "legacy Accessibility parity source");

function approval(sourceRevision) {
  return {
    reviewerRole: "Product Owner",
    state: "approved",
    approvedBy: "fixture-reviewer",
    approvedAt: "2026-08-10T00:00:00.000Z",
    sourceRevision,
  };
}

function fixtureVersion({ version, status, sourceRevision, effectiveAt }) {
  return {
    documentId: "TEST-POLICY",
    version,
    title: "Test Policy",
    canonicalRoute: "/test-policy",
    status,
    publicReady: true,
    audience: "public",
    sourceRevision,
    effectiveAt,
    requiredReviewers: ["Product Owner"],
    approvals: [approval(sourceRevision)],
    publicationBlockers: [],
    changeNote: `${version} note`,
  };
}

function publicationEligible(family, version, now) {
  if (version.documentId !== family.documentId) return false;
  if (version.canonicalRoute !== family.canonicalRoute) return false;
  if (version.publicReady !== true || version.audience !== "public") return false;
  if (version.status !== "effective" && version.status !== "superseded") return false;
  const effectiveAt = Date.parse(version.effectiveAt ?? "");
  if (!Number.isFinite(effectiveAt) || effectiveAt > now) return false;
  if (version.publicationBlockers.some((blocker) => blocker.active === true)) return false;
  return version.requiredReviewers.every((role) => {
    const record = version.approvals.find((entry) => entry.reviewerRole === role);
    return record?.state === "approved" && record.sourceRevision === version.sourceRevision;
  });
}

function publicHistory(fixtureRegistry, documentId, now) {
  if (fixtureRegistry.archiveRoutingEnabled !== true) return [];
  const family = fixtureRegistry.documentFamilies.find(
    (entry) => entry.documentId === documentId,
  );
  if (!family || family.migrationState !== "registry_managed") return [];
  return family.registryManagedVersions
    .filter((version) => publicationEligible(family, version, now))
    .sort((left, right) => Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt))
    .map((version) => ({
      version: version.version,
      href: `/policies/archive/${encodeURIComponent(documentId)}/${encodeURIComponent(version.version)}`,
    }));
}

const productionHistory = publicHistory(
  registry,
  "POLICY-ACCESSIBILITY",
  Date.parse("2026-08-11T02:24:01.000Z"),
);
if (productionHistory.length !== 1 || productionHistory[0]?.version !== "2026.07.18.1") {
  errors.push("production: Accessibility public history must expose exactly the activated effective version");
}
if (!productionHistory[0]?.href.endsWith("/POLICY-ACCESSIBILITY/2026.07.18.1")) {
  errors.push("production: Accessibility exact-version archive href is incorrect");
}

const oldVersion = fixtureVersion({
  version: "2026.07.01.1",
  status: "superseded",
  sourceRevision: "sha256:old",
  effectiveAt: "2026-07-01T00:00:00.000Z",
});
const currentVersion = fixtureVersion({
  version: "2026.08.01.1",
  status: "effective",
  sourceRevision: "sha256:current",
  effectiveAt: "2026-08-01T00:00:00.000Z",
});
const reviewVersion = fixtureVersion({
  version: "2026.08.09.1",
  status: "review",
  sourceRevision: "sha256:review",
  effectiveAt: "2026-08-09T00:00:00.000Z",
});
const approvedVersion = fixtureVersion({
  version: "2026.08.10.1",
  status: "approved",
  sourceRevision: "sha256:approved",
  effectiveAt: "2026-08-10T00:00:00.000Z",
});
const fixtureRegistry = {
  archiveRoutingEnabled: true,
  documentFamilies: [
    {
      documentId: "TEST-POLICY",
      canonicalRoute: "/test-policy",
      migrationState: "registry_managed",
      registryManagedVersions: [oldVersion, currentVersion, reviewVersion, approvedVersion],
    },
  ],
};
const now = Date.parse("2026-08-10T00:00:00.000Z");
const history = publicHistory(fixtureRegistry, "TEST-POLICY", now);
if (history.length !== 2) {
  errors.push(`fixture: expected two public history versions, found ${history.length}`);
}
if (history[0]?.version !== "2026.08.01.1" || history[1]?.version !== "2026.07.01.1") {
  errors.push("fixture: public history is not ordered current-to-oldest");
}
if (history.some((entry) => entry.version === reviewVersion.version)) {
  errors.push("fixture: review version leaked into public history");
}
if (history.some((entry) => entry.version === approvedVersion.version)) {
  errors.push("fixture: approved version leaked into public history");
}
if (!history[1]?.href.endsWith("/TEST-POLICY/2026.07.01.1")) {
  errors.push("fixture: exact historical route identity is incorrect");
}
if (
  publicHistory(
    { ...fixtureRegistry, archiveRoutingEnabled: false },
    "TEST-POLICY",
    now,
  ).length !== 0
) {
  errors.push("fixture: disabled archive routing did not fail closed");
}

const mismatched = {
  ...fixtureRegistry,
  documentFamilies: [
    {
      ...fixtureRegistry.documentFamilies[0],
      registryManagedVersions: [
        {
          ...oldVersion,
          approvals: [approval("sha256:different")],
        },
      ],
    },
  ],
};
if (publicHistory(mismatched, "TEST-POLICY", now).length !== 0) {
  errors.push("fixture: approval/source mismatch leaked into public history");
}

if (errors.length > 0) {
  console.error("Policy history/archive foundation verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy history/archive foundation verification PASSED");
console.log("- production archive routing enabled: true");
console.log("- production registry routing enabled: true");
console.log("- Accessibility is effective and registry-managed");
console.log(`- Accessibility effectiveAt: ${AUTHORIZED_EFFECTIVE_AT}`);
console.log("- exact archive route is gated by trusted registry resolution");
console.log("- production history exposes the exact activated version without private approval metadata");
console.log("- public history excludes review/approved versions and private approval metadata");
console.log("- synthetic superseded-version exact route: PASS");
console.log("- archive-disabled fail-closed fixture: PASS");
console.log("- approval/source mismatch fail-closed fixture: PASS");
