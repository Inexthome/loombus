import fs from "node:fs";

const pagePath = "src/app/inbox/page.tsx";
const cssPath = "src/app/inbox/inbox.css";
const page = fs.readFileSync(pagePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(css, "background: var(--loombus-page-bg);", "Inbox hub must use the Editorial page background.");
requireText(css, "border-bottom: 1px solid var(--loombus-border);", "Inbox hub must use divider-led Editorial structure.");
requireText(css, "border-bottom: 2px solid transparent;", "Inbox hub tabs must use the flat Editorial tab structure.");
requireText(css, "border-bottom-color: var(--loombus-gold);", "Inbox hub active tab must use restrained Gold.");
requireText(css, "min-height: 44px;", "Inbox hub tabs must preserve accessible touch targets.");
requireText(css, ":focus-visible", "Inbox hub must preserve keyboard focus treatment.");
requireText(css, "@media (prefers-reduced-motion: reduce)", "Inbox hub must preserve reduced-motion accessibility.");
requireText(page, 'href="/inbox?tab=notifications"', "Inbox Notifications destination changed unexpectedly.");
requireText(page, 'href="/inbox?tab=messages"', "Inbox Messages destination changed unexpectedly.");
requireText(page, "requestedTab === \"messages\" ? \"messages\" : \"notifications\"", "Inbox default tab behavior changed unexpectedly.");
requireText(page, "<MessagesV2Client />", "Inbox Messages composition changed unexpectedly.");
requireText(page, "<NotificationsV2Client />", "Inbox Notifications composition changed unexpectedly.");

forbid(css, /border-radius:\s*999px/, "Inbox hub still contains legacy pill navigation.");
forbid(css, /box-shadow\s*:/, "Inbox hub still contains decorative navigation shadows.");

console.log("Inbox Hub Editorial UI verification passed.");
