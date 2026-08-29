import fs from "node:fs";

const componentPath = "src/components/requests-manager-page.tsx";
const routePath = "src/app/requests/manage/page.tsx";
const component = fs.readFileSync(componentPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`Forbidden ${label}: ${text}`);
}

requireText(component, 'data-requests-editorial="manage"', "Editorial surface marker");
requireText(component, "bg-[color:var(--loombus-page-bg)]", "Loombus page background");
requireText(component, '"/api/requests?manage=1"', "authorized manage endpoint");
requireText(component, '"/api/requests"', "Request mutation endpoint");
requireText(component, 'action: "moderate"', "admin moderation action");
requireText(component, 'action: "select_response"', "response selection action");
requireText(component, 'action: "withdraw_response"', "response withdrawal action");
requireText(component, 'action: "review_report"', "report review action");
requireText(component, "/messages?conversation=", "private conversation destination");
requireText(component, 'href="/requests/saved"', "Saved Requests destination");
requireText(component, 'href="/services/manage"', "Services management destination");
requireText(component, "border-b-2", "underline workspace navigation");
requireText(component, "border-[color:var(--loombus-gold)]", "Gold active state");
requireText(component, "divide-y divide-[color:var(--loombus-border-muted)]", "divider-led records");
requireText(route, "RequestsManagerPage", "manage route wiring");

for (const token of [
  "shadow-xl",
  "shadow-2xl",
  "rounded-[1.75rem]",
  "xl:sticky",
  "xl:grid-cols-[minmax(0,1fr)_20rem]",
  "radial-gradient",
]) {
  forbidText(component, token, "legacy dashboard chrome");
}

console.log("Requests manage Editorial UI verification passed.");
