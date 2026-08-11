import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const BASE_VERSION = "2026.07.18.1";
const SUCCESSOR_VERSION = "2026.08.10.1";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  basePayload: "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
  successorPayload: "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json",
  payloadContract: "src/lib/policy-content-payload.ts",
  renderer: "src/components/policy-content/structured-policy-renderer.tsx",
  api: "src/app/api/admin/policy-content-preview/route.ts",
  page: "src/app/admin/policy-content-preview/page.tsx",
  client: "src/app/admin/policy-content-preview/policy-content-preview-client.tsx",
  liveAccessibility: "src/app/accessibility/page.tsx",
  workflow: ".github/workflows/policy-content-governance.yml",
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

function safeHref(href) {
  if (typeof href !== "string" || !href || /[\r\n\0]/.test(href)) return false;
  if (href.startsWith("/")) return !href.startsWith("//") && !href.startsWith("/\\");
  if (href.startsWith("mailto:")) return !/[<>]/.test(href);
  if (href.startsWith("https://")) {
    try {
      return new URL(href).protocol === "https:";
    } catch {
      return false;
    }
  }
  return false;
}

const registry = JSON.parse(read(paths.registry));
const basePayload = JSON.parse(read(paths.basePayload));
const successorPayload = JSON.parse(read(paths.successorPayload));
const payloadContract = read(paths.payloadContract);
const renderer = read(paths.renderer);
const api = read(paths.api);
const page = read(paths.page);
const client = read(paths.client);
const liveAccessibility = read(paths.liveAccessibility);
const workflow = read(paths.workflow);

if (registry.registryRoutingEnabled !== true) {
  errors.push("registry routing must remain enabled for the current effective policy");
}
if (registry.archiveRoutingEnabled !== true) {
  errors.push("archive routing must remain enabled for the current effective policy");
}

const family = registry.documentFamilies?.find(
  (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
);
if (!family) {
  errors.push("POLICY-ACCESSIBILITY family is missing");
} else {
  if (family.migrationState !== "registry_managed") {
    errors.push("Accessibility must remain registry_managed");
  }

  const base = family.registryManagedVersions?.find(
    (candidate) => candidate.version === BASE_VERSION,
  );
  const successor = family.registryManagedVersions?.find(
    (candidate) => candidate.version === SUCCESSOR_VERSION,
  );

  if (!base || base.status !== "effective" || base.publicReady !== true) {
    errors.push("current Accessibility version must remain effective and publicReady=true");
  }
  if (!successor) {
    errors.push("Accessibility successor preview candidate is missing");
  } else {
    if (successor.status !== "review") errors.push("successor preview candidate must remain in review");
    if (successor.publicReady !== false) errors.push("successor preview candidate must remain publicReady=false");
    if (successor.effectiveAt !== null) errors.push("successor preview candidate must remain without an effective date");
    if (successor.payloadPath !== paths.successorPayload) errors.push("successor payloadPath drifted");
    if (successor.publicationBlockers?.every((blocker) => blocker.active !== true)) {
      errors.push("successor preview candidate must retain active publication blockers");
    }
    if (successorPayload.sourceRevision !== successor.sourceRevision) {
      errors.push("successor registry/payload sourceRevision mismatch");
    }
  }
}

for (const payload of [basePayload, successorPayload]) {
  if (payload.schemaVersion !== "policy_payload.v1") errors.push("unexpected payload schemaVersion");
  if (payload.documentId !== "POLICY-ACCESSIBILITY") errors.push("unexpected payload documentId");
  if (payload.canonicalRoute !== "/accessibility") errors.push("unexpected payload canonicalRoute");
  if (!Array.isArray(payload.sections) || payload.sections.length !== 19) {
    errors.push(`Accessibility payload must contain exactly 19 sections; found ${payload.sections?.length ?? "invalid"}`);
  }
  for (const [sectionIndex, section] of (payload.sections ?? []).entries()) {
    for (const [blockIndex, block] of (section.blocks ?? []).entries()) {
      if (block.type !== "paragraph") continue;
      for (const [inlineIndex, inline] of (block.content ?? []).entries()) {
        if (inline.type === "link" && !safeHref(inline.href)) {
          errors.push(
            `unsafe href in payload sections[${sectionIndex}].blocks[${blockIndex}].content[${inlineIndex}]`,
          );
        }
      }
    }
  }
}

if (basePayload.version !== BASE_VERSION) errors.push("base payload version drifted");
if (successorPayload.version !== SUCCESSOR_VERSION) errors.push("successor payload version drifted");
if (successorPayload.reviewedDate !== "August 10, 2026") {
  errors.push("successor preview must display Last reviewed: August 10, 2026");
}

expect(payloadContract, 'POLICY_PAYLOAD_SCHEMA_VERSION = "policy_payload.v1"', "payload contract");
expect(payloadContract, "export function validateStructuredPolicyPayload", "payload contract");
expect(payloadContract, "export function isSafePolicyPayloadHref", "payload contract");
reject(payloadContract, "dangerouslySetInnerHTML", "payload contract");

expect(renderer, "PublicPolicyPage", "structured renderer");
expect(renderer, "isSafePolicyPayloadHref", "structured renderer");
reject(renderer, "dangerouslySetInnerHTML", "structured renderer");
reject(renderer, "@/content/policies/", "structured renderer must not import a concrete payload");

for (const fragment of [
  "verifyRequestAccountAccess",
  "access.profile.is_admin !== true",
  "POLICY-ACCESSIBILITY/2026.08.10.1.json",
  "PREVIEWABLE_STATUSES",
  'family.migrationState !== "registry_candidate"',
  'family.migrationState !== "registry_managed"',
  "!PREVIEWABLE_STATUSES.has(versionRecord.status)",
  '"Cache-Control": "private, no-store, max-age=0"',
  '"X-Robots-Tag": "noindex, nofollow, noarchive"',
  "validateStructuredPolicyPayload",
  "export async function GET",
]) {
  expect(api, fragment, "preview API");
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
  reject(api, forbidden, "preview API");
}

expect(page, "index: false", "preview page robots");
expect(page, "follow: false", "preview page robots");
expect(page, "noarchive: true", "preview page robots");

expect(client, 'const DOCUMENT_ID = "POLICY-ACCESSIBILITY"', "preview client");
expect(client, 'const VERSION = "2026.08.10.1"', "preview client");
expect(client, "StructuredPolicyRenderer", "preview client");
expect(client, "Authorization: `Bearer ${token}`", "preview client");
for (const forbidden of ["dangerouslySetInnerHTML", 'method: "POST"', "<form", "<textarea"]) {
  reject(client, forbidden, "preview client");
}

reject(liveAccessibility, "StructuredPolicyRenderer", "legacy Accessibility page must remain an immutable parity source");
reject(liveAccessibility, "policy-content-payload", "legacy Accessibility page must remain disconnected");
reject(liveAccessibility, "src/content/policies", "legacy Accessibility page must remain disconnected");

expect(workflow, '"src/app/admin/policy-content-preview/**"', "policy governance workflow watch paths");
expect(workflow, '"src/app/api/admin/policy-content-preview/**"', "policy governance workflow watch paths");
expect(workflow, '"scripts/verification/verify-policy-structured-preview.mjs"', "policy governance workflow watch paths");
expect(workflow, "node scripts/verification/verify-policy-structured-preview.mjs", "policy governance workflow step");

for (const unsafe of [
  "javascript:alert(1)",
  "data:text/html,unsafe",
  "//evil.example/path",
  "/\\evil.example/path",
  "http://example.com",
  "javascript:\nalert(1)",
]) {
  if (safeHref(unsafe)) errors.push(`href fixture unexpectedly allowed: ${unsafe}`);
}
for (const allowed of [
  "/support?category=accessibility",
  "mailto:support@loombus.com?subject=Accessibility",
  "https://loombus.com/accessibility",
]) {
  if (!safeHref(allowed)) errors.push(`href fixture unexpectedly rejected: ${allowed}`);
}

if (errors.length > 0) {
  console.error("Structured policy preview verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Structured policy preview verification PASSED");
console.log("- current Accessibility remains effective and publicly routed");
console.log("- successor 2026.08.10.1 remains review-only and publicReady=false");
console.log("- preview supports non-effective candidates inside registry-managed families");
console.log("- preview remains administrator-only, GET-only, static-allowlisted, and no-store");
console.log("- effective/superseded/withdrawn versions are rejected by the candidate preview boundary");
