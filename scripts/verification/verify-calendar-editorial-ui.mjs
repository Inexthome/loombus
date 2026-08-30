import fs from "node:fs";

const calendarPath = "src/components/calendar-page.tsx";
const syncPath = "src/components/calendar-external-sync-panel.tsx";
const calendar = fs.readFileSync(calendarPath, "utf8");
const sync = fs.readFileSync(syncPath, "utf8");
const combined = `${calendar}\n${sync}`;

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(calendar, 'data-calendar-editorial="route"', "Calendar route must expose its Editorial contract.");
requireText(sync, 'data-calendar-editorial="external-sync"', "External calendar sync must share the Editorial contract.");
requireText(combined, "bg-[color:var(--loombus-page-bg)]", "Calendar surfaces must use the Editorial page background.");
requireText(combined, "border-b border-[color:var(--loombus-border)]", "Calendar surfaces must use divider-led Editorial structure.");
requireText(combined, "var(--loombus-gold)", "Calendar surfaces must use restrained Gold signals.");
requireText(combined, "min-h-11", "Calendar controls must preserve accessible touch targets.");
requireText(combined, "focus-visible:outline-none", "Calendar controls must preserve keyboard focus treatment.");
requireText(combined, "motion-reduce:transition-none", "Calendar surfaces must respect reduced-motion preferences.");

requireText(calendar, 'scheduleAuthorizedFetch(\n        "/api/calendar"', "Calendar GET contract changed unexpectedly.");
requireText(calendar, 'action: "respond_room_event"', "Room event response action changed unexpectedly.");
requireText(calendar, "eventId: item.id", "Room event response identifier changed unexpectedly.");
requireText(calendar, '["Browse Events", "/events"]', "Events destination changed unexpectedly.");
requireText(calendar, '["Open Rooms", "/rooms"]', "Rooms destination changed unexpectedly.");
requireText(calendar, '["Open Appointments", "/appointments"]', "Appointments destination changed unexpectedly.");
requireText(calendar, '["Event Studio", "/events/manage"]', "Event Studio destination changed unexpectedly.");

requireText(sync, '"/api/calendar/external-feed"', "External calendar feed API changed unexpectedly.");
requireText(sync, 'method: "POST"', "External calendar link POST behavior changed unexpectedly.");
requireText(sync, 'body: JSON.stringify({ action })', "External calendar link action payload changed unexpectedly.");
requireText(sync, 'method: "DELETE"', "External calendar link revoke behavior changed unexpectedly.");
requireText(sync, 'href="/premium"', "Premium upgrade destination changed unexpectedly.");
requireText(sync, "navigator.clipboard.writeText(feedUrl)", "Private calendar link copy behavior changed unexpectedly.");
requireText(sync, 'aria-label="Private calendar subscription link"', "Private calendar link accessible label changed unexpectedly.");

forbid(combined, /rounded-(?:full|xl|2xl|3xl|\[)/, "Calendar surfaces still contain legacy rounded-card or pill treatment.");
forbid(combined, /shadow-(?:sm|md|lg|xl|2xl)/, "Calendar surfaces still contain decorative shadows.");

console.log("Calendar Editorial UI verification passed.");
