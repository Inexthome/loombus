import fs from "node:fs";

const client = fs.readFileSync("src/app/account/enforcement/account-enforcement-client.tsx", "utf8");
const css = fs.readFileSync("src/app/account/enforcement/account-enforcement.css", "utf8");

function requireText(source, needle, label) {
  if (!source.includes(needle)) throw new Error(`Missing ${label}: ${needle}`);
}

function forbidText(source, needle, label) {
  if (source.includes(needle)) throw new Error(`Forbidden ${label}: ${needle}`);
}

for (const [needle, label] of [
  ['fetch("/api/account/enforcement"', "enforcement history API"],
  ['fetch("/api/account/enforcement/appeals"', "appeal submission API"],
  ['Authorization: `Bearer ${accessToken}`', "authenticated API requests"],
  ['APPEAL_ELIGIBLE_STATES', "appeal eligibility contract"],
  ['appealStatement.trim().length < 20', "appeal minimum-length validation"],
  ['decisionId: selectedDecision.id', "appeal decision payload"],
  ['statement: appealStatement.trim()', "appeal statement payload"],
  ['additionalContext: additionalContext.trim()', "appeal context payload"],
  ['hasNewInformation,', "new-information payload"],
  ['window.location.href = "/login?next=%2Faccount%2Fenforcement"', "auth redirect"],
]) requireText(client, needle, label);

for (const [needle, label] of [
  ['background: var(--loombus-page-bg);', "Loombus Editorial page background"],
  ['border-bottom: 1px solid var(--loombus-border);', "divider-led structure"],
  ['color: var(--loombus-gold);', "restrained Gold treatment"],
  ['min-height: 44px;', "accessible control targets"],
  ['grid-template-columns: minmax(240px, 340px) minmax(0, 1fr);', "desktop Editorial workspace"],
  ['@media (max-width: 820px)', "responsive mobile layout"],
  ['@media (prefers-reduced-motion: reduce)', "reduced motion support"],
]) requireText(css, needle, label);

for (const forbidden of [
  "border-radius: 28px",
  "border-radius: 24px",
  "border-radius: 20px",
  "border-radius: 18px",
  "border-radius: 16px",
  "border-radius: 14px",
  "border-radius: 999px",
  "background: color-mix(in srgb, var(--background",
  "box-shadow: 0 ",
  "linear-gradient",
  "radial-gradient",
]) forbidText(css, forbidden, "legacy card/pill/shadow treatment");

console.log("Account Enforcement Editorial UI verification passed.");
