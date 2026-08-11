import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const AUTHORIZED_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  canonicalRoute: "src/lib/policy-content-canonical-route.ts",
  accessibilityLayout: "src/app/accessibility/layout.tsx",
  accessibilityPage: "src/app/accessibility/page.tsx",
  accessibilityPayload:
    "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
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

function gitBlobRevision(content) {
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return `git-blob:${crypto
    .createHash("sha1")
    .update(Buffer.concat([header, bytes]))
    .digest("hex")}`;
}

const registry = JSON.parse(read(paths.registry));
const canonicalRouteSource = read(paths.canonicalRoute);
const layoutSource = read(paths.accessibilityLayout);
const pageSource = read(paths.accessibilityPage);
const accessibilityPayload = JSON.parse(read(paths.accessibilityPayload));

if (registry.registryRoutingEnabled !== true) {
  errors.push("production registryRoutingEnabled must be true after authorized activation");
}
if (registry.archiveRoutingEnabled !== true) {
  errors.push("production archiveRoutingEnabled must be true after authorized activation");
}

const family = registry.documentFamilies.find(
  (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
);
if (!family) {
  errors.push("POLICY-ACCESSIBILITY family is missing");
} else {
  if (family.migrationState !== "registry_managed") {
    errors.push("Accessibility family must be registry_managed after activation");
  }

  const version = family.registryManagedVersions.find(
    (candidate) => candidate.version === "2026.07.18.1",
  );
  if (!version) {
    errors.push("Accessibility version 2026.07.18.1 is missing");
  } else {
    if (version.status !== "effective") {
      errors.push("Accessibility version must be effective after publication activation");
    }
    if (version.publicReady !== true) {
      errors.push("Accessibility effective version must be publicReady=true");
    }
    if (version.effectiveAt !== AUTHORIZED_EFFECTIVE_AT) {
      errors.push("Accessibility effectiveAt must match the explicitly authorized timestamp");
    }
    const routeBlocker = version.publicationBlockers.find(
      (blocker) => blocker.blockerId === "registry_route_switchover_not_authorized",
    );
    if (!routeBlocker || routeBlocker.active !== false) {
      errors.push("registry_route_switchover_not_authorized must be inactive after authorization");
    }
    if (!routeBlocker?.note?.includes("5248313219")) {
      errors.push("route-switchover authorization note must cite Issue #671 comment 5248313219");
    }
    if (version.publicationBlockers.some((blocker) => blocker.active === true)) {
      errors.push("Accessibility effective version must have no active publication blocker");
    }

    const liveRevision = gitBlobRevision(pageSource);
    if (liveRevision !== version.sourceRevision) {
      errors.push(
        `live Accessibility source revision drifted: expected ${version.sourceRevision}, got ${liveRevision}`,
      );
    }
    if (accessibilityPayload.sourceRevision !== version.sourceRevision) {
      errors.push("Accessibility payload source revision does not match the effective registry version");
    }
    if (accessibilityPayload.version !== version.version) {
      errors.push("Accessibility payload version does not match the effective registry version");
    }
    if (accessibilityPayload.canonicalRoute !== family.canonicalRoute) {
      errors.push("Accessibility payload canonical route does not match the effective family");
    }
  }
}

for (const fragment of [
  'import "server-only"',
  "resolvePolicyCurrentVersionFromRegistry",
  "getPolicyPayloadSource",
  "payload_not_registered",
  "payload_document_id_mismatch",
  "payload_version_mismatch",
  "payload_path_mismatch",
  "payload_source_revision_mismatch",
  "payload_canonical_route_mismatch",
  "source.payloadPath !== current.version.payloadPath",
  "source.payload.sourceRevision !== current.version.sourceRevision",
  "source.payload.canonicalRoute !== current.family.canonicalRoute",
]) {
  expect(canonicalRouteSource, fragment, paths.canonicalRoute);
}
for (const forbidden of [
  "process.env",
  "cookies()",
  "headers()",
  "searchParams",
  "request.nextUrl",
  "readFileSync",
  "import(`",
]) {
  reject(canonicalRouteSource, forbidden, paths.canonicalRoute);
}

for (const fragment of [
  "StructuredPolicyRenderer",
  "resolvePolicyCanonicalRoutePayload",
  '"POLICY-ACCESSIBILITY"',
  "if (!resolution.resolved || !resolution.payload)",
  "return children;",
  "<StructuredPolicyRenderer payload={resolution.payload} />",
]) {
  expect(layoutSource, fragment, paths.accessibilityLayout);
}
for (const forbidden of [
  "process.env",
  "cookies()",
  "headers()",
  "searchParams",
  "redirect(",
  "notFound(",
]) {
  reject(layoutSource, forbidden, paths.accessibilityLayout);
}

reject(pageSource, "policy-content-canonical-route", paths.accessibilityPage);
reject(pageSource, "StructuredPolicyRenderer", paths.accessibilityPage);

function approval(sourceRevision) {
  return {
    reviewerRole: "Product Owner",
    state: "approved",
    sourceRevision,
  };
}

function fixtureVersion({
  status = "effective",
  publicReady = true,
  effectiveAt = "2026-08-10T00:00:00.000Z",
  sourceRevision = "sha256:fixture",
  blockers = [],
} = {}) {
  return {
    documentId: "TEST-POLICY",
    version: "2026.08.10.1",
    canonicalRoute: "/test-policy",
    audience: "public",
    status,
    publicReady,
    effectiveAt,
    sourceRevision,
    payloadPath: "src/content/policies/TEST-POLICY/2026.08.10.1.json",
    requiredReviewers: ["Product Owner"],
    approvals: [approval(sourceRevision)],
    publicationBlockers: blockers,
  };
}

function fixtureRegistry({
  routingEnabled = true,
  migrationState = "registry_managed",
  versions = [fixtureVersion()],
} = {}) {
  return {
    registryRoutingEnabled: routingEnabled,
    documentFamilies: [
      {
        documentId: "TEST-POLICY",
        canonicalRoute: "/test-policy",
        migrationState,
        registryManagedVersions: versions,
      },
    ],
  };
}

function publicationProblems(fixtureFamily, version, now) {
  const problems = [];
  if (version.documentId !== fixtureFamily.documentId) problems.push("document_id_mismatch");
  if (version.canonicalRoute !== fixtureFamily.canonicalRoute) problems.push("canonical_route_mismatch");
  if (version.publicReady !== true) problems.push("public_ready_false");
  if (version.audience !== "public") problems.push("audience_not_public");
  if (version.status !== "effective") problems.push("status_not_effective");
  const effectiveAt = Date.parse(version.effectiveAt ?? "");
  if (!Number.isFinite(effectiveAt)) problems.push("effective_at_missing");
  else if (effectiveAt > now) problems.push("effective_at_in_future");
  if (version.publicationBlockers.some((blocker) => blocker.active === true)) {
    problems.push("active_publication_blocker");
  }
  for (const role of version.requiredReviewers) {
    const record = version.approvals.find((entry) => entry.reviewerRole === role);
    if (!record || record.state !== "approved") problems.push("required_approval_not_approved");
    else if (record.sourceRevision !== version.sourceRevision) {
      problems.push("approval_source_revision_mismatch");
    }
  }
  return [...new Set(problems)];
}

function resolveFixtureCurrent(sourceRegistry, documentId, now) {
  if (sourceRegistry.registryRoutingEnabled !== true) {
    return { resolved: false, reasons: ["registry_routing_disabled"], family: null, version: null };
  }
  const fixtureFamily = sourceRegistry.documentFamilies.find(
    (candidate) => candidate.documentId === documentId,
  );
  if (!fixtureFamily) {
    return { resolved: false, reasons: ["unknown_document_family"], family: null, version: null };
  }
  if (fixtureFamily.migrationState !== "registry_managed") {
    return {
      resolved: false,
      reasons: ["document_family_not_registry_managed"],
      family: fixtureFamily,
      version: null,
    };
  }
  const eligible = fixtureFamily.registryManagedVersions.filter(
    (version) => publicationProblems(fixtureFamily, version, now).length === 0,
  );
  if (eligible.length !== 1) {
    return {
      resolved: false,
      reasons: [eligible.length === 0 ? "no_public_effective_version" : "multiple_public_effective_versions"],
      family: fixtureFamily,
      version: null,
    };
  }
  return { resolved: true, reasons: [], family: fixtureFamily, version: eligible[0] };
}

function resolveFixtureCanonical(sourceRegistry, documentId, payloadSource, now) {
  const current = resolveFixtureCurrent(sourceRegistry, documentId, now);
  if (!current.resolved) return current;
  if (!payloadSource) {
    return { ...current, resolved: false, reasons: ["payload_not_registered"] };
  }
  const reasons = [];
  if (payloadSource.documentId !== current.version.documentId) reasons.push("payload_document_id_mismatch");
  if (payloadSource.version !== current.version.version) reasons.push("payload_version_mismatch");
  if (payloadSource.payloadPath !== current.version.payloadPath) reasons.push("payload_path_mismatch");
  if (payloadSource.payload.sourceRevision !== current.version.sourceRevision) reasons.push("payload_source_revision_mismatch");
  if (payloadSource.payload.canonicalRoute !== current.family.canonicalRoute) reasons.push("payload_canonical_route_mismatch");
  return {
    ...current,
    resolved: reasons.length === 0,
    reasons,
  };
}

const productionVersion = family?.registryManagedVersions.find(
  (candidate) => candidate.version === "2026.07.18.1",
);
if (productionVersion) {
  const productionPayloadSource = {
    documentId: "POLICY-ACCESSIBILITY",
    version: "2026.07.18.1",
    payloadPath: productionVersion.payloadPath,
    payload: accessibilityPayload,
  };
  const productionResult = resolveFixtureCanonical(
    registry,
    "POLICY-ACCESSIBILITY",
    productionPayloadSource,
    Date.parse("2026-08-11T02:24:01.000Z"),
  );
  if (!productionResult.resolved || productionResult.version?.version !== "2026.07.18.1") {
    errors.push(`production: activated Accessibility canonical route did not resolve: ${productionResult.reasons.join(", ")}`);
  }
}

const now = Date.parse("2026-08-10T12:00:00.000Z");
const eligibleVersion = fixtureVersion();
const validPayload = {
  documentId: eligibleVersion.documentId,
  version: eligibleVersion.version,
  payloadPath: eligibleVersion.payloadPath,
  payload: {
    sourceRevision: eligibleVersion.sourceRevision,
    canonicalRoute: eligibleVersion.canonicalRoute,
  },
};

const disabled = resolveFixtureCanonical(
  fixtureRegistry({ routingEnabled: false }),
  "TEST-POLICY",
  validPayload,
  now,
);
if (disabled.resolved || !disabled.reasons.includes("registry_routing_disabled")) {
  errors.push("fixture: disabled registry routing did not preserve legacy fallback");
}

const candidateFamily = resolveFixtureCanonical(
  fixtureRegistry({ migrationState: "registry_candidate" }),
  "TEST-POLICY",
  validPayload,
  now,
);
if (
  candidateFamily.resolved ||
  !candidateFamily.reasons.includes("document_family_not_registry_managed")
) {
  errors.push("fixture: registry_candidate family became canonical-route eligible");
}

const approvedOnly = fixtureVersion({ status: "approved" });
const approvedResult = resolveFixtureCanonical(
  fixtureRegistry({ versions: [approvedOnly] }),
  "TEST-POLICY",
  {
    ...validPayload,
    payload: { ...validPayload.payload, sourceRevision: approvedOnly.sourceRevision },
  },
  now,
);
if (approvedResult.resolved || !approvedResult.reasons.includes("no_public_effective_version")) {
  errors.push("fixture: approved lifecycle state became publicly routable without effective status");
}

const activeBlocker = fixtureVersion({
  blockers: [{ blockerId: "route", active: true }],
});
const blockedResult = resolveFixtureCanonical(
  fixtureRegistry({ versions: [activeBlocker] }),
  "TEST-POLICY",
  validPayload,
  now,
);
if (blockedResult.resolved || !blockedResult.reasons.includes("no_public_effective_version")) {
  errors.push("fixture: active publication blocker did not keep canonical route closed");
}

const eligibleResult = resolveFixtureCanonical(
  fixtureRegistry({ versions: [eligibleVersion] }),
  "TEST-POLICY",
  validPayload,
  now,
);
if (!eligibleResult.resolved) {
  errors.push(`fixture: fully eligible canonical route did not resolve: ${eligibleResult.reasons.join(", ")}`);
}

for (const [label, alteredPayload, expectedReason] of [
  [
    "payload path",
    { ...validPayload, payloadPath: "src/content/policies/TEST-POLICY/wrong.json" },
    "payload_path_mismatch",
  ],
  [
    "source revision",
    {
      ...validPayload,
      payload: { ...validPayload.payload, sourceRevision: "sha256:different" },
    },
    "payload_source_revision_mismatch",
  ],
  [
    "canonical route",
    {
      ...validPayload,
      payload: { ...validPayload.payload, canonicalRoute: "/wrong" },
    },
    "payload_canonical_route_mismatch",
  ],
]) {
  const result = resolveFixtureCanonical(
    fixtureRegistry({ versions: [eligibleVersion] }),
    "TEST-POLICY",
    alteredPayload,
    now,
  );
  if (result.resolved || !result.reasons.includes(expectedReason)) {
    errors.push(`fixture: ${label} mismatch did not fail closed with ${expectedReason}`);
  }
}

if (errors.length > 0) {
  console.error("Policy canonical-route activation verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy canonical-route activation verification PASSED");
console.log("- live Accessibility source remains exact reviewed revision");
console.log("- Accessibility route adapter is active only through the validated canonical resolver");
console.log("- production registry and archive routing are enabled");
console.log(`- Accessibility is registry_managed, effective, publicReady=true, effectiveAt=${AUTHORIZED_EFFECTIVE_AT}`);
console.log("- route-switchover blocker is inactive by explicit Issue #671 authorization");
console.log("- production activated canonical route resolves the exact reviewed payload");
console.log("- canonical resolver validates registry eligibility plus payload path/source/canonical identity");
console.log("- disabled/candidate/approved/blocker fixtures still fail closed");
console.log("- fully eligible fixture resolves only after all publication gates are satisfied");
console.log("- payload identity mismatch fixtures fail closed");
