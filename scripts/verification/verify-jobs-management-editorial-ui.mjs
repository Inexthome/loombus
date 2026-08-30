import fs from "node:fs";

const files = [
  "src/components/jobs-manager-page.tsx",
  "src/components/job-listing-editor.tsx",
  "src/components/job-listings-panel.tsx",
  "src/components/job-moderation-panel.tsx",
];

const source = Object.fromEntries(files.map((file) => [file, fs.readFileSync(file, "utf8")]));
const manager = source[files[0]];
const editor = source[files[1]];
const listings = source[files[2]];
const moderation = source[files[3]];

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(manager, "var(--loombus-page-bg)", "Jobs management must use the Editorial page background token.");
requireText(manager, 'fetch("/api/jobs?manage=1"', "Jobs management read contract changed unexpectedly.");
requireText(manager, 'fetch("/api/jobs"', "Jobs management mutation contract changed unexpectedly.");
requireText(manager, 'window.location.href = `/login?next=${encodeURIComponent("/jobs/manage")}`', "Jobs management auth redirect changed unexpectedly.");
requireText(manager, 'type WorkspaceTab = "records" | "editor" | "review"', "Jobs management workspace tabs changed unexpectedly.");
requireText(manager, "border-b-2 border-[color:var(--loombus-gold)]", "Jobs management active Editorial navigation signal is missing.");
requireText(editor, "border-0 border-b border-[var(--loombus-border)]", "Jobs editor must use underline-style Editorial fields.");
requireText(listings, "divide-y divide-[color:var(--loombus-border)]", "Jobs records must use divider-led Editorial rows.");
requireText(moderation, "divide-y divide-[var(--loombus-border)]", "Jobs moderation queues must use divider-led Editorial rows.");

for (const [file, text] of Object.entries(source)) {
  forbid(text, /shadow-(?:sm|md|lg|xl|2xl)/, `${file} still contains decorative shadow treatment.`);
  forbid(text, /rounded-\[(?:1\.3|1\.4|1\.5|1\.55|1\.75)rem\]/, `${file} still contains legacy large rounded-card treatment.`);
}

console.log("Jobs Management Editorial UI verification passed.");
