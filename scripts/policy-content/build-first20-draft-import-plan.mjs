import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SOURCE_ID = "trust_safety_first_20_drafts";
const PLAN_SCHEMA_VERSION = "policy_draft_import_plan.v1";

function sha256(content) {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

function extractTitle(content, sourcePath) {
  const match = content.match(/^#\s+(.+?)\s*$/m);
  if (!match?.[1]?.trim()) {
    throw new Error(`${sourcePath}: numbered draft must contain a non-empty H1 title`);
  }
  return match[1].trim();
}

function ordinalFromFilename(filename) {
  const match = filename.match(/^(\d{2})-/);
  return match ? Number(match[1]) : null;
}

export function buildFirst20DraftImportPlan(root = process.cwd()) {
  const registryPath = path.join(root, "src/lib/policy-content-registry.data.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const source = (registry.migrationSources ?? []).find(
    (candidate) => candidate.sourceId === SOURCE_ID,
  );

  if (!source) throw new Error(`Missing migration source ${SOURCE_ID}`);
  if (source.defaultStatus !== "internal_draft") {
    throw new Error(`${SOURCE_ID}: defaultStatus must remain internal_draft`);
  }
  if (source.defaultAudience !== "internal_only") {
    throw new Error(`${SOURCE_ID}: defaultAudience must remain internal_only`);
  }
  if (source.forcePublicReadyFalse !== true) {
    throw new Error(`${SOURCE_ID}: forcePublicReadyFalse must remain true`);
  }
  if (source.registryImportEnabled !== false) {
    throw new Error(`${SOURCE_ID}: registryImportEnabled must remain false`);
  }
  if (source.publicRoutingEnabled !== false) {
    throw new Error(`${SOURCE_ID}: publicRoutingEnabled must remain false`);
  }

  const directory = path.join(root, source.directory);
  const filenamePattern = new RegExp(source.filenamePattern);
  const filenames = fs
    .readdirSync(directory)
    .filter((filename) => filenamePattern.test(filename))
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length < 20) {
    throw new Error(`${SOURCE_ID}: expected at least 20 numbered drafts, found ${filenames.length}`);
  }

  const first20 = filenames
    .map((filename) => ({ filename, ordinal: ordinalFromFilename(filename) }))
    .filter((entry) => entry.ordinal !== null && entry.ordinal >= 1 && entry.ordinal <= 20)
    .sort((left, right) => left.ordinal - right.ordinal);

  if (first20.length !== 20) {
    throw new Error(`${SOURCE_ID}: expected exactly one numbered draft for each ordinal 01-20`);
  }

  for (let index = 0; index < first20.length; index += 1) {
    const expectedOrdinal = index + 1;
    if (first20[index].ordinal !== expectedOrdinal) {
      throw new Error(`${SOURCE_ID}: missing or duplicate ordinal ${String(expectedOrdinal).padStart(2, "0")}`);
    }
  }

  const entries = first20.map(({ filename, ordinal }) => {
    const sourcePath = path.posix.join(source.directory, filename);
    const absolutePath = path.join(root, sourcePath);
    const content = fs.readFileSync(absolutePath, "utf8");

    return {
      ordinal,
      sourcePath,
      sourceHash: sha256(content),
      sourceBytes: Buffer.byteLength(content, "utf8"),
      sourceTitle: extractTitle(content, sourcePath),
      importAction: "manual_identity_required",
      proposedRecord: {
        status: "internal_draft",
        audience: "internal_only",
        publicReady: false,
        effectiveAt: null,
        documentId: null,
        documentType: null,
        category: null,
        owner: null,
      },
    };
  });

  return {
    schemaVersion: PLAN_SCHEMA_VERSION,
    sourceId: SOURCE_ID,
    sourceDirectory: source.directory,
    entryCount: entries.length,
    importEnabled: false,
    publicRoutingEnabled: false,
    entries,
  };
}

function parseOutArg(argv) {
  const argument = argv.find((value) => value.startsWith("--out="));
  return argument ? argument.slice("--out=".length) : null;
}

const invokedDirectly = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (invokedDirectly) {
  const plan = buildFirst20DraftImportPlan();
  const json = `${JSON.stringify(plan, null, 2)}\n`;
  const outPath = parseOutArg(process.argv.slice(2));

  if (outPath) {
    fs.writeFileSync(path.resolve(outPath), json, "utf8");
    process.stdout.write(`Wrote ${plan.entryCount}-entry draft import plan to ${outPath}\n`);
  } else {
    process.stdout.write(json);
  }
}
