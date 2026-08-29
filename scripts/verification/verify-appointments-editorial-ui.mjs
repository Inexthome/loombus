import fs from "node:fs";

const files = {
  route: fs.readFileSync("src/app/appointments/page.tsx", "utf8"),
  schedule: fs.readFileSync("src/components/unified-appointments-overview.tsx", "utf8"),
  manage: fs.readFileSync("src/components/appointments-manager-page.tsx", "utf8"),
};

function requireText(source, text, message) {
  if (!source.includes(text)) throw new Error(message);
}

function forbidText(source, text, message) {
  if (source.includes(text)) throw new Error(message);
}

requireText(files.route, 'data-appointments-editorial="route"', "Appointments route Editorial marker missing.");
requireText(files.schedule, 'data-appointments-editorial="schedule"', "Unified schedule Editorial marker missing.");
requireText(files.manage, 'data-appointments-editorial="manage"', "Appointments manager Editorial marker missing.");

requireText(files.route, "var(--loombus-page-bg)", "Appointments route must preserve the Loombus page background.");
requireText(files.manage, "var(--loombus-page-bg)", "Appointments manager must preserve the Loombus page background.");

for (const [name, source] of Object.entries(files)) {
  forbidText(source, "shadow-xl", `${name} still contains legacy shadow-xl dashboard styling.`);
  forbidText(source, "shadow-2xl", `${name} still contains legacy shadow-2xl dashboard styling.`);
  forbidText(source, "rounded-[1.75rem]", `${name} still contains legacy large rounded card styling.`);
  forbidText(source, "xl:sticky", `${name} still contains a legacy sticky dashboard rail.`);
  forbidText(source, "radial-gradient", `${name} must not introduce a radial gradient.`);
}

requireText(files.schedule, '"/api/appointments/unified"', "Unified appointments API contract missing.");
requireText(files.schedule, "reconcileAppointmentLiveUpdates", "Native appointment live-update reconciliation missing.");
requireText(files.schedule, "startAppointmentLiveUpdate", "Native appointment live-update action missing.");
requireText(files.schedule, "border-b-2", "Unified schedule underline navigation missing.");
requireText(files.schedule, "var(--loombus-gold)", "Unified schedule Gold Editorial accent missing.");

requireText(files.manage, '"/api/appointments?manage=1"', "Appointment management API contract missing.");
requireText(files.manage, '"/api/appointments"', "Appointment mutation API contract missing.");
requireText(files.manage, 'action: "provider_response"', "Provider response workflow missing.");
requireText(files.manage, 'action: "requester_action"', "Requester workflow missing.");
requireText(files.manage, 'action: "set_service_status"', "Appointment service lifecycle workflow missing.");
requireText(files.manage, 'action: "complete"', "Appointment completion workflow missing.");
requireText(files.manage, "ProfessionalBookingAvailabilityCard", "Professional Booking availability workspace missing.");
requireText(files.manage, 'href="/businesses/manage"', "Business management destination missing.");
requireText(files.manage, 'href="/calendar"', "Calendar destination missing.");
requireText(files.manage, "border-b-2", "Appointments workspace underline tabs missing.");
requireText(files.manage, "var(--loombus-gold)", "Appointments workspace Gold Editorial accent missing.");

const professionalDestinations = [
  "/appointments/professional-payment",
  "/appointments/professional-payout",
  "/appointments/professional-pricing-history",
  "/appointments/professional-pricing",
  "/appointments/professional-policy",
  "/appointments/professional-intake-responses",
  "/appointments/professional-intake",
];
for (const destination of professionalDestinations) {
  requireText(files.route, destination, `Professional Booking destination missing: ${destination}`);
}

console.log("Appointments Editorial UI verification passed.");
