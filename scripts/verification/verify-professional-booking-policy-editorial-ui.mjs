import fs from "node:fs";

const componentPath = "src/components/professional-booking-policy-card.tsx";
const pagePath = "src/app/appointments/professional-policy/page.tsx";
const component = fs.readFileSync(componentPath, "utf8");
const page = fs.readFileSync(pagePath, "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(page, "bg-[color:var(--loombus-page-bg)]", "Professional Booking policy route must use the Editorial page background.");
requireText(page, "border-b border-[color:var(--loombus-border)]", "Professional Booking policy route must use divider-led Editorial structure.");
requireText(component, 'data-professional-booking-policy-editorial="root"', "Professional Booking policy Editorial root marker is missing.");
requireText(component, "border-b-2 border-[color:var(--loombus-gold)]", "Professional Booking policy must preserve restrained Gold primary action emphasis.");
requireText(component, "motion-reduce:transition-none", "Professional Booking policy must preserve reduced-motion accessibility.");
requireText(component, '"/api/appointments?manage=1"', "Appointment-service management API contract changed unexpectedly.");
requireText(component, '"/api/appointments/professional-policy"', "Professional Booking policy API contract changed unexpectedly.");
requireText(component, 'method: "PUT"', "Professional Booking policy save method changed unexpectedly.");
requireText(component, 'entitlement: "professional_booking"', "Professional Booking entitlement gate changed unexpectedly.");
requireText(component, "PROFESSIONAL_BOOKING_POLICY_TEXT_MAX", "Professional Booking policy text limit guard changed unexpectedly.");
requireText(component, "PROFESSIONAL_BOOKING_CANCELLATION_NOTICE_OPTIONS", "Professional Booking cancellation options changed unexpectedly.");
requireText(page, 'href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(component, /rounded-\[1\.75rem\]/, "Professional Booking policy still contains legacy large rounded cards.");
forbid(component, /rounded-(?:full|2xl)/, "Professional Booking policy still contains legacy pill or rounded-card treatment.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Professional Booking policy still contains decorative shadows.");
forbid(page, /rounded-full/, "Professional Booking policy route still contains a legacy pill navigation control.");

console.log("Professional Booking Policy Editorial UI verification passed.");
