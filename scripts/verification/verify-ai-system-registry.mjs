import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(
  root,
  "docs/trust-safety/implementation/ai-system-registry.json"
);
const envExamplePath = path.join(root, ".env.example");

function fail(message) {
  console.error(`AI governance verification failed: ${message}`);
  process.exitCode = 1;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function walk(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(relative) : [relative];
  });
}

if (!fs.existsSync(registryPath)) {
  fail("missing ai-system-registry.json");
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const systems = Array.isArray(registry.systems) ? registry.systems : [];

if (registry.schemaVersion !== 1) fail("unsupported registry schemaVersion");
if (systems.length === 0) fail("registry contains no systems");
if (
  JSON.stringify(registry.activeExternalLlmProviders) !== JSON.stringify(["openai"])
) {
  fail("activeExternalLlmProviders must be exactly [\"openai\"]");
}

const requiredFields = [
  "id",
  "featureName",
  "owner",
  "systemKind",
  "provider",
  "productionEndpoint",
  "sourcePaths",
  "trigger",
  "inputData",
  "dataClasses",
  "permissionChecks",
  "outputDestination",
  "firstPartyRetention",
  "providerRequestStorageControl",
  "humanAccessReview",
  "region",
  "fallbackFailure",
  "userControls",
  "decisionClass",
  "changeNotification",
];

const ids = new Set();
for (const system of systems) {
  for (const field of requiredFields) {
    if (!(field in system)) fail(`${system.id ?? "<unknown>"} is missing ${field}`);
  }
  if (ids.has(system.id)) fail(`duplicate system id ${system.id}`);
  ids.add(system.id);

  if (system.systemKind?.includes("provider_ai") && system.provider !== "openai") {
    fail(`${system.id} has non-OpenAI active provider ${system.provider}`);
  }

  for (const sourcePath of system.sourcePaths ?? []) {
    if (!fs.existsSync(path.join(root, sourcePath))) {
      fail(`${system.id} references missing source path ${sourcePath}`);
    }
  }
}

const executableFiles = walk("src").filter((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
const executableText = executableFiles
  .map((file) => `\n--- ${file} ---\n${read(file)}`)
  .join("\n");

for (const forbidden of [
  "api.anthropic.com",
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_FALLBACK_MODEL",
  "@/lib/anthropic-ai",
]) {
  if (executableText.includes(forbidden)) {
    fail(`active source still contains retired Anthropic token: ${forbidden}`);
  }
}

const criticalContracts = [
  {
    file: "src/lib/floor-ai-analysis.ts",
    required: ["api.openai.com/v1/chat/completions", "store: false", "OPENAI_FLOOR_ANALYSIS_MODEL"],
  },
  {
    file: "src/app/api/discussions/summary/route.ts",
    required: ["api.openai.com/v1/chat/completions", "store: false"],
  },
  {
    file: "src/lib/moderation/ai-safety.ts",
    required: ["api.openai.com/v1/chat/completions", "store: false", "ai_safety_unavailable", "action: \"block\""],
  },
  {
    file: "src/app/api/admin/floor/research-draft/route.ts",
    required: ["api.openai.com/v1/responses", "store: false", "web_search", "floor-research-desk-v1"],
  },
  {
    file: "src/app/api/search/ai/route.ts",
    required: ["store: false", "result.type === \"saved\"", "result.visibility !== \"member\"", "result.visibility !== \"private\""],
  },
  {
    file: "src/app/api/messages/ai-assist/route.ts",
    required: ["store: false", "message_ai_assist", "logAiUsage"],
  },
  {
    file: "src/app/api/discussions/conversation-intelligence/route.ts",
    required: ["store: false", "get_discussion_intelligence_candidates"],
  },
];

for (const contract of criticalContracts) {
  const text = read(contract.file);
  for (const marker of contract.required) {
    if (!text.includes(marker)) fail(`${contract.file} is missing required marker: ${marker}`);
  }
}

const safetyPolicy = read("src/lib/moderation/safety-policy.ts");
for (const label of ["private_message", "profile", "discussion", "reply"]) {
  if (!safetyPolicy.includes(`return \"${label}\" as const`)) {
    fail(`safety policy is missing explicit AI content type ${label}`);
  }
}

const envExample = fs.readFileSync(envExamplePath, "utf8");
const openAiEnvVars = new Set();
for (const match of executableText.matchAll(/process\.env\.(OPENAI_[A-Z0-9_]+)/g)) {
  openAiEnvVars.add(match[1]);
}

for (const variable of [...openAiEnvVars].sort()) {
  if (!new RegExp(`^${variable}=`, "m").test(envExample)) {
    fail(`.env.example does not document active ${variable}`);
  }
}

if (!process.exitCode) {
  console.log(
    `AI governance verification passed: ${systems.length} registered systems, ${openAiEnvVars.size} OpenAI environment variables, Anthropic absent from active source.`
  );
}
