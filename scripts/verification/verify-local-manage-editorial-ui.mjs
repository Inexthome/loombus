import fs from "node:fs";

const componentPath = "src/components/local-manage-page.tsx";
const pagePath = "src/app/local/manage/page.tsx";
const cssPath = "src/app/local/local-manage-editorial.css";

const component = fs.readFileSync(componentPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(component, "data-loombus-local-manage-editorial", "Local manage must use the Editorial page scope.");
requireText(component, "border-b border-[color:var(--loombus-border)]", "Local manage must use divider-led Editorial structure.");
requireText(component, "bg-[color:var(--loombus-gold)]", "Local manage must preserve the Loombus Gold primary action.");
requireText(component, "motion-reduce:transition-none", "Local manage must preserve reduced-motion accessibility.");
requireText(component, '"/api/local?manage=1"', "Local manage loading contract changed unexpectedly.");
requireText(component, 'action: "set_location"', "Local manage set-location contract changed unexpectedly.");
requireText(component, 'action: "clear_location"', "Local manage clear-location contract changed unexpectedly.");
requireText(component, "getCurrentApproximateLocation()", "Local manage current-area capture changed unexpectedly.");
requireText(component, '"/local/manage"', "Local manage authorized redirect destination changed unexpectedly.");
requireText(component, 'href="/local"', "Local manage Local destination changed unexpectedly.");
requireText(component, "selected.href", "Local manage original-source destination changed unexpectedly.");
requireText(component, "item.canSetDirect", "Local manage direct-location eligibility behavior changed unexpectedly.");
requireText(page, 'import "../local-manage-editorial.css";', "Local manage Editorial stylesheet is not loaded.");
requireText(page, "<LocalManagePage />", "Local manage route composition changed unexpectedly.");
requireText(css, "#fefbec", "Local manage Light/System-light surface must use canonical Loombus Cream.");

forbid(component, /rounded-\[1\.(?:4|5|75)rem\]/, "Local manage still contains legacy large rounded panels.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Local manage still contains decorative panel shadows.");
forbid(component, /rounded-full/, "Local manage still contains legacy pill controls or metadata.");
forbid(component, /grid gap-3 sm:grid-cols-4[^\n]*rounded/, "Local manage summary must not regress to metric cards.");

console.log("Local Manage Editorial UI verification passed.");
