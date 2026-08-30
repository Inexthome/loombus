import fs from "node:fs";

const path = "src/app/my-replies/my-replies-v2-client.tsx";
const source = fs.readFileSync(path, "utf8");

function requireText(text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function requireMatch(pattern, message) {
  if (!pattern.test(source)) throw new Error(message);
}

function forbidMatch(pattern, message) {
  if (pattern.test(source)) throw new Error(message);
}

requireText("var(--loombus-page-bg)", "My Replies must use the Loombus page background token.");
requireText("var(--loombus-gold)", "My Replies must retain restrained Gold accents.");
requireMatch(/border-(?:b|t|y|l)/, "My Replies must use divider-led structure.");
requireMatch(/focus-visible:/, "My Replies must expose visible keyboard focus states.");
requireMatch(/min-h-(?:11|12)/, "My Replies must preserve mobile-sized interactive targets.");

for (const contract of [
  'supabase.auth.getUser()',
  'supabase.from("profiles")',
  'supabase.from("replies")',
  'supabase.from("discussions")',
  'supabase.from("reply_reactions")',
  'location.href="/login"',
  'normalizePublicText(reply.body)',
  'setQuery("")',
  'setTopic("all")',
  '#replies',
]) {
  requireText(contract, `My Replies behavior/data contract missing: ${contract}`);
}

forbidMatch(/\brounded(?:-|\b)/, "My Replies must not reintroduce rounded card/pill presentation.");
forbidMatch(/\bshadow(?:-|\b)/, "My Replies must not reintroduce decorative shadows.");

console.log("My Replies Editorial UI verification passed.");
