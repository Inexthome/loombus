import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registry = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/lib/policy-content-registry.data.json"),
    "utf8",
  ),
);
const resolverSource = fs.readFileSync(
  path.join(root, "src/lib/policy-content-resolver.ts"),
  "utf8",
);
const reviewPath =
  "docs/policy-content/reviews/POLICY-ACCESSIBILITY-2026.07.18.1-review.md";
const reviewSource = fs.readFileSync(path.join(root, reviewPath), "utf8");
const errors = [];

function fail(message) {
  errors.push(message);
}

function requireSourceFragment(source, fragment, context) {
  if (!source.includes(fragment)) {
    fail(`${context}: missing required fragment ${JSON.stringify(fragment)}`);
  }
}

function findFamily(sourceRegistry, documentId) {
  return (
    sourceRegistry.documentFamilies.find(
      (candidate) => candidate.documentId === documentId,
    ) ?? null
  );
}

function publicationProblems(family, version, now) {
  const problems = [];
  if (version.documentId !== family.documentId) problems.push("document_id_mismatch");
  if (version.canonicalRoute !== family.canonicalRoute) problems.push("canonical_route_mismatch");
  if (version.publicReady !== true) problems.push("public_ready_false");
  if (version.audience !== "public") problems.push("audience_not_public");
  if (version.status !== "effective") problems.push("status_not_effective");
  if (typeof version.sourceRevision !== "string" || !version.sourceRevision.trim()) {
    problems.push("source_revision_missing");
  }
  const effectiveAt = Date.parse(version.effectiveAt ?? "");
  if (!Number.isFinite(effectiveAt)) problems.push("effective_at_missing");
  else if (effectiveAt > now) problems.push("effective_at_in_future");

  for (const reviewerRole of version.requiredReviewers ?? []) {
    const approval = (version.approvals ?? []).find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (!approval) {
      problems.push("required_approval_missing");
      continue;
    }
    if (approval.state !== "approved") {
      problems.push("required_approval_not_approved");
      continue;
    }
    if (approval.sourceRevision !== version.sourceRevision) {
      problems.push("approval_source_revision_mismatch");
    }
  }

  if ((version.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
    problems.push("active_publication_blocker");
  }

  return [...new Set(problems)];
}

function resolveCurrent(sourceRegistry, documentId, now) {
  if (sourceRegistry.registryRoutingEnabled !== true) {
    return { resolved: false, reasons: ["registry_routing_disabled"], version: null };
  }
  const family = findFamily(sourceRegistry, documentId);
  if (!family) return { resolved: false, reasons: ["unknown_document_family"], version: null };
  if (family.migrationState !== "registry_managed") {
    return {
      resolved: false,
      reasons: ["document_family_not_registry_managed"],
      version: null,
    };
  }
  const eligible = family.registryManagedVersions.filter(
    (version) =>
      version.status === "effective" &&
      publicationProblems(family, version, now).length === 0,
  );
  if (eligible.length === 0) {
    return { resolved: false, reasons: ["no_public_effective_version"], version: null };
  }
  if (eligible.length > 1) {
    return {
      resolved: false,
      reasons: ["multiple_public_effective_versions"],
      version: null,
    };
  }
  return { resolved: true, reasons: [], version: eligible[0] };
}

function resolveArchive(sourceRegistry, documentId, versionId, now) {
  if (sourceRegistry.archiveRoutingEnabled !== true) {
    return { resolved: false, reasons: ["archive_routing_disabled"], version: null };
  }
  const family = findFamily(sourceRegistry, documentId);
  if (!family) return { resolved: false, reasons: ["unknown_document_family"], version: null };
  if (family.migrationState !== "registry_managed") {
    return {
      resolved: false,
      reasons: ["document_family_not_registry_managed"],
      version: null,
    };
  }
  const version =
    family.registryManagedVersions.find(
      (candidate) => candidate.version === versionId,
    ) ?? null;
  if (!version) return { resolved: false, reasons: ["version_not_found"], version: null };
  if (version.status !== "effective" && version.status !== "superseded") {
    return {
      resolved: false,
      reasons: ["historical_status_not_servable"],
      version,
    };
  }
  const normalized =
    version.status === "superseded" ? { ...version, status: "effective" } : version;
  const problems = publicationProblems(family, normalized, now);
  if (problems.length > 0) return { resolved: false, reasons: problems, version };
  return { resolved: true, reasons: [], version };
}

if (registry.registryRoutingEnabled !== false) {
  fail("production registryRoutingEnabled must remain false in Phase E");
}
if (registry.archiveRoutingEnabled !== false) {
  fail("production archiveRoutingEnabled must remain false in Phase E");
}

const accessibility = findFamily(registry, "POLICY-ACCESSIBILITY");
if (!accessibility) {
  fail("POLICY-ACCESSIBILITY family is missing");
} else {
  if (accessibility.migrationState !== "registry_candidate") {
    fail("POLICY-ACCESSIBILITY must remain registry_candidate");
  }
  const candidate = accessibility.registryManagedVersions.find(
    (version) => version.version === "2026.07.18.1",
  );
  if (!candidate) {
    fail("POLICY-ACCESSIBILITY 2026.07.18.1 candidate is missing");
  } else {
    if (candidate.status !== "review") fail("Accessibility candidate status must remain review");
    if (candidate.publicReady !== false) fail("Accessibility candidate publicReady must remain false");
    if (candidate.effectiveAt !== null) fail("Accessibility candidate effectiveAt must remain null");
    const productOwner = candidate.approvals.find(
      (approval) => approval.reviewerRole === "Product Owner",
    );
    const accessibilityApproval = candidate.approvals.find(
      (approval) => approval.reviewerRole === "Accessibility",
    );
    if (productOwner?.state !== "pending") fail("Product Owner approval must remain pending");
    if (accessibilityApproval?.state !== "pending") fail("Accessibility approval must remain pending");
    if (productOwner?.noteReference !== reviewPath) {
      fail("Product Owner approval must reference the exact Phase E review record");
    }
    if (accessibilityApproval?.noteReference !== reviewPath) {
      fail("Accessibility approval must reference the exact Phase E review record");
    }
    if (!(candidate.productDependencies ?? []).some((dependency) => dependency.blocking === true)) {
      fail("Accessibility candidate must retain a blocking product dependency");
    }
    if (!(candidate.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
      fail("Accessibility candidate must retain active publication blockers");
    }
  }
}

for (const fragment of [
  "export function resolvePolicyCurrentVersionFromRegistry",
  "export function resolvePolicyArchiveVersionFromRegistry",
  '"registry_routing_disabled"',
  '"archive_routing_disabled"',
  '"multiple_public_effective_versions"',
  'version.status !== "effective" && version.status !== "superseded"',
  'version.status === "superseded"',
]) {
  requireSourceFragment(resolverSource, fragment, "policy-content-resolver.ts");
}

for (const fragment of [
  "Status: review pending",
  "Public route switchover authorized by this record: no",
  "Current registry state: `pending`",
  "No outcome is recorded yet.",
  "State: pending",
  "explicit review required",
  "rendered accessibility review required",
]) {
  requireSourceFragment(reviewSource, fragment, reviewPath);
}

const fixtureRevisionOld = "sha256:old-public-revision";
const fixtureRevisionNew = "sha256:new-public-revision";
function approval(reviewerRole, sourceRevision) {
  return {
    reviewerRole,
    state: "approved",
    approvedBy: "fixture-reviewer",
    approvedAt: "2026-08-10T00:00:00.000Z",
    sourceRevision,
  };
}
function fixtureVersion({ version, status, sourceRevision, effectiveAt, supersedesVersion = null }) {
  return {
    documentId: "TEST-POLICY",
    version,
    canonicalRoute: "/test-policy",
    status,
    publicReady: true,
    audience: "public",
    sourceRevision,
    effectiveAt,
    requiredReviewers: ["Product Owner"],
    approvals: [approval("Product Owner", sourceRevision)],
    publicationBlockers: [],
    supersedesVersion,
    payloadPath: `src/content/policies/TEST-POLICY/${version}.json`,
  };
}

const fixtureOld = fixtureVersion({
  version: "2026.07.01.1",
  status: "superseded",
  sourceRevision: fixtureRevisionOld,
  effectiveAt: "2026-07-01T00:00:00.000Z",
});
const fixtureNew = fixtureVersion({
  version: "2026.08.01.1",
  status: "effective",
  sourceRevision: fixtureRevisionNew,
  effectiveAt: "2026-08-01T00:00:00.000Z",
  supersedesVersion: fixtureOld.version,
});
const fixtureRegistry = {
  registryRoutingEnabled: true,
  archiveRoutingEnabled: true,
  documentFamilies: [
    {
      documentId: "TEST-POLICY",
      canonicalRoute: "/test-policy",
      migrationState: "registry_managed",
      registryManagedVersions: [fixtureOld, fixtureNew],
    },
  ],
};
const fixtureNow = Date.parse("2026-08-10T00:00:00.000Z");

const currentFixture = resolveCurrent(fixtureRegistry, "TEST-POLICY", fixtureNow);
if (!currentFixture.resolved || currentFixture.version?.version !== fixtureNew.version) {
  fail("fixture: current resolver did not select the sole eligible effective version");
}
const oldArchiveFixture = resolveArchive(
  fixtureRegistry,
  "TEST-POLICY",
  fixtureOld.version,
  fixtureNow,
);
if (!oldArchiveFixture.resolved || oldArchiveFixture.version?.sourceRevision !== fixtureRevisionOld) {
  fail("fixture: exact superseded historical version was not retrievable by version identity");
}
const currentArchiveFixture = resolveArchive(
  fixtureRegistry,
  "TEST-POLICY",
  fixtureNew.version,
  fixtureNow,
);
if (!currentArchiveFixture.resolved || currentArchiveFixture.version?.sourceRevision !== fixtureRevisionNew) {
  fail("fixture: exact current effective version was not retrievable by version identity");
}

const disabledCurrent = resolveCurrent(
  { ...fixtureRegistry, registryRoutingEnabled: false },
  "TEST-POLICY",
  fixtureNow,
);
if (disabledCurrent.resolved || !disabledCurrent.reasons.includes("registry_routing_disabled")) {
  fail("fixture: disabled public registry routing did not fail closed");
}
const disabledArchive = resolveArchive(
  { ...fixtureRegistry, archiveRoutingEnabled: false },
  "TEST-POLICY",
  fixtureOld.version,
  fixtureNow,
);
if (disabledArchive.resolved || !disabledArchive.reasons.includes("archive_routing_disabled")) {
  fail("fixture: disabled archive routing did not fail closed");
}

const ambiguousRegistry = {
  ...fixtureRegistry,
  documentFamilies: [
    {
      ...fixtureRegistry.documentFamilies[0],
      registryManagedVersions: [
        { ...fixtureOld, status: "effective" },
        fixtureNew,
      ],
    },
  ],
};
const ambiguous = resolveCurrent(ambiguousRegistry, "TEST-POLICY", fixtureNow);
if (ambiguous.resolved || !ambiguous.reasons.includes("multiple_public_effective_versions")) {
  fail("fixture: multiple eligible effective versions did not fail closed");
}

const reviewArchive = resolveArchive(
  {
    ...fixtureRegistry,
    documentFamilies: [
      {
        ...fixtureRegistry.documentFamilies[0],
        registryManagedVersions: [{ ...fixtureNew, status: "review" }],
      },
    ],
  },
  "TEST-POLICY",
  fixtureNew.version,
  fixtureNow,
);
if (reviewArchive.resolved || !reviewArchive.reasons.includes("historical_status_not_servable")) {
  fail("fixture: review content was incorrectly eligible for archive serving");
}

const mismatchArchive = resolveArchive(
  {
    ...fixtureRegistry,
    documentFamilies: [
      {
        ...fixtureRegistry.documentFamilies[0],
        registryManagedVersions: [
          {
            ...fixtureOld,
            approvals: [approval("Product Owner", "different-revision")],
          },
        ],
      },
    ],
  },
  "TEST-POLICY",
  fixtureOld.version,
  fixtureNow,
);
if (
  mismatchArchive.resolved ||
  !mismatchArchive.reasons.includes("approval_source_revision_mismatch")
) {
  fail("fixture: historical approval/source revision mismatch did not fail closed");
}

if (errors.length > 0) {
  console.error("Policy resolution foundation verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy resolution foundation verification PASSED");
console.log("- production registry routing enabled: false");
console.log("- production archive routing enabled: false");
console.log("- Accessibility Product Owner review: pending");
console.log("- Accessibility accessibility review: pending");
console.log("- current-version resolver fixture: PASS");
console.log("- exact superseded archive fixture: PASS");
console.log("- disabled routing fail-closed fixtures: PASS");
console.log("- ambiguous effective-version fixture: PASS");
console.log("- review-status archive rejection fixture: PASS");
console.log("- historical approval revision mismatch fixture: PASS");
