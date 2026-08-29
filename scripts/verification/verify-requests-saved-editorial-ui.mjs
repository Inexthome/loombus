import fs from "node:fs";

const page = fs.readFileSync("src/components/requests-saved-page.tsx", "utf8");
const route = fs.readFileSync("src/app/requests/saved/page.tsx", "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`Legacy ${label} remains: ${text}`);
}

requireText(page, 'data-requests-editorial="saved"', "Editorial marker");
requireText(page, "bg-[color:var(--loombus-page-bg)]", "original Loombus background");
requireText(page, '"/api/requests?saved=1"', "saved Requests API");
requireText(page, 'action: "unsave"', "unsave action");
requireText(page, "serviceRequestsAuthorizedFetch", "authorized Requests fetch");
requireText(page, "border-b-2", "underline filters");
requireText(page, "border-[color:var(--loombus-gold)]", "Gold active state");
requireText(page, "divide-y divide-[color:var(--loombus-border)]", "divider-led records");
requireText(page, 'href="/requests/manage"', "manage Requests destination");
requireText(page, 'href="/services/saved"', "saved Services destination");
requireText(page, 'href="/search"', "Everything Search destination");
requireText(route, "RequestsSavedPage", "route wiring");

for (const [text, label] of [
  ["SavedHeader", "shared dashboard header"],
  ["SavedMetrics", "metric cards"],
  ["SavedControls", "boxed controls"],
  ["SavedRail", "side rail"],
  ["rounded-[1.75rem]", "large rounded cards"],
  ["shadow-xl", "large shadows"],
  ["shadow-lg", "card shadows"],
  ["xl:grid-cols-[minmax(0,1fr)_21rem]", "sticky-style rail layout"],
  ["radial-gradient", "gradient chrome"],
]) {
  forbidText(page, text, label);
}

console.log("Saved Requests Editorial UI verification passed.");
