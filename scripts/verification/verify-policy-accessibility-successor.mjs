import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const BASE_VERSION = "2026.07.18.1";
const SUCCESSOR_VERSION = "2026.08.10.1";
const BASE_SOURCE_REVISION =
  "git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780";
const SUCCESSOR_SOURCE_REVISION =
  "sha256:e97bb10027f3895a55fb78dce32fee3ade2363ccc24690a40042737ab1f2edfe";
const SUCCESSOR_REVIEW_PATH =
  "docs/policy-content/reviews/POLICY-ACCESSIBILITY-2026.08.10.1-review.md";
const REVISION_DESCRIPTOR =
  "POLICY-ACCESSIBILITY|2026.08.10.1|reviewedDate=August 10, 2026|base=git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  basePayload:
    "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
  successorPayload:
    "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json",
  payloadRegistry: "src/lib/policy-content-payload-registry.ts",
  previewApi: "src/app/api/admin/policy-content-preview/route.ts",
  previewClient:
    "src/app/admin/policy-content-preview/policy-content-preview-client.tsx",
  review: SUCCESSOR_REVIEW_PATH,
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

function parseJson(source, context) {
  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(
      `${context}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

function withoutSuccessorMetadata(payload) {
  const clone = JSON.parse(JSON.stringify(payload));
  delete clone.version;
  delete clone.reviewedDate;
  delete clone.sourceRevision;
  return clone;
}

const registry = parseJson(read(paths.registry), paths.registry);
const basePayload = parseJson(read(paths.basePayload), paths.basePayload);
const successorPayload = parseJson(
  read(paths.successorPayload),
  paths.successorPayload,
);
const payloadRegistrySource = read(paths.payloadRegistry);
const previewApiSource = read(paths.previewApi);
const previewClientSource = read(paths.previewClient);
const reviewSource = read(paths.review);

const expectedDigest = crypto
  .createHash("sha256")
  .update(REVISION_DESCRIPTOR, "utf8")
  .digest("hex");
if (`sha256:${expectedDigest}` !== SUCCESSOR_SOURCE_REVISION) {
  errors.push("successor source revision does not match the documented descriptor digest");
}

if (registry) {
  if (registry.registryRoutingEnabled !== true) {
    errors.push("registry routing must remain enabled for the current effective Accessibility version");
  }
  if (registry.archiveRoutingEnabled !== true) {
    errors.push("archive routing must remain enabled for the current effective Accessibility version");
  }

  const family = registry.documentFamilies?.find(
    (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
  );
  if (!family) {
    errors.push("POLICY-ACCESSIBILITY family is missing");
  } else {
    if (family.migrationState !== "registry_managed") {
      errors.push("Accessibility family must remain registry_managed");
    }

    const base = family.registryManagedVersions?.find(
      (candidate) => candidate.version === BASE_VERSION,
    );
    const successor = family.registryManagedVersions?.find(
      (candidate) => candidate.version === SUCCESSOR_VERSION,
    );

    if (!base) {
      errors.push(`base effective version ${BASE_VERSION} is missing`);
    } else {
      if (base.status !== "effective") errors.push("base Accessibility version must remain effective");
      if (base.publicReady !== true) errors.push("base Accessibility version must remain publicReady=true");
      if (base.effectiveAt !== "2026-08-11T02:24:00.000Z") {
        errors.push("base Accessibility effective timestamp drifted");
      }
      if (base.sourceRevision !== BASE_SOURCE_REVISION) {
        errors.push("base Accessibility source revision drifted");
      }
      if (base.payloadPath !== paths.basePayload) {
        errors.push("base Accessibility payload path drifted");
      }
      if (base.publicationBlockers?.some((blocker) => blocker.active === true)) {
        errors.push("base effective Accessibility version regained an active publication blocker");
      }
    }

    if (!successor) {
      errors.push(`successor version ${SUCCESSOR_VERSION} is missing`);
    } else {
      if (successor.status !== "review") errors.push("successor must remain status=review");
      if (successor.publicReady !== false) errors.push("successor must remain publicReady=false");
      if (successor.effectiveAt !== null) errors.push("successor effectiveAt must remain null");
      if (successor.lastReviewedAt !== "2026-08-10T00:00:00.000Z") {
        errors.push("successor lastReviewedAt must represent August 10, 2026");
      }
      if (successor.sourceRevision !== SUCCESSOR_SOURCE_REVISION) {
        errors.push("successor source revision drifted");
      }
      if (successor.payloadPath !== paths.successorPayload) {
        errors.push("successor payload path drifted");
      }
      if (successor.supersedesVersion !== BASE_VERSION) {
        errors.push("successor must identify the current effective version as its intended predecessor");
      }

      for (const role of ["Product Owner", "Accessibility"]) {
        const approval = successor.approvals?.find(
          (candidate) => candidate.reviewerRole === role,
        );
        if (!approval) {
          errors.push(`successor is missing ${role} approval record`);
          continue;
        }
        if (approval.state !== "pending") {
          errors.push(`${role} approval must remain pending until explicit review evidence exists`);
        }
        if (approval.approvedBy !== null || approval.approvedAt !== null) {
          errors.push(`${role} pending approval must not contain an approving actor or timestamp`);
        }
        if (approval.sourceRevision !== SUCCESSOR_SOURCE_REVISION) {
          errors.push(`${role} approval record is not bound to the successor source revision`);
        }
        if (approval.noteReference !== SUCCESSOR_REVIEW_PATH) {
          errors.push(`${role} approval record does not reference the successor review record`);
        }
      }

      const dependency = successor.productDependencies?.find(
        (candidate) =>
          candidate.dependencyId === "accessibility-successor-metadata-review",
      );
      if (!dependency || dependency.blocking !== true) {
        errors.push("successor metadata review dependency must remain blocking");
      }

      for (const blockerId of [
        "accessibility_successor_review_pending",
        "accessibility_successor_activation_not_authorized",
      ]) {
        const blocker = successor.publicationBlockers?.find(
          (candidate) => candidate.blockerId === blockerId,
        );
        if (!blocker || blocker.active !== true) {
          errors.push(`${blockerId} must remain active before review/activation`);
        }
      }
    }

    const effectiveVersions = (family.registryManagedVersions ?? []).filter(
      (candidate) =>
        candidate.status === "effective" && candidate.publicReady === true,
    );
    if (
      effectiveVersions.length !== 1 ||
      effectiveVersions[0]?.version !== BASE_VERSION
    ) {
      errors.push("the current public Accessibility version must remain the sole effective version");
    }
  }
}

if (basePayload && successorPayload) {
  if (basePayload.version !== BASE_VERSION) errors.push("base payload version drifted");
  if (basePayload.reviewedDate !== "July 18, 2026") {
    errors.push("base effective payload reviewedDate must remain immutable");
  }
  if (basePayload.sourceRevision !== BASE_SOURCE_REVISION) {
    errors.push("base payload source revision drifted");
  }

  if (successorPayload.version !== SUCCESSOR_VERSION) {
    errors.push("successor payload version is incorrect");
  }
  if (successorPayload.reviewedDate !== "August 10, 2026") {
    errors.push("successor payload must display Last reviewed: August 10, 2026");
  }
  if (successorPayload.sourceRevision !== SUCCESSOR_SOURCE_REVISION) {
    errors.push("successor payload source revision is incorrect");
  }
  if (successorPayload.effectiveDate !== null) {
    errors.push("successor payload must not invent a payload-level effective date");
  }

  if (
    JSON.stringify(withoutSuccessorMetadata(basePayload)) !==
    JSON.stringify(withoutSuccessorMetadata(successorPayload))
  ) {
    errors.push(
      "successor payload changed fields beyond version, reviewedDate, and sourceRevision",
    );
  }
}

for (const fragment of [
  "2026.07.18.1.json",
  "2026.08.10.1.json",
  '"POLICY-ACCESSIBILITY:2026.07.18.1"',
  '"POLICY-ACCESSIBILITY:2026.08.10.1"',
  "validateStructuredPolicyPayload",
]) {
  expect(payloadRegistrySource, fragment, paths.payloadRegistry);
}
for (const forbidden of ["import(`", "readFileSync", "request.nextUrl", "searchParams"]) {
  reject(payloadRegistrySource, forbidden, paths.payloadRegistry);
}

for (const fragment of [
  "verifyRequestAccountAccess",
  "access.profile.is_admin !== true",
  "2026.08.10.1.json",
  "PREVIEWABLE_STATUSES",
  'family.migrationState !== "registry_managed"',
  "!PREVIEWABLE_STATUSES.has(versionRecord.status)",
  '"Cache-Control": "private, no-store, max-age=0"',
  '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  "export async function GET",
]) {
  expect(previewApiSource, fragment, paths.previewApi);
}
for (const forbidden of [
  "export async function POST",
  "export async function PUT",
  "export async function PATCH",
  "export async function DELETE",
  "readFileSync",
  "import(`",
  "Phase D preview contract requires public registry and archive routing to remain disabled",
]) {
  reject(previewApiSource, forbidden, paths.previewApi);
}

expect(
  previewClientSource,
  'const VERSION = "2026.08.10.1"',
  paths.previewClient,
);
expect(previewClientSource, "StructuredPolicyRenderer", paths.previewClient);
expect(
  previewClientSource,
  "Authorization: `Bearer ${token}`",
  paths.previewClient,
);
for (const forbidden of ["dangerouslySetInnerHTML", '<form', '<textarea', 'method: "POST"']) {
  reject(previewClientSource, forbidden, paths.previewClient);
}

for (const fragment of [
  "Status: review pending",
  "Public activation authorized by this record: no",
  "Last reviewed: August 10, 2026",
  SUCCESSOR_SOURCE_REVISION,
  "State: pending",
  "prior approval is not silently copied",
]) {
  expect(reviewSource, fragment, paths.review);
}

if (errors.length > 0) {
  console.error("Accessibility successor verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Accessibility successor verification PASSED");
console.log(`- current effective version remains ${BASE_VERSION}`);
console.log(`- successor review candidate: ${SUCCESSOR_VERSION}`);
console.log("- only intended public delta: Last reviewed July 18 -> August 10, 2026");
console.log("- Product Owner review: pending");
console.log("- Accessibility review: pending");
console.log("- successor activation: blocked");
console.log("- restricted preview supports non-effective candidates in registry-managed families");
