import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function assertIncludes(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function assertExcludes(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Unexpected ${label}: ${needle}`);
}

const page = read("src/app/labs/labs-v2-client.tsx");
const css = read("src/app/labs/labs-v2.css");

for (const contract of [
  'from("labs_feature_requests")',
  'from("labs_feature_request_votes")',
  'fetch("/api/labs/requests"',
  'fetch("/api/labs/requests/vote"',
  'href="/admin/labs"',
  'href="/premium"',
  'href="/support"',
]) {
  assertIncludes(page, contract, `Labs runtime contract ${contract}`);
}

for (const editorialClass of [
  "labs-v2-program",
  "labs-v2-submit-section",
  "labs-v2-workflow",
  "labs-v2-board",
  "labs-v2-resources",
]) {
  assertIncludes(page, editorialClass, `Labs Editorial structure ${editorialClass}`);
}

assertIncludes(css, "background: var(--loombus-page-bg);", "original Loombus background");
assertIncludes(css, ".labs-v2-metrics", "flat Labs signal strip");
assertIncludes(css, ".labs-v2-program-card:nth-child(odd)", "divider-led capability directory");
assertIncludes(css, ".labs-v2-request", "divider-led request rows");
assertIncludes(css, "border-radius: 0;", "flat Editorial form controls");
assertIncludes(css, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");
assertIncludes(css, ":focus-visible", "keyboard focus treatment");
assertIncludes(css, "overflow-x: clip", "mobile overflow protection");
assertExcludes(css, "radial-gradient", "dashboard gradient chrome");
assertExcludes(css, "box-shadow", "dashboard card shadows");
assertExcludes(page, "No separate experiment enrollment catalog is published here.", "defensive experiment placeholder panel");

console.log("Labs Editorial UI verification passed.");
