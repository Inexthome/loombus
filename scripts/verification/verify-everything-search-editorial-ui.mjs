import fs from "node:fs";

const pagePath = "src/app/search/page.tsx";
const componentsPath = "src/app/search/everything-search-components.tsx";

const page = fs.readFileSync(pagePath, "utf8");
const components = fs.readFileSync(componentsPath, "utf8");
const source = `${page}\n${components}`;

function requireMatch(value, pattern, message) {
  if (!pattern.test(value)) {
    throw new Error(message);
  }
}

function forbidMatch(value, pattern, message) {
  if (pattern.test(value)) {
    throw new Error(message);
  }
}

requireMatch(page, /var\(--loombus-page-bg\)/, "Everything Search must use the Loombus page background token.");
requireMatch(source, /var\(--loombus-gold\)/, "Everything Search must use restrained Loombus Gold accents.");
requireMatch(source, /border-(?:b|t|y|l)/, "Everything Search must use divider-led structure.");
requireMatch(source, /focus-visible:/, "Everything Search controls must expose visible keyboard focus states.");
requireMatch(source, /min-h-(?:11|12)/, "Everything Search interactive controls must preserve mobile-sized targets.");

for (const contract of [
  "useEverythingSearch",
  "state.submit",
  "state.askAiFromInput",
  "state.askAi",
  "state.selectGroup",
  "state.runSearch",
]) {
  if (!page.includes(contract)) {
    throw new Error(`Everything Search behavior contract missing: ${contract}`);
  }
}

for (const contract of ["result.href", "onAsk", "upgradeRequired", "sources"]) {
  if (!components.includes(contract)) {
    throw new Error(`Everything Search result/AI contract missing: ${contract}`);
  }
}

forbidMatch(source, /\brounded(?:-|\b)/, "Everything Search must not reintroduce rounded card/pill presentation.");
forbidMatch(source, /\bshadow(?:-|\b)/, "Everything Search must not reintroduce decorative shadows.");

console.log("Everything Search Editorial UI verification passed.");
