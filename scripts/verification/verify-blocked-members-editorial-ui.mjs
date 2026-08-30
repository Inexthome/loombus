import fs from "node:fs";

const clientPath = "src/app/blocked-users/blocked-users-v2-client.tsx";
const cssPath = "src/app/blocked-users/blocked-users-v2.css";
const client = fs.readFileSync(clientPath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(css, "background: var(--loombus-page-bg);", "Blocked Members must use the Editorial page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "Blocked Members must use divider-led Editorial structure.");
requireText(css, "min-height: 44px;", "Blocked Members controls must preserve accessible touch targets.");
requireText(css, ":focus-visible", "Blocked Members must preserve keyboard focus treatment.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "Blocked Members must preserve reduced-motion accessibility.");
requireText(client, 'fetch("/api/blocks"', "Blocked Members read API contract changed unexpectedly.");
requireText(client, 'fetch("/api/blocks/toggle"', "Blocked Members unblock API contract changed unexpectedly.");
requireText(client, "desiredState: false", "Blocked Members unblock behavior changed unexpectedly.");
requireText(client, 'window.location.replace("/login?next=%2Fblocked-users")', "Blocked Members auth redirect changed unexpectedly.");
requireText(client, 'href="/safety"', "Blocked Members safety destination changed unexpectedly.");
requireText(client, 'href="/guidelines"', "Blocked Members guidelines destination changed unexpectedly.");

forbid(css, /radial-gradient\(/, "Blocked Members still contains legacy radial decoration.");
forbid(css, /box-shadow\s*:/, "Blocked Members still contains decorative card shadows.");
forbid(css, /border-radius:\s*999px/, "Blocked Members still contains legacy pill controls.");
forbid(css, /border-radius:\s*(?:18|24|28|32)px/, "Blocked Members still contains legacy large rounded-card chrome.");

console.log("Blocked Members Editorial UI verification passed.");
