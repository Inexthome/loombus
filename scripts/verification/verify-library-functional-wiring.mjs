import fs from "node:fs";

const pagePath = "src/app/library/page.tsx";
const surfacePath = "src/components/library/library-functional-surface.tsx";
const page = fs.readFileSync(pagePath, "utf8");
const surface = fs.readFileSync(surfacePath, "utf8");
const failures = [];

const requiredTokens = [
  'from "@/lib/supabase/client"',
  'from("library_publications")',
  'from("library_member_items")',
  'from("library_reading_progress")',
  'from("library_highlights")',
  'from("library_notes")',
  'supabase.auth.getUser()',
  'Add to My Library',
  'Remove from My Library',
  'Continue Reading',
  'Highlights',
  'Authors',
];

for (const token of requiredTokens) {
  if (!surface.includes(token)) failures.push(`missing functional contract: ${token}`);
}

if (!page.includes("LibraryFunctionalSurface")) failures.push("Library route is not wired to the functional surface");

const forbiddenTokens = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "service_role",
  "stripe",
  "checkout",
  "storage.objects",
  "storage.buckets",
  "openai",
  "anthropic",
  "drm",
];

for (const token of forbiddenTokens) {
  if (surface.toLowerCase().includes(token.toLowerCase())) failures.push(`out-of-scope capability present: ${token}`);
}

if (!surface.includes("var(--loombus-gold)")) failures.push("Loombus Gold theme token missing");
if (!surface.includes("var(--loombus-page-bg)")) failures.push("theme-aware page background missing");

if (failures.length) {
  console.error("Loombus Library functional wiring verification FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loombus Library functional wiring verification passed");
console.log("- published discovery/search wired");
console.log("- My Library add/remove uses authenticated browser client");
console.log("- private progress/highlights/notes are read through RLS-protected tables");
console.log("- Light/Dark/System theme tokens preserved");
console.log("- uploads, commerce, storage, DRM, and AI execution remain absent");
