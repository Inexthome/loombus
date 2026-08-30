import fs from "node:fs";

const routePath = "src/app/appointments/professional-payout/page.tsx";
const centerPath = "src/components/professional-booking-payout-card.tsx";
const route = fs.readFileSync(routePath, "utf8");
const center = fs.readFileSync(centerPath, "utf8");
const combined = `${route}\n${center}`;

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}

function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(route, 'data-professional-booking-payout-editorial="route"', "Professional Booking payout route must expose its Editorial contract.");
requireText(center, 'data-professional-booking-payout-editorial="center"', "Professional Booking payout center must expose its Editorial contract.");
requireText(combined, "bg-[color:var(--loombus-page-bg)]", "Professional Booking payout must use the Editorial page background.");
requireText(combined, "border-b border-[color:var(--loombus-border)]", "Professional Booking payout must use divider-led Editorial structure.");
requireText(combined, "var(--loombus-gold)", "Professional Booking payout must use restrained Gold signals.");
requireText(combined, "min-h-11", "Professional Booking payout controls must preserve accessible touch targets.");
requireText(combined, "focus-visible:outline-none", "Professional Booking payout controls must preserve keyboard focus treatment.");
requireText(combined, "motion-reduce:transition-none", "Professional Booking payout controls must respect reduced-motion preferences.");

requireText(center, '"/api/appointments/professional-payout"', "Professional Booking payout API contract changed unexpectedly.");
requireText(center, 'entitlement: "professional_booking"', "Professional Booking subscription entitlement changed unexpectedly.");
requireText(center, 'name === "start_onboarding" && !data.payoutOnboardingEnabled', "Payout onboarding deployment gate changed unexpectedly.");
requireText(center, '!data.paymentEligibilityReviewAvailable', "Payment eligibility review gate changed unexpectedly.");
requireText(center, '!data.paymentEligible', "Payment eligibility approval gate changed unexpectedly.");
requireText(center, 'name === "accept_payment_terms" && !termsChecked', "Payment terms acceptance gate changed unexpectedly.");
requireText(center, 'paymentTermsAccepted:', "Payment terms payload changed unexpectedly.");
requireText(center, 'window.location.assign(String(payload.url))', "Stripe redirect behavior changed unexpectedly.");
requireText(center, 'data.ageSafetyAvailable &&', "Age-safety eligibility gate changed unexpectedly.");
requireText(center, 'data.adultProviderEligible', "Adult-provider eligibility gate changed unexpectedly.");
requireText(route, 'href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(combined, /#[0-9a-fA-F]{6}/, "Professional Booking payout still contains hard-coded colors.");
forbid(combined, /rounded-(?:full|xl|2xl|3xl|\[)/, "Professional Booking payout still contains legacy rounded-card or pill treatment.");
forbid(combined, /shadow-(?:sm|md|lg|xl|2xl)/, "Professional Booking payout still contains decorative shadows.");

console.log("Professional Booking payout Editorial UI verification passed.");
