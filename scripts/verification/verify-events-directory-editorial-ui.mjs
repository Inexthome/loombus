import fs from "node:fs";

const componentPath = "src/components/events-directory-page.tsx";
const pagePath = "src/app/events/page.tsx";
const component = fs.readFileSync(componentPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(component, "bg-[color:var(--loombus-page-bg)]", "Events directory must use the Editorial page background.");
requireText(component, "border-b border-[color:var(--loombus-border)]", "Events directory must use divider-led Editorial structure.");
requireText(component, "border-b-2 border-[color:var(--loombus-gold)]", "Events directory must preserve restrained Gold active/action signals.");
requireText(component, "motion-reduce:transition-none", "Events directory must preserve reduced-motion accessibility.");
requireText(component, 'fetch(`/api/events?${params.toString()}`', "Events directory API contract changed unexpectedly.");
requireText(component, 'href="/calendar"', "Events calendar destination changed unexpectedly.");
requireText(component, 'href="/events/manage"', "Events management destination changed unexpectedly.");
requireText(component, 'href={`/events/${event.slug}`}', "Events detail destination changed unexpectedly.");
requireText(component, 'setCategory("All categories")', "Events clear-filter behavior changed unexpectedly.");
requireText(page, "<EventsDirectoryPage />", "Events route composition changed unexpectedly.");

forbid(component, /rounded-\[1\.75rem\]/, "Events directory still contains legacy large rounded cards.");
forbid(component, /rounded-\[1\.4rem\]/, "Events directory still contains legacy metric cards.");
forbid(component, /rounded-full/, "Events directory still contains legacy pill controls or metadata.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Events directory still contains decorative card shadows.");

console.log("Events Directory Editorial UI verification passed.");
