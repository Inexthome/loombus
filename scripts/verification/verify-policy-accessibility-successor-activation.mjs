import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const DOCUMENT_ID = "POLICY-ACCESSIBILITY";
const BASE_VERSION = "2026.07.18.1";
const SUCCESSOR_VERSION = "2026.08.10.1";
const BASE_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";
const SUCCESSOR_EFFECTIVE_AT = "2026-08-11T03:36:00.000Z";
const BASE_SOURCE_REVISION =
  "git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780";
const SUCCESSOR_SOURCE_REVISION =
  "sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe";
const REVIEW_EVIDENCE_COMMENT = "5248614787";
const ACTIVATION_AUTHORIZATION_COMMENT = "5248695077";
const SUCCESSOR_APPROVED_AT = "2026-08-11T03:21:00.000Z";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  basePayload: "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
  successorPayload: "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json",
  payloadRegistry: "src/lib/policy-content-payload-registry.ts",
  resolver: "src/lib/policy-content-resolver.ts",
  history: "src/lib/policy-content-history.ts",
  canonical: "src/lib/policy-content-canonical-route.ts",
  accessibilityLayout: "src/app/accessibility/layout.tsx",
  previewApi: "src/app/api/admin/policy-content-preview/route.ts",
  baseReview: "docs/policy-content/reviews/POLICY-ACCESSIBILITY-2026.07.18.1-review.md",
  successorReview: "docs/policy-content/reviews/POLICY-ACCESSIBILITY-2026.08.10.1-review.md",
  activation: "docs/policy-content/activations/POLICY-ACCESSIBILITY-2026.08.10.1-activation.md",
};

function fail(message) {
  errors.push(message);
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    fail(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function parseJson(relativePath) {
  const source = read(relativePath);
  try {
    return JSON.parse(source);
  } catch (error) {
    fail(`${relativePath}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) {
    fail(`${context}: missing expected fragment ${JSON.stringify(fragment)}`);
  }
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) {
    fail(`${context}: forbidden fragment present ${JSON.stringify(fragment)}`);
  }
}

function approvalProblems(version) {
  const problems = [];
  for (const reviewerRole of version.requiredReviewers ?? []) {
    const approval = (version.approvals ?? []).find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (!approval) {
      problems.push(`missing_${reviewerRole}`);
      continue;
    }
    if (approval.state !== "approved") problems.push(`${reviewerRole}_not_approved`);
    if (approval.sourceRevision !== version.sourceRevision) {
      problems.push(`${reviewerRole}_source_revision_mismatch`);
    }
  }
  return problems;
}

function publicationProblems(family, version, now) {
  const problems = [];
  if (version.documentId !== family.documentId) problems.push("document_id_mismatch");
  if (version.canonicalRoute !== family.canonicalRoute) problems.push("canonical_route_mismatch");
  if (version.publicReady !== true) problems.push("public_ready_false");
  if (version.audience !== "public") problems.push("audience_not_public");
  if (version.status !== "effective") problems.push("status_not_effective");
  const effectiveAt = Date.parse(version.effectiveAt ?? "");
  if (!Number.isFinite(effectiveAt)) problems.push("effective_at_missing");
  else if (effectiveAt > now) problems.push("effective_at_in_future");
  if ((version.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
    problems.push("active_publication_blocker");
  }
  problems.push(...approvalProblems(version));
  return [...new Set(problems)];
}

function findFamily(registry, documentId) {
  return registry.documentFamilies?.find(
    (candidate) => candidate.documentId === documentId,
  ) ?? null;
}

function resolveCurrent(registry, documentId, now) {
  if (registry.registryRoutingEnabled !== true) {
    return { resolved: false, reasons: ["registry_routing_disabled"], version: null };
  }
  const family = findFamily(registry, documentId);
  if (!family) return { resolved: false, reasons: ["unknown_document_family"], version: null };
  if (family.migrationState !== "registry_managed") {
    return { resolved: false, reasons: ["document_family_not_registry_managed"], version: null };
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
    return { resolved: false, reasons: ["multiple_public_effective_versions"], version: null };
  }
  return { resolved: true, reasons: [], version: eligible[0] };
}

function resolveArchive(registry, documentId, versionId, now) {
  if (registry.archiveRoutingEnabled !== true) {
    return { resolved: false, reasons: ["archive_routing_disabled"], version: null };
  }
  const family = findFamily(registry, documentId);
  if (!family) return { resolved: false, reasons: ["unknown_document_family"], version: null };
  if (family.migrationState !== "registry_managed") {
    return { resolved: false, reasons: ["document_family_not_registry_managed"], version: null };
  }
  const version = family.registryManagedVersions.find(
    (candidate) => candidate.version === versionId,
  ) ?? null;
  if (!version) return { resolved: false, reasons: ["version_not_found"], version: null };
  if (version.status !== "effective" && version.status !== "superseded") {
    return { resolved: false, reasons: ["historical_status_not_servable"], version };
  }
  const normalized = version.status === "superseded"
    ? { ...version, status: "effective" }
    : version;
  const problems = publicationProblems(family, normalized, now);
  if (problems.length > 0) return { resolved: false, reasons: problems, version };
  return { resolved: true, reasons: [], version };
}

function publicHistory(registry, documentId, now) {
  if (registry.archiveRoutingEnabled !== true) return [];
  const family = findFamily(registry, documentId);
  if (!family || family.migrationState !== "registry_managed") return [];
  return family.registryManagedVersions
    .filter((version) => version.status === "effective" || version.status === "superseded")
    .filter((version) => resolveArchive(registry, documentId, version.version, now).resolved)
    .sort((left, right) => {
      const byDate = Date.parse(right.effectiveAt) - Date.parse(left.effectiveAt);
      if (byDate !== 0) return byDate;
      return right.version.localeCompare(left.version);
    });
}

function withoutSuccessorMetadata(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.version;
  delete clone.reviewedDate;
  delete clone.sourceRevision;
  return clone;
}

const registry = parseJson(paths.registry);
const basePayload = parseJson(paths.basePayload);
const successorPayload = parseJson(paths.successorPayload);
const payloadRegistrySource = read(paths.payloadRegistry);
const resolverSource = read(paths.resolver);
const historySource = read(paths.history);
const canonicalSource = read(paths.canonical);
const accessibilityLayoutSource = read(paths.accessibilityLayout);
const previewApiSource = read(paths.previewApi);
const baseReviewSource = read(paths.baseReview);
const successorReviewSource = read(paths.successorReview);
const activationSource = read(paths.activation);

if (registry) {
  if (registry.registryRoutingEnabled !== true) fail("registry routing must remain enabled");
  if (registry.archiveRoutingEnabled !== true) fail("archive routing must remain enabled");

  const family = findFamily(registry, DOCUMENT_ID);
  if (!family) {
    fail("POLICY-ACCESSIBILITY family is missing");
  } else {
    if (family.migrationState !== "registry_managed") {
      fail("Accessibility family must remain registry_managed");
    }

    const base = family.registryManagedVersions.find((v) => v.version === BASE_VERSION);
    const successor = family.registryManagedVersions.find((v) => v.version === SUCCESSOR_VERSION);

    if (!base) {
      fail(`missing superseded version ${BASE_VERSION}`);
    } else {
      if (base.status !== "superseded") fail("July Accessibility version must be superseded");
      if (base.publicReady !== true) fail("superseded July version must remain publicReady=true for archive serving");
      if (base.effectiveAt !== BASE_EFFECTIVE_AT) fail("July version original effective timestamp drifted");
      if (base.lastReviewedAt !== "2026-07-18T00:00:00.000Z") fail("July version lastReviewedAt drifted");
      if (base.sourceRevision !== BASE_SOURCE_REVISION) fail("July version source revision drifted");
      if (base.payloadPath !== paths.basePayload) fail("July version payload path drifted");
      if ((base.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
        fail("superseded July version regained an active publication blocker");
      }
      if (approvalProblems(base).length > 0) fail("superseded July version approvals/source binding drifted");
    }

    if (!successor) {
      fail(`missing effective successor ${SUCCESSOR_VERSION}`);
    } else {
      if (successor.status !== "effective") fail("August successor must be effective");
      if (successor.publicReady !== true) fail("August successor must be publicReady=true");
      if (successor.effectiveAt !== SUCCESSOR_EFFECTIVE_AT) fail("August successor effective timestamp does not match authorization");
      if (successor.lastReviewedAt !== "2026-08-10T00:00:00.000Z") fail("August successor lastReviewedAt drifted");
      if (successor.sourceRevision !== SUCCESSOR_SOURCE_REVISION) fail("August successor source revision drifted");
      if (successor.payloadPath !== paths.successorPayload) fail("August successor payload path drifted");
      if (successor.supersedesVersion !== BASE_VERSION) fail("August successor must supersede the July version");
      if (approvalProblems(successor).length > 0) fail("August successor approvals/source binding drifted");
      for (const role of ["Product Owner", "Accessibility"]) {
        const approval = successor.approvals?.find((entry) => entry.reviewerRole === role);
        if (approval?.approvedBy !== "Inexthome") fail(`${role} approving actor drifted`);
        if (approval?.approvedAt !== SUCCESSOR_APPROVED_AT) fail(`${role} approval timestamp drifted`);
      }
      const dependency = successor.productDependencies?.find(
        (entry) => entry.dependencyId === "accessibility-successor-metadata-review",
      );
      if (!dependency || dependency.blocking !== false || !dependency.note?.includes(REVIEW_EVIDENCE_COMMENT)) {
        fail("successor review dependency is not cleared with exact review evidence");
      }
      const reviewBlocker = successor.publicationBlockers?.find(
        (entry) => entry.blockerId === "accessibility_successor_review_pending",
      );
      if (!reviewBlocker || reviewBlocker.active !== false || !reviewBlocker.note?.includes(REVIEW_EVIDENCE_COMMENT)) {
        fail("successor review blocker is not cleared with exact review evidence");
      }
      const activationBlocker = successor.publicationBlockers?.find(
        (entry) => entry.blockerId === "accessibility_successor_activation_not_authorized",
      );
      if (!activationBlocker || activationBlocker.active !== false) {
        fail("successor activation blocker must be inactive after explicit authorization");
      }
      if (!activationBlocker?.note?.includes(ACTIVATION_AUTHORIZATION_COMMENT)) {
        fail("successor activation blocker note must cite exact authorization comment");
      }
      if (!activationBlocker?.note?.includes(SUCCESSOR_EFFECTIVE_AT)) {
        fail("successor activation blocker note must include authorized effective timestamp");
      }
      if ((successor.publicationBlockers ?? []).some((blocker) => blocker.active === true)) {
        fail("effective successor must have no active publication blocker");
      }
    }

    const currentEffective = family.registryManagedVersions.filter(
      (version) => version.status === "effective" && version.publicReady === true,
    );
    if (currentEffective.length !== 1 || currentEffective[0]?.version !== SUCCESSOR_VERSION) {
      fail("Accessibility must have exactly one public effective version and it must be the August successor");
    }
  }
}

if (basePayload && successorPayload) {
  if (basePayload.version !== BASE_VERSION) fail("historical payload version drifted");
  if (basePayload.reviewedDate !== "July 18, 2026") fail("historical payload reviewed date must remain July 18, 2026");
  if (basePayload.sourceRevision !== BASE_SOURCE_REVISION) fail("historical payload source revision drifted");
  if (successorPayload.version !== SUCCESSOR_VERSION) fail("successor payload version drifted");
  if (successorPayload.reviewedDate !== "August 10, 2026") fail("successor must display Last reviewed: August 10, 2026");
  if (successorPayload.sourceRevision !== SUCCESSOR_SOURCE_REVISION) fail("successor payload source revision drifted");
  if (basePayload.effectiveDate !== null || successorPayload.effectiveDate !== null) {
    fail("payload-level effectiveDate must remain null; registry effectiveAt is authoritative");
  }
  if (
    JSON.stringify(withoutSuccessorMetadata(basePayload)) !==
    JSON.stringify(withoutSuccessorMetadata(successorPayload))
  ) {
    fail("successor changed content beyond version, reviewedDate, and sourceRevision");
  }
}

for (const fragment of [
  "resolvePolicyCurrentVersionFromRegistry",
  "multiple_public_effective_versions",
  "resolvePolicyArchiveVersionFromRegistry",
  'version.status !== "effective" && version.status !== "superseded"',
]) expect(resolverSource, fragment, paths.resolver);

for (const fragment of [
  "resolvePolicyPublicHistoryFromRegistry",
  "resolvePolicyArchiveVersionFromRegistry",
  'version.status !== "effective" && version.status !== "superseded"',
  "policyArchiveHref",
]) expect(historySource, fragment, paths.history);

for (const fragment of [
  "resolvePolicyCanonicalRoutePayloadFromRegistry",
  "resolvePolicyCurrentVersionFromRegistry",
  "payload_source_revision_mismatch",
  "payload_version_mismatch",
  "payload_path_mismatch",
]) expect(canonicalSource, fragment, paths.canonical);

for (const fragment of [
  '"POLICY-ACCESSIBILITY:2026.07.18.1"',
  '"POLICY-ACCESSIBILITY:2026.08.10.1"',
  "validateStructuredPolicyPayload",
]) expect(payloadRegistrySource, fragment, paths.payloadRegistry);
for (const forbidden of ["import(`", "readFileSync", "request.nextUrl", "searchParams"]) {
  reject(payloadRegistrySource, forbidden, paths.payloadRegistry);
}

for (const fragment of [
  "StructuredPolicyRenderer",
  "resolvePolicyCanonicalRoutePayload",
  '"POLICY-ACCESSIBILITY"',
  "if (!resolution.resolved || !resolution.payload)",
]) expect(accessibilityLayoutSource, fragment, paths.accessibilityLayout);

for (const fragment of [
  "verifyRequestAccountAccess",
  "access.profile.is_admin !== true",
  "PREVIEWABLE_STATUSES",
  '"Cache-Control": "private, no-store, max-age=0"',
  '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  "export async function GET",
]) expect(previewApiSource, fragment, paths.previewApi);
for (const forbidden of [
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "export async function DELETE",
  "readFileSync",
  "import(`",
]) reject(previewApiSource, forbidden, paths.previewApi);
const previewSetMatch = previewApiSource.match(/const PREVIEWABLE_STATUSES = new Set\(\[([\s\S]*?)\]\);/);
if (!previewSetMatch) {
  fail("preview API PREVIEWABLE_STATUSES set could not be inspected");
} else {
  const previewStatuses = previewSetMatch[1];
  for (const forbiddenStatus of ["effective", "superseded", "withdrawn"]) {
    if (previewStatuses.includes(`"${forbiddenStatus}"`)) {
      fail(`preview API must reject ${forbiddenStatus} versions`);
    }
  }
}

for (const fragment of [
  "Status: effective and registry-managed",
  BASE_EFFECTIVE_AT,
  BASE_SOURCE_REVISION,
]) expect(baseReviewSource, fragment, paths.baseReview);
for (const fragment of [
  "Status: reviewer approvals complete",
  "Public activation authorized by this record: no",
  REVIEW_EVIDENCE_COMMENT,
  SUCCESSOR_SOURCE_REVISION,
]) expect(successorReviewSource, fragment, paths.successorReview);
for (const fragment of [
  "Status: activation authorized, pending merge and production verification",
  ACTIVATION_AUTHORIZATION_COMMENT,
  SUCCESSOR_EFFECTIVE_AT,
  "2026.07.18.1` changes from `effective` to `superseded",
  "2026.08.10.1` changes from `approved` to `effective",
]) expect(activationSource, fragment, paths.activation);

if (registry) {
  const productionNow = Date.parse("2026-08-11T03:36:01.000Z");
  const current = resolveCurrent(registry, DOCUMENT_ID, productionNow);
  if (!current.resolved || current.version?.version !== SUCCESSOR_VERSION) {
    fail(`production current resolver did not select ${SUCCESSOR_VERSION}: ${current.reasons?.join(", ") ?? "unknown"}`);
  }

  const currentArchive = resolveArchive(registry, DOCUMENT_ID, SUCCESSOR_VERSION, productionNow);
  if (!currentArchive.resolved || currentArchive.version?.version !== SUCCESSOR_VERSION) {
    fail("current exact-version archive resolver did not serve the August successor");
  }
  const historicalArchive = resolveArchive(registry, DOCUMENT_ID, BASE_VERSION, productionNow);
  if (!historicalArchive.resolved || historicalArchive.version?.version !== BASE_VERSION) {
    fail("superseded July exact-version archive resolver did not remain servable");
  }

  const history = publicHistory(registry, DOCUMENT_ID, productionNow);
  if (history.length !== 2) fail(`public history must expose exactly two Accessibility versions, found ${history.length}`);
  if (history[0]?.version !== SUCCESSOR_VERSION || history[0]?.status !== "effective") {
    fail("public history must list the August effective successor first");
  }
  if (history[1]?.version !== BASE_VERSION || history[1]?.status !== "superseded") {
    fail("public history must retain the July superseded version second");
  }

  const family = findFamily(registry, DOCUMENT_ID);
  if (family) {
    const ambiguousRegistry = {
      ...registry,
      documentFamilies: registry.documentFamilies.map((candidate) =>
        candidate.documentId !== DOCUMENT_ID
          ? candidate
          : {
              ...candidate,
              registryManagedVersions: candidate.registryManagedVersions.map((version) =>
                version.version === BASE_VERSION ? { ...version, status: "effective" } : version,
              ),
            },
      ),
    };
    const ambiguous = resolveCurrent(ambiguousRegistry, DOCUMENT_ID, productionNow);
    if (ambiguous.resolved || !ambiguous.reasons.includes("multiple_public_effective_versions")) {
      fail("multiple effective Accessibility versions did not fail closed");
    }

    const disabledCurrent = resolveCurrent(
      { ...registry, registryRoutingEnabled: false },
      DOCUMENT_ID,
      productionNow,
    );
    if (disabledCurrent.resolved || !disabledCurrent.reasons.includes("registry_routing_disabled")) {
      fail("disabled current routing did not fail closed");
    }
    const disabledArchive = resolveArchive(
      { ...registry, archiveRoutingEnabled: false },
      DOCUMENT_ID,
      BASE_VERSION,
      productionNow,
    );
    if (disabledArchive.resolved || !disabledArchive.reasons.includes("archive_routing_disabled")) {
      fail("disabled archive routing did not fail closed");
    }

    const successor = family.registryManagedVersions.find((version) => version.version === SUCCESSOR_VERSION);
    if (successor) {
      const approvedOnlyRegistry = {
        ...registry,
        documentFamilies: registry.documentFamilies.map((candidate) =>
          candidate.documentId !== DOCUMENT_ID
            ? candidate
            : {
                ...candidate,
                registryManagedVersions: candidate.registryManagedVersions.map((version) =>
                  version.version === SUCCESSOR_VERSION
                    ? { ...version, status: "approved", publicReady: false, effectiveAt: null }
                    : version,
                ),
              },
        ),
      };
      const approvedArchive = resolveArchive(
        approvedOnlyRegistry,
        DOCUMENT_ID,
        SUCCESSOR_VERSION,
        productionNow,
      );
      if (approvedArchive.resolved || !approvedArchive.reasons.includes("historical_status_not_servable")) {
        fail("approved-only candidate leaked into exact-version archive serving");
      }

      const mismatchedRegistry = {
        ...registry,
        documentFamilies: registry.documentFamilies.map((candidate) =>
          candidate.documentId !== DOCUMENT_ID
            ? candidate
            : {
                ...candidate,
                registryManagedVersions: candidate.registryManagedVersions.map((version) =>
                  version.version !== BASE_VERSION
                    ? version
                    : {
                        ...version,
                        approvals: version.approvals.map((approval) => ({
                          ...approval,
                          sourceRevision: "sha256:mismatch",
                        })),
                      },
                ),
              },
        ),
      };
      const mismatchArchive = resolveArchive(
        mismatchedRegistry,
        DOCUMENT_ID,
        BASE_VERSION,
        productionNow,
      );
      if (mismatchArchive.resolved || !mismatchArchive.reasons.some((reason) => reason.includes("source_revision_mismatch"))) {
        fail("historical approval/source mismatch did not fail closed");
      }
    }
  }
}

if (errors.length > 0) {
  console.error("Accessibility successor activation verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Accessibility successor activation verification PASSED");
console.log(`- current effective version: ${SUCCESSOR_VERSION}`);
console.log(`- effectiveAt: ${SUCCESSOR_EFFECTIVE_AT}`);
console.log(`- superseded historical version: ${BASE_VERSION}`);
console.log("- only content delta: Last reviewed July 18 -> August 10, 2026");
console.log("- canonical current resolver: PASS");
console.log("- current and superseded exact-version archive resolution: PASS");
console.log("- two-entry public history ordering: PASS");
console.log("- multiple-effective fail-closed fixture: PASS");
console.log("- disabled routing fail-closed fixtures: PASS");
console.log("- approved-only archive rejection fixture: PASS");
console.log("- historical approval/source mismatch fixture: PASS");
console.log("- restricted preview excludes effective/superseded/withdrawn states");
