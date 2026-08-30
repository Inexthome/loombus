import fs from "node:fs";

const componentPath = "src/components/professional-booking-intake-card.tsx";
const routePath = "src/app/appointments/professional-intake/page.tsx";
const source = fs.readFileSync(componentPath, "utf8");
const route = fs.readFileSync(routePath, "utf8");

function requireText(haystack, value, message) {
  if (!haystack.includes(value)) throw new Error(message);
}

function forbid(haystack, pattern, message) {
  if (pattern.test(haystack)) throw new Error(message);
}

requireText(source, 'data-professional-booking-intake-editorial="root"', "Professional intake must expose its Editorial contract.");
requireText(source, "bg-[color:var(--loombus-page-bg)]", "Professional intake must use the Editorial page background.");
requireText(source, "border-b border-[color:var(--loombus-border)]", "Professional intake must use divider-led Editorial structure.");
requireText(source, "var(--loombus-gold)", "Professional intake must use restrained Gold signals.");
requireText(source, "min-h-11", "Professional intake controls must preserve accessible touch targets.");
requireText(source, "focus-visible:outline-none", "Professional intake controls must preserve keyboard focus treatment.");
requireText(source, "motion-reduce:transition-none", "Professional intake controls must respect reduced-motion preferences.");
requireText(route, "bg-[color:var(--loombus-page-bg)]", "Professional intake route must preserve the Editorial page background.");
requireText(route, 'href="/appointments"', "Professional intake route must preserve Appointments navigation.");

requireText(source, '"/api/appointments?manage=1"', "Appointment service management read contract changed unexpectedly.");
requireText(source, '`/api/appointments/professional-intake?${params.toString()}`', "Professional intake read endpoint changed unexpectedly.");
requireText(source, '"/api/appointments/professional-intake"', "Professional intake write endpoint changed unexpectedly.");
requireText(source, 'method: "PUT"', "Professional intake save method changed unexpectedly.");
requireText(source, 'serviceId: selectedServiceId', "Professional intake service payload changed unexpectedly.");
requireText(source, 'questions: normalizedQuestions', "Professional intake question payload changed unexpectedly.");
requireText(source, 'entitlement: "professional_booking"', "Professional Booking entitlement gate changed unexpectedly.");
requireText(source, 'data?.canUseProfessionalBooking === true', "Professional Booking edit gate changed unexpectedly.");
requireText(source, 'data.subscriptionResolutionAvailable', "Professional Booking subscription-resolution safety gate changed unexpectedly.");
requireText(source, 'question.label.trim()', "Professional intake normalization changed unexpectedly.");
requireText(source, 'question.label.length < 3', "Professional intake validation changed unexpectedly.");
requireText(source, "PROFESSIONAL_BOOKING_INTAKE_QUESTION_LIMIT", "Professional intake question limit changed unexpectedly.");
requireText(source, 'service.status !== "archived"', "Archived-service exclusion changed unexpectedly.");
requireText(source, '"/appointments/professional-intake"', "Authorized schedule return route changed unexpectedly.");

forbid(source, /#[0-9a-fA-F]{6}/, "Professional intake still contains hard-coded colors.");
forbid(source, /rounded-(?:full|xl|2xl|3xl|\[)/, "Professional intake still contains legacy rounded-card or pill treatment.");
forbid(source, /shadow-(?:sm|md|lg|xl|2xl)/, "Professional intake still contains decorative shadows.");
forbid(route, /rounded-(?:full|xl|2xl|3xl|\[)/, "Professional intake route still contains legacy pill treatment.");

console.log("Professional Booking intake Editorial UI verification passed.");
