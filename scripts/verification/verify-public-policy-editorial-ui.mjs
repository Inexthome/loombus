import fs from "node:fs";

const componentPath = "src/components/public-policy-page.tsx";
const cssPath = "src/components/public-policy-page.module.css";
const component = fs.readFileSync(componentPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(css, "background: var(--loombus-page-bg);", "Public policy pages must use the Editorial page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "Public policy pages must use divider-led Editorial structure.");
requireText(css, "color: var(--loombus-gold);", "Public policy pages must use restrained Gold for editorial signals.");
requireText(css, "min-height: 44px;", "Public policy navigation must preserve accessible touch targets.");
requireText(css, ":focus-visible", "Public policy pages must preserve keyboard focus treatment.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "Public policy pages must preserve reduced-motion accessibility.");
requireText(css, "@media print", "Public policy print behavior must remain available.");
requireText(component, "data-policy-print-root", "Public policy print root changed unexpectedly.");
requireText(component, "data-policy-screen-only", "Public policy screen-only controls changed unexpectedly.");
requireText(component, "data-policy-print-section", "Public policy print section boundaries changed unexpectedly.");
requireText(component, "<PolicyPrintButton />", "Public policy print action was removed.");
requireText(component, "sections.map((section, index)", "Public policy section rendering changed unexpectedly.");
requireText(component, "effectiveDate || reviewedDate", "Public policy document status behavior changed unexpectedly.");

forbid(component, /\bPanel\b/, "Public policy pages still depend on the legacy Panel composition.");
forbid(css, /border-radius:\s*999px/, "Public policy navigation still contains legacy pill treatment.");
forbid(css, /box-shadow\s*:/, "Public policy pages still contain decorative card shadows.");

console.log("Public Policy Editorial UI verification passed.");
