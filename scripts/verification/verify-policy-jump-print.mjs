import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const paths = {
  publicPolicyPage: "src/components/public-policy-page.tsx",
  printButton: "src/components/policy-content/policy-print-button.tsx",
  printStyles: "src/components/public-policy-page.module.css",
  structuredRenderer:
    "src/components/policy-content/structured-policy-renderer.tsx",
  accessibilityPayload:
    "src/content/policies/POLICY-ACCESSIBILITY/2026.08.10.1.json",
};

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    errors.push(`missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function expect(source, fragment, context) {
  if (!source.includes(fragment)) {
    errors.push(`${context}: missing expected fragment ${JSON.stringify(fragment)}`);
  }
}

function reject(source, fragment, context) {
  if (source.includes(fragment)) {
    errors.push(`${context}: forbidden fragment present ${JSON.stringify(fragment)}`);
  }
}

function parseJson(source, context) {
  try {
    return JSON.parse(source);
  } catch (error) {
    errors.push(
      `${context}: invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
}

const publicPolicyPage = read(paths.publicPolicyPage);
const printButton = read(paths.printButton);
const printStyles = read(paths.printStyles);
const structuredRenderer = read(paths.structuredRenderer);
const accessibilityPayload = parseJson(
  read(paths.accessibilityPayload),
  paths.accessibilityPayload,
);

for (const fragment of [
  "data-policy-print-root",
  "data-policy-screen-only",
  'aria-label="Jump to section"',
  "Jump to",
  'href={`#${section.id}`}',
  "section.number",
  "section.title",
  "data-policy-print-section",
  "scroll-mt-28",
  "<PolicyPrintButton />",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-[var(--loombus-gold)]",
  "focus-visible:ring-offset-2",
  "focus-visible:ring-offset-[var(--loombus-bg)]",
]) {
  expect(publicPolicyPage, fragment, paths.publicPolicyPage);
}

for (const forbidden of [
  "dangerouslySetInnerHTML",
  "tabIndex={-1}",
  'tabindex="-1"',
]) {
  reject(publicPolicyPage, forbidden, paths.publicPolicyPage);
}

for (const fragment of [
  '"use client"',
  'type="button"',
  "onClick={() => window.print()}",
  'aria-label="Print this document"',
  "Print document",
  "focus-visible:outline-none",
  "focus-visible:ring-2",
  "focus-visible:ring-[var(--loombus-gold)]",
]) {
  expect(printButton, fragment, paths.printButton);
}

for (const forbidden of [
  "fetch(",
  "axios",
  "XMLHttpRequest",
  "localStorage",
  "sessionStorage",
  "dangerouslySetInnerHTML",
]) {
  reject(printButton, forbidden, paths.printButton);
}

for (const fragment of [
  "@media print",
  "@page",
  "margin: 0.65in",
  ".printRoot.printRoot.printRoot",
  "[data-policy-screen-only]",
  "display: none !important",
  "background: #ffffff !important",
  "color: #000000 !important",
  "text-decoration: underline !important",
  "break-after: avoid-page",
  "orphans: 3",
  "widows: 3",
]) {
  expect(printStyles, fragment, paths.printStyles);
}

for (const fragment of [
  "id: section.id",
  "title: section.title",
  "sections={payload.sections.map(toPublicPolicySection)}",
]) {
  expect(structuredRenderer, fragment, paths.structuredRenderer);
}

if (accessibilityPayload) {
  if (accessibilityPayload.version !== "2026.08.10.1") {
    errors.push("Accessibility payload fixture must remain version 2026.08.10.1");
  }
  if (!Array.isArray(accessibilityPayload.sections)) {
    errors.push("Accessibility payload sections must be an array");
  } else {
    if (accessibilityPayload.sections.length < 2) {
      errors.push("Accessibility payload must have multiple sections for Jump-to navigation");
    }

    const ids = [];
    for (const [index, section] of accessibilityPayload.sections.entries()) {
      if (typeof section.id !== "string" || section.id.trim() === "") {
        errors.push(`Accessibility section ${index} is missing a stable id`);
        continue;
      }
      if (typeof section.title !== "string" || section.title.trim() === "") {
        errors.push(`Accessibility section ${section.id} is missing a title`);
      }
      ids.push(section.id);
    }

    if (new Set(ids).size !== ids.length) {
      errors.push("Accessibility section ids must remain unique for fragment navigation");
    }
  }
}

if (errors.length > 0) {
  console.error("Policy Jump-to and print verification FAILED:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Policy Jump-to and print verification PASSED");
console.log("- Jump-to navigation derives from stable section ids");
console.log("- Jump-to links and print action have explicit keyboard focus treatment");
console.log("- print action is client-isolated and performs no network or storage mutation");
console.log("- screen-only navigation/tools are removed from print output");
console.log("- print output forces readable black-on-white policy content");
console.log("- print headings avoid orphaned page breaks where supported");
console.log("- current Accessibility payload section ids are present and unique");
