import fs from "node:fs";

const componentPath = "src/components/professional-booking-pricing-card.tsx";
const pagePath = "src/app/appointments/professional-pricing/page.tsx";
const component = fs.readFileSync(componentPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}
function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(page, "bg-[color:var(--loombus-page-bg)]", "Professional Booking pricing route must use the Editorial page background.");
requireText(page, "border-b border-[color:var(--loombus-border)]", "Professional Booking pricing route must use divider-led Editorial structure.");
requireText(component, 'data-professional-booking-pricing-editorial="root"', "Professional Booking pricing Editorial root marker is missing.");
requireText(component, "border-b-2 border-[color:var(--loombus-gold)]", "Professional Booking pricing must preserve restrained Gold primary action emphasis.");
requireText(component, "motion-reduce:transition-none", "Professional Booking pricing must preserve reduced-motion accessibility.");
requireText(component, '"/api/appointments?manage=1"', "Appointment-service management API contract changed unexpectedly.");
requireText(component, '"/api/appointments/professional-pricing"', "Professional Booking pricing API contract changed unexpectedly.");
requireText(component, 'method: "PUT"', "Professional Booking pricing save method changed unexpectedly.");
requireText(component, 'entitlement: "professional_booking"', "Professional Booking entitlement gate changed unexpectedly.");
requireText(component, "inputToCents", "Integer-cent price validation changed unexpectedly.");
requireText(component, "clear: true", "Structured-price clear contract changed unexpectedly.");
requireText(page, 'href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(component, /rounded-\[1\.75rem\]/, "Professional Booking pricing still contains legacy large rounded cards.");
forbid(component, /rounded-(?:full|2xl)/, "Professional Booking pricing still contains legacy pill or rounded-card treatment.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Professional Booking pricing still contains decorative shadows.");
forbid(page, /rounded-full/, "Professional Booking pricing route still contains a legacy pill navigation control.");

console.log("Professional Booking Pricing Editorial UI verification passed.");
