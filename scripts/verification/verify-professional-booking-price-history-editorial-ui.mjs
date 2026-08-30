import fs from "node:fs";

const component = fs.readFileSync("src/components/professional-booking-price-history-card.tsx", "utf8");
const page = fs.readFileSync("src/app/appointments/professional-pricing-history/page.tsx", "utf8");

function requireText(text, value, message) {
  if (!text.includes(value)) throw new Error(message);
}
function forbid(text, pattern, message) {
  if (pattern.test(text)) throw new Error(message);
}

requireText(page, "bg-[color:var(--loombus-page-bg)]", "Saved quotes route must use the Editorial page background.");
requireText(page, "border-b border-[color:var(--loombus-border)]", "Saved quotes route must use divider-led Editorial structure.");
requireText(component, 'data-professional-booking-price-history-editorial="root"', "Saved quotes Editorial root marker is missing.");
requireText(component, "motion-reduce:transition-none", "Saved quotes must preserve reduced-motion accessibility.");
requireText(component, '"/api/appointments?manage=1"', "Appointments management read contract changed unexpectedly.");
requireText(component, ".professionalBookingPriceSnapshot", "Immutable quote snapshot filtering changed unexpectedly.");
requireText(component, "snapshot.amountCents / 100", "Saved quote monetary rendering changed unexpectedly.");
requireText(component, "snapshot.currency.toUpperCase()", "Saved quote currency rendering changed unexpectedly.");
requireText(component, "request.requestedStart", "Saved quote appointment time context changed unexpectedly.");
requireText(page, 'href="/appointments"', "Appointments return destination changed unexpectedly.");

forbid(component, /rounded-\[1\.75rem\]/, "Saved quotes still contain a legacy large rounded card.");
forbid(component, /rounded-(?:full|2xl)/, "Saved quotes still contain legacy pill or rounded-card treatment.");
forbid(component, /shadow-(?:sm|lg|xl|2xl)/, "Saved quotes still contain decorative shadows.");
forbid(page, /rounded-full/, "Saved quotes route still contains a legacy pill navigation control.");

console.log("Professional Booking Price History Editorial UI verification passed.");
