import fs from "node:fs";

const componentPath = "src/components/event-detail-page.tsx";
const pagePath = "src/app/events/[slug]/page.tsx";
const component = fs.readFileSync(componentPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(component, "bg-[color:var(--loombus-page-bg)]", "Event detail must use the Editorial page background.");
requireText(component, "border-b border-[color:var(--loombus-border)]", "Event detail must use divider-led Editorial structure.");
requireText(component, "border-b-2 border-[color:var(--loombus-gold)]", "Event detail must preserve restrained Gold action signals.");
requireText(component, "motion-reduce:transition-none", "Event detail must preserve reduced-motion accessibility.");
requireText(component, 'fetch(`/api/events?slug=${encodeURIComponent(slug)}`', "Event detail read API contract changed unexpectedly.");
requireText(component, 'action: "respond"', "Event RSVP mutation contract changed unexpectedly.");
requireText(component, 'action: "report"', "Event report mutation contract changed unexpectedly.");
requireText(component, 'href="/events"', "Events return destination changed unexpectedly.");
requireText(component, 'href="/calendar"', "Calendar destination changed unexpectedly.");
requireText(component, 'href={event.registrationUrl}', "Event registration destination changed unexpectedly.");
requireText(component, 'href={event.onlineUrl}', "Online Event destination changed unexpectedly.");
requireText(page, "<EventDetailPage />", "Event detail route composition changed unexpectedly.");
requireText(page, '"@type": "Event"', "Event structured data changed unexpectedly.");

forbid(component, /rounded-\[1\.75rem\]/, "Event detail still contains legacy large rounded cards.");
forbid(component, /rounded-(?:full|2xl)/, "Event detail still contains legacy pill or rounded-card treatment.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Event detail still contains decorative card shadows.");

console.log("Event Detail Editorial UI verification passed.");
