import fs from "node:fs";

const path = "src/app/my-discussions/my-discussions-v2-client.tsx";
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

requireText("var(--loombus-page-bg)", "My Discussions must use the Loombus page background token.");
requireText("var(--loombus-gold)", "My Discussions must retain restrained Gold accents.");
requireMatch(/border-(?:b|t|y|l)/, "My Discussions must use divider-led structure.");
requireMatch(/focus-visible:/, "My Discussions must expose visible keyboard focus states.");
requireMatch(/min-h-(?:11|12)/, "My Discussions must preserve mobile-sized interactive targets.");

for (const contract of [
  'supabase.auth.getUser()',
  'supabase.from("profiles")',
  'supabase.from("user_ai_entitlements")',
  'supabase.from("discussions")',
  'supabase.from("discussion_drafts")',
  'supabase.from("replies")',
  'supabase.from("discussion_views")',
  'supabase.auth.getSession()',
  'fetch("/api/discussion-drafts"',
  'method:"DELETE"',
  'body:JSON.stringify({draftId:id})',
  'fetch("/api/discussions/delete"',
  'method:"POST"',
  'body:JSON.stringify({discussionId:id})',
  'moderation and audit records will be preserved',
  'location.href="/login"',
  'e?.ai_assisted_enabled === true && e.tier === "premium"',
  'normalizePublicText(d.title)',
  'normalizePublicText(d.body)',
  'setQ("")',
  'setTopic("all")',
  'setStatus("all")',
  'setSort("newest")',
]) {
  requireText(contract, `My Discussions behavior/data contract missing: ${contract}`);
}

forbidMatch(/\brounded(?:-|\b)/, "My Discussions must not reintroduce rounded card/pill presentation.");
forbidMatch(/\bshadow(?:-|\b)/, "My Discussions must not reintroduce decorative shadows.");

console.log("My Discussions Editorial UI verification passed.");
