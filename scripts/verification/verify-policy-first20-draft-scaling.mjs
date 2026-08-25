import fs from "node:fs";
import path from "node:path";
import { buildFirst20DraftImportPlan } from "../policy-content/build-first20-draft-import-plan.mjs";

const root = process.cwd();
const errors = [];

function addError(message) {
  errors.push(message);
}

let plan;
try {
  plan = buildFirst20DraftImportPlan(root);
} catch (error) {
  addError(error instanceof Error ? error.message : String(error));
}

if (plan) {
  if (plan.schemaVersion !== "policy_draft_import_plan.v1") {
    addError(`Unexpected plan schema ${plan.schemaVersion}`);
  }
  if (plan.sourceId !== "trust_safety_first_20_drafts") {
    addError(`Unexpected sourceId ${plan.sourceId}`);
  }
  if (plan.entryCount !== 20 || plan.entries.length !== 20) {
    addError(`Expected exactly 20 planned entries, got ${plan.entryCount}`);
  }
  if (plan.importEnabled !== false) addError("Import plan must remain non-executing");
  if (plan.publicRoutingEnabled !== false) addError("Public routing must remain disabled");

  const paths = new Set();
  const hashes = new Set();

  for (const [index, entry] of plan.entries.entries()) {
    const expectedOrdinal = index + 1;
    if (entry.ordinal !== expectedOrdinal) {
      addError(`Entry ${index}: expected ordinal ${expectedOrdinal}, got ${entry.ordinal}`);
    }
    if (!entry.sourcePath.startsWith("docs/trust-safety/drafts/")) {
      addError(`Entry ${entry.ordinal}: sourcePath escapes draft directory`);
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(entry.sourceHash)) {
      addError(`Entry ${entry.ordinal}: invalid sourceHash`);
    }
    if (!Number.isInteger(entry.sourceBytes) || entry.sourceBytes <= 0) {
      addError(`Entry ${entry.ordinal}: invalid sourceBytes`);
    }
    if (typeof entry.sourceTitle !== "string" || !entry.sourceTitle.trim()) {
      addError(`Entry ${entry.ordinal}: missing sourceTitle`);
    }
    if (entry.importAction !== "manual_identity_required") {
      addError(`Entry ${entry.ordinal}: importAction must require manual identity`);
    }

    const record = entry.proposedRecord ?? {};
    if (record.status !== "internal_draft") addError(`Entry ${entry.ordinal}: status must remain internal_draft`);
    if (record.audience !== "internal_only") addError(`Entry ${entry.ordinal}: audience must remain internal_only`);
    if (record.publicReady !== false) addError(`Entry ${entry.ordinal}: publicReady must remain false`);
    if (record.effectiveAt !== null) addError(`Entry ${entry.ordinal}: effectiveAt must remain null`);

    for (const field of ["documentId", "documentType", "category", "owner"]) {
      if (record[field] !== null) {
        addError(`Entry ${entry.ordinal}: ${field} must require explicit manual assignment`);
      }
    }

    if (paths.has(entry.sourcePath)) addError(`Duplicate sourcePath ${entry.sourcePath}`);
    paths.add(entry.sourcePath);
    if (hashes.has(entry.sourceHash)) addError(`Duplicate sourceHash ${entry.sourceHash}`);
    hashes.add(entry.sourceHash);
  }
}

const registryPath = path.join(root, "src/lib/policy-content-registry.data.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const source = (registry.migrationSources ?? []).find(
  (candidate) => candidate.sourceId === "trust_safety_first_20_drafts",
);

if (!source) addError("First-20 migration source is missing from registry");
if (source?.registryImportEnabled !== false) addError("registryImportEnabled must remain false");
if (source?.publicRoutingEnabled !== false) addError("publicRoutingEnabled must remain false");
if (source?.forcePublicReadyFalse !== true) addError("forcePublicReadyFalse must remain true");
if (source?.defaultStatus !== "internal_draft") addError("defaultStatus must remain internal_draft");
if (source?.defaultAudience !== "internal_only") addError("defaultAudience must remain internal_only");

const registryText = fs.readFileSync(registryPath, "utf8");
if (registryText.includes('"migrationState": "registry_candidate"') && !registryText.includes('"documentId": "POLICY-ACCESSIBILITY"')) {
  addError("Unexpected registry candidate introduced while scaling first-20 drafts");
}

if (errors.length > 0) {
  console.error("First-20 draft scaling verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("First-20 draft scaling verification PASSED");
console.log(`- planned internal drafts: ${plan.entryCount}`);
console.log("- explicit identity assignment required: yes");
console.log("- registry import enabled: no");
console.log("- public routing enabled: no");
console.log("- public-ready records generated: no");
