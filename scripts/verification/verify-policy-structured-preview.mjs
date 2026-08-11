import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const AUTHORIZED_EFFECTIVE_AT = "2026-08-11T02:24:00.000Z";

const paths = {
  registry: "src/lib/policy-content-registry.data.json",
  payload: "src/content/policies/POLICY-ACCESSIBILITY/2026.07.18.1.json",
  payloadContract: "src/lib/policy-content-payload.ts",
  renderer: "src/components/policy-content/structured-policy-renderer.tsx",
  api: "src/app/api/admin/policy-content-preview/route.ts",
  page: "src/app/admin/policy-content-preview/page.tsx",
  client:
    "src/app/admin/policy-content-preview/policy-content-preview-client.tsx",
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

const registryText = read(paths.registry);
const payloadText = read(paths.payload);
const payloadContract = read(paths.payloadContract);
const renderer = read(paths.renderer);
const api = read(paths.api);
const page = read(paths.page);
const client = read(paths.client);
const liveAccessibility = read(paths.liveAccessibility);
const workflow = read(paths.workflow);

let registry = null;
let payload = null;
try {
  registry = JSON.parse(registryText);
} catch (error) {
  errors.push(`registry JSON invalid: ${error instanceof Error ? error.message : String(error)}`);
}
try {
  payload = JSON.parse(payloadText);
} catch (error) {
  errors.push(`payload JSON invalid: ${error instanceof Error ? error.message : String(error)}`);
}

if (registry) {
  if (registry.registryRoutingEnabled !== true) {
    errors.push("registry routing must be enabled after authorized Accessibility activation");
  }
  if (registry.archiveRoutingEnabled !== true) {
    errors.push("archive routing must be enabled after authorized Accessibility activation");
  }

  const family = registry.documentFamilies?.find(
    (candidate) => candidate.documentId === "POLICY-ACCESSIBILITY",
  );
  if (!family) {
    errors.push("POLICY-ACCESSIBILITY family is missing");
  } else {
    if (family.canonicalRoute !== "/accessibility") {
      errors.push("Accessibility canonical route changed unexpectedly");
    }
    if (family.migrationState !== "registry_managed") {
      errors.push("Accessibility must be registry_managed after authorized activation");
    }

    const version = family.registryManagedVersions?.find(
      (candidate) => candidate.version === "2026.07.18.1",
    );
    if (!version) {
      errors.push("Accessibility version 2026.07.18.1 is missing");
    } else {
      if (version.status !== "effective") errors.push("Accessibility version must be effective after activation");
      if (version.publicReady !== true) errors.push("Accessibility effective version must be publicReady=true");
      if (version.effectiveAt !== AUTHORIZED_EFFECTIVE_AT) errors.push("Accessibility effectiveAt does not match the explicit authorization timestamp");
      if (version.payloadPath !== paths.payload) errors.push("Accessibility payloadPath drifted");
      if (version.publicationBlockers?.some((blocker) => blocker.active === true)) {
        errors.push("Accessibility effective version must not retain an active publication blocker");
      }
      if (payload && version.sourceRevision !== payload.sourceRevision) {
        errors.push("Accessibility registry/payload sourceRevision mismatch");
      }
    }
  }
}

if (payload) {
  if (payload.schemaVersion !== "policy_payload.v1") errors.push("unexpected payload schemaVersion");
  if (payload.documentId !== "POLICY-ACCESSIBILITY") errors.push("unexpected payload documentId");
  if (payload.version !== "2026.07.18.1") errors.push("unexpected payload version");
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

expect(payloadContract, 'POLICY_PAYLOAD_SCHEMA_VERSION = "policy_payload.v1"', "payload contract");
expect(payloadContract, "export function validateStructuredPolicyPayload", "payload contract");
expect(payloadContract, "export function isSafePolicyPayloadHref", "payload contract");
expect(payloadContract, 'href.startsWith("/")', "payload href guard");
expect(payloadContract, 'href.startsWith("mailto:")', "payload href guard");
expect(payloadContract, 'href.startsWith("https://")', "payload href guard");
reject(payloadContract, "dangerouslySetInnerHTML", "payload contract");

expect(renderer, "PublicPolicyPage", "structured renderer");
expect(renderer, "isSafePolicyPayloadHref", "structured renderer");
reject(renderer, "dangerouslySetInnerHTML", "structured renderer");
reject(renderer, "@/content/policies/", "structured renderer must not import a concrete payload");

expect(api, "verifyRequestAccountAccess", "preview API");
expect(api, "access.profile.is_admin !== true", "preview API");
expect(api, "POLICY-ACCESSIBILITY/2026.07.18.1.json", "preview API static allowlist");
expect(api, '"Cache-Control": "private, no-store, max-age=0"', "preview API");
expect(api, '"X-Robots-Tag": "noindex, nofollow, noarchive"', "preview API");
expect(api, "validateStructuredPolicyPayload", "preview API");
expect(api, 'family.migrationState !== "registry_candidate"', "preview API candidate-only boundary");
expect(api, "export async function GET", "preview API");
reject(api, "export async function POST", "preview API must be read-only");
reject(api, "export async function PUT", "preview API must be read-only");
reject(api, "export async function PATCH", "preview API must be read-only");
reject(api, "export async function DELETE", "preview API must be read-only");
reject(api, "readFileSync", "preview API must not accept filesystem-derived dynamic payloads");
reject(api, "import(`", "preview API must not dynamically import request-selected payloads");

expect(page, "index: false", "preview page robots");
expect(page, "follow: false", "preview page robots");
expect(page, "noarchive: true", "preview page robots");

expect(client, 'const DOCUMENT_ID = "POLICY-ACCESSIBILITY"', "preview client");
expect(client, 'const VERSION = "2026.07.18.1"', "preview client");
expect(client, "StructuredPolicyRenderer", "preview client");
expect(client, "Authorization: `Bearer ${token}`", "preview client");
reject(client, "dangerouslySetInnerHTML", "preview client");
reject(client, "method: \"POST\"", "preview client must be read-only");
reject(client, "<form", "preview client must not expose an editor form");
reject(client, "<textarea", "preview client must not expose an editor textarea");

reject(liveAccessibility, "StructuredPolicyRenderer", "legacy Accessibility page must remain an immutable parity source");
reject(liveAccessibility, "policy-content-payload", "legacy Accessibility page must remain disconnected");
reject(liveAccessibility, "src/content/policies", "legacy Accessibility page must remain disconnected");

expect(workflow, '"src/lib/policy-content-payload.ts"', "policy governance workflow watch paths");
expect(workflow, '"src/components/policy-content/**"', "policy governance workflow watch paths");
expect(workflow, '"src/app/admin/policy-content-preview/**"', "policy governance workflow watch paths");
expect(workflow, '"src/app/api/admin/policy-content-preview/**"', "policy governance workflow watch paths");
expect(workflow, '"scripts/verification/verify-policy-structured-preview.mjs"', "policy governance workflow watch paths");
expect(
  workflow,
  "node scripts/verification/verify-policy-structured-preview.mjs",
  "policy governance workflow step",
);

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
console.log("- Accessibility is registry_managed, effective, and publicReady=true");
console.log("- candidate preview API remains administrator-only, GET-only, static-allowlisted, and no-store");
console.log("- effective Accessibility is served through the canonical route adapter, not by mutating the reviewed legacy page");
console.log("- structured renderer rejects unsafe link schemes and uses no raw HTML injection");
console.log("- preview exposes no editor, approval, publish, notice, or write action");
