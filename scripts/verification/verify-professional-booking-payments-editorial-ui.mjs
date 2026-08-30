import fs from "node:fs";

const routePath = "src/app/appointments/professional-payment/page.tsx";
const centerPath = "src/components/professional-booking-payment-center.tsx";
const route = fs.readFileSync(routePath, "utf8");
const center = fs.readFileSync(centerPath, "utf8");
const combined = `${route}\n${center}`;

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(route, 'data-professional-booking-payments-editorial="route"', "Professional Booking payments route must expose its Editorial contract.");
requireText(center, 'data-professional-booking-payments-editorial="center"', "Professional Booking payment center must expose its Editorial contract.");
requireText(combined, "bg-[color:var(--loombus-page-bg)]", "Professional Booking payments must use the Editorial page background.");
requireText(combined, "border-b border-[color:var(--loombus-border)]", "Professional Booking payments must use divider-led Editorial structure.");
requireText(combined, "var(--loombus-gold)", "Professional Booking payments must use restrained Gold signals.");
requireText(combined, "min-h-11", "Professional Booking payment controls must preserve accessible touch targets.");
requireText(combined, "focus-visible:outline-none", "Professional Booking payment controls must preserve keyboard focus treatment.");
requireText(combined, "motion-reduce:transition-none", "Professional Booking payment controls must respect reduced-motion preferences.");

requireText(center, '"/api/appointments/professional-payment"', "Professional Booking payment API contract changed unexpectedly.");
requireText(center, 'body: JSON.stringify({ action: actionName, paymentId: payment.id })', "Professional Booking payment action payload changed unexpectedly.");
requireText(center, 'actionName: "checkout" | "refresh"', "Professional Booking payment actions changed unexpectedly.");
requireText(center, 'if (actionName === "checkout" && !payload.checkoutUrl)', "Professional Booking checkout response handling changed unexpectedly.");
requireText(center, "professionalBookingPaymentAmountLabel(payment.grossAmountCents)", "Requester price rendering changed unexpectedly.");
requireText(center, "professionalBookingPaymentAmountLabel(payment.platformFeeCents)", "Platform fee rendering changed unexpectedly.");
requireText(center, "professionalBookingPaymentAmountLabel(payment.providerNetBeforeProcessingCents)", "Provider amount rendering changed unexpectedly.");
requireText(route, 'href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(combined, /#[0-9a-fA-F]{6}/, "Professional Booking payments still contain hard-coded colors.");
forbid(combined, /rounded-(?:full|xl|2xl|3xl|\[)/, "Professional Booking payments still contain legacy rounded-card or pill treatment.");
forbid(combined, /shadow-(?:sm|md|lg|xl|2xl)/, "Professional Booking payments still contain decorative shadows.");

console.log("Professional Booking payments Editorial UI verification passed.");
