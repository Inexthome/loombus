import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "src/lib/policy-content-registry.data.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const errors = [];
const AUTHORIZED_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";

function fail(message) {
  errors.push(message);
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function gitBlobSha1(content) {
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return crypto.createHash("sha1").update(Buffer.concat([header, bytes])).digest("hex");
}

function requireString(value, context) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(`${context}: expected non-empty string`);
    return false;
  }
  return true;
}

function requireArray(value, context) {
  if (!Array.isArray(value)) {
    fail(`${context}: expected array`);
    return false;
  }
  return true;
}

const family = registry.documentFamilies.find(
  (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
);

if (!family) {
  fail("registry: POLICY-ACCESSIBILITY family is missing");
}

if (registry.registryRoutingEnabled !== true) {
  fail("registry: activated Accessibility requires registryRoutingEnabled=true");
}
if (registry.archiveRoutingEnabled !== true) {
  fail("registry: activated Accessibility requires archiveRoutingEnabled=true");
}

if (family) {
  if (family.canonicalRoute !== "/accessibility") {
    fail(`registry: accessibility canonical route changed to ${family.canonicalRoute}`);
  }
  if (family.currentSourcePath !== "src/app/accessibility/page.tsx") {
    fail(`registry: unexpected Accessibility source path ${family.currentSourcePath}`);
  }
  if (family.migrationState !== "registry_managed") {
    fail(`registry: expected Accessibility migrationState registry_managed, got ${family.migrationState}`);
  }
}

const versions = family?.registryManagedVersions ?? [];
if (versions.length !== 1) {
  fail(`registry: expected exactly one Accessibility registry version, found ${versions.length}`);
}

const version = versions.find((candidate) => candidate.version === "2026.07.18.1");
if (!version) {
  fail("registry: Accessibility version 2026.07.18.1 is missing");
}

if (version) {
  if (version.status !== "effective") fail(`registry: Accessibility status must be effective, got ${version.status}`);
  if (version.publicReady !== true) fail("registry: activated Accessibility must be publicReady=true");
  if (version.audience !== "public") fail(`registry: Accessibility audience must remain public, got ${version.audience}`);
  if (version.effectiveAt !== AUTHORIZED_EFFECTIVE_AT) {
    fail(`registry: Accessibility effectiveAt must equal authorized timestamp ${AUTHORIZED_EFFECTIVE_AT}`);
  }
  if (version.publicationBlockers?.some((blocker) => blocker.active === true)) {
    fail("registry: activated Accessibility must not retain an active publication blocker");
  }
  const routeBlocker = (version.publicationBlockers ?? []).find(
    (blocker) => blocker.blockerId === "registry_route_switchover_not_authorized",
  );
  if (!routeBlocker || routeBlocker.active !== false) {
    fail("registry: route-switchover blocker must be inactive after explicit authorization");
  }
  if (!routeBlocker?.note?.includes("5248313219")) {
    fail("registry: route-switchover authorization note must cite Issue #671 comment 5248313219");
  }

  for (const reviewerRole of version.requiredReviewers ?? []) {
    const approval = (version.approvals ?? []).find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (!approval) {
      fail(`registry: missing required ${reviewerRole} approval record`);
      continue;
    }
    if (approval.state !== "approved") {
      fail(`registry: ${reviewerRole} approval must remain approved`);
      continue;
    }
    if (!requireString(approval.approvedBy, `registry: ${reviewerRole}.approvedBy`)) continue;
    if (!Number.isFinite(Date.parse(approval.approvedAt ?? ""))) {
      fail(`registry: ${reviewerRole}.approvedAt must be a valid timestamp`);
    }
    if (approval.sourceRevision !== version.sourceRevision) {
      fail(`registry: ${reviewerRole} approval source revision does not match effective version`);
    }
  }
}

const payloadPath = version?.payloadPath
  ? path.join(root, version.payloadPath)
  : path.join(root, "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json");

if (!fs.existsSync(payloadPath)) {
  fail(`payload: missing file ${path.relative(root, payloadPath)}`);
}

const payload = fs.existsSync(payloadPath)
  ? JSON.parse(fs.readFileSync(payloadPath, "utf8"))
  : null;

const legacyPath = family?.currentSourcePath
  ? path.join(root, family.currentSourcePath)
  : path.join(root, "src/app/accessibility/page.tsx");

if (!fs.existsSync(legacyPath)) {
  fail(`legacy route: missing file ${path.relative(root, legacyPath)}`);
}

const legacySource = fs.existsSync(legacyPath) ? fs.readFileSync(legacyPath, "utf8") : "";
const legacyNormalized = normalize(legacySource);
const legacyBlobRevision = legacySource ? `git-blob:${gitBlobSha1(legacySource)}` : "";

if (version && legacyBlobRevision && version.sourceRevision !== legacyBlobRevision) {
  fail(
    `registry: sourceRevision drifted; expected ${legacyBlobRevision}, got ${version.sourceRevision}`,
  );
}

if (payload) {
  if (payload.schemaVersion !== "policy_payload.v1") {
    fail(`payload: expected schemaVersion policy_payload.v1, got ${payload.schemaVersion}`);
  }
  if (payload.documentId !== "POLICY-ACCESSIBILITY") {
    fail(`payload: unexpected documentId ${payload.documentId}`);
  }
  if (payload.version !== "2026.07.18.1") {
    fail(`payload: unexpected version ${payload.version}`);
  }
  if (payload.canonicalRoute !== "/accessibility") {
    fail(`payload: unexpected canonicalRoute ${payload.canonicalRoute}`);
  }
  if (payload.legacySourcePath !== "src/app/accessibility/page.tsx") {
    fail(`payload: unexpected legacySourcePath ${payload.legacySourcePath}`);
  }
  if (legacyBlobRevision && payload.sourceRevision !== legacyBlobRevision) {
    fail(
      `payload: sourceRevision drifted; expected ${legacyBlobRevision}, got ${payload.sourceRevision}`,
    );
  }
  if (version && payload.sourceRevision !== version.sourceRevision) {
    fail("payload: sourceRevision does not match effective registry version");
  }
  if (version && version.payloadPath !== path.relative(root, payloadPath)) {
    fail("payload: registry payloadPath does not point to the parity payload");
  }

  requireString(payload.eyebrow, "payload.eyebrow");
  requireString(payload.title, "payload.title");
  requireString(payload.description, "payload.description");
  if (payload.effectiveDate !== null) fail("payload: effectiveDate must remain null because activation is registry metadata only and the reviewed legacy text has no effectiveDate field");
  if (payload.reviewedDate !== "July 18, 2026") {
    fail(`payload: expected reviewedDate July 18, 2026, got ${payload.reviewedDate}`);
  }
  requireArray(payload.sections, "payload.sections");

  const expectedPageMetadata = {
    title: "Accessibility | Loombus",
    description:
      "Loombus accessibility approach for keyboard, screen-reader, zoom, contrast, themes, motion, forms, media, files, mobile applications, and support.",
    canonical: "https://loombus.com/accessibility",
  };

  for (const [key, expected] of Object.entries(expectedPageMetadata)) {
    if (payload.pageMetadata?.[key] !== expected) {
      fail(`payload.pageMetadata.${key}: expected exact legacy value`);
    }
    if (!legacySource.includes(expected)) {
      fail(`legacy route: page metadata ${key} is no longer present verbatim`);
    }
  }

  if (payload.title !== "Accessibility") fail("payload: title must remain Accessibility");
  if (payload.eyebrow !== "Accessibility") fail("payload: eyebrow must remain Accessibility");
  if (!legacyNormalized.includes(normalize(payload.description))) {
    fail("legacy route: PublicPolicyPage description no longer matches the payload");
  }
  if (!legacySource.includes('reviewedDate="July 18, 2026"')) {
    fail("legacy route: reviewedDate no longer matches the payload");
  }
  if (legacySource.includes("effectiveDate=")) {
    fail("legacy route: an effectiveDate was added; parity assumptions must be reviewed");
  }

  const expectedSectionIds = [
    "commitment",
    "standard",
    "structure",
    "keyboard",
    "screen-readers",
    "visual",
    "zoom-reflow",
    "motion",
    "forms",
    "search-ai",
    "media",
    "files",
    "local-maps",
    "mobile",
    "third-party",
    "known-limitations",
    "request",
    "report",
    "response",
  ];

  const actualSectionIds = (payload.sections ?? []).map((section) => section.id);
  if (JSON.stringify(actualSectionIds) !== JSON.stringify(expectedSectionIds)) {
    fail(`payload: section IDs/order differ from the 19-section legacy Accessibility route`);
  }

  const seenIds = new Set();
  let cursor = 0;
  let verifiedFragments = 0;

  function assertOrderedFragment(fragment, context) {
    const target = normalize(fragment);
    if (!target || target === ".") return;
    const index = legacyNormalized.indexOf(target, cursor);
    if (index === -1) {
      fail(`${context}: text is missing or out of order in the legacy route: ${target}`);
      return;
    }
    cursor = index + target.length;
    verifiedFragments += 1;
  }

  for (const [sectionIndex, section] of (payload.sections ?? []).entries()) {
    const context = `payload.sections[${sectionIndex}]`;
    requireString(section.id, `${context}.id`);
    requireString(section.title, `${context}.title`);
    requireArray(section.blocks, `${context}.blocks`);

    if (seenIds.has(section.id)) fail(`${context}: duplicate section id ${section.id}`);
    seenIds.add(section.id);

    assertOrderedFragment(`id: "${section.id}"`, `${context}.id`);
    assertOrderedFragment(`title: "${section.title}"`, `${context}.title`);

    for (const [blockIndex, block] of (section.blocks ?? []).entries()) {
      const blockContext = `${context}.blocks[${blockIndex}]`;
      if (block.type === "paragraph") {
        if (!requireArray(block.content, `${blockContext}.content`)) continue;
        for (const [inlineIndex, inline] of block.content.entries()) {
          const inlineContext = `${blockContext}.content[${inlineIndex}]`;
          if (inline.type !== "text" && inline.type !== "link") {
            fail(`${inlineContext}: unsupported inline type ${inline.type}`);
            continue;
          }
          requireString(inline.text, `${inlineContext}.text`);
          if (inline.type === "link") {
            requireString(inline.href, `${inlineContext}.href`);
            if (!(inline.href.startsWith("/") || inline.href.startsWith("mailto:"))) {
              fail(`${inlineContext}: parity payload allows only internal or mailto links`);
            }
            if (inline.href.startsWith("/")) {
              if (!legacySource.includes(`href="${inline.href}"`)) {
                fail(`${inlineContext}: internal href is not present verbatim in the legacy route`);
              }
            } else {
              if (!legacySource.includes('const supportEmail = "support@loombus.com"')) {
                fail(`${inlineContext}: legacy supportEmail constant changed`);
              }
              if (!legacySource.includes("Loombus%20Accessibility%20Issue")) {
                fail(`${inlineContext}: legacy accessibility mail subject changed`);
              }
            }
          }

          if (inline.text === "support@loombus.com") continue;
          assertOrderedFragment(inline.text, `${inlineContext}.text`);
        }
      } else if (block.type === "bullet_list") {
        if (!requireArray(block.items, `${blockContext}.items`)) continue;
        for (const [itemIndex, item] of block.items.entries()) {
          requireString(item, `${blockContext}.items[${itemIndex}]`);
          assertOrderedFragment(item, `${blockContext}.items[${itemIndex}]`);
        }
      } else {
        fail(`${blockContext}: unsupported block type ${block.type}`);
      }
    }
  }

  if (verifiedFragments < 70) {
    fail(`parity: expected at least 70 ordered legacy text fragments, verified ${verifiedFragments}`);
  }

  if (legacySource.includes("policy-content-registry") || legacySource.includes("src/content/policies")) {
    fail("legacy source: /accessibility page.tsx must remain an immutable parity source; registry activation belongs in the reviewed layout/resolver boundary");
  }
}

if (errors.length > 0) {
  console.error("Accessibility policy payload parity verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Accessibility policy payload parity verification PASSED");
console.log(`- source revision: ${legacyBlobRevision}`);
console.log(`- version: ${version?.version ?? "missing"}`);
console.log(`- status: ${version?.status ?? "missing"}`);
console.log(`- public ready: ${version?.publicReady ?? "missing"}`);
console.log(`- effective at: ${version?.effectiveAt ?? "missing"}`);
console.log(`- required reviewer approvals: ${(version?.approvals ?? []).map((approval) => `${approval.reviewerRole}:${approval.state}`).join(", ")}`);
console.log(`- registry routing enabled: ${registry.registryRoutingEnabled}`);
console.log(`- archive routing enabled: ${registry.archiveRoutingEnabled}`);
console.log("- legacy page remains the exact reviewed parity source while the canonical layout selects the registry payload");
