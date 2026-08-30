import fs from "node:fs";

const path = "src/components/professional-booking-intake-responses-page.tsx";
const source = fs.readFileSync(path, "utf8");

function requireText(value, message) {
  if (!source.includes(value)) throw new Error(message);
}

function forbid(pattern, message) {
  if (pattern.test(source)) throw new Error(message);
}

requireText('data-professional-booking-intake-responses-editorial="root"', "Client intake responses must expose its Editorial contract.");
requireText("bg-[color:var(--loombus-page-bg)]", "Client intake responses must use the Editorial page background.");
requireText("border-b border-[color:var(--loombus-border)]", "Client intake responses must use divider-led Editorial structure.");
requireText("var(--loombus-gold)", "Client intake responses must use restrained Gold signals.");
requireText("min-h-11", "Client intake response controls must preserve accessible touch targets.");
requireText("focus-visible:outline-none", "Client intake response controls must preserve keyboard focus treatment.");
requireText("motion-reduce:transition-none", "Client intake response controls must respect reduced-motion preferences.");

requireText('"/api/appointments/professional-intake-responses"', "Client intake response API contract changed unexpectedly.");
requireText('"/appointments/professional-intake-responses"', "Authorized schedule return route changed unexpectedly.");
requireText('Array.isArray(payload.responses)', "Client intake response normalization changed unexpectedly.");
requireText('record.status.replaceAll("_", " ")', "Request status rendering changed unexpectedly.");
requireText('requestTime(record.requestedStart, record.timezone)', "Appointment-time rendering changed unexpectedly.");
requireText('item.answer || "No answer provided."', "Saved intake-answer fallback changed unexpectedly.");
requireText('href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(/#[0-9a-fA-F]{6}/, "Client intake responses still contain hard-coded colors.");
forbid(/rounded-(?:full|xl|2xl|3xl|\[)/, "Client intake responses still contain legacy rounded-card or pill treatment.");
forbid(/shadow-(?:sm|md|lg|xl|2xl)/, "Client intake responses still contain decorative shadows.");

console.log("Professional Booking intake responses Editorial UI verification passed.");
