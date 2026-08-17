import fs from "node:fs";

const files = {
  launcher: "src/components/library/library-discuss-passage-launcher.tsx",
  panel: "src/components/library/library-ask-loombus-panel.tsx",
  page: "src/app/library/ask-loombus/page.tsx",
  api: "src/app/api/library/ask-loombus/route.ts",
};

for (const path of Object.values(files)) {
  if (!fs.existsSync(path)) throw new Error(`Missing Ask Loombus runtime file: ${path}`);
}

const launcher = fs.readFileSync(files.launcher, "utf8");
const panel = fs.readFileSync(files.panel, "utf8");
const page = fs.readFileSync(files.page, "utf8");
const api = fs.readFileSync(files.api, "utf8");

for (const contract of [
  'ASK_LOOMBUS_STORAGE_KEY = "loombus:library:ask-loombus:v1"',
  'openTool(ASK_LOOMBUS_STORAGE_KEY, "/library/ask-loombus")',
  "Ask Loombus",
  "Discuss passage",
]) {
  if (!launcher.includes(contract)) throw new Error(`Ask Loombus launcher contract missing: ${contract}`);
}

for (const contract of [
  'fetch("/api/library/ask-loombus"',
  'Authorization: `Bearer ${session.access_token}`',
  "selected_passage_and_nearby_chapter",
  "It does not browse the web in this Reader tool.",
]) {
  if (!panel.includes(contract)) throw new Error(`Ask Loombus panel contract missing: ${contract}`);
}

if (!page.includes("LibraryAskLoombusPanel")) throw new Error("Ask Loombus page does not render its panel.");

for (const contract of [
  'const FEATURE_KEY = "ask_loombus"',
  'getAiAccess(supabase, userId)',
  "access.monthlyResearchLimit",
  'getMonthlyAiFeatureUsageCount(supabase, userId, FEATURE_KEY)',
  '.from("library_publication_sections")',
  "canonicalHash !== textSha256",
  "sectionText.slice(startOffset, endOffset) !== selectedText",
  'fetch("https://api.openai.com/v1/responses"',
  "store: false",
  'provider: "openai"',
  "logAiUsage",
  'grounding: "selected_passage_and_nearby_chapter"',
]) {
  if (!api.includes(contract)) throw new Error(`Ask Loombus API contract missing: ${contract}`);
}

const validationIndex = api.indexOf("sectionText.slice(startOffset, endOffset) !== selectedText");
const creditIndex = api.indexOf("consumeExtraAiCredit({");
if (validationIndex < 0 || creditIndex < 0 || creditIndex < validationIndex) {
  throw new Error("Ask Loombus must verify the canonical passage before consuming any extra AI credit.");
}

const forbiddenClientTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "OPENAI_API_KEY",
  "library-publication-originals",
  "dangerouslySetInnerHTML",
];
for (const token of forbiddenClientTokens) {
  if (launcher.includes(token) || panel.includes(token) || page.includes(token)) {
    throw new Error(`Forbidden Ask Loombus client token found: ${token}`);
  }
}

for (const token of ["library-publication-originals", "storage.from", "dangerouslySetInnerHTML", "web_search"]) {
  if (api.includes(token)) throw new Error(`Forbidden Ask Loombus API capability found: ${token}`);
}

console.log("PASS: Library Ask Loombus runtime contracts verified.");
