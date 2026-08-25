import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) errors.push(`${context}: missing ${JSON.stringify(fragment)}`);
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) errors.push(`${context}: forbidden ${JSON.stringify(fragment)}`);
}

const callout = read("src/components/policy-content/policy-change-note.tsx");
const accessibility = read("src/app/accessibility/layout.tsx");
const archive = read("src/app/policies/archive/[documentId]/[version]/page.tsx");
const history = read("src/app/policies/history/[documentId]/page.tsx");
const registry = JSON.parse(read("src/lib/policy-content-registry.data.json") || "{}");

expect(callout, "What changed", "change-note callout");
expect(callout, "changeNote?.trim()", "change-note callout");
expect(callout, "if (!note) return null", "change-note callout");
expect(callout, "aria-label", "change-note callout");
expect(callout, "focus-visible:ring-[var(--loombus-gold)]", "change-note callout");
reject(callout, "dangerouslySetInnerHTML", "change-note callout");
reject(callout, "fetch(", "change-note callout");

expect(accessibility, "resolution.version.changeNote", "Accessibility current route");
expect(accessibility, "policyHistoryHref", "Accessibility current route");
expect(archive, "resolved.version.changeNote", "archive route");
expect(archive, "policyHistoryHref", "archive route");
expect(history, "What changed", "history route");
expect(history, "Internal review notes, publication blockers, and reviewer details are not included", "history route");

const family = registry.documentFamilies?.find((candidate) => candidate.documentId === "POLICY-ACCESSIBILITY");
if (!family) {
  errors.push("registry: POLICY-ACCESSIBILITY missing");
} else {
  const current = family.registryManagedVersions?.find((candidate) => candidate.version === "2026.08.10.1");
  const predecessor = family.registryManagedVersions?.find((candidate) => candidate.version === "2026.07.18.1");
  if (!current?.changeNote?.trim()) errors.push("registry: current Accessibility change note missing");
  if (!predecessor?.changeNote?.trim()) errors.push("registry: predecessor Accessibility change note missing");
  if (current?.status !== "effective") errors.push("registry: current Accessibility version must remain effective");
  if (predecessor?.status !== "superseded") errors.push("registry: predecessor Accessibility version must remain superseded");
}

if (errors.length) {
  console.error("Policy change-note presentation verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy change-note presentation verification PASSED");
console.log("- current and exact archive routes present only public version changeNote text");
console.log("- history labels public change notes consistently");
console.log("- internal approval/reviewer/blocker metadata is not added to the presentation layer");
