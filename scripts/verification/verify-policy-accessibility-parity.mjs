import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const BASE_VERSION = "2026.07.18.1";
const AUTHORIZED_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";
const EXPECTED_SOURCE_REVISION =
  "git-blob:21b0c0eb9504012d8926dc73dcb88d5591a17780";

function fail(message) {
  errors.push(message);
}

function normalize(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function gitBlobRevision(content) {
  const bytes = Buffer.from(content, "utf8");
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return `git-blob:${crypto
    .createHash("sha1")
    .update(Buffer.concat([header, bytes]))
    .digest("hex")}`;
}

const registry = JSON.parse(
  fs.readFileSync(
    path.join(root, "src/lib/policy-content-registry.data.json"),
    "utf8",
  ),
);
const family = registry.documentFamilies.find(
  (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
);
const version = family?.registryManagedVersions?.find(
  (candidate) => candidate.version === BASE_VERSION,
);
const payloadPath =
  version?.payloadPath ??
  "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json";
const payload = JSON.parse(fs.readFileSync(path.join(root, payloadPath), "utf8"));
const legacyPath = family?.currentSourcePath ?? "src/app/accessibility/page.tsx";
const legacySource = fs.readFileSync(path.join(root, legacyPath), "utf8");
const legacyNormalized = normalize(legacySource);
const liveRevision = gitBlobRevision(legacySource);

if (registry.registryRoutingEnabled !== true) {
  fail("registry routing must remain enabled after Accessibility activation");
}
if (registry.archiveRoutingEnabled !== true) {
  fail("archive routing must remain enabled after Accessibility activation");
}
if (!family) {
  fail("POLICY-ACCESSIBILITY family is missing");
} else {
  if (family.canonicalRoute !== "/accessibility") fail("Accessibility canonical route drifted");
  if (family.currentSourcePath !== "src/app/accessibility/page.tsx") {
    fail("Accessibility legacy parity source path drifted");
  }
  if (family.migrationState !== "registry_managed") {
    fail("Accessibility family must remain registry_managed");
  }

  const effectiveVersions = family.registryManagedVersions.filter(
    (candidate) => candidate.status === "effective" && candidate.publicReady === true,
  );
  if (
    effectiveVersions.length !== 1 ||
    effectiveVersions[0]?.version !== BASE_VERSION
  ) {
    fail("2026.07.18.1 must remain the sole effective Accessibility version until a successor is separately activated");
  }
}

if (!version) {
  fail(`Accessibility effective version ${BASE_VERSION} is missing`);
} else {
  if (version.status !== "effective") fail("base Accessibility version must remain effective");
  if (version.publicReady !== true) fail("base Accessibility version must remain publicReady=true");
  if (version.effectiveAt !== AUTHORIZED_EFFECTIVE_AT) {
    fail("base Accessibility effective timestamp drifted");
  }
  if (version.sourceRevision !== EXPECTED_SOURCE_REVISION) {
    fail("base Accessibility source revision drifted");
  }
  if (version.publicationBlockers?.some((blocker) => blocker.active === true)) {
    fail("base effective Accessibility version regained an active publication blocker");
  }
  for (const reviewerRole of version.requiredReviewers ?? []) {
    const approval = version.approvals?.find(
      (candidate) => candidate.reviewerRole === reviewerRole,
    );
    if (approval?.state !== "approved") {
      fail(`${reviewerRole} approval must remain approved on the effective version`);
    }
    if (approval?.sourceRevision !== EXPECTED_SOURCE_REVISION) {
      fail(`${reviewerRole} approval source revision drifted`);
    }
  }
}

if (liveRevision !== EXPECTED_SOURCE_REVISION) {
  fail(`legacy parity source drifted: expected ${EXPECTED_SOURCE_REVISION}, got ${liveRevision}`);
}
if (payload.schemaVersion !== "policy_payload.v1") fail("unexpected payload schema version");
if (payload.documentId !== "POLICY-ACCESSIBILITY") fail("unexpected payload document id");
if (payload.version !== BASE_VERSION) fail("effective payload version drifted");
if (payload.canonicalRoute !== "/accessibility") fail("effective payload canonical route drifted");
if (payload.legacySourcePath !== legacyPath) fail("effective payload legacySourcePath drifted");
if (payload.sourceRevision !== EXPECTED_SOURCE_REVISION) fail("effective payload source revision drifted");
if (payload.reviewedDate !== "July 18, 2026") {
  fail("effective historical payload reviewedDate must remain July 18, 2026");
}
if (payload.effectiveDate !== null) {
  fail("effective payload must not gain a payload-level effectiveDate field value");
}
if (version && version.payloadPath !== payloadPath) {
  fail("effective registry payload path does not match the parity payload");
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
  fail("effective Accessibility payload section IDs/order drifted");
}

for (const [key, expected] of Object.entries({
  title: "Accessibility | Loombus",
  description:
    "Loombus accessibility approach for keyboard, screen-reader, zoom, contrast, themes, motion, forms, media, files, mobile applications, and support.",
  canonical: "https://loombus.com/accessibility",
})) {
  if (payload.pageMetadata?.[key] !== expected) {
    fail(`payload.pageMetadata.${key} drifted`);
  }
  if (!legacySource.includes(expected)) {
    fail(`legacy parity source no longer contains page metadata ${key}`);
  }
}
if (!legacySource.includes('reviewedDate="July 18, 2026"')) {
  fail("legacy parity source reviewedDate drifted");
}
if (legacySource.includes("effectiveDate=")) {
  fail("legacy parity source unexpectedly gained an effectiveDate prop");
}

let cursor = 0;
let verifiedFragments = 0;
function assertOrdered(fragment, context) {
  const target = normalize(fragment);
  if (!target || target === "." || target === "support@loombus.com") return;
  const index = legacyNormalized.indexOf(target, cursor);
  if (index === -1) {
    fail(`${context}: payload text is missing or out of order in the legacy parity source`);
    return;
  }
  cursor = index + target.length;
  verifiedFragments += 1;
}

for (const [sectionIndex, section] of (payload.sections ?? []).entries()) {
  assertOrdered(`id: "${section.id}"`, `sections[${sectionIndex}].id`);
  assertOrdered(`title: "${section.title}"`, `sections[${sectionIndex}].title`);
  for (const [blockIndex, block] of (section.blocks ?? []).entries()) {
    if (block.type === "bullet_list") {
      for (const [itemIndex, item] of (block.items ?? []).entries()) {
        assertOrdered(item, `sections[${sectionIndex}].blocks[${blockIndex}].items[${itemIndex}]`);
      }
      continue;
    }
    if (block.type !== "paragraph") {
      fail(`sections[${sectionIndex}].blocks[${blockIndex}]: unsupported block type ${block.type}`);
      continue;
    }
    for (const [inlineIndex, inline] of (block.content ?? []).entries()) {
      if (inline.type !== "text" && inline.type !== "link") {
        fail(`sections[${sectionIndex}].blocks[${blockIndex}].content[${inlineIndex}]: unsupported inline type ${inline.type}`);
        continue;
      }
      if (inline.type === "link") {
        if (!(inline.href?.startsWith("/") || inline.href?.startsWith("mailto:"))) {
          fail(`sections[${sectionIndex}].blocks[${blockIndex}].content[${inlineIndex}]: disallowed link form`);
        }
        if (inline.href?.startsWith("/") && !legacySource.includes(`href="${inline.href}"`)) {
          fail(`sections[${sectionIndex}].blocks[${blockIndex}].content[${inlineIndex}]: internal href drifted from legacy source`);
        }
      }
      assertOrdered(
        inline.text,
        `sections[${sectionIndex}].blocks[${blockIndex}].content[${inlineIndex}]`,
      );
    }
  }
}

if (verifiedFragments < 70) {
  fail(`expected at least 70 ordered legacy parity fragments, verified ${verifiedFragments}`);
}
if (legacySource.includes("policy-content-registry") || legacySource.includes("src/content/policies")) {
  fail("legacy Accessibility page must remain an immutable parity source disconnected from registry rendering");
}

if (errors.length > 0) {
  console.error("Accessibility policy payload parity verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Accessibility policy payload parity verification PASSED");
console.log(`- immutable effective version: ${BASE_VERSION}`);
console.log(`- source revision: ${EXPECTED_SOURCE_REVISION}`);
console.log(`- effective at: ${AUTHORIZED_EFFECTIVE_AT}`);
console.log(`- registered family versions: ${family?.registryManagedVersions?.length ?? 0}`);
console.log("- additional non-effective successor versions do not alter the effective parity target");
