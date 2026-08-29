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

const page = read("src/components/local-discovery-page.tsx");
const css = read("src/components/local-discovery-editorial.css");

for (const contract of [
  'fetch("/api/local"',
  'getCurrentApproximateLocation()',
  'href="/local/manage"',
  'href="/search"',
  'LOCAL_DISCOVERY_TYPES.map',
  'setIncludeRemote',
  'setRadiusMiles',
  'setDateWindow',
]) {
  assertIncludes(page, contract, `Local runtime contract ${contract}`);
}

for (const structuralClass of [
  "local-editorial-header",
  "local-editorial-signal",
  "local-editorial-search",
  "local-editorial-filters",
  "local-editorial-results",
  "local-editorial-destinations",
]) {
  assertIncludes(page, structuralClass, `Local Editorial structure ${structuralClass}`);
}

assertIncludes(css, "background: var(--loombus-page-bg);", "original Loombus background");
assertIncludes(css, ".local-editorial-signal", "flat Local signal strip");
assertIncludes(css, ".local-editorial-result", "divider-led result rows");
assertIncludes(css, "border-radius: 0;", "flat Editorial controls");
assertIncludes(css, "@media (prefers-reduced-motion: reduce)", "reduced-motion support");
assertIncludes(css, ":focus-visible", "keyboard focus treatment");
assertIncludes(css, "overflow-x: clip", "mobile overflow protection");
assertExcludes(css, "radial-gradient", "dashboard gradient chrome");
assertExcludes(css, "box-shadow:", "dashboard shadows");
assertExcludes(page, "xl:grid-cols-[minmax(0,1fr)_21rem]", "dashboard side rail");
assertExcludes(page, "shadow-2xl", "legacy floating panels");
assertExcludes(page, "rounded-[1.75rem]", "legacy Local cards");

console.log("Local Editorial UI verification passed.");
