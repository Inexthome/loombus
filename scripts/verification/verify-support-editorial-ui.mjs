import fs from "node:fs";

const supportCss = fs.readFileSync("src/app/support/support-v2.css", "utf8");
const policyCss = fs.readFileSync("src/app/support/policy-help-discovery.css", "utf8");
const page = fs.readFileSync("src/app/support/page.tsx", "utf8");
const client = fs.readFileSync("src/app/support/support-v2-client.tsx", "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(supportCss, "background: var(--loombus-page-bg);", "Support must use the Editorial page background.");
requireText(supportCss, "border-bottom: 1px solid var(--loombus-border);", "Support must use divider-led Editorial structure.");
requireText(supportCss, "border-bottom-width: 2px;", "Support must preserve restrained Gold active/focus signals.");
requireText(supportCss, "@media (prefers-reduced-motion: reduce)", "Support must preserve reduced-motion accessibility.");
requireText(policyCss, "background: var(--loombus-page-bg);", "Support contact shell must use the Editorial page background.");
requireText(policyCss, 'data-active="true"', "Support category state styling changed unexpectedly.");
requireText(page, "<PolicyHelpDiscoveryClient policyEntries={policyEntries} />", "Support policy discovery composition changed unexpectedly.");
requireText(page, "<SupportV2Client />", "Structured support form composition changed unexpectedly.");
requireText(client, 'const SUPPORT_EMAIL = "support@loombus.com";', "Support contact destination changed unexpectedly.");

forbid(supportCss, /radial-gradient/i, "Support still contains decorative radial treatment.");
forbid(supportCss, /box-shadow\s*:/i, "Support still contains decorative card shadows.");
forbid(supportCss, /border-radius:\s*999px/i, "Support still contains legacy pill controls.");
forbid(policyCss, /border-radius:\s*999px/i, "Support policy categories still use legacy pill controls.");

console.log("Support Editorial UI verification passed.");
